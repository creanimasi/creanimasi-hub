import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const ROLE_OPTIONS = ['admin', 'member'];

const ROLE_BADGE = {
  admin:  { bg: 'rgba(0,214,143,0.12)', text: 'var(--green)', label: 'Admin' },
  member: { bg: 'var(--surface-2)',     text: 'var(--text-2)', label: 'Member' },
};

function RoleBadge({ role }) {
  const s = ROLE_BADGE[role] || ROLE_BADGE.member;
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      background: s.bg, color: s.text,
    }}>{s.label}</span>
  );
}

function UserFormModal({ initial, onSave, onClose }) {
  const isEdit = Boolean(initial);
  const [form, setForm] = useState(
    initial
      ? { nama: initial.nama, username: initial.username, role: initial.role, password: '' }
      : { nama: '', username: '', password: '', role: 'member' }
  );
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nama.trim() || !form.username.trim()) {
      setError('Nama dan username wajib diisi');
      return;
    }
    if (!isEdit && form.password.length < 8) {
      setError('Password minimal 8 karakter');
      return;
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
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14, padding: 24,
        width: '100%', maxWidth: 440, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 18 }}>
          {isEdit ? 'Edit User' : 'Tambah User Baru'}
        </div>

        {error && (
          <div className="alert alert-red" style={{ marginBottom: 14 }}>
            <span>⚠️</span><div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 5 }}>
              Nama lengkap *
            </label>
            <input
              value={form.nama}
              onChange={e => set('nama', e.target.value)}
              placeholder="Nama lengkap"
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 5 }}>
                Username *
              </label>
              <input
                value={form.username}
                onChange={e => set('username', e.target.value.toLowerCase())}
                placeholder="username"
                required
              />
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 5 }}>
                Role *
              </label>
              <select value={form.role} onChange={e => set('role', e.target.value)} required>
                {ROLE_OPTIONS.map(r => (
                  <option key={r} value={r}>{r === 'admin' ? 'Admin' : 'Member'}</option>
                ))}
              </select>
            </div>
          </div>

          {!isEdit && (
            <div style={{ marginBottom: 16 }}>
              <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 5 }}>
                Password * <span style={{ fontWeight: 400, color: 'var(--text-2)' }}>(min. 8 karakter)</span>
              </label>
              <input
                type="password"
                value={form.password}
                onChange={e => set('password', e.target.value)}
                placeholder="Password awal"
                required
                minLength={8}
              />
            </div>
          )}

          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose}
              style={{
                flex: 1, padding: '9px', borderRadius: 8,
                border: '1px solid var(--border-2)',
                background: 'var(--surface)', cursor: 'pointer', fontSize: 13,
              }}>
              Batal
            </button>
            <button type="submit" className="btn btn-primary"
              style={{ flex: 1, justifyContent: 'center' }}
              disabled={loading}>
              {loading ? 'Menyimpan...' : 'Simpan'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function ConfirmNonaktifModal({ user, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false);
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14, padding: 24,
        width: '100%', maxWidth: 360, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Nonaktifkan user?</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>
          <strong>{user.nama}</strong> (@{user.username}) akan dinonaktifkan dan tidak bisa login.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose}
            style={{
              flex: 1, padding: '9px', borderRadius: 8,
              border: '1px solid var(--border-2)',
              background: 'var(--surface)', cursor: 'pointer', fontSize: 13,
            }}>
            Batal
          </button>
          <button
            onClick={async () => { setLoading(true); await onConfirm(); }}
            disabled={loading}
            style={{
              flex: 1, padding: '9px', borderRadius: 8, border: 'none',
              background: 'var(--red)', color: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
            }}>
            {loading ? 'Memproses...' : 'Nonaktifkan'}
          </button>
        </div>
      </div>
    </div>
  );
}

