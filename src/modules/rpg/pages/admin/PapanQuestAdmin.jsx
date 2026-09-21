import { useState, useMemo, useEffect, useLayoutEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import '../../styles/rpg-components.css';
import { rpgGuard } from '../../components/RpgState';
import { usePapan } from '../../hooks/useRpg';
import { api } from '../../../../services/api';
import { useToast } from '../../../../hooks/useToast';
import { useAuth } from '../../../../hooks/useAuth';
import RpgModal from '../../components/RpgModal';
import { lalu } from '../../utils/waktu';
import UrgensiChip from '../../components/UrgensiChip';
import { URGENSI } from '../../utils/urgensi';
import TargetBar from '../../components/TargetBar';
import { angka, kunciStatus, STATUS_TARGET } from '../../utils/target';

const hud = { fontFamily: 'var(--rpg-font-hud)' };
const STATUS = {
  diajukan:  { label: 'MENUNGGU', filter: 'Menunggu', warna: 'var(--rpg-gold)' },
  ditolak:   { label: 'PERLU PERBAIKAN', filter: 'Perlu perbaikan', warna: 'var(--rpg-warn)' },
  aktif:     { label: 'AKTIF', filter: 'Aktif', warna: 'var(--rpg-stat-kolaborasi)' },
  disetujui: { label: 'SELESAI', filter: 'Selesai', warna: 'var(--rpg-success)' },
};
const URUT = ['diajukan', 'ditolak', 'aktif', 'disetujui'];
const LEBAR_KOLOM = 290;
const pesanError = (e) => (e?.message || 'Terjadi kesalahan').replace(/^\d{3}: /, '');
const inisial = (nama) => nama.split(/\s+/).map(w => w[0]).slice(0, 2).join('').toUpperCase();

const FILTER_AWAL = { divisi: [], q: '', tipe: 'Semua', urg: 1, kosong: false, status: URUT }; // divisi kosong = semua divisi

// Filter dibaca dari URL saat halaman dibuka (tautan/bookmark), atau dari divisi terakhir yang diingat.
function filterDariUrl(params) {
  const dari = (params.get('status') || '').split(',').filter(x => URUT.includes(x));
  // ?divisi=PM atau ?divisi=Admin,PM (tautan lama dengan satu divisi tetap berlaku)
  let divisi = params.get('divisi') || '';
  if (!divisi) { try { divisi = localStorage.getItem('rpg_papan_divisi') || ''; } catch { /* abaikan */ } }
  return {
    divisi: [...new Set(divisi.split(',').map(x => x.trim()).filter(Boolean))], q: params.get('q') || '', tipe: params.get('tipe') || 'Semua',
    urg: (() => { const u = parseInt(params.get('urg'), 10); return u >= 2 && u <= 7 ? u : 1; })(),
    kosong: params.get('kosong') === '1', status: dari.length ? URUT.filter(x => dari.includes(x)) : URUT,
  };
}

function useMobile(px = 760) {
  const q = `(max-width: ${px}px)`;
  const [m, setM] = useState(() => (typeof window !== 'undefined' && window.matchMedia ? window.matchMedia(q).matches : false));
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia(q); const h = (e) => setM(e.matches);
    mq.addEventListener('change', h); setM(mq.matches);
    return () => mq.removeEventListener('change', h);
  }, [q]);
  return m;
}

// Urutan kartu dalam satu kolom: Menunggu (terlama dulu) → Perlu perbaikan → Aktif (tenggat terdekat) → Selesai (terbaru)
function urutKartu(arr) {
  const t = (v) => (v ? new Date(v).getTime() : Infinity);
  return [...arr].sort((a, b) => {
    const s = URUT.indexOf(a.status) - URUT.indexOf(b.status);
    if (s) return s;
    if (a.status === 'disetujui') return t(b.ditinjauPada) - t(a.ditinjauPada) || b.id - a.id;
    const u = (b.urgensi || 0) - (a.urgensi || 0); // urgensi tertinggi di atas
    if (u) return u;
    if (a.status === 'diajukan') return t(a.diajukanPada) - t(b.diajukanPada);
    if (a.status === 'aktif') return t(a.tenggat) - t(b.tenggat) || a.id - b.id;
    return t(b.ditinjauPada) - t(a.ditinjauPada) || b.id - a.id;
  });
}

