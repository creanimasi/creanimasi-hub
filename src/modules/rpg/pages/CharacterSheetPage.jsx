import '../styles/rpg-components.css';
import CharacterCard from '../components/CharacterCard';
import StatMeter from '../components/StatMeter';
import AchievementBadge from '../components/AchievementBadge';
import QuestCard from '../components/QuestCard';
import LeaderboardRow from '../components/LeaderboardRow';
import {
  dummyCharacter, dummyStats, dummyAchievements, dummyActiveQuests, dummyLeaderboard,
} from '../data/dummyCharacter';

const STAT_ICONS = {
  produktivitas: <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" stroke="#0b0d1e" width={13} height={13}><path d="M13 2 3 14h7l-1 8 10-12h-7l1-8Z" /></svg>,
  kolaborasi:    <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" stroke="#0b0d1e" width={13} height={13}><circle cx="9" cy="7" r="3" /><path d="M2 20c0-3.5 3-6 7-6s7 2.5 7 6" /><circle cx="17" cy="8" r="2.5" /><path d="M15 20c.3-2.5 1.8-4.3 4-4.8" /></svg>,
  inisiatif:     <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" stroke="#0b0d1e" width={13} height={13}><path d="M12 3v3M12 18v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M3 12h3M18 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" /><circle cx="12" cy="12" r="3.5" /></svg>,
  konsistensi:   <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" stroke="#0b0d1e" width={13} height={13}><path d="M12 2v20M5 8l7-6 7 6M5 8v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8" /></svg>,
};

// Halaman Character Sheet — PREVIEW dengan data dummy, belum disambung ke API.
// Sengaja TIDAK menduplikasi navigasi/topbar: halaman ini dirender di dalam
// Layout/Sidebar hub yang sudah ada (lihat App.jsx), beda dengan mockup
// standalone yang punya railnav & topbar sendiri untuk keperluan preview visual.
export default function CharacterSheetPage() {
  return (
    <div style={{ fontFamily: 'var(--rpg-font-body)', color: 'var(--rpg-ink)' }}>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0,1fr) 300px',
        gap: '1.5rem',
        alignItems: 'start',
      }}>
        {/* ── Stage utama ── */}
        <main style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
          <CharacterCard character={dummyCharacter} />

          <section className="rpg-pixbox" style={{
            background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)',
            boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.35), inset -2px -2px 0 rgba(0,0,0,.4), 3px 3px 0 var(--rpg-bg-3)',
            padding: 'clamp(1.1rem, 2.4vw, 1.6rem)',
          }}>
            <h2 style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '.68rem', fontWeight: 400, margin: '0 0 .7rem', lineHeight: 1.6 }}>
              STATISTIK <em style={{ color: 'var(--rpg-gold)', fontStyle: 'normal' }}>PILAR</em>
            </h2>
            <div style={{ height: 2, background: 'var(--rpg-line-dim)', margin: '0 0 1.1rem' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '1.1rem 1.6rem' }}>
              {dummyStats.map(s => (
                <StatMeter key={s.key} label={s.label} value={s.value} colorVar={s.colorVar} icon={STAT_ICONS[s.key]} />
              ))}
            </div>
          </section>

          <section className="rpg-pixbox" style={{
            background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)',
            boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.35), inset -2px -2px 0 rgba(0,0,0,.4), 3px 3px 0 var(--rpg-bg-3)',
            padding: 'clamp(1.1rem, 2.4vw, 1.6rem)',
          }}>
            <h2 style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '.68rem', fontWeight: 400, margin: '0 0 .7rem', lineHeight: 1.6 }}>
              PENCAPAIAN
            </h2>
            <div style={{ height: 2, background: 'var(--rpg-line-dim)', margin: '0 0 1.1rem' }} />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(88px, 1fr))', gap: '1rem' }}>
              {dummyAchievements.map(a => (
                <AchievementBadge key={a.code} label={a.label} locked={a.locked} progressLabel={a.progressLabel} />
              ))}
            </div>
          </section>
        </main>

        {/* ── Side panel ── */}
        <aside style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', minWidth: 0 }}>
          <div className="rpg-pixbox" style={{
            background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)',
            boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.35), inset -2px -2px 0 rgba(0,0,0,.4), 3px 3px 0 var(--rpg-bg-3)',
            padding: 'clamp(1.1rem, 2.4vw, 1.6rem)',
          }}>
            <h2 style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '.68rem', fontWeight: 400, margin: '0 0 .7rem', lineHeight: 1.6 }}>
              QUEST <em style={{ color: 'var(--rpg-gold)', fontStyle: 'normal' }}>AKTIF</em>
            </h2>
            <div style={{ height: 2, background: 'var(--rpg-line-dim)', margin: '0 0 1.1rem' }} />
            {dummyActiveQuests.map(q => (
              <QuestCard key={q.id} title={q.title} xpReward={q.xpReward} dueLabel={q.dueLabel} progressPct={q.progressPct} warn={q.warn} />
            ))}
          </div>

          <div className="rpg-pixbox" style={{
            background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)',
            boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.35), inset -2px -2px 0 rgba(0,0,0,.4), 3px 3px 0 var(--rpg-bg-3)',
            padding: 'clamp(1.1rem, 2.4vw, 1.6rem)',
          }}>
            <h2 style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '.68rem', fontWeight: 400, margin: '0 0 .7rem', lineHeight: 1.6 }}>
              GUILD HALL <em style={{ color: 'var(--rpg-gold)', fontStyle: 'normal' }}>· TOP XP</em>
            </h2>
            <div style={{ height: 2, background: 'var(--rpg-line-dim)', margin: '0 0 1.1rem' }} />
            {dummyLeaderboard.map(l => (
              <LeaderboardRow key={l.rank} rank={l.rank} nama={l.nama} unit={l.unit} xp={l.xp} isYou={l.isYou} />
            ))}
          </div>
        </aside>
      </div>

      <p style={{
        marginTop: '2rem', paddingTop: '1.1rem', borderTop: '2px solid var(--rpg-line-dim)',
        fontFamily: 'var(--rpg-font-hud)', fontSize: '1rem', color: 'var(--rpg-ink-faint)', textAlign: 'center',
      }}>
        Preview modul gamifikasi — data di atas dummy, belum tersambung ke API/database.
      </p>
    </div>
  );
}
