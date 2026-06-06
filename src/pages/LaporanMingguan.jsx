import { useState, useEffect, useRef, useCallback } from 'react';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { TIM } from '../data/tim';
import { api } from '../services/api';

// ── PREVIEW PDF ────────────────────────────────────────────────────────────────
// Desain mengikuti laporan asli: dark background, layout terstruktur
function LaporanPreview({ laporan }) {
  const { tanggal, judul, kas, marketing, produksi, akun = [], sdm = [] } = laporan;
  const tgl = new Date(tanggal);
  const hariNama = tgl.toLocaleDateString('id-ID', { weekday: 'long' });
  const tglFormatted = tgl.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });

  const fmtUSD = (n) => `$${parseFloat(n||0).toLocaleString('en-US', { minimumFractionDigits:0 })}`;
  const fmtIDR = (n) => `Rp ${parseFloat(n||0).toLocaleString('id-ID')}`;

  return (
    <div style={{
      fontFamily: "'Inter', sans-serif",
      background: '#1a1f2e', color: '#e8eaf0',
      padding: '48px 56px', width: 794, minHeight: 1123,
      boxSizing: 'border-box', lineHeight: 1.6,
    }}>
      {/* Header tanggal */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', marginBottom: 8 }}>
          {hariNama} - {tgl.getDate().toString().padStart(2,'0')} - {(tgl.getMonth()+1).toString().padStart(2,'0')} - {tgl.getFullYear()}
        </div>
        <div style={{ fontSize: 14, color: '#a0a8c0', fontWeight: 600 }}>
          {hariNama}, {tglFormatted}
        </div>
        <div style={{ fontSize: 14, color: '#a0a8c0', marginTop: 4 }}>
          Selamat siang, izin menyampaikan update perkembangan {judul}:
        </div>
      </div>

      {/* FINANSIAL */}
      <Section title="Finansial" />
      {akun.map((a, i) => (
        <div key={i} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 10 }}>
            Akun {a.nama_akun}
          </div>
          {[
            { label: 'Available for Withdraw', val: fmtUSD(a.available_withdraw) },
            { label: 'Payment Being Cleared',  val: fmtUSD(a.payment_clearing) },
            { label: 'Active Order',            val: fmtUSD(a.active_order) },
            { label: 'Total Withdraw',          val: fmtUSD(a.total_withdraw) },
          ].map(item => (
            <div key={item.label} style={{ display:'flex', alignItems:'center', gap:8, fontSize:14, marginBottom:6 }}>
              <span style={{ color:'#6b7280', fontSize:8 }}>●</span>
              <span style={{ color:'#c8cfe0' }}>{item.label}: <strong style={{ color:'#fff' }}>{item.val}</strong></span>
            </div>
          ))}
        </div>
      ))}
      {kas > 0 && (
        <div style={{ fontSize: 14, fontWeight: 700, color: '#c8cfe0', marginBottom: 8 }}>
          Kas: <span style={{ color: '#fff' }}>{fmtIDR(kas)}</span>
        </div>
      )}
      <Divider />

      {/* MARKETING */}
      {marketing && (
        <>
          <Section title="Marketing" />
          <div style={{ fontSize: 14, color: '#c8cfe0', marginBottom: 8 }}>{marketing}</div>
          <Divider />
        </>
      )}

      {/* PRODUKSI */}
      {produksi && (
        <>
          <Section title="Produksi" />
          <div style={{ fontSize: 14, color: '#c8cfe0', marginBottom: 8 }}>{produksi}</div>
          <Divider />
        </>
      )}

      {/* SDM */}
      {sdm.filter(s => s.catatan?.trim()).length > 0 && (
        <>
          <Section title="SDM" />
          {sdm.filter(s => s.catatan?.trim()).map((s, i) => (
            <div key={i} style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                {s.nama}
              </div>
              <div style={{ fontSize: 13, color: '#c8cfe0', whiteSpace: 'pre-wrap' }}>{s.catatan}</div>
              {i < sdm.filter(x=>x.catatan?.trim()).length - 1 && (
                <div style={{ height:1, background:'#2d3448', margin:'12px 0' }} />
              )}
            </div>
          ))}
          <Divider />
        </>
      )}

      {/* Footer */}
      <div style={{ marginTop: 24, fontSize: 14, color: '#a0a8c0' }}>
        Demikian update perkembangan {judul}.<br />
        Terima kasih 🙏
      </div>
    </div>
  );
}

