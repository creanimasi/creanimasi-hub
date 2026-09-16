// Data dummy untuk Quest Board — BELUM disambung ke API
// (nanti dari GET /api/rpg/quests?timId=&status= sesuai breakdown teknis).

export const dummySummary = {
  activeCount: 6,
  xpPending: 365,
  completedThisWeek: 4,
};

export const dummyQuestGroups = [
  {
    id: 'harian',
    label: 'HARIAN',
    tag: '— berulang tiap hari',
    quests: [
      { id: 'qd1', type: 'sync', title: 'Lapor Progres Harian (WhatsApp)', xpReward: 15, dueLabel: 'Quest harian · Streak 12 hari' },
      { id: 'qd2', type: 'board', title: 'Update Papan Trello Harian', xpReward: 10, dueLabel: 'Quest harian · Streak 5 hari' },
    ],
  },
  {
    id: 'proyek',
    label: 'PROYEK',
    tag: '— tugas klien & produksi',
    quests: [
      { id: 'qp1', type: 'shield', title: 'Rigging VTuber — Klien Fiverr #482', xpReward: 120, dueLabel: 'Tenggat besok', warn: true, progressPct: 80 },
      { id: 'qp2', type: 'shield', title: 'Revisi Model VRM — Order Etsy #113', xpReward: 90, dueLabel: '3 hari lagi', progressPct: 40 },
      { id: 'qp3', type: 'badge', title: 'Submit Konsep Ilustrasi — Jellia Studio', xpReward: 80, dueLabel: '5 hari lagi', progressPct: 20 },
    ],
  },
  {
    id: 'sekali',
    label: 'SEKALI',
    tag: '— tantangan satu kali',
    quests: [
      { id: 'qs1', type: 'target', title: 'Ikuti Sesi Onboarding Modul Baru', xpReward: 50, dueLabel: 'Tenggat minggu ini' },
    ],
  },
];

export const dummyCompletedQuests = [
  { id: 'qc1', title: 'Revisi Batch 1 — Klien VGen #77', when: 'Selesai 2 hari lalu', xpReward: 100 },
  { id: 'qc2', title: 'Laporan Mingguan Unit', when: 'Selesai kemarin', xpReward: 30 },
];

export const QUEST_TABS = ['Semua', 'Harian', 'Proyek', 'Sekali', 'Selesai'];
