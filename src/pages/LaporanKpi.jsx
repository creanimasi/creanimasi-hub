import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';

const pesanError = (e) => (e?.message || 'Terjadi kesalahan').replace(/^\d{3}: /, '');

const bulanSekarang = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const bulanSebelumnya = (bulan) => {
  const [t, b] = bulan.split('-').map(Number);
  const d = new Date(t, b - 2, 1); // b-1 = bulan ini (0-based), -1 lagi = bulan lalu
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};
const labelBulan = (bulan) => {
  const [t, b] = bulan.split('-').map(Number);
  const NAMA = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
  return `${NAMA[b - 1]} ${t}`;
};

const th = { padding: '6px 8px', fontSize: 11, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: '.03em', textAlign: 'center', borderBottom: '1px solid var(--border-2)', whiteSpace: 'nowrap' };
const td = { padding: '4px 8px', fontSize: 12, textAlign: 'center', borderBottom: '1px solid var(--border)', fontVariantNumeric: 'tabular-nums' };
const numInput = { width: '100%', textAlign: 'center', border: 'none', background: 'transparent', color: 'inherit', fontSize: 12, fontWeight: 700, padding: '3px 2px', fontFamily: 'inherit' };

// ── Satu sel target KPI (baris header, bisa diedit) ─────────────────────────
function SelKpi({ artist, bulan, versi, onSimpan }) {
  const [v, setV] = useState(artist.target ?? '');
  useEffect(() => { setV(artist.target ?? ''); }, [artist.target, versi]);
  const simpan = () => {
    const nilai = v === '' ? null : Number(v);
    if (nilai !== (artist.target ?? null)) onSimpan({ tim_id: artist.tim_id, bulan, target: nilai });
  };
  return (
    <input value={v} onChange={e => setV(e.target.value)} onBlur={simpan} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
      type="number" min={0} max={9999} placeholder="—" aria-label={`Target KPI ${artist.nama}`}
      style={{ ...numInput, color: 'var(--green)', fontWeight: 800, fontSize: 13 }} />
  );
}

// ── Sel Total Bonus (baris footer, bisa diedit — rumusnya belum ditentukan, manual dulu) ──
function SelBonus({ artist, bulan, versi, onSimpan }) {
  const [v, setV] = useState(artist.total_bonus ?? '');
  useEffect(() => { setV(artist.total_bonus ?? ''); }, [artist.total_bonus, versi]);
  const simpan = () => {
    const nilai = v === '' ? null : Number(v);
    if (nilai !== (artist.total_bonus ?? null)) onSimpan({ tim_id: artist.tim_id, bulan, total_bonus: nilai });
  };
  return (
    <input value={v} onChange={e => setV(e.target.value)} onBlur={simpan} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
      type="number" min={0} placeholder="—" aria-label={`Total Bonus ${artist.nama}`} style={numInput} />
  );
}

