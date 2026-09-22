import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { SkeletonList } from '../components/Skeleton';
import { invalidateTimCache } from '../hooks/useTim';

const ENTITAS_LIST = ['Creanimasi Studio', 'Flip Studio', 'Creillustra', 'Shuyou'];
const DIVISI_OPTIONS = ['Admin', 'PM', 'Illustrator', 'Rigger', '3D Modeler', 'Developer', 'Marketing', 'Desainer'];
const LEVEL_OPTIONS  = ['Magang / Probation', 'Junior', 'Senior', 'Admin (L4)', 'Secondline', 'Koordinator'];
const TIPE_OPTIONS   = ['Rising Star', 'High Potential', 'Silent Expert', 'At Risk', ''];

// Warna per role_key — dipakai ulang dari palet yang sudah ada di codebase
// (persis token warna ENTITAS_COLOR di bekas KelolAnggota.jsx), bukan warna baru.
const ROLE_COLORS = {
  super_admin:  { bg: 'rgba(0,214,143,0.12)',  text: 'var(--green)' },
  founder:      { bg: 'rgba(255,184,48,0.12)', text: 'var(--amber)' },
  mentor:       { bg: 'rgba(99,102,241,0.12)', text: '#818cf8' },
  admin_market: { bg: 'rgba(236,72,153,0.12)', text: '#f472b6' },
  pm:           { bg: 'rgba(251,146,60,0.12)', text: '#fb923c' },
  anggota:      { bg: 'var(--surface-2)',      text: 'var(--text-3)' },
};

// Deskripsi singkat per role — diringkas dari PRD bagian 4, ditampilkan di
// Tab "Hak Akses/Role" supaya admin tidak menebak-nebak beda tiap role.
const ROLE_DESCRIPTIONS = {
  super_admin:  'Akses penuh ke semua halaman, termasuk Master Data sendiri.',
  founder:      'Akses tinggi, terutama ke reporting/strategis.',
  mentor:       'Akses ke data pembinaan/evaluasi anggota yang dibimbing.',
  admin_market: 'Akses ke halaman terkait pemasaran/penjualan (ads, profit, dll).',
  pm:           'Akses ke SOP, KPI, journaling, dan koordinasi tugas tim.',
  anggota:      'Akses standar: profil sendiri, journaling, KPI pribadi.',
};

// Pengelompokan halaman untuk matrix Tab 2 — mengikuti section yang sama
// persis seperti di Sidebar (src/components/Sidebar.jsx NAV_ITEMS), supaya
// urutan & pengelompokan konsisten dengan menu yang dilihat user sehari-hari.
// "Lainnya" menampung halaman yang tidak punya entri menu di Sidebar sama sekali.
const SECTION_GROUPS = [
  { label: 'Guild', keys: ['rpg-character', 'rpg-quests', 'rpg-guild', 'rpg-achievements', 'rpg-pantau', 'rpg-admin', 'rpg-analytics'] },
  { label: 'Tim', keys: ['tim', 'master-data', 'absensi', 'timeline'] },
  { label: 'Aksi Cepat', keys: ['laporan-admin'] },
  { label: 'Program', keys: ['workshop', 'aktivitas-tim', 'reward', 'kader'] },
  { label: 'Laporan', keys: ['laporan-harian', 'laporan-mentor', 'laporan-bulanan'] },
  { label: 'Marketing', keys: ['ads-performance', 'laporan-profit'] },
  { label: 'Lainnya', keys: ['jurnal-admin', 'sesi-1on1', 'friday-win', 'tim-kelola-legacy', 'ai-assistant', 'kalender'] },
];

const labelStyle = { fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 5, color: 'var(--text-2)' };

function genPassword() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 5).toUpperCase();
}

function formatTanggalLahir(d) {
  if (!d) return '';
  const dt = new Date(d);
  return dt.toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
}

function ModalShell({ maxWidth = 440, onClose, children }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', borderRadius: 14, padding: 24, width: '100%', maxWidth, boxShadow: '0 8px 32px rgba(0,0,0,.22)', maxHeight: '90vh', overflowY: 'auto' }}>
        {children}
      </div>
    </div>
  );
}

