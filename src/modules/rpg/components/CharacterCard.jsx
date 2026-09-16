import XpBar from './XpBar';
import LevelUpToast from './LevelUpToast';

// Kartu utama Character Sheet: crest inisial, nama, title, rarity, level, XP bar.
export default function CharacterCard({ character }) {
  const {
    nama, initial, roleLine, level, careerStage, title,
    rarity, rarityMax, xpTotal, xpNextTier, levelUpNote,
  } = character;

  return (
    <section className="rpg-pixbox" style={{
      background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)',
      boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.35), inset -2px -2px 0 rgba(0,0,0,.4), 3px 3px 0 var(--rpg-bg-3)',
      padding: 'clamp(1.3rem, 3vw, 2rem)',
      fontFamily: 'var(--rpg-font-body)',
    }}>
      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>

        {/* Crest / avatar */}
        <div style={{
          flex: 'none', width: 92, height: 92, position: 'relative',
          background: 'repeating-conic-gradient(#241a52 0% 25%, #2c2168 0% 50%) 0 0/8px 8px, var(--rpg-bg-3)',
          border: '2px solid var(--rpg-line)',
          boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.3), inset -2px -2px 0 rgba(0,0,0,.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <span style={{
            fontFamily: 'var(--rpg-font-display)', fontSize: '1.15rem', color: 'var(--rpg-gold)',
            textShadow: '2px 2px 0 rgba(0,0,0,.5)',
          }}>
            {initial}
          </span>
        </div>

        {/* Identitas */}
        <div style={{ flex: '1 1 260px', minWidth: 0 }}>
          <h1 style={{
            fontFamily: 'var(--rpg-font-display)', fontWeight: 400,
            fontSize: 'clamp(1rem, 2.2vw, 1.3rem)', margin: 0, lineHeight: 1.5, color: 'var(--rpg-ink)',
          }}>
            {nama}
          </h1>

          <div style={{ display: 'flex', gap: '.2rem', margin: '.5rem 0 .3rem' }} aria-label={`Rarity ${rarity} dari ${rarityMax}`}>
            {Array.from({ length: rarityMax }).map((_, i) => (
              <i key={i} style={{ width: 11, height: 11, background: i < rarity ? 'var(--rpg-gold)' : 'var(--rpg-ink-faint)' }} />
            ))}
          </div>

          <span style={{
            fontFamily: 'var(--rpg-font-hud)', fontSize: '.95rem',
            color: '#1a1206', background: 'var(--rpg-gold)', padding: '.22rem .6rem', display: 'inline-block',
          }}>
            {title}
          </span>

          <p style={{ margin: '.45rem 0 0', fontFamily: 'var(--rpg-font-hud)', color: 'var(--rpg-ink-dim)', fontSize: '1.05rem' }}>
            {roleLine}
          </p>
        </div>

        {/* Level */}
        <div style={{ flex: 'none', textAlign: 'right' }}>
          <div style={{
            fontFamily: 'var(--rpg-font-display)', fontSize: '1.5rem', color: 'var(--rpg-gold)',
            lineHeight: 1, textShadow: '2px 2px 0 rgba(0,0,0,.5)',
          }}>
            Lv{level}
          </div>
          <div style={{
            fontFamily: 'var(--rpg-font-hud)', fontSize: '.95rem', letterSpacing: '.04em',
            color: 'var(--rpg-ink-dim)', textTransform: 'uppercase', marginTop: '.35rem',
          }}>
            {careerStage}
          </div>
        </div>
      </div>

      <XpBar current={xpTotal} target={xpNextTier} />
      <LevelUpToast message={levelUpNote} />
    </section>
  );
}
