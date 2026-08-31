import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import { SkeletonTable } from '../components/Skeleton';

const BULAN_LABEL = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

function getBulanOptions() {
  const now = new Date();
  const opts = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    opts.push({ val, label: `${BULAN_LABEL[d.getMonth()]} ${d.getFullYear()}` });
  }
  return opts;
}

function fmt(n, prefix = '') {
  if (n === null || n === undefined) return '—';
  return prefix + Number(n).toLocaleString('id-ID');
}

function fmtRp(n) {
  if (n === null || n === undefined) return '—';
  const num = Number(n);
  if (num >= 1_000_000) return 'Rp ' + (num / 1_000_000).toFixed(1) + 'jt';
  if (num >= 1_000)     return 'Rp ' + (num / 1_000).toFixed(0) + 'rb';
  return 'Rp ' + num.toLocaleString('id-ID');
}

function MetricCard({ label, value, sub, color }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: color || 'var(--text-1)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function ProfitBadge({ val }) {
  if (val === null || val === undefined || val === '—') return <span style={{ color: 'var(--text-3)' }}>—</span>;
  const n = Number(val);
  const color = n >= 0 ? '#00D68F' : '#FF6B6B';
  return <span style={{ fontWeight: 700, color }}>{fmtRp(n)}</span>;
}

function EditReportModal({ row, brands, onSave, onClose }) {
  const { showToast } = useToast();
  const selBrand = brands.find(b => String(b.id) === String(row?.brand_id)) || brands[0];
  const kurs = Number(selBrand?.kurs_usd || 16000);
  const omzetUsdInit = row?.omzet ? (Number(row.omzet) / kurs).toFixed(2) : '';

  const [form, setForm] = useState({
    brand_id:     row?.brand_id    || (brands[0]?.id ?? ''),
    tanggal:      row?.tanggal?.slice(0,10) || new Date().toISOString().slice(0,10),
    jumlah_order: row?.jumlah_order ?? '',
    omzet_usd:    omzetUsdInit,
    catatan:      row?.catatan_report || '',
  });
  const [saving, setSaving] = useState(false);

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const activeBrand = brands.find(b => String(b.id) === String(form.brand_id));
  const activeKurs = Number(activeBrand?.kurs_usd || 16000);
  const activeHpp = Number(activeBrand?.hpp_default || 0);
  const omzetIdrPreview = Number(form.omzet_usd || 0) * activeKurs;
  const profitPreview = omzetIdrPreview - (omzetIdrPreview * activeHpp / 100);

  const handleSave = async () => {
    if (!form.brand_id || !form.tanggal) return;
    setSaving(true);
    try {
      await api.saveMetaReport({
        brand_id: form.brand_id,
        tanggal: form.tanggal,
        jumlah_order: Number(form.jumlah_order) || 0,
        omzet_usd: Number(form.omzet_usd) || 0,
        catatan: form.catatan,
      });
      onSave();
      showToast('Data harian berhasil disimpan');
    } catch (e) {
      showToast('Gagal simpan: ' + e.message, 'error');
    } finally { setSaving(false); }
  };

  const inputStyle = { width: '100%', padding: '8px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)', fontSize: 13, boxSizing: 'border-box' };
  const lbl = (txt) => <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{txt}</div>;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 420, boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Input Data Harian</div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            {lbl('Brand')}
            <select value={form.brand_id} onChange={e => set('brand_id', e.target.value)} style={inputStyle}>
              {brands.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
            </select>
          </div>
          <div>
            {lbl('Tanggal')}
            <input type="date" value={form.tanggal} onChange={e => set('tanggal', e.target.value)} style={inputStyle} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              {lbl('Jumlah Order')}
              <input type="number" min="0" value={form.jumlah_order} onChange={e => set('jumlah_order', e.target.value)} style={inputStyle} placeholder="0" />
            </div>
            <div>
              {lbl('Omzet (USD $)')}
              <input type="number" min="0" step="0.01" value={form.omzet_usd} onChange={e => set('omzet_usd', e.target.value)} style={inputStyle} placeholder="0.00" />
            </div>
          </div>
          {/* Preview konversi */}
          <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px', fontSize: 12, display: 'grid', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-3)' }}>Kurs (1 USD)</span>
              <span style={{ fontWeight: 600 }}>Rp {activeKurs.toLocaleString('id-ID')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'var(--text-3)' }}>Omzet (IDR)</span>
              <span style={{ fontWeight: 600, color: '#00D68F' }}>Rp {omzetIdrPreview.toLocaleString('id-ID')}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border)', paddingTop: 4, marginTop: 2 }}>
              <span style={{ color: 'var(--text-3)' }}>HPP {activeHpp}% → Est. Profit</span>
              <span style={{ fontWeight: 700, color: profitPreview >= 0 ? '#00D68F' : '#FF6B6B' }}>Rp {profitPreview.toLocaleString('id-ID')}</span>
            </div>
          </div>
          <div>
            {lbl('Catatan')}
            <input value={form.catatan} onChange={e => set('catatan', e.target.value)} style={inputStyle} placeholder="opsional" />
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13 }}>Batal</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13 }}>
            {saving ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BrandSettingsModal({ brands, onSave, onClose }) {
  const { showToast } = useToast();
  const [selId, setSelId] = useState(brands[0]?.id ?? '');
  const [kurs, setKurs] = useState('');
  const [hpp, setHpp] = useState('');
  const [saving, setSaving] = useState(false);

  const activeBrand = brands.find(b => String(b.id) === String(selId));

  useEffect(() => {
    if (activeBrand) {
      setKurs(activeBrand.kurs_usd || 16000);
      setHpp(activeBrand.hpp_default || 0);
    }
  }, [selId, activeBrand]);

  const handleSave = async () => {
    if (!selId) return;
    setSaving(true);
    try {
      await api.updateMetaBrandSettings(selId, { kurs_usd: Number(kurs), hpp_default: Number(hpp) });
      onSave();
      showToast(`Setting ${activeBrand?.nama} berhasil disimpan`);
    } catch (e) { showToast('Gagal: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  const inputStyle = { width: '100%', padding: '8px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)', fontSize: 13, boxSizing: 'border-box' };
  const lbl = (txt) => <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{txt}</div>;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>⚙️ Setting Brand</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20 }}>Kurs USD dan HPP berlaku untuk semua data brand ini</div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            {lbl('Brand')}
            <select value={selId} onChange={e => setSelId(e.target.value)} style={inputStyle}>
              {brands.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
            </select>
          </div>
          <div>
            {lbl('Kurs USD → IDR (1 USD = Rp ?)')}
            <input type="number" min="1" value={kurs} onChange={e => setKurs(e.target.value)} style={inputStyle} placeholder="16000" />
          </div>
          <div>
            {lbl('HPP Default (%)')}
            <input type="number" min="0" max="100" step="0.1" value={hpp} onChange={e => setHpp(e.target.value)} style={inputStyle} placeholder="40" />
          </div>
          <div style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '10px 12px', fontSize: 12, color: 'var(--text-3)' }}>
            HPP ini akan otomatis dipakai untuk hitung profit di semua transaksi brand ini.
            Ubah kapan saja — data lama akan ikut terhitung ulang.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13 }}>Batal</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13 }}>
            {saving ? 'Menyimpan...' : 'Simpan Setting'}
          </button>
        </div>
      </div>
    </div>
  );
}

