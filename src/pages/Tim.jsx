import { useState, useEffect, useContext } from 'react';
import { TIM, TIPE_COLOR, DIVISI_COLOR } from '../data/tim';
import { PresenceContext } from '../components/Layout';

const RANK_CFG = {
  'Rising Star':    { icon: '⭐', color: 'var(--green)',  bg: 'var(--green-light)'  },
  'High Potential': { icon: '💎', color: 'var(--purple)', bg: 'var(--purple-light)' },
  'Silent Expert':  { icon: '🛡️', color: 'var(--amber)',  bg: 'var(--amber-light)'  },
  'At Risk':        { icon: '⚠️', color: 'var(--coral)',  bg: 'var(--coral-light)'  },
};

function calcScore(m) {
  return Math.round(((m.skill + m.komunikasi + m.kriteria) / 15 + m.kepuasan / 10) / 2 * 100);
}

function scoreColor(s) {
  return s >= 75 ? 'var(--green)' : s >= 55 ? 'var(--amber)' : 'var(--red)';
}

// ── STAT BAR ─────────────────────────────────────────────────────────────────
function StatBar({ label, value, max, showAvg, avg }) {
  const pct     = (value / max) * 100;
  const avgPct  = avg ? (avg / max) * 100 : null;
  const above   = avg != null ? value >= avg : null;
  const barColor = pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--blue)' : pct >= 40 ? 'var(--amber)' : 'var(--red)';

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: 12 }}>
        <span style={{ color: 'var(--text-2)', fontWeight: 500 }}>{label}</span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {above != null && (
            <span style={{ fontSize: 10, color: above ? 'var(--green)' : 'var(--amber)', fontWeight: 600 }}>
              {above ? '▲' : '▼'} {above ? '+' : ''}{(value - avg).toFixed(1)}
            </span>
          )}
          <span style={{ fontWeight: 700, color: barColor }}>
            {value}<span style={{ color: 'var(--text-3)', fontWeight: 400, fontSize: 11 }}>/{max}</span>
          </span>
        </div>
      </div>
      <div style={{ height: 8, background: 'var(--surface-2)', borderRadius: 99, overflow: 'visible',
        border: '1px solid var(--border)', position: 'relative' }}>
        <div style={{
          height: '100%', width: `${pct}%`, borderRadius: 99,
          background: barColor,
          transition: 'width .7s cubic-bezier(.4,0,.2,1)',
          boxShadow: `0 0 8px ${barColor}50`,
        }} />
        {showAvg && avgPct != null && (
          <div style={{
            position: 'absolute', top: -3, left: `${avgPct}%`,
            width: 2, height: 14, background: 'var(--text-3)',
            borderRadius: 1, transform: 'translateX(-50%)',
          }} />
        )}
      </div>
    </div>
  );
}

