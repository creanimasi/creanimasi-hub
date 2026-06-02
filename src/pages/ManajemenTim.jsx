import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';

const DIVISI_OPTIONS = ['Admin', 'PM', 'Illustrator', 'Rigger', '3D Modeler'];
const LEVEL_OPTIONS  = ['Magang / Probation', 'Junior', 'Senior', 'Admin (L4)', 'Secondline', 'Koordinator'];

const TIPE_COLOR = {
  'Rising Star':     { bg: 'var(--green-light)',  color: 'var(--green)'  },
  'High Potential':  { bg: 'var(--purple-light)', color: 'var(--purple)' },
  'Silent Expert':   { bg: 'var(--amber-light)',  color: 'var(--amber)'  },
  'At Risk':         { bg: 'var(--coral-light)',  color: 'var(--coral)'  },
  'Steady Performer':{ bg: 'var(--amber-light)',  color: 'var(--amber)'  },
};

const emptyForm = { nama: '', divisi: '', level: '' };

function Badge({ tipe }) {
  const s = TIPE_COLOR[tipe] || { bg: 'var(--surface-2)', color: 'var(--text-2)' };
  return (
    <span style={{
      fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 20,
      background: s.bg, color: s.color,
    }}>{tipe || '—'}</span>
  );
}

function FormModal({ initial, onSave, onClose }) {
  const [form, setForm] = useState(initial || emptyForm);
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nama.trim() || !form.divisi) { setError('Nama dan divisi wajib diisi'); return; }
    setLoading(true); setError('');
    try { await onSave(form); onClose(); }
    catch (err) { setError(err.message); }
    finally { setLoading(false); }
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
          {initial ? '✏️ Edit Anggota' : '➕ Tambah Anggota Baru'}
        </div>
        {error && (
          <div className="alert alert-red" style={{ marginBottom: 14 }}>
            <span>⚠️</span><div>{error}</div>
          </div>
        )}
        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 5 }}>Nama lengkap *</label>
            <input value={form.nama} onChange={e => set('nama', e.target.value)} placeholder="Nama lengkap" required />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 12 }}>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 5 }}>Divisi *</label>
              <select value={form.divisi} onChange={e => set('divisi', e.target.value)} required>
                <option value="">— Pilih —</option>
                {DIVISI_OPTIONS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 5 }}>Level</label>
              <select value={form.level} onChange={e => set('level', e.target.value)}>
                <option value="">— Pilih —</option>
                {LEVEL_OPTIONS.map(l => <option key={l} value={l}>{l}</option>)}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" onClick={onClose}
              style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border-2)',
                background: 'var(--surface)', cursor: 'pointer', fontSize: 13 }}>
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