function AiInsightModal({ bulan, brandId, onClose }) {
  const [loading, setLoading] = useState(true);
  const [insight, setInsight] = useState('');
  const [error,   setError]   = useState('');

  useEffect(() => {
    api.getAiInsightAds(bulan, brandId || null)
      .then(r => setInsight(r.insight))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [bulan, brandId]);

  const formatInsight = (text) => text.split('\n').map((line, i) => {
    if (line.startsWith('## ') || line.startsWith('# ')) return <div key={i} style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-1)', marginTop: 16, marginBottom: 4 }}>{line.replace(/^#+\s*/, '')}</div>;
    if (line.startsWith('**') && line.endsWith('**')) return <div key={i} style={{ fontWeight: 700, color: 'var(--text-1)', marginTop: 10, marginBottom: 2 }}>{line.replace(/\*\*/g, '')}</div>;
    if (line.startsWith('- ') || line.startsWith('* ')) return <div key={i} style={{ paddingLeft: 16, color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 2 }}>• {line.slice(2).replace(/\*\*/g, '')}</div>;
    if (line.trim() === '') return <div key={i} style={{ height: 6 }} />;
    return <div key={i} style={{ color: 'var(--text-2)', lineHeight: 1.6, marginBottom: 2 }}>{line.replace(/\*\*/g, '')}</div>;
  });

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 600, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 8px 40px rgba(0,0,0,0.5)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div style={{ fontWeight: 800, fontSize: 16 }}>✨ AI Insight — {bulan}</div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text-3)', cursor: 'pointer', fontSize: 20, lineHeight: 1 }}>×</button>
        </div>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-3)' }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>🤖</div>
            <div style={{ fontSize: 13 }}>AI sedang menganalisis data...</div>
          </div>
        ) : error ? (
          <div style={{ color: '#FF6B6B', fontSize: 13 }}>Gagal: {error}</div>
        ) : (
          <div style={{ fontSize: 13 }}>{formatInsight(insight)}</div>
        )}
        <div style={{ marginTop: 20, textAlign: 'right' }}>
          <button onClick={onClose} style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13 }}>Tutup</button>
        </div>
      </div>
    </div>
  );
}

