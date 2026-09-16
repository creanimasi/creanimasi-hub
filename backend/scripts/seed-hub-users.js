// Script sekali-pakai untuk generate seed SQL akun login dev lokal
const bcrypt = require('bcryptjs');

const akun = [
  { username: 'kholed',  nama: 'Mas Kholed',                     role: 'admin',  password: 'admin123' },
  { username: 'ariel',   nama: 'Ariel Tegar',                    role: 'member', password: 'creanimasi123' },
  { username: 'ryan',    nama: 'Ryan Cavallera',                 role: 'member', password: 'creanimasi123' },
  { username: 'nanda',   nama: 'Nanda Cahya Bintang',            role: 'member', password: 'creanimasi123' },
  { username: 'dina',    nama: 'Dina Syavina',                   role: 'member', password: 'creanimasi123' },
  { username: 'tsania',  nama: 'Tsania Lathifa',                 role: 'member', password: 'creanimasi123' },
  { username: 'fathur',  nama: 'Ahmad Fathurrahman',             role: 'member', password: 'creanimasi123' },
  { username: 'raynar',  nama: 'Raynar Harits',                  role: 'member', password: 'creanimasi123' },
  { username: 'aditya',  nama: 'Aditya Tri Prakoso',             role: 'member', password: 'creanimasi123' },
  { username: 'noval',   nama: 'Noval Faqihudin Zaky',           role: 'member', password: 'creanimasi123' },
  { username: 'galang',  nama: 'Galang Ramadhan',                role: 'member', password: 'creanimasi123' },
  { username: 'ridho',   nama: 'Ridho Ramadhan',                 role: 'member', password: 'creanimasi123' },
  // Akun tambahan (baru ditemukan di production, sebelumnya belum di-seed lokal)
  { username: 'mietsaq', nama: 'Mietsaq Husain',                 role: 'admin',  password: 'admin123' },
  { username: 'andin',   nama: 'Andini Dyah Paramastri',         role: 'member', password: 'creanimasi123' },
  { username: 'elen',    nama: 'Elenesya Sasmariza',             role: 'member', password: 'creanimasi123' },
  { username: 'risma',   nama: 'Risma Wulandari',                role: 'member', password: 'creanimasi123' },
  { username: 'artha',   nama: 'Maheswara Artha Kumara Gautama', role: 'member', password: 'creanimasi123' },
  { username: 'riski',   nama: 'Rizky Himawan Aria Wicaksa',     role: 'member', password: 'creanimasi123' },
  { username: 'davian',  nama: 'davian',                         role: 'member', password: 'creanimasi123' },
  { username: 'nindi',   nama: 'nindi',                          role: 'member', password: 'creanimasi123' },
  { username: 'vito',    nama: 'Vitto Ramadani',                 role: 'member', password: 'creanimasi123' },
  { username: 'nadine',  nama: 'Azzahra Nadienta',               role: 'member', password: 'creanimasi123' },
  { username: 'sigit',   nama: 'Sigit Setyawan',                 role: 'member', password: 'creanimasi123' },
  { username: 'aryo',    nama: 'Aryo Cahyono',                   role: 'member', password: 'creanimasi123' },
];

(async () => {
  const rows = [];
  for (const a of akun) {
    const hash = await bcrypt.hash(a.password, 10);
    const esc = s => s.replace(/'/g, "''");
    rows.push(`('${esc(a.nama)}', '${esc(a.username)}', '${hash}', '${a.role}', TRUE)`);
  }
  console.log(
    `INSERT INTO hub_users (nama, username, password, role, aktif) VALUES\n  ${rows.join(',\n  ')}\nON CONFLICT (username) DO NOTHING;`
  );
})();