// ── MINI CARD ─────────────────────────────────────────────────────────────────
function MiniCard({ m, onClick }) {
  const tc     = TIPE_COLOR[m.tipe]     || { bg: 'var(--surface-2)', text: 'var(--text-2)' };
  const dc     = DIVISI_COLOR[m.divisi] || { bg: 'var(--surface-2)', text: 'var(--text-2)', icon: '👤' };
  const rank   = RANK_CFG[m.tipe] || { icon: '👤', color: 'var(--text-2)', bg: 'var(--surface-2)' };
  const score  = calcScore(m);
  const inits  = m.nama.split(' ').slice(0, 2).map(w => w[0]).join('');
  const { isOnline } = useContext(PresenceContext);
  const online = isOnline(m.nama);

  return (
    <div onClick={onClick} style={{
      background: 'var(--surface)',
      border: '1px solid var(--border)',
      borderRadius: 14,
      overflow: 'hidden',
      cursor: 'pointer',
      transition: 'transform .15s, box-shadow .15s, border-color .15s',
    }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 20px rgba(0,0,0,.1)'; e.currentTarget.style.borderColor = tc.text; }}
      onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'var(--border)'; }}
    >
      {/* Top accent bar */}
      <div style={{ height: 4, background: tc.text, opacity: .6 }} />

      <div style={{ padding: '14px 14px 12px' }}>
        {/* Avatar row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12 }}>
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div style={{
              width: 46, height: 46, borderRadius: 12,
              background: tc.bg, color: tc.text,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 16, fontWeight: 700,
              border: `2px solid ${tc.text}25`,
            }}>{inits}</div>
            <div style={{
              position: 'absolute', bottom: -4, right: -4,
              width: 17, height: 17, borderRadius: 5,
              background: dc.bg, color: dc.text,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, border: '2px solid var(--surface)',
            }}>{dc.icon}</div>
            {/* Online indicator */}
            <div style={{
              position: 'absolute', top: -3, left: -3,
              width: 12, height: 12, borderRadius: '50%',
              background: online ? '#00D68F' : '#555',
              border: '2px solid var(--bg, #080C14)',
              boxShadow: online ? '0 0 7px #00D68F' : 'none',
              transition: 'background .4s, box-shadow .4s',
              zIndex: 1,
            }} title={online ? 'Sedang online' : 'Offline'} />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2, lineHeight: 1.2 }}>
              {m.nama}
              {online && <span style={{ marginLeft: 5, fontSize: 9, color: 'var(--green)',
                fontWeight: 400, verticalAlign: 'middle' }}>● online</span>}
            </div>
            <div style={{ fontSize: 10, color: 'var(--text-2)' }}>{m.divisi} · {m.level}</div>
          </div>
          <div style={{ textAlign: 'center', flexShrink: 0 }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: scoreColor(score), lineHeight: 1 }}>{score}</div>
            <div style={{ fontSize: 8, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.05em' }}>skor</div>
          </div>
        </div>

        {/* Rank badge */}
        <div style={{ marginBottom: 10 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            padding: '2px 9px', borderRadius: 99,
            background: rank.bg, color: rank.color,
            fontSize: 10, fontWeight: 700,
          }}>{rank.icon} {m.tipe}</span>
        </div>

        {/* Mini stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 4 }}>
          {[
            { l: 'SKL', v: m.skill,       max: 5  },
            { l: 'KOM', v: m.komunikasi,  max: 5  },
            { l: 'PIL', v: m.kriteria,    max: 5  },
            { l: 'PUA', v: m.kepuasan,    max: 10 },
          ].map(s => {
            const pct = (s.v / s.max) * 100;
            const c   = pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--blue)' : pct >= 40 ? 'var(--amber)' : 'var(--red)';
            return (
              <div key={s.l} style={{ textAlign: 'center', background: 'var(--surface-2)',
                borderRadius: 8, padding: '5px 4px', border: '1px solid var(--border)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: c }}>{s.v}</div>
                <div style={{ fontSize: 8, color: 'var(--text-3)', marginTop: 1 }}>{s.l}</div>
              </div>
            );
          })}
        </div>

        {/* Bottom hint */}
        <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-3)', textAlign: 'center' }}>
          Klik untuk detail lengkap →
        </div>
      </div>
    </div>
  );
}

