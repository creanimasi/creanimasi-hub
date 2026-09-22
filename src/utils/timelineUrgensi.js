// Urgensi Papan Timeline: 1 = paling mendesak (merah) … 4 = paling santai (hijau tua).
// SENGAJA terpisah dari skala urgensi 1-7 modul RPG (yang arahnya kebalikan: 7 = paling mendesak) —
// jangan disatukan, supaya tak membingungkan siapa pun yang membuka kedua halaman.
export const TIMELINE_URGENSI = [
  { n: 1, label: 'Mendesak', warna: 'var(--tl-urg-1)' },
  { n: 2, label: 'Tinggi',   warna: 'var(--tl-urg-2)' },
  { n: 3, label: 'Normal',   warna: 'var(--tl-urg-3)' },
  { n: 4, label: 'Santai',   warna: 'var(--tl-urg-4)' },
];
export const infoUrgensiTimeline = (n) => TIMELINE_URGENSI.find(u => u.n === Number(n)) || null;

// Palet otomatis untuk pita warna per orang — pasangan bg/text token yang SUDAH terverifikasi
// kontras ≥4,5:1 di 3 tema (dipakai juga di data/tim.js). Dipilih dari indeks orang (bukan acak)
// supaya urutannya stabil setiap kali papan dimuat ulang.
const PALET_OTOMATIS = [
  { bg: 'var(--green-light)',  text: 'var(--green)' },
  { bg: 'var(--blue-light)',   text: 'var(--blue)' },
  { bg: 'var(--purple-light)', text: 'var(--purple)' },
  { bg: 'var(--amber-light)',  text: 'var(--amber)' },
  { bg: 'var(--coral-light)',  text: 'var(--coral)' },
  { bg: 'var(--red-light)',    text: 'var(--red)' },
];
export const paletOtomatis = (indeks) => PALET_OTOMATIS[indeks % PALET_OTOMATIS.length];

// Untuk warna kustom (hex bebas dari admin): pilih teks hitam/putih dari kecerahan warnanya sendiri,
// supaya tetap terbaca di atas warna apa pun tanpa perlu tabel kontras manual per warna.
export function teksKontrasHex(hex) {
  if (!/^#[0-9a-fA-F]{6}$/.test(hex || '')) return '#000';
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  const kecerahan = (r * 299 + g * 587 + b * 114) / 1000;
  return kecerahan > 150 ? '#0a0a0a' : '#fff';
}
