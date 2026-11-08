// =====================================================================
// LABSTOCK FRONTEND ENGINE (100% NATIVE VANILLA JAVASCRIPT)
// Desain: UI/UX Pro Max | Transisi: Transitions.dev
// =====================================================================

// =====================================================================
// 1. KONFIGURASI & KONTRAK DATA
// =====================================================================
const USE_MOCK = true;
const API_URL = "/api/inventory";
const CONDITIONS = ["Baik", "Rusak"];
const STORAGE_KEY = "labstock_inventory_data_v2";
const THEME_KEY = "labstock_theme_preference";

// Helper localStorage agar perubahan di mode Mock tetap tersimpan
function getInitialMockData() {
    try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
            const parsed = JSON.parse(saved);
            if (Array.isArray(parsed) && parsed.length > 0) {
                return parsed;
            }
        }
    } catch (e) {
        console.warn("Gagal membaca localStorage, beralih ke mock bawaan:", e);
    }
    return (typeof MOCK_INVENTORY !== "undefined")
        ? JSON.parse(JSON.stringify(MOCK_INVENTORY))
        : [];
}

function saveMockData(data) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
        console.warn("Gagal menyimpan ke localStorage:", e);
    }
}

let mockDb = getInitialMockData();

// Validasi input sesuai aturan kontrak data
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

// Membaca pesan error dari response Backend
async function readError(response, fallback) {
    try {
        const data = await response.json();
        if (data && data.error) {
            return data.error;
        }
    } catch (e) {
        // Abaikan jika bukan JSON
    }
    return fallback;
}

// Pengambilan inventaris (Mock atau API)
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

