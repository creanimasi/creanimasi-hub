// Tampilan status target poin produksi. Status SELALU ditandai teks (bukan hanya warna).
export const STATUS_TARGET = {
  tercapai:     { teks: 'Tercapai',         warna: 'var(--rpg-success)' },
  sesuai:       { teks: 'Sesuai jalur',     warna: 'var(--rpg-gold)' },
  tertinggal:   { teks: 'Tertinggal',       warna: 'var(--rpg-warn)' },
  belum:        { teks: 'Belum tercapai',   warna: 'var(--rpg-warn)' },
  tanpa_target: { teks: 'Tanpa target',     warna: 'var(--rpg-ink-faint)' },
  dikecualikan: { teks: 'Dikecualikan',     warna: 'var(--rpg-ink-faint)' },
};

// Status yang ditampilkan: selama periode berjalan, "belum" dipecah menjadi sesuai jalur / tertinggal.
export function kunciStatus(row, fase) {
  if (row.status === 'belum' && fase === 'berjalan') return row.jalur === 'sesuai' ? 'sesuai' : 'tertinggal';
  return row.status;
}

export const angka = (n) => Number(n || 0).toLocaleString('id-ID');
export const LABEL_LEVEL = { magang: 'Magang / Probation', junior: 'Junior', senior: 'Senior' };
export const labelLevel = (k) => LABEL_LEVEL[k] || null;
export const FASE_TEKS = { berjalan: 'Berjalan', menunggu_kunci: 'Menunggu penguncian', final: 'Final' };

// 'YYYY-MM-DD' → '3 Okt 2026'
export const tanggalPendek = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
