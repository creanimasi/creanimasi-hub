// Data dummy untuk Admin Analytics — BELUM disambung ke API
// (nanti dari GET /api/admin/rpg/analytics sesuai breakdown teknis).

export const dummyLevelDistribution = [
  { bucket: 'Lv 1–5',   jumlah: 4 },
  { bucket: 'Lv 6–10',  jumlah: 6 },
  { bucket: 'Lv 11–15', jumlah: 5 },
  { bucket: 'Lv 16–20', jumlah: 2 },
];

export const dummyXpTrend = [
  { minggu: 'M1', xp: 1240 }, { minggu: 'M2', xp: 1580 }, { minggu: 'M3', xp: 1390 },
  { minggu: 'M4', xp: 1820 }, { minggu: 'M5', xp: 2010 }, { minggu: 'M6', xp: 1750 },
  { minggu: 'M7', xp: 2240 }, { minggu: 'M8', xp: 2110 },
];

export const dummyCompletionByType = [
  { tipe: 'Harian', completionPct: 88 },
  { tipe: 'Proyek', completionPct: 64 },
  { tipe: 'Sekali', completionPct: 72 },
];

// Catatan (breakdown teknis bagian 10 — risiko): distribusi tipe evaluatif
// seperti ini HANYA boleh muncul di endpoint admin analytics, tidak boleh
// ikut kebawa ke endpoint yang diakses anggota sendiri (mis. GET /rpg/character).
export const dummyTipeDistribution = [
  { tipe: 'Rising Star',    jumlah: 7, colorVar: '--rpg-stat-konsistensi' },
  { tipe: 'High Potential', jumlah: 6, colorVar: '--rpg-stat-kolaborasi' },
  { tipe: 'Silent Expert',  jumlah: 3, colorVar: '--rpg-stat-inisiatif' },
  { tipe: 'At Risk',        jumlah: 1, colorVar: '--rpg-stat-produktivitas' },
];

export const dummyOverallStats = {
  totalXpSeason: 15140,
  avgLevel: 9.6,
  completionRateOverall: 74,
};
