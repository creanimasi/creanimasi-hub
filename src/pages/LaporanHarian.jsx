import { useState, useEffect, useCallback } from 'react';
import {
  LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { TIM, TIPE_COLOR, DIVISI_COLOR } from '../data/tim';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';
import { BOT_USERNAME } from '../data/constants';

// ── HELPERS ────────────────────────────────────────────────────────────────────
function parseNum(str) {
  if (!str) return 0;
  const clean = String(str).replace(/[^0-9a-zA-Z.,+-]/g, '').toLowerCase();
  if (clean.endsWith('k')) return Math.round(parseFloat(clean) * 1000);
  if (clean.endsWith('m')) return Math.round(parseFloat(clean) * 1000000);
  return parseFloat(clean.replace(',', '.')) || 0;
}
function parseCR(str) {
  if (!str) return 0;
  return parseFloat(String(str).replace(',', '.').replace('%', '')) || 0;
}
function fmtNum(n) {
  if (n >= 1000) return (n / 1000).toFixed(1) + 'k';
  return String(n);
}
function fmtDate(tgl) {
  return new Date(tgl).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' });
}

// ── INSIGHT ENGINE ─────────────────────────────────────────────────────────────
function generateInsights(chartData) {
  const insights = [];
  if (chartData.length < 2) return insights;

  const avg = (arr) => arr.length ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const recent = chartData.slice(-3);
  const older  = chartData.slice(-6, -3);

  // Active order trend
  const recentAO = avg(recent.map(r => r.active_order));
  const olderAO  = older.length ? avg(older.map(r => r.active_order)) : recentAO;
  if (olderAO > 0) {
    const pct = ((recentAO - olderAO) / olderAO) * 100;
    if (pct >= 15)       insights.push({ type: 'good', icon: '📈', text: `Active order naik ${pct.toFixed(0)}% dibanding sebelumnya` });
    else if (pct <= -15) insights.push({ type: 'warn', icon: '📉', text: `Active order turun ${Math.abs(pct).toFixed(0)}% — perhatikan respons chat & kualitas gig` });
  }

  // Consecutive decline check
  const last3AO = chartData.slice(-3).map(r => r.active_order);
  if (last3AO.length === 3 && last3AO[0] > last3AO[1] && last3AO[1] > last3AO[2] && last3AO[2] > 0) {
    insights.push({ type: 'warn', icon: '⚠️', text: 'Active order turun 3 hari berturut-turut — evaluasi strategi' });
  }

  // CR analysis
  const crVals = chartData.filter(r => r.cr > 0).map(r => r.cr);
  if (crVals.length > 0) {
    const avgCR = avg(crVals);
    const lastCR = crVals[crVals.length - 1];
    if (lastCR < 0.5)  insights.push({ type: 'bad',  icon: '🔴', text: `CR ${lastCR.toFixed(2)}% sangat rendah — optimalkan foto thumbnail & deskripsi gig` });
    else if (lastCR < 1) insights.push({ type: 'warn', icon: '🟡', text: `CR ${lastCR.toFixed(2)}% di bawah rata-rata — pertimbangkan A/B test thumbnail` });
    if (crVals.length >= 2) {
      const recentCR = avg(crVals.slice(-3));
      const olderCR  = avg(crVals.slice(-6, -3));
      if (olderCR > 0) {
        const pctCR = ((recentCR - olderCR) / olderCR) * 100;
        if (pctCR >= 20)       insights.push({ type: 'good', icon: '✅', text: `CR meningkat ${pctCR.toFixed(0)}% — strategi listing berjalan baik` });
        else if (pctCR <= -20) insights.push({ type: 'bad',  icon: '📉', text: `CR turun ${Math.abs(pctCR).toFixed(0)}% — cek perubahan algoritma platform` });
      }
    }
    if (avgCR >= 3) insights.push({ type: 'good', icon: '🌟', text: `CR rata-rata ${avgCR.toFixed(2)}% — sangat baik, pertahankan` });
  }

  // Impresi trend
  const impresiVals = chartData.filter(r => r.impresi > 0).map(r => r.impresi);
  if (impresiVals.length >= 4) {
    const recentImp = avg(impresiVals.slice(-3));
    const olderImp  = avg(impresiVals.slice(-6, -3));
    if (olderImp > 0) {
      const pctImp = ((recentImp - olderImp) / olderImp) * 100;
      if (pctImp <= -20) insights.push({ type: 'warn', icon: '👁', text: `Impresi turun ${Math.abs(pctImp).toFixed(0)}% — periksa posisi ranking gig` });
    }
  }

  if (insights.length === 0 && chartData.length >= 3) {
    insights.push({ type: 'good', icon: '👍', text: 'Performa stabil — tidak ada masalah signifikan terdeteksi' });
  }

  return insights;
}

// ── CHART TOOLTIP ──────────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '10px 14px', fontSize: 12,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-2)' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  );
}

