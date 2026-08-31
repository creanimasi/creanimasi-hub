import { useState, useEffect, useRef, useCallback } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

import { api } from '../services/api';
import { SkeletonList } from '../components/Skeleton';

// ── PREVIEW PDF ────────────────────────────────────────────────────────────────
// Desain mengikuti format JELLIA Weekly Report: cream card di atas latar biru muda
function LaporanAdminPreview({ laporan }) {
  const {
    tanggal, akun, periode,
    gigs_tags = [], order_queue = {},
    flow_new_order, flow_complete_order,
    gigs_utama = [],
    screenshot_account_status, screenshot_earnings, screenshot_active_gigs,
    screenshot_weekly_gigs_score, screenshot_weekly_overview, screenshot_yearly_overview,
    screenshot_total_impressions, screenshot_fiverr_ads, screenshot_porto_baru,
    todo_list = [], kendala_list = [],
    catatan,
  } = laporan;

  const tgl = new Date(tanggal);
  const tglFormatted = tgl.toLocaleDateString('id-ID', { day:'2-digit', month:'long', year:'numeric' });

  return (
    <div style={{
      fontFamily: "'Inter', sans-serif",
      background: '#ffffff', color: '#1f2937',
      padding: '40px 48px', width: 794, minHeight: 1123,
      boxSizing: 'border-box', lineHeight: 1.5,
    }}>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#3b82f6', letterSpacing:'.08em', textTransform:'uppercase' }}>
          Weekly Report
        </div>
        <div style={{ fontSize: 32, fontWeight: 900, color: '#f59e0b' }}>{akun}</div>
        <div style={{ fontSize: 13, color: '#475569', marginTop: 4 }}>
          {periode || tglFormatted}
        </div>
      </div>

      <div data-section="true">
        <PanelHeader title={`${akun} Fiverr — Gigs & Order Queue`} />
        <div style={{ display:'flex', gap:14, marginBottom:18 }}>
          <Panel style={{ flex:1 }}>
            {gigs_tags.map((t, i) => (
              <Row key={i} label={t.label} value={t.jumlah} />
            ))}
          </Panel>
          <Panel style={{ flex:1 }}>
            <div style={{ fontSize:14, fontWeight:700, marginBottom:8 }}>Total Order</div>
            <div style={{ fontSize:30, fontWeight:900, color:'#1e293b', marginBottom:10 }}>{order_queue.total ?? 0}</div>
            <Row label="In Progress" value={order_queue.in_progress ?? 0} />
            <Row label="Revisi" value={order_queue.revisi ?? 0} />
            <Row label="Selesai / Delivered" value={order_queue.selesai ?? 0} />
          </Panel>
        </div>
      </div>

      <div data-section="true">
        <PanelHeader title="Flow in a Week" />
        <Panel style={{ marginBottom:18 }}>
          <Row label="New Order" value={flow_new_order ?? 0} bold />
          <Row label="Complete Order" value={flow_complete_order ?? 0} bold />
        </Panel>
      </div>

      {/* Account Status — halaman sendiri */}
      {(() => {
        const arr = Array.isArray(screenshot_account_status) ? screenshot_account_status : (screenshot_account_status ? [screenshot_account_status] : []);
        if (!arr.length) return null;
        return (
          <div data-section="true">
            <PanelHeader title="Account Status" />
            <Panel style={{ marginBottom:18, padding:0, overflow:'hidden' }}>
              {arr.map((src, i) => (
                <img key={i} src={src} alt={`Account Status ${i+1}`}
                  style={{ width:'100%', display:'block', borderRadius: i === arr.length-1 ? 14 : 0,
                    borderBottom: i < arr.length-1 ? '1px solid #e2e8f0' : 'none' }} />
              ))}
            </Panel>
          </div>
        );
      })()}

      {/* Weekly Earnings + Weekly Gigs Score — satu halaman */}
      {(() => {
        const earningsArr = Array.isArray(screenshot_earnings) ? screenshot_earnings : (screenshot_earnings ? [screenshot_earnings] : []);
        const gigsArr     = Array.isArray(screenshot_weekly_gigs_score) ? screenshot_weekly_gigs_score : (screenshot_weekly_gigs_score ? [screenshot_weekly_gigs_score] : []);
        if (!earningsArr.length && !gigsArr.length) return null;
        return (
          <div data-section="true">
            {earningsArr.length > 0 && <>
              <PanelHeader title="Weekly Earnings" />
              <Panel style={{ marginBottom:18, padding:0, overflow:'hidden' }}>
                {earningsArr.map((src, i) => (
                  <img key={i} src={src} alt={`Weekly Earnings ${i+1}`}
                    style={{ width:'100%', display:'block', borderRadius: i === earningsArr.length-1 ? 14 : 0,
                      borderBottom: i < earningsArr.length-1 ? '1px solid #e2e8f0' : 'none' }} />
                ))}
              </Panel>
            </>}
            {gigsArr.length > 0 && <>
              <PanelHeader title="Weekly Gigs Score" />
              <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:6, marginBottom:18 }}>
                {gigsArr.map((src, i) => (
                  <img key={i} src={src} alt={`Weekly Gigs Score ${i+1}`}
                    style={{ width:'100%', display:'block', borderRadius:10 }} />
                ))}
              </div>
            </>}
          </div>
        );
      })()}

      {/* Active Gigs in a Week — halaman sendiri */}
      {(() => {
        const arr = Array.isArray(screenshot_active_gigs) ? screenshot_active_gigs : (screenshot_active_gigs ? [screenshot_active_gigs] : []);
        if (!arr.length) return null;
        return (
          <div data-section="true" data-force-break="true">
            <PanelHeader title="Active Gigs in a Week" />
            <Panel style={{ marginBottom:18, padding:0, overflow:'hidden' }}>
              {arr.map((src, i) => (
                <img key={i} src={src} alt={`Active Gigs ${i+1}`}
                  style={{ width:'100%', display:'block', borderRadius: i === arr.length-1 ? 14 : 0,
                    borderBottom: i < arr.length-1 ? '1px solid #e2e8f0' : 'none' }} />
              ))}
            </Panel>
          </div>
        );
      })()}

      {/* 3 Gigs Utama — tiap gig 1 halaman terpisah */}
      {gigs_utama.map((g, i) => {
        const shots = Array.isArray(g.screenshots) ? g.screenshots : (g.screenshot ? [g.screenshot] : []);
        const kws   = Array.isArray(g.screenshots_keyword) ? g.screenshots_keyword : (g.screenshot_keyword ? [g.screenshot_keyword] : []);
        if (!g.nama && !shots.length && !kws.length) return null;
        return (
          <div key={i} data-section="true" data-force-break="true">
            {i === 0 && <PanelHeader title="3 Gigs Utama" />}
            <Panel style={{ padding:'14px 16px', marginBottom:18 }}>
              {g.nama && (
                <div style={{ fontSize:14, fontWeight:700, marginBottom:10, color:'#1e293b',
                  lineHeight:1.3 }}>{g.nama}</div>
              )}
              {shots.map((src, si) => (
                <img key={si} src={src} alt={g.nama || `Gig ${i+1}`}
                  style={{ width:'100%', borderRadius:8, display:'block', marginBottom: si < shots.length-1 ? 8 : (kws.length ? 10 : 0) }} />
              ))}
              {kws.map((src, ki) => (
                <img key={ki} src={src} alt={`Top Keyword ${g.nama}`}
                  style={{ width:'100%', borderRadius:8, display:'block', marginBottom: ki < kws.length-1 ? 8 : 0 }} />
              ))}
            </Panel>
          </div>
        );
      })}

      {/* Weekly Overview → Yearly Overview → Fiverr Ads → Total Impressions */}
      {[
        { imgs: screenshot_weekly_overview,   title: 'Weekly Overview',                   grid: null },
        { imgs: screenshot_yearly_overview,   title: 'Yearly Overview',                   grid: null },
        { imgs: screenshot_fiverr_ads,        title: 'Fiverr Ads in a Weeks',             grid: null },
        { imgs: screenshot_total_impressions, title: 'Total Impressions, Clicks & CR',    grid: 2, forceBreak: true },
      ].map(({ imgs, title, grid, forceBreak }) => {
        const arr = Array.isArray(imgs) ? imgs : (imgs ? [imgs] : []);
        if (!arr.length) return null;
        return (
          <div key={title} data-section="true" {...(forceBreak ? { 'data-force-break': 'true' } : {})}>
            <PanelHeader title={title} />
            {grid ? (
              <div style={{ display:'grid', gridTemplateColumns:`repeat(${grid}, 1fr)`, gap:6, marginBottom:18 }}>
                {arr.map((src, i) => (
                  <img key={i} src={src} alt={`${title} ${i+1}`}
                    style={{ width:'100%', display:'block', borderRadius:10 }} />
                ))}
              </div>
            ) : (
              <Panel style={{ marginBottom:18, padding:0, overflow:'hidden' }}>
                {arr.map((src, i) => (
                  <img key={i} src={src} alt={`${title} ${i+1}`}
                    style={{ width:'100%', display:'block', borderRadius: i === arr.length-1 ? 14 : 0,
                      borderBottom: i < arr.length-1 ? '1px solid #e2e8f0' : 'none' }} />
                ))}
              </Panel>
            )}
          </div>
        );
      })}

      {/* Porto Baru */}
      {(() => {
        const arr = Array.isArray(screenshot_porto_baru) ? screenshot_porto_baru : (screenshot_porto_baru ? [screenshot_porto_baru] : []);
        return arr.length > 0 && (
          <div data-section="true">
            <PanelHeader title="Porto Baru" />
            <Panel style={{ marginBottom:18, padding:0, overflow:'hidden' }}>
              {arr.map((src, i) => (
                <img key={i} src={src} alt={`Porto Baru ${i+1}`}
                  style={{ width:'100%', display:'block', borderRadius: i === arr.length-1 ? 14 : 0,
                    borderBottom: i < arr.length-1 ? '1px solid #e2e8f0' : 'none' }} />
              ))}
            </Panel>
          </div>
        );
      })()}

      {/* Weekly To-Do List — setelah Porto Baru */}
      {(todo_list.some(t => t) || kendala_list.some(k => k)) && (
        <div data-section="true">
          <PanelHeader title="Weekly To-Do List" />
          <Panel style={{ marginBottom:18 }}>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:20 }}>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'#f59e0b', marginBottom:10,
                  textTransform:'uppercase', letterSpacing:'.05em' }}>To-Do List</div>
                {todo_list.map((t, i) => t ? (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, fontSize:13 }}>
                    <div style={{ width:22, height:22, borderRadius:'50%', background:'#f59e0b',
                      color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center',
                      justifyContent:'center', flexShrink:0 }}>{i+1}</div>
                    <span>{t}</span>
                  </div>
                ) : null)}
              </div>
              <div>
                <div style={{ fontSize:12, fontWeight:700, color:'#f59e0b', marginBottom:10,
                  textTransform:'uppercase', letterSpacing:'.05em' }}>Kendala / Problem</div>
                {kendala_list.map((k, i) => k ? (
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, fontSize:13 }}>
                    <div style={{ width:22, height:22, borderRadius:'50%', background:'#f59e0b',
                      color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center',
                      justifyContent:'center', flexShrink:0 }}>{i+1}</div>
                    <span>{k}</span>
                  </div>
                ) : null)}
              </div>
            </div>
          </Panel>
        </div>
      )}

      {catatan && (
        <div data-section="true">
          <PanelHeader title="Catatan" />
          <Panel><div style={{ fontSize:13, whiteSpace:'pre-wrap' }}>{catatan}</div></Panel>
        </div>
      )}
    </div>
  );
}

