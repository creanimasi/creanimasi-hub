import { useState, useEffect, useCallback } from 'react';
import { TIPE_COLOR } from '../../data/tim';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useTim } from '../../hooks/useTim';
import { SkeletonList } from '../../components/Skeleton';

// ── FRIDAY WIN ─────────────────────────────────────────────────────────────
export function FridayWin() {
  const { user }   = useAuth();
  const tim        = useTim();
  const [list,     setList]     = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form,     setForm]     = useState({ tanggal: new Date().toISOString().slice(0,10), headline:'', penerima:'', pesan:'' });
  const [saving,   setSaving]   = useState(false);
  const [postErr,  setPostErr]  = useState('');
  const [deleteId, setDeleteId] = useState(null);
  const [deleteErr,setDeleteErr]= useState('');

  const load = useCallback(() => {
    api.getFridayWin().then(r => setList(r.data||[])).catch(()=>{}).finally(()=>setLoading(false));
  }, []);
  useEffect(() => { load(); }, [load]);

  const handlePost = async (e) => {
    e.preventDefault();
    setSaving(true);
    setPostErr('');
    try {
      await api.postFridayWin(form);
      setShowForm(false);
      setForm({ tanggal:new Date().toISOString().slice(0,10), headline:'', penerima:'', pesan:'' });
      load();
    } catch (err) { setPostErr(err.message || 'Gagal posting. Coba lagi.'); }
    finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    setDeleteErr('');
    try { await api.deleteFridayWin(id); setDeleteId(null); load(); }
    catch (err) { setDeleteErr(err.message || 'Gagal hapus. Coba lagi.'); }
  };

  if (loading) return <SkeletonList count={5} />;

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
                  {tim.map(t => <option key={t.id} value={t.nama}>{t.nama}</option>)}
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
            {postErr && (
              <div className="alert alert-red" style={{ marginBottom:8, fontSize:12 }}>
                <span>⚠️</span><div>{postErr}</div>
              </div>
            )}
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
        const member = tim.find(t => t.nama === w.penerima);
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
                <button onClick={() => { setDeleteId(w.id); setDeleteErr(''); }} title="Hapus"
                  style={{ background:'none', border:'none', cursor:'pointer', fontSize:14,
                    color:'var(--text-3)', padding:4 }}
                  onMouseEnter={e=>e.currentTarget.style.color='var(--red)'}
                  onMouseLeave={e=>e.currentTarget.style.color='var(--text-3)'}>✕</button>
              )}
            </div>
          </div>
        );
      })}

      {deleteId && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
          onClick={e => e.target===e.currentTarget && setDeleteId(null)}>
          <div style={{ background:'var(--surface)', borderRadius:14, padding:24,
            width:'100%', maxWidth:340, boxShadow:'0 8px 32px rgba(0,0,0,.18)' }}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:8 }}>Hapus Friday Win?</div>
            <div style={{ fontSize:13, color:'var(--text-2)', marginBottom: deleteErr ? 10 : 20 }}>
              Tindakan ini tidak bisa dibatalkan.
            </div>
            {deleteErr && <div style={{ fontSize:12, color:'var(--red)', marginBottom:12 }}>{deleteErr}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setDeleteId(null)}
                style={{ flex:1, padding:'9px', borderRadius:8, border:'1px solid var(--border-2)',
                  background:'var(--surface)', cursor:'pointer', fontSize:13 }}>Batal</button>
              <button onClick={() => handleDelete(deleteId)}
                style={{ flex:1, padding:'9px', borderRadius:8, border:'none',
                  background:'var(--red)', color:'#fff', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                Ya, Hapus
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

