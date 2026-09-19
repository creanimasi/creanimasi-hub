import { useState, useEffect, useMemo } from 'react';
import '../../styles/rpg-components.css';
import { rpgGuard } from '../../components/RpgState';
import { useAdminQuests, useAdminReview, useAdminAchievements } from '../../hooks/useRpg';
import { api } from '../../../../services/api';
import { useToast } from '../../../../hooks/useToast';

const pixbox = {
  background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)',
  boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.35), inset -2px -2px 0 rgba(0,0,0,.4), 3px 3px 0 var(--rpg-bg-3)',
};
const hud = { fontFamily: 'var(--rpg-font-hud)' };
const IKON = [['target', 'Target'], ['shield', 'Perisai'], ['board', 'Papan'], ['badge', 'Lencana'], ['sync', 'Ulang']];
const TIPE_LABEL = { proyek: 'Proyek', sekali: 'Sekali' };
const pesanError = (e) => (e?.message || 'Terjadi kesalahan').replace(/^\d{3}: /, '');

function Btn({ children, onClick, kind = 'ghost', disabled, type = 'button', small }) {
  const warna = {
    gold:  { background: 'var(--rpg-gold)', color: '#1a1206', border: '2px solid var(--rpg-gold)' },
    ghost: { background: 'var(--rpg-bg-3)', color: 'var(--rpg-ink-dim)', border: '2px solid var(--rpg-line-dim)' },
    ok:    { background: 'var(--rpg-success)', color: '#08240f', border: '2px solid var(--rpg-success)' },
    warn:  { background: 'transparent', color: 'var(--rpg-warn)', border: '2px solid var(--rpg-warn)' },
  }[kind];
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      ...hud, fontSize: small ? '.95rem' : '1.05rem', cursor: disabled ? 'not-allowed' : 'pointer',
      padding: small ? '.2rem .7rem' : '.4rem 1rem', opacity: disabled ? .55 : 1, ...warna,
    }}>{children}</button>
  );
}

const inputStyle = {
  ...hud, fontSize: '1.05rem', width: '100%', boxSizing: 'border-box', color: 'var(--rpg-ink)',
  background: 'var(--rpg-bg)', border: '2px solid var(--rpg-line-dim)', padding: '.4rem .6rem',
};
// CSS global "input" melebarkan semua input; checkbox harus tetap selebar kotaknya.
const cbStyle = { width: 'auto', flex: 'none', margin: 0, cursor: 'pointer' };
// Tanggal lokal → 'YYYY-MM-DD' (toISOString memakai UTC dan bisa mundur sehari di WIB)
const isoLokal = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const tambahHari = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return isoLokal(d); };
const labelTanggal = (iso) => new Date(iso + 'T00:00:00').toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const PILIHAN_TENGGAT = [['Hari ini', 0], ['Besok', 1], ['+3 hari', 3], ['+1 minggu', 7], ['+2 minggu', 14]];

// Pemilih tanggal: klik di mana saja pada kolom membuka kalender (bukan hanya ikon kecil di ujung),
// plus tombol pintas untuk tenggat yang umum dan tombol hapus.
function TenggatField({ value, onChange }) {
  const bukaKalender = (e) => { try { e.currentTarget.showPicker(); } catch { /* browser lama: tetap bisa ketik / pakai ikon */ } };
  return (
    <div>
      <Field label="Tenggat (opsional)">
        <input style={{ ...inputStyle, colorScheme: 'dark', cursor: 'pointer' }} type="date" value={value}
          onChange={(e) => onChange(e.target.value)} onClick={bukaKalender} />
      </Field>
      <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap', marginTop: '.4rem' }}>
        {PILIHAN_TENGGAT.map(([t, n]) => (
          <button key={t} type="button" onClick={() => onChange(tambahHari(n))} aria-pressed={value === tambahHari(n)} style={{
            ...hud, fontSize: '.9rem', cursor: 'pointer', padding: '.1rem .5rem',
            background: value === tambahHari(n) ? 'var(--rpg-gold)' : 'var(--rpg-bg-3)',
            color: value === tambahHari(n) ? '#1a1206' : 'var(--rpg-ink-dim)',
            border: `2px solid ${value === tambahHari(n) ? 'var(--rpg-gold)' : 'var(--rpg-line-dim)'}`,
          }}>{t}</button>
        ))}
        {value && (
          <button type="button" onClick={() => onChange('')} style={{
            ...hud, fontSize: '.9rem', cursor: 'pointer', padding: '.1rem .5rem', background: 'transparent',
            color: 'var(--rpg-warn)', border: '2px solid var(--rpg-warn)',
          }}>Hapus</button>
        )}
      </div>
      <div style={{ ...hud, fontSize: '.9rem', color: 'var(--rpg-ink-faint)', marginTop: '.3rem' }}>
        {value ? labelTanggal(value) : 'Tanpa tenggat'}
      </div>
    </div>
  );
}