// Penambahan barang
async function addInventory(item) {
    if (USE_MOCK) {
        const message = validateItem(item);
        if (message) {
            throw new Error(message);
        }
        mockDb.push({ ...item });
        saveMockData(mockDb);
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

// Penghapusan barang berdasarkan index asli array
async function deleteInventory(index) {
    if (USE_MOCK) {
        if (!Number.isInteger(index) || index < 0 || index >= mockDb.length) {
            throw new Error("Barang tidak ditemukan.");
        }
        const deleted = mockDb.splice(index, 1)[0];
        saveMockData(mockDb);
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

// =====================================================================
// 2. STATE MANAJEMEN APLIKASI
// =====================================================================
let inventory = [];
let searchKeyword = "";
let filterCondition = ""; // "" = Semua, "Baik", "Rusak", "low-stock"
let filterCategory = "";
let sortOrder = "default";
let isDeleting = false;
let pendingDeleteIndex = null;
let toastTimeout = null;

// =====================================================================
// 3. FUNGSI BANTU & SANITASI
// =====================================================================
function escapeHtml(text) {
    return String(text ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

function getVisibleRows() {
    const keyword = searchKeyword.trim().toLowerCase();

    // 1. Pasang index asli
    let rows = inventory.map((item, index) => ({ item, index }));

    // 2. Saring kata kunci pencarian
    if (keyword !== "") {
        rows = rows.filter(({ item }) => {
            return (
                String(item.name).toLowerCase().includes(keyword) ||
                String(item.category).toLowerCase().includes(keyword) ||
                String(item.description || "").toLowerCase().includes(keyword)
            );
        });
    }

    // 3. Saring kondisi / filter tab
    if (filterCondition === "Baik" || filterCondition === "Rusak") {
        rows = rows.filter(({ item }) => item.condition === filterCondition);
    } else if (filterCondition === "low-stock") {
        rows = rows.filter(({ item }) => Number(item.quantity) <= 2);
    }

    // 4. Saring kategori
    if (filterCategory !== "") {
        rows = rows.filter(({ item }) => item.category === filterCategory);
    }

    // 5. Urutkan (Sorting)
    if (sortOrder === "name-asc") {
        rows.sort((a, b) => a.item.name.localeCompare(b.item.name));
    } else if (sortOrder === "name-desc") {
        rows.sort((a, b) => b.item.name.localeCompare(a.item.name));
    } else if (sortOrder === "qty-desc") {
        rows.sort((a, b) => Number(b.item.quantity) - Number(a.item.quantity));
    } else if (sortOrder === "qty-asc") {
        rows.sort((a, b) => Number(a.item.quantity) - Number(b.item.quantity));
    }

    return rows;
}

// =====================================================================
// 4. RENDER STATISTIK & GRAFIK NATIVE (SVG)
// =====================================================================

function renderStats(items) {
    const totalTypes = items.length;
    const totalUnits = items.reduce((sum, item) => sum + Number(item.quantity), 0);
    const goodUnits = items
        .filter((item) => item.condition === "Baik")
        .reduce((sum, item) => sum + Number(item.quantity), 0);
    const badUnits = items
        .filter((item) => item.condition === "Rusak")
        .reduce((sum, item) => sum + Number(item.quantity), 0);

    const categories = new Set(items.map(i => i.category)).size;
    const goodPct = totalUnits > 0 ? Math.round((goodUnits / totalUnits) * 100) : 0;
    const badPct = totalUnits > 0 ? Math.round((badUnits / totalUnits) * 100) : 0;

    // Nilai Kelaikan Operasional Lab
    const healthScore = totalUnits > 0 ? ((goodUnits / totalUnits) * 100).toFixed(1) : "0.0";

    // Update DOM Cards
    const elTotal = document.getElementById("stat-total");
    const elUnits = document.getElementById("stat-units");
    const elGood = document.getElementById("stat-good");
    const elBad = document.getElementById("stat-bad");
    const elCat = document.getElementById("stat-cat-tag");
    const elGoodPct = document.getElementById("stat-good-pct");
    const elBadPct = document.getElementById("stat-bad-pct");
    const elBarGood = document.getElementById("bar-good");
    const elBarBad = document.getElementById("bar-bad");
    const elHealthScore = document.getElementById("stat-health-score");
    const elHealthStatus = document.getElementById("stat-health-status");
    const elHealthDesc = document.getElementById("stat-health-desc");

    if (elTotal) elTotal.textContent = totalTypes;
    if (elUnits) elUnits.textContent = totalUnits;
    if (elGood) elGood.textContent = goodUnits;
    if (elBad) elBad.textContent = badUnits;
    if (elCat) elCat.textContent = `${categories} Kategori`;
    if (elGoodPct) elGoodPct.textContent = `${goodPct}%`;
    if (elBadPct) elBadPct.textContent = `${badPct}%`;
    if (elBarGood) elBarGood.style.width = `${goodPct}%`;
    if (elBarBad) elBarBad.style.width = `${badPct}%`;

    if (elHealthScore) elHealthScore.textContent = `${healthScore}%`;
    if (elHealthStatus && elHealthDesc) {
        if (goodPct >= 85) {
            elHealthStatus.textContent = "Prima";
            elHealthStatus.className = "health-chip status-good";
            elHealthDesc.textContent = "Kondisi perangkat sangat optimal untuk praktikum.";
        } else if (goodPct >= 65) {
            elHealthStatus.textContent = "Perhatian";
            elHealthStatus.className = "health-chip status-warning";
            elHealthDesc.textContent = "Sebagian perangkat memerlukan pemeliharaan rutin.";
        } else {
            elHealthStatus.textContent = "Kritis";
            elHealthStatus.className = "health-chip status-bad";
            elHealthDesc.textContent = "Banyak perangkat rusak, perlu perbaikan mendesak.";
        }
    }

    // Update Tab Counters
    const cntAll = document.getElementById("tab-cnt-all");
    const cntGood = document.getElementById("tab-cnt-good");
    const cntBad = document.getElementById("tab-cnt-bad");
    const cntLow = document.getElementById("tab-cnt-low");

    if (cntAll) cntAll.textContent = items.length;
    if (cntGood) cntGood.textContent = items.filter(i => i.condition === "Baik").length;
    if (cntBad) cntBad.textContent = items.filter(i => i.condition === "Rusak").length;
    if (cntLow) cntLow.textContent = items.filter(i => Number(i.quantity) <= 2).length;

    // Render Native Charts
    renderNativeDonutChart(goodUnits, badUnits, totalUnits, goodPct, badPct);
    renderNativeCategoryBars(items);
}

// Render Donut Chart Native SVG
function renderNativeDonutChart(goodUnits, badUnits, totalUnits, goodPct, badPct) {
    const elCenterNum = document.getElementById("donut-center-num");
    const elStatGood = document.getElementById("donut-stat-good");
    const elStatBad = document.getElementById("donut-stat-bad");
    const elInsight = document.getElementById("insight-text");
    const svgGood = document.getElementById("svg-donut-good");
    const svgBad = document.getElementById("svg-donut-bad");

    if (elCenterNum) elCenterNum.textContent = totalUnits;
    if (elStatGood) elStatGood.textContent = `${goodUnits} unit (${goodPct}%)`;
    if (elStatBad) elStatBad.textContent = `${badUnits} unit (${badPct}%)`;

    // Keliling lingkaran r=64 -> 2 * PI * 64 = 402.12
    const circumference = 2 * Math.PI * 64;

    if (svgGood && svgBad) {
        if (totalUnits === 0) {
            svgGood.style.strokeDasharray = `0 ${circumference}`;
            svgGood.style.strokeDashoffset = "0";
            svgBad.style.strokeDasharray = `0 ${circumference}`;
            svgBad.style.strokeDashoffset = "0";
        } else {
            const goodLength = (goodUnits / totalUnits) * circumference;
            const badLength = (badUnits / totalUnits) * circumference;

            svgGood.style.strokeDasharray = `${goodLength} ${circumference - goodLength}`;
            svgGood.style.strokeDashoffset = "0";

            svgBad.style.strokeDasharray = `${badLength} ${circumference - badLength}`;
            // Offset mundur sejauh segmen good
            svgBad.style.strokeDashoffset = `-${goodLength}`;
        }
    }

    if (elInsight) {
        if (badUnits > 0) {
            elInsight.textContent = `Terdapat ${badUnits} unit rusak yang memerlukan servis sebelum jadwal modul berikutnya.`;
        } else {
            elInsight.textContent = "Seluruh unit inventaris laboratorium dalam status siap beroperasi penuh.";
        }
    }
}

// Render Sebaran Kategori Bar Bertumpuk Native
function renderNativeCategoryBars(items) {
    const container = document.getElementById("category-bars-container");
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = '<p class="stat-footnote">Belum ada data perangkat.</p>';
        return;
    }

    // Kelompokkan data per kategori
    const catMap = {};
    items.forEach(item => {
        const cat = item.category || "Lainnya";
        if (!catMap[cat]) {
            catMap[cat] = { name: cat, total: 0, good: 0, bad: 0 };
        }
        const qty = Number(item.quantity) || 0;
        catMap[cat].total += qty;
        if (item.condition === "Baik") {
            catMap[cat].good += qty;
        } else {
            catMap[cat].bad += qty;
        }
    });

    const catList = Object.values(catMap).sort((a, b) => b.total - a.total);
    const maxQty = Math.max(...catList.map(c => c.total), 1);

    container.innerHTML = catList.map(cat => {
        const goodPctOfCat = cat.total > 0 ? (cat.good / cat.total) * 100 : 0;
        const badPctOfCat = cat.total > 0 ? (cat.bad / cat.total) * 100 : 0;
        const widthPctOfMax = Math.max((cat.total / maxQty) * 100, 8);

        return `
            <div class="category-bar-row">
                <div class="cat-bar-header">
                    <span class="cat-bar-name">
                        <strong>${escapeHtml(cat.name)}</strong>
                        <span class="stat-tag">(${cat.total} unit)</span>
                    </span>
                    <span class="cat-bar-counts">
                        <span style="color: var(--good-text);">${cat.good} Baik</span> &bull; 
                        <span style="color: var(--bad-text);">${cat.bad} Rusak</span>
                    </span>
                </div>
                <div class="cat-bar-track" style="width: ${widthPctOfMax}%;">
                    <div class="cat-bar-segment-good" style="width: ${goodPctOfCat}%;" title="${cat.name} Baik: ${cat.good} unit"></div>
                    <div class="cat-bar-segment-bad" style="width: ${badPctOfCat}%;" title="${cat.name} Rusak: ${cat.bad} unit"></div>
                </div>
            </div>
        `;
    }).join("");
}

// =====================================================================
// 5. RENDER TABEL & CONTROLS
// =====================================================================

function renderTable(rows) {
    const tbody = document.getElementById("inventory-body");
    const emptyState = document.getElementById("empty-state");
    const summaryInfo = document.getElementById("table-summary-info");

    if (!tbody || !emptyState) return;

    if (rows.length === 0) {
        tbody.innerHTML = "";
        const descEl = document.getElementById("empty-state-desc");
        if (descEl) {
            descEl.textContent = inventory.length === 0
                ? "Belum ada data barang di inventaris laboratorium."
                : "Tidak ada perangkat yang sesuai dengan filter atau kata kunci pencarian.";
        }
        emptyState.hidden = false;
        emptyState.style.display = "flex";
        if (summaryInfo) summaryInfo.textContent = "Menampilkan 0 data";
        return;
    }

    emptyState.hidden = true;
    emptyState.style.display = "none";
    if (summaryInfo) {
        summaryInfo.textContent = `Menampilkan ${rows.length} dari ${inventory.length} total perangkat`;
    }

    tbody.innerHTML = rows.map(({ item, index }, position) => {
        const isGood = item.condition === "Baik";
        const statusClass = isGood ? "status-good" : "status-bad";
        const isLow = Number(item.quantity) <= 2;

        return `
            <tr data-index="${index}">
                <td class="col-num"><span class="font-mono" style="opacity: 0.7;">${position + 1}</span></td>
                <td class="col-name">
                    <div class="item-name-cell">
                        <span class="item-title">${escapeHtml(item.name)}</span>
                    </div>
                </td>
                <td class="col-cat">
                    <span class="item-category-pill">${escapeHtml(item.category)}</span>
                </td>
                <td class="col-qty">
                    <div class="stock-cell-wrap">
                        <span class="stock-main-text">${escapeHtml(item.quantity)} unit</span>
                        ${isLow ? '<span class="stock-tag-low">Sisa &le; 2 Unit</span>' : ''}
                    </div>
                </td>
                <td class="col-cond">
                    <span class="condition-status-pill ${statusClass}">
                        <span class="status-indicator-dot" style="background-color: ${isGood ? 'var(--good-main)' : 'var(--bad-main)'}; box-shadow: none;"></span>
                        ${escapeHtml(item.condition)}
                    </span>
                </td>
                <td class="col-desc">
                    <div class="item-desc-text">${escapeHtml(item.description) || '<span style="opacity: 0.4;">-</span>'}</div>
                </td>
                <td class="col-action text-right">
                    <button type="button" class="btn-delete-row btn-delete" data-index="${index}" title="Hapus perangkat ini">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                        <span>Hapus</span>
                    </button>
                </td>
            </tr>
        `;
    }).join("");

    renderActiveFilterChips();
}

function renderActiveFilterChips() {
    const row = document.getElementById("active-chips-row");
    const list = document.getElementById("chips-list");
    if (!row || !list) return;

    const chips = [];
    if (searchKeyword.trim() !== "") {
        chips.push({ label: `Cari: "${searchKeyword.trim()}"`, type: "search" });
    }
    if (filterCondition !== "") {
        const condLabel = filterCondition === "low-stock" ? "Stok Kritis (<= 2)" : `Kondisi: ${filterCondition}`;
        chips.push({ label: condLabel, type: "condition" });
    }
    if (filterCategory !== "") {
        chips.push({ label: `Kategori: ${filterCategory}`, type: "category" });
    }

    if (chips.length === 0) {
        row.hidden = true;
        list.innerHTML = "";
    } else {
        row.hidden = false;
        list.innerHTML = chips.map(c => `
            <span class="filter-chip">
                <span>${escapeHtml(c.label)}</span>
                <span class="filter-chip-remove" data-type="${c.type}">&times;</span>
            </span>
        `).join("");
    }
}

function renderAll() {
    renderStats(inventory);
    renderTable(getVisibleRows());
}

// =====================================================================
// 6. TRANSITIONS.DEV ORCHESTRATION (MODAL, SLIDING TABS & TOAST)
// =====================================================================

// Sliding Tabs Pill Animation (transitions.dev 16-tabs-sliding)
function updateTabsPill(activeTab, animate = true) {
    const pill = document.getElementById("tabs-pill");
    if (!pill || !activeTab) return;

    if (!animate) {
        pill.style.transition = "none";
    }

    pill.style.transform = `translateX(${activeTab.offsetLeft}px)`;
    pill.style.width = `${activeTab.offsetWidth}px`;

    if (!animate) {
        // Trigger reflow lalu kembalikan transisi
        pill.offsetHeight;
        pill.style.transition = "";
    }
}

// Modal Animation (transitions.dev 06-modal Open / Close)
const closeMs = 150;

function openModal(backdropId) {
    const backdrop = document.getElementById(backdropId);
    if (!backdrop) return;

    const modal = backdrop.querySelector(".t-modal");
    backdrop.hidden = false;
    backdrop.classList.remove("is-closing");
    backdrop.classList.add("is-open");

    if (modal) {
        modal.classList.remove("is-closing");
        modal.classList.add("is-open");
    }
}

function closeModal(backdropId) {
    const backdrop = document.getElementById(backdropId);
    if (!backdrop) return;

    const modal = backdrop.querySelector(".t-modal");
    backdrop.classList.remove("is-open");
    backdrop.classList.add("is-closing");

    if (modal) {
        modal.classList.remove("is-open");
        modal.classList.add("is-closing");
    }

    setTimeout(() => {
        backdrop.hidden = true;
        backdrop.classList.remove("is-closing");
        if (modal) modal.classList.remove("is-closing");
    }, closeMs);
}

// Modal Tambah Barang
function openAddModal() {
    const form = document.getElementById("form-add");
    if (form) form.reset();
    setFormError("");
    openModal("modal-add");
    setTimeout(() => {
        const inputName = document.getElementById("input-name");
        if (inputName) inputName.focus();
    }, 50);
}

function closeAddModal() {
    closeModal("modal-add");
}

function setFormError(message) {
    const el = document.getElementById("form-error");
    const msg = document.getElementById("form-error-msg");
    if (!el || !msg) return;

    if (message) {
        msg.textContent = message;
        el.hidden = false;
    } else {
        el.hidden = true;
        msg.textContent = "";
    }
}

// Modal Konfirmasi Hapus
function openDeleteModal(index) {
    pendingDeleteIndex = index;
    const item = inventory[index];
    if (!item) return;

    const descEl = document.getElementById("modal-del-desc");
    if (descEl) {
        descEl.innerHTML = `Hapus <strong>"${escapeHtml(item.name)}"</strong> sejumlah <strong>${escapeHtml(item.quantity)} unit</strong> dari inventaris laboratorium?`;
    }

    openModal("modal-delete");
}

function closeDeleteModal() {
    closeModal("modal-delete");
    pendingDeleteIndex = null;
}

// Toast Notifications (transitions.dev 22-toast)
function showToast(message, type = "success") {
    const toast = document.getElementById("app-toast");
    const msg = document.getElementById("toast-message");
    const icon = document.getElementById("toast-icon");
    if (!toast || !msg) return;

    clearTimeout(toastTimeout);

    msg.textContent = message;
    toast.className = `t-toast toast-${type} is-open`;

    if (icon) {
        if (type === "success") {
            icon.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>';
        } else if (type === "error") {
            icon.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>';
        } else {
            icon.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';
        }
    }

    toastTimeout = setTimeout(() => {
        toast.classList.remove("is-open");
    }, 3200);
}

// =====================================================================
// 7. EVENT HANDLERS
// =====================================================================

async function handleAddSubmit(event) {
    event.preventDefault();

    const quantityRaw = document.getElementById("input-quantity").value.trim();
    const selectedConditionRadio = document.querySelector('input[name="modal-cond-radio"]:checked');
    const conditionValue = selectedConditionRadio ? selectedConditionRadio.value : "Baik";

    const item = {
        name: document.getElementById("input-name").value.trim(),
        category: document.getElementById("input-category").value.trim(),
        quantity: quantityRaw === "" ? NaN : Number(quantityRaw),
        condition: conditionValue,
        description: document.getElementById("input-description").value.trim()
    };

    const message = validateItem(item);
    if (message) {
        setFormError(message);
        return;
    }

    const submitButton = document.getElementById("btn-submit");
    if (submitButton) submitButton.disabled = true;

    try {
        await addInventory(item);
        closeAddModal();
        await loadInventory();
        showToast(`"${item.name}" berhasil ditambahkan ke inventaris.`, "success");
    } catch (error) {
        setFormError(error.message);
    } finally {
        if (submitButton) submitButton.disabled = false;
    }
}

async function handleConfirmDelete() {
    if (pendingDeleteIndex === null || isDeleting) return;

    isDeleting = true;
    const item = inventory[pendingDeleteIndex];
    const itemName = item ? item.name : "Barang";

    try {
        await deleteInventory(pendingDeleteIndex);
        closeDeleteModal();
        await loadInventory();
        showToast(`"${itemName}" berhasil dihapus dari inventaris.`, "success");
    } catch (error) {
        showToast("Gagal menghapus: " + error.message, "error");
    } finally {
        isDeleting = false;
        pendingDeleteIndex = null;
    }
}

function handleTableClick(event) {
    const button = event.target.closest(".btn-delete");
    if (!button || isDeleting) return;

    const row = button.closest("tr");
    if (!row) return;

    const index = Number(row.dataset.index);
    openDeleteModal(index);
}

// Ekspor ke CSV Native
function exportToCSV() {
    if (inventory.length === 0) {
        showToast("Tidak ada data inventaris untuk diekspor.", "error");
        return;
    }

    const headers = ["No", "Nama Perangkat", "Kategori", "Jumlah", "Kondisi", "Deskripsi"];
    const rows = inventory.map((item, idx) => [
        idx + 1,
        `"${String(item.name).replace(/"/g, '""')}"`,
        `"${String(item.category).replace(/"/g, '""')}"`,
        item.quantity,
        `"${String(item.condition).replace(/"/g, '""')}"`,
        `"${String(item.description || "").replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\r\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Inventaris_Lab_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showToast("Data inventaris berhasil diekspor ke CSV.", "success");
}

// Tema Gelap / Terang Toggle (Default awal: Light Mode)
function initTheme() {
    const saved = localStorage.getItem(THEME_KEY);
    // Standar awal adalah mode terang (white/light mode), baru nanti pengguna bisa ganti ke dark mode
    const activeTheme = saved || "light";

    document.documentElement.setAttribute("data-theme", activeTheme);

    const toggleBtn = document.getElementById("theme-toggle");
    if (toggleBtn) {
        toggleBtn.addEventListener("click", () => {
            const current = document.documentElement.getAttribute("data-theme");
            const next = current === "dark" ? "light" : "dark";
            document.documentElement.setAttribute("data-theme", next);
            localStorage.setItem(THEME_KEY, next);
        });
    }
}

// Setup Event Listeners
function setupEvents() {
    // Tombol Header & Modal
    const btnAdd = document.getElementById("btn-add");
    if (btnAdd) btnAdd.addEventListener("click", openAddModal);

    const btnCancel = document.getElementById("btn-cancel");
    if (btnCancel) btnCancel.addEventListener("click", closeAddModal);

    const btnModalClose = document.getElementById("btn-modal-close-icon");
    if (btnModalClose) btnModalClose.addEventListener("click", closeAddModal);

    const formAdd = document.getElementById("form-add");
    if (formAdd) formAdd.addEventListener("submit", handleAddSubmit);

    // Delete Modal
    const btnDelConfirm = document.getElementById("btn-del-confirm");
    if (btnDelConfirm) btnDelConfirm.addEventListener("click", handleConfirmDelete);

    const btnDelCancel = document.getElementById("btn-del-cancel");
    if (btnDelCancel) btnDelCancel.addEventListener("click", closeDeleteModal);

    // Table click delegation
    const tbody = document.getElementById("inventory-body");
    if (tbody) tbody.addEventListener("click", handleTableClick);

    // Search Input & Clear
    const searchInput = document.getElementById("search-input");
    const btnClearSearch = document.getElementById("btn-clear-search");

    if (searchInput) {
        searchInput.addEventListener("input", (e) => {
            searchKeyword = e.target.value;
            if (btnClearSearch) btnClearSearch.hidden = searchKeyword.length === 0;
            renderAll();
        });
    }

    if (btnClearSearch) {
        btnClearSearch.addEventListener("click", () => {
            if (searchInput) {
                searchInput.value = "";
                searchKeyword = "";
                btnClearSearch.hidden = true;
                searchInput.focus();
                renderAll();
            }
        });
    }

    // Category Select
    const filterCatSelect = document.getElementById("filter-category");
    if (filterCatSelect) {
        filterCatSelect.addEventListener("change", (e) => {
            filterCategory = e.target.value;
            renderAll();
        });
    }

    // Sorting Select
    const sortSelect = document.getElementById("sort-order");
    if (sortSelect) {
        sortSelect.addEventListener("change", (e) => {
            sortOrder = e.target.value;
            renderAll();
        });
    }

    // Sliding Tabs (transitions.dev)
    const tabsContainer = document.getElementById("filter-tabs");
    if (tabsContainer) {
        const tabs = tabsContainer.querySelectorAll(".t-tab");
        tabs.forEach(tab => {
            tab.addEventListener("click", () => {
                tabs.forEach(t => t.setAttribute("aria-selected", "false"));
                tab.setAttribute("aria-selected", "true");
                updateTabsPill(tab, true);

                filterCondition = tab.dataset.filter || "";

                // Sync legacy filter condition select if present
                const legSelect = document.getElementById("filter-condition");
                if (legSelect && (filterCondition === "" || filterCondition === "Baik" || filterCondition === "Rusak")) {
                    legSelect.value = filterCondition;
                }

                renderAll();
            });
        });

        // Initialize pill on the active tab
        const initialActive = tabsContainer.querySelector('.t-tab[aria-selected="true"]');
        if (initialActive) {
            setTimeout(() => updateTabsPill(initialActive, false), 50);
        }

        window.addEventListener("resize", () => {
            const currentActive = tabsContainer.querySelector('.t-tab[aria-selected="true"]');
            if (currentActive) updateTabsPill(currentActive, false);
        });
    }

    // Export CSV
    const btnExport = document.getElementById("btn-export");
    if (btnExport) btnExport.addEventListener("click", exportToCSV);

    // Empty state clear
    const btnEmptyClear = document.getElementById("btn-empty-clear");
    if (btnEmptyClear) {
        btnEmptyClear.addEventListener("click", () => {
            searchKeyword = "";
            filterCondition = "";
            filterCategory = "";
            if (searchInput) {
                searchInput.value = "";
                if (btnClearSearch) btnClearSearch.hidden = true;
            }
            if (filterCatSelect) filterCatSelect.value = "";

            const tabs = document.querySelectorAll(".t-tab");
            tabs.forEach((t, idx) => {
                t.setAttribute("aria-selected", idx === 0 ? "true" : "false");
            });
            const firstTab = document.querySelector(".t-tab");
            if (firstTab) updateTabsPill(firstTab, true);

            renderAll();
        });
    }

    // Reset Filter Button from Active Chips
    const btnResetFilters = document.getElementById("btn-reset-filters");
    if (btnResetFilters) {
        btnResetFilters.addEventListener("click", () => {
            if (btnEmptyClear) btnEmptyClear.click();
        });
    }

    // Delegated click on chip remove
    const chipsList = document.getElementById("chips-list");
    if (chipsList) {
        chipsList.addEventListener("click", (e) => {
            const removeBtn = e.target.closest(".filter-chip-remove");
            if (!removeBtn) return;
            const type = removeBtn.dataset.type;
            if (type === "search") {
                searchKeyword = "";
                if (searchInput) searchInput.value = "";
                if (btnClearSearch) btnClearSearch.hidden = true;
            } else if (type === "condition") {
                filterCondition = "";
                const firstTab = document.querySelector(".t-tab");
                if (firstTab) firstTab.click();
            } else if (type === "category") {
                filterCategory = "";
                if (filterCatSelect) filterCatSelect.value = "";
            }
            renderAll();
        });
    }

    // Klik di luar modal = tutup
    document.getElementById("modal-add")?.addEventListener("click", (event) => {
        if (event.target.id === "modal-add") closeAddModal();
    });
    document.getElementById("modal-delete")?.addEventListener("click", (event) => {
        if (event.target.id === "modal-delete") closeDeleteModal();
    });

    // Tombol Escape & Shortcut 'N'
    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape") {
            closeAddModal();
            closeDeleteModal();
        } else if (event.key.toLowerCase() === "n" && !event.ctrlKey && !event.metaKey) {
            // Shortcut N hanya jika tidak sedang mengetik di input / textarea
            const tag = document.activeElement ? document.activeElement.tagName.toLowerCase() : "";
            if (tag !== "input" && tag !== "textarea") {
                event.preventDefault();
                openAddModal();
            }
        }
    });
}

// =====================================================================
// 8. ALUR UTAMA & INISIALISASI
// =====================================================================
async function loadInventory() {
    try {
        inventory = await getInventory();
        renderAll();
    } catch (error) {
        console.error(error);
        const emptyState = document.getElementById("empty-state");
        if (emptyState) {
            emptyState.textContent = "Gagal memuat data: " + error.message;
            emptyState.hidden = false;
        }
    }
}

document.addEventListener("DOMContentLoaded", () => {
    initTheme();
    setupEvents();

    const searchInput = document.getElementById("search-input");
    if (searchInput) searchKeyword = searchInput.value;

    const filterCatSelect = document.getElementById("filter-category");
    if (filterCatSelect) filterCategory = filterCatSelect.value;

    loadInventory();
});
