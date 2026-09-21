import { angka } from '../utils/target';

// Batang kemajuan poin terhadap target. `jalurPct` (0–100) = posisi "seharusnya hari ini" (garis penanda), opsional.
export default function TargetBar({ poin, target, status, jalurPct = null, tinggi = 12, label }) {
  const pct = target > 0 ? Math.max(0, Math.min(100, (100 * poin) / target)) : 0;
  const warna = status === 'tercapai' ? 'var(--rpg-success)' : (status === 'tertinggal' || status === 'belum') ? 'var(--rpg-warn)' : 'var(--rpg-gold)';
  return (
    <div role="progressbar" aria-label={label || 'Poin terhadap target'} aria-valuemin={0} aria-valuemax={target} aria-valuenow={Math.min(poin, target)}
      aria-valuetext={`${angka(poin)} dari ${angka(target)} poin`}
      style={{ position: 'relative', height: tinggi, background: 'var(--rpg-bg)', border: '2px solid var(--rpg-line-dim)', boxSizing: 'content-box', overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${pct}%`, background: warna }} />
      {jalurPct != null && jalurPct > 0 && jalurPct < 100 && (
        <div aria-hidden="true" title="Posisi ideal hari ini" style={{ position: 'absolute', top: 0, bottom: 0, left: `${jalurPct}%`, width: 2, background: 'var(--rpg-ink)' }} />
      )}
    </div>
  );
}