// ── POPUP MODAL ───────────────────────────────────────────────────────────────
function CharacterModal({ m, onClose }) {
  const tc    = TIPE_COLOR[m.tipe]     || { bg: 'var(--surface-2)', text: 'var(--text-2)' };
  const dc    = DIVISI_COLOR[m.divisi] || { bg: 'var(--surface-2)', text: 'var(--text-2)', icon: '👤' };
  const rank  = RANK_CFG[m.tipe]       || { icon: '👤', color: 'var(--text-2)', bg: 'var(--surface-2)' };
  const score = calcScore(m);
  const inits = m.nama.split(' ').slice(0, 2).map(w => w[0]).join('');

  const avg = (key) => TIM.reduce((s, t) => s + (t[key] || 0), 0) / TIM.length;
  const AVG = {
    skill:      Math.round(avg('skill')      * 10) / 10,
    komunikasi: Math.round(avg('komunikasi') * 10) / 10,
    kriteria:   Math.round(avg('kriteria')   * 10) / 10,
    kepuasan:   Math.round(avg('kepuasan')   * 10) / 10,
  };

  // Tutup dengan Escape
  useEffect(() => {
    const handler = e => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      onClick={e => e.target === e.currentTarget && onClose()}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000,
        background: 'rgba(0,0,0,0.55)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
        backdropFilter: 'blur(3px)',
        animation: 'fadeInOverlay .15s ease',
      }}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: 20,
        width: '100%', maxWidth: 560,
        maxHeight: '90vh',
        overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        boxShadow: '0 24px 80px rgba(0,0,0,.3)',
        animation: 'popIn .2s cubic-bezier(.34,1.56,.64,1)',
      }}>

        {/* Header hero */}
        <div style={{
          background: tc.bg,
          padding: '20px 20px 16px',
          borderBottom: '1px solid var(--border)',
          position: 'relative',
          flexShrink: 0,
        }}>
          {/* Tutup */}
          <button onClick={onClose} style={{
            position: 'absolute', top: 14, right: 14,
            width: 30, height: 30, borderRadius: 8,
            border: '1px solid var(--border-2)', background: 'var(--surface)',
            cursor: 'pointer', fontSize: 14, display: 'flex',
            alignItems: 'center', justifyContent: 'center', color: 'var(--text-2)',
          }}>✕</button>

          <div style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
            {/* Avatar besar */}
            <div style={{
              width: 68, height: 68, borderRadius: 18,
              background: 'var(--surface)', color: tc.text,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 24, fontWeight: 800,
              border: `3px solid ${tc.text}40`,
              boxShadow: `0 4px 16px ${tc.text}30`,
              flexShrink: 0,
            }}>{inits}</div>

            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 18, fontWeight: 800, color: tc.text, marginBottom: 4 }}>{m.nama}</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                <span style={{
                  background: dc.bg, color: dc.text,
                  padding: '2px 8px', borderRadius: 99, fontSize: 11, fontWeight: 600,
                }}>{dc.icon} {m.divisi}</span>
                <span style={{ fontSize: 11, color: tc.text, fontWeight: 500 }}>{m.level}</span>
                <span className={`tag tag-${m.status === 'Aktif' ? 'aktif' : 'probation'}`}
                  style={{ fontSize: 10 }}>{m.status}</span>
              </div>
              <div style={{ marginTop: 8 }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 4,
                  padding: '3px 10px', borderRadius: 99,
                  background: 'var(--surface)', color: rank.color,
                  fontSize: 11, fontWeight: 700,
                  border: `1px solid ${rank.color}40`,
                }}>{rank.icon} {m.tipe}</span>
              </div>
            </div>

            {/* Score circle */}
            <div style={{
              width: 60, height: 60, borderRadius: '50%',
              border: `3px solid ${scoreColor(score)}`,
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
              background: 'var(--surface)',
              boxShadow: `0 0 16px ${scoreColor(score)}40`,
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: scoreColor(score), lineHeight: 1 }}>{score}</div>
              <div style={{ fontSize: 8, color: 'var(--text-3)', textTransform: 'uppercase' }}>score</div>
            </div>
          </div>

          {/* Info bar */}
          <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 11, color: tc.text, opacity: .8 }}>
            <span>📅 Bergabung {m.bergabung}</span>
            <span>⏱ {m.lama}</span>
            {m.mentor !== '-' && <span>🧑‍🏫 Mentor: {m.mentor}</span>}
          </div>
        </div>

        {/* Scrollable body */}
        <div style={{ overflow: 'auto', padding: '18px 20px 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Stats dengan perbandingan */}
          <div>
            <SectionTitle>📊 Stats vs Rata-rata Tim</SectionTitle>
            <div style={{ padding: '12px 14px', background: 'var(--surface-2)',
              borderRadius: 12, border: '1px solid var(--border)' }}>
              <StatBar label="Skill Teknis"  value={m.skill}      max={5}  showAvg avg={AVG.skill}      />
              <StatBar label="Komunikasi"    value={m.komunikasi} max={5}  showAvg avg={AVG.komunikasi} />
              <StatBar label="Kriteria PILAR" value={m.kriteria}   max={5}  showAvg avg={AVG.kriteria}   />
              <StatBar label="Kepuasan Diri" value={m.kepuasan}   max={10} showAvg avg={AVG.kepuasan}   />
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 6 }}>
                Garis abu-abu = rata-rata tim · ▲/▼ = selisih dari rata-rata
              </div>
            </div>
          </div>

          {/* Kekuatan & Kelemahan */}
          <div>
            <SectionTitle>⚔️ Kekuatan & Kelemahan</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ background: 'var(--green-light)', borderRadius: 12, padding: '12px 14px',
                border: '1px solid var(--green)20' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--green)',
                  textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>💪 Sumber Semangat</div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{m.semangat}</div>
              </div>
              <div style={{ background: 'var(--coral-light)', borderRadius: 12, padding: '12px 14px',
                border: '1px solid var(--coral)20' }}>
                <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--coral)',
                  textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 6 }}>⚡ Penguras Energi</div>
                <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>{m.energi}</div>
              </div>
            </div>
          </div>

          {/* Target & Ambisi */}
          <div>
            <SectionTitle>🎯 Target & Ambisi</SectionTitle>
            <div style={{ background: 'var(--surface-2)', borderRadius: 12, padding: '12px 14px',
              border: '1px solid var(--border)' }}>
              <div style={{ fontSize: 13, color: 'var(--text)', lineHeight: 1.6, marginBottom: 10 }}>
                <span style={{ color: 'var(--text-2)', fontSize: 11 }}>Target 1 tahun: </span>
                <strong>{m.target}</strong>
              </div>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <InfoChip label="Minat memimpin" value={m.memimpin}
                  color={m.memimpin.includes('sangat') ? 'var(--green)' : m.memimpin.includes('Mungkin') ? 'var(--amber)' : 'var(--text-2)'} />
                <InfoChip label="Status" value={m.status}
                  color={m.status === 'Aktif' ? 'var(--green)' : 'var(--amber)'} />
              </div>
            </div>
          </div>

          {/* Skor breakdown */}
          <div>
            <SectionTitle>🏅 Skor Detail</SectionTitle>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
              {[
                { l: 'Skill',      v: m.skill,      max: 5,  icon: '⚙️' },
                { l: 'Komunikasi', v: m.komunikasi, max: 5,  icon: '💬' },
                { l: 'Kriteria',   v: m.kriteria,   max: 5,  icon: '📋' },
                { l: 'Kepuasan',   v: m.kepuasan,   max: 10, icon: '😊' },
              ].map(s => {
                const pct = (s.v / s.max) * 100;
                const c   = pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--blue)' : pct >= 40 ? 'var(--amber)' : 'var(--red)';
                return (
                  <div key={s.l} style={{ textAlign: 'center', background: 'var(--surface-2)',
                    borderRadius: 10, padding: '10px 6px', border: '1px solid var(--border)' }}>
                    <div style={{ fontSize: 18 }}>{s.icon}</div>
                    <div style={{ fontSize: 20, fontWeight: 800, color: c, lineHeight: 1.2 }}>{s.v}</div>
                    <div style={{ fontSize: 9, color: 'var(--text-3)' }}>/{s.max}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 3 }}>{s.l}</div>
                  </div>
                );
              })}
            </div>
          </div>

        </div>
      </div>

      <style>{`
        @keyframes fadeInOverlay { from { opacity:0 } to { opacity:1 } }
        @keyframes popIn { from { opacity:0; transform:scale(.92) translateY(10px) } to { opacity:1; transform:scale(1) translateY(0) } }
      `}</style>
    </div>
  );
}

