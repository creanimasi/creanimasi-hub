import { useState, useMemo } from 'react';
import '../styles/rpg-components.css';
import QuestCard from '../components/QuestCard';
import { dummySummary, dummyQuestGroups, dummyCompletedQuests, QUEST_TABS } from '../data/dummyQuests';

const QUEST_ICONS = {
  sync:   <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" stroke="var(--rpg-gold)" width={17} height={17}><path d="M21 11.5a8.5 8.5 0 1 1-4-7.2L21 3l-1.2 4.7" /></svg>,
  board:  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" stroke="var(--rpg-gold)" width={17} height={17}><path d="M9 6h11M9 12h11M9 18h11" /><rect x="3" y="4.5" width="3" height="3" /><rect x="3" y="10.5" width="3" height="3" /><rect x="3" y="16.5" width="3" height="3" /></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" stroke="var(--rpg-gold)" width={17} height={17}><path d="M12 2 3 7v6c0 5 4 8 9 9 5-1 9-4 9-9V7l-9-5Z" /></svg>,
  badge:  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" stroke="var(--rpg-gold)" width={17} height={17}><path d="M12 19l7-7 3 3-7 7-3-3Z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5Z" /></svg>,
  target: <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" stroke="var(--rpg-gold)" width={17} height={17}><circle cx="12" cy="9" r="5" /><path d="M8.5 13.5 7 21l5-3 5 3-1.5-7.5" /></svg>,
};

const TAB_TO_GROUP = { Harian: 'harian', Proyek: 'proyek', Sekali: 'sekali' };

// Halaman Quest Board — PREVIEW dengan data dummy, belum disambung ke API.
// Aksi "Selesai" hanya update state lokal (optimistic-looking), bukan panggilan
// nyata ke POST /api/rpg/quests/:assignmentId/complete — itu bagian Fase 2 (API).
export default function QuestBoardPage() {
  const [tab, setTab] = useState('Semua');
  const [doneIds, setDoneIds] = useState(new Set());

  const visibleGroups = useMemo(() => {
    if (tab === 'Selesai') return [];
    const groups = tab === 'Semua' ? dummyQuestGroups : dummyQuestGroups.filter(g => g.id === TAB_TO_GROUP[tab]);
    return groups.map(g => ({ ...g, quests: g.quests.filter(q => !doneIds.has(q.id)) }));
  }, [tab, doneIds]);

  const showCompleted = tab === 'Semua' || tab === 'Selesai';

  return (
    <div style={{ fontFamily: 'var(--rpg-font-body)', color: 'var(--rpg-ink)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        <div>
          <h1 style={{ fontFamily: 'var(--rpg-font-display)', fontWeight: 400, fontSize: 'clamp(1rem, 2.4vw, 1.4rem)', color: 'var(--rpg-ink)', margin: '0 0 .6rem' }}>
            PAPAN QUEST
          </h1>
          <p style={{ fontFamily: 'var(--rpg-font-hud)', fontSize: '1.1rem', color: 'var(--rpg-ink-dim)', margin: 0, maxWidth: '60ch' }}>
            Semua tugas aktifmu — dari laporan harian sampai proyek klien — lengkap dengan XP yang menanti.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '1rem' }}>
          {[
            { num: dummySummary.activeCount, lbl: 'Quest Aktif' },
            { num: dummySummary.xpPending, lbl: 'XP Menanti' },
            { num: dummySummary.completedThisWeek, lbl: 'Selesai Minggu Ini' },
          ].map(s => (
            <div key={s.lbl} className="rpg-pixbox" style={{
              background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)',
              boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.35), inset -2px -2px 0 rgba(0,0,0,.4), 3px 3px 0 var(--rpg-bg-3)',
              padding: '1rem 1.1rem',
            }}>
              <div style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '1.4rem', color: 'var(--rpg-gold)', textShadow: '2px 2px 0 rgba(0,0,0,.5)', lineHeight: 1.2 }}>
                {s.num}
              </div>
              <div style={{ fontFamily: 'var(--rpg-font-hud)', fontSize: '1rem', color: 'var(--rpg-ink-dim)', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: '.35rem' }}>
                {s.lbl}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          {QUEST_TABS.map(t => (
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

        {visibleGroups.map(g => g.quests.length > 0 && (
          <div key={g.id} style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
            <div style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '.7rem', color: 'var(--rpg-ink)', display: 'flex', alignItems: 'center', gap: '.6rem' }}>
              {g.label}
              <span style={{ fontFamily: 'var(--rpg-font-hud)', fontSize: '.95rem', color: 'var(--rpg-ink-faint)' }}>{g.tag}</span>
            </div>
            {g.quests.map(q => (
              <QuestCard
                key={q.id}
                variant="full"
                icon={QUEST_ICONS[q.type]}
                title={q.title}
                xpReward={q.xpReward}
                dueLabel={q.dueLabel}
                warn={q.warn}
                progressPct={q.progressPct}
                onComplete={() => setDoneIds(prev => new Set(prev).add(q.id))}
              />
            ))}
          </div>
        ))}

        {showCompleted && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
            <div style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '.7rem', color: 'var(--rpg-ink)' }}>
              SELESAI BARU-BARU INI
            </div>
            {dummyCompletedQuests.map(q => (
              <div key={q.id} className="rpg-pixbox" style={{
                background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)',
                boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.35), inset -2px -2px 0 rgba(0,0,0,.4), 3px 3px 0 var(--rpg-bg-3)',
                padding: '.7rem 1.1rem', display: 'flex', alignItems: 'center', gap: '.8rem', opacity: .72,
              }}>
                <div style={{ width: 22, height: 22, flex: 'none', background: 'var(--rpg-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="square" strokeLinejoin="miter" stroke="#08240f" width={13} height={13}><path d="m5 12 5 5 9-10" /></svg>
                </div>
                <div style={{ fontSize: '.9rem', color: 'var(--rpg-ink-dim)', textDecoration: 'line-through', textDecorationColor: 'var(--rpg-ink-faint)' }}>
                  {q.title}
                </div>
                <div style={{ fontFamily: 'var(--rpg-font-hud)', fontSize: '.95rem', color: 'var(--rpg-ink-faint)' }}>{q.when}</div>
                <div style={{ fontFamily: 'var(--rpg-font-hud)', fontSize: '1.05rem', color: 'var(--rpg-ink-faint)', marginLeft: 'auto', flex: 'none' }}>
                  +{q.xpReward} XP
                </div>
              </div>
            ))}
          </div>
        )}

        {visibleGroups.every(g => g.quests.length === 0) && !showCompleted && (
          <p style={{ fontFamily: 'var(--rpg-font-hud)', color: 'var(--rpg-ink-faint)' }}>Tidak ada quest di kategori ini.</p>
        )}

        <p style={{
          marginTop: '.5rem', paddingTop: '1.1rem', borderTop: '2px solid var(--rpg-line-dim)',
          fontFamily: 'var(--rpg-font-hud)', fontSize: '1rem', color: 'var(--rpg-ink-faint)', textAlign: 'center',
        }}>
          Preview modul gamifikasi — data di atas dummy, tombol "Selesai" cuma update state lokal.
        </p>
      </div>
    </div>
  );
}