// ── GRAFIK PER AKUN ────────────────────────────────────────────────────────────
function GrafikAkun({ akun, rows }) {
  const [metrik, setMetrik] = useState('active_order');

  const chartData = rows.map(r => ({
    tgl:          fmtDate(r.tanggal),
    active_order: r.active_order || 0,
    impresi:      parseNum(r.impresi),
    click:        parseNum(r.click),
    cr:           parseCR(r.cr),
    nama:         r.nama,
  }));

  const insights = generateInsights(chartData);

  const METRIK_CFG = {
    active_order: { label: 'Active Order', color: '#00D68F', fmt: v => v },
    impresi:      { label: 'Impresi',      color: '#4BC8FF', fmt: fmtNum },
    click:        { label: 'Click',        color: '#FFB84B', fmt: v => v },
    cr:           { label: 'CR (%)',       color: '#FF6B9D', fmt: v => v + '%' },
  };
  const cfg = METRIK_CFG[metrik];

  // Summary stats (latest vs avg)
  const latest = chartData[chartData.length - 1] || {};
  const allAO  = chartData.map(r => r.active_order).filter(Boolean);
  const allImp = chartData.map(r => r.impresi).filter(Boolean);
  const allClk = chartData.map(r => r.click).filter(Boolean);
  const allCR  = chartData.map(r => r.cr).filter(Boolean);
  const avgOf  = arr => arr.length ? Math.round(arr.reduce((s,v) => s+v, 0) / arr.length * 10) / 10 : 0;
  const trend  = (arr) => {
    if (arr.length < 2) return 0;
    const last = arr[arr.length-1], prev = arr[arr.length-2];
    return prev > 0 ? ((last - prev) / prev * 100) : 0;
  };

  const stats = [
    { label: 'Active Order', val: latest.active_order ?? '-', avg: avgOf(allAO), tr: trend(chartData.map(r=>r.active_order)), color: '#00D68F' },
    { label: 'Impresi',      val: fmtNum(latest.impresi ?? 0), avg: fmtNum(avgOf(allImp)), tr: trend(chartData.map(r=>r.impresi)), color: '#4BC8FF' },
    { label: 'Click',        val: latest.click ?? 0,   avg: avgOf(allClk), tr: trend(chartData.map(r=>r.click)), color: '#FFB84B' },
    { label: 'CR',           val: (latest.cr ?? 0) + '%', avg: avgOf(allCR) + '%', tr: trend(chartData.map(r=>r.cr)), color: '#FF6B9D' },
  ];

  // Pengelola akun
  const pengelola = [...new Set(rows.map(r => r.nama))].join(', ');

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      {/* Header akun */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:14, flexWrap:'wrap', gap:8 }}>
        <div>
          <div style={{ fontWeight:800, fontSize:14 }}>{akun}</div>
          <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
            Dikelola: {pengelola} · {rows.length} hari laporan
          </div>
        </div>
        {/* Metrik tabs */}
        <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
          {Object.entries(METRIK_CFG).map(([k, c]) => (
            <button key={k} onClick={() => setMetrik(k)}
              style={{
                padding:'4px 10px', borderRadius:8, fontSize:11, cursor:'pointer',
                border:`1px solid ${metrik===k ? c.color : 'var(--border-2)'}`,
                background: metrik===k ? `${c.color}18` : 'var(--surface)',
                color: metrik===k ? c.color : 'var(--text-3)',
                fontWeight: metrik===k ? 700 : 400,
              }}>
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:8, marginBottom:14 }}>
        {stats.map(s => (
          <div key={s.label} style={{
            padding:'8px 10px', borderRadius:8, textAlign:'center',
            background:`${s.color}10`, border:`1px solid ${s.color}25`,
          }}>
            <div style={{ fontSize:9, color:'var(--text-3)', textTransform:'uppercase', marginBottom:2 }}>{s.label}</div>
            <div style={{ fontSize:16, fontWeight:800, color:s.color, lineHeight:1 }}>{s.val}</div>
            <div style={{ fontSize:9, color:'var(--text-3)', marginTop:2 }}>
              {s.tr !== 0 && (
                <span style={{ color: s.tr > 0 ? 'var(--green)' : 'var(--red)', fontWeight:600 }}>
                  {s.tr > 0 ? '▲' : '▼'} {Math.abs(s.tr).toFixed(0)}%
                </span>
              )} rata {s.avg}
            </div>
          </div>
        ))}
      </div>

      {/* Line chart */}
      {chartData.length > 0 ? (
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={chartData} margin={{ top:5, right:5, left:-25, bottom:0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="tgl" tick={{ fontSize:9, fill:'var(--text-3)' }} tickLine={false} />
            <YAxis tick={{ fontSize:9, fill:'var(--text-3)' }} tickLine={false} />
            <Tooltip content={<ChartTooltip />} />
            <ReferenceLine
              y={avgOf(chartData.map(r => r[metrik]))}
              stroke={cfg.color} strokeDasharray="4 4" strokeOpacity={0.4}
            />
            <Line
              type="monotone" dataKey={metrik} name={cfg.label}
              stroke={cfg.color} strokeWidth={2.5}
              dot={{ r:3, fill:cfg.color }} activeDot={{ r:5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div style={{ textAlign:'center', padding:20, color:'var(--text-3)', fontSize:12 }}>
          Belum ada data grafik
        </div>
      )}

      {/* Insights / catatan */}
      {insights.length > 0 && (
        <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)',
            textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
            Catatan & Analisa
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            {insights.map((ins, i) => (
              <div key={i} style={{
                display:'flex', alignItems:'flex-start', gap:8,
                padding:'7px 10px', borderRadius:8, fontSize:12,
                background: ins.type==='good' ? 'var(--green-light)'
                          : ins.type==='bad'  ? 'rgba(255,59,59,0.1)'
                          : 'rgba(255,180,50,0.1)',
                border: `1px solid ${ins.type==='good' ? 'rgba(0,214,143,0.2)'
                                    : ins.type==='bad'  ? 'rgba(255,59,59,0.2)'
                                    : 'rgba(255,180,50,0.2)'}`,
                color: ins.type==='good' ? 'var(--green)'
                      : ins.type==='bad'  ? 'var(--red)'
                      : 'var(--amber)',
              }}>
                <span style={{ flexShrink:0 }}>{ins.icon}</span>
                <span>{ins.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── GRAFIK PANEL (admin view) ──────────────────────────────────────────────────
function GrafikPanel() {
  const [data,    setData]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState('');
  const [periode, setPeriode] = useState('30');

  useEffect(() => {
    setLoading(true);
    setError('');
    // sampai = tomorrow UTC so we include records saved as midnight WIB today
    const sampaiDate = new Date();
    sampaiDate.setDate(sampaiDate.getDate() + 1);
    const sampai = sampaiDate.toISOString().slice(0,10);
    const dari   = new Date(Date.now() - parseInt(periode) * 24*60*60*1000).toISOString().slice(0,10);
    api.getLaporanHarianGrafik(`?dari=${dari}&sampai=${sampai}`)
      .then(res => setData(res.data || []))
      .catch(err => setError(err.message || 'Gagal memuat grafik'))
      .finally(() => setLoading(false));
  }, [periode]);

  // Group by akun
  const byAkun = {};
  for (const row of data) {
    const key = row.akun || 'Tanpa Akun';
    if (!byAkun[key]) byAkun[key] = [];
    byAkun[key].push(row);
  }

  const akunList = Object.entries(byAkun).sort((a,b) => b[1].length - a[1].length);

  return (
    <div>
      {/* Period filter */}
      <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
        <span style={{ fontSize:11, color:'var(--text-3)', fontWeight:600 }}>Periode:</span>
        {[['7','7 hari'],['30','30 hari'],['90','90 hari']].map(([v, label]) => (
          <button key={v} onClick={() => setPeriode(v)}
            style={{
              padding:'5px 14px', borderRadius:8, fontSize:12, cursor:'pointer',
              border:`1px solid ${periode===v ? 'var(--green)' : 'var(--border-2)'}`,
              background: periode===v ? 'var(--green-light)' : 'var(--surface)',
              color: periode===v ? 'var(--green)' : 'var(--text-2)',
              fontWeight: periode===v ? 700 : 400,
            }}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--text-2)' }}>Memuat grafik...</div>
      ) : error ? (
        <div className="alert alert-red" style={{ marginTop:8 }}>
          <span>⚠️</span><div>Gagal memuat grafik: {error}</div>
        </div>
      ) : akunList.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📊</div>
          <div className="empty-title">Belum ada data grafik</div>
          <div className="empty-sub">Data grafik muncul setelah tim mengirim laporan dengan field akun terisi</div>
        </div>
      ) : (
        akunList.map(([akun, rows]) => (
          <GrafikAkun key={akun} akun={akun} rows={rows} />
        ))
      )}
    </div>
  );
}

// ── STAT CARD ─────────────────────────────────────────────────────────────────
function StatCard({ stat }) {
  const member = TIM.find(t => t.nama === stat.nama);
  const tc     = member ? (TIPE_COLOR[member.tipe] || {}) : {};
  const dc     = member ? (DIVISI_COLOR[member.divisi] || {}) : {};
  const inits  = stat.nama.split(' ').slice(0,2).map(w=>w[0]).join('');
  const lastDate = stat.terakhir_lapor
    ? new Date(stat.terakhir_lapor).toLocaleDateString('id-ID',{day:'numeric',month:'short'})
    : '—';

  return (
    <div className="card" style={{ display:'flex', alignItems:'center', gap:12 }}>
      <div style={{
        width:40, height:40, borderRadius:10, flexShrink:0,
        background: tc.bg||'var(--surface-2)', color: tc.text||'var(--text-2)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:13, fontWeight:700,
      }}>{inits}</div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:700, fontSize:13 }}>{stat.nama}</div>
        <div style={{ fontSize:10, color: dc.text||'var(--text-3)' }}>{dc.icon} {member?.divisi}</div>
      </div>
      <div style={{ textAlign:'right' }}>
        <div style={{ fontSize:18, fontWeight:800, color:'var(--green)', lineHeight:1 }}>
          {stat.total_order}
        </div>
        <div style={{ fontSize:9, color:'var(--text-3)' }}>total order</div>
      </div>
      <div style={{ textAlign:'right', minWidth:50 }}>
        <div style={{ fontSize:14, fontWeight:700 }}>{stat.total_hari}</div>
        <div style={{ fontSize:9, color:'var(--text-3)' }}>laporan</div>
      </div>
      <div style={{ textAlign:'right', minWidth:60 }}>
        <div style={{ fontSize:11, color:'var(--text-2)', fontWeight:600 }}>{lastDate}</div>
        <div style={{ fontSize:9, color:'var(--text-3)' }}>terakhir</div>
      </div>
    </div>
  );
}

// ── LAPORAN CARD ──────────────────────────────────────────────────────────────
function LaporanCard({ l, expanded, onToggle, onHapus }) {
  const { user }   = useAuth();
  const isAdmin    = user?.role === 'admin';
  const member = TIM.find(t => t.nama === l.nama);
  const tc     = member ? (TIPE_COLOR[member.tipe]||{}) : {};
  const tgl    = new Date(l.tanggal);
  const inits  = l.nama.split(' ').slice(0,2).map(w=>w[0]).join('');

  const detailOrder = (() => {
    if (typeof l.detail_order !== 'string') return l.detail_order || {};
    try { return JSON.parse(l.detail_order); } catch { return {}; }
  })();

  return (
    <div className="card" style={{ marginBottom:8 }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}
        onClick={onToggle}>
        <div style={{
          width:36, height:36, borderRadius:9, flexShrink:0,
          background: tc.bg||'var(--surface-2)', color: tc.text||'var(--text-2)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:12, fontWeight:700,
        }}>{inits}</div>

        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:13 }}>{l.nama}</div>
          <div style={{ fontSize:10, color:'var(--text-3)', marginTop:1 }}>
            {l.akun && <span style={{ marginRight:8 }}>🏢 {l.akun}</span>}
            {l.jam_mulai && <span>⏰ {l.jam_mulai}–{l.jam_selesai}</span>}
          </div>
        </div>

        <div style={{ textAlign:'center', flexShrink:0 }}>
          <div style={{ fontSize:18, fontWeight:800, lineHeight:1 }}>{tgl.getDate()}</div>
          <div style={{ fontSize:9, color:'var(--text-3)', textTransform:'uppercase' }}>
            {tgl.toLocaleDateString('id-ID',{month:'short'})}
          </div>
        </div>

        {l.active_order > 0 && (
          <div style={{
            background:'var(--green-light)', color:'var(--green)',
            padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700, flexShrink:0,
          }}>
            {l.active_order} order
          </div>
        )}
        {l.impresi && (
          <div style={{ fontSize:10, color:'var(--text-3)', flexShrink:0 }}>
            👁 {l.impresi}
          </div>
        )}

        <span style={{ fontSize:11, color:'var(--text-3)', flexShrink:0 }}>{expanded ? '▲' : '▼'}</span>
        {isAdmin && (
          <button onClick={e => { e.stopPropagation(); onHapus(l.id); }}
            title="Hapus laporan"
            style={{ background:'none', border:'none', cursor:'pointer', fontSize:14,
              color:'var(--text-3)', padding:4, flexShrink:0 }}
            onMouseEnter={e => e.currentTarget.style.color='var(--red)'}
            onMouseLeave={e => e.currentTarget.style.color='var(--text-3)'}>✕</button>
        )}
      </div>

      {expanded && (
        <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {l.aktivitas && (
              <div style={{ gridColumn:'1/-1' }}>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)',
                  textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>Aktivitas</div>
                <div style={{ fontSize:12, color:'var(--text)' }}>{l.aktivitas}</div>
              </div>
            )}
            {l.yang_didapat && (
              <div>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--green)',
                  textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>Yang Didapat</div>
                <div style={{ fontSize:12, whiteSpace:'pre-wrap' }}>{l.yang_didapat}</div>
              </div>
            )}
            {(l.impresi || l.click || l.cr) && (
              <div>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--blue)',
                  textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Capaian</div>
                {[
                  {label:'Impresi', val:l.impresi},
                  {label:'Click',   val:l.click},
                  {label:'CR',      val:l.cr},
                ].filter(x=>x.val).map(x=>(
                  <div key={x.label} style={{ display:'flex', justifyContent:'space-between',
                    fontSize:12, marginBottom:3 }}>
                    <span style={{ color:'var(--text-2)' }}>{x.label}</span>
                    <span style={{ fontWeight:700 }}>{x.val}</span>
                  </div>
                ))}
              </div>
            )}
            {l.chat_masuk && (
              <div>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--purple)',
                  textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>Chat Masuk</div>
                <div style={{ fontSize:12, whiteSpace:'pre-wrap', color:'var(--text-2)' }}>
                  {l.chat_masuk}
                </div>
              </div>
            )}
            {(l.order_masuk || l.complete_order || l.active_order > 0) && (
              <div>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--amber)',
                  textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Order</div>
                {l.active_order > 0 && (
                  <div style={{ fontSize:13, fontWeight:800, color:'var(--green)', marginBottom:4 }}>
                    Active: {l.active_order}
                  </div>
                )}
                {Object.entries(detailOrder).map(([k,v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between',
                    fontSize:11, marginBottom:2 }}>
                    <span style={{ textTransform:'capitalize', color:'var(--text-2)' }}>{k}</span>
                    <span style={{ fontWeight:700 }}>{v}</span>
                  </div>
                ))}
                {l.complete_order && (
                  <div style={{ marginTop:4, fontSize:11, color:'var(--text-3)' }}>
                    Complete: {l.complete_order}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────────
export default function LaporanHarian() {
  const { user }    = useAuth();
  const isAdmin     = user?.role === 'admin';
  const [laporan,   setLaporan]   = useState([]);
  const [stats,     setStats]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState(null);
  const [filterNama,setFilterNama]= useState('');
  const [view,      setView]      = useState('today'); // 'today' | 'week' | 'all' | 'grafik'
  const [hapusId,   setHapusId]   = useState(null);
  const [hapusErr,  setHapusErr]  = useState('');
  const [loadErr,   setLoadErr]   = useState('');

  const load = useCallback(async () => {
    if (view === 'grafik') return;
    setLoading(true);
    setLoadErr('');
    try {
      const now   = new Date();
      const today = now.toISOString().slice(0,10);
      const weekStart = new Date(now); weekStart.setDate(now.getDate()-6);
      const dari = view === 'today' ? today
                 : view === 'week'  ? weekStart.toISOString().slice(0,10)
                 : undefined;

      let q = dari ? `?dari=${dari}&sampai=${today}` : '';
      if (!isAdmin) q = dari ? `?dari=${dari}&sampai=${today}` : `?sampai=${today}`;

      const [lRes, sRes] = await Promise.all([
        api.getLaporanHarian(q),
        isAdmin ? api.getLaporanHarianStats(dari ? `?dari=${dari}&sampai=${today}` : '') : Promise.resolve({ data:[] }),
      ]);
      setLaporan(lRes.data || []);
      setStats(sRes.data || []);
    } catch (err) {
      setLoadErr(err.message || 'Gagal memuat laporan. Coba refresh.');
    } finally { setLoading(false); }
  }, [view, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const handleHapus = async (id) => {
    setHapusErr('');
    try {
      await api.hapusLaporanHarian(id);
      setHapusId(null);
      load();
    } catch (err) { setHapusErr(err.message || 'Gagal hapus. Coba lagi.'); }
  };

  const filtered = filterNama
    ? laporan.filter(l => l.nama.toLowerCase().includes(filterNama.toLowerCase()))
    : laporan;

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:800 }}>📋 Laporan Harian Tim</div>
          <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2 }}>
            Laporan harian dari Telegram Bot @{BOT_USERNAME}
          </div>
        </div>
        <div style={{
          padding:'8px 14px', borderRadius:10, fontSize:11,
          background:'var(--surface-2)', border:'1px solid var(--border)',
          display:'flex', alignItems:'center', gap:8,
        }}>
          <span style={{ fontSize:16 }}>🤖</span>
          <div>
            <div style={{ fontWeight:700 }}>@{BOT_USERNAME}</div>
            <div style={{ color:'var(--text-3)', fontSize:10 }}>Kirim laporan harian ke bot ini</div>
          </div>
          <a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noreferrer"
            className="btn btn-sm btn-primary" style={{ fontSize:10, padding:'4px 10px' }}>
            Buka ↗
          </a>
        </div>
      </div>

      {/* Stats anggota (admin, hanya di view non-grafik) */}
      {isAdmin && view !== 'grafik' && stats.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)',
            textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
            Ringkasan Performa
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:8 }}>
            {stats.map(s => <StatCard key={s.nama} stat={s} />)}
          </div>
        </div>
      )}

      {/* Filter + toggle view */}
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        {[
          ['today','Hari ini'],
          ['week','7 hari'],
          ['all','Semua'],
          ...(isAdmin ? [['grafik','📊 Grafik']] : []),
        ].map(([v, label]) => (
          <button key={v} onClick={() => setView(v)}
            style={{
              padding:'5px 14px', borderRadius:8, fontSize:12, cursor:'pointer',
              border:`1px solid ${view===v ? 'var(--green)' : 'var(--border-2)'}`,
              background: view===v ? 'var(--green-light)' : 'var(--surface)',
              color: view===v ? 'var(--green)' : 'var(--text-2)',
              fontWeight: view===v ? 700 : 400,
            }}>
            {label}
          </button>
        ))}
        {isAdmin && view !== 'grafik' && (
          <input value={filterNama} onChange={e=>setFilterNama(e.target.value)}
            placeholder="🔍 Cari nama..."
            style={{ fontSize:12, padding:'5px 10px', flex:1, maxWidth:200 }} />
        )}
        {view !== 'grafik' && (
          <button onClick={load} className="btn btn-sm" style={{ fontSize:11 }}>↻ Refresh</button>
        )}
      </div>

      {/* Grafik view */}
      {view === 'grafik' && isAdmin && <GrafikPanel />}

      {/* Laporan list */}
      {view !== 'grafik' && (
        loading ? (
          <div style={{ textAlign:'center', padding:40, color:'var(--text-2)' }}>Memuat...</div>
        ) : loadErr ? (
          <div className="alert alert-red" style={{ marginTop:8 }}>
            <span>⚠️</span><div>{loadErr}</div>
          </div>
        ) : filtered.length === 0 ? (
          <div className="empty">
            <div className="empty-icon">📋</div>
            <div className="empty-title">
              {view==='today' ? 'Belum ada laporan hari ini' : 'Belum ada laporan'}
            </div>
            <div className="empty-sub">
              Anggota tim kirim laporan harian ke <strong>@{BOT_USERNAME}</strong> di Telegram
            </div>
            <a href={`https://t.me/${BOT_USERNAME}`} target="_blank" rel="noreferrer"
              className="btn btn-primary" style={{ marginTop:12, display:'inline-block' }}>
              Buka @{BOT_USERNAME} ↗
            </a>
          </div>
        ) : (
          <>
            <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:8 }}>
              {filtered.length} laporan
            </div>
            {filtered.map(l => (
              <LaporanCard
                key={l.id}
                l={l}
                expanded={expanded === l.id}
                onToggle={() => setExpanded(expanded === l.id ? null : l.id)}
                onHapus={(id) => { setHapusId(id); setHapusErr(''); }}
              />
            ))}
          </>
        )
      )}

      {hapusId && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
          onClick={e => e.target===e.currentTarget && setHapusId(null)}>
          <div style={{ background:'var(--surface)', borderRadius:14, padding:24,
            width:'100%', maxWidth:340, boxShadow:'0 8px 32px rgba(0,0,0,.18)' }}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:8 }}>Hapus Laporan?</div>
            <div style={{ fontSize:13, color:'var(--text-2)', marginBottom: hapusErr ? 10 : 20 }}>
              Tindakan ini tidak bisa dibatalkan.
            </div>
            {hapusErr && <div style={{ fontSize:12, color:'var(--red)', marginBottom:12 }}>{hapusErr}</div>}
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setHapusId(null)}
                style={{ flex:1, padding:'9px', borderRadius:8, border:'1px solid var(--border-2)',
                  background:'var(--surface)', cursor:'pointer', fontSize:13 }}>Batal</button>
              <button onClick={() => handleHapus(hapusId)}
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
