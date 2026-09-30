import { useState, useEffect, useCallback, Fragment } from 'react';
import { api } from '../services/api';
import { useToast } from '../hooks/useToast';
import { useTim } from '../hooks/useTim';
import { TIMELINE_URGENSI, infoUrgensiTimeline, paletOtomatis, warnaLatarOrang } from '../utils/timelineUrgensi';

const pesanError = (e) => (e?.message || 'Terjadi kesalahan').replace(/^\d{3}: /, '');

// Gaya tabel — dipadukan dari konvensi tabel Ads Performance (rapat, rata kiri header abu),
// tapi sel isi ditampilkan sebagai kotak isian polos (tanpa garis/latar) agar terasa seperti mengetik
// langsung di sel spreadsheet. Fokus tetap dibiarkan tampil (outline bawaan browser) demi aksesibilitas.
const thStyle = { padding: '5px 8px', fontSize: 11, color: 'var(--text-3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.04em', textAlign: 'left', whiteSpace: 'nowrap', borderBottom: '1px solid var(--border)' };
const tdStyle = { padding: '1px 6px', fontSize: 12, color: 'var(--text)', borderBottom: '1px solid var(--border)', verticalAlign: 'middle' };
const selInput = { border: 'none', background: 'transparent', width: '100%', padding: '2px 4px', fontSize: 12, color: 'inherit', fontFamily: 'inherit' };

// ── Tombol kecil (pindah atas/bawah, hapus) ─────────────────────────────────
// Latar `.btn` sudah opak (var(--surface-2)) — dipakai apa adanya bahkan di atas banner merah grup
// (--tl-banner-bg), jadi tak perlu variasi warna khusus per konteks: kontrasnya sudah terjamin lewat
// pil solidnya sendiri, sama seperti tombol ini dipakai di baris tugas biasa. `padding` di-override lebih
// tipis dari bawaan `.btn-icon` (7px) — demi memadatkan tinggi baris (8 orang × banyak baris tugas
// menumpuk vertikal; tiap px per baris kelipatan 40+ kali di papan yang penuh).
// `active` (opsional): dipakai buat penanda "sudah diisi" (mis. tombol tanggal kerja yang sudah punya
// nilai) — warna var(--green), beda saluran dari `warn` (merah, dipakai hapus).
function BtnIcon({ children, onClick, title, disabled, warn, active }) {
  return (
    <button type="button" className="btn btn-sm btn-icon" onClick={onClick} disabled={disabled} title={title} aria-label={title}
      style={{
        cursor: disabled ? 'not-allowed' : 'pointer',
        color: disabled ? 'var(--text-3)' : warn ? 'var(--red)' : active ? 'var(--green)' : undefined,
        flex: 'none', padding: '3px 5px',
      }}>
      {children}
    </button>
  );
}

// Kotak tambah (tugas / orang / grup baru) — satu pola dipakai berulang: kosong lalu Enter/blur mengirim.
function KotakTambah({ placeholder, onTambah, style }) {
  const [v, setV] = useState('');
  const [busy, setBusy] = useState(false);
  const kirim = async () => {
    const nilai = v.trim();
    if (!nilai || busy) return;
    setBusy(true);
    try { await onTambah(nilai); setV(''); } finally { setBusy(false); }
  };
  return (
    <input value={v} onChange={e => setV(e.target.value)} placeholder={placeholder} disabled={busy}
      onBlur={kirim} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} style={{ ...selInput, ...style }} />
  );
}

