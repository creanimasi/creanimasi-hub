import { useState, useEffect, useCallback } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useTim } from '../../hooks/useTim';
import { SkeletonList } from '../../components/Skeleton';

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
  const tim         = useTim();
  const isAdmin     = user?.role === 'admin';
  const timData     = tim.find(t => t.nama === user?.nama);
  const [list,      setList]      = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [showForm,  setShowForm]  = useState(false);
  const [tipe,      setTipe]      = useState('');
  const [form,      setForm]      = useState({ judul:'', deskripsi:'', latar_belakang:'', tujuan:'', output:'', timeline:'', kebutuhan:'', risiko:'', ukuran_sukses:'', komitmen:'' });
  const [saving,    setSaving]    = useState(false);
  const [expanded,  setExpanded]  = useState(null);
  const [review,    setReview]    = useState({});
  const [submitErr, setSubmitErr] = useState('');
  const [reviewErr, setReviewErr] = useState({});

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
    setSaving(true); setSubmitErr('');
    try {
      await api.simpanSKB({ ...form, tipe, nama: user?.nama, divisi: timData?.divisi, level: timData?.level, status:'diajukan' });
      setShowForm(false); setTipe('');
      setForm({ judul:'', deskripsi:'', latar_belakang:'', tujuan:'', output:'', timeline:'', kebutuhan:'', risiko:'', ukuran_sukses:'', komitmen:'' });
      load();
    } catch (err) {
      setSubmitErr(err.message || 'Gagal menyimpan SKB. Coba lagi.');
    } finally { setSaving(false); }
  };

  const handleReview = async (id, status) => {
    const catatan = review[id] || '';
    setReviewErr(e => ({ ...e, [id]: '' }));
    try {
      await api.updateSKB(id, { status, catatan_review: catatan, reviewer: user?.nama });
      load();
    } catch (err) {
      setReviewErr(e => ({ ...e, [id]: err.message || 'Gagal update status.' }));
    }
  };

  const myList   = isAdmin ? list : list.filter(s => s.nama === user?.nama);
  const pending  = list.filter(s => s.status === 'diajukan').length;
  const active   = list.filter(s => s.status === 'disetujui').length;
  const done     = list.filter(s => s.status === 'selesai').length;

  if (loading) return <SkeletonList count={5} />;

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
              {submitErr && (
                <div className="alert alert-red" style={{ marginBottom:8, fontSize:12 }}>
                  <span>⚠️</span><div>{submitErr}</div>
                </div>
              )}
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
                    {reviewErr[s.id] && (
                      <div className="alert alert-red" style={{ fontSize:11 }}>
                        <span>⚠️</span><div>{reviewErr[s.id]}</div>
                      </div>
                    )}
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

