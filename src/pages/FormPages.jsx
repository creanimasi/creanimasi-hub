import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import FormJurnal from '../components/FormJurnal';
import FormProfiling from '../components/FormProfiling';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';

export function PageFormJurnal() {
  const navigate    = useNavigate();
  const [submitted, setSubmitted] = useState(false);
  const bannerRef   = useRef(null);

  const handleSuccess = () => {
    setSubmitted(true);
    // Scroll ke banner sukses agar user pasti melihatnya
    setTimeout(() => bannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
  };

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div ref={bannerRef} />
      {submitted ? (
        <div className="alert alert-green" style={{ marginBottom: 16 }}>
          <span>✅</span>
          <div>
            <strong>Jurnal minggu ini sudah tersimpan!</strong>
            <div style={{ marginTop:4, fontSize:12 }}>Sampai Jumat depan. Konsistensi adalah kuncinya 💪</div>
          </div>
          <button onClick={() => navigate('/jurnal/riwayat')}
            style={{ marginLeft:'auto', padding:'5px 12px', borderRadius:7, flexShrink:0,
              border:'1px solid var(--green)', background:'var(--green-light)',
              color:'var(--green)', cursor:'pointer', fontSize:11, fontWeight:600 }}>
            Lihat Riwayat →
          </button>
        </div>
      ) : (
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div className="alert alert-green" style={{ flex:1, margin:0 }}>
            <span>📓</span>
            <div>Isi jurnal ini setiap <strong>Jumat</strong>. Butuh waktu sekitar 10 menit.</div>
          </div>
          <button onClick={() => navigate('/jurnal/riwayat')}
            style={{ marginLeft:12, padding:'7px 14px', borderRadius:8, flexShrink:0,
              border:'1px solid var(--border-2)', background:'var(--surface-2)',
              color:'var(--text-2)', cursor:'pointer', fontSize:12, fontWeight:600 }}>
            📋 Riwayat
          </button>
        </div>
      )}
      {!submitted && <FormJurnal onSuccess={handleSuccess} />}
    </div>
  );
}