function Section({ title }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:16, marginTop:8 }}>
      <span style={{ color:'#6b7280', fontSize:14 }}>›</span>
      <span style={{ fontSize:24, fontWeight:900, color:'#fff' }}>{title}</span>
    </div>
  );
}

function Divider() {
  return <div style={{ height:1, background:'#2d3448', margin:'20px 0' }} />;
}

// ── FORM LAPORAN ───────────────────────────────────────────────────────────────
const DEFAULT_FORM = () => ({
  tanggal:   new Date().toISOString().slice(0,10),
  judul:     'Flipspace',
  kas:       '',
  marketing: '',
  produksi:  '',
  akun:      [{ nama_akun:'', available_withdraw:'', payment_clearing:'', active_order:'', total_withdraw:'' }],
  sdm:       TIM.map(t => ({ nama: t.nama, catatan: '' })),
});

function FormLaporan({ initial, onSave, onCancel, saving, error }) {
  const [form,        setForm]       = useState(initial || DEFAULT_FORM());
  const [analisa,     setAnalisa]    = useState(false);
  const [analisaInfo, setAnalisaInfo]= useState('');
  const [localErr,    setLocalErr]   = useState('');

  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const setAkun = (i, k, v) => setForm(f => {
    const akun = f.akun.map((a, idx) => idx === i ? { ...a, [k]: v } : a);
    return { ...f, akun };
  });

  const addAkun = () => setForm(f => ({
    ...f,
    akun: [...f.akun, { nama_akun:'', available_withdraw:'', payment_clearing:'', active_order:'', total_withdraw:'' }]
  }));

  const removeAkun = (i) => setForm(f => ({ ...f, akun: f.akun.filter((_,idx)=>idx!==i) }));

  const setSdm = (i, v) => setForm(f => ({
    ...f, sdm: f.sdm.map((s, idx) => idx === i ? { ...s, catatan: v } : s)
  }));

  const handleAutoFill = async () => {
    if (!form.tanggal) { setLocalErr('Isi tanggal laporan dulu'); return; }
    setLocalErr(''); setAnalisa(true); setAnalisaInfo('');
    try {
      const res = await api.getAnalisisSdm(form.tanggal);
      const hasil = res.data || [];
      const isiJurnal = hasil.filter(h => h.isi_jurnal).length;
      setAnalisaInfo(`${isiJurnal} dari ${hasil.length} anggota isi jurnal minggu ini (${res.periode?.dari} – ${res.periode?.sampai})`);

      // Update SDM di form: merge hasil analisa ke daftar SDM yang ada
      setForm(f => ({
        ...f,
        sdm: f.sdm.map(s => {
          const found = hasil.find(h => h.nama === s.nama);
          return found ? { ...s, catatan: found.catatan } : s;
        })
      }));
    } catch (err) {
      setLocalErr('Gagal generate analisa: ' + (err.message || 'coba lagi'));
    } finally { setAnalisa(false); }
  };

  const inputStyle = { fontSize: 13, padding: '7px 10px', marginBottom: 0 };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text-2)',
    textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 };

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} style={{ maxWidth: 800 }}>
      {(error || localErr) && (
        <div className="alert alert-red" style={{ marginBottom:16, fontSize:12 }}>
          <span>⚠️</span><div>{error || localErr}</div>
        </div>
      )}

      {/* Info dasar */}
      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--green)', marginBottom:12 }}>📋 Info Laporan</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:10 }}>
          <div>
            <label style={labelStyle}>Tanggal *</label>
            <input type="date" value={form.tanggal} required
              onChange={e=>setField('tanggal',e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Judul / Studio *</label>
            <input value={form.judul} required
              onChange={e=>setField('judul',e.target.value)}
              placeholder="Flipspace / Creillustra / dll"
              style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Kas (Rupiah)</label>
            <input type="number" value={form.kas}
              onChange={e=>setField('kas',e.target.value)}
              placeholder="0" style={inputStyle} />
          </div>
        </div>
      </div>

      {/* Akun keuangan */}
      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--blue)' }}>💰 Data Akun Platform</div>
          <button type="button" className="btn btn-sm" onClick={addAkun} style={{ fontSize:11 }}>
            + Tambah Akun
          </button>
        </div>
        {form.akun.map((a, i) => (
          <div key={i} style={{ marginBottom:12, padding:'10px 12px', background:'var(--surface-2)',
            borderRadius:10, border:'1px solid var(--border)' }}>
            <div style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center' }}>
              <input value={a.nama_akun}
                onChange={e=>setAkun(i,'nama_akun',e.target.value)}
                placeholder="Nama Akun (mis: Akun Flipspace)"
                style={{ ...inputStyle, flex:1 }} />
              {form.akun.length > 1 && (
                <button type="button" onClick={()=>removeAkun(i)}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'var(--red)', fontSize:16, padding:4 }}>✕</button>
              )}
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:8 }}>
              {[
                {k:'available_withdraw', label:'Available Withdraw ($)'},
                {k:'payment_clearing',   label:'Payment Clearing ($)'},
                {k:'active_order',       label:'Active Order ($)'},
                {k:'total_withdraw',     label:'Total Withdraw ($)'},
              ].map(f => (
                <div key={f.k}>
                  <label style={{ ...labelStyle, fontSize:9 }}>{f.label}</label>
                  <input type="number" value={a[f.k]}
                    onChange={e=>setAkun(i,f.k,e.target.value)}
                    placeholder="0" style={{ ...inputStyle, fontSize:12 }} />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Marketing & Produksi */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
        {[
          { key:'marketing', label:'📢 Marketing', color:'var(--amber)',   ph:'Catatan kegiatan marketing minggu ini...' },
          { key:'produksi',  label:'⚙️ Produksi',  color:'var(--purple)', ph:'Update workflow dan kendala produksi...' },
        ].map(s => (
          <div key={s.key} className="card">
            <div style={{ fontSize:13, fontWeight:700, color:s.color, marginBottom:10 }}>{s.label}</div>
            <textarea rows={5} value={form[s.key]}
              onChange={e=>setField(s.key,e.target.value)}
              placeholder={s.ph}
              style={{ resize:'vertical', fontSize:13 }} />
          </div>
        ))}
      </div>

      {/* SDM per anggota */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
          <div style={{ fontSize:13, fontWeight:700, color:'var(--coral)' }}>👥 SDM — Update Per Anggota</div>
          <button type="button" onClick={handleAutoFill} disabled={analisa}
            style={{
              padding:'7px 14px', borderRadius:8, fontSize:12, cursor: analisa ? 'wait' : 'pointer',
              background:'linear-gradient(135deg, var(--purple-light), var(--green-light))',
              border:'1px solid rgba(155,143,255,0.3)', color:'var(--text)',
              fontWeight:600, display:'flex', alignItems:'center', gap:6,
            }}>
            {analisa ? (
              <><span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⏳</span> Menganalisa...</>
            ) : (
              <><span>🤖</span> Auto-fill dari Jurnal</>
            )}
          </button>
        </div>

        {analisaInfo && (
          <div style={{ marginBottom:10, padding:'8px 12px', borderRadius:8,
            background:'var(--green-light)', border:'1px solid rgba(0,214,143,0.2)',
            fontSize:11, color:'var(--green)', fontWeight:600 }}>
            ✅ {analisaInfo} — teks sudah diisi otomatis, bisa diedit.
          </div>
        )}

        <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:12 }}>
          Kosongkan jika tidak ada update. Hanya anggota yang terisi yang akan muncul di PDF.
        </div>
        {form.sdm.map((s, i) => (
          <div key={i} style={{ marginBottom:10 }}>
            <label style={{ ...labelStyle, color:'var(--text)', fontWeight:600, textTransform:'none', fontSize:12 }}>
              {s.nama}
            </label>
            <textarea rows={2} value={s.catatan}
              onChange={e=>setSdm(i,e.target.value)}
              placeholder={`Update untuk ${s.nama.split(' ')[0]}...`}
              style={{ resize:'vertical', fontSize:12, minHeight:52 }} />
          </div>
        ))}
      </div>

      <div style={{ display:'flex', gap:8 }}>
        <button type="submit" className="btn btn-primary" disabled={saving}>
          {saving ? 'Menyimpan...' : '💾 Simpan Laporan'}
        </button>
        <button type="button" className="btn" onClick={onCancel}>Batal</button>
      </div>
    </form>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────────
export default function LaporanMingguan() {
  const [daftar,   setDaftar]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState('list');   // 'list' | 'form' | 'preview'
  const [selected, setSelected] = useState(null);    // laporan detail
  const [editData, setEditData] = useState(null);    // form initial data
  const [saving,      setSaving]      = useState(false);
  const [formErr,     setFormErr]     = useState('');
  const [genPdf,      setGenPdf]      = useState(false);
  const [confirmHapus,setConfirmHapus]= useState(null); // id laporan yang akan dihapus
  const [hapusErr,    setHapusErr]    = useState('');
  const previewRef = useRef(null);

  const loadDaftar = useCallback(() => {
    api.getLaporan()
      .then(r => setDaftar(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadDaftar(); }, [loadDaftar]);

  const handleBuat = () => {
    setEditData(null);
    setFormErr('');
    setView('form');
  };

  const handleEdit = async (id) => {
    try {
    const r = await api.getLaporanById(id);
    const d = r.data;
    // Map SDM: pastikan semua anggota TIM ada (merge dengan data tersimpan)
    const sdmMap = {};
    (d.sdm || []).forEach(s => { sdmMap[s.nama] = s.catatan; });
    const sdm = TIM.map(t => ({ nama: t.nama, catatan: sdmMap[t.nama] || '' }));
    setEditData({ ...d, sdm });
    setFormErr('');
    setView('form');
    } catch (err) { setFormErr(err.message || 'Gagal memuat laporan'); }
  };

  const handleSave = async (form) => {
    setSaving(true); setFormErr('');
    try {
      if (editData?.id) {
        await api.updateLaporan(editData.id, form);
      } else {
        await api.buatLaporan(form);
      }
      await loadDaftar();
      setView('list');
    } catch (err) {
      setFormErr(err.message || 'Gagal menyimpan laporan.');
    } finally { setSaving(false); }
  };

  const handleHapus = async (id) => {
    setHapusErr('');
    try { await api.hapusLaporan(id); setConfirmHapus(null); loadDaftar(); }
    catch (err) { setHapusErr(err.message || 'Gagal hapus'); }
  };

  const handlePreview = async (id) => {
    try {
      const r = await api.getLaporanById(id);
      setSelected(r.data);
      setView('preview');
    } catch (err) { setFormErr(err.message || 'Gagal memuat preview'); }
  };

  const handleDownloadPdf = async () => {
    if (!previewRef.current) return;
    setGenPdf(true);
    try {
      const canvas = await html2canvas(previewRef.current, {
        scale: 2, useCORS: true, backgroundColor: '#1a1f2e',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = pdf.internal.pageSize.getWidth();
      const pageH = pdf.internal.pageSize.getHeight();
      const imgW = pageW;
      const imgH = (canvas.height * imgW) / canvas.width;

      let y = 0;
      while (y < imgH) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, -y, imgW, imgH);
        y += pageH;
      }

      const tgl = selected.tanggal?.slice(0,10).replace(/-/g,'_');
      pdf.save(`Laporan_${selected.judul}_${tgl}.pdf`);
    } catch (err) {
      alert('Gagal generate PDF: ' + err.message);
    } finally { setGenPdf(false); }
  };

  // ── LIST VIEW ──
  if (view === 'list') return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:800 }}>📄 Laporan Mingguan</div>
          <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2 }}>
            Buat dan download laporan mingguan dalam format PDF
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleBuat}>+ Buat Laporan</button>
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--text-2)' }}>Memuat...</div>
      ) : daftar.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📄</div>
          <div className="empty-title">Belum ada laporan</div>
          <div className="empty-sub">Klik "Buat Laporan" untuk membuat laporan mingguan pertama</div>
          <button className="btn btn-primary" style={{ marginTop:12 }} onClick={handleBuat}>
            + Buat Laporan Pertama
          </button>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {daftar.map(l => {
            const tgl = new Date(l.tanggal);
            return (
              <div key={l.id} className="card" style={{ display:'flex', alignItems:'center', gap:14 }}>
                <div style={{
                  width:48, height:48, borderRadius:12, flexShrink:0,
                  background:'var(--purple-light)', color:'var(--purple)',
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                }}>
                  <div style={{ fontSize:16, fontWeight:800, lineHeight:1 }}>{tgl.getDate()}</div>
                  <div style={{ fontSize:9, textTransform:'uppercase' }}>
                    {tgl.toLocaleDateString('id-ID',{month:'short'})}
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700 }}>
                    Laporan {l.judul}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
                    {tgl.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                    {l.dibuat_oleh && ` · oleh ${l.dibuat_oleh}`}
                  </div>
                </div>
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={() => handlePreview(l.id)} className="btn btn-sm btn-primary"
                    style={{ fontSize:11 }}>👁 Preview</button>
                  <button onClick={() => handleEdit(l.id)} className="btn btn-sm"
                    style={{ fontSize:11 }}>✏️ Edit</button>
                  <button onClick={() => { setConfirmHapus(l.id); setHapusErr(''); }}
                    className="btn btn-sm"
                    style={{ fontSize:11, color:'var(--red)', borderColor:'var(--red)' }}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {confirmHapus && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
          onClick={e => e.target===e.currentTarget && setConfirmHapus(null)}>
          <div style={{ background:'var(--surface)', borderRadius:14, padding:24,
            width:'100%', maxWidth:340, boxShadow:'0 8px 32px rgba(0,0,0,.18)' }}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:8 }}>Hapus laporan ini?</div>
            <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:hapusErr ? 10 : 20 }}>
              Tindakan ini tidak bisa dibatalkan.
            </div>
            {hapusErr && <div style={{ fontSize:12, color:'var(--red)', marginBottom:12 }}>{hapusErr}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setConfirmHapus(null)}
                style={{ flex:1, padding:'9px', borderRadius:8, border:'1px solid var(--border-2)',
                  background:'var(--surface)', cursor:'pointer', fontSize:13 }}>Batal</button>
              <button onClick={() => handleHapus(confirmHapus)}
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

  // ── FORM VIEW ──
  if (view === 'form') return (
    <div>
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button onClick={() => setView('list')} style={{ background:'none', border:'none',
          cursor:'pointer', fontSize:14, color:'var(--text-2)', padding:0 }}>← Kembali</button>
        <div style={{ fontSize:15, fontWeight:800 }}>
          {editData ? 'Edit Laporan' : 'Buat Laporan Baru'}
        </div>
      </div>
      <FormLaporan
        initial={editData}
        onSave={handleSave}
        onCancel={() => setView('list')}
        saving={saving}
        error={formErr}
      />
    </div>
  );

  // ── PREVIEW VIEW ──
  if (view === 'preview' && selected) return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <button onClick={() => setView('list')} style={{ background:'none', border:'none',
            cursor:'pointer', fontSize:14, color:'var(--text-2)', padding:0 }}>← Kembali</button>
          <div style={{ fontSize:15, fontWeight:800 }}>Preview Laporan</div>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={() => handleEdit(selected.id)} className="btn btn-sm"
            style={{ fontSize:12 }}>✏️ Edit</button>
          <button onClick={handleDownloadPdf} className="btn btn-sm btn-primary"
            disabled={genPdf} style={{ fontSize:12 }}>
            {genPdf ? 'Generating...' : '⬇ Download PDF'}
          </button>
        </div>
      </div>

      {/* Preview container — ini yang di-screenshot untuk PDF */}
      <div style={{ overflowX:'auto', background:'#0f1117', borderRadius:12, padding:16 }}>
        <div ref={previewRef} style={{ display:'inline-block' }}>
          <LaporanPreview laporan={selected} />
        </div>
      </div>
    </div>
  );

  return null;
}
