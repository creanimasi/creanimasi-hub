import { useState, useMemo } from 'react';
import '../styles/rpg-components.css';
import AchievementBadge from '../components/AchievementBadge';
import { rpgGuard } from '../components/RpgState';
import { useAchievements } from '../hooks/useRpg';

const TABS = ['Semua', 'Terbuka', 'Terkunci'];

// Halaman Pencapaian — grid achievement penuh dari GET /rpg/achievements.
export default function AchievementsPage() {
  const [tab, setTab] = useState('Semua');
  const res = useAchievements();
  const semua = useMemo(() => res.data || [], [res.data]);

  const filtered = useMemo(() => {
    if (tab === 'Terbuka') return semua.filter(a => !a.locked);
    if (tab === 'Terkunci') return semua.filter(a => a.locked);
    return semua;
  }, [tab, semua]);

  const unlockedCount = semua.filter(a => !a.locked).length;
  const guard = res.data ? null : rpgGuard(res);

  return (
    <div style={{ fontFamily: 'var(--rpg-font-body)', color: 'var(--rpg-ink)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        <div>
          <h1 style={{ fontFamily: 'var(--rpg-font-display)', fontWeight: 400, fontSize: 'clamp(1rem, 2.4vw, 1.4rem)', color: 'var(--rpg-ink)', margin: '0 0 .6rem' }}>
            PENCAPAIAN
          </h1>
          <p style={{ fontFamily: 'var(--rpg-font-hud)', fontSize: '1.1rem', color: 'var(--rpg-ink-dim)', margin: 0 }}>
            {guard ? '' : `${unlockedCount} dari ${semua.length} pencapaian terbuka.`}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          {TABS.map(t => (
            <button key={t} onClick={() => setTab(t)} style={{
              fontFamily: 'var(--rpg-font-hud)', fontSize: '1.05rem', cursor: 'pointer',
              color: tab === t ? '#1a1206' : 'var(--rpg-ink-dim)',
              background: tab === t ? 'var(--rpg-gold)' : 'var(--rpg-bg-2)',
              border: `2px solid ${tab === t ? 'var(--rpg-gold)' : 'var(--rpg-line-dim)'}`,
              padding: '.4rem 1rem',
            }}>
              {t}
            </button>
          ))}
        </div>

        <div className="rpg-pixbox" style={{
          background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)',
          boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.35), inset -2px -2px 0 rgba(0,0,0,.4), 3px 3px 0 var(--rpg-bg-3)',
          padding: 'clamp(1.1rem, 2.4vw, 1.6rem)',
        }}>
          {guard || (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '1.2rem' }}>
              {filtered.map(a => (
                <AchievementBadge key={a.code} label={a.label} locked={a.locked} progressLabel={a.progressLabel} />
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
