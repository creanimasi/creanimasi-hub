import { useState, useMemo } from 'react';
import '../styles/rpg-components.css';
import LeaderboardRow from '../components/LeaderboardRow';
import { DIVISI_TABS, dummyLeaderboardFull } from '../data/dummyGuildHall';

// Halaman Guild Hall — leaderboard mingguan, PREVIEW data dummy.
// Filter divisi = client-side saja untuk sekarang; nanti tinggal kirim
// sebagai query param ?divisi= ke GET /api/rpg/leaderboard.
export default function GuildHallPage() {
  const [divisi, setDivisi] = useState('Semua');

  const filtered = useMemo(() => {
    const rows = divisi === 'Semua'
      ? dummyLeaderboardFull
      : dummyLeaderboardFull.filter(r => r.divisi === divisi);
    // re-rank setelah difilter supaya nomor urut tetap rapi
    return rows.map((r, i) => ({ ...r, rank: i + 1 }));
  }, [divisi]);

  return (
    <div style={{ fontFamily: 'var(--rpg-font-body)', color: 'var(--rpg-ink)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        <div>
          <h1 style={{ fontFamily: 'var(--rpg-font-display)', fontWeight: 400, fontSize: 'clamp(1rem, 2.4vw, 1.4rem)', color: 'var(--rpg-ink)', margin: '0 0 .6rem' }}>
            GUILD HALL
          </h1>
          <p style={{ fontFamily: 'var(--rpg-font-hud)', fontSize: '1.1rem', color: 'var(--rpg-ink-dim)', margin: 0, maxWidth: '60ch' }}>
            Papan peringkat XP mingguan seluruh tim — musim berjalan (Musim 01).
          </p>
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
          {filtered.length === 0
            ? <p style={{ fontFamily: 'var(--rpg-font-hud)', color: 'var(--rpg-ink-faint)', margin: 0 }}>Belum ada anggota di divisi ini.</p>
            : filtered.map(r => (
                <LeaderboardRow key={r.nama} rank={r.rank} nama={r.nama} unit={r.unit} xp={r.xp} isYou={r.isYou} />
              ))}
        </div>

        <p style={{
          marginTop: '.5rem', paddingTop: '1.1rem', borderTop: '2px solid var(--rpg-line-dim)',
          fontFamily: 'var(--rpg-font-hud)', fontSize: '1rem', color: 'var(--rpg-ink-faint)', textAlign: 'center',
        }}>
          Preview modul gamifikasi — data di atas dummy, belum tersambung ke API/database.
        </p>
      </div>
    </div>
  );
}
