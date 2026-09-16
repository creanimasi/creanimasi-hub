// Satu badge pencapaian — locked/unlocked mengikuti gaya mockup.
export default function AchievementBadge({ label, locked, progressLabel }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '.5rem', textAlign: 'center' }}>
      <div style={{
        width: 52, height: 52, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'var(--rpg-bg-3)',
        border: `2px solid ${locked ? 'var(--rpg-line-dim)' : 'var(--rpg-gold)'}`,
        boxShadow: locked ? 'none' : '2px 2px 0 rgba(0,0,0,.4)',
      }}>
        <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter"
          stroke={locked ? 'var(--rpg-ink-faint)' : 'var(--rpg-gold)'} width={22} height={22}>
          {locked
            ? <><rect x="5" y="11" width="14" height="9" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></>
            : <path d="m9 12 2 2 4-4" />}
        </svg>
      </div>
      <span style={{ fontFamily: 'var(--rpg-font-hud)', fontSize: '.9rem', lineHeight: 1.25, color: locked ? 'var(--rpg-ink-faint)' : 'var(--rpg-ink-dim)' }}>
        {label}
      </span>
      {progressLabel && (
        <span style={{ fontFamily: 'var(--rpg-font-hud)', fontSize: '.85rem', color: 'var(--rpg-ink-faint)' }}>
          {progressLabel}
        </span>
      )}
    </div>
  );
}
