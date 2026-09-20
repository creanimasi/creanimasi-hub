import { useState, useMemo } from 'react';
import '../styles/rpg-components.css';
import QuestCard from '../components/QuestCard';
import { rpgGuard } from '../components/RpgState';
import { useQuests } from '../hooks/useRpg';
import { api } from '../../../services/api';
import { useToast } from '../../../hooks/useToast';
import { useAuth } from '../../../hooks/useAuth';
import PapanQuestAdmin from './admin/PapanQuestAdmin';

const QUEST_ICONS = {
  sync:   <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" stroke="var(--rpg-gold)" width={17} height={17}><path d="M21 11.5a8.5 8.5 0 1 1-4-7.2L21 3l-1.2 4.7" /></svg>,
  board:  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" stroke="var(--rpg-gold)" width={17} height={17}><path d="M9 6h11M9 12h11M9 18h11" /><rect x="3" y="4.5" width="3" height="3" /><rect x="3" y="10.5" width="3" height="3" /><rect x="3" y="16.5" width="3" height="3" /></svg>,
  shield: <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" stroke="var(--rpg-gold)" width={17} height={17}><path d="M12 2 3 7v6c0 5 4 8 9 9 5-1 9-4 9-9V7l-9-5Z" /></svg>,
  badge:  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" stroke="var(--rpg-gold)" width={17} height={17}><path d="M12 19l7-7 3 3-7 7-3-3Z" /><path d="M18 13l-1.5-7.5L2 2l3.5 14.5L13 18l5-5Z" /></svg>,
  target: <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" stroke="var(--rpg-gold)" width={17} height={17}><circle cx="12" cy="9" r="5" /><path d="M8.5 13.5 7 21l5-3 5 3-1.5-7.5" /></svg>,
};

const QUEST_TABS = ['Semua', 'Harian', 'Proyek', 'Sekali', 'Selesai'];
const TAB_TO_GROUP = { Harian: 'harian', Proyek: 'proyek', Sekali: 'sekali' };

const pixbox = {
  background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)',
  boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.35), inset -2px -2px 0 rgba(0,0,0,.4), 3px 3px 0 var(--rpg-bg-3)',
};

