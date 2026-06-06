// Mapping nama divisi TIM → ID profiling dan modul
// Satu sumber kebenaran — dipakai di Pages.jsx, Profil.jsx, FormProfiling.jsx
export const DIVISI_TO_PROFILING_ID = {
  'Admin':       'admin',
  'PM':          'pm',
  'Illustrator': 'illustrator',
  'Rigger':      'rigger',
  '3D Modeler':  '3d',
};

export const DIVISI_TO_MODUL_ID = {
  'Admin':       'admin',
  'PM':          'pm',
  'Illustrator': 'illus',
  'Rigger':      'rigger',
  '3D Modeler':  '3d',
};

export const BOT_USERNAME = 'Flipspacehub_bot';

// Konfigurasi umum studio
export const STUDIO_CONFIG = {
  targetRevenueBulanan: 5000,    // total semua admin, dalam USD
  targetRevenuePerAdmin: 2000,   // per admin/bulan
  seedFund: 'Rp 500rb',
  namaStudio: 'Flipspace',
  emailOwner: 'creanimasi@gmail.com',
  profilingKadaluarsaHari: 90,   // hari sebelum profiling dianggap perlu update
};

// Reward personal per anggota — bisa diupdate tanpa edit komponen
export const REWARD_PERSONAL = [
  { username: 'ariel',  nama: 'Ariel',  reward: 'Dilibatkan diskusi strategis studio' },
  { username: 'ryan',   nama: 'Ryan',   reward: 'Budget kursus multi-platform' },
  { username: 'nanda',  nama: 'Nanda',  reward: 'Jadi organizer gathering — tanggung jawab nyata' },
  { username: 'dina',   nama: 'Dina',   reward: 'Akses ekosistem JRUHUB + mentoring bisnis' },
  { username: 'tsania', nama: 'Tsania', reward: 'Percepat akses modul lanjutan' },
  { username: 'fathur', nama: 'Fathur', reward: 'Waktu R&D + budget eksplorasi tools 3D' },
  { username: 'raynar', nama: 'Raynar', reward: 'Budget kursus front-end / AR filter' },
  { username: 'aditya', nama: 'Adit',   reward: 'Akses program passive income creator' },
  { username: 'noval',  nama: 'Noval',  reward: 'Host gathering + budget entertain tim' },
  { username: 'galang', nama: 'Galang', reward: 'Waktu eksplorasi Chinese style' },
  { username: 'ridho',  nama: 'Ridho',  reward: 'Brief terstruktur + tabungan upgrade perangkat' },
];