// ── Satu baris tugas (tabel) ─────────────────────────────────────────────────
// `versi` naik setiap kali papan disegarkan (termasuk setelah percobaan GAGAL) — dipakai supaya input
// lokal yang sempat diubah tapi DITOLAK server (mis. poin di luar batas) kembali ke nilai server yang
// sebenarnya, bukan tertinggal menampilkan nilai tak tersimpan (prop-nya sendiri bisa saja tak berubah).
// `celNama` (opsional): sel <td rowSpan> Nama yang disisipkan di depan — hanya diisi pada baris tugas
// PERTAMA milik satu orang, supaya sel itu menyatu ke bawah sepanjang blok orang tersebut.
// `bg`: warna latar blok orang ini (palet otomatis atau tint warna kustom, lihat `warnaLatarOrang`) —
// diterapkan ke SEMUA sel baris supaya seluruh blok orang tampak sebagai satu pita warna menyatu,
// meniru referensi spreadsheet (bukan cuma garis aksen di sel Nama seperti versi sebelumnya).
function BarisTugas({ t, indeks, total, versi, celNama, bg, orangId, onUbah, onHapus, onPindah }) {
  const [deskripsi, setDeskripsi] = useState(t.deskripsi);
  const [poin, setPoin] = useState(t.poin ?? '');
  const [showTanggal, setShowTanggal] = useState(false);
  useEffect(() => { setDeskripsi(t.deskripsi); setPoin(t.poin ?? ''); }, [t.deskripsi, t.poin, versi]);
  const info = infoUrgensiTimeline(t.urgensi);
  const td = { ...tdStyle, background: bg };

  const simpanDeskripsi = () => { const v = deskripsi.trim(); if (v && v !== t.deskripsi) onUbah({ deskripsi: v }); else setDeskripsi(t.deskripsi); };
  const simpanPoin = () => {
    const v = poin === '' ? null : Number(poin);
    if (v !== (t.poin ?? null)) onUbah({ poin: v });
  };

  return (
    <tr data-orang-id={orangId}>
      {celNama}
      <td style={{ ...td, minWidth: 220 }}>
        <input value={deskripsi} onChange={e => setDeskripsi(e.target.value)} onBlur={simpanDeskripsi}
          onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()} placeholder="Nama klien / tugas…" aria-label="Deskripsi tugas" style={selInput} />
      </td>
      <td style={{ ...td, width: 70 }}>
        <input value={poin} onChange={e => setPoin(e.target.value)} onBlur={simpanPoin} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
          type="number" min={0} max={999} placeholder="—" aria-label="Poin" style={{ ...selInput, textAlign: 'right' }} />
      </td>
      <td style={{ ...td, width: 118 }}>
        <select value={t.urgensi ?? ''} onChange={e => onUbah({ urgensi: e.target.value === '' ? null : Number(e.target.value) })}
          aria-label="Urgensi" style={{
            ...selInput, textAlign: 'center', borderRadius: 6, fontWeight: 700, cursor: 'pointer',
            background: info ? info.warna : 'var(--surface-3)', color: info ? 'var(--tl-urg-on)' : 'var(--text-3)',
          }}>
          <option value="">—</option>
          {TIMELINE_URGENSI.map(u => <option key={u.n} value={u.n}>{u.n} · {u.label}</option>)}
        </select>
      </td>
      <td style={{ ...td, width: 108 }}>
        <div className="tl-row-actions" style={{ display: 'flex', gap: 2 }}>
          {/* Tanggal kerja (opsional) — dipakai Laporan KPI Artist mengelompokkan Poin per hari kalender.
              Popover posisinya absolute supaya TIDAK memengaruhi lebar kolom Aksi (yang lain juga memakai
              lebar ini, tak boleh melebar cuma karena satu baris sedang membuka popover). */}
          <div style={{ position: 'relative' }}>
            <BtnIcon onClick={() => setShowTanggal(v => !v)} active={!!t.tanggal_kerja}
              title={t.tanggal_kerja ? `Tanggal kerja: ${t.tanggal_kerja} (dipakai Laporan KPI)` : 'Atur tanggal kerja (dipakai Laporan KPI Artist)'}>
              {/* Teks polos (bukan emoji 📅) — emoji render berwarna penuh, tak ikut `color: currentColor`
                  seperti glyph tombol lain (⋯ ↑ ↓ ✕), jadi kelihatan "nempel" beda gaya di antara yang lain. */}
              Tgl
            </BtnIcon>
            {showTanggal && (
              <div style={{
                position: 'absolute', top: '100%', right: 0, zIndex: 20, marginTop: 4, padding: 6,
                background: 'var(--surface-2)', border: '1px solid var(--border-2)', borderRadius: 8,
                boxShadow: '0 4px 14px rgba(0,0,0,.3)',
              }}>
                <input type="date" value={t.tanggal_kerja || ''} aria-label="Tanggal kerja"
                  onChange={e => { onUbah({ tanggal_kerja: e.target.value || null }); setShowTanggal(false); }}
                  style={{ fontSize: 12, padding: 4, color: 'var(--text)', background: 'var(--surface)', border: '1px solid var(--border-2)', borderRadius: 4 }} />
                {t.tanggal_kerja && (
                  <button type="button" className="btn btn-sm" onClick={() => { onUbah({ tanggal_kerja: null }); setShowTanggal(false); }}
                    style={{ display: 'block', width: '100%', marginTop: 4, fontSize: 11 }}>
                    Hapus tanggal
                  </button>
                )}
              </div>
            )}
          </div>
          <BtnIcon onClick={() => onPindah('atas')} disabled={indeks === 0} title="Pindah ke atas">↑</BtnIcon>
          <BtnIcon onClick={() => onPindah('bawah')} disabled={indeks === total - 1} title="Pindah ke bawah">↓</BtnIcon>
          <BtnIcon onClick={onHapus} title="Hapus tugas" warn>✕</BtnIcon>
        </div>
      </td>
    </tr>
  );
}

