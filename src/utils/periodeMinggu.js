// Periode 4 minggu Laporan Ads: [{ dari:'YYYY-MM-DD', sampai:'YYYY-MM-DD' } × 4].
// Aturan HARUS sama dengan backend (cekRentang di hub.js) — server tetap yang memutuskan; ini untuk umpan balik cepat di form.
import { labelRentang } from '../components/laporanAds/SlideDeck';

const iso = (d) => d.toISOString().slice(0, 10);
export const tambahHari = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d); };
export const selisihHari = (a, b) => Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
export const akhirBulan = (bulan) => { const [y, m] = bulan.split('-').map(Number); return iso(new Date(Date.UTC(y, m, 0))); };
export const tglValid = (s) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && iso(d) === s;
};
export function hariIni() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// Bawaan lama: 1–7, 8–14, 15–21, 22–akhir bulan
export function rentangBawaan(bulan) {
  return [
    { dari: `${bulan}-01`, sampai: `${bulan}-07` },
    { dari: `${bulan}-08`, sampai: `${bulan}-14` },
    { dari: `${bulan}-15`, sampai: `${bulan}-21` },
    { dari: `${bulan}-22`, sampai: akhirBulan(bulan) },
  ];
}

// Isi otomatis dari tanggal mulai Minggu 1: 7 hari per minggu. w4AkhirBulan → Minggu 4 diperpanjang sampai akhir bulan kalender
// (dengan mulai tgl 1 hasilnya sama persis dengan bawaan).
export function bangunDariMulai(mulai, bulan, w4AkhirBulan = true) {
  const r = [0, 1, 2, 3].map(i => ({ dari: tambahHari(mulai, 7 * i), sampai: tambahHari(mulai, 7 * i + 6) }));
  if (w4AkhirBulan) { const akhir = akhirBulan(bulan); if (akhir > r[3].sampai) r[3].sampai = akhir; }
  return r;
}

export const rentangSama = (a, b) => Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((x, i) => x.dari === b[i].dari && x.sampai === b[i].sampai);

// → { galat: [string|null × 4], ada: boolean }
export function validasiRentang(rentang, bulan) {
  const galat = [null, null, null, null];
  for (let i = 0; i < 4; i++) {
    const r = rentang?.[i];
    if (!r || !tglValid(r.dari) || !tglValid(r.sampai)) { galat[i] = 'Isi tanggal dengan lengkap'; continue; }
    if (r.dari > r.sampai) galat[i] = '"Dari" harus sebelum atau sama dengan "Sampai"';
    else if (selisihHari(r.dari, r.sampai) > 30) galat[i] = 'Maksimal 31 hari';
    else if (i > 0 && rentang[i - 1] && tglValid(rentang[i - 1].sampai) && r.dari <= rentang[i - 1].sampai) galat[i] = `Harus dimulai setelah Minggu ${i} berakhir (tumpang tindih)`;
  }
  const r0 = rentang?.[0];
  if (!galat[0] && r0 && (r0.dari < tambahHari(`${bulan}-01`, -7) || r0.dari > akhirBulan(bulan))) galat[0] = 'Terlalu jauh dari bulan laporan — cek bulan/tahunnya';
  return { galat, ada: galat.some(Boolean) };
}

// Tanggal di antara dua minggu yang tidak masuk minggu mana pun (informasi, bukan galat)
export function celahRentang(rentang) {
  const info = [];
  for (let i = 0; i < 3; i++) {
    const a = rentang?.[i], b = rentang?.[i + 1];
    if (!a || !b || !tglValid(a.sampai) || !tglValid(b.dari)) continue;
    if (selisihHari(a.sampai, b.dari) > 1) info.push(`${labelRentang(tambahHari(a.sampai, 1), tambahHari(b.dari, -1))} (antara Minggu ${i + 1} dan ${i + 2}) tidak masuk minggu mana pun`);
  }
  return info;
}
