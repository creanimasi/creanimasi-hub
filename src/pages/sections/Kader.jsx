import { useState, useEffect } from 'react';
import { TIM, TIPE_COLOR } from '../../data/tim';
import { api } from '../../services/api';

// ── KADER ──────────────────────────────────────────────────────────────────
export function Kader() {
  const [profiling, setProfiling] = useState([]);
  const [sesi1on1,  setSesi1on1]  = useState([]);
  const [topik,     setTopik]     = useState([]);

  useEffect(() => {
    Promise.all([
      api.getProfilingAll(),
      api.getSesi1on1(),
      api.getModulTopik(),
    ]).then(([p, s, t]) => {
      setProfiling(p.data || []);
      setSesi1on1(s.data  || []);
      setTopik(t.data     || []);
    }).catch(() => {});
  }, []);

  // Hitung skor kader dari profiling + 1-on-1 delta + modul progress
  const kaderData = TIM.map(m => {
    const p = profiling.find(x => x.nama === m.nama);
    const pilarRaw = p?.tertarik_memimpin || '';
    const pilar = pilarRaw.toLowerCase().includes('ya') ? 5
                : pilarRaw.toLowerCase().includes('berminat') ? 4
                : pilarRaw.toLowerCase().includes('mungkin') ? 3
                : m.kriteria;

    // Bonus dari 1-on-1: rata-rata mood delta positif
    const sesiMember = sesi1on1.filter(s => s.anggota === m.nama && s.mood_sesudah && s.mood_sebelum);
    const avgDelta   = sesiMember.length > 0
      ? sesiMember.reduce((sum, s) => sum + (s.mood_sesudah - s.mood_sebelum), 0) / sesiMember.length
      : 0;
    const bonusSesi = Math.max(0, Math.min(10, Math.round(avgDelta * 2)));

    // Bonus dari modul: persentase topik selesai
    const topikMember = topik.filter(t => t.nama === m.nama && t.selesai).length;
    const bonusModul  = Math.round(topikMember / 10); // maks ~10 poin untuk 100 topik

    const tipeScore = { 'Rising Star': 40, 'High Potential': 35, 'Silent Expert': 25, 'At Risk': 10 }[m.tipe] || 20;
    const score = tipeScore + (m.skill*6) + (m.komunikasi*6) + (pilar*6) + (m.kepuasan*3) + bonusSesi + bonusModul;

    return { ...m, pilar, score, bonusSesi, bonusModul, hasProfiling: !!p, jumlahSesi: sesiMember.length };
  }).sort((a, b) => b.score - a.score);

  const candidates = kaderData.filter(m => ['Rising Star','High Potential'].includes(m.tipe));
  const byTipe = (t) => TIM.filter(m => m.tipe === t).length;

  return (
    <div>
      <div className="metrics-grid" style={{ marginBottom:16 }}>
        <div className="metric"><div className="metric-val text-green">{byTipe('Rising Star')}</div><div className="metric-lbl">Rising Star</div></div>
        <div className="metric"><div className="metric-val" style={{color:'var(--purple)'}}>{byTipe('High Potential')}</div><div className="metric-lbl">High Potential</div></div>
        <div className="metric"><div className="metric-val text-amber">{byTipe('Silent Expert')}</div><div className="metric-lbl">Silent Expert</div></div>
        <div className="metric"><div className="metric-val text-red">{byTipe('At Risk')}</div><div className="metric-lbl">At Risk</div></div>
      </div>

      {/* Kandidat Secondline — dihitung dinamis */}
      <div className="card" style={{ marginBottom:12 }}>
        <div className="card-title">
          Kandidat Secondline — urutan skor kesiapan
          <span style={{ fontSize:10, color:'var(--text-3)', fontWeight:400, marginLeft:8 }}>
            dihitung dari tipe + skill + komunikasi + pilar + kepuasan
          </span>
        </div>
        {candidates.map((k, i) => {
          const tc = TIPE_COLOR[k.tipe] || {};
          const inits = k.nama.split(' ').slice(0,2).map(w=>w[0]).join('');
          const pct = Math.round(k.score / 100 * 100);
          return (
            <div key={k.id} className="member-row" style={{ padding:'8px 0', alignItems:'center' }}>
              <div style={{ width:20, fontSize:11, fontWeight:700, color:'var(--text-3)' }}>#{i+1}</div>
              <div className="avatar" style={{ width:30, height:30, background:tc.bg, color:tc.text, fontSize:11 }}>{inits}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:12, fontWeight:700 }}>{k.nama}</div>
                <div style={{ fontSize:10, color:'var(--text-2)' }}>{k.divisi} · {k.level}</div>
              </div>
              {/* Skor bar */}
              <div style={{ width:100 }}>
                <div style={{ height:5, background:'var(--border)', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${Math.min(100, pct)}%`,
                    background: tc.text||'var(--green)', borderRadius:99 }} />
                </div>
              </div>
              <div style={{ fontSize:11, fontWeight:700, color:tc.text||'var(--green)', width:34, textAlign:'right' }}>
                {k.score}
              </div>
              <span className={`tag tag-${tc.badge||'rs'}`}>{k.tipe}</span>
              {!k.hasProfiling && (
                <span style={{ fontSize:9, color:'var(--text-3)', marginLeft:4 }}>⚠ no profil</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Semua anggota */}
      <div className="card">
        <div className="card-title">Semua anggota — tipe & skor</div>
        {kaderData.map(m => {
          const tc = TIPE_COLOR[m.tipe] || {};
          const inits = m.nama.split(' ').slice(0,2).map(w=>w[0]).join('');
          return (
            <div key={m.id} className="member-row">
              <div className="avatar" style={{ width:26, height:26, background:tc.bg, color:tc.text, fontSize:10 }}>{inits}</div>
              <span className="member-name" style={{ fontSize:12 }}>{m.nama}</span>
              <span style={{ fontSize:11, color:'var(--text-2)', marginRight:6 }}>{m.divisi}</span>
              <div style={{ textAlign:'right', marginRight:6 }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-2)' }}>Skor: {m.score}</div>
                {(m.bonusSesi > 0 || m.bonusModul > 0) && (
                  <div style={{ fontSize:9, color:'var(--green)' }}>
                    {m.bonusSesi > 0 && `+${m.bonusSesi} sesi`}{m.bonusSesi > 0 && m.bonusModul > 0 && ' · '}{m.bonusModul > 0 && `+${m.bonusModul} modul`}
                  </div>
                )}
              </div>
              <span className={`tag tag-${tc.badge}`}>{m.tipe}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

