// =====================================================
// KONFIGURASI
// =====================================================
// true  = pakai data contoh (mock-data.js), Backend belum dibutuhkan
// false = pakai API sungguhan lewat Nginx (/api/inventory)
const USE_MOCK = true;
const API_URL = "/api/inventory";
const CONDITIONS = ["Baik", "Rusak"];

// =====================================================
// VALIDASI (aturan sesuai kontrak API)
// Mengembalikan teks pesan error, atau null jika data valid.
// =====================================================
function validateItem(item) {
    if (!item.name || item.name.trim() === "") {
        return "Nama barang wajib diisi.";
    }
    if (!item.category || item.category.trim() === "") {
        return "Kategori wajib diisi.";
    }
    if (!Number.isInteger(item.quantity) || item.quantity < 0) {
        return "Jumlah harus berupa bilangan bulat 0 atau lebih.";
    }
    if (!CONDITIONS.includes(item.condition)) {
        return 'Kondisi harus "Baik" atau "Rusak".';
    }
    return null;
}

// =====================================================
// LAPISAN DATA (hanya bagian ini yang berurusan dengan sumber data)
// =====================================================

let mockDb = (typeof MOCK_INVENTORY !== "undefined")
    ? JSON.parse(JSON.stringify(MOCK_INVENTORY))
    : [];

// Membaca pesan error dari respons Backend: { "error": "..." }
async function readError(response, fallback) {
    try {
        const data = await response.json();
        if (data && data.error) {
            return data.error;
        }
    } catch (e) {
        // respons bukan JSON, pakai pesan cadangan
    }
    return fallback;
}

async function getInventory() {
    if (USE_MOCK) {
        return JSON.parse(JSON.stringify(mockDb));
    }

    const response = await fetch(API_URL);
    if (!response.ok) {
        throw new Error(await readError(response, "Gagal mengambil data inventaris"));
    }
    return await response.json();
}

async function addInventory(item) {
    if (USE_MOCK) {
        // Meniru Backend: tolak data tidak valid (seperti respons 400)

        const message = validateItem(item);
        if (message) {
            throw new Error(message);
        }
        mockDb.push({ ...item });
        return { ...item };
    }

    const response = await fetch(API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(item)
    });
    if (!response.ok) {
        throw new Error(await readError(response, "Gagal menambahkan barang"));
    }
    return await response.json();
}

// Menghapus barang berdasarkan INDEX asli di array (bukan nomor baris di layar)
async function deleteInventory(index) {
    if (USE_MOCK) {
        // Meniru Backend: index di luar jangkauan = seperti respons 404
        if (!Number.isInteger(index) || index < 0 || index >= mockDb.length) {
            throw new Error("Barang tidak ditemukan.");
        }
        const deleted = mockDb.splice(index, 1)[0];
        return { message: "Barang berhasil dihapus", deleted: deleted };
    }

    const response = await fetch(`${API_URL}?index=${index}`, {
        method: "DELETE"

    });
    if (!response.ok) {
        throw new Error(await readError(response, "Gagal menghapus barang"));
    }
    return await response.json();
}

// =====================================================
// STATE (data yang sedang dipakai halaman)
// =====================================================
let inventory = [];        // data lengkap dari sumber data
let searchKeyword = "";    // isi kolom pencarian
let filterCondition = "";  // "" = semua, atau "Baik" / "Rusak"
let isDeleting = false;    // penjaga agar klik ganda tidak menghapus barang lain

