import { useState, useEffect } from 'react';
import { TIPE_COLOR } from '../../data/tim';
import { useTim } from '../../hooks/useTim';
import { api } from '../../services/api';
import { downloadCsv } from '../../utils/exportCsv';

// Pisah catatan_mentor menjadi pesan member dan reply admin.
// Format baru: "pesan_member\n[ADMIN_REPLY]\nreply_admin"
// Format lama (backward compat): "[ADMIN_REPLY] reply" atau "[ADMIN_REPLY]\nreply"
function parseCatatanMentor(cm) {
  if (!cm) return { pesanMember: '', replyAdmin: '' };
  const SEP = '\n[ADMIN_REPLY]\n';
  const idx = cm.indexOf(SEP);
  if (idx !== -1) {
    return { pesanMember: cm.slice(0, idx).trim(), replyAdmin: cm.slice(idx + SEP.length).trim() };
  }
  if (cm.startsWith('[ADMIN_REPLY]\n')) return { pesanMember: '', replyAdmin: cm.slice('[ADMIN_REPLY]\n'.length).trim() };
  if (cm.startsWith('[ADMIN_REPLY] ')) return { pesanMember: '', replyAdmin: cm.slice('[ADMIN_REPLY] '.length).trim() };
  return { pesanMember: cm.trim(), replyAdmin: '' };
}

