import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import { compressImage } from '../utils/imageCompress';
import SlideDeck, { SLIDE_W, SLIDE_H, namaBulan } from '../components/laporanAds/SlideDeck';

const RENTANG_MINGGU = ['Tgl 1–7', 'Tgl 8–14', 'Tgl 15–21', 'Tgl 22–akhir bulan'];

const mingguKosong = () => ({ profile_visit: 0, chat_masuk: 0, todo: [], kendala: [], order_queue: { in_progress: 0, revisi: 0, ready: 0 }, flow_new: 0, flow_complete: 0 });
const normMinggu = (m) => ({ ...mingguKosong(), ...(m || {}), order_queue: { ...mingguKosong().order_queue, ...(m?.order_queue || {}) } });
const normKreatif = (k) => ({
  gambar_id: k?.gambar_id ?? null,
  nama: k?.nama || '',
  mingguan: [0, 1, 2, 3].map(i => ({ chat: k?.mingguan?.[i]?.chat ?? 0, order: k?.mingguan?.[i]?.order ?? 0 })),
});

function bulanSekarang() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
function mingguSekarang(bulan) {
  if (bulan !== bulanSekarang()) return 4;
  return Math.min(4, Math.floor((new Date().getDate() - 1) / 7) + 1);
}
function opsiBulan() {
  const now = new Date();
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { val, label: `${namaBulan(val)} ${d.getFullYear()}` };
  });
}
const fmtRp = (n) => `Rp ${Math.round(Number(n || 0)).toLocaleString('id-ID')}`;
const fmtInt = (n) => Number(n || 0).toLocaleString('id-ID');

const S = {
  input: { width: '100%', padding: '8px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)', fontSize: 13, boxSizing: 'border-box' },
  select: { padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)', fontSize: 13 },
  label: { fontSize: 11, color: 'var(--text-3)', marginBottom: 4 },
  btn: { padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12 },
  btnHijau: { padding: '7px 16px', borderRadius: 8, border: 'none', background: 'var(--green)', color: 'var(--on-green)', fontWeight: 700, cursor: 'pointer', fontSize: 12 },
  th: { padding: '8px 10px', fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textAlign: 'right', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', whiteSpace: 'nowrap' },
  td: { padding: '8px 10px', fontSize: 12, color: 'var(--text-1)', textAlign: 'right', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' },
};

function Card({ judul, catatan, children }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: 18, marginBottom: 16 }}>
      <div style={{ fontWeight: 700, fontSize: 14 }}>{judul}</div>
      {catatan && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{catatan}</div>}
      <div style={{ marginTop: 14 }}>{children}</div>
    </div>
  );
}

function Field({ label, children }) {
  return <div><div style={S.label}>{label}</div>{children}</div>;
}

function NumInput({ value, onChange, ...rest }) {
  return (
    <input type="number" min="0" value={value ? value : ''} placeholder="0"
      onChange={e => onChange(e.target.value === '' ? 0 : Math.max(0, Number(e.target.value)))} style={S.input} {...rest} />
  );
}

function DaftarTeks({ value, onChange, placeholder }) {
  return (
    <textarea rows={4} value={(value || []).join('\n')} placeholder={placeholder}
      onChange={e => onChange(e.target.value.split('\n'))} style={{ ...S.input, resize: 'vertical', fontFamily: 'inherit' }} />
  );
}

