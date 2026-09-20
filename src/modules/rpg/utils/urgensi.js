// Urgensi quest 1–7 (7 = paling mendesak). Warna ada di token --rpg-urg-1..7 (rpg-tokens.css).
// Urgensi TIDAK memengaruhi XP; hanya pengurutan dan tampilan. Default quest baru = 4 (Normal).
export const URGENSI_DEFAULT = 4;

export const URGENSI = [
  { n: 1, nama: 'Santai',      ket: 'Bisa dikerjakan kapan saja' },
  { n: 2, nama: 'Rendah',      ket: 'Tidak ada yang menunggu hasilnya' },
  { n: 3, nama: 'Agak rendah', ket: 'Kerjakan bila ada waktu luang' },
  { n: 4, nama: 'Normal',      ket: 'Quest biasa' },
  { n: 5, nama: 'Tinggi',      ket: 'Didahulukan dari quest biasa' },
  { n: 6, nama: 'Mendesak',    ket: 'Menghalangi pekerjaan lain' },
  { n: 7, nama: 'Kritis',      ket: 'Selesaikan hari ini juga' },
];

export const infoUrgensi = (n) => URGENSI[(Number(n) || 0) - 1] || null;
export const warnaUrgensi = (n) => `var(--rpg-urg-${n})`;