function ConfirmModal({ nama, onConfirm, onClose }) {
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
        <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Nonaktifkan anggota?</div>
        <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 20 }}>
          <strong>{nama}</strong> akan dinonaktifkan. Data historis tetap tersimpan.
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose}
            style={{ flex: 1, padding: '9px', borderRadius: 8, border: '1px solid var(--border-2)',
              background: 'var(--surface)', cursor: 'pointer', fontSize: 13 }}>
            Batal
          </button>
          <button onClick={async () => { setLoading(true); await onConfirm(); }}
            disabled={loading}
            style={{ flex: 1, padding: '9px', borderRadius: 8, border: 'none',
              background: 'var(--red)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
            {loading ? 'Memproses...' : 'Nonaktifkan'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ManajemenTim() {
  const [tim, setTim]           = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState('');
  const [showSemua, setShowSemua] = useState(false);
  const [modal, setModal]       = useState(null); // null | {type:'add'} | {type:'edit', data} | {type:'hapus', data}
  const [success, setSuccess]   = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.getTim(showSemua);
      setTim(res.data);
    } catch (err) {
      setError('Gagal memuat data tim');
    } finally {
      setLoading(false);
    }
  }, [showSemua]);

  useEffect(() => { load(); }, [load]);

  const notify = (msg) => { setSuccess(msg); setTimeout(() => setSuccess(''), 3000); };

  const handleTambah = async (form) => {
    await api.tambahTim({ ...form, tipe: '' });
    notify(`${form.nama} berhasil ditambahkan`);
    load();
  };

  const handleEdit = async (form) => {
    await api.updateTim(modal.data.id, {
      ...form,
      tipe: modal.data.tipe, // tipe tidak diubah manual, dipertahankan dari data existing
      aktif: modal.data.aktif,
    });
    notify(`Data ${form.nama} berhasil diupdate`);
    load();
  };

  const handleHapus = async () => {
    await api.nonaktifkanTim(modal.data.id);
    notify(`${modal.data.nama} dinonaktifkan`);
    setModal(null);
    load();
  };

  const handleResetPW = async () => {
    try {
      const res = await api.resetPassword(modal.data.id);
      notify(`Password ${modal.data.nama} direset ke "creanimasi123" (username: ${res.username})`);
    } catch (err) {
      notify(`Gagal: ${err.message}`);
    }
    setModal(null);
  };

  const handleAktifkan = async (anggota) => {
    await api.updateTim(anggota.id, { ...anggota, aktif: true });
    notify(`${anggota.nama} diaktifkan kembali`);
    load();
  };

  // Group by divisi
  const grouped = tim.reduce((acc, a) => {
    if (!acc[a.divisi]) acc[a.divisi] = [];
    acc[a.divisi].push(a);
    return acc;
  }, {});

  return (
    <div style={{ maxWidth: 760, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 18, fontWeight: 700 }}>Manajemen Tim</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
            {tim.filter(a => a.aktif).length} anggota aktif
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <label style={{ fontSize: 12, color: 'var(--text-2)', display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
            <input type="checkbox" checked={showSemua} onChange={e => setShowSemua(e.target.checked)} />
            Tampilkan nonaktif
          </label>
          <button className="btn btn-primary" onClick={() => setModal({ type: 'add' })}
            style={{ fontSize: 13, padding: '7px 14px' }}>
            + Tambah Anggota
          </button>
        </div>
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
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-2)' }}>Memuat data tim...</div>
      )}

      {/* List per divisi */}
      {!loading && Object.entries(grouped).map(([divisi, anggota]) => (
        <div key={divisi} className="card" style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', marginBottom: 10,
            textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {divisi} <span style={{ fontWeight: 400 }}>({anggota.length})</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {anggota.map(a => (
              <div key={a.id} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: 8,
                background: a.aktif ? 'var(--surface-2)' : '#f9fafb',
                opacity: a.aktif ? 1 : 0.6,
                border: '1px solid var(--border)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, background: 'var(--green-light)',
                    color: 'var(--green)', fontWeight: 700, fontSize: 13,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {a.nama.split(' ').map(w => w[0]).slice(0, 2).join('')}
                  </div>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>{a.nama}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 2 }}>
                      {a.level || '—'} {!a.aktif && <span style={{ color: 'var(--red)', marginLeft: 6 }}>(Nonaktif)</span>}
                    </div>
                  </div>
                  <Badge tipe={a.tipe} />
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap:'wrap' }}>
                  {a.aktif ? (
                    <>
                      <button onClick={() => setModal({ type: 'edit', data: a })}
                        style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--border-2)',
                          background: 'var(--surface)', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                        Edit
                      </button>
                      <button onClick={() => setModal({ type: 'reset', data: a })}
                        style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--amber)',
                          background: 'var(--amber-light)', color: 'var(--amber)', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                        Reset PW
                      </button>
                      <button onClick={() => setModal({ type: 'hapus', data: a })}
                        style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid #fca5a5',
                          background: 'var(--surface)', color: 'var(--red)', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                        Nonaktifkan
                      </button>
                    </>
                  ) : (
                    <button onClick={() => handleAktifkan(a)}
                      style={{ padding: '5px 12px', borderRadius: 7, border: '1px solid var(--green)',
                        background: 'var(--green-light)', color: 'var(--green)', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>
                      Aktifkan
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      {!loading && tim.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-2)' }}>
          Belum ada anggota tim. Klik "+ Tambah Anggota" untuk mulai.
        </div>
      )}

      {/* Modals */}
      {modal?.type === 'add' && (
        <FormModal onSave={handleTambah} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'edit' && (
        <FormModal initial={modal.data} onSave={handleEdit} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'hapus' && (
        <ConfirmModal nama={modal.data.nama} onConfirm={handleHapus} onClose={() => setModal(null)} />
      )}
      {modal?.type === 'reset' && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,.45)',
          display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000 }}
          onClick={e => e.target===e.currentTarget && setModal(null)}>
          <div style={{ background:'var(--surface)', borderRadius:14, padding:24,
            width:'100%', maxWidth:360, boxShadow:'0 8px 32px rgba(0,0,0,.18)' }}>
            <div style={{ fontWeight:700, fontSize:15, marginBottom:8 }}>Reset password?</div>
            <div style={{ fontSize:13, color:'var(--text-2)', marginBottom:20 }}>
              Password <strong>{modal.data.nama}</strong> akan direset ke <strong>creanimasi123</strong>. Beritahu anggota setelah reset.
            </div>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={() => setModal(null)}
                style={{ flex:1, padding:'9px', borderRadius:8, border:'1px solid var(--border-2)',
                  background:'var(--surface)', cursor:'pointer', fontSize:13 }}>Batal</button>
              <button onClick={handleResetPW}
                style={{ flex:1, padding:'9px', borderRadius:8, border:'none',
                  background:'var(--amber)', color:'#000', cursor:'pointer', fontSize:13, fontWeight:600 }}>
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
