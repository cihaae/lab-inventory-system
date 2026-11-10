import json
import logging
import os
import re
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from tempfile import NamedTemporaryFile
from threading import Lock
from urllib.parse import parse_qs, urlsplit

DATA_DIR = Path(os.environ.get("INVENTORY_DATA_DIR", Path(__file__).resolve().parent / "data"))
INVENTORY_FILE = DATA_DIR / "inventory.json"
MAX_JSON_BYTES = 2_621_440
ALLOWED_METHODS = "GET, POST, DELETE"

logger = logging.getLogger(__name__)
inventory_lock = Lock()


def reject_json_constant(value):
    raise ValueError(f"Konstanta JSON tidak valid: {value}")


def load_inventory():
    try:
        with INVENTORY_FILE.open(encoding="utf-8") as source:
            items = json.load(source, parse_constant=reject_json_constant)
    except FileNotFoundError:
        return []
    if not isinstance(items, list):
        raise ValueError("inventory.json harus berisi array.")
    return items


def save_inventory(items):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    temporary_path = None
    try:
        with NamedTemporaryFile(mode="w", encoding="utf-8", dir=DATA_DIR, delete=False) as target:
            temporary_path = Path(target.name)
            json.dump(items, target, indent=2)
            target.write("\n")
            target.flush()
            os.fsync(target.fileno())
        temporary_path.replace(INVENTORY_FILE)
    finally:
        if temporary_path is not None:
            temporary_path.unlink(missing_ok=True)


def parse_item(body):
    try:
        item = json.loads(body, parse_constant=reject_json_constant)
    except (ValueError, RecursionError) as exc:
        raise ValueError("Body JSON tidak valid.") from exc
    if not isinstance(item, dict):
        raise ValueError("Body JSON harus berupa objek.")

    name = item.get("name")
    category = item.get("category")
    quantity = item.get("quantity")
    condition = item.get("condition")
    description = item.get("description", "")

    if not isinstance(name, str) or not 1 <= len(name.strip()) <= 100:
        raise ValueError("Nama barang wajib diisi, maksimal 100 karakter.")
    if not isinstance(category, str) or not 1 <= len(category.strip()) <= 50:
        raise ValueError("Kategori wajib diisi, maksimal 50 karakter.")
    if type(quantity) is not int or quantity < 0:
        raise ValueError("Jumlah harus berupa bilangan bulat 0 atau lebih.")
    if condition not in ("Baik", "Rusak"):
        raise ValueError('Kondisi harus "Baik" atau "Rusak".')
    if not isinstance(description, str) or len(description) > 200:
        raise ValueError("Deskripsi harus berupa teks, maksimal 200 karakter.")

    return {
        "name": name.strip(),
        "category": category.strip(),
        "quantity": quantity,
        "condition": condition,
        "description": description.strip(),
    }


def parse_index(query):
    parameters = parse_qs(query, keep_blank_values=True, max_num_fields=1000)
    value = parameters.get("index", [""])[-1]
    if not re.fullmatch(r"-?[0-9]+", value):
        raise ValueError("Index harus berupa bilangan bulat.")
    return int(value)


def inventory_result(method, item, index):
    with inventory_lock:
        items = load_inventory()
        if method == "GET":
            return 200, items
        if method == "POST":
            items.append(item)
            save_inventory(items)
            return 201, item
        if not 0 <= index < len(items):
            return 404, {"error": "Barang tidak ditemukan."}

        deleted = items.pop(index)
        save_inventory(items)
        return 200, {"message": "Barang berhasil dihapus", "deleted": deleted}


class InventoryHandler(BaseHTTPRequestHandler):
    timeout = 10

    def send_json(self, status, data):
        body = json.dumps(data).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        if status == 405:
            self.send_header("Allow", ALLOWED_METHODS)
        self.end_headers()
        if self.command != "HEAD":
            self.wfile.write(body)

    def read_item(self):
        if self.headers.get_content_type() != "application/json":
            raise ValueError("Kirim data dengan Content-Type application/json.")
        lengths = self.headers.get_all("Content-Length", [])
        if self.headers.get("Transfer-Encoding") or len(lengths) != 1:
            raise ValueError("Kirim satu header Content-Length yang valid.")
        try:
            length = int(lengths[0])
        except ValueError as exc:
            raise ValueError("Content-Length harus berupa bilangan bulat.") from exc
        if not 0 < length <= MAX_JSON_BYTES:
            raise ValueError("Ukuran body JSON tidak valid.")

        body = self.rfile.read(length)
        if len(body) != length:
            raise ValueError("Body JSON tidak lengkap.")
        return parse_item(body)

    def handle_inventory(self):
        try:
            target = urlsplit(self.path)
            if target.path != "/inventory":
                self.send_json(404, {"error": "Endpoint tidak ditemukan."})
                return

            item = None
            index = None
            if self.command == "POST":
                item = self.read_item()
            elif self.command == "DELETE":
                index = parse_index(target.query)
        except ValueError as exc:
            self.send_json(400, {"error": str(exc)})
            return

        try:
            status, data = inventory_result(self.command, item, index)
        except (OSError, ValueError, RecursionError):
            logger.exception("Gagal mengakses inventory.json")
            status, data = 500, {"error": "Penyimpanan inventaris tidak dapat diakses."}
        self.send_json(status, data)

    def reject_method(self):
        if self.path.partition("?")[0] != "/inventory":
            self.send_json(404, {"error": "Endpoint tidak ditemukan."})
        else:
            self.send_json(405, {"error": "Metode HTTP tidak didukung."})

    do_GET = do_POST = do_DELETE = handle_inventory
    do_HEAD = do_OPTIONS = do_PUT = do_PATCH = do_TRACE = do_CONNECT = reject_method


if __name__ == "__main__":
    with ThreadingHTTPServer(("0.0.0.0", 5000), InventoryHandler) as server:
        print("API inventaris berjalan di port 5000.", flush=True)
        server.serve_forever()
