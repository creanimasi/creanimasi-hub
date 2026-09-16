// Data dummy untuk Guild Hall & Achievements — BELUM disambung ke API
// (nanti dari GET /api/rpg/leaderboard?period=weekly&divisi= dan
// GET /api/rpg/achievements/:timId sesuai breakdown teknis).

export const DIVISI_TABS = ['Semua', 'Admin', 'PM', 'Illustrator', 'Rigger', '3D Modeler', 'Desainer'];

export const dummyLeaderboardFull = [
  { rank: 1, nama: 'Bagas P.',    divisi: 'Illustrator', unit: 'Unit Creillustra',    xp: 2340, isYou: false },
  { rank: 2, nama: 'Kirana Ayu',  divisi: 'Illustrator', unit: 'Unit Creillustra',    xp: 2110, isYou: true },
  { rank: 3, nama: 'Nadia R.',    divisi: 'PM',          unit: 'Unit Jellia Studio',  xp: 1980, isYou: false },
  { rank: 4, nama: 'Fajar S.',    divisi: 'Rigger',       unit: 'Unit Creanimasi Studio', xp: 1820, isYou: false },
  { rank: 5, nama: 'Wulan T.',    divisi: 'Admin',        unit: 'Unit Creanimasi Studio', xp: 1705, isYou: false },
  { rank: 6, nama: 'Doni K.',     divisi: '3D Modeler',   unit: 'Unit Shuyou',         xp: 1590, isYou: false },
  { rank: 7, nama: 'Sasa M.',     divisi: 'Admin',        unit: 'Unit Flip Studio',    xp: 1420, isYou: false },
  { rank: 8, nama: 'Reza P.',     divisi: 'Desainer',     unit: 'Unit Creanimasi Studio', xp: 1300, isYou: false },
];

export const dummyAchievementsFull = [
  { code: 'onboarding',  label: 'Onboarding Tuntas',        locked: false },
  { code: 'streak30',    label: '30 Hari Beruntun Lapor',   locked: false },
  { code: 'promo',       label: 'Naik ke Staf Senior',      locked: false },
  { code: 'firstquest',  label: 'Quest Pertama',            locked: false },
  { code: 'questmaster', label: 'Quest Master',             locked: true, progressLabel: '38/50' },
  { code: 'goldcollab',  label: 'Kolaborator Emas',         locked: true, progressLabel: 'Terkunci' },
  { code: 'topguild',    label: 'Juara Guild Mingguan',     locked: true, progressLabel: 'Terkunci' },
  { code: 'maxlevel',    label: 'Level Maksimal',           locked: true, progressLabel: 'Terkunci' },
];
