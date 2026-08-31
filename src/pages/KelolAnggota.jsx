import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import { SkeletonList } from '../components/Skeleton';

const ENTITAS_LIST = ['Creanimasi Studio', 'Flip Studio', 'Creillustra', 'Shuyou'];
const DIVISI_OPTIONS = ['Admin', 'PM', 'Illustrator', 'Rigger', '3D Modeler', 'Developer', 'Marketing', 'Desainer'];
const LEVEL_OPTIONS  = ['Magang / Probation', 'Junior', 'Senior', 'Admin (L4)', 'Secondline', 'Koordinator'];
const TIPE_OPTIONS   = ['Rising Star', 'High Potential', 'Silent Expert', 'At Risk', ''];

const ENTITAS_COLOR = {
  'Creanimasi Studio': { bg: 'rgba(0,214,143,0.12)', text: 'var(--green)' },
  'Flip Studio':       { bg: 'rgba(99,102,241,0.12)', text: '#818cf8' },
  'Creillustra':       { bg: 'rgba(251,146,60,0.12)',  text: '#fb923c' },
  'Shuyou':            { bg: 'rgba(236,72,153,0.12)',  text: '#f472b6' },
};

const ROLE_COLOR = {
  admin:  { bg: 'rgba(0,214,143,0.1)', text: 'var(--green)' },
  member: { bg: 'var(--surface-2)',    text: 'var(--text-3)' },
};

function EntitasBadge({ entitas }) {
  const s = ENTITAS_COLOR[entitas] || { bg: 'var(--surface-2)', text: 'var(--text-2)' };
  return (
    <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: s.bg, color: s.text }}>
      {entitas}
    </span>
  );
}

function RoleBadge({ role }) {
  const s = ROLE_COLOR[role] || ROLE_COLOR.member;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: s.bg, color: s.text }}>
      {role === 'admin' ? 'Admin' : 'Member'}
    </span>
  );
}

function genPassword() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 5).toUpperCase();
}