function SectionTitle({ children }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)',
      textTransform: 'uppercase', letterSpacing: '.05em', marginBottom: 8 }}>
      {children}
    </div>
  );
}

function InfoChip({ label, value, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '5px 10px', fontSize: 11 }}>
      <span style={{ color: 'var(--text-2)' }}>{label}: </span>
      <span style={{ fontWeight: 600, color }}>{value}</span>
    </div>
  );
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function Tim() {
  const [filter,   setFilter]   = useState('Semua');
  const [search,   setSearch]   = useState('');
  const [tipeFilter, setTipe]   = useState('Semua');
  const [selected, setSelected] = useState(null);

  const divisis   = ['Semua', 'Admin', 'PM', 'Rigger', 'Illustrator', '3D Modeler'];
  const tipes     = ['Semua', 'Rising Star', 'High Potential', 'Silent Expert', 'At Risk'];

  const filtered = TIM.filter(t => {
    const matchDiv  = filter === 'Semua' || t.divisi === filter;
    const matchTipe = tipeFilter === 'Semua' || t.tipe === tipeFilter;
    const q         = search.toLowerCase();
    const matchQ    = !q || t.nama.toLowerCase().includes(q) || t.divisi.toLowerCase().includes(q) || t.tipe.toLowerCase().includes(q);
    return matchDiv && matchTipe && matchQ;
  });

  return (
    <div>
      {/* Summary metrics */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {[
          { label: 'Total Tim',      val: TIM.length,                                                color: 'var(--text)'   },
          { label: 'Rising Star',    val: TIM.filter(t => t.tipe === 'Rising Star').length,          color: 'var(--green)'  },
          { label: 'High Potential', val: TIM.filter(t => t.tipe === 'High Potential').length,       color: 'var(--purple)' },
          { label: 'Silent Expert',  val: TIM.filter(t => t.tipe === 'Silent Expert').length,        color: 'var(--amber)'  },
          { label: 'At Risk',        val: TIM.filter(t => t.tipe === 'At Risk').length,              color: 'var(--red)'    },
          { label: 'Avg Score',      val: Math.round(TIM.reduce((s,m) => s + calcScore(m), 0) / TIM.length), color: 'var(--blue)' },
        ].map(s => (
          <div key={s.label} className="metric" style={{ flex: 1, minWidth: 72, padding: '10px 12px' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</div>
            <div style={{ fontSize: 10, color: 'var(--text-2)', marginTop: 1 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Search bar */}
      <div style={{ position: 'relative', marginBottom: 12 }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)',
          fontSize: 14, color: 'var(--text-3)', pointerEvents: 'none' }}>🔍</span>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama, divisi, atau tipe..."
          style={{ paddingLeft: 36, fontSize: 13 }}
        />
        {search && (
          <button onClick={() => setSearch('')}
            style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer', fontSize: 14,
              color: 'var(--text-3)', padding: 4 }}>✕</button>
        )}
      </div>

      {/* Filter divisi tabs */}
      <div className="tabs" style={{ marginBottom: 8 }}>
        {divisis.map(d => (
          <div key={d} className={`tab ${filter === d ? 'active' : ''}`}
            onClick={() => setFilter(d)}>
            {d} <span style={{ fontSize: 10, opacity: .7 }}>
              ({d === 'Semua' ? TIM.length : TIM.filter(t => t.divisi === d).length})
            </span>
          </div>
        ))}
      </div>

      {/* Filter tipe */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {tipes.map(t => {
          const cfg = { 'Rising Star':'var(--green)', 'High Potential':'var(--purple)', 'Silent Expert':'var(--amber)', 'At Risk':'var(--red)' };
          const c = cfg[t] || 'var(--text-2)';
          return (
            <button key={t} onClick={() => setTipe(t)}
              style={{ padding: '4px 12px', borderRadius: 99, fontSize: 11, cursor: 'pointer',
                border: `1px solid ${tipeFilter === t ? c : 'var(--border-2)'}`,
                background: tipeFilter === t ? `${c}18` : 'var(--surface)',
                color: tipeFilter === t ? c : 'var(--text-2)', fontWeight: tipeFilter === t ? 700 : 400 }}>
              {t}
            </button>
          );
        })}
      </div>

      {/* Hasil & grid */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-2)' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
          <div style={{ fontSize: 13 }}>Tidak ada anggota yang cocok dengan filter ini.</div>
          <button onClick={() => { setSearch(''); setFilter('Semua'); setTipe('Semua'); }}
            className="btn" style={{ marginTop: 12, fontSize: 12 }}>Reset filter</button>
        </div>
      ) : (
        <>
          {(search || filter !== 'Semua' || tipeFilter !== 'Semua') && (
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 10 }}>
              Menampilkan {filtered.length} dari {TIM.length} anggota
            </div>
          )}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
            {filtered.map(m => (
              <MiniCard key={m.id} m={m} onClick={() => setSelected(m)} />
            ))}
          </div>
        </>
      )}

      {selected && <CharacterModal m={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
