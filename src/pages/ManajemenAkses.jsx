import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import { useAuth } from '../hooks/useAuth';

const ROLE_STYLE = {
  admin:  { bg: 'rgba(0,214,143,0.12)', color: 'var(--green)',  border: 'rgba(0,214,143,0.3)' },
  member: { bg: 'var(--surface-2)',     color: 'var(--text-3)', border: 'var(--border-2)' },
};

function RolePill({ role }) {
  const s = ROLE_STYLE[role] || ROLE_STYLE.member;
  return (
    <span style={{
      fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20,
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
    }}>
      {role === 'admin' ? 'Admin' : 'Member'}
    </span>
  );
}

function StatusDot({ aktif }) {
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: aktif ? 'var(--green)' : 'var(--text-3)',
        boxShadow: aktif ? '0 0 6px var(--green)' : 'none',
        flexShrink: 0,
      }} />
      <span style={{ color: aktif ? 'var(--green)' : 'var(--text-3)', fontWeight: 600 }}>
        {aktif ? 'Aktif' : 'Nonaktif'}
      </span>
    </span>
  );
}

function ResetPasswordModal({ anggota, onClose, onDone }) {
  const [pw, setPw]         = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr]       = useState('');
  const { showToast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (pw.trim().length < 8) { setErr('Password minimal 8 karakter'); return; }
    setLoading(true);
    setErr('');
    try {
      await api.resetPassword(anggota.id, pw.trim());
      showToast(`Password ${anggota.nama} berhasil direset`);
      onDone();
      onClose();
    } catch (e) {
      setErr(e.message.replace(/^\d+: /, ''));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: 16,
        border: '1px solid var(--border-2)',
        padding: 24, width: '100%', maxWidth: 380,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Reset Password</div>
        <div style={{ fontSize: 12, color: 'var(--text-2)', marginBottom: 20 }}>
          Akun: <strong>{anggota.nama}</strong> ({anggota.username})
        </div>
        <form onSubmit={handleSubmit}>
          <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
            Password Baru
          </label>
          <input
            type="text"
            value={pw}
            onChange={e => setPw(e.target.value)}
            placeholder="Min. 8 karakter"
            autoFocus
            style={{
              width: '100%', padding: '9px 12px', borderRadius: 8,
              border: '1px solid var(--border-2)', background: 'var(--surface-2)',
              color: 'var(--text)', fontSize: 13, marginBottom: err ? 8 : 16,
              fontFamily: 'var(--font-mono, monospace)',
            }}
          />
          {err && <div style={{ fontSize: 12, color: 'var(--red)', marginBottom: 12 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={onClose} style={{
              padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-2)',
              background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 13,
              cursor: 'pointer', fontWeight: 600,
            }}>Batal</button>
            <button type="submit" disabled={loading} style={{
              padding: '8px 16px', borderRadius: 8, border: 'none',
              background: 'var(--amber)', color: '#000', fontSize: 13,
              cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 700, opacity: loading ? .7 : 1,
            }}>
              {loading ? 'Menyimpan...' : 'Reset'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function UbahRoleModal({ anggota, onClose, onDone }) {
  const targetRole = anggota.role === 'admin' ? 'member' : 'admin';
  const [loading, setLoading] = useState(false);
  const { showToast } = useToast();

  const handleConfirm = async () => {
    setLoading(true);
    try {
      await api.updateTim(anggota.id, {
        nama: anggota.nama,
        divisi: anggota.divisi,
        entitas: anggota.entitas || 'Creanimasi Studio',
        username: anggota.username,
        role: targetRole,
      });
      showToast(`Role ${anggota.nama} diubah ke ${targetRole}`);
      onDone();
      onClose();
    } catch (e) {
      showToast(e.message.replace(/^\d+: /, ''), 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: 16,
        border: '1px solid var(--border-2)',
        padding: 24, width: '100%', maxWidth: 380,
      }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 4 }}>Ubah Role</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20, lineHeight: 1.6 }}>
          Role <strong>{anggota.nama}</strong> akan diubah dari{' '}
          <RolePill role={anggota.role} /> menjadi <RolePill role={targetRole} />.
          {targetRole === 'admin' && (
            <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8,
              background: 'rgba(255,184,48,0.1)', border: '1px solid rgba(255,184,48,0.25)',
              fontSize: 12, color: 'var(--amber)' }}>
              ⚠ Admin mendapat akses penuh ke semua data dan fitur.
            </div>
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button onClick={onClose} style={{
            padding: '8px 16px', borderRadius: 8, border: '1px solid var(--border-2)',
            background: 'var(--surface-2)', color: 'var(--text-2)', fontSize: 13,
            cursor: 'pointer', fontWeight: 600,
          }}>Batal</button>
          <button onClick={handleConfirm} disabled={loading} style={{
            padding: '8px 16px', borderRadius: 8, border: 'none',
            background: targetRole === 'admin' ? 'var(--amber)' : 'var(--surface-2)',
            color: targetRole === 'admin' ? '#000' : 'var(--text)',
            border: targetRole === 'admin' ? 'none' : '1px solid var(--border-2)',
            fontSize: 13, cursor: loading ? 'not-allowed' : 'pointer',
            fontWeight: 700, opacity: loading ? .7 : 1,
          }}>
            {loading ? 'Menyimpan...' : `Jadikan ${targetRole === 'admin' ? 'Admin' : 'Member'}`}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManajemenAkses() {
  const { user: currentUser } = useAuth();
  const { showToast } = useToast();
  const [semua, setSemua]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [filterRole, setFilterRole] = useState('semua');
  const [showNonaktif, setShowNonaktif] = useState(false);
  const [modal, setModal]       = useState(null); // { type: 'role'|'reset', data }

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getTim(true);
      setSemua(res.data);
    } catch {
      showToast('Gagal memuat data akun', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => { load(); }, [load]);

  const handleAktifToggle = async (a) => {
    try {
      if (a.aktif) {
        await api.nonaktifkanTim(a.id);
        showToast(`Akun ${a.nama} dinonaktifkan`, 'warning');
      } else {
        await api.aktifkanAnggota(a.id);
        showToast(`Akun ${a.nama} diaktifkan`);
      }
      load();
    } catch (e) {
      showToast(e.message.replace(/^\d+: /, ''), 'error');
    }
  };

  const filtered = semua.filter(a => {
    if (!showNonaktif && !a.aktif) return false;
    if (filterRole !== 'semua' && a.role !== filterRole) return false;
    if (search) {
      const q = search.toLowerCase();
      return a.nama?.toLowerCase().includes(q) || a.username?.toLowerCase().includes(q) || a.divisi?.toLowerCase().includes(q);
    }
    return true;
  });

  const adminCount  = semua.filter(a => a.aktif && a.role === 'admin').length;
  const memberCount = semua.filter(a => a.aktif && a.role === 'member').length;
  const nonaktifCount = semua.filter(a => !a.aktif).length;
  const tanpaAkunCount = semua.filter(a => !a.username).length;

  return (
    <div style={{ padding: '24px 20px' }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>🔑 Manajemen Akses</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
          Kelola login, role, dan status akun semua anggota
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Admin', value: adminCount, color: 'var(--green)' },
          { label: 'Member', value: memberCount, color: 'var(--text-2)' },
          { label: 'Nonaktif', value: nonaktifCount, color: 'var(--text-3)' },
          { label: 'Tanpa Akun', value: tanpaAkunCount, color: 'var(--red)' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 10, padding: '12px 14px',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.05em' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Cari nama, username, divisi..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{
            flex: 1, minWidth: 180, padding: '8px 12px', borderRadius: 8,
            border: '1px solid var(--border-2)', background: 'var(--surface-2)',
            color: 'var(--text)', fontSize: 13,
          }}
        />
        {['semua', 'admin', 'member'].map(r => (
          <button key={r} onClick={() => setFilterRole(r)} style={{
            padding: '7px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600,
            border: '1px solid var(--border-2)', cursor: 'pointer',
            background: filterRole === r ? 'var(--green)' : 'var(--surface-2)',
            color: filterRole === r ? '#fff' : 'var(--text-2)',
          }}>
            {r === 'semua' ? 'Semua' : r === 'admin' ? 'Admin' : 'Member'}
          </button>
        ))}
        <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--text-2)', cursor: 'pointer', userSelect: 'none' }}>
          <input type="checkbox" checked={showNonaktif} onChange={e => setShowNonaktif(e.target.checked)} />
          Tampilkan nonaktif
        </label>
      </div>

      {/* Tabel */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 48, color: 'var(--text-3)', fontSize: 13 }}>Memuat data...</div>
      ) : (
        <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
          {/* Header tabel */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 140px 90px 100px 80px 160px',
            padding: '10px 16px',
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border)',
            fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
            textTransform: 'uppercase', letterSpacing: '.06em',
            gap: 8,
          }}>
            <span>Nama / Divisi</span>
            <span>Username</span>
            <span>Role</span>
            <span>Status</span>
            <span></span>
            <span>Aksi</span>
          </div>

          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-3)', fontSize: 13 }}>
              Tidak ada data yang cocok.
            </div>
          )}

          {filtered.map((a, i) => {
            const isSelf = a.user_id === currentUser?.id || a.nama === currentUser?.nama;
            const hasAkun = Boolean(a.username);
            return (
              <div key={a.id} style={{
                display: 'grid',
                gridTemplateColumns: '1fr 140px 90px 100px 80px 160px',
                padding: '12px 16px',
                borderBottom: i < filtered.length - 1 ? '1px solid var(--border)' : 'none',
                alignItems: 'center',
                gap: 8,
                opacity: a.aktif ? 1 : .55,
                background: isSelf ? 'rgba(0,214,143,0.03)' : 'transparent',
              }}>
                {/* Nama */}
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>
                    {a.nama}
                    {isSelf && <span style={{ fontSize: 10, color: 'var(--green)', fontWeight: 700 }}>(kamu)</span>}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{a.divisi}</div>
                </div>

                {/* Username */}
                <div>
                  {hasAkun
                    ? <span style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)', color: 'var(--text-2)' }}>{a.username}</span>
                    : <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600 }}>Belum punya akun</span>
                  }
                </div>

                {/* Role */}
                <div>{hasAkun ? <RolePill role={a.role} /> : '—'}</div>

                {/* Status */}
                <div><StatusDot aktif={a.aktif} /></div>

                {/* Spacer — kosong */}
                <div />

                {/* Aksi */}
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {hasAkun && !isSelf && (
                    <button onClick={() => setModal({ type: 'role', data: a })} style={{
                      padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      border: '1px solid var(--border-2)', background: 'var(--surface-2)',
                      color: 'var(--text-2)', cursor: 'pointer',
                    }}>
                      {a.role === 'admin' ? '↓ Member' : '↑ Admin'}
                    </button>
                  )}
                  {hasAkun && (
                    <button onClick={() => setModal({ type: 'reset', data: a })} style={{
                      padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      border: '1px solid rgba(255,184,48,0.3)', background: 'rgba(255,184,48,0.08)',
                      color: 'var(--amber)', cursor: 'pointer',
                    }}>
                      Reset PW
                    </button>
                  )}
                  {!isSelf && hasAkun && (
                    <button onClick={() => handleAktifToggle(a)} style={{
                      padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                      border: a.aktif ? '1px solid rgba(255,82,82,0.3)' : '1px solid rgba(0,214,143,0.3)',
                      background: a.aktif ? 'rgba(255,82,82,0.08)' : 'rgba(0,214,143,0.08)',
                      color: a.aktif ? 'var(--red)' : 'var(--green)',
                      cursor: 'pointer',
                    }}>
                      {a.aktif ? 'Nonaktifkan' : 'Aktifkan'}
                    </button>
                  )}
                  {!hasAkun && (
                    <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Buat akun di Kelola Anggota</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'reset' && (
        <ResetPasswordModal
          anggota={modal.data}
          onClose={() => setModal(null)}
          onDone={load}
        />
      )}
      {modal?.type === 'role' && (
        <UbahRoleModal
          anggota={modal.data}
          onClose={() => setModal(null)}
          onDone={load}
        />
      )}
    </div>
  );
}
