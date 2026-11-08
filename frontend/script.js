// =====================================================
// KONFIGURASI
// =====================================================
// true  = pakai data contoh (mock-data.js), Backend belum dibutuhkan
// false = pakai API sungguhan lewat Nginx (/api/inventory)
const USE_MOCK = true;
const API_URL = "/api/inventory";

// =====================================================
// LAPISAN DATA (hanya bagian ini yang berurusan dengan sumber data)
// =====================================================
let mockDb = (typeof MOCK_INVENTORY !== "undefined")
    ? JSON.parse(JSON.stringify(MOCK_INVENTORY))
    : [];

async function getInventory() {
    if (USE_MOCK) {
        // Kembalikan salinan supaya tampilan tidak bisa mengubah data asli
        return JSON.parse(JSON.stringify(mockDb));
    }

    const response = await fetch(API_URL);
    if (!response.ok) {
        throw new Error("Gagal mengambil data inventaris");
    }
    return await response.json();
}

// =====================================================
// STATE (data yang sedang dipakai halaman)
// =====================================================
let inventory = [];

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
        emptyState.textContent = "Belum ada data barang.";
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
          <td>-</td>
        </tr>`;
        })
        .join("");
}

function renderAll() {
    const rows = inventory.map((item, index) => ({ item, index }));
    renderStats(inventory);
    renderTable(rows);
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

document.addEventListener("DOMContentLoaded", loadInventory);