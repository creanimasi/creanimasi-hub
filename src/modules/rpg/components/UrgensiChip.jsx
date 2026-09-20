import { infoUrgensi, warnaUrgensi } from '../utils/urgensi';

// Lencana urgensi: batang sinyal (7 batang, terisi sebanyak level) + angka + (opsional) nama.
// Warna hanyalah isyarat ketiga — angka dan jumlah batang tetap terbaca tanpa membedakan warna.
export default function UrgensiChip({ nilai, tampilNama = false }) {
  const info = infoUrgensi(nilai);
  if (!info) return null;
  const warna = warnaUrgensi(info.n);
  return (
    <span role="img" aria-label={`Urgensi ${info.n} dari 7: ${info.nama}`} title={`Urgensi ${info.n} dari 7 — ${info.nama}`} style={{
      display: 'inline-flex', alignItems: 'center', gap: '.3rem', border: `2px solid ${warna}`, padding: '0 .3rem',
      color: warna, fontFamily: 'var(--rpg-font-hud)', fontSize: '.9rem', lineHeight: 1.45, whiteSpace: 'nowrap',
    }}>
      <span aria-hidden="true" style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 1, height: 12 }}>
        {[1, 2, 3, 4, 5, 6, 7].map(i => (
          <span key={i} style={{ width: 2, height: 3 + i * 1.3, background: i <= info.n ? warna : 'var(--rpg-line-dim)' }} />
        ))}
      </span>
      <b aria-hidden="true" style={{ fontWeight: 400 }}>{info.n}</b>
      {tampilNama && <span aria-hidden="true">{info.nama}</span>}
    </span>
  );
}