function RoleBadge({ role_nama, role_key }) {
  const c = ROLE_COLORS[role_key] || ROLE_COLORS.anggota;
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20, background: c.bg, color: c.text }}>
      {role_nama || '—'}
    </span>
  );
}

// ── FORM TAMBAH / EDIT ANGGOTA ────────────────────────────────────────────────
// Mode tambah: bikin tim + akun sekaligus (username/password/role wajib).
// Mode edit: fokus data HR saja — role diubah lewat aksi "Ubah Role" terpisah
// (butuh konfirmasi eksplisit, lihat UbahRoleModal), bukan dropdown biasa di sini.
function AnggotaFormModal({ initial, roles, onSave, onClose }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(isEdit ? {
    nama: initial.nama, entitas: initial.entitas || 'Creanimasi Studio',
    divisi: initial.divisi || '', level: initial.level || '', tipe: initial.tipe || '',
    tanggal_lahir: initial.tanggal_lahir ? initial.tanggal_lahir.slice(0, 10) : '',
    username: initial.username || '', email: initial.email || '',
  } : {
    nama: '', entitas: 'Creanimasi Studio', divisi: '', level: '', tipe: '',
    tanggal_lahir: '', username: '', email: '', password: '', role_id: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nama.trim() || !form.divisi || !form.entitas) { setError('Nama, divisi, dan entitas wajib diisi'); return; }
    if (!isEdit) {
      if (!form.username.trim()) { setError('Username wajib diisi'); return; }
      if (!form.password || form.password.length < 8) { setError('Password minimal 8 karakter'); return; }
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
    <ModalShell maxWidth={480} onClose={onClose}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 18 }}>{isEdit ? 'Edit Anggota' : 'Tambah Anggota Baru'}</div>
      {error && <div className="alert alert-red" style={{ marginBottom: 14 }}><span>⚠️</span><div>{error}</div></div>}
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Nama lengkap *</label>
          <input value={form.nama} onChange={e => set('nama', e.target.value)} placeholder="Nama lengkap" required />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Entitas *</label>
          <select value={form.entitas} onChange={e => set('entitas', e.target.value)} required>
            {ENTITAS_LIST.map(e => <option key={e} value={e}>{e}</option>)}
          </select>
        </div>
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
          <div>
            <label style={labelStyle}>Tipe</label>
            <select value={form.tipe} onChange={e => set('tipe', e.target.value)}>
              <option value="">— Pilih —</option>
              {TIPE_OPTIONS.filter(Boolean).map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div>
            <label style={labelStyle}>Tanggal Lahir</label>
            <input type="date" value={form.tanggal_lahir} onChange={e => set('tanggal_lahir', e.target.value)} />
          </div>
        </div>
        {!isEdit && (
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Role akun</label>
            <select value={form.role_id} onChange={e => set('role_id', e.target.value)}>
              <option value="">— Pakai default (Anggota) —</option>
              {roles.map(r => <option key={r.id} value={r.id}>{r.nama}</option>)}
            </select>
          </div>
        )}
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Username {!isEdit && '*'}</label>
          <input value={form.username} onChange={e => set('username', e.target.value.toLowerCase())} placeholder="username (huruf kecil)" required={!isEdit} />
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Email <span style={{ fontWeight: 400 }}>(opsional)</span></label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} placeholder="nama@email.com" />
        </div>
        {!isEdit && (
          <div style={{ marginBottom: 16 }}>
            <label style={labelStyle}>Password * <span style={{ fontWeight: 400, color: 'var(--text-2)' }}>(min. 8 karakter)</span></label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input type="text" value={form.password} onChange={e => set('password', e.target.value)} placeholder="Password awal" style={{ flex: 1 }} required minLength={8} />
              <button type="button" onClick={() => set('password', genPassword())}
                style={{ padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', color: 'var(--text-2)' }}>
                Generate
              </button>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13 }}>Batal</button>
          <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>{loading ? 'Menyimpan...' : 'Simpan'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

// ── BUAT AKUN (anggota tanpa akun login) ──────────────────────────────────────
function BuatAkunModal({ anggota, roles, onClose, onSuccess }) {
  const [form, setForm] = useState({ username: '', password: '', role_id: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.username.trim()) { setError('Username wajib diisi'); return; }
    if (form.password.length < 8) { setError('Password minimal 8 karakter'); return; }
    setLoading(true); setError('');
    try {
      await api.buatAkunAnggota(anggota.id, { username: form.username.trim().toLowerCase(), password: form.password, role_id: form.role_id || undefined });
      onSuccess();
      onClose();
    } catch (err) {
      setError(err.message.replace(/^\d+: /, ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell maxWidth={400} onClose={onClose}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Buat Akun Login</div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>Buat akun untuk <strong>{anggota.nama}</strong> yang belum punya akses login.</div>
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
          <select value={form.role_id} onChange={e => set('role_id', e.target.value)}>
            <option value="">— Pakai default (Anggota) —</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.nama}</option>)}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13 }}>Batal</button>
          <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>{loading ? 'Membuat...' : 'Buat Akun'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

// ── UBAH ROLE (aksi terpisah, butuh konfirmasi eksplisit) ─────────────────────
function UbahRoleModal({ anggota, roles, onSave, onClose }) {
  const currentRole = roles.find(r => r.id === anggota.role_id);
  const [roleId, setRoleId] = useState(anggota.role_id || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const targetRole = roles.find(r => String(r.id) === String(roleId));
  const touchesProtected = currentRole?.is_protected || targetRole?.is_protected;

  const handleConfirm = async () => {
    setLoading(true); setError('');
    try { await onSave(roleId); onClose(); }
    catch (err) { setError(err.message.replace(/^\d+: /, '')); setLoading(false); }
  };

  return (
    <ModalShell maxWidth={400} onClose={onClose}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Ubah Role</div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16, lineHeight: 1.6 }}>
        Role <strong>{anggota.nama}</strong> akan diubah dari <RoleBadge role_nama={currentRole?.nama} role_key={currentRole?.key} /> menjadi:
      </div>
      <select value={roleId} onChange={e => setRoleId(e.target.value)} style={{ marginBottom: 12 }}>
        {roles.map(r => <option key={r.id} value={r.id}>{r.nama}</option>)}
      </select>
      {touchesProtected && (
        <div style={{ marginBottom: 14, padding: '8px 12px', borderRadius: 8, background: 'rgba(255,184,48,0.1)', border: '1px solid rgba(255,184,48,0.25)', fontSize: 12, color: 'var(--amber)' }}>
          ⚠ Perubahan ini menyangkut role <strong>Super Admin</strong> (akses penuh ke semua halaman). Sistem akan menolak kalau ini bikin tidak ada Super Admin aktif tersisa.
        </div>
      )}
      {error && <div className="alert alert-red" style={{ marginBottom: 12 }}><span>⚠️</span><div>{error}</div></div>}
      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
        <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer', fontWeight: 600 }}>Batal</button>
        <button onClick={handleConfirm} disabled={loading || String(roleId) === String(anggota.role_id)} style={{
          padding: '8px 16px', borderRadius: 8, border: 'none',
          background: touchesProtected ? 'var(--amber)' : 'var(--green)', color: touchesProtected ? '#000' : '#fff',
          fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: loading ? .7 : 1,
        }}>
          {loading ? 'Menyimpan...' : `Jadikan ${targetRole?.nama || ''}`}
        </button>
      </div>
    </ModalShell>
  );
}

function ResetPwModal({ anggota, onClose, onSuccess }) {
  const [pw, setPw] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const handleReset = async (e) => {
    e.preventDefault();
    if (pw.trim().length < 8) { setError('Password minimal 8 karakter'); return; }
    setLoading(true); setError('');
    try { await api.resetPassword(anggota.id, pw.trim()); onSuccess(); onClose(); }
    catch (err) { setError(err.message.replace(/^\d+: /, '')); }
    finally { setLoading(false); }
  };
  return (
    <ModalShell maxWidth={400} onClose={onClose}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 6 }}>Reset Password</div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>Atur password baru untuk <strong>{anggota.nama}</strong> (@{anggota.username || '?'})</div>
      {error && <div className="alert alert-red" style={{ marginBottom: 12 }}><span>⚠️</span><div>{error}</div></div>}
      <form onSubmit={handleReset}>
        <div style={{ marginBottom: 16 }}>
          <label style={labelStyle}>Password baru * <span style={{ fontWeight: 400 }}>(min. 8 karakter)</span></label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input type="text" value={pw} onChange={e => setPw(e.target.value)} placeholder="Isi password baru" style={{ flex: 1 }} autoFocus />
            <button type="button" onClick={() => setPw(genPassword())}
              style={{ padding: '0 12px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface-2)', cursor: 'pointer', fontSize: 12, whiteSpace: 'nowrap', color: 'var(--text-2)' }}>
              Generate
            </button>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button type="button" onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13 }}>Batal</button>
          <button type="submit" className="btn btn-primary" style={{ flex: 1, justifyContent: 'center' }} disabled={loading}>{loading ? 'Menyimpan...' : 'Reset Password'}</button>
        </div>
      </form>
    </ModalShell>
  );
}