function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-dim)', display: 'block', marginBottom: '.25rem' }}>{label}</span>
      {children}
      {hint && <span style={{ ...hud, fontSize: '.9rem', color: 'var(--rpg-ink-faint)', display: 'block', marginTop: '.2rem' }}>{hint}</span>}
    </label>
  );
}

function Modal({ title, onClose, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: 'fixed', inset: 0, background: 'rgba(5,6,16,.72)', zIndex: 1000, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="rpg-pixbox" style={{
        ...pixbox, width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', padding: '1.3rem', color: 'var(--rpg-ink)',
      }}>
        <h2 style={{ fontFamily: 'var(--rpg-font-display)', fontWeight: 400, fontSize: '.8rem', margin: '0 0 1rem', lineHeight: 1.6 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}

// Daftar anggota aktif (dari /tim) — dipakai untuk memilih penerima quest & achievement.
function useAnggota() {
  const [state, setState] = useState({ rows: [], error: null, loading: true });
  useEffect(() => {
    let batal = false;
    api.getTim().then(r => { if (!batal) setState({ rows: (r.data || []).filter(t => t.aktif !== false), error: null, loading: false }); })
      .catch(e => { if (!batal) setState({ rows: [], error: pesanError(e), loading: false }); });
    return () => { batal = true; };
  }, []);
  return state;
}

function MemberPicker({ anggota, terpilih, setTerpilih }) {
  const [cari, setCari] = useState('');
  const kelompok = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const m = {};
    anggota.rows.filter(t => !q || t.nama.toLowerCase().includes(q)).forEach(t => { (m[t.divisi] = m[t.divisi] || []).push(t); });
    return Object.entries(m).sort(([a], [b]) => a.localeCompare(b));
  }, [anggota.rows, cari]);
  const toggle = (id) => setTerpilih(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleDivisi = (rows) => setTerpilih(s => {
    const n = new Set(s); const semua = rows.every(r => n.has(r.id));
    rows.forEach(r => semua ? n.delete(r.id) : n.add(r.id)); return n;
  });
  if (anggota.loading) return <p style={{ ...hud, color: 'var(--rpg-ink-faint)' }}>Memuat anggota…</p>;
  if (anggota.error) return <p style={{ ...hud, color: 'var(--rpg-warn)' }}>Gagal memuat anggota: {anggota.error}</p>;
  return (
    <div>
      <input style={inputStyle} placeholder="Cari nama…" value={cari} onChange={e => setCari(e.target.value)} aria-label="Cari anggota" />
      <div style={{ maxHeight: 220, overflowY: 'auto', border: '2px solid var(--rpg-line-dim)', marginTop: '.5rem', padding: '.4rem .6rem' }}>
        {kelompok.length === 0 && <p style={{ ...hud, color: 'var(--rpg-ink-faint)', margin: '.3rem 0' }}>Tidak ada anggota cocok.</p>}
        {kelompok.map(([divisi, rows]) => (
          <div key={divisi} style={{ marginBottom: '.5rem' }}>
            <label style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-gold)', display: 'flex', gap: '.5rem', alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" style={cbStyle} checked={rows.every(r => terpilih.has(r.id))} onChange={() => toggleDivisi(rows)} />
              {divisi} ({rows.length})
            </label>
            {rows.map(r => (
              <label key={r.id} style={{ ...hud, fontSize: '1.02rem', color: 'var(--rpg-ink)', display: 'flex', gap: '.5rem', alignItems: 'center', padding: '.1rem 0 .1rem 1.4rem', cursor: 'pointer' }}>
                <input type="checkbox" style={cbStyle} checked={terpilih.has(r.id)} onChange={() => toggle(r.id)} />
                {r.nama}
              </label>
            ))}
          </div>
        ))}
      </div>
      <div style={{ ...hud, fontSize: '.95rem', color: 'var(--rpg-ink-faint)', marginTop: '.3rem' }}>{terpilih.size} anggota dipilih</div>
    </div>
  );
}

function QuestFormModal({ quest, anggota, onClose, onSaved }) {
  const { showToast } = useToast();
  const edit = !!quest;
  const [f, setF] = useState({
    judul: quest?.judul || '', deskripsi: quest?.deskripsi || '', tipe: quest?.tipe || 'proyek',
    xp: quest?.xp ?? 100, tenggat: quest?.tenggat || '', ikon: quest?.ikon || 'target',
  });
  const [terpilih, setTerpilih] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF(s => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    const xp = Number(f.xp);
    if (!f.judul.trim()) return setErr('Judul wajib diisi');
    if (!Number.isInteger(xp) || xp < 1 || xp > 1000) return setErr('XP harus bilangan bulat 1–1000');
    setErr(''); setSaving(true);
    try {
      const body = { judul: f.judul.trim(), deskripsi: f.deskripsi, tipe: f.tipe, xp, tenggat: f.tenggat || null, ikon: f.ikon };
      if (edit) await api.rpgAdminUbahQuest(quest.id, body);
      else await api.rpgAdminBuatQuest({ ...body, tim_ids: [...terpilih] });
      showToast(edit ? 'Quest diperbarui' : `Quest dibuat${terpilih.size ? ` dan ditugaskan ke ${terpilih.size} anggota` : ''}`);
      onSaved();
    } catch (ex) { setErr(pesanError(ex)); setSaving(false); }
  };

  return (
    <Modal title={edit ? 'UBAH QUEST' : 'QUEST BARU'} onClose={onClose}>
      <form onSubmit={submit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '.8rem' }}>
        <Field label="Judul"><input style={inputStyle} value={f.judul} onChange={set('judul')} maxLength={150} autoFocus /></Field>
        <Field label="Deskripsi (opsional)"><textarea style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }} value={f.deskripsi} onChange={set('deskripsi')} maxLength={2000} /></Field>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '.8rem' }}>
          <Field label="Tipe">
            <select style={inputStyle} value={f.tipe} onChange={set('tipe')}>
              <option value="proyek">Proyek — tugas klien/produksi</option>
              <option value="sekali">Sekali — tantangan satu kali</option>
            </select>
          </Field>
          <Field label="XP hadiah" hint="1–1000">
            <input style={inputStyle} type="number" min="1" max="1000" value={f.xp} onChange={set('xp')} />
          </Field>
          <TenggatField value={f.tenggat} onChange={(v) => setF(s => ({ ...s, tenggat: v }))} />
          <Field label="Ikon">
            <select style={inputStyle} value={f.ikon} onChange={set('ikon')}>{IKON.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
          </Field>
        </div>
        {edit
          ? <p style={{ ...hud, fontSize: '.95rem', color: 'var(--rpg-ink-faint)', margin: 0 }}>Perubahan XP hanya berlaku untuk persetujuan berikutnya; XP yang sudah diberikan tidak berubah. Gunakan tombol “Tugaskan” untuk menambah penerima.</p>
          : <Field label="Tugaskan ke" hint="Boleh dikosongkan, bisa ditugaskan nanti."><MemberPicker anggota={anggota} terpilih={terpilih} setTerpilih={setTerpilih} /></Field>}
        {err && <p role="alert" style={{ ...hud, color: 'var(--rpg-warn)', margin: 0 }}>{err}</p>}
        <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'flex-end' }}>
          <Btn onClick={onClose} disabled={saving}>Batal</Btn>
          <Btn type="submit" kind="gold" disabled={saving}>{saving ? 'Menyimpan…' : (edit ? 'Simpan' : 'Buat quest')}</Btn>
        </div>
      </form>
    </Modal>
  );
}

