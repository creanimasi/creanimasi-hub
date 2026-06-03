import { useState, useEffect, useCallback } from 'react';
import { MODUL_LIST, WORKSHOP_JRUHUB, REWARD_LIST, TIM, TIPE_COLOR, DIVISI_COLOR } from '../data/tim';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';
import { downloadCsv } from '../utils/exportCsv';

// Mapping divisi TIM → modul_id
const DIVISI_TO_MODUL = {
  'Admin':       'admin',
  'PM':          'pm',
  'Illustrator': 'illus',
  'Rigger':      'rigger',
  '3D Modeler':  '3d',
};

// ── MODUL ──────────────────────────────────────────────────────────────────
export function Modul() {
  const { user }    = useAuth();
  const isAdmin     = user?.role === 'admin';
  const [topik,     setTopik]    = useState([]);   // modul_topik rows
  const [loading,   setLoading]  = useState(true);
  const [saving,    setSaving]   = useState({});
  const [expanded,  setExpanded] = useState(null); // modul_id expand
  const [memberExp, setMemberExp]= useState(null); // 'nama|modulId' expand

  const load = useCallback(async () => {
    try {
      const res = await api.getModulTopik(isAdmin ? undefined : user?.nama);
      setTopik(res.data || []);
    } catch {}
    finally { setLoading(false); }
  }, [isAdmin, user?.nama]);

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
      ? TIM.filter(t => {
          if (modulId === 'secondline') return ['Rising Star','High Potential'].includes(t.tipe);
          return t.divisi === divisiId;
        })
      : TIM.filter(t => t.nama === user?.nama);
  };

  const memberModulId = !isAdmin && user
    ? DIVISI_TO_MODUL[TIM.find(t => t.nama === user.nama)?.divisi]
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
                      <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer',
                        padding:'6px 8px', borderRadius:8,
                        background: isMemOpen ? 'var(--surface-2)' : 'transparent',
                        transition:'background .15s' }}
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
                            {(m.topik || Array.from({length:m.jumlah}, (_,i)=>`Topik ${i+1}`)).map((topikNama, idx) => {
                              const sel   = isSelesai(a.nama, m.id, idx);
                              const bkey  = `${a.nama}|${m.id}|${idx}`;
                              const busy  = !!saving[bkey];
                              return (
                                <button key={idx}
                                  disabled={busy || (!isAdmin)}
                                  onClick={() => isAdmin && toggleTopik(a.nama, m.id, idx, sel)}
                                  title={topikNama}
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
                                  {topikNama}
                                </button>
                              );
                            })}
                          </div>
                          {!isAdmin && (
                            <div style={{ fontSize:10, color:'var(--text-3)', marginTop:8 }}>
                              Topik hijau = sudah dipelajari. Hanya admin yang bisa mengubah.
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

// ── JURNAL ─────────────────────────────────────────────────────────────────
export function Jurnal() {
  const [entries,  setEntries]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    api.getJurnal()
      .then(res => setEntries(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Jurnal minggu ini: 7 hari terakhir
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const thisWeek = entries.filter(e => new Date(e.tanggal_jurnal || e.created_at) >= weekAgo);

  // Map nama → entri terbaru minggu ini
  const byNama = {};
  thisWeek.forEach(e => {
    if (!byNama[e.nama] || new Date(e.created_at) > new Date(byNama[e.nama].created_at))
      byNama[e.nama] = e;
  });

  // Gabung dengan daftar TIM untuk tampilkan yang belum isi
  const data = TIM.map(t => ({
    ...t,
    jurnal: byNama[t.nama] || null,
    isi: !!byNama[t.nama],
  }));

  const sudahIsi = data.filter(d => d.isi);
  const avgMood  = sudahIsi.length > 0
    ? Math.round(sudahIsi.reduce((s, d) => s + (d.jurnal?.mood || 0), 0) / sudahIsi.length * 10) / 10
    : 0;

  if (loading) return (
    <div style={{ textAlign:'center', padding:40, color:'var(--text-2)' }}>Memuat jurnal...</div>
  );

  return (
    <div>
      <div className="metrics-grid" style={{ marginBottom:16 }}>
        <div className="metric"><div className="metric-val text-green">{sudahIsi.length}</div><div className="metric-lbl">Sudah isi</div></div>
        <div className="metric"><div className="metric-val text-red">{data.length - sudahIsi.length}</div><div className="metric-lbl">Belum isi</div></div>
        <div className="metric">
          <div className="metric-val" style={{ color: avgMood >= 7 ? 'var(--green)' : avgMood >= 5 ? 'var(--amber)' : 'var(--red)' }}>
            {avgMood || '—'}
          </div>
          <div className="metric-lbl">Rata-rata mood</div>
        </div>
        <div className="metric"><div className="metric-val">{Math.round(sudahIsi.length / data.length * 100)}%</div><div className="metric-lbl">Konsistensi</div></div>
      </div>

      <div className="card">
        <div className="card-title" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
          <span>Status jurnal refleksi — minggu ini</span>
          <button className="btn btn-sm" onClick={() => {
            const rows = entries.map(e => ({
              nama: e.nama, divisi: e.divisi, tanggal: e.tanggal_jurnal,
              mood: e.mood, pencapaian_1: e.pencapaian_1, hambatan: e.hambatan,
              target_depan: e.target_depan, skor_karya: e.skor_karya,
              skor_waktu: e.skor_waktu, skor_komunikasi: e.skor_komunikasi, skor_skill: e.skor_skill,
            }));
            downloadCsv('jurnal_refleksi.csv', rows, ['nama','divisi','tanggal','mood','pencapaian_1','hambatan','target_depan','skor_karya','skor_waktu','skor_komunikasi','skor_skill']);
          }} style={{ fontSize:11, padding:'3px 10px' }}>⬇ Export CSV</button>
        </div>
        {data.map(d => {
          const tc     = TIPE_COLOR[d.tipe] || { bg:'var(--surface-2)', text:'var(--text-2)' };
          const j      = d.jurnal;
          const isOpen = expanded === d.id;
          return (
            <div key={d.id}>
              <div className="member-row" style={{ alignItems:'center', cursor: j ? 'pointer' : 'default' }}
                onClick={() => j && setExpanded(isOpen ? null : d.id)}>
                <div className="avatar" style={{ width:26, height:26, background:tc.bg, color:tc.text, fontSize:10 }}>
                  {d.nama.split(' ').slice(0,2).map(w=>w[0]).join('')}
                </div>
                <span className="member-name" style={{ fontSize:12 }}>{d.nama}</span>
                <span style={{ fontSize:11, color:'var(--text-2)', marginRight:6 }}>{d.divisi}</span>
                {d.isi ? (
                  <>
                    <span style={{ fontSize:11, color:'var(--text-2)' }}>Mood:</span>
                    <span style={{ fontWeight:600, fontSize:12, marginLeft:4,
                      color: j.mood >= 7 ? 'var(--green)' : j.mood >= 5 ? 'var(--amber)' : 'var(--red)' }}>
                      {j.mood}/10
                    </span>
                    <span style={{ flex:1 }} />
                    <span className="tag tag-aktif" style={{ marginRight:4 }}>✓ Sudah isi</span>
                    <span style={{ fontSize:11, color:'var(--text-3)' }}>{isOpen ? '▲' : '▼'}</span>
                  </>
                ) : (
                  <>
                    <span style={{ flex:1 }} />
                    <span className="tag tag-ar">Belum isi</span>
                  </>
                )}
              </div>

              {/* Detail ekspansi */}
              {isOpen && j && (
                <div style={{ margin:'4px 0 10px 38px', padding:'12px 14px',
                  background:'var(--surface-2)', borderRadius:10, border:'1px solid var(--border)' }}>
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                    {[
                      { label:'Karya', val:j.skor_karya, max:5 },
                      { label:'Waktu', val:j.skor_waktu, max:5 },
                      { label:'Komunikasi', val:j.skor_komunikasi, max:5 },
                      { label:'Skill', val:j.skor_skill, max:5 },
                    ].map(s => (
                      <div key={s.label} style={{ fontSize:11 }}>
                        <span style={{ color:'var(--text-3)' }}>{s.label}: </span>
                        <span style={{ fontWeight:600, color:'var(--green)' }}>{s.val || 0}/{s.max}</span>
                      </div>
                    ))}
                  </div>
                  {j.pencapaian_1 && <div style={{ fontSize:11, marginBottom:4 }}><span style={{ color:'var(--text-3)' }}>🏆 </span>{j.pencapaian_1}</div>}
                  {j.hambatan     && <div style={{ fontSize:11, marginBottom:4 }}><span style={{ color:'var(--text-3)' }}>⚡ </span>{j.hambatan}</div>}
                  {j.target_depan && <div style={{ fontSize:11 }}><span style={{ color:'var(--text-3)' }}>🎯 </span>{j.target_depan}</div>}
                  {j.catatan_mentor && (
                    <div style={{ marginTop:8, padding:'6px 10px', background:'var(--surface-3, var(--surface))',
                      borderRadius:8, fontSize:11, fontStyle:'italic', color:'var(--text-2)',
                      borderLeft:'2px solid var(--green)' }}>
                      💌 {j.catatan_mentor}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Riwayat semua entry */}
      {entries.length > 0 && (
        <div className="card" style={{ marginTop:12 }}>
          <div className="card-title">
            <span>Riwayat jurnal ({entries.length} entri)</span>
            <button className="btn btn-sm no-print" onClick={() => window.print()}
              style={{ fontSize:11, padding:'3px 10px' }}>🖨️ Cetak</button>
          </div>
          {entries.slice(0,10).map((e, i) => (
            <div key={i} className="member-row" style={{ fontSize:11 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                background: e.mood >= 7 ? 'var(--green)' : e.mood >= 5 ? 'var(--amber)' : 'var(--red)' }} />
              <span style={{ fontWeight:600, width:140, flexShrink:0 }}>{e.nama}</span>
              <span style={{ color:'var(--text-2)', flex:1 }}>{e.pencapaian_1 || '—'}</span>
              <span style={{ color:'var(--text-3)', flexShrink:0 }}>
                {new Date(e.tanggal_jurnal || e.created_at).toLocaleDateString('id-ID', { day:'numeric', month:'short' })}
              </span>
            </div>
          ))}
          {entries.length > 10 && (
            <div style={{ fontSize:11, color:'var(--text-3)', textAlign:'center', paddingTop:8 }}>
              +{entries.length - 10} entri lainnya
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── SOP ────────────────────────────────────────────────────────────────────
export function SOP() {
  const [active, setActive] = useState(null);

  const SOPS = [
    { id: 'illus',    label: 'Illustrasi',    ico: '🎨', wajib: 7,  c: 'var(--purple)', bg: 'var(--purple-light)',
      items: ['Referensi visual minimal 3 gambar','Deskripsi karakter lengkap','Art style dengan referensi','Pose spesifik atau referensi','Background ada atau transparan','Format file output','Jumlah revisi sesuai paket'] },
    { id: 'rigging',  label: 'Live2D Rigging', ico: '🎬', wajib: 8, c: 'var(--coral)',  bg: 'var(--coral-light)',
      items: ['File PSD layered sudah diterima','Tier rigging sudah ditentukan','Software target (VTube Studio, dll)','Jumlah ekspresi yang dibutuhkan','Toggle outfit/aksesori','Physics priority','Referensi gerakan','Versi VTube Studio klien'] },
    { id: 'vrm',      label: 'VRM 3D',         ico: '📦', wajib: 8,  c: 'var(--blue)',   bg: 'var(--blue-light)',
      items: ['Referensi sheet 2D tampak depan','Tier model (VRoid/semi/full custom)','Software target','Jumlah outfit','Aksesori khusus','BlendShape yang dibutuhkan','Spring bone priority','Polygon budget'] },
    { id: 'ar',       label: 'AR Filter',      ico: '✨', wajib: 7,  c: 'var(--green)',  bg: 'var(--green-light)',
      items: ['Platform target (Instagram/TikTok)','Jenis filter (face/world)','Model 3D yang digunakan','Animasi yang dibutuhkan','Akun platform klien','Referensi filter','Elemen tambahan'] },
    { id: '3dp',      label: '3D Print',       ico: '🖨️', wajib: 8, c: 'var(--amber)',  bg: 'var(--amber-light)',
      items: ['Referensi desain karakter','Ukuran fisik dalam cm','Material cetak (PLA/resin)','Perlu painting atau tidak','Jasa cetak yang digunakan','Jumlah part','Pose karakter','Kebutuhan base/stand'] },
    { id: 'pm-check', label: 'Checklist PM',   ico: '✅', wajib: 10, c: 'var(--green)',  bg: 'var(--green-light)',
      items: ['Nama klien dan platform tercantum','Jenis project spesifik','Deadline dengan tanggal spesifik','Harga yang disepakati','Minimal 3 referensi visual','Deskripsi karakter lengkap','Format file output','Jumlah revisi dikomunikasikan','Klien sudah konfirmasi brief','Tidak ada informasi ambigu'] },
  ];

  return (
    <div>
      <div className="alert alert-amber" style={{ marginBottom: 16 }}>
        <span>⚠️</span>
        <div>Brief yang tidak lengkap adalah sumber utama revisi berulang. Gunakan checklist ini sebelum meneruskan ke PM.</div>
      </div>

      <div className="grid-2">
        {SOPS.map(s => (
          <div key={s.id} className="card" style={{ cursor: 'pointer' }}
            onClick={() => setActive(active === s.id ? null : s.id)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: active === s.id ? 12 : 0 }}>
              <div className="module-icon" style={{ background: s.bg, color: s.c }}>{s.ico}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{s.wajib} informasi wajib</div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>{active === s.id ? '▲' : '▼'}</span>
            </div>
            {active === s.id && (
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                {s.items.map((item, i) => (
                  <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', padding: '4px 0', fontSize: 12 }}>
                    <span style={{ color: s.c, flexShrink: 0, marginTop: 1 }}>☐</span>
                    <span>{item}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="card" style={{ marginTop: 12 }}>
        <div className="card-title">🚩 Red flag klien</div>
        {[
          { f: 'Deadline ASAP', a: 'Klarifikasi deadline realistis, tawarkan rush fee' },
          { f: 'Brief tidak jelas — "terserah aja"', a: 'Minta brief spesifik sebelum terima order' },
          { f: 'Revisi sampai puas / unlimited', a: 'Tegaskan batas revisi sesuai paket di awal' },
          { f: 'Ganti konsep setelah approve', a: 'Tunjukkan bukti approval — biaya tambahan' },
          { f: 'Tidak mau DP untuk klien baru', a: 'Minimal 50% DP sebelum mulai' },
          { f: 'Request file source gratis', a: 'PSD/Blender file adalah add-on berbayar' },
        ].map((r, i) => (
          <div key={i} className="member-row">
            <span style={{ color: 'var(--red)', fontSize: 14 }}>⚠</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 12, fontWeight: 500 }}>{r.f}</div>
              <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{r.a}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── REWARD ─────────────────────────────────────────────────────────────────
export function Reward() {
  const { user }  = useAuth();
  const isAdmin   = user?.role === 'admin';
  const now       = new Date();
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [revData,  setRevData]  = useState([]);
  const [rewardList, setRewardList] = useState([]);
  const [editRev,  setEditRev]  = useState({});
  const [saving,   setSaving]   = useState({});
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [rewardForm, setRewardForm] = useState({ tanggal: now.toISOString().slice(0,10), nama:'', kategori:'', trigger:'', bentuk:'', nominal:'', catatan:'' });
  const [savingReward, setSavingReward] = useState(false);

  const ADMIN_LIST = TIM.filter(t => t.divisi === 'Admin');
  const TARGET_PER_ADMIN = 2000;

  const loadRevenue = useCallback(() => {
    api.getRevenue(bulan, tahun).then(res => setRevData(res.data || [])).catch(() => {});
  }, [bulan, tahun]);

  const loadRewards = useCallback(() => {
    api.getReward().then(res => setRewardList(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => { loadRevenue(); }, [loadRevenue]);
  useEffect(() => { loadRewards(); }, [loadRewards]);

  const handleSaveReward = async (e) => {
    e.preventDefault();
    setSavingReward(true);
    try {
      await api.simpanReward(rewardForm);
      setShowRewardForm(false);
      setRewardForm({ tanggal: new Date().toISOString().slice(0,10), nama:'', kategori:'', trigger:'', bentuk:'', nominal:'', catatan:'' });
      loadRewards();
    } catch {}
    finally { setSavingReward(false); }
  };

  const getJumlah = (nama) => {
    const row = revData.find(r => r.nama === nama);
    return row ? parseFloat(row.jumlah) : 0;
  };

  const handleSaveRev = async (nama) => {
    const jumlah = parseFloat(editRev[nama] ?? getJumlah(nama)) || 0;
    setSaving(s => ({ ...s, [nama]: true }));
    try {
      await api.saveRevenue({ bulan, tahun, nama, jumlah, target: TARGET_PER_ADMIN });
      loadRevenue();
      setEditRev(e => { const n = { ...e }; delete n[nama]; return n; });
    } catch {}
    finally { setSaving(s => { const n = { ...s }; delete n[nama]; return n; }); }
  };

  const totalRev    = ADMIN_LIST.reduce((s, a) => s + getJumlah(a.nama), 0);
  const totalTarget = ADMIN_LIST.length * TARGET_PER_ADMIN;
  const pctTotal    = totalTarget > 0 ? Math.round(totalRev / totalTarget * 100) : 0;

  const BULAN_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];

  return (
    <div>
      {/* Metrics */}
      <div className="metrics-grid" style={{ marginBottom: 16 }}>
        <div className="metric">
          <div className="metric-val text-green">${totalRev.toLocaleString()}</div>
          <div className="metric-lbl">Revenue bulan ini</div>
        </div>
        <div className="metric">
          <div className="metric-val" style={{ color: pctTotal >= 100 ? 'var(--green)' : 'var(--amber)' }}>{pctTotal}%</div>
          <div className="metric-lbl">Dari target</div>
        </div>
        <div className="metric">
          <div className="metric-val">${totalTarget.toLocaleString()}</div>
          <div className="metric-lbl">Target total</div>
        </div>
        <div className="metric">
          <div className="metric-val">Rp 500rb</div>
          <div className="metric-lbl">Seed fund</div>
        </div>
      </div>

      {/* Revenue tracker per admin */}
      <div className="card" style={{ marginBottom: 16 }}>
        {/* Header bulan/tahun picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div className="card-title" style={{ flex: 1, margin: 0 }}>Revenue Admin</div>
          <select value={bulan} onChange={e => setBulan(+e.target.value)}
            style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}>
            {BULAN_NAMES.map((b, i) => <option key={i} value={i+1}>{b}</option>)}
          </select>
          <input type="number" value={tahun} onChange={e => setTahun(+e.target.value)}
            style={{ width: 72, padding: '4px 8px', fontSize: 12 }} min={2024} max={2030} />
        </div>

        {/* Progress bar total */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11,
            color: 'var(--text-2)', marginBottom: 5 }}>
            <span>Total: ${totalRev.toLocaleString()}</span>
            <span style={{ fontWeight: 700, color: pctTotal>=100?'var(--green)':'var(--amber)' }}>
              {pctTotal}% dari ${totalTarget.toLocaleString()}
            </span>
          </div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, pctTotal)}%`,
              background: pctTotal >= 100 ? 'var(--green)' : 'var(--amber)',
              borderRadius: 99, transition: 'width .5s',
              boxShadow: pctTotal >= 100 ? '0 0 8px var(--green)' : 'none' }} />
          </div>
        </div>

        {/* Per admin row */}
        {ADMIN_LIST.map(a => {
          const jumlah = editRev[a.nama] !== undefined ? editRev[a.nama] : getJumlah(a.nama);
          const pct    = Math.min(100, Math.round(jumlah / TARGET_PER_ADMIN * 100));
          const color  = pct >= 100 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
          const tc     = TIPE_COLOR[a.tipe] || {};
          return (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div className="avatar" style={{ width: 30, height: 30, background: tc.bg, color: tc.text,
                fontSize: 11, flexShrink: 0 }}>
                {a.nama.split(' ').slice(0,2).map(w=>w[0]).join('')}
              </div>
              <div style={{ width: 60, flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{a.nama.split(' ')[0]}</div>
                <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{a.divisi}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color,
                    borderRadius: 99, transition: 'width .4s' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 10, color, fontWeight: 700, width: 36, textAlign: 'right' }}>
                  {pct}%
                </span>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 11, color: 'var(--text-3)', pointerEvents: 'none' }}>$</span>
                  <input type="number" value={jumlah} min={0}
                    onChange={e => setEditRev(v => ({ ...v, [a.nama]: e.target.value }))}
                    onBlur={() => handleSaveRev(a.nama)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveRev(a.nama)}
                    style={{ width: 80, padding: '4px 6px 4px 18px', fontSize: 11,
                      borderColor: editRev[a.nama] !== undefined ? 'var(--green)' : 'var(--border-2)' }} />
                </div>
                {saving[a.nama] && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>...</span>}
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
          Klik field angka → ubah → tekan Enter atau klik di luar untuk simpan.
        </div>
      </div>

      {/* Reward triggers */}
      <div className="grid-2">
        <div className="card">
          <div className="card-title">Trigger reward — semua kategori</div>
          {REWARD_LIST.map((r, i) => (
            <div key={i} className="reward-row">
              <span className="reward-ico">{r.ico}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{r.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{r.trigger}</div>
              </div>
              <span className="reward-val">{r.nilai}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title">Reward personal per anggota</div>
          {[
            { n:'Ariel',  r:'Dilibatkan diskusi strategis studio' },
            { n:'Ryan',   r:'Budget kursus multi-platform' },
            { n:'Nanda',  r:'Jadi organizer gathering' },
            { n:'Dina',   r:'Akses ekosistem JRUHUB + mentoring' },
            { n:'Tsania', r:'Percepat akses modul lanjutan' },
            { n:'Fathur', r:'Waktu R&D + budget eksplorasi tools' },
            { n:'Raynar', r:'Budget kursus front-end / AR filter' },
            { n:'Adit',   r:'Akses program passive income creator' },
            { n:'Noval',  r:'Host gathering + budget entertain' },
            { n:'Galang', r:'Waktu eksplorasi Chinese style' },
            { n:'Ridho',  r:'Brief terstruktur + tabungan upgrade' },
          ].map(r => (
            <div key={r.n} className="member-row">
              <div className="avatar" style={{ width:24,height:24,background:'var(--green-light)',color:'var(--green)',fontSize:10 }}>{r.n[0]}</div>
              <div style={{ flex:1 }}>
                <span style={{ fontWeight:500, fontSize:12 }}>{r.n}</span>
                <div style={{ fontSize:11, color:'var(--text-2)' }}>{r.r}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reward Tracking — admin only */}
      {isAdmin && (
        <div className="card" style={{ marginTop:16 }}>
          <div className="card-title">
            <span>Riwayat Reward Diberikan</span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowRewardForm(v=>!v)}>
              {showRewardForm ? 'Tutup' : '+ Catat Reward'}
            </button>
          </div>

          {showRewardForm && (
            <form onSubmit={handleSaveReward} style={{ marginBottom:16, padding:'12px 14px',
              background:'var(--surface-2)', borderRadius:10, border:'1px solid var(--border)' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <label style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:4 }}>Tanggal *</label>
                  <input type="date" value={rewardForm.tanggal} required onChange={e=>setRewardForm(f=>({...f,tanggal:e.target.value}))} />
                </div>
                <div>
                  <label style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:4 }}>Penerima *</label>
                  <select value={rewardForm.nama} required onChange={e=>setRewardForm(f=>({...f,nama:e.target.value}))}>
                    <option value="">— Pilih anggota —</option>
                    {TIM.map(t=><option key={t.id} value={t.nama}>{t.nama}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:4 }}>Kategori *</label>
                  <select value={rewardForm.kategori} required onChange={e=>setRewardForm(f=>({...f,kategori:e.target.value}))}>
                    <option value="">— Pilih —</option>
                    {['Naik level','Revenue bonus','Kualitas project','Gathering','Budget kursus','Mentor kaderisasi','Apresiasi khusus'].map(k=><option key={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:4 }}>Nominal (Rp)</label>
                  <input type="number" value={rewardForm.nominal} min={0}
                    onChange={e=>setRewardForm(f=>({...f,nominal:e.target.value}))} placeholder="0" />
                </div>
              </div>
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:4 }}>Bentuk reward</label>
                <input value={rewardForm.bentuk} onChange={e=>setRewardForm(f=>({...f,bentuk:e.target.value}))} placeholder="Uang tunai / budget kursus / apresiasi publik / dll" />
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:4 }}>Catatan</label>
                <textarea rows={2} value={rewardForm.catatan} onChange={e=>setRewardForm(f=>({...f,catatan:e.target.value}))}
                  placeholder="Alasan pemberian reward..." style={{ resize:'vertical' }} />
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button type="submit" className="btn btn-primary" disabled={savingReward} style={{ fontSize:12 }}>
                  {savingReward ? 'Menyimpan...' : '🏆 Simpan Reward'}
                </button>
                <button type="button" className="btn" style={{ fontSize:12 }} onClick={()=>setShowRewardForm(false)}>Batal</button>
              </div>
            </form>
          )}

          {rewardList.length === 0 ? (
            <div style={{ textAlign:'center', padding:'20px 0', fontSize:12, color:'var(--text-3)' }}>
              Belum ada reward yang dicatat.
            </div>
          ) : rewardList.slice(0,10).map(r => {
            const member = TIM.find(t => t.nama === r.nama);
            const tc = member ? (TIPE_COLOR[member.tipe]||{}) : {};
            return (
              <div key={r.id} className="member-row" style={{ alignItems:'flex-start', padding:'8px 0' }}>
                <div className="avatar" style={{ width:28,height:28,background:tc.bg||'var(--green-light)',color:tc.text||'var(--green)',fontSize:10 }}>
                  {r.nama?.split(' ').slice(0,2).map(w=>w[0]).join('')}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600 }}>{r.nama}</div>
                  <div style={{ fontSize:11, color:'var(--text-2)' }}>{r.kategori}{r.bentuk ? ` — ${r.bentuk}` : ''}</div>
                  {r.catatan && <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>{r.catatan}</div>}
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  {r.nominal > 0 && <div style={{ fontSize:12, fontWeight:700, color:'var(--green)' }}>Rp {parseInt(r.nominal).toLocaleString()}</div>}
                  <div style={{ fontSize:10, color:'var(--text-3)' }}>
                    {new Date(r.tanggal||r.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── WORKSHOP ───────────────────────────────────────────────────────────────
export function Workshop() {
  const { user }    = useAuth();
  const isAdmin     = user?.role === 'admin';
  const [kehadiran, setKehadiran] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState({});
  const [expanded,  setExpanded]  = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getWorkshop();
      setKehadiran(res.data);
    } catch { /* fallback kosong */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (nama, layerId, sesiIdx, curr) => {
    const key = `${nama}|${layerId}|${sesiIdx}`;
    setSaving(s => ({ ...s, [key]: true }));
    const next = !curr;
    setKehadiran(prev => {
      const exists = prev.find(r => r.nama === nama && r.layer_id === layerId && r.sesi_idx === sesiIdx);
      if (exists) return prev.map(r => r.nama === nama && r.layer_id === layerId && r.sesi_idx === sesiIdx ? { ...r, hadir: next } : r);
      return [...prev, { nama, layer_id: layerId, sesi_idx: sesiIdx, hadir: next }];
    });
    try { await api.updateWorkshop(nama, layerId, sesiIdx, next); }
    catch { load(); }
    finally { setSaving(s => { const n = { ...s }; delete n[key]; return n; }); }
  };

  const isHadir = (nama, layerId, sesiIdx) =>
    !!(kehadiran.find(r => r.nama === nama && r.layer_id === layerId && r.sesi_idx === sesiIdx)?.hadir);

  // Statistik keseluruhan
  const totalSesi  = WORKSHOP_JRUHUB.reduce((s, w) => s + w.items.length, 0); // 19
  const totalSlot  = TIM.length * totalSesi;
  const totalHadir = kehadiran.filter(r => r.hadir).length;
  const grandPct   = totalSlot > 0 ? Math.round(totalHadir / totalSlot * 100) : 0;

  const anggota = isAdmin ? TIM : TIM.filter(t => t.nama === user?.nama);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-2)' }}>Memuat data workshop...</div>
  );

  return (
    <div>
      {/* Header stats */}
      <div className="metrics-grid" style={{ marginBottom: 16 }}>
        <div className="metric"><div className="metric-val">19</div><div className="metric-lbl">Total sesi</div></div>
        <div className="metric"><div className="metric-val">15</div><div className="metric-lbl">Bulan program</div></div>
        <div className="metric">
          <div className="metric-val text-green">{totalHadir}</div>
          <div className="metric-lbl">Kehadiran tercatat</div>
        </div>
        <div className="metric">
          <div className="metric-val" style={{ color: 'var(--amber)' }}>{grandPct}%</div>
          <div className="metric-lbl">Rata-rata hadir</div>
        </div>
      </div>

      {/* Export */}
      <div style={{ textAlign:'right', marginBottom:12 }}>
        <button className="btn btn-sm" onClick={() => {
          const rows = [];
          TIM.forEach(t => WORKSHOP_JRUHUB.forEach(w => w.items.forEach((item, idx) => {
            const h = !!(kehadiran.find(r => r.nama===t.nama && r.layer_id===w.id && r.sesi_idx===idx)?.hadir);
            rows.push({ nama:t.nama, divisi:t.divisi, layer:w.label, sesi_no:idx+1, sesi_nama:item, hadir:h?'Ya':'Tidak' });
          })));
          downloadCsv('workshop_kehadiran.csv', rows, ['nama','divisi','layer','sesi_no','sesi_nama','hadir']);
        }} style={{ fontSize:11, padding:'4px 12px' }}>⬇ Export Kehadiran CSV</button>
      </div>

      {/* Per-layer cards */}
      {WORKSHOP_JRUHUB.map(w => {
        const isOpen    = expanded === w.id;
        // Hitung kehadiran layer ini
        const layerHadir = kehadiran.filter(r => r.layer_id === w.id && r.hadir).length;
        const layerSlot  = anggota.length * w.items.length;
        const layerPct   = layerSlot > 0 ? Math.round(layerHadir / layerSlot * 100) : 0;

        return (
          <div key={w.id} className="card" style={{ marginBottom: 10 }}>
            {/* Header layer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              onClick={() => setExpanded(isOpen ? null : w.id)}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: w.bg, color: w.warna,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>🎓</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{w.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                  {w.bulan} · {w.items.length} sesi
                </div>
              </div>
              <div style={{ width: 110, flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10,
                  color: 'var(--text-3)', marginBottom: 3 }}>
                  <span>{layerHadir}/{layerSlot} slot</span>
                  <span style={{ color: w.warna, fontWeight: 700 }}>{layerPct}%</span>
                </div>
                <div style={{ height: 5, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${layerPct}%`, background: w.warna, borderRadius: 99, transition: 'width .4s' }} />
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {/* Tabel kehadiran per anggota × sesi */}
            {isOpen && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
                {/* Header kolom sesi */}
                <div style={{ display: 'flex', gap: 0, marginBottom: 8, marginLeft: 170 }}>
                  {w.items.map((item, idx) => (
                    <div key={idx} style={{
                      width: 36, flexShrink: 0, textAlign: 'center',
                      fontSize: 9, color: 'var(--text-3)', lineHeight: 1.3,
                      padding: '0 2px',
                    }} title={item}>
                      S{idx + 1}
                    </div>
                  ))}
                  <div style={{ width: 60, flexShrink: 0, fontSize: 9, color: 'var(--text-3)', textAlign: 'right', paddingRight: 4 }}>
                    Hadir
                  </div>
                </div>

                {/* Baris per anggota */}
                {anggota.map(tim => {
                  const tc    = TIPE_COLOR[tim.tipe] || {};
                  const dc    = DIVISI_COLOR[tim.divisi] || {};
                  const inits = tim.nama.split(' ').slice(0, 2).map(x => x[0]).join('');
                  const hadirCount = w.items.filter((_, idx) => isHadir(tim.nama, w.id, idx)).length;
                  const pctMember  = Math.round(hadirCount / w.items.length * 100);
                  const barColor   = pctMember >= 80 ? 'var(--green)' : pctMember >= 50 ? 'var(--amber)' : 'var(--red)';

                  return (
                    <div key={tim.id} style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 6 }}>
                      {/* Avatar + nama */}
                      <div style={{ width: 170, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, paddingRight: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          background: tc.bg || 'var(--surface-2)',
                          color: tc.text || 'var(--text-2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700,
                        }}>{inits}</div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>
                            {tim.nama.split(' ')[0]}
                          </div>
                          <div style={{ fontSize: 9, color: dc.text || 'var(--text-3)' }}>{dc.icon} {tim.divisi}</div>
                        </div>
                      </div>

                      {/* Checkbox per sesi */}
                      {w.items.map((_, sesiIdx) => {
                        const hadir  = isHadir(tim.nama, w.id, sesiIdx);
                        const key    = `${tim.nama}|${w.id}|${sesiIdx}`;
                        const isBusy = !!saving[key];
                        return (
                          <div key={sesiIdx} style={{ width: 36, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                            <button
                              disabled={isBusy || !isAdmin}
                              onClick={() => toggle(tim.nama, w.id, sesiIdx, hadir)}
                              title={`${tim.nama} — ${w.items[sesiIdx]}: ${hadir ? 'hadir' : 'tidak hadir'}`}
                              style={{
                                width: 22, height: 22, borderRadius: 6, border: 'none',
                                background: hadir ? w.warna : 'var(--surface-2)',
                                color: hadir ? '#fff' : 'var(--text-3)',
                                cursor: isAdmin ? (isBusy ? 'wait' : 'pointer') : 'default',
                                fontSize: 11, fontWeight: 700, display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                transition: 'background .15s, transform .1s',
                                transform: isBusy ? 'scale(.9)' : '',
                                boxShadow: hadir ? `0 0 6px ${w.warna}60` : 'none',
                              }}>
                              {hadir ? '✓' : '·'}
                            </button>
                          </div>
                        );
                      })}

                      {/* Counter hadir */}
                      <div style={{ width: 60, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, paddingLeft: 6 }}>
                        <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pctMember}%`, background: barColor, borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: barColor, flexShrink: 0 }}>
                          {hadirCount}/{w.items.length}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Legend sesi */}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)',
                  display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {w.items.map((item, idx) => (
                    <span key={idx} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: w.bg, color: w.warna }}>
                      S{idx+1} — {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── KADER ──────────────────────────────────────────────────────────────────
export function Kader() {
  const [profiling, setProfiling] = useState([]);
  useEffect(() => {
    api.getProfilingAll().then(r => setProfiling(r.data || [])).catch(() => {});
  }, []);

  // Hitung skor kader dari TIM + data profiling DB
  const kaderData = TIM.map(m => {
    const p = profiling.find(x => x.nama === m.nama);
    // Ambil skor pilar (tertarik_memimpin) dari profiling bila ada
    const pilarRaw = p?.tertarik_memimpin || '';
    const pilar = pilarRaw.toLowerCase().includes('ya') ? 5
                : pilarRaw.toLowerCase().includes('berminat') ? 4
                : pilarRaw.toLowerCase().includes('mungkin') ? 3
                : m.kriteria; // fallback static

    // Skor keseluruhan: tipe + skill + komunikasi + pilar + kepuasan
    const tipeScore = { 'Rising Star': 40, 'High Potential': 35, 'Silent Expert': 25, 'At Risk': 10 }[m.tipe] || 20;
    const score = tipeScore + (m.skill * 6) + (m.komunikasi * 6) + (pilar * 6) + (m.kepuasan * 3);
    return { ...m, pilar, score, hasProfiling: !!p };
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
              <span style={{ fontSize:11, color:'var(--text-3)', marginRight:6 }}>Skor: {m.score}</span>
              <span className={`tag tag-${tc.badge}`}>{m.tipe}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SKB ────────────────────────────────────────────────────────────────────
const SKB_TEMPLATES = [
  { id:'skb1', label:'SKB-1 Individual',         sub:'Belajar skill baru di luar modul',    ico:'👤', c:'var(--green)',  bg:'var(--green-light)'  },
  { id:'skb2', label:'SKB-2 Pelatihan Eksternal',sub:'Kursus atau training berbayar',       ico:'🎓', c:'var(--purple)', bg:'var(--purple-light)' },
  { id:'skb3', label:'SKB-3 Inisiatif Tim',      sub:'Layanan baru atau perubahan sistem',  ico:'👥', c:'var(--amber)',  bg:'var(--amber-light)'  },
  { id:'skb4', label:'SKB-4 R&D Teknis',         sub:'Eksplorasi tools atau teknik baru',   ico:'🔬', c:'var(--coral)',  bg:'var(--coral-light)'  },
];

const SKB_STATUS = {
  draft:    { label:'Draft',       color:'var(--text-3)',  bg:'var(--surface-2)' },
  diajukan: { label:'Menunggu',    color:'var(--amber)',   bg:'var(--amber-light)' },
  disetujui:{ label:'Disetujui',   color:'var(--green)',   bg:'var(--green-light)' },
  ditolak:  { label:'Ditolak',     color:'var(--red)',     bg:'var(--coral-light)' },
  selesai:  { label:'Selesai',     color:'var(--blue)',    bg:'var(--blue-light)' },
};

export function SKB() {
  const { user }    = useAuth();
  const isAdmin     = user?.role === 'admin';
  const timData     = TIM.find(t => t.nama === user?.nama);
  const [list,      setList]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [tipe,      setTipe]      = useState('');
  const [form,      setForm]      = useState({ judul:'', deskripsi:'', latar_belakang:'', tujuan:'', output:'', timeline:'', kebutuhan:'', risiko:'', ukuran_sukses:'', komitmen:'' });
  const [saving,    setSaving]    = useState(false);
  const [expanded,  setExpanded]  = useState(null);
  const [review,    setReview]    = useState({});

  const load = useCallback(() => {
    api.getSKB()
      .then(res => setList(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!tipe) return;
    setSaving(true);
    try {
      await api.simpanSKB({ ...form, tipe, nama: user?.nama, divisi: timData?.divisi, level: timData?.level, status:'diajukan' });
      setShowForm(false); setTipe(''); setForm({ judul:'', deskripsi:'', latar_belakang:'', tujuan:'', output:'', timeline:'', kebutuhan:'', risiko:'', ukuran_sukses:'', komitmen:'' });
      load();
    } catch { /* show nothing, silently */ }
    finally { setSaving(false); }
  };

  const handleReview = async (id, status) => {
    const catatan = review[id] || '';
    await api.updateSKB(id, { status, catatan_review: catatan, reviewer: user?.nama });
    load();
  };

  const myList   = isAdmin ? list : list.filter(s => s.nama === user?.nama);
  const pending  = list.filter(s => s.status === 'diajukan').length;
  const active   = list.filter(s => s.status === 'disetujui').length;
  const done     = list.filter(s => s.status === 'selesai').length;

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'var(--text-2)' }}>Memuat SKB...</div>;

  return (
    <div>
      <div className="metrics-grid" style={{ marginBottom:16 }}>
        <div className="metric"><div className="metric-val" style={{ color:'var(--amber)' }}>{pending}</div><div className="metric-lbl">Menunggu review</div></div>
        <div className="metric"><div className="metric-val text-green">{active}</div><div className="metric-lbl">SKB aktif</div></div>
        <div className="metric"><div className="metric-val" style={{ color:'var(--blue)' }}>{done}</div><div className="metric-lbl">Selesai</div></div>
        <div className="metric"><div className="metric-val">{list.length}</div><div className="metric-lbl">Total pengajuan</div></div>
      </div>

      {/* Tombol ajukan */}
      {!isAdmin && !showForm && (
        <button className="btn btn-primary" style={{ marginBottom:16 }} onClick={() => setShowForm(true)}>
          + Ajukan SKB Baru
        </button>
      )}

      {/* Form pengajuan */}
      {showForm && (
        <div className="card" style={{ marginBottom:16 }}>
          <div className="card-title">Ajukan SKB Baru</div>

          {/* Pilih tipe */}
          <div style={{ marginBottom:14 }}>
            <div style={{ fontSize:12, fontWeight:600, marginBottom:8 }}>Tipe SKB *</div>
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              {SKB_TEMPLATES.map(t => (
                <button key={t.id} type="button" onClick={() => setTipe(t.id)} style={{
                  padding:'7px 12px', borderRadius:8, cursor:'pointer', fontSize:12,
                  border:`1px solid ${tipe===t.id ? t.c : 'var(--border-2)'}`,
                  background: tipe===t.id ? t.bg : 'var(--surface)',
                  color: tipe===t.id ? t.c : 'var(--text)', fontWeight: tipe===t.id ? 600 : 400,
                }}>{t.ico} {t.label}</button>
              ))}
            </div>
          </div>

          {tipe && (
            <form onSubmit={handleSubmit}>
              {[
                { key:'judul',          label:'Judul SKB *',          ph:'Nama singkat inisiatif ini', req:true },
                { key:'deskripsi',      label:'Deskripsi singkat *',   ph:'Apa yang ingin dipelajari/dilakukan?', req:true },
                { key:'latar_belakang', label:'Latar belakang',        ph:'Mengapa ini penting sekarang?' },
                { key:'tujuan',         label:'Tujuan *',              ph:'Apa yang ingin dicapai?', req:true },
                { key:'output',         label:'Output / hasil',        ph:'Apa yang akan dihasilkan?' },
                { key:'timeline',       label:'Timeline',              ph:'Kapan mulai dan selesai?' },
                { key:'kebutuhan',      label:'Kebutuhan / resources', ph:'Apa yang dibutuhkan? (waktu, biaya, tools)' },
                { key:'ukuran_sukses',  label:'Ukuran sukses',         ph:'Bagaimana tahu ini berhasil?' },
                { key:'komitmen',       label:'Komitmen *',            ph:'Apa yang siap kamu janjikan?', req:true },
              ].map(f => (
                <div key={f.key} style={{ marginBottom:10 }}>
                  <label style={{ fontSize:11, fontWeight:600, display:'block', marginBottom:4, color:'var(--text-2)',
                    textTransform:'uppercase', letterSpacing:'.05em' }}>{f.label}</label>
                  <textarea rows={2} value={form[f.key]} required={f.req}
                    onChange={e => setForm(x => ({ ...x, [f.key]: e.target.value }))}
                    placeholder={f.ph} style={{ resize:'vertical', minHeight:52 }} />
                </div>
              ))}
              <div style={{ display:'flex', gap:8 }}>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? 'Menyimpan...' : '📤 Kirim Pengajuan'}
                </button>
                <button type="button" className="btn" onClick={() => setShowForm(false)}>Batal</button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Daftar SKB */}
      {myList.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📋</div>
          <div className="empty-title">{isAdmin ? 'Belum ada pengajuan SKB' : 'Kamu belum punya SKB'}</div>
          <div className="empty-sub">Setiap inisiatif belajar baru perlu SKB sebelum dimulai</div>
        </div>
      ) : myList.map(s => {
        const st  = SKB_STATUS[s.status] || SKB_STATUS.draft;
        const tmpl = SKB_TEMPLATES.find(t => t.id === s.tipe);
        const isOpen = expanded === s.id;
        return (
          <div key={s.id} className="card" style={{ marginBottom:10 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}
              onClick={() => setExpanded(isOpen ? null : s.id)}>
              <div style={{ width:32, height:32, borderRadius:8, flexShrink:0, fontSize:16,
                background: tmpl?.bg || 'var(--surface-2)', color: tmpl?.c || 'var(--text-2)',
                display:'flex', alignItems:'center', justifyContent:'center' }}>
                {tmpl?.ico || '📋'}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700 }}>{s.judul}</div>
                <div style={{ fontSize:11, color:'var(--text-2)', marginTop:1 }}>
                  {s.nama} · {tmpl?.label || s.tipe} · {new Date(s.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}
                </div>
              </div>
              <span style={{ fontSize:11, fontWeight:700, padding:'3px 9px', borderRadius:99,
                background:st.bg, color:st.color }}>{st.label}</span>
              <span style={{ fontSize:11, color:'var(--text-3)' }}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {isOpen && (
              <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
                {[
                  { label:'Deskripsi',    val:s.deskripsi },
                  { label:'Tujuan',       val:s.tujuan },
                  { label:'Output',       val:s.output },
                  { label:'Timeline',     val:s.timeline },
                  { label:'Kebutuhan',    val:s.kebutuhan },
                  { label:'Ukuran sukses',val:s.ukuran_sukses },
                  { label:'Komitmen',     val:s.komitmen },
                ].filter(x => x.val).map(x => (
                  <div key={x.label} style={{ marginBottom:8 }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase',
                      letterSpacing:'.05em', marginBottom:2 }}>{x.label}</div>
                    <div style={{ fontSize:12, color:'var(--text)' }}>{x.val}</div>
                  </div>
                ))}

                {s.catatan_review && (
                  <div style={{ marginTop:10, padding:'8px 12px', background:'var(--surface-2)',
                    borderRadius:8, borderLeft:`3px solid ${st.color}` }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', marginBottom:3 }}>
                      CATATAN REVIEWER ({s.reviewer})
                    </div>
                    <div style={{ fontSize:12 }}>{s.catatan_review}</div>
                  </div>
                )}

                {/* Review form — admin only, status diajukan */}
                {isAdmin && s.status === 'diajukan' && (
                  <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:8 }}>
                    <textarea rows={2} placeholder="Catatan review (opsional)"
                      value={review[s.id] || ''}
                      onChange={e => setReview(r => ({ ...r, [s.id]: e.target.value }))}
                      style={{ resize:'vertical', fontSize:12 }} />
                    <div style={{ display:'flex', gap:8 }}>
                      <button className="btn btn-primary" style={{ fontSize:12 }}
                        onClick={() => handleReview(s.id, 'disetujui')}>✓ Setujui</button>
                      <button className="btn" style={{ fontSize:12, color:'var(--red)', borderColor:'var(--red)' }}
                        onClick={() => handleReview(s.id, 'ditolak')}>✕ Tolak</button>
                    </div>
                  </div>
                )}
                {/* Admin bisa tandai selesai */}
                {isAdmin && s.status === 'disetujui' && (
                  <button className="btn" style={{ marginTop:10, fontSize:12 }}
                    onClick={() => handleReview(s.id, 'selesai')}>🏁 Tandai Selesai</button>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── FRIDAY WIN ─────────────────────────────────────────────────────────────
export function FridayWin() {
  const { user }   = useAuth();
  const [list,     setList]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ tanggal: new Date().toISOString().slice(0,10), headline:'', penerima:'', pesan:'' });
  const [saving,   setSaving]   = useState(false);

  const load = useCallback(() => {
    api.getFridayWin().then(r => setList(r.data||[])).catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const handlePost = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await api.postFridayWin(form); setShowForm(false); setForm({ tanggal:new Date().toISOString().slice(0,10), headline:'', penerima:'', pesan:'' }); load(); }
    catch {}
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    await api.deleteFridayWin(id); load();
  };

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'var(--text-2)' }}>Memuat...</div>;

  return (
    <div>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:20, fontWeight:800 }}>🏆 Friday Win</div>
          <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2 }}>Apresiasi pencapaian tim setiap Jumat</div>
        </div>
        <button className="btn btn-primary" onClick={() => setShowForm(!showForm)}>
          {showForm ? 'Tutup' : '+ Post Friday Win'}
        </button>
      </div>

      {showForm && (
        <div className="card" style={{ marginBottom:16 }}>
          <form onSubmit={handlePost}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase',
                  letterSpacing:'.05em', display:'block', marginBottom:5 }}>Tanggal *</label>
                <input type="date" value={form.tanggal} required
                  onChange={e => setForm(f=>({...f,tanggal:e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase',
                  letterSpacing:'.05em', display:'block', marginBottom:5 }}>Penerima apresiasi</label>
                <select value={form.penerima} onChange={e => setForm(f=>({...f,penerima:e.target.value}))}>
                  <option value="">— Tim / Semua —</option>
                  {TIM.map(t => <option key={t.id} value={t.nama}>{t.nama}</option>)}
                </select>
              </div>
            </div>
            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase',
                letterSpacing:'.05em', display:'block', marginBottom:5 }}>Headline / judul apresiasi *</label>
              <input value={form.headline} required onChange={e=>setForm(f=>({...f,headline:e.target.value}))}
                placeholder="Contoh: Ariel berhasil close 3 deal tanpa revisi minggu ini!" />
            </div>
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase',
                letterSpacing:'.05em', display:'block', marginBottom:5 }}>Pesan apresiasi</label>
              <textarea rows={3} value={form.pesan} onChange={e=>setForm(f=>({...f,pesan:e.target.value}))}
                placeholder="Ceritakan lebih lengkap tentang pencapaian ini..."
                style={{ resize:'vertical' }} />
            </div>
            <div style={{ display:'flex', gap:8 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Posting...' : '🏆 Post Friday Win'}
              </button>
              <button type="button" className="btn" onClick={() => setShowForm(false)}>Batal</button>
            </div>
          </form>
        </div>
      )}

      {list.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">🏆</div>
          <div className="empty-title">Belum ada Friday Win</div>
          <div className="empty-sub">Mulai rayakan pencapaian tim setiap Jumat!</div>
        </div>
      ) : list.map(w => {
        const member = TIM.find(t => t.nama === w.penerima);
        const tc = member ? (TIPE_COLOR[member.tipe]||{}) : {};
        const inits = w.penerima ? w.penerima.split(' ').slice(0,2).map(x=>x[0]).join('') : '🏆';
        return (
          <div key={w.id} className="card" style={{ marginBottom:10,
            border:'1px solid rgba(0,214,143,0.15)',
            background:'linear-gradient(135deg, var(--surface) 0%, var(--green-light) 100%)' }}>
            <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
              <div style={{
                width:44, height:44, borderRadius:12, flexShrink:0,
                background: tc.bg || 'var(--green-light)', color: tc.text || 'var(--green)',
                display:'flex', alignItems:'center', justifyContent:'center',
                fontSize: w.penerima ? 14 : 22, fontWeight:800,
                border:'2px solid rgba(0,214,143,0.2)',
              }}>{inits}</div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:14, fontWeight:800, marginBottom:3 }}>{w.headline}</div>
                {w.penerima && <div style={{ fontSize:11, color:'var(--green)', fontWeight:600, marginBottom:4 }}>untuk {w.penerima}</div>}
                {w.pesan    && <div style={{ fontSize:12, color:'var(--text-2)', lineHeight:1.5 }}>{w.pesan}</div>}
                <div style={{ fontSize:10, color:'var(--text-3)', marginTop:6 }}>
                  {new Date(w.tanggal).toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                  {' · oleh '}{w.posted_by}
                </div>
              </div>
              {user?.role === 'admin' && (
                <button onClick={() => handleDelete(w.id)} title="Hapus"
                  style={{ background:'none', border:'none', cursor:'pointer', fontSize:14,
                    color:'var(--text-3)', padding:4 }}
                  onMouseEnter={e=>e.currentTarget.style.color='var(--red)'}
                  onMouseLeave={e=>e.currentTarget.style.color='var(--text-3)'}>✕</button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── 1-ON-1 ─────────────────────────────────────────────────────────────────
const TIPE_1ON1 = [
  { id:'Check-in Rutin',       ico:'💬', durasi:30 },
  { id:'Evaluasi Naik Level',  ico:'📈', durasi:60 },
  { id:'Sesi At Risk',         ico:'💛', durasi:45 },
  { id:'Sesi Karier & Arah',   ico:'🧭', durasi:60 },
  { id:'Pasca Kejadian',       ico:'⚡', durasi:30 },
];

export function OneOnOne() {
  useAuth(); // untuk akses user di sub-komponen bila diperlukan
  const [sesi,     setSesi]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({
    tanggal: new Date().toISOString().slice(0,10),
    anggota:'', tipe:'', durasi_menit:30,
    ringkasan:'', tindak_lanjut:'',
    mood_sebelum:'', mood_sesudah:'',
  });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api.getSesi1on1().then(r => setSesi(r.data||[])).catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    try { await api.postSesi1on1(form); setShowForm(false); load(); }
    catch {}
    finally { setSaving(false); }
  };

  const PRIORITAS = TIM.filter(t => ['At Risk','High Potential'].includes(t.tipe) || t.kepuasan <= 6);
  const weekAgo   = new Date(Date.now() - 7*24*60*60*1000);
  const thisWeek  = sesi.filter(s => new Date(s.tanggal) >= weekAgo);
  const thisMonth = sesi.filter(s => new Date(s.tanggal).getMonth() === new Date().getMonth());

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'var(--text-2)' }}>Memuat...</div>;

  return (
    <div>
      <div className="metrics-grid" style={{ marginBottom:16 }}>
        <div className="metric">
          <div className="metric-val text-red">{PRIORITAS.length}</div>
          <div className="metric-lbl">Perlu perhatian</div>
        </div>
        <div className="metric">
          <div className="metric-val text-green">{thisWeek.length}</div>
          <div className="metric-lbl">Minggu ini</div>
        </div>
        <div className="metric">
          <div className="metric-val">{thisMonth.length}</div>
          <div className="metric-lbl">Bulan ini</div>
        </div>
        <div className="metric">
          <div className="metric-val">{sesi.length}</div>
          <div className="metric-lbl">Total sesi</div>
        </div>
      </div>

      {/* Tombol catat */}
      <button className="btn btn-primary" style={{ marginBottom:16 }} onClick={() => setShowForm(!showForm)}>
        {showForm ? 'Tutup' : '+ Catat Sesi 1-on-1'}
      </button>

      {/* Form catat sesi */}
      {showForm && (
        <div className="card" style={{ marginBottom:16 }}>
          <div className="card-title">Catat Sesi 1-on-1</div>
          <form onSubmit={handleSubmit}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase',
                  letterSpacing:'.05em', display:'block', marginBottom:5 }}>Tanggal *</label>
                <input type="date" value={form.tanggal} required
                  onChange={e=>setForm(f=>({...f,tanggal:e.target.value}))} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase',
                  letterSpacing:'.05em', display:'block', marginBottom:5 }}>Anggota *</label>
                <select value={form.anggota} required onChange={e=>setForm(f=>({...f,anggota:e.target.value}))}>
                  <option value="">— Pilih anggota —</option>
                  {TIM.map(t=><option key={t.id} value={t.nama}>{t.nama}</option>)}
                </select>
              </div>
            </div>

            <div style={{ marginBottom:10 }}>
              <label style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase',
                letterSpacing:'.05em', display:'block', marginBottom:6 }}>Tipe sesi *</label>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {TIPE_1ON1.map(t => (
                  <button key={t.id} type="button" onClick={() => setForm(f=>({...f,tipe:t.id,durasi_menit:t.durasi}))}
                    style={{ padding:'6px 11px', borderRadius:7, fontSize:12, cursor:'pointer',
                      border:`1px solid ${form.tipe===t.id ? 'var(--green)' : 'var(--border-2)'}`,
                      background: form.tipe===t.id ? 'var(--green-light)' : 'var(--surface)',
                      color: form.tipe===t.id ? 'var(--green)' : 'var(--text)',
                      fontWeight: form.tipe===t.id ? 600 : 400,
                    }}>{t.ico} {t.id}</button>
                ))}
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10, marginBottom:10 }}>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase',
                  letterSpacing:'.05em', display:'block', marginBottom:5 }}>Durasi (menit)</label>
                <input type="number" value={form.durasi_menit} min={15} max={120}
                  onChange={e=>setForm(f=>({...f,durasi_menit:parseInt(e.target.value)}))} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase',
                  letterSpacing:'.05em', display:'block', marginBottom:5 }}>Mood sebelum (1-10)</label>
                <input type="number" value={form.mood_sebelum} min={1} max={10}
                  onChange={e=>setForm(f=>({...f,mood_sebelum:parseInt(e.target.value)}))} />
              </div>
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase',
                  letterSpacing:'.05em', display:'block', marginBottom:5 }}>Mood sesudah (1-10)</label>
                <input type="number" value={form.mood_sesudah} min={1} max={10}
                  onChange={e=>setForm(f=>({...f,mood_sesudah:parseInt(e.target.value)}))} />
              </div>
            </div>

            {[
              { key:'ringkasan',     label:'Ringkasan sesi *',   ph:'Apa yang dibahas?', req:true, rows:3 },
              { key:'tindak_lanjut', label:'Tindak lanjut',      ph:'Apa yang perlu dilakukan setelah ini?', rows:2 },
            ].map(f => (
              <div key={f.key} style={{ marginBottom:10 }}>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase',
                  letterSpacing:'.05em', display:'block', marginBottom:5 }}>{f.label}</label>
                <textarea rows={f.rows} value={form[f.key]} required={f.req}
                  onChange={e=>setForm(x=>({...x,[f.key]:e.target.value}))}
                  placeholder={f.ph} style={{ resize:'vertical' }} />
              </div>
            ))}

            <div style={{ display:'flex', gap:8 }}>
              <button type="submit" className="btn btn-primary" disabled={saving}>
                {saving ? 'Menyimpan...' : '💾 Simpan Sesi'}
              </button>
              <button type="button" className="btn" onClick={()=>setShowForm(false)}>Batal</button>
            </div>
          </form>
        </div>
      )}

      {/* Prioritas 1-on-1 */}
      {PRIORITAS.length > 0 && (
        <div className="card" style={{ marginBottom:12 }}>
          <div className="card-title">Anggota yang perlu perhatian segera</div>
          {PRIORITAS.map(m => {
            const tc = TIPE_COLOR[m.tipe]||{};
            const lastSesi = sesi.filter(s => s.anggota === m.nama).sort((a,b)=>new Date(b.tanggal)-new Date(a.tanggal))[0];
            const daysSince = lastSesi ? Math.floor((Date.now()-new Date(lastSesi.tanggal))/(1000*60*60*24)) : null;
            return (
              <div key={m.id} className="member-row" style={{ padding:'8px 0' }}>
                <div className="avatar" style={{ width:28, height:28, background:tc.bg, color:tc.text, fontSize:11 }}>
                  {m.nama.split(' ').slice(0,2).map(w=>w[0]).join('')}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600 }}>{m.nama}</div>
                  <div style={{ fontSize:11, color:'var(--text-2)' }}>{m.divisi} · {m.tipe}</div>
                </div>
                <div style={{ textAlign:'right', fontSize:11 }}>
                  {daysSince !== null ? (
                    <span style={{ color: daysSince > 30 ? 'var(--red)' : 'var(--amber)' }}>
                      {daysSince} hari lalu
                    </span>
                  ) : (
                    <span style={{ color:'var(--red)' }}>Belum pernah</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Riwayat sesi */}
      {sesi.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">💬</div>
          <div className="empty-title">Belum ada sesi 1-on-1 tercatat</div>
          <div className="empty-sub">Mulai catat setiap sesi agar bisa dilacak progressnya</div>
        </div>
      ) : (
        <div className="card">
          <div className="card-title">Riwayat sesi 1-on-1</div>
          {sesi.slice(0,15).map(s => {
            const t = TIPE_1ON1.find(x=>x.id===s.tipe) || {};
            const member = TIM.find(m=>m.nama===s.anggota);
            const tc = member ? (TIPE_COLOR[member.tipe]||{}) : {};
            const moodDelta = s.mood_sesudah && s.mood_sebelum ? s.mood_sesudah - s.mood_sebelum : null;
            return (
              <div key={s.id} className="member-row" style={{ alignItems:'flex-start', padding:'10px 0' }}>
                <div style={{ fontSize:18, flexShrink:0, marginTop:2 }}>{t.ico||'💬'}</div>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:3 }}>
                    <div className="avatar" style={{ width:22, height:22, background:tc.bg||'var(--surface-2)',
                      color:tc.text||'var(--text-2)', fontSize:9 }}>
                      {s.anggota?.split(' ').slice(0,2).map(w=>w[0]).join('')}
                    </div>
                    <span style={{ fontSize:12, fontWeight:700 }}>{s.anggota}</span>
                    <span style={{ fontSize:11, color:'var(--text-3)', background:'var(--surface-2)',
                      padding:'1px 7px', borderRadius:99 }}>{s.tipe}</span>
                    <span style={{ fontSize:11, color:'var(--text-3)' }}>{s.durasi_menit} mnt</span>
                    {moodDelta !== null && (
                      <span style={{ fontSize:11, fontWeight:600,
                        color: moodDelta >= 0 ? 'var(--green)' : 'var(--red)' }}>
                        {moodDelta >= 0 ? '▲' : '▼'}{Math.abs(moodDelta)}
                      </span>
                    )}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-2)', marginBottom:2 }}>{s.ringkasan}</div>
                  {s.tindak_lanjut && (
                    <div style={{ fontSize:11, color:'var(--amber)' }}>→ {s.tindak_lanjut}</div>
                  )}
                </div>
                <div style={{ fontSize:10, color:'var(--text-3)', flexShrink:0, marginTop:2 }}>
                  {new Date(s.tanggal).toLocaleDateString('id-ID',{day:'numeric',month:'short'})}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