// ── Sel NAMA (menyatu/rowspan sepanjang baris tugas orang itu) ──────────────
// Disederhanakan agar dekat dengan referensi spreadsheet: default-nya cuma nama + pindah/hapus (pudar
// sampai disorot). Tautan tim & warna kustom — jarang diubah — disembunyikan di balik tombol "⋯".
function SelOrang({ o, indeks, total, timList, versi, bg, onUbah, onHapus, onPindah, rowSpan }) {
  const [nama, setNama] = useState(o.nama);
  const [showDetail, setShowDetail] = useState(false);
  useEffect(() => { setNama(o.nama); }, [o.nama, versi]);
  const palet = paletOtomatis(indeks);
  const warnaAksen = o.warna || palet.text;

  const simpanNama = () => { const v = nama.trim(); if (v && v !== o.nama) onUbah({ nama: v }); else setNama(o.nama); };

  return (
    // `width` TETAP (bukan cuma `minWidth`) — tanpa ini browser membiarkan kolom Nama ikut melebar mengambil
    // ruang sisa (tabel `width:'100%'` tanpa lebar tetap di sini akan bagi ruang lebih merata ke semua kolom
    // tanpa `width`), padahal yang perlu melebar itu Nama Klien (`minWidth:220` saja, sengaja fleksibel).
    <td rowSpan={rowSpan} data-orang-id={o.id} style={{ ...tdStyle, borderLeft: `4px solid ${warnaAksen}`, background: bg, width: 150, padding: '4px 6px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div className="tl-row-actions" style={{ display: 'flex', gap: 2, justifyContent: 'flex-end', flex: 'none' }}>
          <button type="button" className="btn btn-sm btn-icon" onClick={() => setShowDetail(v => !v)} title="Tautan tim & warna pita" aria-expanded={showDetail} style={{ padding: '3px 5px' }}>⋯</button>
          <BtnIcon onClick={() => onPindah('atas')} disabled={indeks === 0} title="Pindah ke atas">↑</BtnIcon>
          <BtnIcon onClick={() => onPindah('bawah')} disabled={indeks === total - 1} title="Pindah ke bawah">↓</BtnIcon>
          <BtnIcon onClick={onHapus} title="Hapus anggota (semua tugasnya ikut terhapus)" warn>✕</BtnIcon>
        </div>
        {/* Nama ditengahkan (horizontal + vertikal, mengisi sisa tinggi blok orang) supaya langsung terbaca
            meski blok kosong/belum diisi. `<textarea>` (BUKAN `<input>`) supaya nama panjang membungkus ke
            baris ke-2 alih-alih terpotong/menggeser tata letak — Enter tetap menyimpan (blur), TIDAK bikin
            baris baru manual (dicegah lewat preventDefault), biar wrap-nya murni otomatis dari CSS. */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2px 0', minHeight: 36 }}>
          <textarea value={nama} onChange={e => setNama(e.target.value)} onBlur={simpanNama}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.currentTarget.blur(); } }}
            aria-label="Nama anggota" rows={2} style={{
              ...selInput, width: '100%', textAlign: 'center', fontWeight: 800, fontSize: 14, lineHeight: 1.3,
              resize: 'none', overflow: 'hidden', wordBreak: 'break-word',
            }} />
        </div>
        {showDetail && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingTop: 4, borderTop: '1px dashed var(--border-2)', flex: 'none' }}>
            <label style={{ fontSize: 10, color: 'var(--text-3)' }}>
              Tautan tim{o.tim_divisi ? ` (${o.tim_divisi})` : ''}
              <select value={o.tim_id ?? ''} onChange={e => onUbah({ tim_id: e.target.value === '' ? null : Number(e.target.value) })}
                aria-label="Tautkan ke anggota tim" title="Tautkan ke anggota tim (opsional — kosongkan untuk freelancer)"
                style={{ display: 'block', width: '100%', fontSize: 11, padding: '3px 4px', marginTop: 2 }}>
                <option value="">Tanpa tautan</option>
                {timList.map(m => <option key={m.id} value={m.id}>{m.nama}</option>)}
              </select>
            </label>
            <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
              <input type="color" value={o.warna || '#888888'} onChange={e => onUbah({ warna: e.target.value })} aria-label="Pilih warna pita" style={{ width: 26, height: 22, padding: 0, border: 'none' }} />
              <span style={{ fontSize: 10, color: 'var(--text-3)' }}>Warna pita</span>
              {o.warna && <button type="button" className="btn btn-sm" onClick={() => onUbah({ warna: null })} style={{ marginLeft: 'auto' }}>Otomatis</button>}
            </div>
          </div>
        )}
      </div>
    </td>
  );
}

