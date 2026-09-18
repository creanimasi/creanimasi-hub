import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';
import { SkeletonList } from '../components/Skeleton';

const ENTITAS_LIST = ['Creanimasi Studio', 'Flip Studio', 'Creillustra', 'Shuyou'];
const DIVISI_OPTIONS = ['Admin', 'PM', 'Illustrator', 'Rigger', '3D Modeler', 'Developer', 'Marketing', 'Desainer'];
const LEVEL_OPTIONS  = ['Magang / Probation', 'Junior', 'Senior', 'Admin (L4)', 'Secondline', 'Koordinator'];
const TIPE_OPTIONS   = ['Rising Star', 'High Potential', 'Silent Expert', 'At Risk', ''];

const labelStyle = { fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 5, color: 'var(--text-2)' };

function genPassword() {
  return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 5).toUpperCase();
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

function RoleBadge({ role_nama, is_protected }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, padding: '2px 7px', borderRadius: 20,
      background: is_protected ? 'rgba(0,214,143,0.12)' : 'var(--surface-2)',
      color: is_protected ? 'var(--green)' : 'var(--text-3)',
    }}>
      {role_nama || '—'}
    </span>
  );
}

// ── FORM TAMBAH / EDIT ANGGOTA + AKUN ─────────────────────────────────────────
function AnggotaFormModal({ initial, roles, onSave, onClose }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(isEdit ? {
    nama: initial.nama, entitas: initial.entitas || 'Creanimasi Studio',
    divisi: initial.divisi || '', level: initial.level || '', tipe: initial.tipe || '',
    tanggal_lahir: initial.tanggal_lahir ? initial.tanggal_lahir.slice(0, 10) : '',
    username: initial.username || '', email: initial.email || '',
    role_id: initial.role_id || '',
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
    if (!form.username.trim()) { setError('Username wajib diisi'); return; }
    if (!isEdit && (!form.password || form.password.length < 8)) { setError('Password minimal 8 karakter'); return; }
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
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Role akun</label>
          <select value={form.role_id} onChange={e => set('role_id', e.target.value)}>
            <option value="">— Pakai default (Anggota) —</option>
            {roles.map(r => <option key={r.id} value={r.id}>{r.nama}</option>)}
          </select>
        </div>
        <div style={{ marginBottom: 12 }}>
          <label style={labelStyle}>Username *</label>
          <input value={form.username} onChange={e => set('username', e.target.value.toLowerCase())} placeholder="username (huruf kecil)" required />
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
          style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none', background: 'var(--red)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
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
  const [search, setSearch] = useState('');
  const [showNonaktif, setShowNonaktif] = useState(false);
  const [modal, setModal] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try { const res = await api.getTim(true); setSemua(res.data); }
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
    if (search) {
      const q = search.toLowerCase();
      return a.nama.toLowerCase().includes(q) || (a.username || '').toLowerCase().includes(q) || (a.divisi || '').toLowerCase().includes(q);
    }
    return true;
  });

  const aktifCount = semua.filter(a => a.aktif).length;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text-2)' }}>{aktifCount} anggota aktif · {semua.length} total</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <input type="checkbox" checked={showNonaktif} onChange={e => setShowNonaktif(e.target.checked)} />
            Tampilkan nonaktif
          </label>
          <button className="btn btn-primary" onClick={() => setModal({ type: 'add' })} style={{ fontSize: 13, padding: '7px 14px' }}>+ Tambah Anggota</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {['Semua', ...ENTITAS_LIST].map(e => (
          <button key={e} onClick={() => setTab(e)} style={{
            padding: '5px 12px', borderRadius: 20, fontSize: 12, fontWeight: tab === e ? 700 : 500,
            border: tab === e ? '1px solid var(--green)' : '1px solid var(--border)',
            background: tab === e ? 'rgba(0,214,143,0.1)' : 'var(--surface)',
            color: tab === e ? 'var(--green)' : 'var(--text-2)', cursor: 'pointer',
          }}>{e}</button>
        ))}
      </div>

      <div style={{ marginBottom: 14 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama, username, atau divisi..." style={{ maxWidth: 360 }} />
      </div>

      {loading && <SkeletonList count={6} />}

      {!loading && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-2)' }}>Tidak ada anggota yang cocok.</div>
          ) : filtered.map((a, idx) => {
            const isSelf = a.user_id === currentUser?.id;
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
                      {a.username && <RoleBadge role_nama={a.role_nama} is_protected={a.role_key === 'super_admin'} />}
                      {!a.aktif && <span style={{ fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10, background: 'var(--red-light)', color: 'var(--red)' }}>Nonaktif</span>}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                      {a.username ? `@${a.username} · ` : ''}{a.divisi || '—'} · {a.level || '—'}
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {a.aktif ? (
                    <>
                      <button onClick={() => setModal({ type: 'edit', data: a })} style={{ padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid var(--border-2)', background: 'var(--surface)', cursor: 'pointer' }}>Edit</button>
                      {a.username && (
                        <button onClick={() => setModal({ type: 'reset', data: a })} style={{ padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500, border: '1px solid var(--amber)', background: 'var(--amber-light)', color: 'var(--amber)', cursor: 'pointer' }}>Reset PW</button>
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
      {modal?.type === 'nonaktif' && <ConfirmNonaktifModal anggota={modal.data} onConfirm={handleNonaktifkan} onClose={() => setModal(null)} />}
      {modal?.type === 'reset' && <ResetPwModal anggota={modal.data} onClose={() => setModal(null)} onSuccess={load} />}
    </div>
  );
}

// ── TAB 2: HAK AKSES / ROLE ────────────────────────────────────────────────────
function RoleAccessTab({ roles, onRolesChanged }) {
  const { showToast } = useToast();
  const [selectedRole, setSelectedRole] = useState(null);
  const [matrix, setMatrix] = useState([]);
  const [loadingMatrix, setLoadingMatrix] = useState(false);
  const [saving, setSaving] = useState(false);

  const openRole = async (role) => {
    setSelectedRole(role);
    setLoadingMatrix(true);
    try { const res = await api.getRolePageAccess(role.id); setMatrix(res.data); }
    catch { showToast('Gagal memuat matriks akses', 'error'); }
    finally { setLoadingMatrix(false); }
  };

  const toggle = (page_key) => {
    if (selectedRole?.is_protected && page_key === 'master-data') return; // dikunci, lihat catatan di bawah
    setMatrix(m => m.map(x => x.page_key === page_key ? { ...x, can_access: !x.can_access } : x));
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.saveRolePageAccess(selectedRole.id, matrix.map(({ page_key, can_access }) => ({ page_key, can_access })));
      showToast(`Akses role ${selectedRole.nama} disimpan`);
      onRolesChanged?.();
    } catch (err) {
      showToast(err.message.replace(/^\d+: /, ''), 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ display: 'grid', gridTemplateColumns: selectedRole ? '220px 1fr' : '1fr', gap: 16 }}>
      <div style={{ display: 'grid', gap: 8, gridTemplateColumns: selectedRole ? '1fr' : 'repeat(auto-fit, minmax(160px, 1fr))' }}>
        {roles.map(r => (
          <div key={r.id} onClick={() => openRole(r)} style={{
            padding: '12px 14px', borderRadius: 10, cursor: 'pointer',
            border: selectedRole?.id === r.id ? '1px solid var(--green)' : '1px solid var(--border)',
            background: selectedRole?.id === r.id ? 'rgba(0,214,143,0.06)' : 'var(--surface)',
          }}>
            <div style={{ fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', gap: 6 }}>
              {r.nama}
              {r.is_protected && <span title="Role protected — tidak bisa dihapus akses Master Data-nya">🔒</span>}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 2 }}>{r.jumlah_halaman} halaman admin-tier</div>
          </div>
        ))}
      </div>

      {selectedRole && (
        <div className="card" style={{ padding: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 4 }}>Akses halaman — {selectedRole.nama}</div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 14 }}>
            Halaman baseline (Dashboard, Profil, Modul, dst) otomatis bisa diakses semua role, tidak perlu diatur di sini.
          </div>
          {loadingMatrix ? <SkeletonList count={5} /> : (
            <>
              <div style={{ display: 'grid', gap: 6, marginBottom: 16 }}>
                {matrix.map(m => {
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
              <button className="btn btn-primary" onClick={save} disabled={saving}>{saving ? 'Menyimpan...' : 'Simpan Akses'}</button>
            </>
          )}
        </div>
      )}
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