// ── JURNAL ─────────────────────────────────────────────────────────────────
export function Jurnal() {
  const tim = useTim();
  const [entries,    setEntries]    = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [expanded,   setExpanded]   = useState(null);
  const [filterNama, setFilterNama] = useState('');
  const [showLimit,  setShowLimit]  = useState(10);
  const [replyOpen,  setReplyOpen]  = useState(null); // jurnal id yang dibuka reply-nya
  const [replyText,  setReplyText]  = useState('');
  const [replySaving,setReplySaving]= useState(false);

  const [replyErr, setReplyErr] = useState('');

  const handleReply = async (id) => {
    if (!replyText.trim()) return;
    setReplySaving(true); setReplyErr('');
    try {
      await api.replyJurnal(id, replyText);
      setEntries(prev => prev.map(e => {
        if (e.id !== id) return e;
        const { pesanMember } = parseCatatanMentor(e.catatan_mentor);
        const newCm = pesanMember
          ? `${pesanMember}\n[ADMIN_REPLY]\n${replyText}`
          : `[ADMIN_REPLY]\n${replyText}`;
        return { ...e, catatan_mentor: newCm };
      }));
      setReplyOpen(null); setReplyText('');
    } catch (err) { setReplyErr(err.message || 'Gagal menyimpan balasan'); }
    finally { setReplySaving(false); }
  };

  const [loadErr, setLoadErr] = useState('');

  useEffect(() => {
    api.getJurnal()
      .then(res => setEntries(res.data || []))
      .catch(err => setLoadErr(err.message || 'Gagal memuat jurnal'))
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

  // Gabung dengan daftar tim untuk tampilkan yang belum isi
  const data = tim.map(t => ({
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

  if (loadErr) return (
    <div className="alert alert-red"><span>⚠️</span><div>{loadErr}</div></div>
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
        <div className="metric"><div className="metric-val">{data.length > 0 ? Math.round(sudahIsi.length / data.length * 100) : 0}%</div><div className="metric-lbl">Konsistensi</div></div>
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
                  {(() => {
                    const { pesanMember, replyAdmin } = parseCatatanMentor(j.catatan_mentor);
                    return (
                      <>
                        {pesanMember && (
                          <div style={{ marginTop:8, padding:'6px 10px', background:'var(--surface-3, var(--surface))',
                            borderRadius:8, borderLeft:'2px solid var(--green)' }}>
                            <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)', marginBottom:3 }}>
                              PESAN DARI {j.nama.split(' ')[0].toUpperCase()} KE KOORDINATOR
                            </div>
                            <div style={{ fontSize:11, fontStyle:'italic', color:'var(--text-2)' }}>
                              💌 {pesanMember}
                            </div>
                          </div>
                        )}
                        {replyAdmin && (
                          <div style={{ marginTop:8, padding:'6px 10px', background:'var(--amber-light)',
                            borderRadius:8, borderLeft:'2px solid var(--amber)' }}>
                            <div style={{ fontSize:9, fontWeight:700, color:'var(--amber)', marginBottom:3 }}>
                              BALASAN KOORDINATOR
                            </div>
                            <div style={{ fontSize:11, color:'var(--text)' }}>
                              {replyAdmin}
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                  {/* Tombol balas jurnal */}
                  {replyOpen === j.id ? (
                    <div style={{ marginTop:10 }}>
                      <textarea rows={2} value={replyText}
                        onChange={e => setReplyText(e.target.value)}
                        placeholder={`Balas ke ${j.nama.split(' ')[0]}...`}
                        style={{ resize:'vertical', fontSize:12, marginBottom:6 }} />
                      <div style={{ display:'flex', gap:6 }}>
                        <button className="btn btn-primary" style={{ fontSize:11 }}
                          disabled={replySaving} onClick={() => handleReply(j.id)}>
                          {replySaving ? 'Menyimpan...' : '✉️ Kirim Balasan'}
                        </button>
                        <button className="btn" style={{ fontSize:11 }}
                          onClick={() => { setReplyOpen(null); setReplyText(''); setReplyErr(''); }}>Batal</button>
                      </div>
                      {replyErr && <div style={{ fontSize:11, color:'var(--red)', marginTop:4 }}>{replyErr}</div>}
                    </div>
                  ) : (
                    <button onClick={() => { setReplyOpen(j.id); setReplyText(''); }}
                      style={{ marginTop:8, background:'none', border:'1px solid var(--border-2)',
                        borderRadius:7, padding:'4px 10px', cursor:'pointer', fontSize:11,
                        color:'var(--text-3)', transition:'color .15s' }}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--green)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
                      ↩ Balas ke {j.nama.split(' ')[0]}
                    </button>
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
          <div className="card-title" style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span>Riwayat jurnal ({entries.length} entri)</span>
            <div style={{ display:'flex', gap:8 }}>
              <select value={filterNama} onChange={e => { setFilterNama(e.target.value); setShowLimit(10); }}
                style={{ fontSize:11, padding:'3px 8px', width:'auto' }}>
                <option value="">Semua anggota</option>
                {tim.map(t => <option key={t.id} value={t.nama}>{t.nama.split(' ')[0]}</option>)}
              </select>
              <button className="btn btn-sm no-print" onClick={() => {
                const rows = entries.map(e => ({
                  nama:e.nama, tanggal:e.tanggal_jurnal, mood:e.mood,
                  pencapaian:e.pencapaian_1, hambatan:e.hambatan, target:e.target_depan
                }));
                downloadCsv('jurnal_export.csv', rows, ['nama','tanggal','mood','pencapaian','hambatan','target']);
              }} style={{ fontSize:11, padding:'3px 10px' }}>⬇ CSV</button>
            </div>
          </div>
          {(() => {
            const filtered = filterNama ? entries.filter(e => e.nama === filterNama) : entries;
            const visible  = filtered.slice(0, showLimit);
            return (
              <>
                {visible.map((e, i) => (
                  <div key={i} className="member-row" style={{ fontSize:11 }}>
                    <div style={{ width:8, height:8, borderRadius:'50%', flexShrink:0,
                      background: e.mood >= 7 ? 'var(--green)' : e.mood >= 5 ? 'var(--amber)' : 'var(--red)' }} />
                    <span style={{ fontWeight:600, width:130, flexShrink:0 }}>{e.nama.split(' ')[0]}</span>
                    <span style={{ color:'var(--text-2)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {e.pencapaian_1 || '—'}
                    </span>
                    <span style={{ fontSize:10, fontWeight:700,
                      color: e.mood >= 7 ? 'var(--green)' : e.mood >= 5 ? 'var(--amber)' : 'var(--red)',
                      marginLeft:6, flexShrink:0 }}>{e.mood}/10</span>
                    <span style={{ color:'var(--text-3)', flexShrink:0, marginLeft:6 }}>
                      {new Date(e.tanggal_jurnal || e.created_at).toLocaleDateString('id-ID', { day:'numeric', month:'short' })}
                    </span>
                  </div>
                ))}
                {filtered.length > showLimit && (
                  <button onClick={() => setShowLimit(l => l + 10)}
                    className="btn" style={{ width:'100%', marginTop:8, fontSize:11, padding:'5px' }}>
                    Tampilkan lebih banyak (+{Math.min(10, filtered.length - showLimit)} dari {filtered.length - showLimit} tersisa)
                  </button>
                )}
                {filtered.length === 0 && (
                  <div style={{ textAlign:'center', padding:'12px 0', fontSize:12, color:'var(--text-3)' }}>
                    Belum ada jurnal dari {filterNama}.
                  </div>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}