// ── Blok baris satu orang: sel Nama (rowspan) + baris tugasnya + baris "+ tugas" ──
function BlokOrang({ o, indeks, total, timList, versi, onUbah, onHapus, onPindah, onTambahTugas, onUbahTugas, onHapusTugas, onPindahTugas }) {
  const rowSpan = o.tugas.length + 1; // +1 untuk baris "tambah tugas" — sel Nama ikut menyatu sampai baris itu
  const bg = warnaLatarOrang(o, indeks);
  const selNama = <SelOrang o={o} indeks={indeks} total={total} timList={timList} versi={versi} bg={bg} onUbah={onUbah} onHapus={onHapus} onPindah={onPindah} rowSpan={rowSpan} />;
  return (
    <Fragment>
      {o.tugas.map((t, i) => (
        <BarisTugas key={t.id} t={t} indeks={i} total={o.tugas.length} versi={versi} celNama={i === 0 ? selNama : null} bg={bg} orangId={o.id}
          onUbah={patch => onUbahTugas(t.id, patch)} onHapus={() => onHapusTugas(t.id)} onPindah={arah => onPindahTugas(t.id, arah)} />
      ))}
      <tr data-orang-id={o.id}>
        {o.tugas.length === 0 && selNama}
        <td style={{ ...tdStyle, background: bg, minWidth: 220 }}><KotakTambah placeholder="+ Klien / deskripsi tugas baru…" onTambah={onTambahTugas} /></td>
        <td style={{ ...tdStyle, background: bg }} /><td style={{ ...tdStyle, background: bg }} /><td style={{ ...tdStyle, background: bg }} />
      </tr>
    </Fragment>
  );
}