function ResetPasswordModal({ user, onConfirm, onClose }) {
  const [loading, setLoading] = useState(false);
  const [customPw, setCustomPw] = useState('');
  const [result, setResult]    = useState(null);
  const [error, setError]      = useState('');

  const handleReset = async () => {
    if (customPw && customPw.length < 8) {
      setError('Password minimal 8 karakter');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await onConfirm(customPw || undefined);
      setResult(res);
    } catch (err) {
      setError(err.message.replace(/^\d+: /, ''));
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
      }}>
        <div style={{
          background: 'var(--surface)', borderRadius: 14, padding: 24,
          width: '100%', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        }}>
          <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8, color: 'var(--green)' }}>
            Password berhasil direset
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
            Beritahu <strong>{user.nama}</strong> password sementara berikut:
          </div>
          <div style={{
            background: 'var(--surface-2)', borderRadius: 8, padding: '10px 14px', marginBottom: 6,
            fontFamily: 'monospace', fontSize: 15, letterSpacing: '.05em',
            color: 'var(--text)', fontWeight: 700,
          }}>
            {result.password_temp}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 16 }}>
            Username: <strong>{result.username}</strong> — Minta user ganti password setelah login.
          </div>
          <button onClick={onClose} className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }}>
            Tutup
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--surface)', borderRadius: 14, padding: 24,
        width: '100%', maxWidth: 380, boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      }}>
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Reset Password</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 14 }}>
          Reset password untuk <strong>{user.nama}</strong> (@{user.username}).
        </div>

        {error && (
          <div className="alert alert-red" style={{ marginBottom: 12 }}>
            <span>⚠️</span><div>{error}</div>
          </div>
        )}

        <div style={{ marginBottom: 16 }}>
          <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 5 }}>
            Password baru <span style={{ fontWeight: 400, color: 'var(--text-2)' }}>(kosongkan untuk generate otomatis)</span>
          </label>
          <input
            type="password"
            value={customPw}
            onChange={e => setCustomPw(e.target.value)}
            placeholder="Kosongkan = auto-generate"
          />
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose}
            style={{
              flex: 1, padding: '9px', borderRadius: 8,
              border: '1px solid var(--border-2)',
              background: 'var(--surface)', cursor: 'pointer', fontSize: 13,
            }}>
            Batal
          </button>
          <button
            onClick={handleReset}
            disabled={loading}
            style={{
              flex: 1, padding: '9px', borderRadius: 8, border: 'none',
              background: 'var(--amber)', color: '#000', cursor: 'pointer',
              fontSize: 13, fontWeight: 600,
            }}>
            {loading ? 'Mereset...' : 'Reset Password'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManajemenUser() {
  const [users, setUsers]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState('');
  const [success, setSuccess] = useState('');
  const [search, setSearch]   = useState('');
  const [showNonaktif, setShowNonaktif] = useState(false);
  const [modal, setModal]     = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.getUsers();
      setUsers(res.data);
    } catch (err) {
      setError('Gagal memuat data user');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const notify = (msg) => {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 3500);
  };

  const handleTambah = async (form) => {
    await api.tambahUser(form);
    notify(`User ${form.nama} berhasil dibuat`);
    load();
  };

  const handleEdit = async (form) => {
    await api.updateUser(modal.data.id, { nama: form.nama, username: form.username, role: form.role });
    notify(`Data ${form.nama} berhasil diupdate`);
    load();
  };

  const handleNonaktifkan = async () => {
    await api.nonaktifkanUser(modal.data.id);
    notify(`${modal.data.nama} dinonaktifkan`);
    setModal(null);
    load();
  };

  const handleAktifkan = async (u) => {
    try {
      await api.aktifkanUser(u.id);
      notify(`${u.nama} diaktifkan kembali`);
      load();
    } catch (err) {
      notify(`Gagal: ${err.message.replace(/^\d+: /, '')}`);
    }
  };

  const handleResetPw = async (pw) => {
    const res = await api.resetPasswordUser(modal.data.id, pw);
    return res;
  };

  const filtered = users.filter(u => {
    const matchSearch = !search ||
      u.nama.toLowerCase().includes(search.toLowerCase()) ||
      u.username.toLowerCase().includes(search.toLowerCase());
    const matchAktif = showNonaktif ? true : u.aktif;
    return matchSearch && matchAktif;
  });

  const aktifCount = users.filter(u => u.aktif).length;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Manajemen User</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
            {aktifCount} akun aktif · {users.length} total
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 5, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showNonaktif}
              onChange={e => setShowNonaktif(e.target.checked)}
            />
            Tampilkan nonaktif
          </label>
          <button
            className="btn btn-primary"
            onClick={() => setModal({ type: 'add' })}
            style={{ fontSize: 13, padding: '7px 14px' }}>
            + Tambah User
          </button>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 14 }}>
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Cari nama atau username..."
          style={{ maxWidth: 340 }}
        />
      </div>

      {/* Notif */}
      {success && (
        <div className="alert alert-green" style={{ marginBottom: 14 }}>
          <span>✅</span><div>{success}</div>
        </div>
      )}
      {error && (
        <div className="alert alert-red" style={{ marginBottom: 14 }}>
          <span>⚠️</span><div>{error}</div>
        </div>
      )}

      {loading && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-2)' }}>Memuat data user...</div>
      )}

      {/* User list */}
      {!loading && (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          {filtered.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-2)' }}>
              {search ? 'Tidak ada user yang cocok.' : 'Belum ada user.'}
            </div>
          ) : (
            filtered.map((u, idx) => (
              <div key={u.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '12px 16px',
                borderBottom: idx < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                opacity: u.aktif ? 1 : 0.55,
                gap: 10,
              }}>
                {/* Avatar + info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                  <div style={{
                    width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                    background: u.role === 'admin' ? 'rgba(0,214,143,0.12)' : 'var(--surface-2)',
                    color: u.role === 'admin' ? 'var(--green)' : 'var(--text-2)',
                    fontWeight: 700, fontSize: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {u.nama.split(' ').map(w => w[0]).slice(0, 2).join('')}
                  </div>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: 14, display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
                      {u.nama}
                      <RoleBadge role={u.role} />
                      {!u.aktif && (
                        <span style={{
                          fontSize: 10, fontWeight: 600, padding: '1px 6px', borderRadius: 10,
                          background: 'var(--red-light)', color: 'var(--red)',
                        }}>Nonaktif</span>
                      )}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 1 }}>
                      @{u.username}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {u.aktif ? (
                    <>
                      <button
                        onClick={() => setModal({ type: 'edit', data: u })}
                        style={{
                          padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                          border: '1px solid var(--border-2)',
                          background: 'var(--surface)', cursor: 'pointer',
                        }}>
                        Edit
                      </button>
                      <button
                        onClick={() => setModal({ type: 'reset', data: u })}
                        style={{
                          padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                          border: '1px solid var(--amber)',
                          background: 'var(--amber-light)', color: 'var(--amber)', cursor: 'pointer',
                        }}>
                        Reset PW
                      </button>
                      <button
                        onClick={() => setModal({ type: 'nonaktif', data: u })}
                        style={{
                          padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                          border: '1px solid #fca5a5',
                          background: 'var(--surface)', color: 'var(--red)', cursor: 'pointer',
                        }}>
                        Nonaktifkan
                      </button>
                    </>
                  ) : (
                    <button
                      onClick={() => handleAktifkan(u)}
                      style={{
                        padding: '5px 11px', borderRadius: 7, fontSize: 12, fontWeight: 500,
                        border: '1px solid var(--green)',
                        background: 'var(--green-light)', color: 'var(--green)', cursor: 'pointer',
                      }}>
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
        <UserFormModal onSave={handleTambah} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'edit' && (
        <UserFormModal initial={modal.data} onSave={handleEdit} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'nonaktif' && (
        <ConfirmNonaktifModal
          user={modal.data}
          onConfirm={handleNonaktifkan}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'reset' && (
        <ResetPasswordModal
          user={modal.data}
          onConfirm={handleResetPw}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
