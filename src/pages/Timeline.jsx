import { useState, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import { useTim } from '../hooks/useTim';
import { TIMELINE_URGENSI, infoUrgensiTimeline, paletOtomatis, teksKontrasHex } from '../utils/timelineUrgensi';

const pesanError = (e) => (e?.message || 'Terjadi kesalahan').replace(/^\d{3}: /, '');
const inisial = (nama) => nama.trim().split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

// ── Tombol kecil (pindah atas/bawah, hapus) ─────────────────────────────────
function BtnIcon({ children, onClick, title, disabled, warn }) {
  return (
    <button type="button" className="btn btn-sm btn-icon" onClick={onClick} disabled={disabled} title={title} aria-label={title}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer', color: disabled ? 'var(--text-3)' : warn ? 'var(--red)' : undefined }}>
      {children}
    </button>
  );
}

// Baris tambah (grup / orang / tugas) — satu pola dipakai berulang: input + tombol, Enter untuk kirim.
function BarisTambah({ placeholder, onTambah, kecil }) {
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const kirim = async () => {
    const nilai = v.trim();
    if (!nilai || busy) return;
    setBusy(true);
    try { await onTambah(nilai); setV(''); } finally { setBusy(false); }
  };
  return (
    <div style={{ display: 'flex', gap: 8, marginTop: kecil ? 6 : 10 }}>
      <input value={v} onChange={e => setV(e.target.value)} placeholder={placeholder} disabled={busy}
        onKeyDown={e => e.key === 'Enter' && kirim()} style={{ flex: 1, fontSize: kecil ? 12 : 13 }} />
      <button type="button" className={`btn ${kecil ? 'btn-sm' : ''}`} onClick={kirim} disabled={busy || !v.trim()}>+ Tambah</button>
    </div>
  );
}

// ── Baris tugas ──────────────────────────────────────────────────────────────
// `versi` naik setiap kali papan disegarkan (termasuk setelah percobaan GAGAL) — dipakai supaya input
// lokal yang sempat diubah tapi DITOLAK server (mis. poin di luar batas) kembali ke nilai server yang
// sebenarnya, bukan tertinggal menampilkan nilai tak tersimpan (prop-nya sendiri bisa saja tak berubah).
function TugasRow({ t, indeks, total, versi, onUbah, onHapus, onPindah }) {
  const [deskripsi, setDeskripsi] = useState(t.deskripsi);
  const [poin, setPoin] = useState(t.poin ?? '');
  useEffect(() => { setDeskripsi(t.deskripsi); setPoin(t.poin ?? ''); }, [t.deskripsi, t.poin, versi]);
  const info = infoUrgensiTimeline(t.urgensi);

  const simpanDeskripsi = () => { const v = deskripsi.trim(); if (v && v !== t.deskripsi) onUbah({ deskripsi: v }); else setDeskripsi(t.deskripsi); };
  const simpanPoin = () => {
    const v = poin === '' ? null : Number(poin);
    if (v !== (t.poin ?? null)) onUbah({ poin: v });
  };

  return (
    <div style={{ display: 'flex', gap: 6, alignItems: 'center', padding: '4px 0', flexWrap: 'wrap' }}>
      <input value={deskripsi} onChange={e => setDeskripsi(e.target.value)} onBlur={simpanDeskripsi}
        onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} aria-label="Deskripsi tugas"
        style={{ flex: '1 1 160px', minWidth: 120, fontSize: 12, padding: '5px 8px' }} />
      <input value={poin} onChange={e => setPoin(e.target.value)} onBlur={simpanPoin} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
        type="number" min={0} max={999} placeholder="poin" aria-label="Poin" style={{ width: 58, fontSize: 12, padding: '5px 6px', flex: 'none' }} />
      <select value={t.urgensi ?? ''} onChange={e => onUbah({ urgensi: e.target.value === '' ? null : Number(e.target.value) })}
        aria-label="Urgensi" style={{
          width: 108, flex: 'none', fontSize: 12, padding: '5px 6px', color: info ? info.warna : undefined,
          borderColor: info ? info.warna : undefined, fontWeight: info ? 700 : 400,
        }}>
        <option value="">—</option>
        {TIMELINE_URGENSI.map(u => <option key={u.n} value={u.n}>{u.n} · {u.label}</option>)}
      </select>
      <BtnIcon onClick={() => onPindah('atas')} disabled={indeks === 0} title="Pindah ke atas">↑</BtnIcon>
      <BtnIcon onClick={() => onPindah('bawah')} disabled={indeks === total - 1} title="Pindah ke bawah">↓</BtnIcon>
      <BtnIcon onClick={onHapus} title="Hapus tugas" warn>✕</BtnIcon>
    </div>
  );
}

