import { useState, useEffect, useCallback } from 'react';
import { TIPE_COLOR, DIVISI_COLOR } from '../../data/tim';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useTim } from '../../hooks/useTim';
import { downloadCsv } from '../../utils/exportCsv';

const STATUS_CONFIG = {
  hadir:       { label: 'Hadir',       short: 'H', color: 'var(--green)',  bg: 'var(--green-light)'  },
  terlambat:   { label: 'Terlambat',   short: 'T', color: 'var(--amber)',  bg: 'var(--amber-light)'  },
  izin:        { label: 'Izin',        short: 'I', color: 'var(--blue)',   bg: 'var(--blue-light)'   },
  sakit:       { label: 'Sakit',       short: 'S', color: 'var(--purple)', bg: 'var(--purple-light)' },
  tidak_hadir: { label: 'Tidak Hadir', short: 'X', color: 'var(--red)',    bg: 'var(--surface-2)'    },
};
const STATUS_KEYS = Object.keys(STATUS_CONFIG);

function calcHadirPct(kehadiran) {
  if (!kehadiran?.length) return 0;
  const h = kehadiran.filter(k => k.status === 'hadir' || k.status === 'terlambat').length;
  return Math.round(h / kehadiran.length * 100);
}

// ── KOMPONEN UTAMA ─────────────────────────────────────────────────────────────
export function Absensi() {
  const { user }  = useAuth();
  const tim       = useTim();
  const isAdmin   = user?.role === 'admin';

  const [sesiList,  setSesiList]  = useState([]);
  const [detail,    setDetail]    = useState({});   // sesiId → { kehadiran[] }
  const [expanded,  setExpanded]  = useState(null);
  const [filterDiv, setFilterDiv] = useState('Semua');
  const [showForm,  setShowForm]  = useState(false);
  const [saving,    setSaving]    = useState({});
  const [loading,   setLoading]   = useState(true);
  const [formData,  setFormData]  = useState({ label: '', tanggal: '' });
  const [formErr,   setFormErr]   = useState('');
  const [submitting, setSubmitting] = useState(false);

  const loadSesiList = useCallback(async () => {
    try {
      const res = await api.getSesiAbsensi();
      setSesiList(res.data || []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadSesiList(); }, [loadSesiList]);

  const loadDetail = async (sesiId) => {
    if (detail[sesiId]) return;
    try {
      const res = await api.getDetailAbsensi(sesiId);
      setDetail(prev => ({ ...prev, [sesiId]: res.data }));
    } catch { /* ignore */ }
  };

  const handleExpand = (sesiId) => {
    if (expanded === sesiId) { setExpanded(null); return; }
    setExpanded(sesiId);
    loadDetail(sesiId);
  };

  const handleStatus = async (sesiId, nama, status) => {
    const key = `${sesiId}|${nama}`;
    setSaving(s => ({ ...s, [key]: true }));
    // Optimistic update
    setDetail(prev => {
      const d = prev[sesiId];
      if (!d) return prev;
      const kehadiran = d.kehadiran.map(k =>
        k.nama === nama ? { ...k, status } : k
      );
      return { ...prev, [sesiId]: { ...d, kehadiran } };
    });
    try { await api.updateAbsensi(sesiId, nama, status, null); }
    catch { loadDetail(sesiId); }
    finally { setSaving(s => { const n = { ...s }; delete n[key]; return n; }); }
  };

  const handleCreateSesi = async (e) => {
    e.preventDefault();
    if (!formData.label.trim() || !formData.tanggal) {
      setFormErr('Label dan tanggal wajib diisi'); return;
    }
    setSubmitting(true); setFormErr('');
    try {
      await api.createSesiAbsensi(formData);
      setFormData({ label: '', tanggal: '' });
      setShowForm(false);
      await loadSesiList();
    } catch (err) {
      setFormErr(err.message || 'Gagal membuat sesi');
    } finally { setSubmitting(false); }
  };

  // Metrics
  const totalSesi = sesiList.length;
  const loadedDetails = Object.values(detail);
  const avgHadir = loadedDetails.length > 0
    ? Math.round(loadedDetails.reduce((s, d) => s + calcHadirPct(d.kehadiran), 0) / loadedDetails.length)
    : null;
  const absenCount = {};
  loadedDetails.forEach(d => {
    (d.kehadiran || []).forEach(k => {
      if (k.status === 'tidak_hadir') absenCount[k.nama] = (absenCount[k.nama] || 0) + 1;
    });
  });
  const palaingAbsen = Object.entries(absenCount).sort((a, b) => b[1] - a[1])[0];

  const divisiList = ['Semua', ...new Set(tim.map(t => t.divisi))];

  const handleExport = () => {
    const rows = [];
    sesiList.forEach(s => {
      const d = detail[s.id];
      if (!d) return;
      (d.kehadiran || []).forEach(k => {
        const member = tim.find(t => t.nama === k.nama);
        rows.push({
          sesi_label: s.label,
          tanggal: s.tanggal,
          nama: k.nama,
          divisi: member?.divisi || '',
          status: STATUS_CONFIG[k.status]?.label || k.status,
          catatan: k.catatan || '',
        });
      });
    });
    if (!rows.length) { alert('Buka minimal satu sesi untuk export CSV'); return; }
    downloadCsv(rows, `absensi_${new Date().toISOString().slice(0,10)}.csv`);
  };

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-2)' }}>
      Memuat data absensi...
    </div>
  );

  return (
    <div>
      {/* Metrics */}
      <div className="metrics-grid" style={{ marginBottom: 16 }}>
        <div className="metric">
          <div className="metric-val">{totalSesi}</div>
          <div className="metric-lbl">Total Sesi</div>
        </div>
        <div className="metric">
          <div className="metric-val text-green">
            {avgHadir !== null ? `${avgHadir}%` : '—'}
          </div>
          <div className="metric-lbl">Rata-rata Hadir</div>
        </div>
        <div className="metric">
          <div className="metric-val" style={{ color: 'var(--red)', fontSize: palaingAbsen ? 14 : 22 }}>
            {palaingAbsen ? palaingAbsen[0].split(' ')[0] : '—'}
          </div>
          <div className="metric-lbl">Sering Tidak Hadir</div>
        </div>
        <div className="metric">
          <div className="metric-val">{tim.length}</div>
          <div className="metric-lbl">Anggota Aktif</div>
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap', alignItems: 'center' }}>
        <div className="tabs" style={{ flex: 1, marginBottom: 0 }}>
          {divisiList.map(d => (
            <div key={d} className={`tab ${filterDiv === d ? 'active' : ''}`}
              onClick={() => setFilterDiv(d)} style={{ fontSize: 11 }}>
              {d}
            </div>
          ))}
        </div>
        <button className="btn btn-sm" onClick={handleExport}>
          ⬇ Export CSV
        </button>
        {isAdmin && (
          <button className="btn btn-sm btn-primary" onClick={() => setShowForm(f => !f)}>
            {showForm ? '✕ Batal' : '+ Buat Sesi'}
          </button>
        )}
      </div>

      {/* Form buat sesi */}
      {showForm && isAdmin && (
        <form onSubmit={handleCreateSesi} className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, color: 'var(--green)' }}>
            + Buat Sesi Absensi Baru
          </div>
          {formErr && (
            <div className="alert alert-red" style={{ marginBottom: 10 }}>
              <span>⚠️</span><div>{formErr}</div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ flex: 2, minWidth: 180 }}>
              <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Label sesi *</label>
              <input
                type="text"
                placeholder="cth: Minggu 29 — 14–18 Jul 2026"
                value={formData.label}
                onChange={e => setFormData(f => ({ ...f, label: e.target.value }))}
                required
              />
            </div>
            <div style={{ flex: 1, minWidth: 140 }}>
              <label style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>Tanggal *</label>
              <input
                type="date"
                value={formData.tanggal}
                onChange={e => setFormData(f => ({ ...f, tanggal: e.target.value }))}
                required
              />
            </div>
            <div style={{ alignSelf: 'flex-end' }}>
              <button type="submit" className="btn btn-primary btn-sm" disabled={submitting}>
                {submitting ? 'Menyimpan...' : 'Simpan'}
              </button>
            </div>
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 8 }}>
            Semua anggota aktif ({tim.length} orang) akan ditambahkan otomatis dengan status "Tidak Hadir".
          </div>
        </form>
      )}

      {/* Daftar sesi */}
      {sesiList.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📋</div>
          <div className="empty-title">Belum ada sesi absensi</div>
          <div className="empty-sub">Buat sesi baru untuk mulai mencatat kehadiran tim.</div>
        </div>
      ) : sesiList.map(sesi => {
        const d = detail[sesi.id];
        const isExp = expanded === sesi.id;
        const kehadiran = d?.kehadiran || [];
        const pct = calcHadirPct(kehadiran);
        const counts = STATUS_KEYS.reduce((acc, s) => {
          acc[s] = kehadiran.filter(k => k.status === s).length;
          return acc;
        }, {});

        const filteredAnggota = filterDiv === 'Semua'
          ? tim
          : tim.filter(t => t.divisi === filterDiv);

        return (
          <div key={sesi.id} className="card" style={{ marginBottom: 10 }}>
            {/* Header sesi */}
            <div
              onClick={() => handleExpand(sesi.id)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13 }}>{sesi.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                  {new Date(sesi.tanggal).toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
              </div>
              {/* Progress bar */}
              {kehadiran.length > 0 && (
                <div style={{ textAlign: 'right', minWidth: 80 }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--amber)' : 'var(--red)' }}>
                    {pct}%
                  </div>
                  <div style={{ fontSize: 9, color: 'var(--text-3)' }}>hadir</div>
                  <div style={{
                    width: 80, height: 4, borderRadius: 2, background: 'var(--surface-2)',
                    marginTop: 3, overflow: 'hidden',
                  }}>
                    <div style={{
                      width: `${pct}%`, height: '100%',
                      background: pct >= 80 ? 'var(--green)' : pct >= 60 ? 'var(--amber)' : 'var(--red)',
                      transition: 'width .3s',
                    }} />
                  </div>
                </div>
              )}
              <div style={{ fontSize: 18, color: 'var(--text-3)', marginLeft: 4 }}>
                {isExp ? '▲' : '▼'}
              </div>
            </div>

            {/* Detail expanded */}
            {isExp && (
              <div style={{ marginTop: 14 }}>
                {/* Pills summary */}
                {kehadiran.length > 0 && (
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                    {STATUS_KEYS.map(s => counts[s] > 0 && (
                      <span key={s} style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: STATUS_CONFIG[s].bg, color: STATUS_CONFIG[s].color,
                        border: `1px solid ${STATUS_CONFIG[s].color}40`,
                      }}>
                        {counts[s]} {STATUS_CONFIG[s].label}
                      </span>
                    ))}
                  </div>
                )}

                {!d ? (
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-3)' }}>Memuat...</div>
                ) : filteredAnggota.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-3)' }}>
                    Tidak ada anggota di divisi ini
                  </div>
                ) : filteredAnggota.map(member => {
                  const ke = kehadiran.find(k => k.nama === member.nama);
                  const currStatus = ke?.status || 'tidak_hadir';
                  const tc = TIPE_COLOR[member.tipe] || { bg: 'var(--surface-2)', text: 'var(--text-2)' };
                  const dc = DIVISI_COLOR[member.divisi] || { icon: '', text: 'var(--text-3)' };
                  const inits = member.nama.split(' ').slice(0, 2).map(w => w[0]).join('');

                  return (
                    <div key={member.nama} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 0',
                      borderBottom: '1px solid var(--border)',
                    }}>
                      {/* Avatar */}
                      <div style={{
                        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
                        background: tc.bg, color: tc.text,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 700,
                      }}>{inits}</div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {member.nama}
                        </div>
                        <div style={{ fontSize: 10, color: dc.text }}>
                          {dc.icon} {member.divisi}
                        </div>
                      </div>

                      {/* Status buttons */}
                      {isAdmin && (
                        <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                          {STATUS_KEYS.map(s => {
                            const cfg = STATUS_CONFIG[s];
                            const isActive = currStatus === s;
                            const key = `${sesi.id}|${member.nama}`;
                            const isSaving = saving[key];
                            return (
                              <button
                                key={s}
                                title={cfg.label}
                                disabled={isSaving}
                                onClick={() => handleStatus(sesi.id, member.nama, s)}
                                style={{
                                  width: 30, height: 30, borderRadius: 7, fontSize: 11, fontWeight: 700,
                                  cursor: isSaving ? 'wait' : 'pointer',
                                  border: `1px solid ${isActive ? cfg.color : 'var(--border-2)'}`,
                                  background: isActive ? cfg.bg : 'var(--surface)',
                                  color: isActive ? cfg.color : 'var(--text-3)',
                                  transition: 'all .12s',
                                  opacity: isSaving ? 0.5 : 1,
                                }}
                              >
                                {cfg.short}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      {/* Status badge (member view) */}
                      {!isAdmin && (
                        <span style={{
                          padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                          background: STATUS_CONFIG[currStatus].bg,
                          color: STATUS_CONFIG[currStatus].color,
                        }}>
                          {STATUS_CONFIG[currStatus].label}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
