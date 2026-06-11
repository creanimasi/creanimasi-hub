import { useState, useEffect, useCallback } from 'react';
import { MODUL_LIST, TIPE_COLOR, DIVISI_COLOR } from '../../data/tim';
import { DIVISI_TO_MODUL_ID } from '../../data/constants';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useTim } from '../../hooks/useTim';

const DIVISI_TO_MODUL = DIVISI_TO_MODUL_ID;

// ── MODUL ──────────────────────────────────────────────────────────────────
export function Modul() {
  const { user }    = useAuth();
  const tim         = useTim();
  const isAdmin     = user?.role === 'admin';
  const [topik,     setTopik]    = useState([]);
  const [topikNama, setTopikNama]= useState({}); // { 'modulId|idx': 'nama custom' }
  const [loading,   setLoading]  = useState(true);
  const [saving,    setSaving]   = useState({});
  const [editNama,  setEditNama] = useState(null);  // 'modulId|idx' yang sedang diedit
  const [editVal,   setEditVal]  = useState('');
  const [expanded,  setExpanded] = useState(null);
  const [memberExp, setMemberExp]= useState(null);
  const [error,     setError]    = useState('');

  const load = useCallback(async () => {
    try {
      const [topikRes, namaRes] = await Promise.all([
        api.getModulTopik(isAdmin ? undefined : user?.nama),
        api.getModulTopikNama(),
      ]);
      setTopik(topikRes.data || []);
      // Buat lookup { 'modulId|idx': 'nama' }
      const namaMap = {};
      (namaRes.data || []).forEach(r => { namaMap[`${r.modul_id}|${r.topik_idx}`] = r.nama; });
      setTopikNama(namaMap);
    } catch (err) {
      setError(err.message || 'Gagal memuat modul');
    } finally { setLoading(false); }
  }, [isAdmin, user?.nama]);

  const saveNama = async (modulId, idx) => {
    const key  = `${modulId}|${idx}`;
    const nama = editVal.trim();
    if (!nama) { setEditNama(null); return; }
    try {
      await api.updateModulTopikNama(modulId, idx, nama);
      setTopikNama(prev => ({ ...prev, [key]: nama }));
    } catch (err) {
      setError(err.message || 'Gagal menyimpan nama topik');
    }
    setEditNama(null);
  };

  // Ambil nama topik (custom dari DB atau default dari tim.js)
  const getNamaTopic = (modulId, idx, defaultNama) =>
    topikNama[`${modulId}|${idx}`] || defaultNama;

  useEffect(() => { load(); }, [load]);

  const isSelesai = (nama, modulId, idx) =>
    !!(topik.find(t => t.nama === nama && t.modul_id === modulId && t.topik_idx === idx)?.selesai);

  const toggleTopik = async (nama, modulId, idx, curr) => {
    const key = `${nama}|${modulId}|${idx}`;
    setSaving(s => ({ ...s, [key]: true }));
    const next = !curr;
    setTopik(prev => {
      const ex = prev.find(t => t.nama === nama && t.modul_id === modulId && t.topik_idx === idx);
      if (ex) return prev.map(t => t.nama===nama&&t.modul_id===modulId&&t.topik_idx===idx ? {...t, selesai:next} : t);
      return [...prev, { nama, modul_id: modulId, topik_idx: idx, selesai: next }];
    });
    try { await api.updateModulTopik(nama, modulId, idx, next); }
    catch { load(); }
    finally { setSaving(s => { const n={...s}; delete n[key]; return n; }); }
  };

  // Hitung done per anggota per modul dari topik
  const getDone = (nama, modulId, total) =>
    topik.filter(t => t.nama === nama && t.modul_id === modulId && t.selesai).length;

  // Anggota yang perlu ditampilkan per modul
  const getAnggota = (modulId) => {
    const divisiId = Object.entries(DIVISI_TO_MODUL).find(([,v]) => v === modulId)?.[0];
    return isAdmin
      ? tim.filter(t => {
          if (modulId === 'secondline') return ['Rising Star','High Potential'].includes(t.tipe);
          return t.divisi === divisiId;
        })
      : tim.filter(t => t.nama === user?.nama);
  };

  const memberModulId = !isAdmin && user
    ? DIVISI_TO_MODUL[tim.find(t => t.nama === user.nama)?.divisi]
    : null;

  const visibleModul = isAdmin
    ? MODUL_LIST
    : MODUL_LIST.filter(m => m.id === memberModulId || m.id === 'secondline');

  // Grand total dari topik
  const grandDone = visibleModul.reduce((s, m) => {
    const anggota = getAnggota(m.id);
    return s + anggota.reduce((ss, a) => ss + getDone(a.nama, m.id, m.jumlah), 0);
  }, 0);
  const grandMax = visibleModul.reduce((s, m) => s + getAnggota(m.id).length * m.jumlah, 0);
  const grandPct = grandMax > 0 ? Math.round(grandDone / grandMax * 100) : 0;

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'var(--text-2)' }}>Memuat data modul...</div>;
  if (error)   return <div className="alert alert-red"><span>⚠️</span><div>{error}</div></div>;

  return (
    <div>
      {/* Summary header */}
      <div className="card" style={{ marginBottom:16, background:'var(--surface-2)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:20, flexWrap:'wrap' }}>
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, color:'var(--text-2)', marginBottom:6 }}>
              {isAdmin ? 'Progress keseluruhan tim' : 'Progress modul kamu'}
            </div>
            <div style={{ height:10, background:'var(--border)', borderRadius:99, overflow:'hidden' }}>
              <div style={{ height:'100%', width:`${grandPct}%`, background:'var(--green)',
                borderRadius:99, transition:'width .6s', boxShadow:'0 0 8px rgba(0,214,143,.4)' }} />
            </div>
          </div>
          <div style={{ textAlign:'right', flexShrink:0 }}>
            <div style={{ fontSize:28, fontWeight:800, color:'var(--green)', lineHeight:1 }}>{grandPct}%</div>
            <div style={{ fontSize:11, color:'var(--text-2)' }}>{grandDone}/{grandMax} topik</div>
          </div>
        </div>
      </div>

      {/* Per-modul cards */}
      {visibleModul.map(m => {
        const anggota  = getAnggota(m.id);
        const isOpen   = expanded === m.id;
        const totalDone = anggota.reduce((s, a) => s + getDone(a.nama, m.id, m.jumlah), 0);
        const maxPoss   = anggota.length * m.jumlah;
        const pct       = maxPoss > 0 ? Math.round(totalDone / maxPoss * 100) : 0;

        return (
          <div key={m.id} className="card" style={{ marginBottom:10 }}>
            {/* Header modul */}
            <div style={{ display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}
              onClick={() => setExpanded(isOpen ? null : m.id)}>
              <div className="module-icon" style={{ background:m.bg, color:m.warna, fontSize:18 }}>📖</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:2 }}>{m.label}</div>
                <div style={{ fontSize:11, color:'var(--text-2)' }}>
                  {anggota.length} anggota · {m.jumlah} topik
                </div>
              </div>
              <div style={{ width:100 }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10,
                  color:'var(--text-3)', marginBottom:3 }}>
                  <span>{totalDone}/{maxPoss}</span>
                  <span style={{ color:m.warna, fontWeight:700 }}>{pct}%</span>
                </div>
                <div style={{ height:5, background:'var(--border)', borderRadius:99, overflow:'hidden' }}>
                  <div style={{ height:'100%', width:`${pct}%`, background:m.warna, borderRadius:99, transition:'width .4s' }} />
                </div>
              </div>
              <span style={{ fontSize:12, color:'var(--text-3)', flexShrink:0 }}>{isOpen?'▲':'▼'}</span>
            </div>

            {/* Per-anggota */}
            {isOpen && (
              <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--border)' }}>
                {anggota.length === 0 ? (
                  <div style={{ fontSize:12, color:'var(--text-3)', textAlign:'center', padding:'8px 0' }}>
                    Belum ada anggota untuk modul ini.
                  </div>
                ) : anggota.map(a => {
                  const tc       = TIPE_COLOR[a.tipe] || {};
                  const dc       = DIVISI_COLOR[a.divisi] || {};
                  const done     = getDone(a.nama, m.id, m.jumlah);
                  const pctMem   = Math.round(done / m.jumlah * 100);
                  const barColor = pctMem >= 80 ? 'var(--green)' : pctMem >= 50 ? 'var(--blue)' : pctMem >= 25 ? 'var(--amber)' : 'var(--red)';
                  const inits    = a.nama.split(' ').slice(0,2).map(w=>w[0]).join('');
                  const memKey   = `${a.nama}|${m.id}`;
                  const isMemOpen = memberExp === memKey;

                  return (
                    <div key={a.id} style={{ marginBottom:8 }}>
                      {/* Baris ringkasan anggota */}
                      <div style={{ display:'flex', alignItems:'center', gap:10,
                        cursor: 'pointer',
                        padding:'6px 8px', borderRadius:8,
                        background: isMemOpen ? 'var(--surface-2)' : 'transparent',
                        transition:'background .15s' }}
                        title={isAdmin ? 'Klik untuk lihat & edit topik' : 'Klik untuk lihat detail topik'}
                        onClick={() => setMemberExp(isMemOpen ? null : memKey)}>
                        <div style={{ width:30, height:30, borderRadius:8, flexShrink:0,
                          background:tc.bg||'var(--surface-2)', color:tc.text||'var(--text-2)',
                          display:'flex', alignItems:'center', justifyContent:'center',
                          fontSize:10, fontWeight:700 }}>{inits}</div>
                        <div style={{ width:120, flexShrink:0 }}>
                          <div style={{ fontSize:12, fontWeight:600 }}>{a.nama.split(' ')[0]}</div>
                          <div style={{ fontSize:9, color:dc.text||'var(--text-3)' }}>{dc.icon} {a.divisi}</div>
                        </div>
                        <div style={{ flex:1 }}>
                          <div style={{ height:6, background:'var(--border)', borderRadius:99, overflow:'hidden' }}>
                            <div style={{ height:'100%', width:`${pctMem}%`, background:barColor,
                              borderRadius:99, transition:'width .3s' }} />
                          </div>
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, color:barColor, width:44, textAlign:'right', flexShrink:0 }}>
                          {done}/{m.jumlah}
                        </span>
                        <span style={{ fontSize:10, color:'var(--text-3)', flexShrink:0 }}>{isMemOpen?'▲':'▼'}</span>
                      </div>

                      {/* Grid topik */}
                      {isMemOpen && (
                        <div style={{ padding:'10px 8px 4px', borderRadius:8,
                          background:'var(--surface-2)', marginTop:4 }}>
                          <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                            {(m.topik || Array.from({length:m.jumlah}, (_,i)=>`Topik ${i+1}`)).map((defaultNama, idx) => {
                              const displayNama = getNamaTopic(m.id, idx, defaultNama);
                              const sel   = isSelesai(a.nama, m.id, idx);
                              const bkey  = `${a.nama}|${m.id}|${idx}`;
                              const busy  = !!saving[bkey];
                              const nkey  = `${m.id}|${idx}`;
                              const isEditingThis = editNama === nkey;
                              return (
                                <div key={idx} style={{ position:'relative' }}>
                                  {isEditingThis && isAdmin ? (
                                    <input
                                      autoFocus
                                      value={editVal}
                                      onChange={e => setEditVal(e.target.value)}
                                      onBlur={() => saveNama(m.id, idx)}
                                      onKeyDown={e => { if (e.key === 'Enter') saveNama(m.id, idx); if (e.key === 'Escape') setEditNama(null); }}
                                      style={{ fontSize:11, padding:'3px 8px', borderRadius:20, width:130,
                                        border:`1px solid var(--green)`, background:'var(--surface)' }}
                                    />
                                  ) : (
                                    <button
                                      disabled={busy || (!isAdmin)}
                                      onClick={() => isAdmin && toggleTopik(a.nama, m.id, idx, sel)}
                                      onDoubleClick={() => { if (isAdmin) { setEditNama(nkey); setEditVal(displayNama); } }}
                                      title={isAdmin ? `${displayNama} — double-click untuk rename` : displayNama}
                                      style={{
                                        padding:'4px 10px', borderRadius:20, fontSize:11,
                                        border:`1px solid ${sel ? m.warna : 'var(--border-2)'}`,
                                        background: sel ? m.bg : 'var(--surface)',
                                        color: sel ? m.warna : 'var(--text-2)',
                                        fontWeight: sel ? 700 : 400,
                                        cursor: isAdmin ? (busy ? 'wait' : 'pointer') : 'default',
                                        transition:'all .15s',
                                        boxShadow: sel ? `0 0 6px ${m.warna}40` : 'none',
                                        opacity: busy ? .6 : 1,
                                        display:'flex', alignItems:'center', gap:4,
                                      }}>
                                      {sel && <span style={{ fontSize:9 }}>✓</span>}
                                      {displayNama}
                                    </button>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                          {!isAdmin && (
                            <div style={{ display:'flex', alignItems:'center', gap:6,
                              marginTop:8, padding:'6px 10px', borderRadius:8,
                              background:'var(--surface-2)', border:'1px solid var(--border)' }}>
                              <span style={{ fontSize:14 }}>ℹ️</span>
                              <div style={{ fontSize:10, color:'var(--text-3)' }}>
                                <strong style={{ color:'var(--text-2)' }}>Topik berwarna</strong> = sudah dipelajari.
                                Progress dicentang oleh koordinator setelah sesi belajar selesai.
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

