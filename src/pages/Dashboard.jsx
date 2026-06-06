import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { RadialBarChart, RadialBar, ResponsiveContainer } from 'recharts';
import { TIM, TIPE_COLOR, DIVISI_COLOR } from '../data/tim';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { STUDIO_CONFIG } from '../data/constants';

// Ring chart tunggal untuk satu metrik
function MetricRing({ value, max, color, label, sub }) {
  const pct  = Math.round((value / max) * 100);
  const data = [{ value: pct, fill: color }];
  return (
    <div style={{ textAlign: 'center', flex: '1 1 90px' }}>
      <div style={{ position: 'relative', width: 80, height: 80, margin: '0 auto' }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart
            innerRadius="65%" outerRadius="100%"
            data={data} startAngle={90} endAngle={-270}
            barSize={8}>
            {/* Track (background ring) */}
            <RadialBar background={{ fill: 'var(--border)' }} dataKey="value"
              cornerRadius={10} />
          </RadialBarChart>
        </ResponsiveContainer>
        {/* Center text */}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
        }}>
          <div style={{ fontSize: 16, fontWeight: 800, color, lineHeight: 1 }}>
            {value ?? '—'}
          </div>
          <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 1 }}>/{max}</div>
        </div>
      </div>
      <div style={{ fontSize: 11, fontWeight: 600, marginTop: 6 }}>{label}</div>
      {sub && <div style={{ fontSize: 9, color: 'var(--text-3)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

// Normalisasi kolom skor dari berbagai tabel profiling ke format standar
function extractScores(p, fallback) {
  if (!p) return fallback;
  const skill = p.skill_copywriting ?? p.skill_komunikasi ?? p.skill_level_csp ?? p.skill_level_live2d ?? p.skill_level_blender ?? fallback.skill;
  const kom   = p.skor_komunikasi   ?? p.skill_komunikasi ?? fallback.komunikasi;
  const pilar = p.skor_kerja_tim    ?? fallback.kriteria;
  const puas  = p.kepuasan_diri     ?? fallback.kepuasan;
  return { skill, komunikasi: kom, kriteria: pilar, kepuasan: puas, fromDB: true };
}

function Avatar({ nama, bg, color, size = 28 }) {
  const initials = nama.split(' ').slice(0, 2).map(w => w[0]).join('');
  return (
    <div className="avatar" style={{ width: size, height: size, background: bg, color, fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}

// ── DASHBOARD MEMBER ──────────────────────────────────────────────────────────
function DashboardMember({ user }) {
  const navigate  = useNavigate();
  const member    = TIM.find(t => t.nama === user.nama);
  const tc        = member ? (TIPE_COLOR[member.tipe] || {}) : {};
  const dc        = member ? (DIVISI_COLOR[member.divisi] || {}) : {};
  const inits     = user.nama.split(' ').slice(0, 2).map(w => w[0]).join('');

  const fallbackScores = useMemo(
    () => ({ skill: member?.skill, komunikasi: member?.komunikasi, kriteria: member?.kriteria, kepuasan: member?.kepuasan }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [member?.id]
  );
  const [scores, setScores] = useState(fallbackScores);
  const [scoresLoaded, setScoresLoaded] = useState(false);

  const [hasProfile, setHasProfile] = useState(true);
  const [onboardDismissed, setOnboardDismissed] = useState(
    () => localStorage.getItem(`onboard_done_${user?.username}`) === '1'
  );

  useEffect(() => {
    api.getProfilingMe()
      .then(res => {
        if (res.data) { setScores(extractScores(res.data, fallbackScores)); setHasProfile(true); }
        else setHasProfile(false);
      })
      .catch(() => {})
      .finally(() => setScoresLoaded(true));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dismissOnboard = () => {
    localStorage.setItem(`onboard_done_${user?.username}`, '1');
    setOnboardDismissed(true);
  };

  const RANK_CFG = {
    'Rising Star':    { icon: '⭐', label: 'Rising Star'    },
    'High Potential': { icon: '💎', label: 'High Potential' },
    'Silent Expert':  { icon: '🛡️', label: 'Silent Expert'  },
    'At Risk':        { icon: '⚠️', label: 'At Risk'        },
  };
  const rank = member ? (RANK_CFG[member.tipe] || {}) : {};

  const shortcuts = [
    { icon: '📓', label: 'Isi Jurnal Mingguan', sub: 'Rutin tiap Jumat',    path: '/jurnal/isi',     color: 'var(--green)'  },
    { icon: '📋', label: 'Riwayat Jurnal',      sub: 'Lihat histori kamu',  path: '/jurnal/riwayat', color: 'var(--blue)'   },
    { icon: '👤', label: 'Form Profiling',       sub: 'Update datamu',       path: '/profiling',      color: 'var(--purple)' },
    { icon: '📚', label: 'Modul Belajar',        sub: 'Cek progressmu',      path: '/modul',          color: 'var(--amber)'  },
  ];

  return (
    <div>
      {/* Onboarding — member baru belum isi profiling */}
      {!hasProfile && !onboardDismissed && (
        <div style={{
          marginBottom: 20, borderRadius: 16, overflow: 'hidden',
          border: '1px solid rgba(155,143,255,0.3)',
          background: 'linear-gradient(135deg, var(--surface) 0%, var(--purple-light) 100%)',
        }}>
          {/* Header */}
          <div style={{ padding: '18px 20px 14px', borderBottom: '1px solid rgba(155,143,255,0.15)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 48, height: 48, borderRadius: 14, flexShrink: 0,
                background: 'var(--purple-light)', border: '2px solid rgba(155,143,255,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24,
              }}>👋</div>
              <div>
                <div style={{ fontWeight: 800, fontSize: 16 }}>
                  Selamat datang, {user?.nama?.split(' ')[0]}! 🎉
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
                  Selesaikan 3 langkah ini agar sistemmu siap digunakan.
                </div>
              </div>
              <button onClick={dismissOnboard} title="Tutup"
                style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer',
                  fontSize:16, color:'var(--text-3)', padding:4, flexShrink:0 }}>✕</button>
            </div>
          </div>
          {/* Steps */}
          <div style={{ padding: '14px 20px', display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {[
              { step: 1, icon: '👤', label: 'Isi Form Profiling', sub: 'Kenalkan dirimu ke tim', done: false, path: '/profiling', color: 'var(--purple)' },
              { step: 2, icon: '📓', label: 'Isi Jurnal Pertama', sub: 'Refleksi mingguan rutin', done: false, path: '/jurnal/isi', color: 'var(--green)' },
              { step: 3, icon: '📚', label: 'Cek Modul Belajar',  sub: 'Lihat topik divisimu',   done: false, path: '/modul',      color: 'var(--amber)' },
            ].map(s => (
              <div key={s.step} onClick={() => navigate(s.path)}
                style={{
                  flex: '1 1 160px', padding: '12px 14px', borderRadius: 12,
                  background: 'var(--surface)', border: `1px solid ${s.color}30`,
                  cursor: 'pointer', transition: 'border-color .15s, transform .15s',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = s.color; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = `${s.color}30`; e.currentTarget.style.transform = ''; }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: `${s.color}15`, fontSize: 18,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>{s.icon}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{s.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>{s.sub}</div>
                </div>
                <span style={{ fontSize: 14, color: s.color }}>→</span>
              </div>
            ))}
          </div>
          <div style={{ padding: '0 20px 14px', fontSize: 11, color: 'var(--text-3)' }}>
            Kamu bisa tutup ini kapan saja. Profiling membantu Mas Kholed memahami kekuatanmu. ✨
          </div>
        </div>
      )}

      {/* Hero card */}
      <div className="card" style={{
        marginBottom: 16, overflow: 'hidden', position: 'relative',
        background: 'var(--surface)',
        border: `1px solid ${tc.text || 'var(--border)'}30`,
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: 4,
          background: tc.text || 'var(--green)', opacity: .7,
        }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 8 }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16, flexShrink: 0,
            background: tc.bg || 'var(--green-light)',
            color: tc.text || 'var(--green)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800,
            border: `2px solid ${tc.text || 'var(--green)'}30`,
            boxShadow: `0 0 20px ${tc.text || 'var(--green)'}20`,
          }}>{inits}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 4 }}>
              {user.nama}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              {member && (
                <span style={{
                  background: dc.bg, color: dc.text,
                  padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                }}>{dc.icon} {member.divisi}</span>
              )}
              {member && (
                <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{member.level}</span>
              )}
              {rank.icon && (
                <span style={{
                  background: tc.bg, color: tc.text,
                  padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                  border: `1px solid ${tc.text}30`,
                }}>{rank.icon} {rank.label}</span>
              )}
            </div>
          </div>
          {member && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 2 }}>Bergabung</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{member.bergabung}</div>
              <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{member.lama}</div>
            </div>
          )}
        </div>
      </div>

      {/* Stats member — ring charts */}
      {member && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)' }}>📊 Metrik Performa</div>
            {scoresLoaded && !scores.fromDB && (
              <span style={{ fontSize: 10, color: 'var(--text-3)',
                background: 'var(--surface-2)', padding: '2px 8px', borderRadius: 99 }}>
                data awal · isi profiling untuk update
              </span>
            )}
            {!scoresLoaded && (
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>memuat...</span>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'space-around', flexWrap: 'wrap' }}>
            <MetricRing value={scores.skill}      max={5}  color="var(--blue)"   label="Skill Teknis"   sub={scores.fromDB ? '📊 dari profiling' : null} />
            <MetricRing value={scores.komunikasi} max={5}  color="var(--purple)" label="Komunikasi"     />
            <MetricRing value={scores.kriteria}   max={5}  color="var(--amber)"  label="Kriteria PILAR" />
            <MetricRing value={scores.kepuasan}   max={10} color="var(--green)"  label="Kepuasan Diri"  />
          </div>
        </div>
      )}

      <div className="grid-2" style={{ marginBottom: 16 }}>
        {/* Semangat & Target */}
        {member && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="card" style={{ background: 'var(--green-light)', border: '1px solid rgba(0,214,143,0.15)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)',
                textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>💪 Sumber semangat</div>
              <div style={{ fontSize: 13 }}>{member.semangat}</div>
            </div>
            <div className="card" style={{ background: 'var(--coral-light)', border: '1px solid rgba(255,107,107,0.15)' }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--coral)',
                textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>⚡ Penguras energi</div>
              <div style={{ fontSize: 13 }}>{member.energi}</div>
            </div>
            <div className="card">
              <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)',
                textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>🎯 Target 1 tahun</div>
              <div style={{ fontSize: 13, fontWeight: 500 }}>{member.target}</div>
            </div>
          </div>
        )}

        {/* Shortcut aksi */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
            textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 2 }}>Menu Cepat</div>
          {shortcuts.map(s => (
            <div key={s.path} onClick={() => navigate(s.path)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 14px', borderRadius: 12,
              background: 'var(--surface)', border: '1px solid var(--border)',
              cursor: 'pointer', transition: 'border-color .15s, transform .15s',
            }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = s.color; e.currentTarget.style.transform = 'translateX(3px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.transform = ''; }}
            >
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, background: `${s.color}15`,
              }}>{s.icon}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{s.sub}</div>
              </div>
              <div style={{ marginLeft: 'auto', color: 'var(--text-3)', fontSize: 14 }}>→</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── DASHBOARD ADMIN ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [dbStats,   setDbStats]   = useState(null);
  const [revenue,   setRevenue]   = useState([]);
  const [profiling, setProfiling] = useState([]);
  const [timDB,     setTimDB]     = useState([]);
  const [sesi1on1,  setSesi1on1]  = useState([]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    const now = new Date();
    api.getDashboard().then(r => setDbStats(r)).catch(() => {});
    api.getRevenue(now.getMonth() + 1, now.getFullYear()).then(r => setRevenue(r.data || [])).catch(() => {});
    api.getProfilingAll().then(r => setProfiling(r.data || [])).catch(() => {});
    api.getTim(false).then(r => setTimDB(r.data || [])).catch(() => {});
    api.getSesi1on1().then(r => setSesi1on1(r.data || [])).catch(() => {});
  }, [user]);

  // useMemo HARUS sebelum conditional return (Rules of Hooks)
  const secondlineTop = useMemo(() => {
    return TIM
      .filter(t => ['Rising Star','High Potential'].includes(t.tipe))
      .map(m => {
        const p = profiling.find(x => x.nama === m.nama);
        const pilarRaw = p?.tertarik_memimpin || '';
        const pilar = pilarRaw.toLowerCase().includes('ya') ? 5
                    : pilarRaw.toLowerCase().includes('berminat') ? 4
                    : pilarRaw.toLowerCase().includes('mungkin') ? 3
                    : m.kriteria;
        const tipeScore = { 'Rising Star': 40, 'High Potential': 35 }[m.tipe] || 20;
        const score = tipeScore + (m.skill*6) + (m.komunikasi*6) + (pilar*6) + (m.kepuasan*3);
        return { ...m, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [profiling]);

  if (user?.role !== 'admin') return <DashboardMember user={user} />;

  const isiMingguIni = dbStats?.jurnal?.minggu_ini ?? 0;
  const timAktif     = timDB.length > 0 ? timDB : TIM;
  const belumJurnal  = timAktif.length - isiMingguIni;
  const rising       = timAktif.filter(t => t.tipe === 'Rising Star');
  // At Risk: tampilkan alert HANYA jika belum ada sesi 1-on-1 dalam 14 hari terakhir
  const cutoff14 = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const atRisk = timAktif.filter(t => {
    if (t.tipe !== 'At Risk') return false;
    const sudah1on1 = sesi1on1.some(s =>
      s.anggota === t.nama && new Date(s.tanggal) >= cutoff14
    );
    return !sudah1on1;
  });
  const revTotal     = revenue.reduce((s, r) => s + parseFloat(r.jumlah||0), 0);
  const revTarget    = revenue.reduce((s, r) => s + parseFloat(r.target||0), 0) || STUDIO_CONFIG.targetRevenueBulanan;
  const skbPending   = parseInt((dbStats?.skb||[]).find(s => s.status === 'diajukan')?.total || 0);

  const ADMIN_LIST = timAktif.filter(t => t.divisi === 'Admin');

  return (
    <div>
      {/* Alerts dinamis */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {atRisk.map(m => (
          <div key={m.id} className="alert alert-red" style={{ flex: 1, minWidth: 220, cursor:'pointer' }}
            onClick={() => navigate('/1on1')}>
            <span>⚠️</span>
            <div><strong>{m.nama}</strong> — At Risk. Jadwalkan 1-on-1 segera.</div>
          </div>
        ))}
        {skbPending > 0 && (
          <div className="alert alert-amber" style={{ flex: 1, minWidth: 220, cursor:'pointer' }}
            onClick={() => navigate('/skb')}>
            <span>📋</span>
            <div><strong>{skbPending} SKB</strong> menunggu review kamu.</div>
          </div>
        )}
        {belumJurnal > 0 && (
          <div className="alert alert-amber" style={{ flex: 1, minWidth: 220, cursor:'pointer' }}
            onClick={() => navigate('/jurnal')}>
            <span>📓</span>
            <div><strong>{belumJurnal} anggota</strong> belum isi jurnal minggu ini.</div>
          </div>
        )}
      </div>

      {/* Metrics real-time */}
      <div className="metrics-grid">
        <div className="metric">
          <div className="metric-val">{timAktif.filter(t => t.status === 'Aktif' || t.aktif).length}</div>
          <div className="metric-lbl">Anggota aktif</div>
          <div className="metric-sub text-muted">+{timAktif.filter(t => t.status === 'Probation' || (t.level || '').toLowerCase().includes('probation')).length} probation</div>
        </div>
        <div className="metric">
          <div className="metric-val" style={{ color: belumJurnal > 0 ? 'var(--red)' : 'var(--green)' }}>
            {belumJurnal}
          </div>
          <div className="metric-lbl">Belum isi jurnal</div>
          <div className="metric-sub" style={{ color: belumJurnal > 0 ? 'var(--red)' : 'var(--green)' }}>
            {isiMingguIni}/{timAktif.length} sudah isi
          </div>
        </div>
        <div className="metric">
          <div className="metric-val text-green">{rising.length}</div>
          <div className="metric-lbl">Rising Star</div>
          <div className="metric-sub text-muted">{atRisk.length} At Risk</div>
        </div>
        <div className="metric">
          <div className="metric-val" style={{ color: revTotal >= revTarget ? 'var(--green)' : 'var(--amber)' }}>
            ${revTotal.toLocaleString()}
          </div>
          <div className="metric-lbl">Revenue bulan ini</div>
          <div className="metric-sub text-muted">target ${revTarget.toLocaleString()}</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Tim kondisi — dikelompokkan per urgency */}
        <div className="card">
          <div className="card-title">Kondisi tim saat ini</div>
          {[
            { label: '⚠️ Perlu Perhatian', tipe: ['At Risk'], border: 'var(--red)' },
            { label: '💎 Potensial Tinggi', tipe: ['High Potential'], border: 'var(--purple)' },
            { label: '🛡️ Konsisten', tipe: ['Silent Expert'], border: 'var(--amber)' },
            { label: '⭐ Top Performer', tipe: ['Rising Star'], border: 'var(--green)' },
          ].map(group => {
            const members = timAktif.filter(m => group.tipe.includes(m.tipe));
            if (!members.length) return null;
            return (
              <div key={group.label} style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)',
                  textTransform: 'uppercase', letterSpacing: '.07em', marginBottom: 6,
                  paddingLeft: 4, borderLeft: `3px solid ${group.border}`, paddingTop: 2,
                  paddingBottom: 2 }}>
                  {group.label} ({members.length})
                </div>
                {members.map(m => {
                  const tc = TIPE_COLOR[m.tipe];
                  return (
                    <div key={m.id} className="member-row" style={{ paddingLeft: 8 }}>
                      <Avatar nama={m.nama} bg={tc.bg} color={tc.text} />
                      <span className="member-name">{m.nama}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{m.divisi}</span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        <div>
          {/* Revenue Admin real-time */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-title">Revenue Admin bulan ini</div>
            {ADMIN_LIST.map(a => {
              const rev = revenue.find(r => r.nama === a.nama);
              const v = rev ? parseFloat(rev.jumlah) : 0;
              const t = rev ? parseFloat(rev.target) : 2000;
              return (
              <div key={a.id} className="progress-row">
                <div className="progress-label">{a.nama.split(' ')[0]}</div>
                <div className="progress-bar">
                  <div className="progress-fill"
                    style={{ width: `${Math.min(100, Math.round(v/t*100))}%`,
                      background: v >= t ? 'var(--green)' : 'var(--red)' }} />
                </div>
                <div className="progress-val" style={{ color: v >= t ? 'var(--green)' : 'var(--red)' }}>
                  ${v.toLocaleString()}
                </div>
              </div>
              );
            })}
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 8, textAlign: 'right' }}>
              Target total: ${revTarget.toLocaleString()} / bulan
            </div>
          </div>

          {/* Aksi prioritas dinamis */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-title">Aksi prioritas minggu ini</div>
            {[
              ...atRisk.map(m => ({ ico:'🔴', label:`1-on-1 dengan ${m.nama.split(' ')[0]} — At Risk`, sub:'Jadwalkan segera', path:'/1on1' })),
              { ico:'⭐', label:'Friday Win — apresiasi tim', sub:'Rutin tiap Jumat', path:'/friday-win' },
              ...(belumJurnal > 0 ? [{ ico:'📓', label:`${belumJurnal} anggota belum isi jurnal minggu ini`, sub:'Ingatkan sebelum Jumat', path:'/jurnal' }] : []),
              ...(skbPending > 0 ? [{ ico:'📋', label:`Review ${skbPending} SKB yang menunggu`, sub:'Segera', path:'/skb' }] : []),
            ].map((a, i) => (
              <div key={i} className="member-row" style={{ alignItems:'flex-start', padding:'7px 0',
                cursor:'pointer' }} onClick={() => navigate(a.path)}>
                <span style={{ fontSize: 16 }}>{a.ico}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{a.sub}</div>
                </div>
                <span style={{ fontSize:11, color:'var(--text-3)' }}>→</span>
              </div>
            ))}
          </div>

          {/* Kandidat Secondline — top 3 dinamis */}
          <div className="card">
            <div className="card-title">Top kandidat Secondline</div>
            {secondlineTop.map((k, i) => {
                const tc = TIPE_COLOR[k.tipe];
                return (
                  <div key={k.id} className="member-row">
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', width: 16 }}>{i+1}</div>
                    <Avatar nama={k.nama} bg={tc.bg} color={tc.text} />
                    <span className="member-name">{k.nama}</span>
                    <span style={{ fontSize:10, color:'var(--text-3)', marginRight:4 }}>Skor: {k.score}</span>
                    <span className={`tag tag-${tc.badge}`}>{k.tipe}</span>
                  </div>
                );
              })}
          </div>
        </div>
      </div>
    </div>
  );
}
