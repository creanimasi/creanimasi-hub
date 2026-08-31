import { useState, useEffect, useCallback } from 'react';
import { TIPE_COLOR, DIVISI_COLOR } from '../../data/tim';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { useTim } from '../../hooks/useTim';
import { downloadCsv } from '../../utils/exportCsv';
import { useToast } from '../../hooks/useToast';
import { SkeletonTable, SkeletonCards } from '../../components/Skeleton';

const STATUS = [
  { key: 'hadir',       label: 'Hadir',       emoji: '✅', color: '#00D68F', bg: 'rgba(0,214,143,0.12)',  border: 'rgba(0,214,143,0.35)' },
  { key: 'terlambat',   label: 'Terlambat',   emoji: '🕐', color: '#FFB84B', bg: 'rgba(255,184,75,0.12)', border: 'rgba(255,184,75,0.35)' },
  { key: 'izin',        label: 'Izin',        emoji: '📋', color: '#4BC8FF', bg: 'rgba(75,200,255,0.12)', border: 'rgba(75,200,255,0.35)' },
  { key: 'sakit',       label: 'Sakit',       emoji: '🤒', color: '#B07BFF', bg: 'rgba(176,123,255,0.12)',border: 'rgba(176,123,255,0.35)' },
  { key: 'tidak_hadir', label: 'Alfa',        emoji: '❌', color: '#FF6B6B', bg: 'rgba(255,107,107,0.10)',border: 'rgba(255,107,107,0.3)' },
];

function calcPct(kehadiran) {
  if (!kehadiran?.length) return 0;
  const h = kehadiran.filter(k => k.status === 'hadir' || k.status === 'terlambat').length;
  return Math.round(h / kehadiran.length * 100);
}

function getStatus(key) {
  return STATUS.find(s => s.key === key) || STATUS[4];
}

