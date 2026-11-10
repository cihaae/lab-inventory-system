# LabStock

Implementasi studi kasus 4 Inventaris Barang Laboratorium. Frontend dibuat oleh Ganis. Backend bagian Sulthon menggunakan `backend/app.py` dan pustaka standar Python. Docker Compose dan Nginx merupakan bagian Ilham.

## Menjalankan proyek

Buka Docker Desktop jika kamu menggunakan Windows. Dari folder yang berisi `docker-compose.yml`, jalankan:

```sh
docker compose up --build -d
docker compose ps
```

Buka [LabStock](http://localhost:8080). Frontend pada paket ini sudah memakai API. Inventaris awal kosong jika volume baru dibuat. Barang contoh dari mode mock disimpan terpisah di browser.

Kalau port 8080 sedang dipakai, buat file `.env` di folder proyek dengan isi `LABSTOCK_PORT=8081`. Jalankan kembali `docker compose up -d` lalu buka [LabStock di port 8081](http://localhost:8081).

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

`quantity` adalah bilangan bulat minimal 0. `condition` menerima `Baik` atau `Rusak`. `description` boleh dikosongkan atau dihilangkan. Batas karakter nama, kategori, dan deskripsi masing-masing 100, 50, dan 200. Index dimulai dari 0 dan mengikuti urutan array dari GET. API mengembalikan `400` untuk input tidak valid dan `404` untuk index di luar jangkauan. Keduanya menggunakan body JSON dengan field `error`.

## Demo persistensi data

1. Tambahkan sebuah barang dari halaman LabStock.
2. Jalankan `docker compose ps -q backend` untuk mendapatkan ID container.
3. Ganti `ID_CONTAINER_BACKEND` dengan hasil perintah tersebut, lalu jalankan perintah berikut.

   ```sh
   docker rm -f ID_CONTAINER_BACKEND
   docker compose up -d backend
   docker compose ps
   ```

4. Tunggu backend berstatus `healthy`, lalu muat ulang halaman. Jika Nginx masih memakai IP container lama, tunggu hingga cache DNS 10 detik habis dan muat ulang lagi.
5. Pastikan barang tetap tampil, lalu uji penghapusannya dari halaman.

Volume `lab-inventory-data` menyimpan file `/var/lib/backend_data/inventory.json`. Gunakan `docker compose down` untuk menghentikan demo sambil mempertahankan data. Opsi `-v` menghapus volume proyek beserta isinya.

Jika kamu sudah menyimpan barang dengan paket sebelumnya, gunakan `docker volume ls` untuk mencari volume lama yang berakhiran `_lab-inventory-data`. Tetapkan `LABSTOCK_VOLUME_NAME` di file `.env` ke nama lengkap volume itu agar paket baru memakai data yang sama.
