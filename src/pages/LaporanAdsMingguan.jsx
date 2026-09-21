import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { compressImage } from '../utils/imageCompress';
import { simpanBlob } from '../utils/simpanBlob';
import SlideDeck, { SLIDE_W, SLIDE_H, namaBulan, labelRentang } from '../components/laporanAds/SlideDeck';
import RiwayatArsip from '../components/laporanAds/RiwayatArsip';
import { rentangBawaan, bangunDariMulai, rentangSama, validasiRentang, celahRentang, hariIni, selisihHari, tambahHari, tglValid } from '../utils/periodeMinggu';

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
  const [ekspor, setEkspor] = useState(null);   // { i, n, tahap } saat membuat PDF
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [arsip, setArsip] = useState([]);       // PDF tersimpan di Riwayat untuk brand+bulan terpilih (penanda ✓)
  const [rentangDihitung, setRentangDihitung] = useState('');   // kunci JSON periode yang cocok dengan data.auto saat ini
  const [rentangTersimpan, setRentangTersimpan] = useState(null); // periode terakhir dimuat/disimpan (untuk peringatan "PDF sudah ada")
  const [w4AkhirBulan, setW4AkhirBulan] = useState(true);
  const mingguManualRef = useRef(false);        // true bila minggu dipilih pengguna → jangan ditimpa deteksi "minggu sekarang"
  const permintaanHitung = useRef(0);
  const permintaanMuat = useRef(0);             // nomor pemuatan terbaru — balasan yang basi (ganti brand/bulan cepat) diabaikan
  const permintaanArsip = useRef(0);
  const kunciAktif = useRef('');                // "brand|bulan" yang sedang tampil, untuk menolak hasil unggahan yang basi

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
    const id = ++permintaanMuat.current;
    // Kosongkan dulu: selama memuat, form/data milik brand/bulan SEBELUMNYA tidak boleh tersisa — Simpan & Download
    // memakai brandId yang baru, jadi data lama akan tertulis/terpublikasi ke brand yang salah.
    setMuat(true); setForm(null); setData(null); setKotor(false);
    try {
      const r = await api.getLaporanAds(brandId, bulan);
      if (id !== permintaanMuat.current) return; // sudah ada pemuatan yang lebih baru — hasil basi diabaikan
      const d = r.data;
      // Backend yang belum versi terbaru (mis. deploy frontend selesai lebih dulu) tidak mengirim periode → pakai bawaan
      if (!Array.isArray(d.rentang) || d.rentang.length !== 4) d.rentang = rentangBawaan(bulan);
      setData(d);
      setForm({
        judul: d.profil.judul || d.brand.nama,
        ig_handle: d.profil.ig_handle || '',
        kpi: { impresi: 0, ctr: 0, profile_visit: 0, chat_masuk: 0, order: 0, ...(d.kpi || {}) },
        mingguan: [0, 1, 2, 3].map(i => normMinggu(d.mingguan?.[i])),
        kreatif: (d.kreatif || []).map(normKreatif),
        rentang: d.rentang,
      });
      setRentangDihitung(JSON.stringify(d.rentang));
      setRentangTersimpan(d.rentang);
      setGambar(d.gambar || []);
      setKotor(false);
      // "minggu sekarang" = periode yang memuat hari ini (bukan rumus tanggal), kecuali pengguna sudah memilih sendiri
      if (!mingguManualRef.current && bulan === bulanSekarang()) {
        const hari = hariIni();
        const idx = d.rentang.findIndex(x => hari >= x.dari && hari <= x.sampai);
        if (idx >= 0) setMinggu(idx + 1);
      }
    } catch (e) {
      if (id !== permintaanMuat.current) return;
      showToast('Gagal memuat laporan: ' + e.message, 'error');
      setData(null); setForm(null);
    } finally { if (id === permintaanMuat.current) setMuat(false); }
  }, [brandId, bulan, showToast]);

  useEffect(() => { muatData(); }, [muatData]);

  const muatArsip = useCallback(async () => {
    if (!brandId) return;
    const id = ++permintaanArsip.current;
    try {
      const r = await api.getArsipLaporanAds(brandId, bulan);
      if (id === permintaanArsip.current) setArsip(r.data || []);
    } catch { if (id === permintaanArsip.current) setArsip([]); } // hanya untuk penanda; kegagalan tidak perlu mengganggu halaman
  }, [brandId, bulan]);

  useEffect(() => { muatArsip(); }, [muatArsip]);
  useEffect(() => { kunciAktif.current = `${brandId}|${bulan}`; }, [brandId, bulan]);

  // Periode diedit → hitung ulang angka otomatis (tanpa menyimpan) setelah jeda singkat, supaya tabel & preview ikut berubah
  const kunciRentang = form ? JSON.stringify(form.rentang) : '';
  useEffect(() => {
    if (!form || !data || kunciRentang === rentangDihitung) return undefined;
    if (validasiRentang(form.rentang, bulan).ada) return undefined; // tunggu sampai valid
    const id = ++permintaanHitung.current;
    const t = setTimeout(async () => {
      try {
        const r = await api.hitungAngkaLaporanAds(brandId, bulan, form.rentang);
        if (id !== permintaanHitung.current) return; // sudah ada permintaan yang lebih baru
        setData(prev => (prev ? { ...prev, auto: r.data.auto, peringatan: r.data.peringatan } : prev));
        setRentangDihitung(kunciRentang);
      } catch (e) { if (id === permintaanHitung.current) showToast('Gagal menghitung ulang angka: ' + e.message, 'error'); }
    }, 500);
    return () => clearTimeout(t);
  }, [form, data, kunciRentang, rentangDihitung, brandId, bulan, showToast]);

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
  const gantiBrand = (v) => { if (konfirmasiKotor()) { mingguManualRef.current = false; setBrandId(v); } };
  const gantiBulan = (v) => { if (konfirmasiKotor()) { mingguManualRef.current = false; setBulan(v); setMinggu(mingguSekarang(v)); } };

  const ubah = (fn) => { setForm(f => fn(f)); setKotor(true); };
  const ubahRentang = (r) => ubah(f => ({ ...f, rentang: r }));
  const ubahRentangSatu = (i, patch) => ubah(f => ({ ...f, rentang: f.rentang.map((x, idx) => (idx === i ? { ...x, ...patch } : x)) }));
  const terapkanMulai = (mulai) => ubahRentang(bangunDariMulai(mulai, bulan, w4AkhirBulan));
  const ubahMinggu = (i, patch) => ubah(f => ({ ...f, mingguan: f.mingguan.map((m, idx) => (idx === i ? { ...m, ...patch } : m)) }));
  const ubahKreatif = (i, patch) => ubah(f => ({ ...f, kreatif: f.kreatif.map((k, idx) => (idx === i ? { ...k, ...patch } : k)) }));

  const simpan = async (formSimpan = form, { diam = false } = {}) => {
    if (validasiRentang(formSimpan.rentang, bulan).ada) {
      showToast('Periode minggu belum valid — perbaiki dulu di panel "Periode minggu"', 'warning');
      return false;
    }
    setMenyimpan(true);
    try {
      const r = await api.saveLaporanAds({
        brand_id: brandId, bulan,
        profil: { judul: formSimpan.judul, ig_handle: formSimpan.ig_handle },
        kpi: formSimpan.kpi, mingguan: formSimpan.mingguan, kreatif: formSimpan.kreatif,
        rentang: rentangSama(formSimpan.rentang, rentangBawaan(bulan)) ? null : formSimpan.rentang, // null = kembali ke bawaan
      });
      setKotor(false);
      setRentangTersimpan(formSimpan.rentang);
      if (r?.peringatan) setData(prev => (prev ? { ...prev, peringatan: r.peringatan } : prev));
      if (!diam) showToast('Laporan tersimpan');
      return true;
    } catch (e) { showToast('Gagal menyimpan: ' + e.message, 'error'); return false; }
    finally { setMenyimpan(false); }
  };

  const unggah = async (jenis, file, mg) => {
    setSibuk(jenis);
    const kunci = `${brandId}|${bulan}`;
    try {
      const dataUrl = await compressImage(file, jenis === 'maskot' ? { sisiMaks: 1100, keepAlpha: true } : { sisiMaks: 1400 });
      const r = await api.uploadGambarLaporanAds({ brand_id: brandId, bulan, minggu: mg, jenis, data: dataUrl });
      const baru = { id: r.data.id, jenis, minggu: mg ?? null, data: dataUrl };
      if (kunciAktif.current !== kunci) return null; // brand/bulan sudah berganti selama unggah — gambar sudah masuk ke brand yang benar di server
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
      kpi: form.kpi, auto: data.auto, mingguan: form.mingguan, rentang: form.rentang,
      kreatif: form.kreatif.map(k => ({ nama: k.nama, gambar: gambar.find(g => g.id === k.gambar_id)?.data || null, mingguan: k.mingguan })),
      proyek: gambar.filter(g => g.jenis === 'proyek' && g.minggu === minggu).map(g => g.data),
      portofolio: gambar.filter(g => g.jenis === 'portofolio' && g.minggu === minggu).map(g => g.data),
    };
  }, [form, data, gambar, maskot, bulan, minggu]);

  // Buka bulan+minggu dari Riwayat di tab Isi Data (data terkini, bukan potret PDF)
  const bukaMinggu = (b, mg) => {
    if (!konfirmasiKotor()) return;
    mingguManualRef.current = true;
    const samaBulan = b === bulan;
    setBulan(b); setMinggu(mg); setTab('isi');
    if (samaBulan && kotor) muatData(); // bulan sama → tidak ada muat ulang otomatis; buang perubahan yang belum disimpan
  };

  const unduhPdf = async () => {
    if (!deckData) return;
    // Angka beku di Riwayat dihitung server dari data TERSIMPAN — pastikan isi PDF = yang tersimpan
    if (kotor && !(await simpan(form, { diam: true }))) return;
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
      const blob = pdf.output('blob');
      simpanBlob(blob, `Weekly Report - ${nama} ${namaBulan(bulan)} ${minggu}.pdf`); // unduh dulu — tetap jalan walau Riwayat gagal
      setEkspor({ i: slide.length, n: slide.length, tahap: 'simpan' });
      try {
        const r = await api.unggahArsipLaporanAds(brandId, bulan, minggu, slide.length, blob);
        showToast(`PDF tersimpan di Riwayat (v${r.data.versi})`);
        muatArsip();
      } catch (e) { showToast('PDF terunduh, tetapi gagal masuk Riwayat: ' + e.message, 'warning'); }
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
  const mingguAdaPdf = new Set(arsip.map(a => a.minggu));
  const pdfTerakhir = arsip.find(a => a.minggu === minggu); // daftar urut versi ↓ → yang pertama = terbaru
  // bulan yang dibuka dari Riwayat bisa di luar 12 bulan terakhir — tetap tampil di pilihan
  const bulanOptsTampil = bulanOpts.some(o => o.val === bulan) ? bulanOpts : [...bulanOpts, { val: bulan, label: `${namaBulan(bulan)} ${bulan.slice(0, 4)}` }];
  const rentangTampil = form?.rentang || rentangBawaan(bulan);
  const labelMinggu = (w) => labelRentang(rentangTampil[w - 1].dari, rentangTampil[w - 1].sampai);
  const cekPeriode = form ? validasiRentang(form.rentang, bulan) : { galat: [null, null, null, null], ada: false };
  // minggu yang periodenya sedang diubah padahal PDF-nya sudah pernah dibuat
  const pdfTerdampak = form && rentangTersimpan
    ? [0, 1, 2, 3].filter(i => mingguAdaPdf.has(i + 1) && (form.rentang[i].dari !== rentangTersimpan[i].dari || form.rentang[i].sampai !== rentangTersimpan[i].sampai))
    : [];
  const fmtTgl = (s) => labelRentang(s, s);

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
          {bulanOptsTampil.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
        <select value={minggu} onChange={e => { mingguManualRef.current = true; setMinggu(Number(e.target.value)); }} style={S.select} title={labelMinggu(minggu)}>
          {[1, 2, 3, 4].map(w => <option key={w} value={w}>Minggu {w} ({labelMinggu(w)}){mingguAdaPdf.has(w) ? ' ✓ PDF' : ''}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        {kotor && <span style={{ fontSize: 11, color: '#FFB84B' }}>● Belum disimpan</span>}
        <button onClick={() => simpan()} disabled={menyimpan || !form} style={{ ...S.btnHijau, cursor: menyimpan ? 'not-allowed' : 'pointer' }}>{menyimpan ? 'Menyimpan…' : '💾 Simpan'}</button>
        <button onClick={unduhPdf} disabled={!deckData || !!ekspor || cekPeriode.ada} title={cekPeriode.ada ? 'Perbaiki dulu periode minggu yang belum valid' : undefined} style={{ ...S.btn, cursor: ekspor ? 'wait' : cekPeriode.ada ? 'not-allowed' : 'pointer' }}>⬇️ Download PDF</button>
      </div>

      {pdfTerakhir && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', margin: '-6px 0 12px' }}>
          ✓ PDF Minggu {minggu} terakhir dibuat: <b>v{pdfTerakhir.versi}</b> oleh {pdfTerakhir.dibuat_oleh || '—'} · {new Date(pdfTerakhir.dibuat_pada).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
          {' '}<button onClick={() => setTab('riwayat')} style={{ background: 'none', border: 'none', color: 'var(--green)', cursor: 'pointer', fontSize: 11, padding: 0 }}>lihat riwayat</button>
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
        {[['isi', '✏️ Isi Data'], ['preview', '👁️ Preview Slide'], ['riwayat', '📚 Riwayat']].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id)} style={{ padding: '8px 14px', fontSize: 13, fontWeight: tab === id ? 700 : 500, background: 'none', border: 'none', borderBottom: `2px solid ${tab === id ? 'var(--green)' : 'transparent'}`, color: tab === id ? 'var(--text-1)' : 'var(--text-3)', cursor: 'pointer' }}>{label}</button>
        ))}
      </div>

      {tab === 'riwayat' ? (
        <RiwayatArsip brandId={brandId} opsiBulan={bulanOptsTampil} isAdmin={isAdmin} showToast={showToast} onBuka={bukaMinggu} />
      ) : muat || !form ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13, padding: 24 }}>Memuat…</div>
      ) : tab === 'preview' ? (
        <div ref={previewRef}>
          <SlideDeck data={deckData} scale={scale} />
        </div>
      ) : (
        <>
          <Card judul="Periode minggu" catatan={`Atur tanggal mulai & akhir tiap minggu — Impresi, Iklan, Omzet, Profit, dan Order dihitung dari periode ini. Bawaan: 1–7, 8–14, 15–21, 22–akhir bulan. Tersimpan per bulan.`}>
            {data.saran_lanjut && form.rentang[0].dari !== data.saran_lanjut.dari && (
              <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderLeft: '3px solid var(--green)', borderRadius: 8, padding: '9px 12px', fontSize: 12, color: 'var(--text-2)', marginBottom: 12, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ flex: 1, minWidth: 220 }}>
                  Minggu 4 bulan lalu berakhir <b>{fmtTgl(tambahHari(data.saran_lanjut.dari, -1))}</b>. Mulai Minggu 1 dari <b>{fmtTgl(data.saran_lanjut.dari)}</b> supaya tidak ada hari yang hilang atau terhitung dua kali?
                </span>
                <button onClick={() => terapkanMulai(data.saran_lanjut.dari)} style={S.btnHijau}>Lanjutkan dari bulan lalu</button>
              </div>
            )}
            <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'flex-end', marginBottom: 12 }}>
              <Field label="Mulai Minggu 1 dari">
                <input type="date" aria-label="Mulai Minggu 1 dari" value={form.rentang[0].dari} onChange={e => { if (tglValid(e.target.value)) terapkanMulai(e.target.value); }} style={{ ...S.input, width: 170 }} />
              </Field>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)', cursor: 'pointer', paddingBottom: 8 }}>
                <input type="checkbox" checked={w4AkhirBulan} onChange={e => setW4AkhirBulan(e.target.checked)} />
                Minggu 4 sampai akhir bulan
              </label>
              <button onClick={() => ubahRentang(rentangBawaan(bulan))} style={S.btn} title="1–7, 8–14, 15–21, 22–akhir bulan">↺ Kembali ke bawaan</button>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              {form.rentang.map((r, i) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: '80px minmax(0,1fr) minmax(0,1fr) 64px', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 12, fontWeight: 700 }}>Minggu {i + 1}</span>
                  <input type="date" aria-label={`Minggu ${i + 1} dari`} value={r.dari} onChange={e => ubahRentangSatu(i, { dari: e.target.value })} style={{ ...S.input, borderColor: cekPeriode.galat[i] ? '#FF6B6B' : undefined }} />
                  <input type="date" aria-label={`Minggu ${i + 1} sampai`} value={r.sampai} onChange={e => ubahRentangSatu(i, { sampai: e.target.value })} style={{ ...S.input, borderColor: cekPeriode.galat[i] ? '#FF6B6B' : undefined }} />
                  <span style={{ fontSize: 11, color: 'var(--text-3)' }}>{tglValid(r.dari) && tglValid(r.sampai) && r.sampai >= r.dari ? `${selisihHari(r.dari, r.sampai) + 1} hari` : ''}</span>
                  {cekPeriode.galat[i] && <div style={{ gridColumn: '1 / -1', color: '#FF6B6B', fontSize: 11 }}>⛔ Minggu {i + 1}: {cekPeriode.galat[i]}</div>}
                </div>
              ))}
            </div>
            {!cekPeriode.ada && (data.peringatan || []).map((t, i) => <div key={`p${i}`} style={{ fontSize: 12, color: '#FFB84B', marginTop: 8 }}>⚠️ {t}</div>)}
            {!cekPeriode.ada && celahRentang(form.rentang).map((t, i) => <div key={`c${i}`} style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>ℹ️ {t}</div>)}
            {pdfTerdampak.map(i => (
              <div key={`d${i}`} style={{ fontSize: 12, color: '#FFB84B', marginTop: 8 }}>⚠️ Minggu {i + 1} sudah punya PDF — mengubah periodenya mengubah angka pada PDF berikutnya (PDF lama tetap utuh di Riwayat).</div>
            ))}
          </Card>

          <Card judul="Angka otomatis dari Ads Performance" catatan={`Dihitung dari data sync & Input Harian brand ini. Profit = Omzet − HPP (${data.brand.hpp_default}%) − Iklan. Spend ${data.brand.mata_uang === 'USD' ? 'dari akun USD dikonversi ke Rupiah dengan kurs brand' : 'dalam Rupiah'}. Atur HPP & kurs di ⚙️ Setting pada Ads Performance.`}>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead><tr>{['Minggu', 'Impresi', 'CTR', 'Iklan', 'Omzet', 'Profit', 'Order'].map((h, i) => <th key={h} style={{ ...S.th, textAlign: i === 0 ? 'left' : 'right' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {data.auto.map(a => (
                    <tr key={a.minggu} style={{ opacity: a.minggu <= minggu ? 1 : 0.45 }}>
                      <td style={{ ...S.td, textAlign: 'left' }}>Minggu {a.minggu} <span style={{ color: 'var(--text-3)', fontSize: 11 }}>({labelMinggu(a.minggu)})</span></td>
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
            <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{ekspor.tahap === 'simpan' ? 'Menyimpan ke Riwayat…' : ekspor.n ? `Slide ${ekspor.i} dari ${ekspor.n}` : 'Menyiapkan slide'}</div>
          </div>
        </>
      )}
    </div>
  );
}