function PanelHeader({ title }) {
  return (
    <div style={{ fontSize:18, fontWeight:900, color:'#0f172a', marginBottom:10, marginTop:4 }}>{title}</div>
  );
}

function Panel({ children, style }) {
  return (
    <div style={{
      background:'#fdfaf0', borderRadius:16, border:'2px solid #f59e0b',
      padding:'16px 18px', ...style,
    }}>
      {children}
    </div>
  );
}

function Row({ label, value, bold }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', fontSize:13, marginBottom:6,
      fontWeight: bold ? 700 : 400 }}>
      <span style={{ color:'#475569' }}>{label}</span>
      <span style={{ fontWeight:700, color:'#0f172a' }}>{value}</span>
    </div>
  );
}

// ── UPLOAD SCREENSHOT (multi) ──────────────────────────────────────────────────
function readFilesToBase64(files, existing, callback) {
  const arr = Array.isArray(existing) ? [...existing] : (existing ? [existing] : []);
  let pending = files.length;
  if (!pending) return;
  Array.from(files).forEach(file => {
    if (!file.type.startsWith('image/')) { pending--; return; }
    const reader = new FileReader();
    reader.onload = (e) => {
      arr.push(e.target.result);
      pending--;
      if (pending === 0) callback(arr);
    };
    reader.readAsDataURL(file);
  });
}

