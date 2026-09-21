import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../styles/rpg-components.css';
import LeaderboardRow from '../components/LeaderboardRow';
import { rpgGuard } from '../components/RpgState';
import { useLeaderboard } from '../hooks/useRpg';
import TargetPapan from '../components/TargetPapan';

const DIVISI_TABS = ['Semua', 'Admin', 'PM', 'Illustrator', 'Rigger', '3D Modeler', 'Desainer'];
const PERIODE_TABS = [['weekly', 'Minggu Ini'], ['season', 'Musim Ini'], ['all', 'Sepanjang Waktu']];

// Halaman Guild Hall — leaderboard dari GET /rpg/leaderboard. Filter periode & divisi dikerjakan
// server, jadi nomor peringkat selalu konsisten dengan filter yang dipilih.
export default function GuildHallPage() {
  const [divisi, setDivisi] = useState('Semua');
  const [periode, setPeriode] = useState('weekly');
  // Jenis papan disimpan di URL (?tab=target) — bisa dibagikan/di-bookmark dan tautan dari halaman ini sendiri tetap bereaksi.
  const [sp, setSp] = useSearchParams();
  const mode = sp.get('tab') === 'target' ? 'target' : 'xp';
  const setMode = (k) => setSp(k === 'target' ? { tab: 'target' } : {}, { replace: true });
  const res = useLeaderboard(periode, divisi);
  const rows = res.data?.rows || [];
  const musim = res.data?.musim;
  const guard = res.data ? null : rpgGuard(res);

  return (
    <div className="rpg-page" style={{ fontFamily: 'var(--rpg-font-body)', color: 'var(--rpg-ink)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        <div>
          <h1 style={{ fontFamily: 'var(--rpg-font-display)', fontWeight: 400, fontSize: 'clamp(1rem, 2.4vw, 1.4rem)', color: 'var(--rpg-ink)', margin: '0 0 .6rem' }}>
            GUILD HALL
          </h1>
          <p style={{ fontFamily: 'var(--rpg-font-hud)', fontSize: '1.1rem', color: 'var(--rpg-ink-dim)', margin: 0, maxWidth: '60ch' }}>
            {mode === 'target'
              ? 'Target poin bulanan tim produksi — siapa yang sudah mencapai target dan seberapa jauh tim melangkah.'
              : <>Papan peringkat XP seluruh tim{musim ? ` — ${musim}` : ''}. XP datang dari laporan harian, jurnal, kehadiran, Friday Win, dan quest yang disetujui.</>}
          </p>
        </div>

        <div role="tablist" aria-label="Jenis papan" style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          {[['xp', 'Peringkat XP'], ['target', 'Target Produksi']].map(([k, t]) => (
            <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)} style={{
              fontFamily: 'var(--rpg-font-hud)', fontSize: '1.15rem', cursor: 'pointer',
              color: mode === k ? '#1a1206' : 'var(--rpg-ink-dim)',
              background: mode === k ? 'var(--rpg-gold)' : 'var(--rpg-bg-2)',
              border: `2px solid ${mode === k ? 'var(--rpg-gold)' : 'var(--rpg-line-dim)'}`,
              padding: '.45rem 1.1rem',
            }}>{t}</button>
          ))}
        </div>

        {mode === 'target' && <TargetPapan />}

        {mode === 'xp' && <>
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          {PERIODE_TABS.map(([k, t]) => (
            <button key={k} onClick={() => setPeriode(k)} aria-pressed={periode === k} style={{
              fontFamily: 'var(--rpg-font-hud)', fontSize: '1.05rem', cursor: 'pointer',
              color: periode === k ? '#1a1206' : 'var(--rpg-ink-dim)',
              background: periode === k ? 'var(--rpg-gold)' : 'var(--rpg-bg-2)',
              border: `2px solid ${periode === k ? 'var(--rpg-gold)' : 'var(--rpg-line-dim)'}`,
              padding: '.4rem 1rem',
            }}>
              {t}
            </button>
          ))}
        </div>

        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          {DIVISI_TABS.map(t => (
            <button key={t} onClick={() => setDivisi(t)} style={{
              fontFamily: 'var(--rpg-font-hud)', fontSize: '1.05rem', cursor: 'pointer',
              color: divisi === t ? '#1a1206' : 'var(--rpg-ink-dim)',
              background: divisi === t ? 'var(--rpg-gold)' : 'var(--rpg-bg-2)',
              border: `2px solid ${divisi === t ? 'var(--rpg-gold)' : 'var(--rpg-line-dim)'}`,
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
          {guard || (rows.length === 0
            ? <p style={{ fontFamily: 'var(--rpg-font-hud)', color: 'var(--rpg-ink-faint)', margin: 0 }}>Belum ada anggota di divisi ini.</p>
            : rows.map(r => (
                <LeaderboardRow key={r.nama} rank={r.rank} nama={r.nama} unit={r.unit} xp={r.xp} isYou={r.isYou} />
              )))}
        </div>
        </>}

      </div>
    </div>
  );
}