function SyncRangeModal({ brandId, brands, onDone, onClose }) {
  const { showToast } = useToast();
  const now = new Date();
  const firstOfMonth = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-01`;
  const today = now.toISOString().slice(0, 10);
  const [dari,    setDari]    = useState(firstOfMonth);
  const [sampai,  setSampai]  = useState(today);
  const [selBrand, setSelBrand] = useState(brandId || (brands[0]?.id ?? ''));
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState('');

  const inputStyle = { width: '100%', padding: '8px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)', fontSize: 13, boxSizing: 'border-box' };
  const label = (txt) => <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{txt}</div>;

  const handleSync = async () => {
    if (!selBrand) { showToast('Pilih brand dulu', 'warning'); return; }
    setLoading(true);
    setProgress('Menghitung hari...');
    try {
      const r = await api.syncMetaRange(selBrand, dari, sampai);
      setProgress(`Selesai: ${r.berhasil}/${r.total} hari berhasil`);
      setTimeout(() => { onDone(); onClose(); }, 1200);
    } catch (e) {
      setProgress('');
      showToast('Sync gagal: ' + e.message, 'error');
    } finally { setLoading(false); }
  };

  const dayCount = Math.max(0, Math.round((new Date(sampai) - new Date(dari)) / 86400000) + 1);

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Sync Range Tanggal</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 20 }}>Tarik data Meta Ads untuk rentang tanggal tertentu</div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>
            {label('Brand')}
            <select value={selBrand} onChange={e => setSelBrand(e.target.value)} style={inputStyle}>
              {brands.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
            </select>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>{label('Dari')}<input type="date" value={dari} onChange={e => setDari(e.target.value)} style={inputStyle} /></div>
            <div>{label('Sampai')}<input type="date" value={sampai} onChange={e => setSampai(e.target.value)} style={inputStyle} /></div>
          </div>
          {dayCount > 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px' }}>
              Akan sync <strong style={{ color: 'var(--text-1)' }}>{dayCount} hari</strong> data dari Meta API
            </div>
          )}
          {progress && <div style={{ fontSize: 12, color: 'var(--green)', fontWeight: 600 }}>{progress}</div>}
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} disabled={loading} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13 }}>Batal</button>
          <button onClick={handleSync} disabled={loading || dayCount === 0} style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, cursor: (loading || dayCount === 0) ? 'not-allowed' : 'pointer', fontSize: 13 }}>
            {loading ? `⏳ Sync...` : `🔄 Sync ${dayCount} Hari`}
          </button>
        </div>
      </div>
    </div>
  );
}

function BrandModal({ onSave, onClose }) {
  const { showToast } = useToast();
  const [form, setForm] = useState({ nama: '', ad_account_id: '', pixel_id: '' });
  const [saving, setSaving] = useState(false);
  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));
  const inputStyle = { width: '100%', padding: '8px 10px', background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)', fontSize: 13, boxSizing: 'border-box' };
  const label = (txt) => <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 4 }}>{txt}</div>;

  const handleSave = async () => {
    if (!form.nama || !form.ad_account_id) { showToast('Nama dan Ad Account ID wajib diisi', 'warning'); return; }
    setSaving(true);
    try {
      await api.createMetaBrand(form);
      onSave();
      showToast(`Brand ${form.nama} berhasil ditambahkan`);
    } catch (e) { showToast('Gagal: ' + e.message, 'error'); }
    finally { setSaving(false); }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', borderRadius: 16, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 8px 40px rgba(0,0,0,0.4)' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 20 }}>Tambah Brand</div>
        <div style={{ display: 'grid', gap: 12 }}>
          <div>{label('Nama Brand')}<input value={form.nama} onChange={e => set('nama', e.target.value)} style={inputStyle} placeholder="Jester" /></div>
          <div>{label('Ad Account ID')}<input value={form.ad_account_id} onChange={e => set('ad_account_id', e.target.value)} style={inputStyle} placeholder="act_xxxxxxxxxx" /></div>
          <div>{label('Pixel ID (opsional)')}<input value={form.pixel_id} onChange={e => set('pixel_id', e.target.value)} style={inputStyle} placeholder="1234567890" /></div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
          <button onClick={onClose} style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13 }}>Batal</button>
          <button onClick={handleSave} disabled={saving} style={{ flex: 2, padding: '9px 0', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, cursor: saving ? 'not-allowed' : 'pointer', fontSize: 13 }}>
            {saving ? 'Menyimpan...' : 'Tambah'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AdsPerformance() {
  const { showToast } = useToast();
  const bulanOpts = getBulanOptions();
  const [bulan,   setBulan]   = useState(bulanOpts[0].val);
  const [brands,  setBrands]  = useState([]);
  const [brandId, setBrandId] = useState('');
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [showBrandModal, setShowBrandModal] = useState(false);
  const [showSyncRange, setShowSyncRange] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [error,   setError]   = useState('');

  const loadBrands = useCallback(async () => {
    try {
      const r = await api.getMetaBrands();
      setBrands(r.data || []);
    } catch { /* skip */ }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.getMetaInsights(brandId || null, bulan);
      setRows(r.data || []);
    } catch (e) {
      setError('Gagal memuat data: ' + e.message);
    } finally { setLoading(false); }
  }, [bulan, brandId]);

  useEffect(() => { loadBrands(); }, [loadBrands]);
  useEffect(() => { loadData(); }, [loadData]);

  const handleSync = async () => {
    if (!brandId) { showToast('Pilih brand dulu sebelum sync', 'warning'); return; }
    setSyncing(true);
    try {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
      await api.syncMetaBrand(brandId, yesterday);
      await loadData();
      showToast('Sync berhasil');
    } catch (e) { showToast('Sync gagal: ' + e.message, 'error'); }
    finally { setSyncing(false); }
  };

  const handleSyncAll = async () => {
    setSyncing(true);
    try {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0,10);
      await api.syncAllMetaBrands(yesterday);
      await loadData();
      showToast('Sync semua brand berhasil');
    } catch (e) { showToast('Sync gagal: ' + e.message, 'error'); }
    finally { setSyncing(false); }
  };

  // Agregasi kartu metrik
  const totalSpend   = rows.reduce((s, r) => s + Number(r.spend  || 0), 0);
  const totalKlik    = rows.reduce((s, r) => s + Number(r.klik   || 0), 0);
  const totalOrder   = rows.reduce((s, r) => s + Number(r.jumlah_order || 0), 0);
  const totalOmzet   = rows.reduce((s, r) => s + Number(r.omzet  || 0), 0);
  const totalProfit  = rows.reduce((s, r) => s + Number(r.profit_bersih || 0), 0);
  const avgRoas      = totalSpend > 0 ? (totalOmzet / totalSpend) : null;

  const thStyle = { padding: '8px 10px', fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' };
  const tdStyle = { padding: '9px 10px', fontSize: 12, color: 'var(--text-1)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };

  return (
    <div style={{ padding: '24px 20px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 800 }}>📊 Ads Performance</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Meta Ads — data spend, klik, dan profit per brand</div>
        </div>
      </div>

      {/* Filter bar */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 20, alignItems: 'center' }}>
        <select value={bulan} onChange={e => setBulan(e.target.value)} style={{ padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)', fontSize: 13 }}>
          {bulanOpts.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
        <select value={brandId} onChange={e => setBrandId(e.target.value)} style={{ padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)', fontSize: 13, minWidth: 130 }}>
          <option value=''>Semua Brand</option>
          {brands.map(b => <option key={b.id} value={b.id}>{b.nama}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowBrandModal(true)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12 }}>+ Brand</button>
        <button onClick={() => setEditRow({})} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12 }}>+ Input Harian</button>
        <button onClick={() => setShowSyncRange(true)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12 }}>📅 Sync Range</button>
        <button onClick={() => setShowSettings(true)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer', fontSize: 12 }}>⚙️ Setting</button>
        <button onClick={brandId ? handleSync : handleSyncAll} disabled={syncing} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', background: 'var(--green)', color: '#fff', fontWeight: 700, cursor: syncing ? 'not-allowed' : 'pointer', fontSize: 12 }}>
          {syncing ? '⏳ Sync...' : '🔄 Sync Meta'}
        </button>
      </div>

      {/* Metrik cards */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        <MetricCard label="Total Spend"  value={fmtRp(totalSpend)}  color="#FF6B6B" />
        <MetricCard label="Total Klik"   value={fmt(totalKlik)}     color="var(--green)" />
        <MetricCard label="Total Order"  value={fmt(totalOrder)}    color="#FFB84B" />
        <MetricCard label="Total Omzet"  value={fmtRp(totalOmzet)} color="var(--text-1)" />
        <MetricCard label="Profit Bersih" value={fmtRp(totalProfit)} color={totalProfit >= 0 ? '#00D68F' : '#FF6B6B'} />
        <MetricCard label="ROAS"         value={avgRoas !== null ? avgRoas.toFixed(2) + 'x' : '—'} color={avgRoas >= 2 ? '#00D68F' : avgRoas >= 1 ? '#FFB84B' : '#FF6B6B'} sub="Omzet / Spend" />
      </div>

      {/* Tabel harian */}
      {error && <div style={{ color: '#FF6B6B', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {loading ? (
        <SkeletonTable rows={5} cols={4} />
      ) : rows.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📭</div>
          <div className="empty-title">Belum ada data untuk periode ini</div>
          <div className="empty-sub">Klik "Sync Meta" untuk tarik data dari API, atau "+ Input Harian" untuk input manual.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--surface-2)' }}>
                <th style={thStyle}>Tanggal</th>
                <th style={thStyle}>Brand</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Spend</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Klik</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>CTR</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>CPM</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Order</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Omzet (USD)</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Omzet (IDR)</th>
                <th style={{ ...thStyle, textAlign: 'right', color: '#A78BFA' }}>HPP%</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>Profit</th>
                <th style={{ ...thStyle, textAlign: 'right' }}>ROAS</th>
                <th style={thStyle}></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                  <td style={tdStyle}>{r.tanggal?.slice(0,10)}</td>
                  <td style={tdStyle}><span style={{ fontWeight: 600 }}>{r.brand_nama}</span></td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#FF6B6B', fontWeight: 700 }}>{fmtRp(r.spend)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(r.klik)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{r.ctr ? Number(r.ctr).toFixed(2) + '%' : '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtRp(r.cpm)}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{r.jumlah_order ?? '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: '#60A5FA' }}>
                    {r.omzet_usd ? '$' + Number(r.omzet_usd).toFixed(2) : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>{r.omzet && Number(r.omzet) > 0 ? fmtRp(r.omzet) : '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right', color: 'var(--text-3)', fontSize: 11 }}>
                    {r.hpp_persen != null && Number(r.hpp_persen) > 0 ? Number(r.hpp_persen).toFixed(0) + '%' : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}><ProfitBadge val={r.profit_bersih} /></td>
                  <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: Number(r.roas_aktual) >= 2 ? '#00D68F' : Number(r.roas_aktual) >= 1 ? '#FFB84B' : 'var(--text-1)' }}>
                    {r.roas_aktual ? Number(r.roas_aktual).toFixed(2) + 'x' : '—'}
                  </td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    <button onClick={() => setEditRow(r)} style={{ fontSize: 11, padding: '3px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer' }}>Edit</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editRow !== null && (
        <EditReportModal row={editRow} brands={brands} onClose={() => setEditRow(null)} onSave={() => { setEditRow(null); loadData(); }} />
      )}
      {showBrandModal && (
        <BrandModal onClose={() => setShowBrandModal(false)} onSave={() => { setShowBrandModal(false); loadBrands(); }} />
      )}
      {showSyncRange && (
        <SyncRangeModal brandId={brandId} brands={brands} onClose={() => setShowSyncRange(false)} onDone={loadData} />
      )}
      {showSettings && brands.length > 0 && (
        <BrandSettingsModal brands={brands} onClose={() => setShowSettings(false)} onSave={() => { setShowSettings(false); loadBrands(); loadData(); }} />
      )}
    </div>
  );
}
