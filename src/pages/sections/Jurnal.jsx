import { useState, useEffect } from 'react';
import { TIM, TIPE_COLOR } from '../../data/tim';
import { api } from '../../services/api';
import { downloadCsv } from '../../utils/exportCsv';

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

