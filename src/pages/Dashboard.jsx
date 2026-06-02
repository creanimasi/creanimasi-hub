import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { TIM, TIPE_COLOR, DIVISI_COLOR } from '../data/tim';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';

// Normalisasi kolom skor dari berbagai tabel profiling ke format standar
function extractScores(p, fallback) {
  if (!p) return fallback;
  const skill = p.skill_copywriting ?? p.skill_komunikasi ?? p.skill_level_csp ?? p.skill_level_live2d ?? p.skill_level_blender ?? fallback.skill;
  const kom   = p.skor_komunikasi   ?? p.skill_komunikasi ?? fallback.komunikasi;
  const kibo  = p.skor_kerja_tim    ?? fallback.kriteria;
  const puas  = p.kepuasan_diri     ?? fallback.kepuasan;
  return { skill, komunikasi: kom, kriteria: kibo, kepuasan: puas, fromDB: true };
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

  const fallbackScores = { skill: member?.skill, komunikasi: member?.komunikasi, kriteria: member?.kriteria, kepuasan: member?.kepuasan };
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
      {/* Onboarding banner */}
      {!hasProfile && !onboardDismissed && (
        <div style={{
          marginBottom: 16, padding: '14px 16px', borderRadius: 12,
          background: 'linear-gradient(135deg, var(--purple-light), var(--green-light))',
          border: '1px solid rgba(155,143,255,0.25)',
          display: 'flex', alignItems: 'center', gap: 14,
        }}>
          <span style={{ fontSize: 28, flexShrink: 0 }}>👋</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 3 }}>
              Selamat datang, {user?.nama?.split(' ')[0]}!
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)' }}>
              Lengkapi <strong>Form Profiling</strong> agar Mas Kholed bisa memahami kekuatanmu dan mendukung perkembanganmu di Creanimasi.
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
            <button className="btn btn-primary" style={{ fontSize: 11 }}
              onClick={() => navigate('/profiling')}>Isi Profiling →</button>
            <button className="btn" style={{ fontSize: 11 }}
              onClick={dismissOnboard}>Nanti dulu</button>
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

      {/* Stats member */}
      {member && (
        <div className="metrics-grid" style={{ marginBottom: 16 }}>
          {[
            { label: 'Skill Teknis',  val: scores.skill,      max: 5,  color: 'var(--blue)'   },
            { label: 'Komunikasi',    val: scores.komunikasi,  max: 5,  color: 'var(--purple)' },
            { label: 'Kerja Tim',     val: scores.kriteria,    max: 5,  color: 'var(--amber)'  },
            { label: 'Kepuasan Diri', val: scores.kepuasan,   max: 10, color: 'var(--green)'  },
          ].map(s => (
            <div key={s.label} className="metric">
              <div className="metric-val" style={{ color: s.color, fontSize: 22 }}>
                {s.val ?? '—'}{s.val != null ? `/${s.max}` : ''}
              </div>
              <div className="metric-lbl">{s.label}</div>
              {!scoresLoaded && <div className="metric-sub" style={{ color:'var(--text-3)', fontSize:9 }}>Memuat...</div>}
              {scoresLoaded && !scores.fromDB && <div className="metric-sub" style={{ color:'var(--text-3)', fontSize:9 }}>data awal</div>}
            </div>
          ))}
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
  const [dbStats, setDbStats] = useState(null);
  const [revenue, setRevenue] = useState([]);

  useEffect(() => {
    if (user?.role !== 'admin') return;
    const now = new Date();
    api.getDashboard().then(r => setDbStats(r)).catch(() => {});
    api.getRevenue(now.getMonth() + 1, now.getFullYear()).then(r => setRevenue(r.data || [])).catch(() => {});
  }, [user]);

  if (user?.role !== 'admin') return <DashboardMember user={user} />;

  const isiMingguIni = dbStats?.jurnal?.minggu_ini ?? 0;
  const belumJurnal  = TIM.length - isiMingguIni;
  const rising       = TIM.filter(t => t.tipe === 'Rising Star');
  const atRisk       = TIM.filter(t => t.tipe === 'At Risk');
  const revTotal     = revenue.reduce((s, r) => s + parseFloat(r.jumlah||0), 0);
  const revTarget    = revenue.reduce((s, r) => s + parseFloat(r.target||0), 0) || 5000;
  const skbPending   = parseInt((dbStats?.skb||[]).find(s => s.status === 'diajukan')?.total || 0);

  const ADMIN_LIST = TIM.filter(t => t.divisi === 'Admin');

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
          <div className="metric-val">{TIM.filter(t => t.status === 'Aktif').length}</div>
          <div className="metric-lbl">Anggota aktif</div>
          <div className="metric-sub text-muted">+{TIM.filter(t => t.status === 'Probation').length} probation</div>
        </div>
        <div className="metric">
          <div className="metric-val" style={{ color: belumJurnal > 0 ? 'var(--red)' : 'var(--green)' }}>
            {belumJurnal}
          </div>
          <div className="metric-lbl">Belum isi jurnal</div>
          <div className="metric-sub" style={{ color: belumJurnal > 0 ? 'var(--red)' : 'var(--green)' }}>
            {isiMingguIni}/{TIM.length} sudah isi
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
        {/* Tim kondisi */}
        <div className="card">
          <div className="card-title">Kondisi tim saat ini</div>
          {TIM.map(m => {
            const tc = TIPE_COLOR[m.tipe];
            return (
              <div key={m.id} className="member-row">
                <Avatar nama={m.nama} bg={tc.bg} color={tc.text} />
                <span className="member-name">{m.nama}</span>
                <span style={{ fontSize: 11, color: 'var(--text-2)', marginRight: 6 }}>{m.divisi}</span>
                <span className={`tag tag-${tc.badge}`}>{m.tipe}</span>
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
              { ico:'⭐', label:'Friday Win — apresiasi tim', sub:'Jumat ini', path:'/friday-win' },
              { ico:'🎉', label:'Jadwalkan gathering / BBQ', sub:'Bulan ini', path:'/1on1' },
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
            {TIM.filter(t => ['Rising Star','High Potential'].includes(t.tipe))
              .sort((a,b) => (b.skill+b.komunikasi+b.kriteria) - (a.skill+a.komunikasi+a.kriteria))
              .slice(0,3)
              .map((k, i) => {
                const tc = TIPE_COLOR[k.tipe];
                return (
                  <div key={k.id} className="member-row">
                    <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', width: 16 }}>{i+1}</div>
                    <Avatar nama={k.nama} bg={tc.bg} color={tc.text} />
                    <span className="member-name">{k.nama}</span>
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