function ConfirmNonaktifModal({ anggota, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  return (
    <ModalShell maxWidth={360} onClose={onClose}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Nonaktifkan anggota?</div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
        <strong>{anggota.nama}</strong> akan dinonaktifkan. Akun login juga ikut dinonaktifkan. Data historis tetap tersimpan.
      </div>
      {error && <div className="alert alert-red" style={{ marginBottom: 12 }}><span>⚠️</span><div>{error}</div></div>}
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13 }}>Batal</button>
        <button
          onClick={async () => { setLoading(true); setError(''); try { await onConfirm(); } catch (err) { setError(err.message.replace(/^\d+: /, '')); setLoading(false); } }}
          disabled={loading}
          style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background:'var(--red-solid)', color:'#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
          {loading ? 'Memproses...' : 'Nonaktifkan'}
        </button>
      </div>
    </ModalShell>
  );
}

// ── TAB 1: MANAJEMEN USER ─────────────────────────────────────────────────────
function ManajemenUserTab({ roles }) {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [semua, setSemua] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('Semua');
  const [filterRole, setFilterRole] = useState('Semua');
  const [search, setSearch] = useState('');
  const [showNonaktif, setShowNonaktif] = useState(false);
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    invalidateTimCache(); // load dipanggil setelah tiap perubahan — komponen lain ikut dapat data terbaru
    try {
      // Akun tanpa baris anggota (mis. Super Admin pemilik) diambil terpisah; kalau gagal, daftar anggota tetap tampil.
      const [res, sistem] = await Promise.all([api.getTim(true), api.getAkunTanpaTim().catch(() => ({ data: [] }))]);
      const akunSistem = (sistem.data || []).map(u => ({
        id: `akun-${u.id}`, user_id: u.id, akunSistem: true, nama: u.nama, username: u.username, email: u.email,
        role_id: u.role_id, role_key: u.role_key, role_nama: u.role_nama, aktif: u.aktif,
        divisi: null, level: null, entitas: null, tanggal_lahir: null,
      }));
      setSemua([...akunSistem, ...res.data]);
    }
    catch { showToast('Gagal memuat data anggota', 'error'); }
    finally { setLoading(false); }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const handleTambah = async (form) => {
    try { await api.tambahTim(form); showToast(`${form.nama} berhasil ditambahkan`); load(); }
    catch (err) { showToast(err.message.replace(/^\d+: /, ''), 'error'); throw err; }
  };
  const handleEdit = async (form) => {
    try { await api.updateTim(modal.data.id, form); showToast(`Data ${form.nama} berhasil diupdate`); load(); }
    catch (err) { showToast(err.message.replace(/^\d+: /, ''), 'error'); throw err; }
  };
  const handleUbahRole = async (roleId) => {
    const a = modal.data;
    await api.updateTim(a.id, { nama: a.nama, divisi: a.divisi, entitas: a.entitas || 'Creanimasi Studio', level: a.level, tipe: a.tipe, role_id: roleId });
    showToast(`Role ${a.nama} berhasil diubah`);
    load();
  };
  const handleNonaktifkan = async () => {
    await api.nonaktifkanTim(modal.data.id);
    showToast(`${modal.data.nama} dinonaktifkan`, 'warning');
    setModal(null);
    load();
  };
  const handleAktifkan = async (a) => {
    try { await api.aktifkanAnggota(a.id); showToast(`${a.nama} diaktifkan kembali`); load(); }
    catch (err) { showToast(err.message.replace(/^\d+: /, ''), 'error'); }
  };

  const filtered = semua.filter(a => {
    if (!showNonaktif && !a.aktif) return false;
    if (tab !== 'Semua' && a.entitas !== tab) return false;
    if (filterRole !== 'Semua' && a.role_key !== filterRole) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.nama.toLowerCase().includes(q) || (a.username || '').toLowerCase().includes(q) || (a.divisi || '').toLowerCase().includes(q) || (a.email || '').toLowerCase().includes(q);
    }
    return true;
  });

  const aktifCount = semua.filter(a => a.aktif).length;
  const superAdminCount = semua.filter(a => a.aktif && a.role_key === 'super_admin').length;
  const tanpaAkunCount = semua.filter(a => a.aktif && !a.username).length;
  const nonaktifCount = semua.filter(a => !a.aktif).length;

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Aktif', value: aktifCount, color: 'var(--green)' },
          { label: 'Super Admin', value: superAdminCount, color: 'var(--green)' },
          { label: 'Tanpa Akun', value: tanpaAkunCount, color: 'var(--red)' },
          { label: 'Nonaktif', value: nonaktifCount, color: 'var(--text-3)' },
        ].map(s => (
          <div key={s.label} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{filtered.length} ditampilkan dari {semua.length} total</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <input type="checkbox" checked={showNonaktif} onChange={e => setShowNonaktif(e.target.checked)} />
            Tampilkan nonaktif
          </label>
          <button className="btn btn-primary" onClick={() => setModal({ type: 'add' })} style={{ fontSize: 13, padding: '7px 14px' }}>+ Tambah Anggota</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
        {['Semua', ...ENTITAS_LIST].map(e => (
          <button key={e} onClick={() => setTab(e)} style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: tab === e ? 700 : 500,
            border: tab === e ? '1px solid var(--green)' : '1px solid var(--border)',
            background: tab === e ? 'rgba(0,214,143,0.1)' : 'var(--surface)',
            color: tab === e ? 'var(--green)' : 'var(--text-2)', cursor: 'pointer',
          }}>{e}</button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {[{ key: 'Semua', nama: 'Semua Role' }, ...roles].map(r => {
          const c = ROLE_COLORS[r.key] || ROLE_COLORS.anggota;
          const isActive = filterRole === (r.key === 'Semua' ? 'Semua' : r.key);
          return (
            <button key={r.key || r.id} onClick={() => setFilterRole(r.key === 'Semua' ? 'Semua' : r.key)} style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: isActive ? 700 : 500,
              border: isActive ? `1px solid ${c.text}` : '1px solid var(--border)',
              background: isActive ? c.bg : 'var(--surface)',
              color: isActive ? c.text : 'var(--text-2)', cursor: 'pointer',
            }}>{r.nama}</button>
          );
        })}
      </div>

      <div style={{ marginBottom: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama, username, divisi, atau email..." style={{ maxWidth: 360 }} />
      </div>

      {loading && <SkeletonList count={6} />}

      {!loading && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-2)' }}>Tidak ada anggota yang cocok.</div>
          ) : filtered.map((a, idx) => {
            const isSelf = a.user_id === currentUser?.id;
            const detailLine = [
              a.tanggal_lahir ? `🎂 ${formatTanggalLahir(a.tanggal_lahir)}` : null,
              a.email || null,
            ].filter(Boolean).join(' · ');
            return (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px',
                borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                opacity: a.aktif ? 1 : 0.5, gap: 10,
                background: isSelf ? 'rgba(0,214,143,0.03)' : 'transparent',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  <div style={{ width: 40, height: 40, borderRadius: 10, flexShrink: 0, background: 'var(--surface-2)', color: 'var(--text-2)', fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {a.nama.split(' ').map(w => w[0]).slice(0, 2).join('')}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      {a.nama}
                      {isSelf && <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700 }}>(kamu)</span>}
                      {a.username && <RoleBadge role_nama={a.role_nama} role_key={a.role_key} />}
                      {!a.aktif && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: 'var(--red-light)', color: 'var(--red)' }}>Nonaktif</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                      {a.username ? `@${a.username} · ` : ''}
                      {a.akunSistem ? 'Akun sistem · tidak tertaut ke data anggota tim' : `${a.divisi || '—'} · ${a.level || '—'}`}
                    </div>
                    {detailLine && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{detailLine}</div>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {a.akunSistem ? (
                    <span title="Ubah, reset password, dan nonaktifkan hanya tersedia untuk akun yang tertaut ke data anggota tim" style={{ fontSize: 11, color: 'var(--text-3)' }}>Hanya lihat</span>
                  ) : a.aktif ? (
                    <>
                      <button onClick={() => setModal({ type: 'edit', data: a })} style={{ padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid var(--border-2)', background: 'var(--surface)', cursor: 'pointer' }}>Edit</button>
                      {a.username ? (
                        <>
                          <button onClick={() => setModal({ type: 'ubah-role', data: a })} style={{ padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid #818cf8', background: 'rgba(99,102,241,0.08)', color: '#818cf8', cursor: 'pointer' }}>Ubah Role</button>
                          <button onClick={() => setModal({ type: 'reset', data: a })} style={{ padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid var(--amber)', background: 'var(--amber-light)', color: 'var(--amber)', cursor: 'pointer' }}>Reset PW</button>
                        </>
                      ) : (
                        <button onClick={() => setModal({ type: 'buat-akun', data: a })} style={{ padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid #818cf8', background: 'rgba(99,102,241,0.1)', color: '#818cf8', cursor: 'pointer' }}>Buat Akun</button>
                      )}
                      {!isSelf && (
                        <button onClick={() => setModal({ type: 'nonaktif', data: a })} style={{ padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid #fca5a5', background: 'var(--surface)', color: 'var(--red)', cursor: 'pointer' }}>Nonaktifkan</button>
                      )}
                    </>
                  ) : (
                    <button onClick={() => handleAktifkan(a)} style={{ padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid var(--green)', background: 'var(--green-light)', color: 'var(--green)', cursor: 'pointer' }}>Aktifkan</button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {modal?.type === 'add' && <AnggotaFormModal roles={roles} onSave={handleTambah} onClose={() => setModal(null)} />}
      {modal?.type === 'edit' && <AnggotaFormModal roles={roles} initial={modal.data} onSave={handleEdit} onClose={() => setModal(null)} />}
      {modal?.type === 'ubah-role' && <UbahRoleModal anggota={modal.data} roles={roles} onSave={handleUbahRole} onClose={() => setModal(null)} />}
      {modal?.type === 'buat-akun' && <BuatAkunModal anggota={modal.data} roles={roles} onClose={() => setModal(null)} onSuccess={load} />}
      {modal?.type === 'nonaktif' && <ConfirmNonaktifModal anggota={modal.data} onConfirm={handleNonaktifkan} onClose={() => setModal(null)} />}
      {modal?.type === 'reset' && <ResetPwModal anggota={modal.data} onClose={() => setModal(null)} onSuccess={load} />}
    </div>
  );
}

// Konfirmasi kecil sebelum membuang perubahan matriks yang belum disimpan —
// dipakai saat pindah role atau klik "Semua role" ketika ada perubahan pending.
function ConfirmSwitchModal({ onConfirm, onClose }) {
  return (
    <ModalShell maxWidth={360} onClose={onClose}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Ada perubahan belum disimpan</div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 16 }}>
        Centang/uncheck yang barusan kamu ubah belum di-klik "Simpan Akses" — kalau lanjut, perubahan itu hilang.
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={onClose} style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border-2)', background: 'var(--surface)', cursor: 'pointer', fontSize: 13 }}>Batal</button>
        <button onClick={onConfirm} style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background:'var(--red-solid)', color:'#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Lanjut tanpa simpan</button>
      </div>
    </ModalShell>
  );
}

// ── TAB 2: HAK AKSES / ROLE ────────────────────────────────────────────────────
function RoleAccessTab({ roles, onRolesChanged }) {
  const { showToast } = useToast();
  const [selectedRole, setSelectedRole] = useState(null);
  const [matrix, setMatrix] = useState([]);
  const [savedMatrix, setSavedMatrix] = useState([]);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [saving, setSaving] = useState(false);
  // Role tujuan yang ditunda karena ada perubahan belum disimpan; 'BACK' = kembali
  // ke grid overview. `undefined` = tidak ada apa-apa yang ditunda (modal tersembunyi).
  const [pendingNav, setPendingNav] = useState(undefined);

  const isDirty = JSON.stringify(matrix) !== JSON.stringify(savedMatrix);

  const openRole = async (role) => {
    setSelectedRole(role);
    setLoadingMatrix(true);
    try {
      const res = await api.getRolePageAccess(role.id);
      setMatrix(res.data);
      setSavedMatrix(res.data);
    } catch { showToast('Gagal memuat matriks akses', 'error'); }
    finally { setLoadingMatrix(false); }
  };

  // target: objek role (pindah ke role lain), atau null (kembali ke overview)
  const requestSwitch = (target) => {
    if (isDirty) { setPendingNav(target === null ? 'BACK' : target); return; }
    if (target) openRole(target); else setSelectedRole(null);
  };
  const confirmSwitch = () => {
    const t = pendingNav;
    setPendingNav(undefined);
    if (t === 'BACK') setSelectedRole(null); else openRole(t);
  };

  const toggle = (page_key) => {
    if (selectedRole?.is_protected && page_key === 'master-data') return; // dikunci
    setMatrix(m => m.map(x => x.page_key === page_key ? { ...x, can_access: !x.can_access } : x));
  };

  const setAll = (value) => {
    setMatrix(m => m.map(x => (selectedRole?.is_protected && x.page_key === 'master-data') ? x : { ...x, can_access: value }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.saveRolePageAccess(selectedRole.id, matrix.map(({ page_key, can_access }) => ({ page_key, can_access })));
      setSavedMatrix(matrix);
      showToast(`Akses role ${selectedRole.nama} disimpan`);
      onRolesChanged?.();
    } catch (err) {
      showToast(err.message.replace(/^\d+: /, ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  // Kelompokkan matrix sesuai SECTION_GROUPS; halaman yang tidak masuk daftar
  // manapun ikut ditampilkan di grup terakhir yang cocok (fallback aman).
  // Halaman yang belum terdaftar di SECTION_GROUPS ditaruh di grup "Lainnya" — tanpa ini halaman baru
  // diam-diam tak terlihat di matriks (tapi tetap terhitung di "X dari Y dipilih").
  const dikenal = new Set(SECTION_GROUPS.flatMap(g => g.keys));
  const belumTergrup = matrix.filter(m => !dikenal.has(m.page_key));
  const grouped = SECTION_GROUPS.map(g => ({
    label: g.label,
    items: [
      ...g.keys.map(k => matrix.find(m => m.page_key === k)).filter(Boolean),
      ...(g.label === 'Lainnya' ? belumTergrup : []),
    ],
  })).filter(g => g.items.length > 0);
  const checkedCount = matrix.filter(m => m.can_access).length;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selectedRole ? '220px 1fr' : '1fr', gap: 16 }}>
      <div style={{ display: 'grid', gap: 8, alignContent: 'start', gridTemplateColumns: selectedRole ? '1fr' : 'repeat(auto-fit, minmax(200px, 1fr))' }}>
        {roles.map(r => {
          const c = ROLE_COLORS[r.key] || ROLE_COLORS.anggota;
          const active = selectedRole?.id === r.id;
          return (
            <div key={r.id} onClick={() => requestSwitch(r)} style={{
              padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
              border: active ? `1px solid ${c.text}` : '1px solid var(--border)',
              background: active ? c.bg : 'var(--surface)',
            }}>
              <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6, color: active ? c.text : undefined }}>
                {r.nama}
                {r.is_protected && <span title="Role protected — tidak bisa dihapus akses Master Data-nya">🔒</span>}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{r.jumlah_halaman} halaman · {r.jumlah_pengguna || 0} pengguna</div>
              {!selectedRole && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6, lineHeight: 1.4 }}>{ROLE_DESCRIPTIONS[r.key]}</div>}
            </div>
          );
        })}
      </div>

      {!selectedRole && (
        <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '4px 2px' }}>
          Pilih role di kiri untuk atur akses halamannya.
        </div>
      )}

      {selectedRole && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
            <div>
              <button onClick={() => requestSwitch(null)} style={{
                border: 'none', background: 'none', color: 'var(--text-3)', fontSize: 11, cursor: 'pointer', padding: 0, marginBottom: 6,
              }}>← Semua role</button>
              <div style={{ fontWeight: 700, fontSize: 14 }}>Akses halaman — {selectedRole.nama}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{ROLE_DESCRIPTIONS[selectedRole.key]}</div>
            </div>
            {!loadingMatrix && (
              <div style={{ display: 'flex', gap: 6 }}>
                <button onClick={() => setAll(true)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer' }}>Centang semua</button>
                <button onClick={() => setAll(false)} style={{ padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, border: '1px solid var(--border-2)', background: 'var(--surface-2)', color: 'var(--text-2)', cursor: 'pointer' }}>Kosongkan semua</button>
              </div>
            )}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 14 }}>
            Halaman baseline (Dashboard, Profil, Modul, dst) otomatis bisa diakses semua role, tidak perlu diatur di sini.
            {!loadingMatrix && <> · <strong>{checkedCount} dari {matrix.length}</strong> halaman dipilih.</>}
          </div>
          {loadingMatrix ? <SkeletonList count={5} /> : (
            <>
              {grouped.map(g => (
                <div key={g.label} style={{ marginBottom: 16 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6 }}>{g.label}</div>
                  <div style={{ display: 'grid', gap: 6 }}>
                    {g.items.map(m => {
                      const locked = selectedRole.is_protected && m.page_key === 'master-data';
                      return (
                        <label key={m.page_key} style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 8,
                          background: 'var(--surface-2)', cursor: locked ? 'not-allowed' : 'pointer', opacity: locked ? 0.8 : 1,
                        }}>
                          <input type="checkbox" checked={m.can_access} disabled={locked} onChange={() => toggle(m.page_key)} />
                          <span style={{ fontSize: 13 }}>{m.nama}</span>
                          {locked && <span style={{ fontSize: 10, color: 'var(--text-3)', marginLeft: 'auto' }}>🔒 wajib untuk Super Admin</span>}
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button className="btn btn-primary" onClick={save} disabled={saving || !isDirty}>{saving ? 'Menyimpan...' : 'Simpan Akses'}</button>
                {isDirty && !saving && <span style={{ fontSize: 11, color: 'var(--amber)' }}>Ada perubahan belum disimpan</span>}
              </div>
            </>
          )}
        </div>
      )}

      {pendingNav !== undefined && <ConfirmSwitchModal onConfirm={confirmSwitch} onClose={() => setPendingNav(undefined)} />}
    </div>
  );
}

// ── HALAMAN UTAMA ─────────────────────────────────────────────────────────────
export default function MasterData() {
  const [tab, setTab] = useState('user');
  const [roles, setRoles] = useState([]);

  const loadRoles = useCallback(() => { api.getRoles().then(res => setRoles(res.data)).catch(() => {}); }, []);
  useEffect(() => { loadRoles(); }, [loadRoles]);

  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>🗂️ Master Data</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>Kelola akun login, role, dan hak akses tiap halaman</div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 20, borderBottom: '1px solid var(--border)' }}>
        {[{ key: 'user', label: 'Manajemen User' }, { key: 'akses', label: 'Hak Akses / Role' }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            border: 'none', background: 'none',
            color: tab === t.key ? 'var(--green)' : 'var(--text-3)',
            borderBottom: tab === t.key ? '2px solid var(--green)' : '2px solid transparent',
          }}>{t.label}</button>
        ))}
      </div>

      {tab === 'user' && <ManajemenUserTab roles={roles} />}
      {tab === 'akses' && <RoleAccessTab roles={roles} onRolesChanged={loadRoles} />}
    </div>
  );
}