function ImgUpload({ label, icon, value, onChange }) {
  const inputRef = useRef();
  const [drag, setDrag] = useState(false);
  const images = Array.isArray(value) ? value : (value ? [value] : []);

  const addFiles = (files) => readFilesToBase64(files, images, onChange);
  const removeImg = (i) => onChange(images.filter((_, idx) => idx !== i));

  return (
    <div className="card" style={{ marginBottom:14 }}>
      <div style={{ fontSize:13, fontWeight:700, color:'var(--coral)', marginBottom:12 }}>
        {icon} {label}
        {images.length > 0 && (
          <span style={{ marginLeft:8, fontSize:11, fontWeight:400, color:'var(--text-3)' }}>
            {images.length} gambar
          </span>
        )}
      </div>
      {images.length > 0 && (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',
          gap:8, marginBottom:10 }}>
          {images.map((src, i) => (
            <div key={i} style={{ position:'relative' }}>
              <img src={src} alt={`${label} ${i+1}`}
                style={{ width:'100%', borderRadius:8, border:'1px solid var(--border)',
                  display:'block', objectFit:'cover', maxHeight:160 }} />
              <button type="button" onClick={() => removeImg(i)}
                style={{ position:'absolute', top:4, right:4, background:'var(--red)', color:'#fff',
                  border:'none', borderRadius:5, padding:'2px 7px', cursor:'pointer',
                  fontSize:11, fontWeight:600, lineHeight:1.4 }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div
        onClick={() => inputRef.current.click()}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); addFiles(e.dataTransfer.files); }}
        style={{
          border:`2px dashed ${drag ? 'var(--green)' : 'var(--border-2)'}`,
          borderRadius:10, padding:'24px 20px', textAlign:'center', cursor:'pointer',
          color: drag ? 'var(--green)' : 'var(--text-3)', fontSize:13,
          transition:'border-color .15s, color .15s',
          background: drag ? 'var(--surface-2)' : 'transparent',
        }}>
        <div style={{ fontSize:24, marginBottom:6 }}>📷</div>
        <div style={{ fontWeight:600, marginBottom:4 }}>
          {images.length > 0 ? '+ Tambah screenshot lagi' : 'Klik atau drag screenshot di sini'}
        </div>
        <div style={{ fontSize:11 }}>PNG, JPG, WebP — bisa pilih banyak sekaligus</div>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple
        onChange={e => addFiles(e.target.files)} style={{ display:'none' }} />
    </div>
  );
}

// ── FORM LAPORAN ───────────────────────────────────────────────────────────────
const DEFAULT_TAG = () => ({ label:'', jumlah:'' });

// ── GIG UTAMA SLOT ─────────────────────────────────────────────────────────────
function MiniImgUpload({ label, value, onField, fieldKey }) {
  const fileRef = useRef();
  const images = Array.isArray(value) ? value : (value ? [value] : []);
  const addFiles = (files) => readFilesToBase64(files, images, (arr) => onField(fieldKey, arr));
  const removeImg = (i) => onField(fieldKey, images.filter((_, idx) => idx !== i));

  return (
    <div style={{ marginTop:6 }}>
      <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase',
        letterSpacing:'.05em', marginBottom:4 }}>{label}</div>
      {images.length > 0 && (
        <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:4 }}>
          {images.map((src, i) => (
            <div key={i} style={{ position:'relative' }}>
              <img src={src} alt={`${label} ${i+1}`}
                style={{ width:'100%', borderRadius:6, border:'1px solid var(--border)', display:'block' }} />
              <button type="button" onClick={() => removeImg(i)}
                style={{ position:'absolute', top:3, right:3, background:'var(--red)', color:'#fff',
                  border:'none', borderRadius:4, padding:'1px 6px', cursor:'pointer', fontSize:10 }}>✕</button>
            </div>
          ))}
        </div>
      )}
      <div onClick={() => fileRef.current.click()}
        style={{ border:'2px dashed var(--border-2)', borderRadius:6, padding:'8px 6px',
          textAlign:'center', cursor:'pointer', color:'var(--text-3)', fontSize:10 }}>
        📷 {images.length > 0 ? '+ Tambah' : 'Upload screenshot'}
      </div>
      <input ref={fileRef} type="file" accept="image/*" multiple
        onChange={e => addFiles(e.target.files)} style={{ display:'none' }} />
    </div>
  );
}