export default function LaporanKpi() {
  const [bulan, setBulan] = useState(bulanSekarang());
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [versi, setVersi] = useState(0);
  const [menyalin, setMenyalin] = useState(false);
  const { showToast } = useToast();

  const muat = useCallback(async (b, senyap = false) => {
    if (!senyap) setState(s => ({ ...s, loading: true, error: null }));
    try { const r = await api.getLaporanKpi(b); setState({ data: r.data, loading: false, error: null }); }
    catch (e) { setState(s => ({ data: senyap ? s.data : null, loading: false, error: pesanError(e) })); }
    finally { setVersi(v => v + 1); }
  }, []);
  useEffect(() => { muat(bulan); }, [bulan, muat]);

  const simpanTarget = async (payload) => {
    try { await api.laporanKpiSetTarget(payload); }
    catch (e) { showToast(pesanError(e), 'error'); }
    finally { await muat(bulan, true); }
  };

  const salinDariBulanLalu = async () => {
    setMenyalin(true);
    try {
      const dari = bulanSebelumnya(bulan);
      const r = await api.laporanKpiSalinTarget(dari, bulan);
      showToast(r.data.disalin > 0 ? `${r.data.disalin} target disalin dari ${labelBulan(dari)}` : `Tidak ada target baru untuk disalin dari ${labelBulan(dari)}`);
      await muat(bulan, true);
    } catch (e) { showToast(pesanError(e), 'error'); }
    finally { setMenyalin(false); }
  };

  const { data, loading, error } = state;

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Laporan KPI Artist</div>
        <p style={{ fontSize: 12, color: 'var(--text-2)', margin: '0 0 12px', maxWidth: '70ch' }}>
          Rekap poin harian tim produksi — diambil otomatis dari kolom Poin di Papan Timeline (tugas yang
          diberi tanggal kerja lewat tombol "Tgl"). Baris KPI &amp; Total Bonus diatur manual di sini; poin
          harian &amp; Total assignment murni hasil hitungan, tak bisa diedit langsung.
        </p>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <input type="month" value={bulan} onChange={e => e.target.value && setBulan(e.target.value)}
            aria-label="Pilih bulan" style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }} />
          <span style={{ fontSize: 13, fontWeight: 700 }}>{labelBulan(bulan)}</span>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn btn-sm" onClick={salinDariBulanLalu} disabled={menyalin}>
            {menyalin ? 'Menyalin…' : `Salin target dari ${labelBulan(bulanSebelumnya(bulan))}`}
          </button>
        </div>
      </div>

      {loading && <div className="card"><p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>Memuat…</p></div>}
      {error && (
        <div className="card">
          <p style={{ fontSize: 12, color: 'var(--red)', margin: '0 0 8px' }}>{error}</p>
          <button type="button" className="btn btn-sm" onClick={() => muat(bulan)}>Coba lagi</button>
        </div>
      )}

      {data && (
        data.artists.length === 0 ? (
          <div className="card"><p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>Belum ada anggota tim produksi aktif (Illustrator/Rigger/3D Modeler/Desainer).</p></div>
        ) : (
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    <th style={{ ...th, textAlign: 'left', width: 80 }}>Hari</th>
                    <th style={{ ...th, width: 40 }}>Tgl</th>
                    {data.artists.map(a => (
                      <th key={a.tim_id} style={{ ...th, width: 64 }} title={a.nama}>
                        <div style={{ whiteSpace: 'normal', lineHeight: 1.2 }}>{a.nama}</div>
                      </th>
                    ))}
                  </tr>
                  <tr>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 700, background: 'var(--surface-2)' }} colSpan={2}>KPI</td>
                    {data.artists.map(a => (
                      <td key={a.tim_id} style={{ ...td, background: 'var(--surface-2)' }}>
                        <SelKpi artist={a} bulan={bulan} versi={versi} onSimpan={simpanTarget} />
                      </td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.hariList.map(h => (
                    <tr key={h.tanggal} style={h.minggu ? { background: 'var(--red-light)' } : undefined}>
                      <td style={{ ...td, textAlign: 'left', color: h.minggu ? 'var(--red)' : 'var(--text-2)', fontWeight: h.minggu ? 700 : 400 }}>{h.namaHari}</td>
                      <td style={{ ...td, color: h.minggu ? 'var(--red)' : 'var(--text-2)' }}>{Number(h.tanggal.slice(-2))}</td>
                      {data.artists.map(a => (
                        <td key={a.tim_id} style={td}>{h.minggu ? '' : (a.poinHarian[h.tanggal] ?? '—')}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 700, background: 'var(--blue-light)', color: 'var(--blue)' }} colSpan={2}>Total assignment</td>
                    {data.artists.map(a => (
                      <td key={a.tim_id} style={{ ...td, fontWeight: 700, background: 'var(--blue-light)', color: 'var(--blue)' }}>{a.total}</td>
                    ))}
                  </tr>
                  <tr>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 600, color: 'var(--text-3)' }} colSpan={2}>Total Bonus</td>
                    {data.artists.map(a => (
                      <td key={a.tim_id} style={td}>
                        <SelBonus artist={a} bulan={bulan} versi={versi} onSimpan={simpanTarget} />
                      </td>
                    ))}
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        )
      )}
    </div>
  );
}
