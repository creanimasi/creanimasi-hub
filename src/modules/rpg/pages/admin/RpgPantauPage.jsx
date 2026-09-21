import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import '../../styles/rpg-components.css';
import { rpgGuard } from '../../components/RpgState';
import { usePantau } from '../../hooks/useRpg';
import { api } from '../../../../services/api';
import RpgModal from '../../components/RpgModal';
import CharacterCard from '../../components/CharacterCard';
import StatMeter from '../../components/StatMeter';
import AchievementBadge from '../../components/AchievementBadge';
import QuestCard from '../../components/QuestCard';
import { lalu, tglPendek } from '../../utils/waktu';
import TargetCard from '../../components/TargetCard';

const pixbox = {
  background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)',
  boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.35), inset -2px -2px 0 rgba(0,0,0,.4), 3px 3px 0 var(--rpg-bg-3)',
};
const hud = { fontFamily: 'var(--rpg-font-hud)' };
const SUMBER_LABEL = { laporan_harian: 'Laporan harian', jurnal: 'Jurnal mingguan', absensi: 'Kehadiran', friday_win: 'Friday Win', quest: 'Quest disetujui' };
const SORTS = [
  ['xpTotal', 'XP total'], ['xpMinggu', 'XP minggu ini'], ['level', 'Level'], ['streak', 'Streak'],
  ['terakhirAktif', 'Aktivitas terakhir'], ['nama', 'Nama (A–Z)'],
];

const angka = (n) => Number(n).toLocaleString('id-ID');

function Kotak({ children, style }) {
  return <section className="rpg-pixbox" style={{ ...pixbox, padding: 'clamp(1rem, 2.2vw, 1.4rem)', ...style }}>{children}</section>;
}
function Judul({ children }) {
  return <h3 style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '.66rem', fontWeight: 400, margin: '0 0 .8rem', lineHeight: 1.6, color: 'var(--rpg-ink)' }}>{children}</h3>;
}
function Metrik({ label, nilai, warna }) {
  return (
    <div style={{ minWidth: 64 }}>
      <div style={{ ...hud, fontSize: '.85rem', color: 'var(--rpg-ink-faint)', textTransform: 'uppercase', letterSpacing: '.03em' }}>{label}</div>
      <div style={{ ...hud, fontSize: '1.15rem', color: warna || 'var(--rpg-ink)', lineHeight: 1.2 }}>{nilai}</div>
    </div>
  );
}

