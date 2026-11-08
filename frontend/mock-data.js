// Data contoh sementara. Bentuknya HARUS sama dengan kontrak API:
// name, category, quantity (angka >= 0), condition ("Baik" / "Rusak"), description (opsional)
const MOCK_INVENTORY = [
    {
        name: "Mikrotik RB750Gr3",
        category: "Router",
        quantity: 5,
        condition: "Baik",
        description: "Router untuk praktikum jaringan"
    },
    {
        name: "TP-Link Router",
        category: "Router",
        quantity: 3,
        condition: "Baik",
        description: ""
    },
    {
        name: "Kabel LAN Cat6",
        category: "Kabel",
        quantity: 20,
        condition: "Baik",
        description: "Kabel UTP 3 meter"
    },
    {
        name: "Modem Huawei HG8245",
        category: "Modem",
        quantity: 4,
        condition: "Baik",
        description: "Modem fiber untuk praktikum akses"
    },
    {
        name: "Switch Cisco 2960",
        category: "Switch",
        quantity: 2,
        condition: "Rusak",
        description: "Port 5 sampai 8 tidak berfungsi"
    },
    {
        name: "Konektor RJ45",
        category: "Aksesori",
        quantity: 50,
        condition: "Baik",
        description: ""
    },
    {
        name: "Crimping Tool",
        category: "Alat",
        quantity: 3,
        condition: "Baik",
        description: "Untuk memasang konektor RJ45"
    },
    {
        name: "LAN Tester",
        category: "Alat",
        quantity: 2,
        condition: "Rusak",
        description: "Lampu indikator mati"
    }
];