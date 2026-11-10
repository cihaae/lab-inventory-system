# LabStock - Inventaris Barang Laboratorium
**Ujian Chunin Cloud Computing - Studi Kasus 4**

## Anggota Kelompok
1. **Ganis** (NIM: [Isi NIM]) - Frontend Service (HTML, CSS, Vanilla JS)
2. **Sulthon** (NIM: [Isi NIM]) - Backend Service (Python REST API stdlib)
3. **Muhammad Ilham** (NIM: [Isi NIM]) - DevOps (Docker Compose, Nginx Reverse Proxy, Jenkins CI/CD)

---

## Diagram Arsitektur Sistem & CI/CD

```text
[Developer] --(git push)--> [GitHub Repo: main]
                                  |
                                  v (Webhook HTTPS)
                             [ngrok Tunnel]
                                  |
                                  v
                           [Jenkins :8080]
                                  |
                     (Docker CLI / Compose Engine)
                                  |
      +---------------------------+---------------------------+
      |                                                       |
[Service Frontend]                                      [Service Backend]
- Image: nginx:alpine                                   - Image: backend/Dockerfile
- Port Host: 8081 -> 80                                 - Port Internal: 5000 (Expose)
- Bind Mount: ./frontend                                - Storage: Named Volume
- Reverse Proxy: /api/ -> backend:5000                             (lab-inventory-data)
      |                                                       |
      +----------------- [Bridge: app-net] -------------------+
```

---

## Menjalankan Proyek Secara Lokal

Buka Docker Desktop jika menggunakan Windows. Dari folder proyek:

```sh
docker compose up --build -d
docker compose ps
```

Buka browser di [http://localhost:8081](http://localhost:8081).
Jika ingin menyesuaikan port, tentukan di file `.env`:
```env
LABSTOCK_PORT=8081
```

## Kontrak API

Nginx meneruskan `/api/inventory` ke `backend:5000/inventory` dan membawa query string yang dipakai untuk menghapus barang.

| Metode | URL dari browser | Respons sukses |
| --- | --- | --- |
| GET | `/api/inventory` | `200` dengan array barang |
| POST | `/api/inventory` | `201` dengan objek barang |
| DELETE | `/api/inventory?index=0` | `200` dengan `message` dan `deleted` |

Contoh body POST dengan header `Content-Type: application/json`:

```json
{
  "name": "Mikrotik RB750Gr3",
  "category": "Router",
  "quantity": 2,
  "condition": "Baik",
  "description": "Rak A1"
}
```

`quantity` adalah bilangan bulat minimal 0. `condition` menerima `Baik` atau `Rusak`. `description` boleh dikosongkan atau dihilangkan. Batas karakter nama, kategori, dan deskripsi masing-masing 100, 50, dan 200. Index dimulai dari 0 dan mengikuti urutan array dari GET.

## Demo Persistensi Data (Data Immunity)

1. Tambahkan sebuah barang dari halaman LabStock.
2. Dapatkan ID kontainer backend:
   ```sh
   docker compose ps -q backend
   ```
3. Hapus kontainer backend secara paksa:
   ```sh
   docker rm -f $(docker compose ps -q backend)
   ```
4. Jalankan kembali service backend:
   ```sh
   docker compose up -d backend
   docker compose ps
   ```
5. Tunggu backend berstatus `healthy`, lalu refresh halaman di browser. Barang yang disimpan tetap ada karena tersimpan di Named Volume `lab-inventory-data` (`/var/lib/backend_data/inventory.json`).

## Otomatisasi CI/CD Jenkins

1. **Pipeline Script**: Menggunakan `Jenkinsfile` deklaratif di root repositori.
2. **Trigger Webhook**: Event `push` GitHub diteruskan via ngrok tunnel (`https://<ngrok-domain>/github-webhook/`).
3. **Pipeline Stages**:
   - `Stage 1: Checkout Code`
   - `Stage 2: Syntax Check` (validasi `app.py` via container Python)
   - `Stage 3: Build & Deploy` (`docker compose up --build -d`)
   - `Stage 4: Health Check` (curl endpoint `/api/inventory`)