function TugaskanModal({ quest, anggota, onClose, onSaved }) {
  const { showToast } = useToast();
  const [terpilih, setTerpilih] = useState(new Set());
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const submit = async () => {
    if (!terpilih.size) return setErr('Pilih minimal satu anggota');
    setSaving(true); setErr('');
    try {
      const r = await api.rpgAdminTugaskan(quest.id, [...terpilih]);
      const n = r.data?.ditugaskan ?? 0;
      showToast(n ? `Ditugaskan ke ${n} anggota` : 'Semua anggota terpilih sudah punya quest ini', n ? 'success' : 'info');
      onSaved();
    } catch (ex) { setErr(pesanError(ex)); setSaving(false); }
  };
  return (
    <Modal title={`TUGASKAN: ${quest.judul}`} onClose={onClose}>
      <MemberPicker anggota={anggota} terpilih={terpilih} setTerpilih={setTerpilih} />
      {err && <p role="alert" style={{ ...hud, color: 'var(--rpg-warn)' }}>{err}</p>}
      <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
        <Btn onClick={onClose} disabled={saving}>Batal</Btn>
        <Btn kind="gold" onClick={submit} disabled={saving}>{saving ? 'Menugaskan…' : 'Tugaskan'}</Btn>
      </div>
    </Modal>
  );
}

