// Satu baris stat PILAR (Produktivitas/Kolaborasi/Inisiatif/Konsistensi) —
// icon kotak berwarna + label + value + progress track.
export default function StatMeter({ label, value, colorVar, icon }) {
  const color = `var(${colorVar})`;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '.4rem' }}>
        <span style={{
          display: 'flex', alignItems: 'center', gap: '.5rem',
          fontFamily: 'var(--rpg-font-hud)', fontSize: '1.05rem', color: 'var(--rpg-ink)',
        }}>
          <span style={{
            width: 20, height: 20, flex: 'none', background: color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {icon}
          </span>
          {label}
        </span>
        <span style={{ fontFamily: 'var(--rpg-font-hud)', color: 'var(--rpg-gold)', fontSize: '1.15rem' }}>
          {value}
        </span>
      </div>
      <div style={{ height: 10, background: 'var(--rpg-bg-3)', border: '2px solid var(--rpg-line-dim)' }}>
        <div
          className="rpg-bar-fill"
          style={{
            height: '100%',
            width: `${value}%`,
            backgroundColor: color,
            backgroundImage: 'repeating-linear-gradient(90deg, rgba(0,0,0,.2) 0 2px, transparent 2px 6px), linear-gradient(180deg, rgba(255,255,255,.13), transparent)',
          }}
        />
      </div>
    </div>
  );
}