// ── Satu grup: judul + tabel ──────────────────────────────────────────────────
function GrupTable({ g, indeks, total, timList, versi, onUbah, onHapus, onPindah, onTambahOrang, onUbahOrang, onHapusOrang, onPindahOrang, onTambahTugas, onUbahTugas, onHapusTugas, onPindahTugas }) {
  const [nama, setNama] = useState(g.nama);
  useEffect(() => { setNama(g.nama); }, [g.nama, versi]);
  const simpanNama = () => { const v = nama.trim(); if (v && v !== g.nama) onUbah({ nama: v }); else setNama(g.nama); };

  const thBanner = { ...thStyle, background: 'var(--tl-banner-bg)', color: 'var(--tl-banner-text)', borderBottom: 'none' };
  return (
    // `minWidth: 0` WAJIB di sini: item grid (kolom 2-tabel di Timeline()) defaultnya `min-width: auto`,
    // artinya browser TAK AKAN menyusutkan kolom grid di bawah lebar intrinsik tabel di dalamnya — akibatnya
    // `overflowX:auto` pada div tabel di bawah tak pernah aktif (kolomnya malah ikut melebar/terpotong oleh
    // `overflow:hidden` di sini). `minWidth: 0` memaksa kartu ini mengikuti lebar kolom grid yang sebenarnya,
    // baru scroll horizontal internal tabel berfungsi.
    <div className="card" data-grup-id={g.id} style={{ padding: 0, overflow: 'hidden', minWidth: 0 }}>
      <div style={{ background: 'var(--tl-banner-bg)', color: 'var(--tl-banner-text)', padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 13, letterSpacing: '.05em', flex: 'none' }}>TIMELINE</span>
        <input value={nama} onChange={e => setNama(e.target.value)} onBlur={simpanNama} onKeyDown={e => e.key === 'Enter' && e.currentTarget.blur()}
          aria-label="Nama grup" style={{
            ...selInput, color: 'inherit', fontWeight: 800, fontSize: 13, letterSpacing: '.05em', textTransform: 'uppercase',
            flex: 1, minWidth: 80, padding: '5px 6px',
          }} />
        <span style={{ fontSize: 11, fontWeight: 600, flex: 'none' }}>{g.orang.length} anggota</span>
        <BtnIcon onClick={() => onPindah('atas')} disabled={indeks === 0} title="Pindah grup ke atas">↑</BtnIcon>
        <BtnIcon onClick={() => onPindah('bawah')} disabled={indeks === total - 1} title="Pindah grup ke bawah">↓</BtnIcon>
        <BtnIcon onClick={onHapus} title="Hapus grup (semua anggota & tugasnya ikut terhapus)" warn>✕</BtnIcon>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th style={thBanner}>Nama</th>
              <th style={thBanner}>Nama Klien</th>
              <th style={{ ...thBanner, textAlign: 'right' }}>Poin</th>
              <th style={thBanner}>Urgensi</th>
              <th style={thBanner}></th>
            </tr>
          </thead>
          <tbody>
            {g.orang.map((o, i) => (
              <BlokOrang key={o.id} o={o} indeks={i} total={g.orang.length} timList={timList} versi={versi}
                onUbah={patch => onUbahOrang(o.id, patch)} onHapus={() => onHapusOrang(o.id)} onPindah={arah => onPindahOrang(o.id, arah)}
                onTambahTugas={deskripsi => onTambahTugas(o.id, deskripsi)}
                onUbahTugas={onUbahTugas} onHapusTugas={onHapusTugas} onPindahTugas={onPindahTugas} />
            ))}
            <tr>
              <td style={{ ...tdStyle, borderBottom: 'none' }} colSpan={5}>
                <KotakTambah placeholder="+ Nama anggota / freelancer baru…" onTambah={nama2 => onTambahOrang(g.id, nama2)} style={{ padding: '7px 4px', fontWeight: 600 }} />
              </td>
            </tr>
          </tbody>
        </table>
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
          atau target poin di modul Guild. Klik sel untuk mengetik, tersimpan otomatis saat pindah fokus.
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
        // Grid 2 kolom (meniru referensi spreadsheet — grup berdampingan, bukan bertumpuk penuh-lebar).
        // Ambang 700px (BUKAN 480px) sengaja lebih lebar dari yang "muat pas-pasan": tabel per grup butuh
        // ±670px agar SEMUA kolom (Nama, Nama Klien, Poin, Urgensi, tombol aksi) tampil tanpa scroll
        // horizontal internal — kalau ambangnya cuma 480px, di layar umum ~1400px kedua kolom cuma dapat
        // ±550px, cukup lebar untuk "terlihat 2 kolom" tapi bikin tombol hapus/pindah selalu ketutup di
        // luar layar (harus discroll tiap mau pakai, mengganggu). Jadi baru pecah 2 kolom kalau BENAR
        // cukup lebar untuk keduanya tampil penuh; kalau tidak, otomatis balik ke 1 kolom penuh-lebar
        // (lewat `minmax(min(700px,100%),1fr)` — bagian `min(...,100%)` mencegah overflow di layar sangat
        // sempit seperti ponsel). `alignItems:'start'` supaya tinggi tiap kartu ikut isinya sendiri — grup
        // dengan banyak anggota tak memaksa grup sebelah ikut setinggi itu (sama seperti referensi).
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(700px, 100%), 1fr))', gap: 16, alignItems: 'start' }}>
          {data.map((g, i) => (
            <GrupTable key={g.id} g={g} indeks={i} total={data.length} timList={timAktif} versi={versi}
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
          <div className="card" style={{ gridColumn: '1 / -1' }}>
            <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>+ Grup baru</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <KotakTambah placeholder="Nama grup (mis. Freelance 2D)…" onTambah={nama => aksi(() => api.timelineBuatGrup(nama), `Grup "${nama}" dibuat`)}
                style={{ border: '1px solid var(--border-2)', borderRadius: 8, padding: '7px 10px' }} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