// ── Pita satu orang ───────────────────────────────────────────────────────────
function OrangBand({ o, indeks, total, timList, versi, onUbah, onHapus, onPindah, onTambahTugas, onUbahTugas, onHapusTugas, onPindahTugas }) {
  const [nama, setNama] = useState(o.nama);
  const [showWarna, setShowWarna] = useState(false);
  useEffect(() => { setNama(o.nama); }, [o.nama, versi]);
  const palet = paletOtomatis(indeks);
  const warnaAksen = o.warna || palet.text;
  const chipBg = o.warna || palet.bg;
  const chipText = o.warna ? teksKontrasHex(o.warna) : palet.text;

  const simpanNama = () => { const v = nama.trim(); if (v && v !== o.nama) onUbah({ nama: v }); else setNama(o.nama); };

  return (
    <div style={{ borderLeft: `4px solid ${warnaAksen}`, background: 'var(--surface-2)', borderRadius: 'var(--radius-md)', padding: '10px 12px', marginTop: 10 }}>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        <div aria-hidden="true" style={{
          width: 26, height: 26, borderRadius: '50%', flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: chipBg, color: chipText, fontSize: 10, fontWeight: 700,
        }}>{inisial(o.nama || '?')}</div>
        <input value={nama} onChange={e => setNama(e.target.value)} onBlur={simpanNama} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
          aria-label="Nama anggota" style={{ flex: '1 1 140px', minWidth: 100, fontSize: 13, fontWeight: 600, padding: '5px 8px' }} />
        {o.tim_divisi && <span style={{ fontSize: 10, color: 'var(--text-3)', border: '1px solid var(--border-2)', borderRadius: 6, padding: '2px 6px', flex: 'none' }}>{o.tim_divisi}</span>}
        <select value={o.tim_id ?? ''} onChange={e => onUbah({ tim_id: e.target.value === '' ? null : Number(e.target.value) })}
          aria-label="Tautkan ke anggota tim" title="Tautkan ke anggota tim (opsional — kosongkan untuk freelancer)"
          style={{ fontSize: 11, padding: '4px 6px', flex: 'none', maxWidth: 140 }}>
          <option value="">Tanpa tautan tim</option>
          {timList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
        </select>
        <button type="button" className="btn btn-sm" onClick={() => setShowWarna(v => !v)} title="Warna pita">🎨</button>
        {showWarna && (
          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input type="color" value={o.warna || '#888888'} onChange={e => onUbah({ warna: e.target.value })} aria-label="Pilih warna pita" style={{ width: 30, height: 26, padding: 0, border: 'none' }} />
            {o.warna && <button type="button" className="btn btn-sm" onClick={() => onUbah({ warna: null })}>Otomatis</button>}
          </span>
        )}
        <span style={{ flex: 1 }} />
        <BtnIcon onClick={() => onPindah('atas')} disabled={indeks === 0} title="Pindah ke atas">↑</BtnIcon>
        <BtnIcon onClick={() => onPindah('bawah')} disabled={indeks === total - 1} title="Pindah ke bawah">↓</BtnIcon>
        <BtnIcon onClick={onHapus} title="Hapus anggota (semua tugasnya ikut terhapus)" warn>✕</BtnIcon>
      </div>

      {o.tugas.length > 0 && (
        <div style={{ marginTop: 6 }}>
          {o.tugas.map((t, i) => (
            <TugasRow key={t.id} t={t} indeks={i} total={o.tugas.length} versi={versi}
              onUbah={patch => onUbahTugas(t.id, patch)} onHapus={() => onHapusTugas(t.id)} onPindah={arah => onPindahTugas(t.id, arah)} />
          ))}
        </div>
      )}
      <BarisTambah kecil placeholder="Klien / deskripsi tugas baru…" onTambah={onTambahTugas} />
    </div>
  );
}

// ── Satu grup ─────────────────────────────────────────────────────────────────
function GrupCard({ g, indeks, total, timList, versi, onUbah, onHapus, onPindah, onTambahOrang, onUbahOrang, onHapusOrang, onPindahOrang, onTambahTugas, onUbahTugas, onHapusTugas, onPindahTugas }) {
  const [nama, setNama] = useState(g.nama);
  useEffect(() => { setNama(g.nama); }, [g.nama, versi]);
  const simpanNama = () => { const v = nama.trim(); if (v && v !== g.nama) onUbah({ nama: v }); else setNama(g.nama); };

  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom: 6 }}>
        <input value={nama} onChange={e => setNama(e.target.value)} onBlur={simpanNama} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
          aria-label="Nama grup" style={{ fontSize: 14, fontWeight: 700, padding: '5px 8px', flex: 1, maxWidth: 260 }} />
        <span style={{ fontSize: 11, color: 'var(--text-3)', fontWeight: 400 }}>{g.orang.length} anggota</span>
        <span style={{ flex: 1 }} />
        <BtnIcon onClick={() => onPindah('atas')} disabled={indeks === 0} title="Pindah grup ke atas">↑</BtnIcon>
        <BtnIcon onClick={() => onPindah('bawah')} disabled={indeks === total - 1} title="Pindah grup ke bawah">↓</BtnIcon>
        <BtnIcon onClick={onHapus} title="Hapus grup (semua anggota & tugasnya ikut terhapus)" warn>✕</BtnIcon>
      </div>

      {g.orang.map((o, i) => (
        <OrangBand key={o.id} o={o} indeks={i} total={g.orang.length} timList={timList} versi={versi}
          onUbah={patch => onUbahOrang(o.id, patch)} onHapus={() => onHapusOrang(o.id)} onPindah={arah => onPindahOrang(o.id, arah)}
          onTambahTugas={deskripsi => onTambahTugas(o.id, deskripsi)}
          onUbahTugas={onUbahTugas} onHapusTugas={onHapusTugas} onPindahTugas={onPindahTugas} />
      ))}

      <div style={{ marginTop: g.orang.length ? 12 : 4, paddingTop: g.orang.length ? 10 : 0, borderTop: g.orang.length ? '1px dashed var(--border-2)' : 'none' }}>
        <BarisTambah placeholder="Nama anggota / freelancer baru…" onTambah={nama2 => onTambahOrang(g.id, nama2)} />
      </div>
    </div>
  );
}

