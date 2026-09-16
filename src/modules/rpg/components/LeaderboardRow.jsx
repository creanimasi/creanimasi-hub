// Satu baris papan peringkat (Guild Hall) — dipakai di sidebar Character Sheet
// dan nanti di GuildHallPage penuh.
export default function LeaderboardRow({ rank, nama, unit, xp, isYou }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '.7rem', padding: '.55rem 0',
      borderBottom: '1px dashed var(--rpg-line-dim)',
      background: isYou ? 'rgba(255,210,63,.08)' : 'transparent',
      paddingInline: isYou ? '.5rem' : 0,
      marginInline: isYou ? '-.5rem' : 0,
    }}>
      <span style={{
        fontFamily: 'var(--rpg-font-display)', fontSize: '.65rem', width: '1.4rem',
        textAlign: 'center', flex: 'none', color: isYou ? 'var(--rpg-gold)' : 'var(--rpg-ink-faint)',
      }}>
        {rank === 1
          ? <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" stroke="var(--rpg-gold)" width={16} height={16}>
              <path d="m3 8 4 3 5-6 5 6 4-3-2 11H5L3 8Z" />
            </svg>
          : rank}
      </span>
      <span style={{ flex: 1, minWidth: 0, fontFamily: 'var(--rpg-font-hud)' }}>
        <span style={{ fontSize: '1.05rem', color: 'var(--rpg-ink)' }}>
          {nama}{isYou && ' · Kamu'}
        </span>
        <br />
        <span style={{ fontSize: '.85rem', color: 'var(--rpg-ink-faint)' }}>{unit}</span>
      </span>
      <span style={{ fontFamily: 'var(--rpg-font-hud)', fontSize: '1.05rem', color: 'var(--rpg-ink-dim)', flex: 'none' }}>
        {xp.toLocaleString('id-ID')}
      </span>
    </div>
  );
}