function GaleriUnggah({ gambar, onTambah, onHapus, sibuk, maks = 8 }) {
  const ref = useRef();
  return (
    <div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        {gambar.map(g => (
          <div key={g.id} style={{ position: 'relative', width: 96, height: 96, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: '#222' }}>
            <img src={g.data} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            <button onClick={() => onHapus(g)} title="Hapus" style={{ position: 'absolute', top: 3, right: 3, width: 22, height: 22, borderRadius: 11, border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', cursor: 'pointer', fontSize: 12, lineHeight: 1 }}>✕</button>
          </div>
        ))}
        {gambar.length < maks && (
          <button onClick={() => ref.current?.click()} disabled={sibuk} style={{ width: 96, height: 96, borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text-3)', cursor: sibuk ? 'wait' : 'pointer', fontSize: 12 }}>
            {sibuk ? '⏳' : '＋ Gambar'}
          </button>
        )}
      </div>
      <input ref={ref} type="file" accept="image/*" multiple style={{ display: 'none' }}
        onChange={e => { onTambah(Array.from(e.target.files || [])); e.target.value = ''; }} />
    </div>
  );
}

export default function LaporanAdsMingguan() {
  const { showToast } = useToast();
  const bulanOpts = useMemo(opsiBulan, []);
  const [brands, setBrands] = useState([]);
  const [brandId, setBrandId] = useState('');
  const [bulan, setBulan] = useState(bulanOpts[0].val);
  const [minggu, setMinggu] = useState(() => mingguSekarang(bulanOpts[0].val));
  const [tab, setTab] = useState('isi');

  const [muat, setMuat] = useState(false);
  const [data, setData] = useState(null);       // respons server (brand, auto, tersimpan)
  const [form, setForm] = useState(null);       // isian yang diedit
  const [gambar, setGambar] = useState([]);
  const [kotor, setKotor] = useState(false);
  const [menyimpan, setMenyimpan] = useState(false);
  const [sibuk, setSibuk] = useState('');       // jenis unggahan yang sedang berjalan
  const [ekspor, setEkspor] = useState(null);   // { i, n } saat membuat PDF

  const previewRef = useRef();
  const deckRef = useRef();
  const [lebar, setLebar] = useState(900);

  // Font slide (Montserrat) dimuat hanya saat halaman ini dibuka; Inter sudah dimuat aplikasi sebagai cadangan
  useEffect(() => {
    if (document.getElementById('font-laporan-ads')) return;
    const link = document.createElement('link');
    link.id = 'font-laporan-ads';
    link.rel = 'stylesheet';
    link.href = 'https://fonts.googleapis.com/css2?family=Montserrat:wght@500;700;800;900&display=swap';
    document.head.appendChild(link);
  }, []);

  useEffect(() => {
    api.getMetaBrands().then(r => {
      const aktif = (r.data || []).filter(b => b.aktif !== false);
      setBrands(aktif);
      if (aktif.length) setBrandId(prev => prev || String(aktif[0].id));
    }).catch(e => showToast('Gagal memuat brand: ' + e.message, 'error'));
  }, [showToast]);

  const muatData = useCallback(async () => {
    if (!brandId) return;
    setMuat(true);
    try {
      const r = await api.getLaporanAds(brandId, bulan);
      const d = r.data;
      setData(d);
      setForm({
        judul: d.profil.judul || d.brand.nama,
        ig_handle: d.profil.ig_handle || '',
        kpi: { impresi: 0, ctr: 0, profile_visit: 0, chat_masuk: 0, order: 0, ...(d.kpi || {}) },
        mingguan: [0, 1, 2, 3].map(i => normMinggu(d.mingguan?.[i])),
        kreatif: (d.kreatif || []).map(normKreatif),
      });
      setGambar(d.gambar || []);
      setKotor(false);
    } catch (e) {
      showToast('Gagal memuat laporan: ' + e.message, 'error');
      setData(null); setForm(null);
    } finally { setMuat(false); }
  }, [brandId, bulan, showToast]);

  useEffect(() => { muatData(); }, [muatData]);

  // Skala preview mengikuti lebar kontainer
  useEffect(() => {
    if (tab !== 'preview' || !previewRef.current) return undefined;
    const el = previewRef.current;
    const ro = new ResizeObserver(() => setLebar(el.clientWidth));
    ro.observe(el);
    setLebar(el.clientWidth);
    return () => ro.disconnect();
  }, [tab, form]);

  const konfirmasiKotor = () => !kotor || window.confirm('Ada perubahan yang belum disimpan. Lanjut dan buang perubahan?');
  const gantiBrand = (v) => { if (konfirmasiKotor()) setBrandId(v); };
  const gantiBulan = (v) => { if (konfirmasiKotor()) { setBulan(v); setMinggu(mingguSekarang(v)); } };

  const ubah = (fn) => { setForm(f => fn(f)); setKotor(true); };
  const ubahMinggu = (i, patch) => ubah(f => ({ ...f, mingguan: f.mingguan.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) }));
  const ubahKreatif = (i, patch) => ubah(f => ({ ...f, kreatif: f.kreatif.map((k, idx) => (idx === i ? { ...k, ...patch } : k)) }));

  const simpan = async (formSimpan = form, { diam = false } = {}) => {
    setMenyimpan(true);
    try {
      await api.saveLaporanAds({
        brand_id: brandId, bulan,
        profil: { judul: formSimpan.judul, ig_handle: formSimpan.ig_handle },
        kpi: formSimpan.kpi, mingguan: formSimpan.mingguan, kreatif: formSimpan.kreatif,
      });
      setKotor(false);
      if (!diam) showToast('Laporan tersimpan');
      return true;
    } catch (e) { showToast('Gagal menyimpan: ' + e.message, 'error'); return false; }
    finally { setMenyimpan(false); }
  };

  const unggah = async (jenis, file, mg) => {
    setSibuk(jenis);
    try {
      const dataUrl = await compressImage(file, jenis === 'maskot' ? { sisiMaks: 1100, keepAlpha: true } : { sisiMaks: 1400 });
      const r = await api.uploadGambarLaporanAds({ brand_id: brandId, bulan, minggu: mg, jenis, data: dataUrl });
      const baru = { id: r.data.id, jenis, minggu: mg ?? null, data: dataUrl };
      setGambar(prev => [...(jenis === 'maskot' ? prev.filter(g => g.jenis !== 'maskot') : prev), baru]);
      return baru;
    } catch (e) { showToast('Gagal unggah gambar: ' + e.message, 'error'); return null; }
    finally { setSibuk(''); }
  };

  const unggahBanyak = async (jenis, files, mg) => { for (const f of files) { if (!(await unggah(jenis, f, mg))) break; } };

  const hapusGambar = async (g) => {
    try {
      await api.hapusGambarLaporanAds(g.id);
      setGambar(prev => prev.filter(x => x.id !== g.id));
      if (g.jenis === 'kreatif') setForm(f => ({ ...f, kreatif: f.kreatif.filter(k => k.gambar_id !== g.id) }));
    } catch (e) { showToast('Gagal menghapus gambar: ' + e.message, 'error'); }
  };

  const tambahKreatif = async (files) => {
    let nf = form;
    for (const file of files) {
      const g = await unggah('kreatif', file);
      if (!g) break;
      nf = { ...nf, kreatif: [...nf.kreatif, normKreatif({ gambar_id: g.id })] };
      setForm(nf);
    }
    // simpan otomatis supaya kreatif yang baru diunggah tidak "yatim" bila halaman ditutup
    if (nf !== form) await simpan(nf, { diam: true });
  };

  const gambarKreatif = (id) => gambar.find(g => g.id === id)?.data || null;
  const maskot = gambar.find(g => g.jenis === 'maskot')?.data || null;
  const gambarMinggu = (jenis) => gambar.filter(g => g.jenis === jenis && g.minggu === minggu);

  const deckData = useMemo(() => {
    if (!form || !data) return null;
    return {
      judul: form.judul || data.brand.nama, igHandle: form.ig_handle, maskot, bulan, minggu,
      kpi: form.kpi, auto: data.auto, mingguan: form.mingguan,
      kreatif: form.kreatif.map(k => ({ nama: k.nama, gambar: gambar.find(g => g.id === k.gambar_id)?.data || null, mingguan: k.mingguan })),
      proyek: gambar.filter(g => g.jenis === 'proyek' && g.minggu === minggu).map(g => g.data),
      portofolio: gambar.filter(g => g.jenis === 'portofolio' && g.minggu === minggu).map(g => g.data),
    };
  }, [form, data, gambar, maskot, bulan, minggu]);

  const unduhPdf = async () => {
    if (!deckData) return;
    setEkspor({ i: 0, n: 0 });
    try {
      const [{ default: html2canvas }, { default: JsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')]);
      await new Promise(r => setTimeout(r, 500)); // beri waktu deck tersembunyi selesai render
      if (document.fonts?.load) {
        // pastikan bobot font slide sudah termuat sebelum ditangkap (gagal/offline → font cadangan)
        await Promise.all(['900 48px Montserrat', '800 34px Montserrat', '700 30px Montserrat', '500 27px Montserrat'].map(f => document.fonts.load(f).catch(() => {})));
      }
      if (document.fonts?.ready) await document.fonts.ready;
      const el = deckRef.current;
      await Promise.all(Array.from(el.querySelectorAll('img')).map(img => (img.decode ? img.decode().catch(() => {}) : null)));
      const slide = Array.from(el.querySelectorAll('[data-slide]'));
      const pdf = new JsPDF({ orientation: 'landscape', unit: 'px', format: [SLIDE_W, SLIDE_H], hotfixes: ['px_scaling'] });
      for (let i = 0; i < slide.length; i++) {
        setEkspor({ i: i + 1, n: slide.length });
        const canvas = await html2canvas(slide[i], { scale: 1, width: SLIDE_W, height: SLIDE_H, windowWidth: SLIDE_W, windowHeight: SLIDE_H, scrollX: 0, scrollY: 0, useCORS: true, backgroundColor: null, logging: false });
        if (i > 0) pdf.addPage([SLIDE_W, SLIDE_H], 'landscape');
        pdf.addImage(canvas.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, SLIDE_W, SLIDE_H);
      }
      const nama = String(deckData.judul).replace(/[\\/:*?"<>|]+/g, ' ').trim();
      pdf.save(`Weekly Report - ${nama} ${namaBulan(bulan)} ${minggu}.pdf`);
    } catch (e) { showToast('Gagal membuat PDF: ' + e.message, 'error'); }
    finally { setEkspor(null); }
  };

  if (!brands.length && !muat) {
    return (
      <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>📄 Laporan Ads Mingguan</div>
        <div className="empty" style={{ marginTop: 24 }}>
          <div className="empty-icon">📭</div>
          <div className="empty-title">Belum ada brand aktif</div>
          <div className="empty-sub">Tambahkan brand lebih dulu di halaman Ads Performance.</div>
        </div>
      </div>
    );
  }

  const totalProfit = data ? data.auto.slice(0, minggu).reduce((s, a) => s + a.profit, 0) : 0;
  const m = form?.mingguan[minggu - 1];
  const totalOrder = m ? m.order_queue.in_progress + m.order_queue.revisi + m.order_queue.ready : 0;
  const scale = Math.min(1, (lebar || SLIDE_W) / SLIDE_W);

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>📄 Laporan Ads Mingguan</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Laporan PDF per minggu (Minggu 1–4) untuk satu brand — angka iklan terisi otomatis dari Ads Performance</div>
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
        <select value={brandId} onChange={e => gantiBrand(e.target.value)} style={{ ...S.select, minWidth: 130 }}>
          {brands.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
        </select>
        <select value={bulan} onChange={e => gantiBulan(e.target.value)} style={S.select}>
          {bulanOpts.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
        <select value={minggu} onChange={e => setMinggu(Number(e.target.value))} style={S.select} title={RENTANG_MINGGU[minggu - 1]}>
          {[1, 2, 3, 4].map(w => <option key={w} value={w}>Minggu {w} ({RENTANG_MINGGU[w - 1]})</option>)}
        </select>
        <div style={{ flex: 1 }} />
        {kotor && <span style={{ fontSize: 11, color: '#FFB84B' }}>● Belum disimpan</span>}
        <button onClick={() => simpan()} disabled={menyimpan || !form} style={{ ...S.btnHijau, cursor: menyimpan ? 'not-allowed' : 'pointer' }}>{menyimpan ? 'Menyimpan…' : '💾 Simpan'}</button>
        <button onClick={unduhPdf} disabled={!deckData || !!ekspor} style={{ ...S.btn, cursor: ekspor ? 'wait' : 'pointer' }}>⬇️ Download PDF</button>
      </div>

      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {[['isi', '✏️ Isi Data'], ['preview', '👁️ Preview Slide']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '8px 14px', fontSize: 13, fontWeight: tab === id ? 700 : 500, background: 'none', border: 'none', borderBottom: `2px solid ${tab === id ? 'var(--green)' : 'transparent'}`, color: tab === id ? 'var(--text-1)' : 'var(--text-3)', cursor: 'pointer' }}>{label}</button>
        ))}
      </div>

      {muat || !form ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13, padding: 24 }}>Memuat…</div>
      ) : tab === 'preview' ? (
        <div ref={previewRef}>
          <SlideDeck data={deckData} scale={scale} />
        </div>
      ) : (
        <>
          <Card judul="Angka otomatis dari Ads Performance" catatan={`Dihitung dari data sync & Input Harian brand ini. Profit = Omzet − HPP (${data.brand.hpp_default}%) − Iklan. Spend ${data.brand.mata_uang === 'USD' ? 'dari akun USD dikonversi ke Rupiah dengan kurs brand' : 'dalam Rupiah'}. Atur HPP & kurs di ⚙️ Setting pada Ads Performance.`}>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Minggu', 'Impresi', 'CTR', 'Iklan', 'Omzet', 'Profit', 'Order'].map((h, i) => <th key={h} style={{ ...S.th, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.auto.map(a => (
                    <tr key={a.minggu} style={{ opacity: a.minggu <= minggu ? 1 : 0.45 }}>
                      <td style={{ ...S.td, textAlign: 'left' }}>Minggu {a.minggu} <span style={{ color: 'var(--text-3)', fontSize: 11 }}>({RENTANG_MINGGU[a.minggu - 1]})</span></td>
                      <td style={S.td}>{fmtInt(a.impresi)}</td>
                      <td style={S.td}>{a.ctr === null ? '—' : a.ctr.toFixed(2) + '%'}</td>
                      <td style={S.td}>{fmtRp(a.spend)}</td>
                      <td style={S.td}>{fmtRp(a.omzet)}</td>
                      <td style={{ ...S.td, color: a.profit < 0 ? '#FF6B6B' : 'var(--text-1)', fontWeight: 700 }}>{fmtRp(a.profit)}</td>
                      <td style={S.td}>{a.jumlah_order}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 10 }}>Total Profit Minggu 1–{minggu}: <b style={{ color: totalProfit < 0 ? '#FF6B6B' : 'var(--text-1)' }}>{fmtRp(totalProfit)}</b></div>
            {!data.auto.slice(0, minggu).some(a => a.ada_data) && (
              <div style={{ fontSize: 12, color: '#FFB84B', marginTop: 8 }}>⚠️ Belum ada data iklan untuk periode ini. Klik Sync Meta atau Input Harian di Ads Performance.</div>
            )}
          </Card>

          <Card judul="Tampilan laporan (per brand)" catatan="Tersimpan untuk semua bulan brand ini.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, alignItems: 'end' }}>
              <Field label="Nama studio (judul cover)"><input value={form.judul} onChange={e => ubah(f => ({ ...f, judul: e.target.value }))} style={S.input} placeholder="Shuyou Studio" /></Field>
              <Field label="Handle Instagram"><input value={form.ig_handle} onChange={e => ubah(f => ({ ...f, ig_handle: e.target.value }))} style={S.input} placeholder="shuyou_3d_artist" /></Field>
              <Field label="Maskot (PNG transparan)">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {maskot ? <img src={maskot} alt="" style={{ width: 44, height: 44, objectFit: 'contain', background: '#3a3a3a', borderRadius: 6 }} /> : null}
                  <label style={{ ...S.btn, display: 'inline-block' }}>
                    {sibuk === 'maskot' ? '⏳ Mengunggah…' : maskot ? 'Ganti' : 'Unggah'}
                    <input type="file" accept="image/*" style={{ display: 'none' }} disabled={!!sibuk} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) unggah('maskot', f); }} />
                  </label>
                  {maskot && <button onClick={() => hapusGambar(gambar.find(g => g.jenis === 'maskot'))} style={S.btn}>Hapus</button>}
                </div>
              </Field>
            </div>
          </Card>

          <Card judul="Target KPI" catatan="Kolom KPI di tabel Performance Tracking. Otomatis terbawa ke bulan berikutnya.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
              <Field label="Impresi"><NumInput value={form.kpi.impresi} onChange={v => ubah(f => ({ ...f, kpi: { ...f.kpi, impresi: v } }))} /></Field>
              <Field label="CTR (%)"><NumInput step="0.1" value={form.kpi.ctr} onChange={v => ubah(f => ({ ...f, kpi: { ...f.kpi, ctr: v } }))} /></Field>
              <Field label="Profile Visit"><NumInput value={form.kpi.profile_visit} onChange={v => ubah(f => ({ ...f, kpi: { ...f.kpi, profile_visit: v } }))} /></Field>
              <Field label="Chat masuk"><NumInput value={form.kpi.chat_masuk} onChange={v => ubah(f => ({ ...f, kpi: { ...f.kpi, chat_masuk: v } }))} /></Field>
              <Field label="Order"><NumInput value={form.kpi.order} onChange={v => ubah(f => ({ ...f, kpi: { ...f.kpi, order: v } }))} /></Field>
            </div>
          </Card>

          <Card judul="Performance Tracking — isian manual" catatan="Profile Visit, Chat masuk, dan To Do per minggu (belum otomatis dari Instagram/Meta). To Do: satu baris satu poin.">
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: 14 }}>
              {[0, 1, 2, 3].map(i => (
                <div key={i} style={{ opacity: i + 1 <= minggu ? 1 : 0.5 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Minggu {i + 1}</div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                    <Field label="Profile Visit"><NumInput value={form.mingguan[i].profile_visit} onChange={v => ubahMinggu(i, { profile_visit: v })} /></Field>
                    <Field label="Chat masuk"><NumInput value={form.mingguan[i].chat_masuk} onChange={v => ubahMinggu(i, { chat_masuk: v })} /></Field>
                  </div>
                  <Field label="To Do List"><DaftarTeks value={form.mingguan[i].todo} onChange={v => ubahMinggu(i, { todo: v })} placeholder={'selesaikan order\nupdate konten'} /></Field>
                </div>
              ))}
            </div>
          </Card>

          <Card judul={`Minggu ${minggu} — order, kendala, dan gambar`} catatan={`Bagian ini khusus laporan Minggu ${minggu}. Ganti minggu di atas untuk mengisi minggu lain.`}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 18 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Order queue <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>· Total {totalOrder}</span></div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                  <Field label="In Progress"><NumInput value={m.order_queue.in_progress} onChange={v => ubahMinggu(minggu - 1, { order_queue: { ...m.order_queue, in_progress: v } })} /></Field>
                  <Field label="Revision"><NumInput value={m.order_queue.revisi} onChange={v => ubahMinggu(minggu - 1, { order_queue: { ...m.order_queue, revisi: v } })} /></Field>
                  <Field label="Ready"><NumInput value={m.order_queue.ready} onChange={v => ubahMinggu(minggu - 1, { order_queue: { ...m.order_queue, ready: v } })} /></Field>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Flow in a week</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  <Field label="New Order"><NumInput value={m.flow_new} onChange={v => ubahMinggu(minggu - 1, { flow_new: v })} /></Field>
                  <Field label="Complete Order"><NumInput value={m.flow_complete} onChange={v => ubahMinggu(minggu - 1, { flow_complete: v })} /></Field>
                </div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Problem in a week</div>
                <DaftarTeks value={m.kendala} onChange={v => ubahMinggu(minggu - 1, { kendala: v })} placeholder={'chat masuk sedikit\niklan kurang optimal'} />
              </div>
            </div>
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Completed Projects in a week</div>
              <GaleriUnggah gambar={gambarMinggu('proyek')} sibuk={sibuk === 'proyek'} onTambah={f => unggahBanyak('proyek', f, minggu)} onHapus={hapusGambar} />
            </div>
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>New portfolio <span style={{ color: 'var(--text-3)', fontWeight: 400 }}>· slide dilewati bila kosong</span></div>
              <GaleriUnggah gambar={gambarMinggu('portofolio')} sibuk={sibuk === 'portofolio'} onTambah={f => unggahBanyak('portofolio', f, minggu)} onHapus={hapusGambar} />
            </div>
          </Card>

          <Card judul="Ads Creatives" catatan="Satu slide per kreatif. Unggah gambar iklan, lalu isi chat masuk & order tiap minggu (order dari DM harus diisi manual).">
            {form.kreatif.map((k, i) => (
              <div key={i} style={{ display: 'flex', gap: 14, flexWrap: 'wrap', padding: 12, border: '1px solid var(--border)', borderRadius: 10, marginBottom: 12 }}>
                <div style={{ position: 'relative', width: 110, height: 150, borderRadius: 8, overflow: 'hidden', background: '#222', flexShrink: 0 }}>
                  {gambarKreatif(k.gambar_id) ? <img src={gambarKreatif(k.gambar_id)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: '#888', fontSize: 11, padding: 8, display: 'block' }}>Tanpa gambar</span>}
                </div>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <Field label="Nama kreatif (opsional)"><input value={k.nama} onChange={e => ubahKreatif(i, { nama: e.target.value })} style={S.input} placeholder="Iklan A — 3D print" /></Field>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, marginTop: 10 }}>
                    {[0, 1, 2, 3].map(w => (
                      <div key={w} style={{ opacity: w + 1 <= minggu ? 1 : 0.5 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, marginBottom: 4 }}>Minggu {w + 1}</div>
                        <Field label="Chat masuk"><NumInput value={k.mingguan[w].chat} onChange={v => ubahKreatif(i, { mingguan: k.mingguan.map((x, idx) => (idx === w ? { ...x, chat: v } : x)) })} /></Field>
                        <div style={{ height: 6 }} />
                        <Field label="Order"><NumInput value={k.mingguan[w].order} onChange={v => ubahKreatif(i, { mingguan: k.mingguan.map((x, idx) => (idx === w ? { ...x, order: v } : x)) })} /></Field>
                      </div>
                    ))}
                  </div>
                </div>
                <div><button onClick={() => { const g = gambar.find(x => x.id === k.gambar_id); if (g) hapusGambar(g); else ubah(f => ({ ...f, kreatif: f.kreatif.filter((_, idx) => idx !== i) })); }} style={{ ...S.btn, color: '#FF6B6B' }}>Hapus</button></div>
              </div>
            ))}
            {form.kreatif.length < 6 && (
              <label style={{ ...S.btn, display: 'inline-block' }}>
                {sibuk === 'kreatif' ? '⏳ Mengunggah…' : '＋ Tambah kreatif (unggah gambar iklan)'}
                <input type="file" accept="image/*" multiple style={{ display: 'none' }} disabled={!!sibuk} onChange={e => { const f = Array.from(e.target.files || []); e.target.value = ''; if (f.length) tambahKreatif(f.slice(0, 6 - form.kreatif.length)); }} />
              </label>
            )}
          </Card>
        </>
      )}

      {/* Deck tersembunyi 1920×1080 untuk ekspor PDF + layar penutup selama proses */}
      {ekspor && deckData && (
        <>
          <div ref={deckRef} style={{ position: 'fixed', left: 0, top: 0, width: SLIDE_W, zIndex: 9990 }}>
            <SlideDeck data={deckData} scale={1} />
          </div>
          <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'var(--bg, #0b0f1a)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 10 }}>
            <div style={{ fontSize: 40 }}>📄</div>
            <div style={{ fontWeight: 700 }}>Membuat PDF…</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{ekspor.n ? `Slide ${ekspor.i} dari ${ekspor.n}` : 'Menyiapkan slide'}</div>
          </div>
        </>
      )}
    </div>
  );
}