// ── Detail satu anggota (hanya-baca; sama persis dengan yang dilihat anggota itu) ─────────────
function DetailAnggota({ id, nama, onClose }) {
  const [st, setSt] = useState({ data: null, loading: true, error: null });
  const [ulang, setUlang] = useState(0);
  useEffect(() => {
    let batal = false; // respons basi (modal ditutup / anggota lain dipilih) dibuang
    setSt({ data: null, loading: true, error: null });
    api.rpgPantauDetail(id).then(
      (r) => { if (!batal) setSt({ data: r.data, loading: false, error: null }); },
      (e) => {
        const m = /^(\d{3}): (.*)$/s.exec(e.message || '');
        if (!batal) setSt({ data: null, loading: false, error: { status: m ? Number(m[1]) : 0, message: m ? m[2] : e.message } });
      },
    );
    return () => { batal = true; };
  }, [id, ulang]);

  const guard = rpgGuard({ ...st, retry: () => setUlang(n => n + 1) });
  const d = st.data;
  return (
    <RpgModal title={`DETAIL · ${nama.toUpperCase()}`} onClose={onClose} width={960}>
      {guard}
      {d && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <p style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-faint)', margin: 0 }}>
            Tampilan hanya-baca — sama dengan yang dilihat anggota ini. Untuk menyetujui quest atau memberi achievement, gunakan Kelola RPG.
          </p>
          {!d.punyaAkun && (
            <div style={{ ...hud, fontSize: '1.05rem', color: 'var(--rpg-warn)', border: '2px solid var(--rpg-warn)', padding: '.5rem .8rem' }}>
              Anggota ini belum punya akun login, jadi belum bisa membuka Character Sheet-nya sendiri. XP tetap terhitung.
            </div>
          )}
          <CharacterCard character={d.character} />

          <div style={{ display: 'flex', gap: '1.6rem', flexWrap: 'wrap' }}>
            <Metrik label="Peringkat minggu ini" nilai={d.peringkat.mingguan ? `#${d.peringkat.mingguan} dari ${d.peringkat.dari}` : '—'} warna="var(--rpg-gold)" />
            <Metrik label="Peringkat musim" nilai={d.peringkat.musim ? `#${d.peringkat.musim}` : '—'} warna="var(--rpg-gold)" />
            <Metrik label="Streak lapor" nilai={`${d.streak} hari`} />
          </div>

          {d.target?.ikut && <TargetCard data={d.target} />}

          <Kotak>
            <Judul>STATISTIK <em style={{ color: 'var(--rpg-gold)', fontStyle: 'normal' }}>PILAR</em></Judul>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: '1rem 1.6rem' }}>
              {d.stats.map(s => <StatMeter key={s.key} label={s.label} value={s.value} colorVar={s.colorVar} />)}
            </div>
          </Kotak>

          <Kotak>
            <Judul>ASAL <em style={{ color: 'var(--rpg-gold)', fontStyle: 'normal' }}>XP</em></Judul>
            {d.xp.perSumber.length === 0 ? (
              <p style={{ ...hud, fontSize: '1.05rem', color: 'var(--rpg-ink-dim)', margin: 0 }}>
                Belum ada XP sejak {new Date(d.xp.mulai).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}.
                Kemungkinan penyebab: memang belum ada laporan/jurnal/kehadiran, atau nama di data sumber tidak sama dengan nama anggota
                (lihat "Aktivitas tak dikenali" di halaman daftar).
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(300px, 100%), 1fr))', gap: '1.2rem 2rem' }}>
                <div>
                  {d.xp.perSumber.map(x => (
                    <div key={x.sumber} style={{ ...hud, fontSize: '1.05rem', display: 'flex', gap: '.6rem', padding: '.25rem 0', borderBottom: '1px dashed var(--rpg-line-dim)' }}>
                      <span style={{ flex: 1, color: 'var(--rpg-ink)' }}>{SUMBER_LABEL[x.sumber] || x.sumber}</span>
                      <span style={{ color: 'var(--rpg-ink-faint)' }}>{x.jumlah}×</span>
                      <span style={{ color: 'var(--rpg-success)', minWidth: 64, textAlign: 'right' }}>+{angka(x.xp)} XP</span>
                    </div>
                  ))}
                  <div style={{ ...hud, fontSize: '1.05rem', display: 'flex', padding: '.35rem 0 0', color: 'var(--rpg-gold)' }}>
                    <span style={{ flex: 1 }}>Total</span><span>{angka(d.xp.total)} XP</span>
                  </div>
                </div>
                <div>
                  <div style={{ ...hud, fontSize: '.9rem', color: 'var(--rpg-ink-faint)', textTransform: 'uppercase', marginBottom: '.3rem' }}>Aktivitas terbaru</div>
                  {d.xp.terbaru.map((x, i) => (
                    <div key={i} style={{ ...hud, fontSize: '1rem', display: 'flex', gap: '.6rem', padding: '.15rem 0' }}>
                      <span style={{ color: 'var(--rpg-ink-faint)', minWidth: 48 }}>{tglPendek(x.terjadi_pada)}</span>
                      <span style={{ flex: 1, color: 'var(--rpg-ink-dim)', minWidth: 0 }}>{x.keterangan}</span>
                      <span style={{ color: 'var(--rpg-success)' }}>+{x.xp}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Kotak>

          <Kotak>
            <Judul>QUEST</Judul>
            {d.quests.groups.every(g => g.quests.length === 0) && d.quests.completed.length === 0 ? (
              <p style={{ ...hud, fontSize: '1.05rem', color: 'var(--rpg-ink-faint)', margin: 0 }}>Belum ada quest.</p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))', gap: '0 1.4rem' }}>
                {d.quests.groups.filter(g => g.quests.length > 0).map(g => (
                  <div key={g.id}>
                    <div style={{ ...hud, fontSize: '.95rem', color: 'var(--rpg-ink-faint)', margin: '0 0 .4rem' }}>{g.label}</div>
                    {g.quests.map(q => (
                      <QuestCard key={q.id} title={q.title} xpReward={q.xpReward} dueLabel={q.dueLabel} progressPct={q.otomatis ? undefined : q.progressPct} warn={q.warn} />
                    ))}
                  </div>
                ))}
              </div>
            )}
            {d.quests.completed.length > 0 && (
              <div style={{ marginTop: '.4rem' }}>
                <div style={{ ...hud, fontSize: '.95rem', color: 'var(--rpg-ink-faint)', margin: '0 0 .3rem' }}>SELESAI</div>
                {d.quests.completed.map(q => (
                  <div key={q.id} style={{ ...hud, fontSize: '1.02rem', display: 'flex', gap: '.7rem', padding: '.15rem 0', color: 'var(--rpg-ink-dim)' }}>
                    <span style={{ flex: 1 }}>✓ {q.title}</span><span style={{ color: 'var(--rpg-ink-faint)' }}>{q.when}</span><span style={{ color: 'var(--rpg-success)' }}>+{q.xpReward} XP</span>
                  </div>
                ))}
              </div>
            )}
          </Kotak>

          <Kotak>
            <Judul>PENCAPAIAN <span style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-faint)' }}>· {d.achievements.filter(a => !a.locked).length} dari {d.achievements.length}</span></Judul>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(96px, 1fr))', gap: '1rem' }}>
              {d.achievements.map(a => <AchievementBadge key={a.code} label={a.label} locked={a.locked} progressLabel={a.progressLabel} />)}
            </div>
          </Kotak>
        </div>
      )}
    </RpgModal>
  );
}