// Halaman Quest Board — data dari GET /rpg/quests.
// "Selesai" tidak langsung memberi XP: quest diajukan ke admin (POST …/ajukan) lalu XP
// baru masuk setelah admin menyetujui. Quest Harian otomatis selesai lewat laporan harian.
function PapanSaya({ atas, opsiGuard }) {
  const [tab, setTab] = useState('Semua');
  const [busyId, setBusyId] = useState(null);
  const { showToast } = useToast();
  const res = useQuests();
  const data = res.data;

  const visibleGroups = useMemo(() => {
    if (!data || tab === 'Selesai') return [];
    return tab === 'Semua' ? data.groups : data.groups.filter(g => g.id === TAB_TO_GROUP[tab]);
  }, [tab, data]);

  const guard = data ? null : rpgGuard(res, opsiGuard);
  const showCompleted = tab === 'Semua' || tab === 'Selesai';

  const aksi = async (id, fn, pesan) => {
    setBusyId(id);
    try { await fn(); if (pesan) showToast(pesan); res.reload(); }
    catch (e) { showToast((e.message || 'Gagal').replace(/^\d{3}: /, ''), 'error'); res.reload(); }
    finally { setBusyId(null); }
  };

  return (
    <div className="rpg-page" style={{ fontFamily: 'var(--rpg-font-body)', color: 'var(--rpg-ink)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {atas}
        <div>
          <h1 style={{ fontFamily: 'var(--rpg-font-display)', fontWeight: 400, fontSize: 'clamp(1rem, 2.4vw, 1.4rem)', color: 'var(--rpg-ink)', margin: '0 0 .6rem' }}>
            PAPAN QUEST
          </h1>
          <p style={{ fontFamily: 'var(--rpg-font-hud)', fontSize: '1.1rem', color: 'var(--rpg-ink-dim)', margin: 0, maxWidth: '60ch' }}>
            Semua tugas aktifmu — dari laporan harian sampai proyek klien — lengkap dengan XP yang menanti.
            Quest proyek dan sekali baru memberi XP setelah disetujui admin.
          </p>
        </div>

        {guard}

        {data && (<>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '1rem' }}>
            {[
              { num: data.summary.activeCount, lbl: 'Quest Aktif' },
              { num: data.summary.xpPending, lbl: 'XP Menanti' },
              { num: data.summary.completedThisWeek, lbl: 'Selesai Minggu Ini' },
            ].map(s => (
              <div key={s.lbl} className="rpg-pixbox" style={{ ...pixbox, padding: '1rem 1.1rem' }}>
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
              <button key={t} onClick={() => setTab(t)} aria-pressed={tab === t} style={{
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
                  status={q.status}
                  urgensi={q.urgensi}
                  progressPct={q.otomatis ? undefined : q.progressPct}
                  busy={busyId === q.id}
                  onProgress={q.otomatis ? undefined : (pct) => aksi(q.id, () => api.rpgProgress(q.id, pct))}
                  onComplete={q.otomatis ? undefined : () => aksi(q.id, () => api.rpgAjukan(q.id), 'Quest diajukan — menunggu persetujuan admin')}
                />
              ))}
            </div>
          ))}

          {showCompleted && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '.75rem' }}>
              <div style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '.7rem', color: 'var(--rpg-ink)' }}>
                SELESAI BARU-BARU INI
              </div>
              {data.completed.length === 0 && (
                <p style={{ fontFamily: 'var(--rpg-font-hud)', color: 'var(--rpg-ink-faint)', margin: 0 }}>Belum ada quest yang disetujui.</p>
              )}
              {data.completed.map(q => (
                <div key={q.id} className="rpg-pixbox" style={{ ...pixbox, padding: '.7rem 1.1rem', display: 'flex', alignItems: 'center', gap: '.8rem' }}>
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

          {!showCompleted && visibleGroups.every(g => g.quests.length === 0) && (
            <p style={{ fontFamily: 'var(--rpg-font-hud)', color: 'var(--rpg-ink-faint)' }}>Tidak ada quest di kategori ini.</p>
          )}
        </>)}
      </div>
    </div>
  );
}

// Sakelar tampilan untuk admin: papan semua tim (Kanban) atau papan pribadi.
function SakelarPapan({ mode, setMode }) {
  const tombol = (k, label) => (
    <button key={k} type="button" aria-pressed={mode === k} onClick={() => setMode(k)} style={{
      fontFamily: 'var(--rpg-font-hud)', fontSize: '1.05rem', cursor: 'pointer',
      color: mode === k ? '#1a1206' : 'var(--rpg-ink-dim)', background: mode === k ? 'var(--rpg-gold)' : 'var(--rpg-bg-2)',
      border: `2px solid ${mode === k ? 'var(--rpg-gold)' : 'var(--rpg-line-dim)'}`, padding: '.35rem 1rem',
    }}>{label}</button>
  );
  return <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>{tombol('tim', 'Semua tim')}{tombol('saya', 'Papan saya')}</div>;
}

// Pemegang akses admin/pantau melihat Kanban semua tim (default); anggota biasa tetap melihat papan pribadinya.
export default function QuestBoardPage() {
  const { user } = useAuth();
  const akses = user?.page_access || [];
  const bisaLihatTim = akses.includes('rpg-admin') || akses.includes('rpg-pantau');
  const [mode, setMode] = useState('tim');
  if (!bisaLihatTim) return <PapanSaya />;
  const sakelar = <SakelarPapan mode={mode} setMode={setMode} />;
  if (mode === 'tim') return <PapanQuestAdmin atas={sakelar} />;
  return (
    <PapanSaya atas={sakelar} opsiGuard={{
      judul: 'TIDAK PUNYA PAPAN PRIBADI',
      teks: 'Akun ini tidak tertaut ke data anggota tim (umum untuk akun admin), jadi tidak punya quest pribadi. Lihat quest semua anggota di tampilan Semua tim.',
      tombol: { label: 'Lihat papan semua tim →', onClick: () => setMode('tim') },
    }} />
  );
}