// ── KARTU ANGGOTA ─────────────────────────────────────────────────────────────
function MemberCard({ member, currStatus, sesiId, isSaving, isAdmin, onStatus }) {
  const tc    = TIPE_COLOR[member.tipe] || { bg: 'var(--surface-2)', text: 'var(--text-2)' };
  const dc    = DIVISI_COLOR[member.divisi] || { icon: '', text: 'var(--text-3)' };
  const inits = member.nama.split(' ').slice(0, 2).map(w => w[0]).join('');
  const st    = getStatus(currStatus);

  return (
    <div style={{
      background: 'var(--surface)',
      border: `1px solid ${st.border}`,
      borderRadius: 14,
      padding: '14px 14px 10px',
      display: 'flex',
      flexDirection: 'column',
      gap: 10,
      transition: 'border-color .2s, box-shadow .2s',
      boxShadow: `0 0 0 0px ${st.color}`,
      opacity: isSaving ? 0.7 : 1,
    }}>
      {/* Baris atas: avatar + nama + badge status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: tc.bg, color: tc.text,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 800,
        }}>{inits}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {member.nama.split(' ')[0]}
          </div>
          <div style={{ fontSize: 10, color: dc.text, marginTop: 1 }}>
            {dc.icon} {member.divisi}
          </div>
        </div>
        <div style={{
          fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20,
          background: st.bg, color: st.color, border: `1px solid ${st.border}`,
          whiteSpace: 'nowrap',
        }}>
          {st.emoji} {st.label}
        </div>
      </div>

      {/* Tombol status (admin only) */}
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 4 }}>
          {STATUS.map(s => {
            const isActive = currStatus === s.key;
            return (
              <button
                key={s.key}
                title={s.label}
                disabled={isSaving}
                onClick={() => onStatus(sesiId, member.nama, s.key)}
                style={{
                  padding: '5px 0',
                  borderRadius: 8,
                  border: `1.5px solid ${isActive ? s.color : 'var(--border-2)'}`,
                  background: isActive ? s.bg : 'transparent',
                  color: isActive ? s.color : 'var(--text-3)',
                  fontSize: 14,
                  cursor: isSaving ? 'wait' : 'pointer',
                  transition: 'all .12s',
                  fontWeight: isActive ? 800 : 400,
                }}
              >
                {s.emoji}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ── KOMPONEN UTAMA ─────────────────────────────────────────────────────────────
export function Absensi() {
  const { user }   = useAuth();
  const tim        = useTim();
  const isAdmin    = user?.role === 'admin';
  const { showToast } = useToast();

  const [sesiList,   setSesiList]   = useState([]);
  const [detail,     setDetail]     = useState({});
  const [activeSesi, setActiveSesi] = useState(null);
  const [filterDiv,  setFilterDiv]  = useState('Semua');
  const [showForm,   setShowForm]   = useState(false);
  const [saving,     setSaving]     = useState({});
  const [loading,    setLoading]    = useState(true);
  const [formData,   setFormData]   = useState({ label: '', tanggal: '' });
  const [formErr,    setFormErr]    = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [editingSesi, setEditingSesi] = useState(null);
  const [confirmHapus, setConfirmHapus] = useState(null); // { id, label }
  const [editErr,     setEditErr]    = useState('');
  const [editSaving,  setEditSaving] = useState(false);
  const [deletingId,  setDeletingId] = useState(null);

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayLabel = new Date().toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const todayExists = sesiList.some(s => s.tanggal?.slice(0, 10) === todayStr);

  const handleCreateToday = async () => {
    setSubmitting(true);
    try {
      const res = await api.createSesiAbsensi({ label: todayLabel, tanggal: todayStr });
      await loadSesiList();
      if (res.data?.id) setActiveSesi(res.data.id);
      showToast('Sesi absensi hari ini berhasil dibuat');
    } catch (err) {
      showToast(err.message || 'Gagal membuat sesi hari ini', 'error');
    } finally { setSubmitting(false); }
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    if (!editingSesi.label.trim() || !editingSesi.tanggal) { setEditErr('Label dan tanggal wajib diisi'); return; }
    setEditSaving(true); setEditErr('');
    try {
      await api.editSesiAbsensi(editingSesi.id, { label: editingSesi.label.trim(), tanggal: editingSesi.tanggal });
      setSesiList(prev => prev.map(s => s.id === editingSesi.id ? { ...s, label: editingSesi.label.trim(), tanggal: editingSesi.tanggal } : s));
      setEditingSesi(null);
      showToast('Sesi berhasil diupdate');
    } catch (err) {
      setEditErr(err.message || 'Gagal menyimpan');
    } finally { setEditSaving(false); }
  };

  const handleDelete = async (sesiId, label) => {
    setDeletingId(sesiId);
    try {
      await api.deleteSesiAbsensi(sesiId);
      setSesiList(prev => prev.filter(s => s.id !== sesiId));
      setDetail(prev => { const n = { ...prev }; delete n[sesiId]; return n; });
      if (activeSesi === sesiId) setActiveSesi(null);
      setConfirmHapus(null);
      showToast(`Sesi "${label}" berhasil dihapus`, 'warning');
    } catch (err) {
      showToast(err.message || 'Gagal menghapus sesi', 'error');
    } finally { setDeletingId(null); }
  };

  const loadSesiList = useCallback(async () => {
    try {
      const res = await api.getSesiAbsensi();
      const list = res.data || [];
      setSesiList(list);
      if (list.length > 0 && !activeSesi) setActiveSesi(list[0].id);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { loadSesiList(); }, [loadSesiList]);

  const loadDetail = useCallback(async (sesiId) => {
    if (detail[sesiId]) return;
    try {
      const res = await api.getDetailAbsensi(sesiId);
      setDetail(prev => ({ ...prev, [sesiId]: res.data }));
    } catch { /* ignore */ }
  }, [detail]);

  useEffect(() => {
    if (activeSesi) loadDetail(activeSesi);
  }, [activeSesi, loadDetail]);

  const handleStatus = async (sesiId, nama, status) => {
    const key = `${sesiId}|${nama}`;
    setSaving(s => ({ ...s, [key]: true }));
    setDetail(prev => {
      const d = prev[sesiId];
      if (!d) return prev;
      return { ...prev, [sesiId]: { ...d, kehadiran: d.kehadiran.map(k => k.nama === nama ? { ...k, status } : k) } };
    });
    try { await api.updateAbsensi(sesiId, nama, status, null); }
    catch { setDetail(prev => { const d = { ...prev }; delete d[sesiId]; return d; }); loadDetail(sesiId); }
    finally { setSaving(s => { const n = { ...s }; delete n[key]; return n; }); }
  };

  const handleCreateSesi = async (e) => {
    e.preventDefault();
    if (!formData.label.trim() || !formData.tanggal) { setFormErr('Label dan tanggal wajib diisi'); return; }
    setSubmitting(true); setFormErr('');
    try {
      const res = await api.createSesiAbsensi(formData);
      setFormData({ label: '', tanggal: '' });
      setShowForm(false);
      await loadSesiList();
      if (res.data?.id) setActiveSesi(res.data.id);
    } catch (err) {
      setFormErr(err.message || 'Gagal membuat sesi');
    } finally { setSubmitting(false); }
  };

  const activeDetail = detail[activeSesi];
  const kehadiran    = activeDetail?.kehadiran || [];
  const pct          = calcPct(kehadiran);

  const counts = STATUS.reduce((acc, s) => {
    acc[s.key] = kehadiran.filter(k => k.status === s.key).length;
    return acc;
  }, {});

  const filteredTim = filterDiv === 'Semua' ? tim : tim.filter(t => t.divisi === filterDiv);
  const divisiList  = ['Semua', ...new Set(tim.map(t => t.divisi))];

  // Metrics global
  const loadedDetails = Object.values(detail);
  const avgHadir = loadedDetails.length > 0
    ? Math.round(loadedDetails.reduce((s, d) => s + calcPct(d.kehadiran), 0) / loadedDetails.length)
    : null;

  const handleExport = () => {
    const rows = [];
    sesiList.forEach(s => {
      const d = detail[s.id];
      if (!d) return;
      d.kehadiran.forEach(k => {
        const m = tim.find(t => t.nama === k.nama);
        rows.push({ sesi: s.label, tanggal: s.tanggal, nama: k.nama, divisi: m?.divisi || '', status: getStatus(k.status).label });
      });
    });
    if (!rows.length) { alert('Buka minimal satu sesi dulu'); return; }
    downloadCsv(rows, `absensi_${new Date().toISOString().slice(0,10)}.csv`);
  };

  if (loading) return <SkeletonTable rows={6} cols={4} />;

  return (
    <div>
      {/* ── METRICS ── */}
      <div className="metrics-grid" style={{ marginBottom: 16 }}>
        <div className="metric">
          <div className="metric-val">{sesiList.length}</div>
          <div className="metric-lbl">Total Sesi</div>
        </div>
        <div className="metric">
          <div className="metric-val text-green">{avgHadir !== null ? `${avgHadir}%` : '—'}</div>
          <div className="metric-lbl">Rata-rata Hadir</div>
        </div>
        <div className="metric">
          <div className="metric-val text-green">{counts.hadir || 0}</div>
          <div className="metric-lbl">✅ Hadir (sesi ini)</div>
        </div>
        <div className="metric">
          <div className="metric-val" style={{ color: 'var(--red)' }}>{counts.tidak_hadir || 0}</div>
          <div className="metric-lbl">❌ Alfa (sesi ini)</div>
        </div>
      </div>

      {/* ── LAYOUT DUA KOLOM ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'clamp(180px, 30%, 220px) 1fr', gap: 14, alignItems: 'start', minWidth: 0 }}>

        {/* KOLOM KIRI: Daftar sesi */}
        <div>
          {/* Tombol buat sesi */}
          {isAdmin && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%', justifyContent: 'center', fontSize: 13, gap: 6 }}
                onClick={handleCreateToday}
                disabled={submitting || todayExists}
                title={todayExists ? 'Sesi hari ini sudah ada' : ''}
              >
                {submitting ? 'Membuat...' : todayExists ? '✓ Sesi Hari Ini Sudah Ada' : '📅 Buat Sesi Hari Ini'}
              </button>
              <button
                className="btn btn-sm"
                style={{ width: '100%', justifyContent: 'center', fontSize: 11 }}
                onClick={() => setShowForm(f => !f)}
              >
                {showForm ? '✕ Batal' : '+ Sesi Manual'}
              </button>
            </div>
          )}

          {/* Form buat sesi manual */}
          {showForm && isAdmin && (
            <form onSubmit={handleCreateSesi} className="card" style={{ marginBottom: 10, padding: 12 }}>
              {formErr && <div style={{ fontSize: 11, color: 'var(--red)', marginBottom: 8 }}>⚠ {formErr}</div>}
              <div style={{ marginBottom: 8 }}>
                <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>Label *</label>
                <input
                  type="text"
                  placeholder="cth: Minggu 29"
                  value={formData.label}
                  onChange={e => setFormData(f => ({ ...f, label: e.target.value }))}
                  style={{ fontSize: 12 }}
                  required
                />
              </div>
              <div style={{ marginBottom: 10 }}>
                <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>Tanggal *</label>
                <input
                  type="date"
                  value={formData.tanggal}
                  onChange={e => setFormData(f => ({ ...f, tanggal: e.target.value }))}
                  style={{ fontSize: 12 }}
                  required
                />
              </div>
              <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%', justifyContent: 'center' }} disabled={submitting}>
                {submitting ? 'Menyimpan...' : '✓ Buat Sesi'}
              </button>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 6, textAlign: 'center' }}>
                {tim.length} anggota otomatis ditambahkan
              </div>
            </form>
          )}

          {/* List sesi */}
          {sesiList.length === 0 ? (
            <div className="empty" style={{ padding: '24px 8px' }}>
              <div className="empty-icon">📋</div>
              <div className="empty-title">Belum ada sesi</div>
              <div className="empty-sub">Buat sesi baru dengan tombol di atas.</div>
            </div>
          ) : sesiList.map(sesi => {
            const d        = detail[sesi.id];
            const p        = d ? calcPct(d.kehadiran) : null;
            const isActive = activeSesi === sesi.id;
            const isDeleting = deletingId === sesi.id;
            return (
              <div
                key={sesi.id}
                onClick={() => setActiveSesi(sesi.id)}
                style={{
                  padding: '10px 12px',
                  borderRadius: 10,
                  marginBottom: 6,
                  cursor: 'pointer',
                  border: `1.5px solid ${isActive ? 'var(--green)' : 'var(--border)'}`,
                  background: isActive ? 'var(--green-light)' : 'var(--surface)',
                  transition: 'all .15s',
                  opacity: isDeleting ? 0.5 : 1,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 4 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12, fontWeight: isActive ? 700 : 500, color: isActive ? 'var(--green)' : 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {sesi.label}
                    </div>
                    <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 2 }}>
                      {new Date(sesi.tanggal).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })}
                    </div>
                  </div>
                  {isAdmin && (
                    <div style={{ display: 'flex', gap: 2, flexShrink: 0 }} onClick={e => e.stopPropagation()}>
                      <button
                        title="Edit sesi"
                        onClick={() => { setEditingSesi({ id: sesi.id, label: sesi.label, tanggal: sesi.tanggal?.slice(0,10) }); setEditErr(''); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 6, color: 'var(--text-3)', fontSize: 13, lineHeight: 1 }}
                      >✏️</button>
                      <button
                        title="Hapus sesi"
                        disabled={isDeleting}
                        onClick={() => setConfirmHapus({ id: sesi.id, label: sesi.label })}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px 4px', borderRadius: 6, color: 'var(--text-3)', fontSize: 13, lineHeight: 1 }}
                      >🗑️</button>
                    </div>
                  )}
                </div>
                {p !== null && (
                  <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ flex: 1, height: 3, borderRadius: 2, background: 'var(--border)' }}>
                      <div style={{ width: `${p}%`, height: '100%', borderRadius: 2, background: p >= 80 ? '#00D68F' : p >= 60 ? '#FFB84B' : '#FF6B6B', transition: 'width .3s' }} />
                    </div>
                    <span style={{ fontSize: 10, fontWeight: 700, color: p >= 80 ? '#00D68F' : p >= 60 ? '#FFB84B' : '#FF6B6B' }}>{p}%</span>
                  </div>
                )}
              </div>
            );
          })}

          {/* Export */}
          <button className="btn btn-sm" style={{ width: '100%', justifyContent: 'center', marginTop: 6 }} onClick={handleExport}>
            ⬇ Export CSV
          </button>
        </div>

        {/* KOLOM KANAN: Detail sesi aktif */}
        <div>
          {!activeSesi ? (
            <div className="empty">
              <div className="empty-icon">📋</div>
              <div className="empty-title">Pilih sesi</div>
              <div className="empty-sub">Klik sesi di sebelah kiri untuk melihat kehadiran.</div>
            </div>
          ) : (
            <>
              {/* Header sesi aktif */}
              <div className="card" style={{ marginBottom: 12 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 15, fontWeight: 800 }}>
                      {sesiList.find(s => s.id === activeSesi)?.label}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>
                      {sesiList.find(s => s.id === activeSesi) && new Date(sesiList.find(s => s.id === activeSesi).tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                    </div>
                  </div>
                  {/* Donut-style summary */}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                    {STATUS.map(s => counts[s.key] > 0 && (
                      <div key={s.key} style={{
                        display: 'flex', alignItems: 'center', gap: 4,
                        padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: s.bg, color: s.color, border: `1px solid ${s.border}`,
                      }}>
                        {s.emoji} {counts[s.key]}
                      </div>
                    ))}
                  </div>
                  {/* Progress ring */}
                  <div style={{ textAlign: 'center' }}>
                    <div style={{
                      width: 52, height: 52, borderRadius: '50%',
                      background: `conic-gradient(#00D68F ${pct * 3.6}deg, var(--surface-2) 0deg)`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      position: 'relative',
                    }}>
                      <div style={{
                        width: 38, height: 38, borderRadius: '50%',
                        background: 'var(--surface)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, fontWeight: 800,
                        color: pct >= 80 ? '#00D68F' : pct >= 60 ? '#FFB84B' : '#FF6B6B',
                      }}>
                        {pct}%
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Filter divisi */}
              <div className="tabs" style={{ marginBottom: 12 }}>
                {divisiList.map(d => (
                  <div key={d} className={`tab ${filterDiv === d ? 'active' : ''}`}
                    onClick={() => setFilterDiv(d)} style={{ fontSize: 11 }}>
                    {d}
                    {d !== 'Semua' && (
                      <span style={{ marginLeft: 4, fontSize: 10, opacity: .6 }}>
                        {kehadiran.filter(k => tim.find(t => t.nama === k.nama && t.divisi === d))
                          .filter(k => k.status === 'hadir' || k.status === 'terlambat').length}/
                        {tim.filter(t => t.divisi === d).length}
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Grid anggota */}
              {!activeDetail ? (
                <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)' }}>Memuat...</div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
                  {filteredTim.map(member => {
                    const ke = kehadiran.find(k => k.nama === member.nama);
                    return (
                      <MemberCard
                        key={member.nama}
                        member={member}
                        currStatus={ke?.status || 'tidak_hadir'}
                        sesiId={activeSesi}
                        isSaving={!!saving[`${activeSesi}|${member.nama}`]}
                        isAdmin={isAdmin}
                        onStatus={handleStatus}
                      />
                    );
                  })}
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── MODAL EDIT SESI ── */}
      {/* Modal konfirmasi hapus sesi */}
      {confirmHapus && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1100, padding: 16 }}
          onClick={e => e.target === e.currentTarget && setConfirmHapus(null)}>
          <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,.3)' }}>
            <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Hapus sesi ini?</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>
              Sesi <strong style={{ color: 'var(--text)' }}>"{confirmHapus.label}"</strong> dan semua data kehadiran di dalamnya akan terhapus permanen.
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmHapus(null)}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', cursor: 'pointer', fontSize: 13 }}>
                Batal
              </button>
              <button onClick={() => handleDelete(confirmHapus.id, confirmHapus.label)} disabled={!!deletingId}
                style={{ flex: 1, padding: '9px 0', borderRadius: 8, border: 'none', background: 'var(--red)', color: '#fff', fontWeight: 700, cursor: deletingId ? 'not-allowed' : 'pointer', fontSize: 13 }}>
                {deletingId ? 'Menghapus...' : 'Ya, Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {editingSesi && (
        <div
          onClick={() => setEditingSesi(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1000,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 16,
          }}
        >
          <form
            onClick={e => e.stopPropagation()}
            onSubmit={handleEditSave}
            style={{
              background: 'var(--surface)',
              borderRadius: 16,
              padding: 24,
              width: '100%',
              maxWidth: 360,
              boxShadow: '0 8px 40px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, marginBottom: 16 }}>✏️ Edit Sesi</div>
            {editErr && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 10 }}>⚠ {editErr}</div>}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>Label *</label>
              <input
                type="text"
                value={editingSesi.label}
                onChange={e => setEditingSesi(s => ({ ...s, label: e.target.value }))}
                autoFocus
                required
              />
            </div>
            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 11, color: 'var(--text-3)', display: 'block', marginBottom: 4 }}>Tanggal *</label>
              <input
                type="date"
                value={editingSesi.tanggal}
                onChange={e => setEditingSesi(s => ({ ...s, tanggal: e.target.value }))}
                required
              />
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn btn-sm" style={{ flex: 1, justifyContent: 'center' }} onClick={() => setEditingSesi(null)}>
                Batal
              </button>
              <button type="submit" className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center' }} disabled={editSaving}>
                {editSaving ? 'Menyimpan...' : '✓ Simpan'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