function GigUtamaSlot({ index, gig, onField, labelStyle, inputStyle }) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
      <div style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase',
        letterSpacing:'.05em' }}>Gig {index + 1}</div>
      <input
        value={gig.nama}
        onChange={e => onField('nama', e.target.value)}
        placeholder="Nama gig..."
        style={{ ...inputStyle, fontSize:12 }}
      />
      <MiniImgUpload label="Screenshot Impr/Clicks" value={gig.screenshots}
        onField={onField} fieldKey="screenshots" />
      <MiniImgUpload label="Screenshot Top Keyword" value={gig.screenshots_keyword}
        onField={onField} fieldKey="screenshots_keyword" />
    </div>
  );
}

const DEFAULT_GIG_UTAMA = () => ({ nama:'', screenshots:[], screenshots_keyword:[] });

const DEFAULT_TODO = () => [''];

const DEFAULT_FORM = () => ({
  tanggal:  new Date().toISOString().slice(0,10),
  akun:     '',
  periode:  '',
  gigs_tags: [DEFAULT_TAG()],
  order_queue: { total:'', in_progress:'', revisi:'', selesai:'' },
  flow_new_order: '',
  flow_complete_order: '',
  gigs_utama: [DEFAULT_GIG_UTAMA(), DEFAULT_GIG_UTAMA(), DEFAULT_GIG_UTAMA()],
  screenshot_account_status: [],
  screenshot_earnings: [],
  screenshot_active_gigs: [],
  screenshot_weekly_gigs_score: [],
  screenshot_weekly_overview: [],
  screenshot_yearly_overview: [],
  screenshot_total_impressions: [],
  screenshot_fiverr_ads: [],
  screenshot_porto_baru: [],
  todo_list: DEFAULT_TODO(),
  kendala_list: DEFAULT_TODO(),
  catatan: '',
});