// =====================================================
// UI: FUNGSI BANTU
// =====================================================
function escapeHtml(text) {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

// Menghasilkan daftar baris yang tampil, SESUAI pencarian dan filter.
// Index asli dipasang dulu (map), baru disaring (filter),
// sehingga index tetap menunjuk posisi di data lengkap.
function getVisibleRows() {
    const keyword = searchKeyword.trim().toLowerCase();


    return inventory
        .map((item, index) => ({ item, index }))
        .filter(({ item }) => {
            const matchesKeyword =
                keyword === "" ||
                String(item.name).toLowerCase().includes(keyword) ||
                String(item.category).toLowerCase().includes(keyword);

            const matchesCondition =
                filterCondition === "" || item.condition === filterCondition;

            return matchesKeyword && matchesCondition;
        });
}

// =====================================================
// UI: RENDER (menggambar tampilan dari data)
// =====================================================
function renderStats(items) {
    const totalTypes = items.length;
    const totalUnits = items.reduce((sum, item) => sum + Number(item.quantity), 0);
    const goodUnits = items
        .filter((item) => item.condition === "Baik")
        .reduce((sum, item) => sum + Number(item.quantity), 0);
    const badUnits = items
        .filter((item) => item.condition === "Rusak")
        .reduce((sum, item) => sum + Number(item.quantity), 0);

    document.getElementById("stat-total").textContent = totalTypes;
    document.getElementById("stat-units").textContent = totalUnits;
    document.getElementById("stat-good").textContent = goodUnits;

    document.getElementById("stat-bad").textContent = badUnits;
}

// rows = [{ item: {...}, index: posisiAsliDiArray }, ...]
function renderTable(rows) {
    const tbody = document.getElementById("inventory-body");
    const emptyState = document.getElementById("empty-state");

    if (rows.length === 0) {
        tbody.innerHTML = "";
        // Bedakan: data memang kosong, atau data ada tetapi tidak cocok dengan saringan
        emptyState.textContent = inventory.length === 0
            ? "Belum ada data barang."
            : "Tidak ada barang yang cocok dengan pencarian atau filter.";
        emptyState.hidden = false;
        return;
    }

    emptyState.hidden = true;

    tbody.innerHTML = rows
        .map(({ item, index }, position) => {
            const badgeClass = item.condition === "Baik" ? "badge-good" : "badge-bad";
            return `
        <tr data-index="${index}">
          <td>${position + 1}</td>
          <td>${escapeHtml(item.name)}</td>
          <td>${escapeHtml(item.category)}</td>
          <td>${escapeHtml(item.quantity)}</td>
          <td><span class="badge ${badgeClass}">${escapeHtml(item.condition)}</span></td>
          <td>${escapeHtml(item.description) || "-"}</td>
          <td><button type="button" class="btn btn-danger btn-small btn-delete">Hapus</button></td>

        </tr>`;
        })
        .join("");
}

function renderAll() {
    // Dashboard selalu menghitung SEMUA data; tabel hanya yang lolos saringan
    renderStats(inventory);
    renderTable(getVisibleRows());
}

// =====================================================
// UI: MODAL TAMBAH BARANG
// =====================================================
function setFormError(message) {
    const el = document.getElementById("form-error");
    el.textContent = message;
    el.hidden = message === "";
}

function openAddModal() {
    document.getElementById("form-add").reset();
    setFormError("");
    document.getElementById("modal-add").hidden = false;
    document.getElementById("input-name").focus();
}

function closeAddModal() {
    document.getElementById("modal-add").hidden = true;
}

// =====================================================

// EVENT HANDLER
// =====================================================
async function handleAddSubmit(event) {
    event.preventDefault();

    const quantityRaw = document.getElementById("input-quantity").value.trim();

    const item = {
        name: document.getElementById("input-name").value.trim(),
        category: document.getElementById("input-category").value.trim(),
        // Kolom kosong harus dianggap tidak valid (bukan 0)
        quantity: quantityRaw === "" ? NaN : Number(quantityRaw),
        condition: document.getElementById("input-condition").value,
        description: document.getElementById("input-description").value.trim()
    };

    const message = validateItem(item);
    if (message) {
        setFormError(message);
        return;
    }

    const submitButton = document.getElementById("btn-submit");
    submitButton.disabled = true;

    try {
        await addInventory(item);
        closeAddModal();
        await loadInventory();
    } catch (error) {
        setFormError(error.message);
    } finally {

        submitButton.disabled = false;
    }
}

// Satu listener di <tbody> untuk semua tombol Hapus (event delegation)
async function handleTableClick(event) {
    const button = event.target.closest(".btn-delete");
    if (!button) {
        return; // yang diklik bukan tombol Hapus
    }
    if (isDeleting) {
        return; // proses hapus sebelumnya belum selesai
    }

    // Index ASLI dibaca dari atribut data-index, bukan dari nomor baris
    const index = Number(button.closest("tr").dataset.index);
    const item = inventory[index];
    if (!item) {
        return;
    }

    const sure = confirm(`Hapus "${item.name}" (${item.quantity} unit) dari inventaris?`);
    if (!sure) {
        return;
    }

    isDeleting = true;
    try {
        await deleteInventory(index);
    } catch (error) {
        alert("Gagal menghapus barang: " + error.message);
    }

    // Selalu ambil data ulang: index barang di bawahnya sudah bergeser
    await loadInventory();
    isDeleting = false;
}

function handleSearchInput(event) {
    searchKeyword = event.target.value;
    renderAll();
}

function handleFilterChange(event) {
    filterCondition = event.target.value;
    renderAll();
}

function setupEvents() {
    document.getElementById("btn-add").addEventListener("click", openAddModal);
    document.getElementById("btn-cancel").addEventListener("click", closeAddModal);
    document.getElementById("form-add").addEventListener("submit", handleAddSubmit);

    document.getElementById("inventory-body").addEventListener("click", handleTableClick);
    document.getElementById("search-input").addEventListener("input", handleSearchInput);
    document.getElementById("filter-condition").addEventListener("change", handleFilterChange);

    // Klik area gelap di luar kotak form = tutup modal
    document.getElementById("modal-add").addEventListener("click", (event) => {
        if (event.target.id === "modal-add") {
            closeAddModal();
        }
    });

    // Tombol Esc = tutup modal

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeAddModal();
        }
    });
}

// =====================================================
// ALUR UTAMA
// =====================================================
async function loadInventory() {
    try {
        inventory = await getInventory();
        renderAll();
    } catch (error) {
        console.error(error);
        const emptyState = document.getElementById("empty-state");
        emptyState.textContent = "Gagal memuat data: " + error.message;
        emptyState.hidden = false;
    }
}

document.addEventListener("DOMContentLoaded", () => {
    setupEvents();
    // Browser kadang mengembalikan isi kolom pencarian setelah refresh;
    // samakan state dengan isi kolom yang sebenarnya.
    searchKeyword = document.getElementById("search-input").value;
    filterCondition = document.getElementById("filter-condition").value;
    loadInventory();
});