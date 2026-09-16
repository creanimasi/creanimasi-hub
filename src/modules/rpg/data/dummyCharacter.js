// Data dummy untuk preview Character Sheet — BELUM disambung ke API.
// Bentuknya sengaja meniru kira-kira respons GET /api/rpg/character/:timId
// (JOIN rpg_character + tim + title) sesuai breakdown teknis, supaya nanti
// swap ke data asli tinggal ganti sumbernya di useCharacter.js.

export const dummyCharacter = {
  nama: 'Kirana Ayu',
  initial: 'KA',
  divisi: 'Illustrator',
  entitas: 'Creillustra',
  roleLine: 'Ilustrator & Rigger VTuber · Unit Creillustra',
  level: 14,
  careerStage: 'Staf Senior',
  title: 'Rising Star',
  rarity: 4,
  rarityMax: 5,
  xpTotal: 6240,
  xpNextTier: 8000,
  levelUpNote: 'Naik dari Staf ke Staf Senior minggu lalu — +2 slot quest harian terbuka.',
};

// Mapping ke 4 kolom skor yang sudah ada di tabel `tim` (skill, komunikasi,
// kriteria, kepuasan) — lihat breakdown teknis bagian 11 soal skala aslinya.
export const dummyStats = [
  { key: 'produktivitas', label: 'Produktivitas', value: 82, colorVar: '--rpg-stat-produktivitas' },
  { key: 'kolaborasi',    label: 'Kolaborasi',    value: 74, colorVar: '--rpg-stat-kolaborasi' },
  { key: 'inisiatif',     label: 'Inisiatif',     value: 69, colorVar: '--rpg-stat-inisiatif' },
  { key: 'konsistensi',   label: 'Konsistensi',   value: 91, colorVar: '--rpg-stat-konsistensi' },
];

export const dummyAchievements = [
  { code: 'onboarding', label: 'Onboarding Tuntas', locked: false },
  { code: 'streak30',   label: '30 Hari Beruntun Lapor', locked: false },
  { code: 'promo',      label: 'Naik ke Staf Senior', locked: false },
  { code: 'questmaster',label: 'Quest Master', locked: true, progressLabel: '38/50' },
  { code: 'goldcollab', label: 'Kolaborator Emas', locked: true, progressLabel: 'Terkunci' },
];

export const dummyActiveQuests = [
  { id: 'q1', title: 'Rigging VTuber — Klien Fiverr #482', xpReward: 120, dueLabel: 'Tenggat besok', warn: true, progressPct: 80 },
  { id: 'q2', title: 'Revisi Model VRM — Order Etsy #113', xpReward: 90, dueLabel: '3 hari lagi', progressPct: 40 },
  { id: 'q3', title: 'Lapor Progres Harian (WhatsApp)', xpReward: 15, dueLabel: 'Quest harian · streak 12 hari' },
];

export const dummyLeaderboard = [
  { rank: 1, nama: 'Bagas P.', unit: 'Unit Creillustra', xp: 2340, isYou: false },
  { rank: 2, nama: 'Kirana Ayu', unit: 'Unit Creillustra', xp: 2110, isYou: true },
  { rank: 3, nama: 'Nadia R.', unit: 'Unit Jellia Studio', xp: 1980, isYou: false },
];
