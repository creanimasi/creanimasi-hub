// Format waktu relatif untuk halaman RPG admin (zona waktu lokal browser).

// "Hari ini" / "Kemarin" / "N hari lalu" / "N minggu lalu" dari selisih hari kalender
export function lalu(iso, kosong = 'Belum ada') {
  if (!iso) return kosong;
  const d = new Date(iso), n = new Date();
  const sel = Math.round((new Date(n.getFullYear(), n.getMonth(), n.getDate()) - new Date(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000);
  if (sel <= 0) return 'Hari ini';
  if (sel === 1) return 'Kemarin';
  if (sel < 14) return `${sel} hari lalu`;
  return `${Math.floor(sel / 7)} minggu lalu`;
}

export const tglPendek = (iso) => new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