// ── Halaman ────────────────────────────────────────────────────────────────
export default function Timeline() {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [versi, setVersi] = useState(0);
  const { showToast } = useToast();
  const timAktif = useTim();

  const muat = useCallback(async (senyap = false) => {
    if (!senyap) setState(s => ({ ...s, loading: true, error: null }));
    try { const r = await api.getTimeline(); setState({ data: r.data, loading: false, error: null }); }
    catch (e) { setState(s => ({ data: senyap ? s.data : null, loading: false, error: pesanError(e) })); }
    finally { setVersi(v => v + 1); }
  }, []);
  useEffect(() => { muat(); }, [muat]);

  const aksi = async (fn, pesanSukses) => {
    try { await fn(); if (pesanSukses) showToast(pesanSukses); }
    catch (e) { showToast(pesanError(e), 'error'); }
    // Selalu disegarkan — juga saat gagal, supaya input yang sempat diubah lokal (mis. poin ditolak
    // server) kembali ke nilai tersimpan yang sebenarnya, bukan tertinggal menampilkan nilai tak valid.
    finally { await muat(true); }
  };

  const { data, loading, error } = state;

  return (
    <div>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title">Papan Timeline</div>
        <p style={{ fontSize: 12, color: 'var(--text-2)', margin: 0, maxWidth: '70ch' }}>
          Pengganti spreadsheet timeline manual — dikelompokkan per tim (mis. Internal, Freelance 3D), lalu per anggota,
          lalu daftar tugas klien. Poin dan urgensi bersifat opsional dan murni catatan manual — tidak terhubung ke XP
          atau target poin di modul Guild. Tersimpan otomatis saat kolom ditinggalkan.
        </p>
      </div>

      {loading && <div className="card"><p style={{ fontSize: 12, color: 'var(--text-3)', margin: 0 }}>Memuat…</p></div>}
      {error && (
        <div className="card">
          <p style={{ fontSize: 12, color: 'var(--red)', margin: '0 0 8px' }}>{error}</p>
          <button type="button" className="btn btn-sm" onClick={() => muat()}>Coba lagi</button>
        </div>
      )}

      {data && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {data.map((g, i) => (
            <GrupCard key={g.id} g={g} indeks={i} total={data.length} timList={timAktif} versi={versi}
              onUbah={patch => aksi(() => api.timelineUbahGrup(g.id, patch.nama))}
              onHapus={() => { if (window.confirm(`Hapus grup "${g.nama}"? Semua anggota dan tugas di dalamnya ikut terhapus.`)) aksi(() => api.timelineHapusGrup(g.id), `Grup "${g.nama}" dihapus`); }}
              onPindah={arah => aksi(() => api.timelinePindahGrup(g.id, arah))}
              onTambahOrang={(grupId, nama) => aksi(() => api.timelineBuatOrang({ grup_id: grupId, nama }), `"${nama}" ditambahkan`)}
              onUbahOrang={(id, patch) => aksi(() => api.timelineUbahOrang(id, patch))}
              onHapusOrang={id => {
                const o = g.orang.find(x => x.id === id);
                if (window.confirm(`Hapus "${o?.nama}"? Semua tugasnya ikut terhapus.`)) aksi(() => api.timelineHapusOrang(id), `"${o?.nama}" dihapus`);
              }}
              onPindahOrang={(id, arah) => aksi(() => api.timelinePindahOrang(id, arah))}
              onTambahTugas={(orangId, deskripsi) => aksi(() => api.timelineBuatTugas({ orang_id: orangId, deskripsi }))}
              onUbahTugas={(id, patch) => aksi(() => api.timelineUbahTugas(id, patch))}
              onHapusTugas={id => aksi(() => api.timelineHapusTugas(id))}
              onPindahTugas={(id, arah) => aksi(() => api.timelinePindahTugas(id, arah))}
            />
          ))}
          <div className="card">
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>+ Grup baru</div>
            <BarisTambah placeholder="Nama grup (mis. Freelance 2D)…" onTambah={nama => aksi(() => api.timelineBuatGrup(nama), `Grup "${nama}" dibuat`)} />
          </div>
        </div>
      )}
    </div>
  );
}