export function PageRiwayatJurnal() {
  const { user }  = useAuth();
  const navigate  = useNavigate();
  const [entries, setEntries]  = useState([]);
  const [loading, setLoading]  = useState(true);
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!user?.nama) return;
    api.getJurnal(user.nama)
      .then(res => setEntries(res.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div style={{ textAlign:'center', padding:40, color:'var(--text-2)' }}>Memuat riwayat...</div>;

  return (
    <div style={{ maxWidth:680, margin:'0 auto' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
        <button onClick={() => navigate('/jurnal/isi')}
          style={{ background:'none', border:'none', cursor:'pointer', fontSize:14,
            color:'var(--text-2)', padding:0 }}>← Kembali</button>
        <div style={{ flex:1, fontSize:15, fontWeight:700 }}>Riwayat Jurnal Saya</div>
        <span style={{ fontSize:12, color:'var(--text-3)' }}>{entries.length} entri</span>
      </div>

      {entries.length === 0 ? (
        <div style={{ textAlign:'center', padding:'40px 20px' }}>
          <div style={{ fontSize:36, marginBottom:12 }}>📓</div>
          <div style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>Belum ada jurnal</div>
          <div style={{ fontSize:12, color:'var(--text-2)', marginBottom:16 }}>Jurnal pertamamu akan muncul di sini setelah kamu mengisinya.</div>
          <button className="btn btn-primary" onClick={() => navigate('/jurnal/isi')}>Isi Jurnal Sekarang</button>
        </div>
      ) : entries.map((j, i) => {
        const isOpen    = expanded === i;
        const tgl       = new Date(j.tanggal_jurnal || j.created_at);
        const moodColor = j.mood >= 7 ? 'var(--green)' : j.mood >= 5 ? 'var(--amber)' : 'var(--red)';
        const moodLabel = j.mood >= 7 ? '😊' : j.mood >= 5 ? '😐' : '😔';
        return (
          <div key={i} className="card" style={{ marginBottom:10, cursor:'pointer' }}
            onClick={() => setExpanded(isOpen ? null : i)}>
            {/* Header baris */}
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              {/* Mood circle */}
              <div style={{
                width:42, height:42, borderRadius:12, flexShrink:0,
                background:`${moodColor}18`, border:`2px solid ${moodColor}40`,
                display:'flex', alignItems:'center', justifyContent:'center',
                flexDirection:'column', gap:1,
              }}>
                <span style={{ fontSize:16 }}>{moodLabel}</span>
                <span style={{ fontSize:9, fontWeight:700, color:moodColor }}>{j.mood}/10</span>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, fontWeight:700, marginBottom:2 }}>
                  {j.pencapaian_1 || '(Tanpa judul)'}
                </div>
                <div style={{ fontSize:11, color:'var(--text-3)' }}>
                  {tgl.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                </div>
              </div>
              {/* Mini scores */}
              <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                {[
                  { label:'Karya', val:j.skor_karya },
                  { label:'Waktu', val:j.skor_waktu },
                  { label:'Kom',   val:j.skor_komunikasi },
                  { label:'Skill', val:j.skor_skill },
                ].map(s => (
                  <div key={s.label} style={{ textAlign:'center', width:32 }}>
                    <div style={{ fontSize:12, fontWeight:700, color:s.val>=4?'var(--green)':s.val>=3?'var(--amber)':'var(--red)' }}>{s.val||0}</div>
                    <div style={{ fontSize:8, color:'var(--text-3)', letterSpacing:'.03em' }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <span style={{ fontSize:11, color:'var(--text-3)', flexShrink:0 }}>{isOpen?'▲':'▼'}</span>
            </div>

            {/* Detail expand */}
            {isOpen && (
              <div style={{ marginTop:14, paddingTop:14, borderTop:'1px solid var(--border)',
                display:'flex', flexDirection:'column', gap:10 }}>
                {[
                  { label:'🏆 Pencapaian 1', val:j.pencapaian_1 },
                  { label:'🏆 Pencapaian 2', val:j.pencapaian_2 },
                  { label:'🏆 Pencapaian 3', val:j.pencapaian_3 },
                  { label:'⚡ Hambatan',     val:j.hambatan },
                  { label:'💡 Pelajaran',    val:j.pelajaran },
                  { label:'🎯 Target depan', val:j.target_depan },
                ].filter(x => x.val).map(x => (
                  <div key={x.label}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)',
                      textTransform:'uppercase', letterSpacing:'.05em', marginBottom:3 }}>{x.label}</div>
                    <div style={{ fontSize:12 }}>{x.val}</div>
                  </div>
                ))}
                {j.catatan_mentor && (
                  <div style={{ padding:'8px 12px', background:'var(--surface-2)',
                    borderRadius:8, borderLeft:'3px solid var(--green)' }}>
                    <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', marginBottom:3 }}>💌 CATATAN UNTUK MENTOR</div>
                    <div style={{ fontSize:12, fontStyle:'italic' }}>{j.catatan_mentor}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function PageFormProfiling() {
  const [submitted, setSubmitted] = useState(false);
  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="alert alert-green" style={{ marginBottom: 16 }}>
        <span>👤</span>
        <div>Form ini diisi <strong>sekali</strong> saat bergabung, lalu diperbarui setiap 3 bulan. Jawab sejujurnya — tidak ada jawaban yang salah.</div>
      </div>
      {submitted && (
        <div className="alert alert-green" style={{ marginBottom: 16 }}>
          <span>🎉</span>
          <div>Profiling berhasil! Data kamu sudah masuk ke sistem Creanimasi.</div>
        </div>
      )}
      <FormProfiling onSuccess={() => setSubmitted(true)} />
    </div>
  );
}