function QuestTab({ anggota, onChanged }) {
  const res = useAdminQuests();
  const { showToast } = useToast();
  const [modal, setModal] = useState(null); // {type:'baru'|'ubah'|'tugas', quest}
  const guard = res.data ? null : rpgGuard(res);
  const selesai = () => { setModal(null); res.reload(); onChanged(); };

  const toggleAktif = async (q) => {
    try { await api.rpgAdminUbahQuest(q.id, { aktif: !q.aktif }); showToast(q.aktif ? 'Quest dinonaktifkan' : 'Quest diaktifkan'); res.reload(); }
    catch (e) { showToast(pesanError(e), 'error'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div><Btn kind="gold" onClick={() => setModal({ type: 'baru' })}>+ Quest baru</Btn></div>
      {guard}
      {res.data && res.data.length === 0 && (
        <div className="rpg-pixbox" style={{ ...pixbox, padding: '1.2rem', ...hud, color: 'var(--rpg-ink-dim)', fontSize: '1.1rem' }}>
          Belum ada quest. Buat quest pertama lalu tugaskan ke anggota — mereka akan melihatnya di Papan Quest.
        </div>
      )}
      {res.data && res.data.map(q => (
        <div key={q.id} className="rpg-pixbox" style={{ ...pixbox, padding: '.9rem 1.1rem', ...(q.aktif ? {} : { borderStyle: 'dashed', borderColor: 'var(--rpg-line-dim)' }) }}>
          <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '.98rem', color: 'var(--rpg-ink)' }}>{q.judul}</div>
              <div style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-faint)', marginTop: '.25rem' }}>
                {TIPE_LABEL[q.tipe]} · <span style={{ color: 'var(--rpg-success)' }}>+{q.xp} XP</span> · {q.tenggat ? `tenggat ${q.tenggat}` : 'tanpa tenggat'}{!q.aktif && ' · NONAKTIF'}
              </div>
              <div style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-dim)', marginTop: '.25rem' }}>
                {q.ditugaskan} ditugaskan · {q.menunggu} menunggu persetujuan · {q.selesai} selesai
              </div>
            </div>
            <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              <Btn small onClick={() => setModal({ type: 'tugas', quest: q })}>Tugaskan</Btn>
              <Btn small onClick={() => setModal({ type: 'ubah', quest: q })}>Ubah</Btn>
              <Btn small kind={q.aktif ? 'warn' : 'ok'} onClick={() => toggleAktif(q)}>{q.aktif ? 'Nonaktifkan' : 'Aktifkan'}</Btn>
            </div>
          </div>
        </div>
      ))}
      {modal?.type === 'baru' && <QuestFormModal anggota={anggota} onClose={() => setModal(null)} onSaved={selesai} />}
      {modal?.type === 'ubah' && <QuestFormModal quest={modal.quest} anggota={anggota} onClose={() => setModal(null)} onSaved={selesai} />}
      {modal?.type === 'tugas' && <TugaskanModal quest={modal.quest} anggota={anggota} onClose={() => setModal(null)} onSaved={selesai} />}
    </div>
  );
}

