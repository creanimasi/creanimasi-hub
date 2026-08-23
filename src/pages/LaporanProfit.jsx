import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { downloadCsv } from '../utils/exportCsv';

const BULAN_LABEL = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];

function getBulanOptions() {
  const now = new Date();
  const opts = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    opts.push({ val, label: `${BULAN_LABEL[d.getMonth()]} ${d.getFullYear()}` });
  }
  return opts;
}

function fmtRp(n, full = false) {
  if (n === null || n === undefined) return '—';
  const num = Number(n);
  if (!full) {
    if (num >= 1_000_000) return 'Rp ' + (num / 1_000_000).toFixed(1) + 'jt';
    if (num >= 1_000)     return 'Rp ' + (num / 1_000).toFixed(0) + 'rb';
  }
  return 'Rp ' + num.toLocaleString('id-ID');
}

function RoasBadge({ roas }) {
  if (!roas) return <span style={{ color: 'var(--text-3)' }}>—</span>;
  const n = Number(roas);
  const color = n >= 3 ? '#00D68F' : n >= 2 ? '#FFB84B' : '#FF6B6B';
  return <span style={{ fontWeight: 800, color }}>{n.toFixed(2)}x</span>;
}

function ProfitBadge({ val }) {
  if (val === null || val === undefined) return <span style={{ color: 'var(--text-3)' }}>—</span>;
  const n = Number(val);
  const color = n > 0 ? '#00D68F' : n === 0 ? 'var(--text-3)' : '#FF6B6B';
  return <span style={{ fontWeight: 700, color }}>{fmtRp(n)}</span>;
}

function SummaryCard({ label, value, color, sub }) {
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '16px 20px', flex: 1, minWidth: 140 }}>
      <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 800, color: color || 'var(--text-1)', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

export default function LaporanProfit() {
  const bulanOpts = getBulanOptions();
  const [bulan,  setBulan]  = useState(bulanOpts[0].val);
  const [rows,   setRows]   = useState([]);
  const [loading,setLoading]= useState(false);
  const [error,  setError]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const r = await api.getMetaLaporan(bulan);
      setRows(r.data || []);
    } catch (e) {
      setError('Gagal memuat laporan: ' + e.message);
    } finally { setLoading(false); }
  }, [bulan]);

  useEffect(() => { load(); }, [load]);

  const totalSpend  = rows.reduce((s,r) => s + Number(r.total_spend  || 0), 0);
  const totalOmzet  = rows.reduce((s,r) => s + Number(r.total_omzet  || 0), 0);
  const totalOrder  = rows.reduce((s,r) => s + Number(r.total_order  || 0), 0);
  const totalProfit = rows.reduce((s,r) => s + Number(r.total_profit_bersih || 0), 0);
  const overallRoas = totalSpend > 0 ? totalOmzet / totalSpend : null;
  const bulanLabel  = bulanOpts.find(o => o.val === bulan)?.label || bulan;

  const handleExport = () => {
    const data = rows.map(r => ({
      Brand: r.brand_nama,
      'Total Spend (Rp)': r.total_spend,
      'Total Klik': r.total_klik,
      'Total Impresi': r.total_impresi,
      'Avg CPM': r.avg_cpm,
      'Avg CTR (%)': r.avg_ctr,
      'Total Order': r.total_order,
      'Total Omzet (Rp)': r.total_omzet,
      'Avg HPP (%)': r.avg_hpp_persen,
      'Profit Bersih (Rp)': r.total_profit_bersih,
      ROAS: r.roas,
    }));
    downloadCsv(data, `laporan-profit-${bulan}.csv`);
  };

  const thStyle = { padding: '10px 14px', fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', textAlign: 'left', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };
  const tdStyle = { padding: '12px 14px', fontSize: 13, color: 'var(--text-1)', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' };

  return (
    <div style={{ padding: '24px 20px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 20, fontWeight: 800 }}>💰 Laporan Profit</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Ringkasan bulanan per brand — spend, omzet, dan profit bersih</div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select value={bulan} onChange={e => setBulan(e.target.value)} style={{ padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)', fontSize: 13 }}>
            {bulanOpts.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
          </select>
          <button onClick={handleExport} disabled={rows.length === 0} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: rows.length === 0 ? 'not-allowed' : 'pointer', fontSize: 12 }}>
            ⬇ CSV
          </button>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
        <SummaryCard label="Total Spend"    value={fmtRp(totalSpend)}  color="#FF6B6B" />
        <SummaryCard label="Total Omzet"   value={fmtRp(totalOmzet)}  color="var(--text-1)" />
        <SummaryCard label="Total Order"   value={totalOrder.toLocaleString('id-ID')} color="#FFB84B" />
        <SummaryCard label="Profit Bersih" value={fmtRp(totalProfit)} color={totalProfit >= 0 ? '#00D68F' : '#FF6B6B'} />
        <SummaryCard label="ROAS Total"    value={overallRoas ? overallRoas.toFixed(2) + 'x' : '—'} color={overallRoas >= 3 ? '#00D68F' : overallRoas >= 2 ? '#FFB84B' : '#FF6B6B'} sub="Omzet / Spend" />
      </div>

      {/* Tabel per brand */}
      {error && <div style={{ color: '#FF6B6B', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Memuat laporan...</div>
      ) : rows.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📭</div>
          <div className="empty-title">Belum ada data untuk {bulanLabel}</div>
          <div className="empty-sub">Tambah brand dan input data harian di halaman <strong>Ads Performance</strong>.</div>
        </div>
      ) : (
        <>
          <div style={{ overflowX: 'auto', borderRadius: 12, border: '1px solid var(--border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--surface-2)' }}>
                  <th style={thStyle}>Brand</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Spend</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Klik</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Order</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Omzet</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>HPP%</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Profit Bersih</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>ROAS</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.01)' }}>
                    <td style={{ ...tdStyle, fontWeight: 700 }}>{r.brand_nama}</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#FF6B6B', fontWeight: 600 }}>{fmtRp(r.total_spend)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{Number(r.total_klik || 0).toLocaleString('id-ID')}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{Number(r.total_order || 0).toLocaleString('id-ID')}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtRp(r.total_omzet)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{r.avg_hpp_persen ? Number(r.avg_hpp_persen).toFixed(1) + '%' : '—'}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}><ProfitBadge val={r.total_profit_bersih} /></td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}><RoasBadge roas={r.roas} /></td>
                  </tr>
                ))}
              </tbody>
              {rows.length > 1 && (
                <tfoot>
                  <tr style={{ background: 'var(--surface-2)', fontWeight: 700 }}>
                    <td style={{ ...tdStyle, fontWeight: 800 }}>TOTAL</td>
                    <td style={{ ...tdStyle, textAlign: 'right', color: '#FF6B6B', fontWeight: 800 }}>{fmtRp(totalSpend)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>—</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{totalOrder.toLocaleString('id-ID')}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtRp(totalOmzet)}</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}>—</td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}><ProfitBadge val={totalProfit} /></td>
                    <td style={{ ...tdStyle, textAlign: 'right' }}><RoasBadge roas={overallRoas} /></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Formula info */}
          <div style={{ marginTop: 16, padding: '12px 16px', background: 'var(--surface-2)', borderRadius: 10, fontSize: 11, color: 'var(--text-3)' }}>
            <strong style={{ color: 'var(--text-2)' }}>Formula:</strong>{' '}
            Profit Bersih = Omzet − (Omzet × HPP%) − Spend Iklan &nbsp;·&nbsp; ROAS = Omzet ÷ Spend
          </div>
        </>
      )}
    </div>
  );
}
