// XP bar — track + fill bergaris (pixel style), progres dihitung dari current/target.
export default function XpBar({ current, target, label }) {
  const pct = target > 0 ? Math.min(100, Math.round((current / target) * 100)) : 0;

  return (
    <div style={{ marginTop: '1.4rem' }}>
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        fontFamily: 'var(--rpg-font-hud)', fontSize: '1.05rem',
        color: 'var(--rpg-ink-dim)', marginBottom: '.4rem',
      }}>
        <span>{current.toLocaleString('id-ID')} XP</span>
        <span>{label || `Naik level di ${target.toLocaleString('id-ID')} XP`}</span>
      </div>
      <div style={{ height: 16, background: 'var(--rpg-bg-3)', border: '2px solid var(--rpg-line-dim)' }}>
        <div
          className="rpg-bar-fill"
          style={{
            height: '100%',
            width: `${pct}%`,
            background: `repeating-linear-gradient(90deg, rgba(0,0,0,.18) 0 3px, transparent 3px 9px),
                         linear-gradient(180deg, var(--rpg-gold), var(--rpg-gold-dim))`,
          }}
        />
      </div>
    </div>
  );
}
