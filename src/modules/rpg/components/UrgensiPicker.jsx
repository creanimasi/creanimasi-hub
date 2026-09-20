import { URGENSI, infoUrgensi, warnaUrgensi } from '../utils/urgensi';

// Pemilih urgensi 1–7 (radiogroup): panah kiri/kanan berpindah, tombol berwarna sesuai level.
export default function UrgensiPicker({ nilai, onChange }) {
  const geser = (e, n) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
    e.preventDefault();
    const next = Math.min(7, Math.max(1, n + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : -1)));
    onChange(next);
    requestAnimationFrame(() => document.getElementById(`urg-opsi-${next}`)?.focus());
  };
  const info = infoUrgensi(nilai);
  return (
    <div>
      <div role="radiogroup" aria-label="Urgensi quest" style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
        {URGENSI.map(u => {
          const on = nilai === u.n; const warna = warnaUrgensi(u.n);
          return (
            <button key={u.n} id={`urg-opsi-${u.n}`} type="button" role="radio" aria-checked={on} aria-label={`Urgensi ${u.n} — ${u.nama}`} title={`${u.n} · ${u.nama} — ${u.ket}`}
              tabIndex={on ? 0 : -1} onClick={() => onChange(u.n)} onKeyDown={(e) => geser(e, u.n)} style={{
                fontFamily: 'var(--rpg-font-hud)', fontSize: '1.1rem', cursor: 'pointer', width: 38, height: 34, padding: 0,
                border: `2px solid ${warna}`, background: on ? warna : 'transparent', color: on ? '#0a0e27' : warna,
                boxShadow: on ? `0 0 0 2px var(--rpg-bg-2), 0 0 0 4px ${warna}` : 'none',
              }}>{u.n}</button>
          );
        })}
      </div>
      {info && (
        <div style={{ fontFamily: 'var(--rpg-font-hud)', fontSize: '1rem', marginTop: '.45rem', color: warnaUrgensi(info.n) }}>
          {info.n} · {info.nama} <span style={{ color: 'var(--rpg-ink-faint)' }}>— {info.ket}</span>
        </div>
      )}
    </div>
  );
}