// ── FORM TAMBAH / EDIT ────────────────────────────────────────────────────────
function AnggotaFormModal({ initial, onSave, onClose }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(
    isEdit
      ? { nama: initial.nama, entitas: initial.entitas || 'Creanimasi Studio', divisi: initial.divisi || '', level: initial.level || '', tipe: initial.tipe || '', username: initial.username || '', role: initial.role || 'member' }
      : { nama: '', entitas: 'Creanimasi Studio', divisi: '', level: '', tipe: '', username: '', password: '', role: 'member' }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nama.trim() || !form.divisi || !form.entitas) {
      setError('Nama, divisi, dan entitas wajib diisi');
      return;
    }
    if (!isEdit) {
      if (!form.username.trim()) { setError('Username wajib diisi'); return; }
      if (!form.password || form.password.length < 8) { setError('Password minimal 8 karakter'); return; }
    } else {
      if (!form.username.trim()) { setError('Username wajib diisi'); return; }
    }
    setLoading(true);
    setError('');
    try {
      await onSave(form);
      onClose();
    } catch (err) {
      setError(err.message.replace(/^\d+: /, ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14, padding: 24,
        width: '100%', maxWidth: 480, boxShadow: '0 8px 32px rgba(0,0,0,0.22)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 18 }}>
          {isEdit ? 'Edit Anggota' : 'Tambah Anggota Baru'}
        </div>

        {error && (
          <div className="alert alert-red" style={{ marginBottom: 14 }}>
            <span>⚠️</span><div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Nama */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Nama lengkap *</label>
            <input value={form.nama} onChange={e => set('nama', e.target.value)} placeholder="Nama lengkap" required />
          </div>

          {/* Entitas */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Entitas *</label>
            <select value={form.entitas} onChange={e => set('entitas', e.target.value)} required>
              {ENTITAS_LIST.map(e => <option key={e} value={e}>{e}</option>)}
            </select>
          </div>

          {/* Divisi + Level */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Divisi *</label>
              <select value={form.divisi} onChange={e => set('divisi', e.target.value)} required>
                <option value="">— Pilih —</option>
                {DIVISI_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Level</label>
              <select value={form.level} onChange={e => set('level', e.target.value)}>
                <option value="">— Pilih —</option>
                {LEVEL_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>

          {/* Tipe + Role */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={labelStyle}>Tipe</label>
              <select value={form.tipe} onChange={e => set('tipe', e.target.value)}>
                <option value="">— Pilih —</option>
                {TIPE_OPTIONS.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label style={labelStyle}>Role akun</label>
              <select value={form.role} onChange={e => set('role', e.target.value)}>
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
          </div>

          {/* Username */}
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Username *</label>
            <input
              value={form.username}
              onChange={e => set('username', e.target.value.toLowerCase())}
              placeholder="username (huruf kecil)"
              required
            />
          </div>

          {/* Password — hanya saat tambah */}
          {!isEdit && (
            <div style={{ marginBottom: 16 }}>
              <label style={labelStyle}>
                Password * <span style={{ fontWeight: 400, color: 'var(--text-2)' }}>(min. 8 karakter)</span>
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  value={form.password}
                  onChange={e => set('password', e.target.value)}
                  placeholder="Password awal"
                  style={{ flex: 1 }}
                  required
                  minLength={8}
                />
                <button type="button"
                  onClick={() => set('password', genPassword())}
                  style={{
                    padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-2)',
                    background: 'var(--surface-2)', cursor: 'pointer', fontSize: 12,
                    whiteSpace: 'nowrap', color: 'var(--text-2)',
                  }}>
                  Generate
                </button>
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13 }}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── BUAT AKUN MODAL (anggota tanpa akun login) ───────────────────────────────
function BuatAkunModal({ anggota, onClose, onSuccess }) {
  const [form, setForm] = useState({ username: '', password: '', role: 'member' });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim()) { setError('Username wajib diisi'); return; }
    if (form.password.length < 8) { setError('Password minimal 8 karakter'); return; }
    setLoading(true);
    setError('');
    try {
      await api.buatAkunAnggota(anggota.id, { username: form.username.trim().toLowerCase(), password: form.password, role: form.role });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message.replace(/^\d+: /, ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 8px 32px rgba(0,0,0,.22)' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Buat Akun Login</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
          Buat akun untuk <strong>{anggota.nama}</strong> yang belum punya akses login.
        </div>
        {error && <div className="alert alert-red" style={{ marginBottom: 12 }}><span>⚠️</span><div>{error}</div></div>}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Username *</label>
            <input value={form.username} onChange={e => set('username', e.target.value.toLowerCase())} placeholder="username" required />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Password * <span style={{ fontWeight: 400, color: 'var(--text-2)' }}>(min. 8 karakter)</span></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Password awal" style={{ flex: 1 }} required />
              <button type="button" onClick={() => set('password', genPassword())}
                style={{ padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', color: 'var(--text-2)' }}>
                Generate
              </button>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Role</label>
            <select value={form.role} onChange={e => set('role', e.target.value)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13 }}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Membuat...' : 'Buat Akun'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── RESET PASSWORD MODAL ──────────────────────────────────────────────────────
function ResetPwModal({ anggota, onClose, onSuccess }) {
  const [pw, setPw]         = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const [done, setDone]     = useState(null);

  const handleReset = async (e) => {
    e.preventDefault();
    if (!pw.trim()) { setError('Password baru wajib diisi'); return; }
    if (pw.trim().length < 8) { setError('Password minimal 8 karakter'); return; }
    setLoading(true);
    setError('');
    try {
      const res = await api.resetPassword(anggota.id, pw.trim());
      setDone({ username: res.username });
      onSuccess();
    } catch (err) {
      setError(err.message.replace(/^\d+: /, ''));
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}>
        <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,.22)' }}>
          <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--green)', marginBottom: 8 }}>Password berhasil diubah</div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
            Password <strong>{anggota.nama}</strong> (@{done.username}) sudah diperbarui.
          </div>
          <button onClick={onClose} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>Tutup</button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 400, boxShadow: '0 8px 32px rgba(0,0,0,.22)' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Reset Password</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
          Atur password baru untuk <strong>{anggota.nama}</strong> (@{anggota.username || '?'})
        </div>

        {error && (
          <div className="alert alert-red" style={{ marginBottom: 12 }}>
            <span>⚠️</span><div>{error}</div>
          </div>
        )}

        <form onSubmit={handleReset}>
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>
              Password baru * <span style={{ fontWeight: 400, color: 'var(--text-2)' }}>(min. 8 karakter)</span>
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={pw}
                onChange={e => setPw(e.target.value)}
                placeholder="Isi password baru"
                style={{ flex: 1 }}
                autoFocus
              />
              <button type="button"
                onClick={() => setPw(genPassword())}
                style={{
                  padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-2)',
                  background: 'var(--surface-2)', cursor: 'pointer', fontSize: 12,
                  whiteSpace: 'nowrap', color: 'var(--text-2)',
                }}>
                Generate
              </button>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13 }}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>
              {loading ? 'Menyimpan...' : 'Reset Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── KONFIRMASI NONAKTIFKAN ────────────────────────────────────────────────────
function ConfirmNonaktifModal({ anggota, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false);
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 24, width: '100%', maxWidth: 360, boxShadow: '0 8px 32px rgba(0,0,0,.22)' }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Nonaktifkan anggota?</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>
          <strong>{anggota.nama}</strong> akan dinonaktifkan. Akun login juga ikut dinonaktifkan. Data historis tetap tersimpan.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13 }}>
            Batal
          </button>
          <button
            onClick={async () => { setLoading(true); await onConfirm(); }}
            disabled={loading}
            style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {loading ? 'Memproses...' : 'Nonaktifkan'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── HALAMAN UTAMA ─────────────────────────────────────────────────────────────
const labelStyle = { fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 5, color: 'var(--text-2)' };

export default function KelolAnggota() {
  const { showToast } = useToast();
  const [semua, setSemua]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab]         = useState('Semua');
  const [search, setSearch]   = useState('');
  const [showNonaktif, setShowNonaktif] = useState(false);
  const [modal, setModal]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    try {
      const res = await api.getTim(true);
      setSemua(res.data);
    } catch {
      setLoadError('Gagal memuat data anggota');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleTambah = async (form) => {
    try {
      await api.tambahTim(form);
      showToast(`${form.nama} berhasil ditambahkan`);
      load();
    } catch (err) {
      showToast(err.message.replace(/^\d+: /, ''), 'error');
    }
  };

  const handleEdit = async (form) => {
    try {
      await api.updateTim(modal.data.id, form);
      showToast(`Data ${form.nama} berhasil diupdate`);
      load();
    } catch (err) {
      showToast(err.message.replace(/^\d+: /, ''), 'error');
    }
  };

  const handleNonaktifkan = async () => {
    try {
      await api.nonaktifkanTim(modal.data.id);
      showToast(`${modal.data.nama} dinonaktifkan`, 'warning');
      setModal(null);
      load();
    } catch (err) {
      showToast(err.message.replace(/^\d+: /, ''), 'error');
    }
  };

  const handleAktifkan = async (a) => {
    try {
      await api.aktifkanAnggota(a.id);
      showToast(`${a.nama} diaktifkan kembali`);
      load();
    } catch (err) {
      showToast(err.message.replace(/^\d+: /, ''), 'error');
    }
  };

  // Filter
  const filtered = semua.filter(a => {
    if (!showNonaktif && !a.aktif) return false;
    if (tab !== 'Semua' && a.entitas !== tab) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.nama.toLowerCase().includes(q) || (a.username || '').toLowerCase().includes(q) || (a.divisi || '').toLowerCase().includes(q);
    }
    return true;
  });

  const aktifCount = semua.filter(a => a.aktif).length;

  // Hitung per entitas
  const countPerEntitas = ENTITAS_LIST.reduce((acc, e) => {
    acc[e] = semua.filter(a => a.entitas === e && a.aktif).length;
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Kelola Anggota</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
            {aktifCount} anggota aktif · {semua.length} total
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <input type="checkbox" checked={showNonaktif} onChange={e => setShowNonaktif(e.target.checked)} />
            Tampilkan nonaktif
          </label>
          <button className="btn btn-primary" onClick={() => setModal({ type: 'add' })} style={{ fontSize: 13, padding: '7px 14px' }}>
            + Tambah Anggota
          </button>
        </div>
      </div>

      {/* Tabs entitas */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {['Semua', ...ENTITAS_LIST].map(e => {
          const count = e === 'Semua' ? aktifCount : (countPerEntitas[e] || 0);
          const isActive = tab === e;
          const c = ENTITAS_COLOR[e];
          return (
            <button key={e} onClick={() => setTab(e)}
              style={{
                padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: isActive ? 700 : 500,
                border: isActive ? `1px solid ${c ? c.text : 'var(--green)'}` : '1px solid var(--border)',
                background: isActive ? (c ? c.bg : 'rgba(0,214,143,0.1)') : 'var(--surface)',
                color: isActive ? (c ? c.text : 'var(--green)') : 'var(--text-2)',
                cursor: 'pointer', transition: 'all .15s',
              }}>
              {e} {count > 0 && <span style={{ opacity: 0.7 }}>({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama, username, atau divisi..."
          style={{ maxWidth: 360 }}
        />
      </div>

      {loadError && (
        <div className="alert alert-red" style={{ marginBottom: 14 }}><span>⚠️</span><div>{loadError}</div></div>
      )}

      {loading && (
        <SkeletonList count={6} />
      )}

      {/* List */}
      {!loading && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-2)' }}>
              {search ? 'Tidak ada anggota yang cocok.' : 'Belum ada anggota di sini.'}
            </div>
          ) : (
            filtered.map((a, idx) => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                opacity: a.aktif ? 1 : 0.5,
                gap: 10,
              }}>
                {/* Avatar + info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                    background: ENTITAS_COLOR[a.entitas]?.bg || 'var(--surface-2)',
                    color: ENTITAS_COLOR[a.entitas]?.text || 'var(--text-2)',
                    fontWeight: 700, fontSize: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {a.nama.split(' ').map(w => w[0]).slice(0, 2).join('')}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {a.nama}
                      <EntitasBadge entitas={a.entitas || 'Creanimasi Studio'} />
                      {a.role && <RoleBadge role={a.role} />}
                      {!a.aktif && (
                        <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: 'var(--red-light)', color: 'var(--red)' }}>
                          Nonaktif
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                      {a.username ? `@${a.username} · ` : ''}{a.divisi || '—'} · {a.level || '—'}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {a.aktif ? (
                    <>
                      <button onClick={() => setModal({ type: 'edit', data: a })}
                        style={{ padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid var(--border-2)', background: 'var(--surface)', cursor: 'pointer' }}>
                        Edit
                      </button>
                      {a.username ? (
                        <button onClick={() => setModal({ type: 'reset', data: a })}
                          style={{ padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid var(--amber)', background: 'var(--amber-light)', color: 'var(--amber)', cursor: 'pointer' }}>
                          Reset PW
                        </button>
                      ) : (
                        <button onClick={() => setModal({ type: 'buat-akun', data: a })}
                          style={{ padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid #818cf8', background: 'rgba(99,102,241,0.1)', color: '#818cf8', cursor: 'pointer' }}>
                          Buat Akun
                        </button>
                      )}
                      <button onClick={() => setModal({ type: 'nonaktif', data: a })}
                        style={{ padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid #fca5a5', background: 'var(--surface)', color: 'var(--red)', cursor: 'pointer' }}>
                        Nonaktifkan
                      </button>
                    </>
                  ) : (
                    <button onClick={() => handleAktifkan(a)}
                      style={{ padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid var(--green)', background: 'var(--green-light)', color: 'var(--green)', cursor: 'pointer' }}>
                      Aktifkan
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'add' && (
        <AnggotaFormModal onSave={handleTambah} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'edit' && (
        <AnggotaFormModal initial={modal.data} onSave={handleEdit} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'nonaktif' && (
        <ConfirmNonaktifModal anggota={modal.data} onConfirm={handleNonaktifkan} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'reset' && (
        <ResetPwModal
          anggota={modal.data}
          onClose={() => setModal(null)}
          onSuccess={load}
        />
      )}
      {modal?.type === 'buat-akun' && (
        <BuatAkunModal
          anggota={modal.data}
          onClose={() => setModal(null)}
          onSuccess={() => { showToast(`Akun ${modal.data.nama} berhasil dibuat`); load(); }}
        />
      )}
    </div>
  );
}
