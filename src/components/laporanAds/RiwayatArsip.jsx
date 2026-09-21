import { Fragment, useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { api } from '../../services/api';
import { simpanBlob } from '../../utils/simpanBlob';
import { namaBulan, labelRentang } from './SlideDeck';

const fmtRp = (n) => `Rp ${Math.round(Number(n || 0)).toLocaleString('id-ID')}`;
const fmtUkuran = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fmtWaktu = (t) => (t ? new Date(t).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—');
const labelBulan = (b) => `${namaBulan(b)} ${String(b).slice(0, 4)}`;
const AKSI_LABEL = { dibuat: '📄 Dibuat', diunduh: '⬇️ Diunduh', dihapus: '🗑️ Dihapus' };

export function namaFilePdf(a) {
  const judul = String(a.judul || 'Laporan').replace(/[\\/:*?"<>|]+/g, ' ').trim();
  return `Weekly Report - ${judul} ${namaBulan(a.bulan)} ${a.minggu} v${a.versi}.pdf`;
}

const th = { padding: '8px 10px', fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textAlign: 'left', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', whiteSpace: 'nowrap' };
const td = { padding: '9px 10px', fontSize: 12, color: 'var(--text-1)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };
const btn = { padding: '4px 9px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontSize: 11, whiteSpace: 'nowrap' };

export default function RiwayatArsip({ brandId, opsiBulan, isAdmin, showToast, onBuka }) {
  const [bulan, setBulan] = useState('');       // '' = semua bulan
  const [daftar, setDaftar] = useState([]);
  const [memuat, setMemuat] = useState(false);
  const [sibuk, setSibuk] = useState(null);     // id arsip yang sedang diunduh/dihapus
  const [terbuka, setTerbuka] = useState(() => new Set());   // grup dengan versi lama ditampilkan
  const [logBuka, setLogBuka] = useState(null); // { id, data }

  const permintaan = useRef(0); // nomor pemuatan terbaru — balasan basi (ganti brand/filter cepat) diabaikan
  const muat = useCallback(async (diam = false) => {
    if (!brandId) return;
    const id = ++permintaan.current;
    if (!diam) setMemuat(true);
    try {
      const r = await api.getArsipLaporanAds(brandId, bulan);
      if (id === permintaan.current) setDaftar(r.data || []);
    } catch (e) {
      if (id !== permintaan.current) return;
      showToast('Gagal memuat riwayat: ' + e.message, 'error');
      setDaftar([]);
    } finally { if (id === permintaan.current) setMemuat(false); }
  }, [brandId, bulan, showToast]);

  useEffect(() => { muat(); }, [muat]);

  // Kelompokkan per bulan+minggu; urutan dari server: bulan ↓, minggu ↓, versi ↓ (jadi [0] = terbaru)
  const grup = useMemo(() => {
    const m = new Map();
    daftar.forEach(a => { const k = `${a.bulan}|${a.minggu}`; if (!m.has(k)) m.set(k, []); m.get(k).push(a); });
    return [...m.entries()];
  }, [daftar]);

  const unduh = async (a) => {
    setSibuk(a.id);
    try {
      const blob = await api.unduhArsipLaporanAds(a.id);
      simpanBlob(blob, namaFilePdf(a));
      muat(true); // perbarui penghitung unduhan
    } catch (e) { showToast('Gagal mengunduh PDF: ' + e.message, 'error'); }
    finally { setSibuk(null); }
  };

  const hapus = async (a) => {
    if (!window.confirm(`Hapus PDF ${labelBulan(a.bulan)} Minggu ${a.minggu} (v${a.versi}) dari riwayat?\n\nFile dihapus permanen; jejak siapa yang menghapus tetap tercatat.`)) return;
    setSibuk(a.id);
    try {
      await api.hapusArsipLaporanAds(a.id);
      showToast('PDF dihapus dari riwayat');
      if (logBuka?.id === a.id) setLogBuka(null);
      muat(true);
    } catch (e) { showToast('Gagal menghapus: ' + e.message, 'error'); }
    finally { setSibuk(null); }
  };

  const toggleLog = async (a) => {
    if (logBuka?.id === a.id) { setLogBuka(null); return; }
    setLogBuka({ id: a.id, data: null });
    try {
      const r = await api.getLogArsipLaporanAds(a.id);
      setLogBuka({ id: a.id, data: r.data || [] });
    } catch (e) { showToast('Gagal memuat jejak: ' + e.message, 'error'); setLogBuka(null); }
  };

  const toggleGrup = (k) => setTerbuka(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  const baris = (a, { utama, kunci, jumlahLain }) => {
    const profit = a.ringkasan?.total_profit;
    const per = a.ringkasan?.auto?.[a.minggu - 1];           // periode yang dibekukan pada PDF ini (PDF lama tanpa data ini → kosong)
    const periode = per?.dari ? labelRentang(per.dari, per.sampai) : '';
    return (
      <>
        <tr key={a.id} style={{ background: utama ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
          <td style={td}>
            {utama ? (
              <>
                <b>{labelBulan(a.bulan)}</b> · Minggu {a.minggu}
                {periode && <div style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>Periode {periode}</div>}
                {jumlahLain > 0 && (
                  <button onClick={() => toggleGrup(kunci)} style={{ ...btn, marginLeft: 8, padding: '2px 7px' }}>
                    {terbuka.has(kunci) ? '▾' : '▸'} {jumlahLain} versi lain
                  </button>
                )}
              </>
            ) : <span style={{ color: 'var(--text-3)', paddingLeft: 14 }}>versi sebelumnya</span>}
          </td>
          <td style={td}><b>v{a.versi}</b></td>
          <td style={td}>{a.dibuat_oleh || '—'}<div style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{fmtWaktu(a.dibuat_pada)}</div></td>
          <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: Number(profit) < 0 ? '#FF6B6B' : 'var(--text-1)' }}>{profit === undefined ? '—' : fmtRp(profit)}</td>
          <td style={{ ...td, textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtUkuran(a.ukuran)}{a.jumlah_slide ? <div style={{ fontSize: 11, color: 'var(--text-3)' }}>{a.jumlah_slide} slide</div> : null}</td>
          <td style={td}>
            {a.jumlah_unduh}×
            {a.terakhir_diunduh_oleh ? <div style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap' }}>{a.terakhir_diunduh_oleh} · {fmtWaktu(a.terakhir_diunduh_pada)}</div> : null}
          </td>
          <td style={{ ...td, whiteSpace: 'nowrap' }}>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <button onClick={() => unduh(a)} disabled={sibuk === a.id} style={{ ...btn, color: 'var(--green)', borderColor: 'var(--green)' }}>{sibuk === a.id ? '⏳' : '⬇️ Unduh'}</button>
              <button onClick={() => onBuka(a.bulan, a.minggu)} style={btn} title="Buka bulan & minggu ini di tab Isi Data (data terkini, bukan potret PDF)">📂 Buka</button>
              <button onClick={() => toggleLog(a)} style={btn}>🕘 Jejak</button>
              {isAdmin && <button onClick={() => hapus(a)} disabled={sibuk === a.id} style={{ ...btn, color: '#FF6B6B' }}>🗑️</button>}
            </div>
          </td>
        </tr>
        {logBuka?.id === a.id && (
          <tr key={`log-${a.id}`}>
            <td colSpan={7} style={{ ...td, background: 'var(--surface-2)', fontSize: 11 }}>
              {logBuka.data === null ? 'Memuat jejak…' : logBuka.data.length === 0 ? 'Belum ada jejak.' : (
                <div style={{ display: 'grid', gap: 3 }}>
                  {logBuka.data.map((l, i) => <div key={i}>{AKSI_LABEL[l.aksi] || l.aksi} · {l.oleh || '—'} · <span style={{ color: 'var(--text-3)' }}>{fmtWaktu(l.waktu)}</span></div>)}
                </div>
              )}
            </td>
          </tr>
        )}
      </>
    );
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 12 }}>
        <select value={bulan} onChange={e => setBulan(e.target.value)} style={{ padding: '7px 10px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-1)', fontSize: 13 }}>
          <option value="">Semua bulan</option>
          {opsiBulan.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
        <span style={{ fontSize: 11, color: 'var(--text-3)' }}>PDF masuk ke sini otomatis saat kamu klik <b>Download PDF</b>. Tersimpan maksimal 3 versi terbaru per minggu.</span>
      </div>

      {memuat ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13, padding: 24 }}>Memuat…</div>
      ) : daftar.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📭</div>
          <div className="empty-title">Belum ada PDF di riwayat</div>
          <div className="empty-sub">Buka tab Isi Data lalu klik Download PDF — filenya otomatis tersimpan di sini.</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 960 }}>
            <thead>
              <tr>
                <th style={th}>Laporan</th><th style={th}>Versi</th><th style={th}>Dibuat oleh</th>
                <th style={{ ...th, textAlign: 'right' }} title="Total Profit Minggu 1 s/d minggu ini, dibekukan saat PDF dibuat">Total Profit (saat dibuat)</th>
                <th style={{ ...th, textAlign: 'right' }}>Ukuran</th><th style={th}>Diunduh</th><th style={th}>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {grup.map(([kunci, versi]) => (
                <GrupBaris key={kunci} kunci={kunci} versi={versi} terbuka={terbuka.has(kunci)} baris={baris} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function GrupBaris({ kunci, versi, terbuka, baris }) {
  const [terbaru, ...lain] = versi;
  return (
    <>
      {baris(terbaru, { utama: true, kunci, jumlahLain: lain.length })}
      {terbuka && lain.map(a => <Fragment key={a.id}>{baris(a, { utama: false, kunci, jumlahLain: 0 })}</Fragment>)}
    </>
  );
}