function ReviewTab({ res, onChanged }) {
  const { showToast } = useToast();
  const [busy, setBusy] = useState(null);
  const [tolakId, setTolakId] = useState(null);
  const [alasan, setAlasan] = useState('');
  const guard = res.data ? null : rpgGuard(res);

  const putuskan = async (row, status) => {
    if (status === 'ditolak' && !alasan.trim()) return showToast('Alasan penolakan wajib diisi', 'error');
    setBusy(row.id);
    try {
      await api.rpgAdminPutuskan(row.id, status, status === 'ditolak' ? alasan.trim() : undefined);
      showToast(status === 'disetujui' ? `${row.nama} mendapat +${row.xp} XP` : 'Pengajuan ditolak');
      setTolakId(null); setAlasan(''); res.reload(); onChanged();
    } catch (e) { showToast(pesanError(e), 'error'); res.reload(); }
    finally { setBusy(null); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {guard}
      {res.data && res.data.length === 0 && (
        <div className="rpg-pixbox" style={{ ...pixbox, padding: '1.2rem', ...hud, color: 'var(--rpg-ink-dim)', fontSize: '1.1rem' }}>
          Tidak ada pengajuan yang menunggu. 🎉
        </div>
      )}
      {res.data && res.data.map(r => (
        <div key={r.id} className="rpg-pixbox" style={{ ...pixbox, padding: '.9rem 1.1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
            <div style={{ flex: '1 1 260px', minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '.98rem' }}>{r.judul} <span style={{ ...hud, color: 'var(--rpg-success)' }}>+{r.xp} XP</span></div>
              <div style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-dim)', marginTop: '.2rem' }}>
                {r.nama} · {r.divisi} · diajukan {new Date(r.diajukan_pada).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}
              </div>
              {r.catatan_anggota && <div style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-faint)', marginTop: '.3rem' }}>“{r.catatan_anggota}”</div>}
            </div>
            {tolakId !== r.id && (
              <div style={{ display: 'flex', gap: '.5rem' }}>
                <Btn small kind="ok" disabled={busy === r.id} onClick={() => putuskan(r, 'disetujui')}>Setujui</Btn>
                <Btn small kind="warn" disabled={busy === r.id} onClick={() => { setTolakId(r.id); setAlasan(''); }}>Tolak</Btn>
              </div>
            )}
          </div>
          {tolakId === r.id && (
            <div style={{ marginTop: '.7rem', display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
              <input style={{ ...inputStyle, flex: '1 1 240px', width: 'auto' }} autoFocus placeholder="Alasan penolakan (wajib, dilihat anggota)" value={alasan}
                onChange={e => setAlasan(e.target.value)} onKeyDown={e => e.key === 'Enter' && putuskan(r, 'ditolak')} maxLength={1000} />
              <Btn small kind="warn" disabled={busy === r.id} onClick={() => putuskan(r, 'ditolak')}>Kirim penolakan</Btn>
              <Btn small onClick={() => setTolakId(null)}>Batal</Btn>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

const SYARAT = {
  manual: () => 'Diberikan manual oleh admin',
  quest_count: (n) => `Otomatis: ${n} quest disetujui`,
  streak: (n) => `Otomatis: ${n} hari kerja berturut-turut lapor harian`,
  level: (n) => `Otomatis: mencapai Level ${n}`,
  friday_wins: (n) => `Otomatis: menerima ${n} Friday Win`,
  topguild: () => 'Otomatis: peringkat 1 XP mingguan (minggu yang sudah lewat)',
};

function AchievementTab({ anggota }) {
  const res = useAdminAchievements();
  const { showToast } = useToast();
  const [timId, setTimId] = useState({});
  const [busy, setBusy] = useState(null);
  const guard = res.data ? null : rpgGuard(res);

  const beri = async (a) => {
    const id = timId[a.code];
    if (!id) return showToast('Pilih anggota dulu', 'error');
    setBusy(a.code);
    try { await api.rpgAdminGrant(a.code, Number(id)); showToast(`“${a.label}” diberikan`); res.reload(); }
    catch (e) { showToast(pesanError(e), 'error'); }
    finally { setBusy(null); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {guard}
      {res.data && res.data.map(a => (
        <div key={a.code} className="rpg-pixbox" style={{ ...pixbox, padding: '.9rem 1.1rem' }}>
          <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <div style={{ flex: '1 1 240px', minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '.98rem' }}>{a.label}</div>
              <div style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-faint)', marginTop: '.2rem' }}>
                {(SYARAT[a.syarat_tipe] || (() => a.deskripsi))(a.syarat_nilai)} · {a.terbuka} anggota terbuka
              </div>
            </div>
            {a.syarat_tipe === 'manual' && (
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                <select style={{ ...inputStyle, width: 220 }} aria-label={`Anggota penerima ${a.label}`} value={timId[a.code] || ''} onChange={e => setTimId(s => ({ ...s, [a.code]: e.target.value }))}>
                  <option value="">Pilih anggota…</option>
                  {anggota.rows.map(t => <option key={t.id} value={t.id}>{t.nama} — {t.divisi}</option>)}
                </select>
                <Btn small kind="gold" disabled={busy === a.code} onClick={() => beri(a)}>Berikan</Btn>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// Halaman admin RPG: kelola quest, setujui pengajuan, beri achievement manual (hak akses rpg-admin).
export default function RpgKelolaPage() {
  const [tab, setTab] = useState('quest');
  const anggota = useAnggota();
  const review = useAdminReview();
  const menunggu = review.data?.length || 0;

  // Pengajuan baru masuk kapan saja — muat ulang saat tab Persetujuan dibuka dan saat tab browser aktif lagi.
  const { reload } = review;
  useEffect(() => { if (tab === 'review') reload(); }, [tab]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const tabs = [['quest', 'Quest'], ['review', `Persetujuan${menunggu ? ` (${menunggu})` : ''}`], ['achievement', 'Achievement']];

  return (
    <div className="rpg-page" style={{ fontFamily: 'var(--rpg-font-body)', color: 'var(--rpg-ink)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div>
          <h1 style={{ fontFamily: 'var(--rpg-font-display)', fontWeight: 400, fontSize: 'clamp(1rem, 2.4vw, 1.4rem)', margin: '0 0 .6rem' }}>KELOLA RPG</h1>
          <p style={{ ...hud, fontSize: '1.1rem', color: 'var(--rpg-ink-dim)', margin: 0, maxWidth: '62ch' }}>
            Buat dan tugaskan quest, setujui pengajuan anggota (XP baru masuk setelah disetujui), dan beri achievement manual.
          </p>
        </div>
        <div role="tablist" style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
          {tabs.map(([k, t]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)} style={{
              ...hud, fontSize: '1.05rem', cursor: 'pointer',
              color: tab === k ? '#1a1206' : 'var(--rpg-ink-dim)',
              background: tab === k ? 'var(--rpg-gold)' : 'var(--rpg-bg-2)',
              border: `2px solid ${tab === k ? 'var(--rpg-gold)' : 'var(--rpg-line-dim)'}`, padding: '.4rem 1rem',
            }}>{t}</button>
          ))}
        </div>
        {tab === 'quest' && <QuestTab anggota={anggota} onChanged={review.reload} />}
        {tab === 'review' && <ReviewTab res={review} onChanged={() => {}} />}
        {tab === 'achievement' && <AchievementTab anggota={anggota} />}
      </div>
    </div>
  );
}