// Filter divisi pilihan ganda: tombol + daftar kotak centang. Kosong = semua divisi.
function FilterDivisi({ daftar, dipilih, onUbah }) {
  const [buka, setBuka] = useState(false);
  const [kanan, setKanan] = useState(false); // panel menempel ke sisi kanan tombol bila menempel kiri akan keluar layar
  const wadah = useRef(null);
  const tombol = useRef(null);
  useLayoutEffect(() => {
    if (!buka || !wadah.current) return;
    const r = wadah.current.getBoundingClientRect();
    const lebar = Math.min(260, window.innerWidth - 32);
    setKanan(r.left + lebar > window.innerWidth - 8 && r.right - lebar >= 8);
  }, [buka]);
  useEffect(() => {
    if (!buka) return undefined;
    const luar = (e) => { if (wadah.current && !wadah.current.contains(e.target)) setBuka(false); };
    const esc = (e) => { if (e.key === 'Escape') { setBuka(false); tombol.current?.focus(); } };
    document.addEventListener('mousedown', luar);
    document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('mousedown', luar); document.removeEventListener('keydown', esc); };
  }, [buka]);
  const ringkas = dipilih.length === 0 ? 'Semua divisi' : dipilih.length <= 2 ? dipilih.join(', ') : `${dipilih.length} divisi`;
  const toggle = (x) => onUbah(dipilih.includes(x) ? dipilih.filter(y => y !== x) : daftar.filter(y => y === x || dipilih.includes(y)));
  return (
    <div ref={wadah} style={{ position: 'relative' }}>
      <button ref={tombol} type="button" aria-haspopup="true" aria-expanded={buka} aria-controls="filter-divisi-panel" aria-label={`Filter divisi: ${ringkas}`}
        onClick={() => setBuka(b => !b)} style={{
          fontFamily: 'var(--rpg-font-hud)', fontSize: '1.05rem', cursor: 'pointer', color: 'var(--rpg-ink)', background: 'var(--rpg-bg)',
          border: `2px solid ${dipilih.length ? 'var(--rpg-gold)' : 'var(--rpg-line-dim)'}`, padding: '.35rem .6rem', display: 'flex', gap: '.5rem', alignItems: 'center',
        }}>
        <span>{ringkas}</span><span aria-hidden="true" style={{ color: 'var(--rpg-ink-dim)' }}>{buka ? '▴' : '▾'}</span>
      </button>
      {buka && (
        <div id="filter-divisi-panel" role="group" aria-label="Pilih divisi" style={{
          position: 'absolute', top: 'calc(100% + 4px)', ...(kanan ? { right: 0 } : { left: 0 }), zIndex: 20, width: 'min(260px, calc(100vw - 2rem))', maxHeight: 320, overflowY: 'auto',
          background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)', boxShadow: '3px 3px 0 rgba(0,0,0,.5)', padding: '.5rem .6rem',
        }}>
          <button type="button" onClick={() => onUbah([])} disabled={dipilih.length === 0} style={{
            fontFamily: 'var(--rpg-font-hud)', fontSize: '1rem', cursor: dipilih.length ? 'pointer' : 'default', width: '100%', textAlign: 'left',
            background: 'transparent', color: dipilih.length ? 'var(--rpg-gold)' : 'var(--rpg-ink-faint)', border: 'none', borderBottom: '1px dashed var(--rpg-line-dim)', padding: '.15rem 0 .4rem', marginBottom: '.3rem',
          }}>{dipilih.length ? 'Tampilkan semua divisi' : '✓ Semua divisi ditampilkan'}</button>
          {daftar.map(x => (
            <label key={x} style={{ fontFamily: 'var(--rpg-font-hud)', fontSize: '1.05rem', color: 'var(--rpg-ink)', display: 'flex', gap: '.55rem', alignItems: 'center', padding: '.22rem 0', cursor: 'pointer' }}>
              <input type="checkbox" checked={dipilih.includes(x)} onChange={() => toggle(x)} />
              {x}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}

function Kartu({ k, bisaAksi, onSetujui, onTolak }) {
  const st = STATUS[k.status];
  return (
    <article aria-label={`${k.judul} — ${st.label}`} style={{
      background: 'var(--rpg-bg-3)', border: '2px solid var(--rpg-line-dim)', borderLeft: `5px solid ${st.warna}`,
      padding: '.6rem .7rem', display: 'flex', flexDirection: 'column', gap: '.35rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.5rem', alignItems: 'flex-start' }}>
        <span style={{ fontWeight: 600, fontSize: '.92rem', lineHeight: 1.3, color: 'var(--rpg-ink)', minWidth: 0, overflowWrap: 'anywhere' }}>{k.judul}</span>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '.25rem', flex: 'none' }}>
          <span style={{ ...hud, fontSize: '1.05rem', color: 'var(--rpg-success)', whiteSpace: 'nowrap' }}>+{k.xp} XP</span>
          <UrgensiChip nilai={k.urgensi} />
        </div>
      </div>
      <div style={{ ...hud, fontSize: '.9rem', display: 'flex', gap: '.4rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: st.warna, border: `2px solid ${st.warna}`, padding: '0 .35rem', fontFamily: 'var(--rpg-font-display)', fontSize: '.5rem', lineHeight: 1.8 }}>{st.label}</span>
        <span style={{ color: 'var(--rpg-ink-dim)' }}>{k.tipe === 'proyek' ? 'Proyek' : 'Sekali'}</span>
        {k.status !== 'disetujui' && <span style={{ color: k.warn ? 'var(--rpg-warn)' : 'var(--rpg-ink-dim)' }}>· {k.dueLabel}</span>}
      </div>

      {k.status === 'aktif' && (
        <div>
          <div style={{ height: 6, background: 'var(--rpg-bg)', border: '1px solid var(--rpg-line-dim)' }}>
            <div style={{ height: '100%', width: `${k.progressPct}%`, background: 'var(--rpg-gold)' }} />
          </div>
          <div style={{ ...hud, fontSize: '.9rem', color: 'var(--rpg-ink-dim)', marginTop: '.15rem' }}>{k.progressPct}% dikerjakan</div>
        </div>
      )}
      {k.status === 'diajukan' && (
        <>
          {k.catatanAnggota && <div style={{ ...hud, fontSize: '.98rem', color: 'var(--rpg-ink-dim)', overflowWrap: 'anywhere' }}>“{k.catatanAnggota}”</div>}
          <div style={{ ...hud, fontSize: '.9rem', color: 'var(--rpg-ink-dim)' }}>Diajukan {lalu(k.diajukanPada).toLowerCase()}</div>
          {bisaAksi ? (
            <div style={{ display: 'flex', gap: '.4rem', marginTop: '.15rem' }}>
              <button type="button" onClick={onSetujui} style={{ ...hud, fontSize: '.98rem', cursor: 'pointer', background: 'var(--rpg-success)', color: '#08240f', border: '2px solid var(--rpg-success)', padding: '.1rem .7rem' }}>Setujui</button>
              <button type="button" onClick={onTolak} style={{ ...hud, fontSize: '.98rem', cursor: 'pointer', background: 'transparent', color: 'var(--rpg-warn)', border: '2px solid var(--rpg-warn)', padding: '.1rem .7rem' }}>Tolak</button>
            </div>
          ) : (
            <div style={{ ...hud, fontSize: '.9rem', color: 'var(--rpg-ink-dim)' }}>Menunggu persetujuan admin</div>
          )}
        </>
      )}
      {k.status === 'ditolak' && (
        <div style={{ ...hud, fontSize: '.98rem', color: 'var(--rpg-warn)', overflowWrap: 'anywhere' }}>
          Ditolak{k.catatanReview ? `: ${k.catatanReview}` : ''}
          <div style={{ color: 'var(--rpg-ink-dim)', fontSize: '.9rem' }}>Menunggu perbaikan dari anggota</div>
        </div>
      )}
      {k.status === 'disetujui' && <div style={{ ...hud, fontSize: '.98rem', color: 'var(--rpg-success)' }}>✓ Selesai {lalu(k.ditinjauPada).toLowerCase()}</div>}
    </article>
  );
}

// Ringkas target poin periode berjalan di header kolom (hanya anggota divisi produksi). Status selalu berteks.
function TargetMini({ t, periode }) {
  const status = kunciStatus(t, 'berjalan');
  const teks = STATUS_TARGET[status].teks;
  const jalurPct = periode && periode.hariTotal ? (100 * periode.hariBerjalan) / periode.hariTotal : null;
  return (
    <div style={{ marginTop: '.5rem' }}>
      {t.target
        ? <>
            <div style={{ ...hud, fontSize: '.92rem', color: 'var(--rpg-ink-dim)', display: 'flex', justifyContent: 'space-between', gap: '.5rem', marginBottom: '.25rem' }}>
              <span>Target {angka(t.poin)}/{angka(t.target)} poin · {t.persen}%</span>
              <span style={{ color: STATUS_TARGET[status].warna }}>{teks}</span>
            </div>
            <TargetBar poin={t.poin} target={t.target} status={status} jalurPct={jalurPct} tinggi={8} label="Poin terhadap target periode" />
          </>
        : <div style={{ ...hud, fontSize: '.92rem', color: 'var(--rpg-ink-faint)' }}>
            {t.status === 'dikecualikan' ? 'Dikecualikan dari target periode ini' : 'Target belum ditetapkan'} · {angka(t.poin)} poin
          </div>}
    </div>
  );
}

function Kolom({ k, mobile, bisaAksi, bisaDetail, selesaiTerbuka, onToggleSelesai, onSetujui, onTolak, onDetail, periodeTarget }) {
  const aktif = k.kartu.filter(c => c.status !== 'disetujui');
  const selesai = k.kartu.filter(c => c.status === 'disetujui');
  const hitung = (s) => k.kartu.filter(c => c.status === s).length;
  const cnt = ['diajukan', 'ditolak', 'aktif'].map(s => [s, hitung(s)]).filter(([, n]) => n > 0);
  return (
    <section aria-label={`Board ${k.a.nama}`} className="rpg-pixbox" style={{
      flex: 'none', width: mobile ? '100%' : LEBAR_KOLOM, background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)',
      boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.35), inset -2px -2px 0 rgba(0,0,0,.4), 3px 3px 0 var(--rpg-bg-3)',
      maxHeight: mobile ? 'none' : 'calc(100vh - 260px)', overflowY: mobile ? 'visible' : 'auto', display: 'flex', flexDirection: 'column',
    }}>
      <header style={{ position: mobile ? 'static' : 'sticky', top: 0, background: 'var(--rpg-bg-2)', padding: '.7rem .8rem .6rem', borderBottom: '2px solid var(--rpg-line-dim)', zIndex: 1 }}>
        <div style={{ display: 'flex', gap: '.6rem', alignItems: 'center' }}>
          <div aria-hidden="true" style={{ flex: 'none', width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--rpg-bg-3)', border: '2px solid var(--rpg-line)', fontFamily: 'var(--rpg-font-display)', fontSize: '.55rem', color: 'var(--rpg-gold)' }}>{inisial(k.a.nama)}</div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <h3 style={{ margin: 0, fontWeight: 600, fontSize: '.95rem', color: 'var(--rpg-ink)', overflowWrap: 'anywhere' }}>{k.a.nama}</h3>
            <div style={{ ...hud, fontSize: '.95rem', color: 'var(--rpg-ink-dim)' }}>{k.a.divisi} · Lv{k.a.level}</div>
          </div>
          {bisaDetail && (
            <button type="button" onClick={onDetail} aria-label={`Detail ${k.a.nama}`} style={{ ...hud, fontSize: '.9rem', cursor: 'pointer', background: 'transparent', color: 'var(--rpg-ink-dim)', border: '2px solid var(--rpg-line-dim)', padding: '0 .5rem', flex: 'none' }}>Detail</button>
          )}
        </div>
        <div style={{ ...hud, fontSize: '.92rem', display: 'flex', gap: '.7rem', flexWrap: 'wrap', marginTop: '.4rem' }}>
          {cnt.length === 0 && <span style={{ color: 'var(--rpg-ink-faint)' }}>Tidak ada quest aktif</span>}
          {cnt.map(([s, n]) => <span key={s} style={{ color: STATUS[s].warna }}>{n} {STATUS[s].filter.toLowerCase()}</span>)}
        </div>
        {k.a.target && <TargetMini t={k.a.target} periode={periodeTarget} />}
      </header>
      <div style={{ padding: '.7rem', display: 'flex', flexDirection: 'column', gap: '.6rem' }}>
        {aktif.map(c => <Kartu key={c.id} k={c} bisaAksi={bisaAksi} onSetujui={() => onSetujui(c, k.a)} onTolak={() => onTolak(c, k.a)} />)}
        {selesai.length > 0 && (
          <div>
            <button type="button" aria-expanded={selesaiTerbuka} onClick={onToggleSelesai} style={{ ...hud, fontSize: '1rem', cursor: 'pointer', background: 'transparent', color: 'var(--rpg-success)', border: 'none', padding: '.1rem 0', textAlign: 'left' }}>
              {selesaiTerbuka ? '▾' : '▸'} Selesai ({selesai.length}){k.a.selesaiTotal > selesai.length ? ` · ${k.a.selesaiTotal} total` : ''}
            </button>
            {selesaiTerbuka && <div style={{ display: 'flex', flexDirection: 'column', gap: '.6rem', marginTop: '.5rem' }}>{selesai.map(c => <Kartu key={c.id} k={c} bisaAksi={false} />)}</div>}
          </div>
        )}
      </div>
    </section>
  );
}

// Papan Kanban semua anggota: satu kolom per anggota, kartu = penugasan quest, status di dalam kartu.
export default function PapanQuestAdmin({ atas }) {
  const { user } = useAuth();
  const akses = user?.page_access || [];
  const bisaAksi = akses.includes('rpg-admin');
  const bisaDetail = akses.includes('rpg-pantau');
  const navigate = useNavigate();
  const { showToast } = useToast();
  const mobile = useMobile();
  const res = usePapan();
  const [sp, setSp] = useSearchParams();
  const [terbuka, setTerbuka] = useState(() => new Set());
  const [aksi, setAksi] = useState(null); // { jenis: 'setujui'|'tolak', kartu, anggota }
  const [alasan, setAlasan] = useState('');
  const [busy, setBusy] = useState(false);
  const [pilihMobile, setPilihMobile] = useState(null);

  const d = res.data;
  // Filter disimpan di state React (pembaruan fungsional, selalu dari nilai terbaru → tidak ada perubahan yang
  // saling menimpa); URL hanya cermin agar bisa dibagikan / di-bookmark.
  const [filter, setFilter] = useState(() => filterDariUrl(sp));
  const { divisi, q: cari, tipe, kosong, urg } = filter;
  const statusSet = useMemo(() => new Set(filter.status), [filter.status]);
  const ubah = (kv) => setFilter(prev => {
    const n = { ...prev };
    if ('divisi' in kv) n.divisi = kv.divisi || [];
    if ('q' in kv) n.q = kv.q || '';
    if ('tipe' in kv) n.tipe = kv.tipe || 'Semua';
    if ('urg' in kv) n.urg = Number(kv.urg) >= 2 && Number(kv.urg) <= 7 ? Number(kv.urg) : 1;
    if ('kosong' in kv) n.kosong = kv.kosong === '1';
    return n;
  });
  const ubahStatus = (fn) => setFilter(prev => {
    const set = fn(new Set(prev.status));
    return { ...prev, status: URUT.filter(x => set.has(x)) };
  });

  useEffect(() => {
    const n = new URLSearchParams(window.location.search);
    ['divisi', 'q', 'tipe', 'urg', 'kosong', 'status'].forEach(kk => n.delete(kk));
    if (filter.divisi.length) n.set('divisi', filter.divisi.join(','));
    if (filter.q) n.set('q', filter.q);
    if (filter.tipe !== 'Semua') n.set('tipe', filter.tipe);
    if (filter.urg > 1) n.set('urg', String(filter.urg));
    if (filter.kosong) n.set('kosong', '1');
    if (filter.status.length !== URUT.length) n.set('status', filter.status.join(','));
    if (n.toString() !== window.location.search.replace(/^\?/, '')) setSp(n, { replace: true });
    try { localStorage.setItem('rpg_papan_divisi', filter.divisi.join(',')); } catch { /* abaikan */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  // data berubah kapan saja: segarkan tiap 60 dtk saat tab terlihat, dan saat tab aktif lagi
  const { reload } = res;
  useEffect(() => {
    const t = setInterval(() => { if (!document.hidden) reload(); }, 60000);
    const onVis = () => { if (!document.hidden) reload(); };
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onVis); };
  }, [reload]);

  const kartuPer = useMemo(() => {
    const m = {}; (d?.kartu || []).forEach(k => { (m[k.timId] = m[k.timId] || []).push(k); }); return m;
  }, [d]);
  const divisiList = useMemo(() => [...new Set((d?.anggota || []).map(a => a.divisi))].sort(), [d]);
  // pilihan tersimpan/URL yang divisinya sudah tidak ada diabaikan (bukan menghasilkan papan kosong)
  const divisiDipilih = useMemo(() => divisi.filter(x => divisiList.includes(x)), [divisi, divisiList]);

  // anggota yang lolos filter divisi + pencarian (belum memperhitungkan filter status/tipe)
  const cocok = useMemo(() => {
    const q = cari.trim().toLowerCase();
    return (d?.anggota || []).filter(a => (divisiDipilih.length === 0 || divisiDipilih.includes(a.divisi)) && (!q || a.nama.toLowerCase().includes(q)));
  }, [d, divisiDipilih, cari]);
  const hitung = useMemo(() => {
    const h = { diajukan: 0, ditolak: 0, aktif: 0, disetujui: 0 };
    cocok.forEach(a => (kartuPer[a.id] || []).forEach(k => { if ((tipe === 'Semua' || k.tipe === tipe) && k.urgensi >= urg) h[k.status] += 1; }));
    return h;
  }, [cocok, kartuPer, tipe, urg]);

  const kolom = useMemo(() => cocok
    .map(a => {
      const semua = kartuPer[a.id] || [];
      const kartu = urutKartu(semua.filter(k => statusSet.has(k.status) && (tipe === 'Semua' || k.tipe === tipe) && k.urgensi >= urg));
      return { a, kartu, menunggu: semua.filter(k => k.status === 'diajukan').length };
    })
    .filter(k => k.kartu.length > 0 || kosong), [cocok, kartuPer, statusSet, tipe, urg, kosong]);
  const tersembunyi = cocok.length - kolom.length;

  const grup = useMemo(() => {
    const m = new Map();
    kolom.forEach(k => { const key = k.a.divisi; if (!m.has(key)) m.set(key, []); m.get(key).push(k); });
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b))
      .map(([nama, list]) => ({ nama, list: [...list].sort((x, y) => y.menunggu - x.menunggu || x.a.nama.localeCompare(y.a.nama)) }));
  }, [kolom]);
  const urutan = useMemo(() => grup.flatMap(g => g.list), [grup]);
  const selesaiAuto = statusSet.size === 1 && statusSet.has('disetujui');

  const mobPilih = urutan.find(k => k.a.id === pilihMobile) || urutan[0];

  const toggleStatus = (s) => ubahStatus(set => {
    const n = new Set(set);
    if (n.has(s)) { if (n.size > 1) n.delete(s); } else n.add(s);
    return n;
  });
  const butuhTindakanAktif = statusSet.size === 1 && statusSet.has('diajukan');

  const tutupAksi = () => { setAksi(null); setAlasan(''); };
  const putuskan = async () => {
    if (!aksi) return;
    if (aksi.jenis === 'tolak' && !alasan.trim()) return showToast('Alasan penolakan wajib diisi', 'error');
    setBusy(true);
    try {
      await api.rpgAdminPutuskan(aksi.kartu.id, aksi.jenis === 'setujui' ? 'disetujui' : 'ditolak', aksi.jenis === 'tolak' ? alasan.trim() : undefined);
      showToast(aksi.jenis === 'setujui' ? `${aksi.anggota.nama} mendapat +${aksi.kartu.xp} XP` : 'Quest dikembalikan ke anggota untuk diperbaiki');
    } catch (e) {
      const m = pesanError(e);
      showToast(m, /sudah diproses/i.test(m) ? 'info' : 'error');
    } finally { setBusy(false); tutupAksi(); res.reload(); }
  };

  const guard = d ? null : rpgGuard(res);
  const chipBase = { ...hud, fontSize: '1rem', cursor: 'pointer', padding: '.2rem .8rem', border: '2px solid var(--rpg-line-dim)' };

  return (
    <div className="rpg-page" style={{ fontFamily: 'var(--rpg-font-body)', color: 'var(--rpg-ink)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
        {atas}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--rpg-font-display)', fontWeight: 400, fontSize: 'clamp(1rem, 2.4vw, 1.4rem)', margin: '0 0 .6rem' }}>PAPAN QUEST · SEMUA TIM</h1>
            <p style={{ ...hud, fontSize: '1.1rem', color: 'var(--rpg-ink-dim)', margin: 0, maxWidth: '66ch' }}>
              Satu kolom per anggota; setiap kartu adalah quest yang dipegangnya, dengan statusnya di dalam kartu.
              {bisaAksi ? ' Kartu Menunggu bisa disetujui atau ditolak langsung di sini.' : ' Tampilan hanya-baca.'}
            </p>
          </div>
          {d && <button type="button" onClick={res.retry} style={{ ...chipBase, background: 'var(--rpg-bg-3)', color: 'var(--rpg-ink-dim)' }}>Muat ulang</button>}
        </div>

        {guard}

        {d && (<>
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <input aria-label="Cari anggota" placeholder="Cari anggota…" value={cari} onChange={e => ubah({ q: e.target.value })}
              style={{ ...hud, fontSize: '1.05rem', flex: '1 1 180px', maxWidth: 260, boxSizing: 'border-box', color: 'var(--rpg-ink)', background: 'var(--rpg-bg)', border: '2px solid var(--rpg-line-dim)', padding: '.35rem .6rem' }} />
            <FilterDivisi daftar={divisiList} dipilih={divisiDipilih} onUbah={(v) => ubah({ divisi: v })} />
            <select aria-label="Filter tipe quest" value={tipe} onChange={e => ubah({ tipe: e.target.value === 'Semua' ? null : e.target.value })}
              style={{ ...hud, fontSize: '1.05rem', width: 'auto', color: 'var(--rpg-ink)', background: 'var(--rpg-bg)', border: '2px solid var(--rpg-line-dim)', padding: '.35rem .6rem' }}>
              <option value="Semua">Semua tipe</option><option value="proyek">Proyek</option><option value="sekali">Sekali</option>
            </select>
            <select aria-label="Filter urgensi minimum" value={urg} onChange={e => ubah({ urg: e.target.value })}
              style={{ ...hud, fontSize: '1.05rem', width: 'auto', color: 'var(--rpg-ink)', background: 'var(--rpg-bg)', border: `2px solid ${urg > 1 ? 'var(--rpg-gold)' : 'var(--rpg-line-dim)'}`, padding: '.35rem .6rem' }}>
              <option value={1}>Semua urgensi</option>
              {URGENSI.filter(u => u.n >= 3).map(u => <option key={u.n} value={u.n}>{u.n === 7 ? `Urgensi 7 (${u.nama})` : `Urgensi ≥ ${u.n} (${u.nama}+)`}</option>)}
            </select>
            <label style={{ ...hud, fontSize: '1.02rem', color: 'var(--rpg-ink-dim)', display: 'flex', gap: '.4rem', alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={kosong} onChange={e => ubah({ kosong: e.target.checked ? '1' : null })} />
              Tampilkan anggota tanpa quest
            </label>
          </div>

          <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
            <button type="button" aria-pressed={butuhTindakanAktif} onClick={() => ubahStatus(set => (set.size === 1 && set.has('diajukan') ? new Set(URUT) : new Set(['diajukan'])))} style={{
              ...chipBase, borderColor: 'var(--rpg-gold)', background: butuhTindakanAktif ? 'var(--rpg-gold)' : 'transparent', color: butuhTindakanAktif ? '#1a1206' : 'var(--rpg-gold)',
            }}>Butuh tindakan ({hitung.diajukan})</button>
            <span aria-hidden="true" style={{ color: 'var(--rpg-ink-faint)' }}>|</span>
            {URUT.map(s => {
              const on = statusSet.has(s);
              return (
                <button key={s} type="button" aria-pressed={on} onClick={() => toggleStatus(s)} style={{
                  ...chipBase, borderColor: on ? STATUS[s].warna : 'var(--rpg-line-dim)', color: on ? STATUS[s].warna : 'var(--rpg-ink-faint)', background: 'var(--rpg-bg-2)',
                }}>{on ? '✓ ' : ''}{STATUS[s].filter} ({hitung[s]})</button>
              );
            })}
            {d.belumDitugaskan > 0 && (
              <span style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-dim)', marginLeft: 'auto' }}>
                {d.belumDitugaskan} quest belum ditugaskan{bisaAksi && <> · <button type="button" onClick={() => navigate('/rpg/kelola')} style={{ ...hud, fontSize: '1rem', cursor: 'pointer', background: 'transparent', color: 'var(--rpg-gold)', border: 'none', padding: 0, textDecoration: 'underline' }}>Kelola</button></>}
              </span>
            )}
          </div>

          {kolom.length === 0 && (
            <div className="rpg-pixbox" style={{ background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)', padding: '1.2rem', ...hud, fontSize: '1.1rem', color: 'var(--rpg-ink-dim)' }}>
              {d.kartu.length === 0
                ? 'Belum ada quest yang ditugaskan ke anggota mana pun.'
                : 'Tidak ada kartu yang cocok dengan filter saat ini.'}
              {d.kartu.length > 0 && <> <button type="button" onClick={() => setFilter(FILTER_AWAL)} style={{ ...hud, fontSize: '1.1rem', cursor: 'pointer', background: 'transparent', color: 'var(--rpg-gold)', border: 'none', padding: 0, textDecoration: 'underline' }}>Reset filter</button></>}
            </div>
          )}

          {mobile && kolom.length > 0 && (
            <div>
              <select aria-label="Pilih anggota" value={mobPilih?.a.id} onChange={e => setPilihMobile(Number(e.target.value))}
                style={{ ...hud, fontSize: '1.1rem', width: '100%', color: 'var(--rpg-ink)', background: 'var(--rpg-bg)', border: '2px solid var(--rpg-line-dim)', padding: '.4rem .6rem' }}>
                {urutan.map(k => <option key={k.a.id} value={k.a.id}>{k.a.nama} — {k.a.divisi}{k.menunggu ? ` · ${k.menunggu} menunggu` : ''}</option>)}
              </select>
            </div>
          )}

          {kolom.length > 0 && (mobile ? (
            <Kolom k={mobPilih} mobile bisaAksi={bisaAksi} bisaDetail={bisaDetail} selesaiTerbuka={selesaiAuto || terbuka.has(mobPilih.a.id)}
              onToggleSelesai={() => setTerbuka(s => { const n = new Set(s); n.has(mobPilih.a.id) ? n.delete(mobPilih.a.id) : n.add(mobPilih.a.id); return n; })}
              onSetujui={(c, a) => setAksi({ jenis: 'setujui', kartu: c, anggota: a })} onTolak={(c, a) => { setAlasan(''); setAksi({ jenis: 'tolak', kartu: c, anggota: a }); }}
              onDetail={() => navigate(`/rpg/anggota?id=${mobPilih.a.id}`)} periodeTarget={d?.periodeTarget} />
          ) : (
            <div data-testid="papan-scroll" style={{ overflowX: 'auto', paddingBottom: '.6rem' }}>
              <div style={{ display: 'flex', gap: '1.6rem', alignItems: 'flex-start', width: 'max-content', maxWidth: 'none' }}>
                {grup.map(g => (
                  <div key={g.nama} style={{ flex: 'none' }}>
                    <div style={{ ...hud, fontSize: '1.05rem', color: 'var(--rpg-gold)', borderBottom: '2px solid var(--rpg-gold)', margin: '0 0 .7rem', paddingBottom: '.15rem', textTransform: 'uppercase', letterSpacing: '.04em' }}>
                      {g.nama} <span style={{ color: 'var(--rpg-ink-faint)' }}>· {g.list.length}</span>
                    </div>
                    <div style={{ display: 'flex', gap: '.9rem', alignItems: 'flex-start' }}>
                      {g.list.map(k => (
                        <Kolom key={k.a.id} k={k} bisaAksi={bisaAksi} bisaDetail={bisaDetail} selesaiTerbuka={selesaiAuto || terbuka.has(k.a.id)}
                          onToggleSelesai={() => setTerbuka(s => { const n = new Set(s); n.has(k.a.id) ? n.delete(k.a.id) : n.add(k.a.id); return n; })}
                          onSetujui={(c, a) => setAksi({ jenis: 'setujui', kartu: c, anggota: a })} onTolak={(c, a) => { setAlasan(''); setAksi({ jenis: 'tolak', kartu: c, anggota: a }); }}
                          onDetail={() => navigate(`/rpg/anggota?id=${k.a.id}`)} periodeTarget={d?.periodeTarget} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {tersembunyi > 0 && !kosong && (
            <div style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-faint)' }}>
              {tersembunyi} anggota tanpa kartu yang cocok disembunyikan. <button type="button" onClick={() => ubah({ kosong: '1' })} style={{ ...hud, fontSize: '1rem', cursor: 'pointer', background: 'transparent', color: 'var(--rpg-gold)', border: 'none', padding: 0, textDecoration: 'underline' }}>Tampilkan</button>
            </div>
          )}
          <div style={{ ...hud, fontSize: '.95rem', color: 'var(--rpg-ink-faint)' }}>Kartu Selesai hanya menampilkan {d.selesaiHari} hari terakhir.</div>
        </>)}
      </div>

      {aksi && (
        <RpgModal title={aksi.jenis === 'setujui' ? 'SETUJUI QUEST' : 'TOLAK QUEST'} onClose={busy ? () => {} : tutupAksi} width={470}>
          <p style={{ ...hud, fontSize: '1.1rem', color: 'var(--rpg-ink-dim)', margin: '0 0 .8rem' }}>
            {aksi.jenis === 'setujui'
              ? <>Setujui <b style={{ color: 'var(--rpg-ink)' }}>“{aksi.kartu.judul}”</b> untuk {aksi.anggota.nama}? Ia akan mendapat <b style={{ color: 'var(--rpg-success)' }}>+{aksi.kartu.xp} XP</b>. Tindakan ini tidak bisa dibatalkan.</>
              : <>Kembalikan <b style={{ color: 'var(--rpg-ink)' }}>“{aksi.kartu.judul}”</b> milik {aksi.anggota.nama} untuk diperbaiki. Alasan ini akan dilihat anggota.</>}
          </p>
          {aksi.kartu.catatanAnggota && <p style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-faint)', margin: '0 0 .8rem' }}>Catatan anggota: “{aksi.kartu.catatanAnggota}”</p>}
          {aksi.jenis === 'tolak' && (
            <input aria-label="Alasan penolakan" autoFocus placeholder="Alasan penolakan (wajib)" value={alasan} maxLength={1000} onChange={e => setAlasan(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && putuskan()}
              style={{ ...hud, fontSize: '1.05rem', width: '100%', boxSizing: 'border-box', color: 'var(--rpg-ink)', background: 'var(--rpg-bg)', border: '2px solid var(--rpg-line-dim)', padding: '.4rem .6rem', marginBottom: '.8rem' }} />
          )}
          <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'flex-end' }}>
            <button type="button" onClick={tutupAksi} disabled={busy} style={{ ...chipBase, background: 'var(--rpg-bg-3)', color: 'var(--rpg-ink-dim)' }}>Batal</button>
            <button type="button" onClick={putuskan} disabled={busy} style={{
              ...chipBase, fontSize: '1.05rem', opacity: busy ? .6 : 1,
              background: aksi.jenis === 'setujui' ? 'var(--rpg-success)' : 'transparent', color: aksi.jenis === 'setujui' ? '#08240f' : 'var(--rpg-warn)',
              borderColor: aksi.jenis === 'setujui' ? 'var(--rpg-success)' : 'var(--rpg-warn)',
            }}>{busy ? 'Memproses…' : aksi.jenis === 'setujui' ? 'Setujui' : 'Kirim penolakan'}</button>
          </div>
        </RpgModal>
      )}
    </div>
  );
}