function FormLaporanAdmin({ initial, onSave, onCancel, saving, error }) {
  const [form, setForm] = useState(() => initial || DEFAULT_FORM());
  const setField = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const setQueue = (k, v) => setForm(f => ({ ...f, order_queue: { ...f.order_queue, [k]: v } }));

  const setTag = (i, k, v) => setForm(f => ({
    ...f, gigs_tags: f.gigs_tags.map((t, idx) => idx === i ? { ...t, [k]: v } : t)
  }));
  const addTag = () => setForm(f => ({ ...f, gigs_tags: [...f.gigs_tags, DEFAULT_TAG()] }));
  const removeTag = (i) => setForm(f => ({ ...f, gigs_tags: f.gigs_tags.filter((_,idx)=>idx!==i) }));

  const setGigUtama = (i, k, v) => setForm(f => ({
    ...f, gigs_utama: f.gigs_utama.map((g, idx) => idx === i ? { ...g, [k]: v } : g)
  }));

  const inputStyle = { fontSize: 13, padding: '7px 10px', marginBottom: 0 };
  const labelStyle = { fontSize: 11, fontWeight: 700, color: 'var(--text-2)',
    textTransform: 'uppercase', letterSpacing: '.05em', display: 'block', marginBottom: 5 };

  return (
    <form onSubmit={e => { e.preventDefault(); onSave(form); }} style={{ maxWidth: 860 }}>
      {error && (
        <div className="alert alert-red" style={{ marginBottom:16, fontSize:12 }}>
          <span>⚠️</span><div>{error}</div>
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
            <label style={labelStyle}>Akun Fiverr *</label>
            <input value={form.akun} required
              onChange={e=>setField('akun',e.target.value)}
              placeholder="Jellia / Creanimasi / Creillustra / dll"
              style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Periode</label>
            <input value={form.periode}
              onChange={e=>setField('periode',e.target.value)}
              placeholder="Minggu 2 Juni 2026" style={inputStyle} />
          </div>
        </div>
      </div>

      {/* Gigs tags + Order Queue */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12, marginBottom:14 }}>
        <div className="card">
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
            <div style={{ fontSize:13, fontWeight:700, color:'var(--blue)' }}>📦 Gigs Aktif Order</div>
            <button type="button" className="btn btn-sm" onClick={addTag} style={{ fontSize:11 }}>+ Tambah</button>
          </div>
          {form.gigs_tags.map((t, i) => (
            <div key={i} style={{ display:'flex', gap:8, marginBottom:8, alignItems:'center' }}>
              <input value={t.label} onChange={e=>setTag(i,'label',e.target.value)}
                placeholder="VTUBER FILTER" style={{ ...inputStyle, flex:2 }} />
              <input type="number" value={t.jumlah} onChange={e=>setTag(i,'jumlah',e.target.value)}
                placeholder="0" style={{ ...inputStyle, flex:1 }} />
              {form.gigs_tags.length > 1 && (
                <button type="button" onClick={()=>removeTag(i)}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'var(--red)', fontSize:16, padding:4 }}>✕</button>
              )}
            </div>
          ))}
        </div>

        <div className="card">
          <div style={{ fontSize:13, fontWeight:700, color:'var(--purple)', marginBottom:10 }}>📦 Order Queue</div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[
              { k:'total', label:'Total Order' },
              { k:'in_progress', label:'In Progress' },
              { k:'revisi', label:'Revisi' },
              { k:'selesai', label:'Selesai/Delivered' },
            ].map(f => (
              <div key={f.k}>
                <label style={{ ...labelStyle, fontSize:9 }}>{f.label}</label>
                <input type="number" value={form.order_queue[f.k]}
                  onChange={e=>setQueue(f.k, e.target.value)}
                  placeholder="0" style={{ ...inputStyle, fontSize:12 }} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Flow in a Week */}
      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--amber)', marginBottom:10 }}>🔄 Flow in a Week</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
          <div>
            <label style={labelStyle}>New Order</label>
            <input type="number" value={form.flow_new_order}
              onChange={e=>setField('flow_new_order',e.target.value)} placeholder="0" style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Complete Order</label>
            <input type="number" value={form.flow_complete_order}
              onChange={e=>setField('flow_complete_order',e.target.value)} placeholder="0" style={inputStyle} />
          </div>
        </div>
      </div>

      {/* 3 Gigs Utama */}
      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--amber)', marginBottom:14 }}>⭐ 3 Gigs Utama</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
          {(form.gigs_utama || []).map((g, i) => (
            <GigUtamaSlot
              key={i}
              index={i}
              gig={g}
              onField={(k, v) => setGigUtama(i, k, v)}
              labelStyle={labelStyle}
              inputStyle={inputStyle}
            />
          ))}
        </div>
      </div>

      <ImgUpload
        label="Account Status"
        icon="📈"
        value={form.screenshot_account_status}
        onChange={v => setField('screenshot_account_status', v)}
      />

      <ImgUpload
        label="Weekly Earnings ($)"
        icon="💵"
        value={form.screenshot_earnings}
        onChange={v => setField('screenshot_earnings', v)}
      />

      <ImgUpload
        label="Active Gigs in a Week"
        icon="📊"
        value={form.screenshot_active_gigs}
        onChange={v => setField('screenshot_active_gigs', v)}
      />

      <ImgUpload
        label="Weekly Gigs Score"
        icon="🏆"
        value={form.screenshot_weekly_gigs_score}
        onChange={v => setField('screenshot_weekly_gigs_score', v)}
      />

      <ImgUpload
        label="Weekly Overview"
        icon="📈"
        value={form.screenshot_weekly_overview}
        onChange={v => setField('screenshot_weekly_overview', v)}
      />

      <ImgUpload
        label="Yearly Overview"
        icon="📅"
        value={form.screenshot_yearly_overview}
        onChange={v => setField('screenshot_yearly_overview', v)}
      />

      <ImgUpload
        label="Total Impressions, Clicks & CR"
        icon="📱"
        value={form.screenshot_total_impressions}
        onChange={v => setField('screenshot_total_impressions', v)}
      />

      <ImgUpload
        label="Fiverr Ads in a Weeks"
        icon="📣"
        value={form.screenshot_fiverr_ads}
        onChange={v => setField('screenshot_fiverr_ads', v)}
      />

      {/* Weekly To-Do List + Kendala */}
      <div className="card" style={{ marginBottom:14 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--amber)', marginBottom:14 }}>✅ Weekly To-Do List &amp; Kendala</div>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          {/* TO-DO LIST */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase',
              letterSpacing:'.05em', marginBottom:8 }}>To-Do List</div>
            {(form.todo_list || ['']).map((item, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                <div style={{ width:20, height:20, borderRadius:'50%', background:'var(--amber)',
                  color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center',
                  justifyContent:'center', flexShrink:0 }}>{i+1}</div>
                <input value={item}
                  onChange={e => setField('todo_list', (form.todo_list||['']).map((v,idx)=>idx===i?e.target.value:v))}
                  placeholder={`To-do ${i+1}...`}
                  style={{ ...inputStyle, fontSize:12, flex:1 }} />
                {(form.todo_list||['']).length > 1 && (
                  <button onClick={() => setField('todo_list', (form.todo_list||['']).filter((_,idx)=>idx!==i))}
                    style={{ background:'none', border:'none', color:'#ef4444', fontSize:16, cursor:'pointer',
                      padding:'0 2px', lineHeight:1, flexShrink:0 }} title="Hapus">×</button>
                )}
              </div>
            ))}
            <button onClick={() => setField('todo_list', [...(form.todo_list||['']), ''])}
              style={{ marginTop:4, background:'none', border:'1px dashed var(--amber)', color:'var(--amber)',
                borderRadius:6, padding:'4px 12px', fontSize:11, cursor:'pointer', width:'100%' }}>
              + Tambah Item
            </button>
          </div>
          {/* KENDALA */}
          <div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-2)', textTransform:'uppercase',
              letterSpacing:'.05em', marginBottom:8 }}>Kendala / Problem</div>
            {(form.kendala_list || ['']).map((item, i) => (
              <div key={i} style={{ display:'flex', alignItems:'center', gap:8, marginBottom:7 }}>
                <div style={{ width:20, height:20, borderRadius:'50%', background:'var(--amber)',
                  color:'#fff', fontSize:11, fontWeight:700, display:'flex', alignItems:'center',
                  justifyContent:'center', flexShrink:0 }}>{i+1}</div>
                <input value={item}
                  onChange={e => setField('kendala_list', (form.kendala_list||['']).map((v,idx)=>idx===i?e.target.value:v))}
                  placeholder={`Kendala ${i+1}...`}
                  style={{ ...inputStyle, fontSize:12, flex:1 }} />
                {(form.kendala_list||['']).length > 1 && (
                  <button onClick={() => setField('kendala_list', (form.kendala_list||['']).filter((_,idx)=>idx!==i))}
                    style={{ background:'none', border:'none', color:'#ef4444', fontSize:16, cursor:'pointer',
                      padding:'0 2px', lineHeight:1, flexShrink:0 }} title="Hapus">×</button>
                )}
              </div>
            ))}
            <button onClick={() => setField('kendala_list', [...(form.kendala_list||['']), ''])}
              style={{ marginTop:4, background:'none', border:'1px dashed var(--amber)', color:'var(--amber)',
                borderRadius:6, padding:'4px 12px', fontSize:11, cursor:'pointer', width:'100%' }}>
              + Tambah Item
            </button>
          </div>
        </div>
      </div>

      <ImgUpload
        label="Porto Baru"
        icon="🎨"
        value={form.screenshot_porto_baru}
        onChange={v => setField('screenshot_porto_baru', v)}
      />

      {/* Catatan */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:'var(--purple)', marginBottom:10 }}>📝 Catatan Tambahan</div>
        <textarea rows={4} value={form.catatan}
          onChange={e=>setField('catatan',e.target.value)}
          placeholder="Catatan tambahan untuk laporan ini..."
          style={{ resize:'vertical', fontSize:13 }} />
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
export default function LaporanAdminMingguan() {
  const [daftar,   setDaftar]   = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [view,     setView]     = useState('list');   // 'list' | 'form' | 'preview'
  const [selected, setSelected] = useState(null);
  const [editData, setEditData] = useState(null);
  const [saving,       setSaving]       = useState(false);
  const [formErr,      setFormErr]      = useState('');
  const [genPdf,       setGenPdf]       = useState(false);
  const [confirmHapus, setConfirmHapus] = useState(null);
  const [hapusErr,     setHapusErr]     = useState('');
  const previewRef = useRef(null);

  const loadDaftar = useCallback(() => {
    api.getLaporanAdmin()
      .then(r => setDaftar(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { loadDaftar(); }, [loadDaftar]);

  const handleBuat = () => { setEditData(null); setFormErr(''); setView('form'); };

  const handleEdit = async (id) => {
    try {
      const r = await api.getLaporanAdminById(id);
      setEditData(r.data);
      setFormErr('');
      setView('form');
    } catch (err) { setFormErr(err.message || 'Gagal memuat laporan'); }
  };

  const handleSave = async (form) => {
    setSaving(true); setFormErr('');
    try {
      if (editData?.id) await api.updateLaporanAdmin(editData.id, form);
      else await api.buatLaporanAdmin(form);
      await loadDaftar();
      setView('list');
    } catch (err) {
      setFormErr(err.message || 'Gagal menyimpan laporan.');
    } finally { setSaving(false); }
  };

  const handleHapus = async (id) => {
    setHapusErr('');
    try { await api.hapusLaporanAdmin(id); setConfirmHapus(null); loadDaftar(); }
    catch (err) { setHapusErr(err.message || 'Gagal hapus'); }
  };

  const handlePreview = async (id) => {
    try {
      const r = await api.getLaporanAdminById(id);
      setSelected(r.data);
      setView('preview');
    } catch (err) { setFormErr(err.message || 'Gagal memuat preview'); }
  };

  const handleDownloadPdf = async () => {
    if (!selected || !previewRef.current) return;
    setGenPdf(true);
    try {
      const el = previewRef.current;

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false,
      });

      const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
      const pageW = 210, pageH = 297;
      const mx = 5, my = 5;
      const contentW = pageW - mx * 2;
      const contentH = pageH - my * 2;
      const mmPerPx = contentW / canvas.width;
      const pageHeightPx = contentH / mmPerPx;

      // Collect section break points — use getBoundingClientRect so positions
      // are canvas-relative even when el has no position:relative ancestor.
      const elRect = el.getBoundingClientRect();
      const toCanvasY = (el) => (el.getBoundingClientRect().top - elRect.top) * 2;

      const forcedBreaks = new Set(
        Array.from(el.querySelectorAll('[data-force-break]'))
          .map(toCanvasY).filter(t => t > 50)
      );
      const breakPoints = Array.from(el.querySelectorAll('[data-section]'))
        .map(toCanvasY).filter(t => t > 50).sort((a, b) => a - b);

      // Build page slices: avoid cutting through sections
      const totalH = canvas.height;
      const slices = [];
      let start = 0;
      while (start < totalH) {
        const pageStart = start;
        const idealEnd = Math.min(pageStart + pageHeightPx, totalH);
        if (idealEnd >= totalH) { slices.push({ start: pageStart, end: totalH }); break; }

        // Forced break: always start a new page at these positions
        let breakAt = idealEnd;
        const nextForced = [...forcedBreaks].find(f => f > pageStart && f < idealEnd);
        if (nextForced !== undefined) {
          breakAt = nextForced;
        } else {
          // Soft break: if a section starts in the bottom 40% of this page, break before it
          const threshold = pageStart + pageHeightPx * 0.60;
          for (const bp of breakPoints) {
            if (bp > threshold && bp < idealEnd) { breakAt = bp; break; }
          }
        }
        slices.push({ start: pageStart, end: breakAt });
        start = breakAt;
      }

      // Render each slice as a PDF page
      slices.forEach(({ start, end }, i) => {
        if (i > 0) pdf.addPage();
        const h = end - start;
        const tmp = document.createElement('canvas');
        tmp.width = canvas.width;
        tmp.height = h;
        tmp.getContext('2d').drawImage(canvas, 0, start, canvas.width, h, 0, 0, canvas.width, h);
        pdf.addImage(tmp.toDataURL('image/jpeg', 0.92), 'JPEG', mx, my, contentW, h * mmPerPx);
      });

      const tgl = selected.tanggal?.slice(0, 10).replace(/-/g, '_');
      pdf.save(`Laporan_Admin_${selected.akun}_${tgl}.pdf`);
    } catch (err) {
      alert('Gagal generate PDF: ' + err.message);
    } finally { setGenPdf(false); }
  };

  // ── LIST VIEW ──
  if (view === 'list') return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:800 }}>📊 Laporan Mingguan Admin</div>
          <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2 }}>
            Analitik mingguan per-akun Fiverr (gigs, order, earnings) — format PDF
          </div>
        </div>
        <button className="btn btn-primary" onClick={handleBuat}>+ Buat Laporan</button>
      </div>

      {loading ? (
        <SkeletonList count={6} />
      ) : daftar.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📊</div>
          <div className="empty-title">Belum ada laporan admin</div>
          <div className="empty-sub">Klik "Buat Laporan" untuk membuat laporan analitik akun pertama</div>
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
                  background:'var(--amber-light)', color:'var(--amber)',
                  display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
                }}>
                  <div style={{ fontSize:16, fontWeight:800, lineHeight:1 }}>{tgl.getDate()}</div>
                  <div style={{ fontSize:9, textTransform:'uppercase' }}>
                    {tgl.toLocaleDateString('id-ID',{month:'short'})}
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:14, fontWeight:700 }}>Laporan Admin — {l.akun}</div>
                  <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
                    {l.periode || tgl.toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
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
          {editData ? 'Edit Laporan Admin' : 'Buat Laporan Admin Baru'}
        </div>
      </div>
      <FormLaporanAdmin
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
          <div style={{ fontSize:15, fontWeight:800 }}>Preview Laporan Admin</div>
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

      <div style={{ overflowX:'auto', background:'#0f1117', borderRadius:12, padding:16 }}>
        <div ref={previewRef} style={{ display:'inline-block' }}>
          <LaporanAdminPreview laporan={selected} />
        </div>
      </div>
    </div>
  );

  return null;
}
