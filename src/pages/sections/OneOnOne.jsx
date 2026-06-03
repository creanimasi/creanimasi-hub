import { useState, useEffect, useCallback } from 'react';
import { TIM, TIPE_COLOR } from '../../data/tim';
import { api } from '../../services/api';

const TIPE_1ON1 = [
  { id:'Check-in Rutin',       ico:'💬', durasi:30 },
  { id:'Evaluasi Naik Level',  ico:'📈', durasi:60 },
  { id:'Sesi At Risk',         ico:'💛', durasi:45 },
  { id:'Sesi Karier & Arah',   ico:'🧭', durasi:60 },
  { id:'Pasca Kejadian',       ico:'⚡', durasi:30 },
];

export function OneOnOne() {
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
