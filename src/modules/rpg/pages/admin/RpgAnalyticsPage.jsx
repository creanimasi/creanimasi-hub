import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  LineChart, Line,
} from 'recharts';
import '../../styles/rpg-components.css';
import {
  dummyLevelDistribution, dummyXpTrend, dummyCompletionByType,
  dummyTipeDistribution, dummyOverallStats,
} from '../../data/dummyAnalytics';

function Panel({ title, children }) {
  return (
    <section className="rpg-pixbox" style={{
      background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)',
      boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.35), inset -2px -2px 0 rgba(0,0,0,.4), 3px 3px 0 var(--rpg-bg-3)',
      padding: 'clamp(1.1rem, 2.4vw, 1.6rem)',
    }}>
      <h2 style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '.68rem', fontWeight: 400, margin: '0 0 .9rem', lineHeight: 1.6, color: 'var(--rpg-ink)' }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

const hudTick = { fontFamily: 'VT323, monospace', fontSize: 13, fill: 'var(--rpg-ink-dim)' };
const tooltipStyle = {
  background: 'var(--rpg-bg-3)', border: '2px solid var(--rpg-line)',
  fontFamily: 'VT323, monospace', fontSize: 14, color: 'var(--rpg-ink)',
};

// Halaman Admin Analytics — PREVIEW data dummy, admin-only.
// Sengaja pakai recharts (sudah jadi dependency project, dipakai di Dashboard.jsx)
// bukan library baru — breakdown teknis bagian 8 cuma approve framer-motion/
// date-fns/canvas-confetti, tidak menyebut kebutuhan charting baru.
export default function RpgAnalyticsPage() {
  return (
    <div style={{ fontFamily: 'var(--rpg-font-body)', color: 'var(--rpg-ink)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

        <div>
          <h1 style={{ fontFamily: 'var(--rpg-font-display)', fontWeight: 400, fontSize: 'clamp(1rem, 2.4vw, 1.4rem)', color: 'var(--rpg-ink)', margin: '0 0 .6rem' }}>
            RPG ANALYTICS
          </h1>
          <p style={{ fontFamily: 'var(--rpg-font-hud)', fontSize: '1.1rem', color: 'var(--rpg-ink-dim)', margin: 0 }}>
            Ringkasan progres gamifikasi seluruh tim — admin only.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: '1rem' }}>
          {[
            { num: dummyOverallStats.totalXpSeason.toLocaleString('id-ID'), lbl: 'Total XP Musim Ini' },
            { num: dummyOverallStats.avgLevel, lbl: 'Rata-rata Level' },
            { num: `${dummyOverallStats.completionRateOverall}%`, lbl: 'Completion Rate' },
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(280px,1fr))', gap: '1.5rem' }}>

          <Panel title="DISTRIBUSI LEVEL">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={dummyLevelDistribution}>
                <CartesianGrid stroke="var(--rpg-line-dim)" strokeDasharray="2 2" />
                <XAxis dataKey="bucket" tick={hudTick} axisLine={{ stroke: 'var(--rpg-line-dim)' }} tickLine={false} />
                <YAxis tick={hudTick} axisLine={{ stroke: 'var(--rpg-line-dim)' }} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'rgba(255,210,63,.08)' }} />
                <Bar dataKey="jumlah" fill="var(--rpg-gold)" name="Jumlah anggota" />
              </BarChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="TREN XP MINGGUAN">
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={dummyXpTrend}>
                <CartesianGrid stroke="var(--rpg-line-dim)" strokeDasharray="2 2" />
                <XAxis dataKey="minggu" tick={hudTick} axisLine={{ stroke: 'var(--rpg-line-dim)' }} tickLine={false} />
                <YAxis tick={hudTick} axisLine={{ stroke: 'var(--rpg-line-dim)' }} tickLine={false} />
                <Tooltip contentStyle={tooltipStyle} />
                <Line type="stepAfter" dataKey="xp" stroke="var(--rpg-stat-konsistensi)" strokeWidth={2} dot={{ r: 3 }} name="Total XP" />
              </LineChart>
            </ResponsiveContainer>
          </Panel>

          <Panel title="COMPLETION RATE PER TIPE QUEST">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {dummyCompletionByType.map(c => (
                <div key={c.tipe}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--rpg-font-hud)', fontSize: '1.05rem', marginBottom: '.35rem' }}>
                    <span style={{ color: 'var(--rpg-ink)' }}>{c.tipe}</span>
                    <span style={{ color: 'var(--rpg-gold)' }}>{c.completionPct}%</span>
                  </div>
                  <div style={{ height: 10, background: 'var(--rpg-bg-3)', border: '2px solid var(--rpg-line-dim)' }}>
                    <div style={{ height: '100%', width: `${c.completionPct}%`, background: 'var(--rpg-gold)' }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

          <Panel title="DISTRIBUSI TIPE ANGGOTA">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {dummyTipeDistribution.map(t => (
                <div key={t.tipe}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--rpg-font-hud)', fontSize: '1.05rem', marginBottom: '.35rem' }}>
                    <span style={{ color: 'var(--rpg-ink)' }}>{t.tipe}</span>
                    <span style={{ color: `var(${t.colorVar})` }}>{t.jumlah} orang</span>
                  </div>
                  <div style={{ height: 10, background: 'var(--rpg-bg-3)', border: '2px solid var(--rpg-line-dim)' }}>
                    <div style={{ height: '100%', width: `${(t.jumlah / 17) * 100}%`, backgroundColor: `var(${t.colorVar})` }} />
                  </div>
                </div>
              ))}
            </div>
          </Panel>

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