// ── Halaman ────────────────────────────────────────────────────────────────────────────────────
export default function RpgPantauPage() {
  const res = usePantau();
  const [cari, setCari] = useState('');
  const [divisi, setDivisi] = useState('Semua');
  const [urut, setUrut] = useState('xpTotal');
  const [pilih, setPilih] = useState(null); // { id, nama }
  const [semuaTak, setSemuaTak] = useState(false);
  const { reload } = res;
  const [sp, setSp] = useSearchParams();

  // tautan dari Papan Quest: /rpg/anggota?id=<timId> membuka detail anggota itu (sekali, lalu param dibuang)
  useEffect(() => {
    const id = sp.get('id');
    if (!id || !res.data) return;
    const a = res.data.anggota.find(x => String(x.id) === id);
    if (a) setPilih({ id: a.id, nama: a.nama });
    const n = new URLSearchParams(sp); n.delete('id'); setSp(n, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [res.data]);

  // data berubah kapan saja (aktivitas baru, quest disetujui) — segarkan saat tab browser aktif lagi
  useEffect(() => {
    const onVisible = () => { if (!document.hidden) reload(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  const anggota = useMemo(() => res.data?.anggota || [], [res.data]);
  const daftarDivisi = useMemo(() => ['Semua', ...[...new Set(anggota.map(a => a.divisi))].sort()], [anggota]);
  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase();
    const arr = anggota.filter(a => (divisi === 'Semua' || a.divisi === divisi) && (!q || a.nama.toLowerCase().includes(q)));
    const cmp = {
      nama: (a, b) => a.nama.localeCompare(b.nama),
      terakhirAktif: (a, b) => (b.terakhirAktif ? new Date(b.terakhirAktif) : 0) - (a.terakhirAktif ? new Date(a.terakhirAktif) : 0),
    }[urut] || ((a, b) => b[urut] - a[urut] || a.nama.localeCompare(b.nama));
    return [...arr].sort(cmp);
  }, [anggota, cari, divisi, urut]);

  const guard = res.data ? null : rpgGuard(res);
  const ringkas = useMemo(() => ({
    n: anggota.length,
    xp: anggota.reduce((s, a) => s + a.xpTotal, 0),
    lv: anggota.length ? Math.round(anggota.reduce((s, a) => s + a.level, 0) / anggota.length * 10) / 10 : 0,
    nol: anggota.filter(a => a.xpTotal === 0).length,
  }), [anggota]);
  const tak = res.data?.takDikenali || [];

  return (
    <div className="rpg-page" style={{ fontFamily: 'var(--rpg-font-body)', color: 'var(--rpg-ink)' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <div>
            <h1 style={{ fontFamily: 'var(--rpg-font-display)', fontWeight: 400, fontSize: 'clamp(1rem, 2.4vw, 1.4rem)', margin: '0 0 .6rem' }}>PANTAU ANGGOTA</h1>
            <p style={{ ...hud, fontSize: '1.1rem', color: 'var(--rpg-ink-dim)', margin: 0, maxWidth: '64ch' }}>
              Kondisi RPG tiap anggota: level, XP, quest, dan pencapaian. Klik satu anggota untuk melihat persis apa yang ia lihat, beserta asal XP-nya.
              Hanya-baca.
            </p>
          </div>
          {res.data && (
            <button type="button" onClick={res.retry} style={{ ...hud, fontSize: '1.05rem', cursor: 'pointer', background: 'var(--rpg-bg-3)', color: 'var(--rpg-ink-dim)', border: '2px solid var(--rpg-line-dim)', padding: '.35rem 1rem' }}>
              Muat ulang
            </button>
          )}
        </div>

        {guard}

        {res.data && (<>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '1rem' }}>
            {[['Anggota aktif', ringkas.n], ['Total XP', angka(ringkas.xp)], ['Rata-rata level', ringkas.lv], ['Belum ada XP', ringkas.nol]].map(([l, v]) => (
              <div key={l} className="rpg-pixbox" style={{ ...pixbox, padding: '1rem 1.1rem' }}>
                <div style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '1.3rem', color: 'var(--rpg-gold)', textShadow: '2px 2px 0 rgba(0,0,0,.5)', lineHeight: 1.2 }}>{v}</div>
                <div style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-dim)', textTransform: 'uppercase', letterSpacing: '.03em', marginTop: '.35rem' }}>{l}</div>
              </div>
            ))}
          </div>

          {tak.length > 0 && (
            <div className="rpg-pixbox" style={{ ...pixbox, border: '2px solid var(--rpg-warn)', padding: '1rem 1.2rem' }}>
              <div style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '.66rem', color: 'var(--rpg-warn)', marginBottom: '.6rem', lineHeight: 1.6 }}>
                AKTIVITAS TAK DIKENALI ({tak.length})
              </div>
              <p style={{ ...hud, fontSize: '1.05rem', color: 'var(--rpg-ink-dim)', margin: '0 0 .7rem', maxWidth: '78ch' }}>
                Nama di data berikut tidak cocok dengan anggota mana pun sehingga <b style={{ color: 'var(--rpg-ink)' }}>tidak menghasilkan XP</b> (biasanya salah ketik di laporan Telegram).
                Perbaiki penulisan namanya di sumber datanya, atau samakan nama anggota di Master Data.
              </p>
              {(semuaTak ? tak : tak.slice(0, 5)).map((t, i) => (
                <div key={i} style={{ ...hud, fontSize: '1.05rem', display: 'flex', gap: '.8rem', flexWrap: 'wrap', padding: '.15rem 0', borderTop: i ? '1px dashed var(--rpg-line-dim)' : 'none' }}>
                  <span style={{ flex: '1 1 160px', color: 'var(--rpg-ink)' }}>“{t.nama}”</span>
                  <span style={{ color: 'var(--rpg-ink-dim)' }}>{t.sumber}</span>
                  <span style={{ color: 'var(--rpg-ink-faint)' }}>{t.jumlah}× · terakhir {tglPendek(t.terakhir)}</span>
                </div>
              ))}
              {tak.length > 5 && (
                <button type="button" onClick={() => setSemuaTak(v => !v)} style={{ ...hud, fontSize: '1rem', cursor: 'pointer', marginTop: '.6rem', background: 'transparent', color: 'var(--rpg-gold)', border: 'none', padding: 0, textDecoration: 'underline' }}>
                  {semuaTak ? 'Tampilkan lebih sedikit' : `Tampilkan semua (${tak.length})`}
                </button>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: '.7rem', flexWrap: 'wrap' }}>
            <input aria-label="Cari anggota" placeholder="Cari nama…" value={cari} onChange={e => setCari(e.target.value)}
              style={{ ...hud, fontSize: '1.05rem', flex: '1 1 200px', maxWidth: 320, boxSizing: 'border-box', color: 'var(--rpg-ink)', background: 'var(--rpg-bg)', border: '2px solid var(--rpg-line-dim)', padding: '.4rem .6rem' }} />
            <select aria-label="Filter divisi" value={divisi} onChange={e => setDivisi(e.target.value)}
              style={{ ...hud, fontSize: '1.05rem', width: 'auto', color: 'var(--rpg-ink)', background: 'var(--rpg-bg)', border: '2px solid var(--rpg-line-dim)', padding: '.4rem .6rem' }}>
              {daftarDivisi.map(d => <option key={d} value={d}>{d === 'Semua' ? 'Semua divisi' : d}</option>)}
            </select>
            <select aria-label="Urutkan" value={urut} onChange={e => setUrut(e.target.value)}
              style={{ ...hud, fontSize: '1.05rem', width: 'auto', color: 'var(--rpg-ink)', background: 'var(--rpg-bg)', border: '2px solid var(--rpg-line-dim)', padding: '.4rem .6rem' }}>
              {SORTS.map(([k, l]) => <option key={k} value={k}>Urutkan: {l}</option>)}
            </select>
          </div>

          <div style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-faint)' }}>{tampil.length} dari {anggota.length} anggota</div>

          {tampil.length === 0 && (
            <div className="rpg-pixbox" style={{ ...pixbox, padding: '1.2rem', ...hud, fontSize: '1.1rem', color: 'var(--rpg-ink-dim)' }}>
              {anggota.length === 0 ? 'Belum ada anggota aktif.' : 'Tidak ada anggota yang cocok dengan filter.'}
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '.7rem' }}>
            {tampil.map(a => (
              <button key={a.id} type="button" className="rpg-pixbox" aria-label={`Lihat detail ${a.nama}`} onClick={() => setPilih({ id: a.id, nama: a.nama })}
                style={{ ...pixbox, cursor: 'pointer', textAlign: 'left', color: 'var(--rpg-ink)', font: 'inherit', padding: '.8rem 1.1rem', display: 'flex', gap: '1.2rem', flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '.98rem' }}>{a.nama}</div>
                  <div style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-dim)', marginTop: '.15rem' }}>{a.divisi} · Unit {a.entitas || 'Creanimasi Studio'}</div>
                  <div style={{ display: 'flex', gap: '.4rem', flexWrap: 'wrap', marginTop: '.3rem' }}>
                    {a.xpTotal === 0 && <span style={{ ...hud, fontSize: '.9rem', color: 'var(--rpg-warn)', border: '2px solid var(--rpg-warn)', padding: '0 .4rem' }}>Belum ada XP</span>}
                    {!a.punyaAkun && <span style={{ ...hud, fontSize: '.9rem', color: 'var(--rpg-ink-dim)', border: '2px solid var(--rpg-line-dim)', padding: '0 .4rem' }}>Belum punya akun</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '1.3rem', flexWrap: 'wrap', flex: '2 1 420px' }}>
                  <Metrik label="Level" nilai={`Lv${a.level}`} warna="var(--rpg-gold)" />
                  <Metrik label="XP total" nilai={angka(a.xpTotal)} />
                  <Metrik label="Minggu ini" nilai={`+${angka(a.xpMinggu)}`} warna={a.xpMinggu > 0 ? 'var(--rpg-success)' : undefined} />
                  <Metrik label="Streak" nilai={`${a.streak} hari`} />
                  <Metrik label="Quest" nilai={`${a.quest.aktif} aktif${a.quest.diajukan ? ` · ${a.quest.diajukan} menunggu` : ''}`} warna={a.quest.diajukan ? 'var(--rpg-gold)' : undefined} />
                  <Metrik label="Pencapaian" nilai={`${a.achievement.terbuka}/${a.achievement.total}`} />
                  <Metrik label="Aktif terakhir" nilai={lalu(a.terakhirAktif)} />
                </div>
              </button>
            ))}
          </div>
        </>)}
      </div>
      {pilih && <DetailAnggota id={pilih.id} nama={pilih.nama} onClose={() => setPilih(null)} />}
    </div>
  );
}
