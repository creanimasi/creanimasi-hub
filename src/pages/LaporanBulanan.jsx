import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useTim } from '../hooks/useTim';
import { downloadCsv } from '../utils/exportCsv';
import { SkeletonTable } from '../components/Skeleton';

const BULAN_LABEL = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Ags','Sep','Okt','Nov','Des'];

function getBulanOptions() {
  const now = new Date();
  const opts = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const val = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
    const label = `${BULAN_LABEL[d.getMonth()]} ${d.getFullYear()}`;
    opts.push({ val, label });
  }
  return opts;
}

function StatusBadge({ status }) {
  const cfg = {
    baik:      { color: '#00D68F', bg: 'rgba(0,214,143,0.12)', border: 'rgba(0,214,143,0.3)', label: 'Baik' },
    perhatian: { color: '#FFB84B', bg: 'rgba(255,184,75,0.12)', border: 'rgba(255,184,75,0.3)', label: 'Perlu Perhatian' },
    risiko:    { color: '#FF6B6B', bg: 'rgba(255,107,107,0.10)', border: 'rgba(255,107,107,0.3)', label: 'Risiko' },
  }[status] || { color: 'var(--text-3)', bg: 'var(--surface-2)', border: 'var(--border)', label: status };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`, whiteSpace: 'nowrap' }}>
      {cfg.label}
    </span>
  );
}

function ScoreBar({ val, max = 5, color = 'var(--green)' }) {
  if (val === null || val === undefined) return <span style={{ color: 'var(--text-3)', fontSize: 11 }}>—</span>;
  const pct = Math.round(val / max * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <div style={{ flex: 1, height: 5, borderRadius: 3, background: 'var(--surface-2)' }}>
        <div style={{ width: `${pct}%`, height: '100%', borderRadius: 3, background: color, transition: 'width .4s' }} />
      </div>
      <span style={{ fontSize: 11, fontWeight: 700, color, minWidth: 24, textAlign: 'right' }}>{val}</span>
    </div>
  );
}

function PctCell({ val, warn = 80, danger = 70 }) {
  if (val === null || val === undefined) return <span style={{ color: 'var(--text-3)' }}>—</span>;
  const color = val >= warn ? '#00D68F' : val >= danger ? '#FFB84B' : '#FF6B6B';
  return <span style={{ fontWeight: 700, color }}>{val}%</span>;
}

// ── DETAIL PANEL ──────────────────────────────────────────────────────────────
function DetailPanel({ row, onClose }) {
  if (!row) return null;
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end' }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        width: '100%', maxWidth: 420, height: '100vh', overflowY: 'auto',
        background: 'var(--surface)', padding: 24, boxShadow: '-4px 0 24px rgba(0,0,0,0.3)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>{row.nama}</div>
          </div>
          <StatusBadge status={row.status} />
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-3)' }}>✕</button>
        </div>

        {/* Kehadiran */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Kehadiran</div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Absensi Tim</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{row.hadirCount}/{row.totalSesiAbsensi} sesi</span>
            </div>
            <ScoreBar val={row.pctAbsensi} max={100} color={row.pctAbsensi >= 80 ? '#00D68F' : row.pctAbsensi >= 70 ? '#FFB84B' : '#FF6B6B'} />
            {row.terlambatCount > 0 && <div style={{ fontSize: 11, color: '#FFB84B', marginTop: 6 }}>⚠ {row.terlambatCount}× terlambat</div>}
            <div style={{ borderTop: '1px solid var(--border)', margin: '12px 0' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Workshop JRUHUB</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{row.wsHadir}/{row.totalSesiWorkshop} sesi</span>
            </div>
            <ScoreBar val={row.pctWorkshop} max={100} color={row.pctWorkshop >= 70 ? '#00D68F' : '#FFB84B'} />
          </div>
        </div>

        {/* Jurnal & Kinerja */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Jurnal & Kinerja</div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Konsistensi Jurnal</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{row.jmlJurnal} entri bulan ini</span>
            </div>
            {[
              { label: 'Mood rata-rata', val: row.avgMood, color: '#B07BFF' },
              { label: 'Skor Kinerja', val: row.avgKinerja, color: '#00D68F' },
              { label: 'Kualitas Karya', val: row.avgKarya, color: '#4BC8FF' },
              { label: 'Manajemen Waktu', val: row.avgWaktu, color: '#FFB84B' },
              { label: 'Komunikasi', val: row.avgKomunikasi, color: '#00D68F' },
              { label: 'Skill Teknis', val: row.avgSkill, color: '#4BC8FF' },
            ].map(item => (
              <div key={item.label} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{item.label}</span>
                </div>
                <ScoreBar val={item.val} max={5} color={item.color} />
              </div>
            ))}
            {row.catatanMentor && (
              <div style={{ marginTop: 12, padding: 10, borderRadius: 8, background: 'var(--surface-2)', fontSize: 11, color: 'var(--text-2)', fontStyle: 'italic', lineHeight: 1.5 }}>
                💬 "{row.catatanMentor}"
              </div>
            )}
          </div>
        </div>

        {/* Pengembangan */}
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Pengembangan</div>
          <div className="card" style={{ padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>SKB bulan ini</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{row.skbTotal} diajukan · {row.skbDisetujui} disetujui</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Sesi 1-on-1</span>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{row.sesi1on1Total} sesi{row.tgl1on1Terakhir ? ` · terakhir ${new Date(row.tgl1on1Terakhir).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}` : ''}</span>
            </div>
            {row.totalReward > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Reward diterima</span>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#FFB84B' }}>
                  Rp {row.totalReward.toLocaleString('id-ID')}
                </span>
              </div>
            )}
            {row.totalReward === 0 && <div style={{ fontSize: 11, color: 'var(--text-3)' }}>Belum ada reward bulan ini</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── KOMPONEN UTAMA ─────────────────────────────────────────────────────────────
export default function LaporanBulanan() {
  const tim = useTim();
  const bulanOptions = getBulanOptions();
  const [bulan,    setBulan]    = useState(bulanOptions[0].val);
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [selected, setSelected] = useState(null);
  const [filterDiv, setFilterDiv] = useState('Semua');
  const [filterStatus, setFilterStatus] = useState('Semua');

  const load = useCallback(async (b) => {
    setLoading(true); setError('');
    try {
      const res = await api.getLaporanBulanan(b);
      setData(res.data);
    } catch (err) {
      setError(err.message || 'Gagal memuat laporan');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(bulan); }, [bulan, load]);

  const laporan = data?.laporan || [];

  // Enrich dengan divisi dari tim.js
  const enriched = laporan.map(row => {
    const anggota = tim.find(t => t.nama === row.nama);
    return { ...row, divisi: anggota?.divisi || '—', level: anggota?.level || '—' };
  });

  const divisiList = ['Semua', ...new Set(tim.map(t => t.divisi))];
  const statusList = ['Semua', 'baik', 'perhatian', 'risiko'];

  const filtered = enriched
    .filter(r => filterDiv === 'Semua' || r.divisi === filterDiv)
    .filter(r => filterStatus === 'Semua' || r.status === filterStatus);

  // Ringkasan tim
  const total = filtered.length;
  const avgAbsensi = total ? Math.round(filtered.filter(r => r.pctAbsensi !== null).reduce((s,r) => s + r.pctAbsensi, 0) / filtered.filter(r => r.pctAbsensi !== null).length) : 0;
  const avgKinerja = filtered.filter(r => r.avgKinerja).length
    ? +(filtered.filter(r => r.avgKinerja).reduce((s,r) => s + r.avgKinerja, 0) / filtered.filter(r => r.avgKinerja).length).toFixed(1)
    : null;
  const risikoCount = filtered.filter(r => r.status === 'risiko').length;
  const perhatianCount = filtered.filter(r => r.status === 'perhatian').length;

  const handleExport = () => {
    const rows = filtered.map(r => ({
      nama: r.nama, divisi: r.divisi, level: r.level,
      status: r.status,
      absensi_pct: r.pctAbsensi ?? '—',
      hadir: r.hadirCount, total_sesi: r.totalSesiAbsensi,
      terlambat: r.terlambatCount,
      workshop_pct: r.pctWorkshop ?? '—',
      jurnal_count: r.jmlJurnal,
      avg_mood: r.avgMood ?? '—',
      avg_kinerja: r.avgKinerja ?? '—',
      avg_karya: r.avgKarya ?? '—',
      avg_waktu: r.avgWaktu ?? '—',
      avg_komunikasi: r.avgKomunikasi ?? '—',
      avg_skill: r.avgSkill ?? '—',
      skb_total: r.skbTotal, skb_disetujui: r.skbDisetujui,
      sesi_1on1: r.sesi1on1Total,
      reward: r.totalReward,
    }));
    downloadCsv(rows, `laporan_bulanan_${bulan}.csv`);
  };

  const selectedRow = selected ? enriched.find(r => r.nama === selected) : null;

  return (
    <div>
      {/* Header + kontrol */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 18, fontWeight: 800 }}>Laporan Bulanan</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Rekap kinerja, kehadiran & pengembangan per anggota</div>
        </div>
        <select value={bulan} onChange={e => setBulan(e.target.value)} style={{ fontSize: 13, padding: '6px 10px', borderRadius: 8 }}>
          {bulanOptions.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
        <button className="btn btn-sm" onClick={handleExport} disabled={!data}>⬇ Export CSV</button>
      </div>

      {/* Metrics ringkasan */}
      <div className="metrics-grid" style={{ marginBottom: 16 }}>
        <div className="metric">
          <div className="metric-val">{total}</div>
          <div className="metric-lbl">Anggota</div>
        </div>
        <div className="metric">
          <div className="metric-val text-green">{avgAbsensi || '—'}%</div>
          <div className="metric-lbl">Avg Kehadiran</div>
        </div>
        <div className="metric">
          <div className="metric-val text-green">{avgKinerja ?? '—'}</div>
          <div className="metric-lbl">Avg Kinerja (/5)</div>
        </div>
        <div className="metric">
          <div className="metric-val" style={{ color: risikoCount > 0 ? '#FF6B6B' : 'var(--text)' }}>
            {risikoCount > 0 ? `${risikoCount} ⚠` : '0'}
          </div>
          <div className="metric-lbl">Anggota Risiko</div>
        </div>
      </div>

      {/* Filter */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 14 }}>
        <div className="tabs" style={{ margin: 0 }}>
          {divisiList.map(d => (
            <div key={d} className={`tab ${filterDiv === d ? 'active' : ''}`} onClick={() => setFilterDiv(d)} style={{ fontSize: 11 }}>{d}</div>
          ))}
        </div>
        <div className="tabs" style={{ margin: 0 }}>
          {statusList.map(s => (
            <div key={s} className={`tab ${filterStatus === s ? 'active' : ''}`} onClick={() => setFilterStatus(s)} style={{ fontSize: 11, textTransform: 'capitalize' }}>
              {s === 'perhatian' ? 'Perlu Perhatian' : s.charAt(0).toUpperCase() + s.slice(1)}
            </div>
          ))}
        </div>
      </div>

      {/* Konten */}
      {error && <div style={{ color: 'var(--red)', fontSize: 13, padding: 16 }}>⚠ {error}</div>}

      {loading ? (
        <SkeletonTable rows={6} cols={5} />
      ) : !data ? null : filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📊</div>
          <div className="empty-title">Tidak ada data</div>
          <div className="empty-sub">Belum ada aktivitas di bulan ini untuk filter yang dipilih.</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'var(--surface-2)' }}>
                  {['Anggota', 'Status', 'Kehadiran', 'Workshop', 'Jurnal', 'Mood', 'Kinerja', 'SKB', '1-on-1', 'Reward'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((row, i) => (
                  <tr
                    key={row.nama}
                    onClick={() => setSelected(row.nama)}
                    style={{
                      borderBottom: '1px solid var(--border)',
                      cursor: 'pointer',
                      background: i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)',
                      transition: 'background .1s',
                    }}
                    onMouseEnter={e => e.currentTarget.style.background = 'var(--green-light)'}
                    onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)'}
                  >
                    <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 700 }}>{row.nama.split(' ')[0]}</div>
                      <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{row.divisi}</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}><StatusBadge status={row.status} /></td>
                    <td style={{ padding: '10px 12px', minWidth: 100 }}>
                      <PctCell val={row.pctAbsensi} />
                      <div style={{ fontSize: 10, color: 'var(--text-3)' }}>{row.hadirCount}/{row.totalSesiAbsensi} sesi</div>
                    </td>
                    <td style={{ padding: '10px 12px' }}><PctCell val={row.pctWorkshop} warn={70} danger={50} /></td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{ fontWeight: 600 }}>{row.jmlJurnal}</span>
                      <span style={{ color: 'var(--text-3)', marginLeft: 2 }}>entri</span>
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {row.avgMood !== null
                        ? <span style={{ fontWeight: 700, color: row.avgMood >= 4 ? '#00D68F' : row.avgMood >= 3 ? '#FFB84B' : '#FF6B6B' }}>{row.avgMood}/5</span>
                        : <span style={{ color: 'var(--text-3)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {row.avgKinerja !== null
                        ? <span style={{ fontWeight: 700, color: row.avgKinerja >= 4 ? '#00D68F' : row.avgKinerja >= 3 ? '#FFB84B' : '#FF6B6B' }}>{row.avgKinerja}/5</span>
                        : <span style={{ color: 'var(--text-3)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {row.skbTotal > 0
                        ? <span>{row.skbDisetujui}/{row.skbTotal}</span>
                        : <span style={{ color: 'var(--text-3)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {row.sesi1on1Total > 0
                        ? <span style={{ color: '#00D68F', fontWeight: 600 }}>✓ {row.sesi1on1Total}×</span>
                        : <span style={{ color: 'var(--text-3)' }}>—</span>}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {row.totalReward > 0
                        ? <span style={{ color: '#FFB84B', fontWeight: 600 }}>Rp {(row.totalReward/1000).toFixed(0)}k</span>
                        : <span style={{ color: 'var(--text-3)' }}>—</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Keterangan risiko */}
          {(risikoCount > 0 || perhatianCount > 0) && (
            <div style={{ padding: '10px 16px', borderTop: '1px solid var(--border)', fontSize: 11, color: 'var(--text-3)' }}>
              {risikoCount > 0 && <span style={{ color: '#FF6B6B', marginRight: 12 }}>● Risiko = kehadiran &lt;70%</span>}
              {perhatianCount > 0 && <span style={{ color: '#FFB84B' }}>● Perlu Perhatian = kehadiran &lt;80% atau mood &lt;3</span>}
            </div>
          )}
        </div>
      )}

      {/* Detail panel */}
      <DetailPanel row={selectedRow} onClose={() => setSelected(null)} />
    </div>
  );
}
