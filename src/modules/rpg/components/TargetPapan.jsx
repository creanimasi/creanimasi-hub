import { useState } from 'react';
import TargetBar from './TargetBar';
import TargetChip from './TargetChip';
import { rpgGuard } from './RpgState';
import { useTargetPapan } from '../hooks/useRpg';
import { angka, kunciStatus, labelLevel } from '../utils/target';

const hud = { fontFamily: 'var(--rpg-font-hud)' };
const pixbox = {
  background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)',
  boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.35), inset -2px -2px 0 rgba(0,0,0,.4), 3px 3px 0 var(--rpg-bg-3)',
};

const Mahkota = () => (
  <svg viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="square" strokeLinejoin="miter" stroke="var(--rpg-gold)" width={16} height={16} aria-label="Peringkat 1" role="img">
    <path d="m3 8 4 3 5-6 5 6 4-3-2 11H5L3 8Z" />
  </svg>
);

function Baris({ r, fase, jalurPct }) {
  const status = kunciStatus(r, fase);
  const punyaTarget = r.status === 'tercapai' || r.status === 'belum';
  return (
    <li style={{
      display: 'flex', alignItems: 'center', gap: '.8rem', flexWrap: 'wrap', padding: '.65rem .5rem', borderBottom: '1px dashed var(--rpg-line-dim)',
      background: r.isYou ? 'rgba(255,210,63,.08)' : 'transparent',
    }}>
      <span style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '.65rem', width: '1.6rem', textAlign: 'center', flex: 'none', color: r.isYou ? 'var(--rpg-gold)' : 'var(--rpg-ink-faint)' }}>
        {r.peringkat === 1 ? <Mahkota /> : (r.peringkat ?? '–')}
      </span>
      <span style={{ flex: '1 1 170px', minWidth: 0, ...hud }}>
        <span style={{ fontSize: '1.1rem', color: 'var(--rpg-ink)', overflowWrap: 'anywhere' }}>{r.nama}{r.isYou && ' · Kamu'}</span>
        <br />
        <span style={{ fontSize: '.9rem', color: 'var(--rpg-ink-faint)' }}>{r.divisi}{labelLevel(r.level) ? ` · ${labelLevel(r.level)}` : ''}</span>
      </span>
      <span style={{ flex: '2 1 200px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
        {punyaTarget
          ? <>
              <TargetBar poin={r.poin} target={r.target} status={status} tinggi={10}
                jalurPct={jalurPct} label={`Poin ${r.nama}`} />
              <span style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-dim)' }}>{angka(r.poin)} / {angka(r.target)} poin · {r.persen}%</span>
            </>
          : <span style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-faint)' }}>
              {r.status === 'dikecualikan' ? `Dikecualikan dari target · ${angka(r.poin)} poin` : `Target belum ditetapkan · ${angka(r.poin)} poin`}
            </span>}
      </span>
      <span style={{ flex: '0 0 132px', display: 'flex', justifyContent: 'flex-end' }}><TargetChip status={status} /></span>
    </li>
  );
}

// Papan "Target Produksi" (Guild Hall) — terbuka penuh: semua anggota produksi, diurutkan dari persen pencapaian
// target (bukan poin mentah, supaya adil antar divisi & level). Target tim = poin gabungan vs target gabungan.
export default function TargetPapan() {
  const [periode, setPeriode] = useState('sekarang');
  const res = useTargetPapan(periode);
  const d = res.data;
  const guard = d ? null : rpgGuard(res);
  const jalurPct = d && d.periode.fase === 'berjalan' ? (100 * d.periode.hariBerjalan) / d.periode.hariTotal : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
      <p style={{ ...hud, fontSize: '1.1rem', color: 'var(--rpg-ink-dim)', margin: 0, maxWidth: '64ch' }}>
        Pencapaian target poin tim produksi (Illustrator, Rigger, 3D Modeler, Desainer). Poin datang dari quest yang disetujui admin.
        Peringkat diurutkan dari <b style={{ color: 'var(--rpg-ink)' }}>persen pencapaian target</b>, bukan poin mentah, agar adil antar divisi dan level.
      </p>

      {guard}

      {d && (<>
        <div style={{ display: 'flex', gap: '.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <label style={{ ...hud, fontSize: '1.05rem', color: 'var(--rpg-ink-dim)', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            Periode
            <select value={d.periode.kode} onChange={e => setPeriode(e.target.value)} aria-label="Periode target" style={{
              ...hud, fontSize: '1.05rem', width: 'auto', color: 'var(--rpg-ink)', background: 'var(--rpg-bg)', border: '2px solid var(--rpg-line-dim)', padding: '.3rem .6rem',
            }}>
              {d.daftarPeriode.map(p => <option key={p.kode} value={p.kode}>{p.label}</option>)}
            </select>
          </label>
          <span style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-faint)' }}>
            {d.periode.rentang}{d.periode.fase === 'berjalan' ? ` · sisa ${d.periode.sisaHari} hari` : ''}
          </span>
          {d.sementara && (
            <span style={{ ...hud, fontSize: '.95rem', color: 'var(--rpg-gold)', border: '2px solid var(--rpg-gold)', padding: '0 .4rem' }}>
              {d.periode.fase === 'berjalan' ? 'BERJALAN' : 'SEMENTARA — belum dikunci'}
            </span>
          )}
        </div>

        <section aria-label="Target tim" className="rpg-pixbox" style={{ ...pixbox, padding: '1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '.5rem' }}>
          <div style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '.65rem', color: 'var(--rpg-ink)' }}>TARGET TIM</div>
          {d.ringkasan.targetTim > 0
            ? <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '.7rem', flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '1.2rem', color: 'var(--rpg-gold)', textShadow: '2px 2px 0 rgba(0,0,0,.5)' }}>{angka(d.ringkasan.poinTim)}</span>
                  <span style={{ ...hud, fontSize: '1.2rem', color: 'var(--rpg-ink-dim)' }}>/ {angka(d.ringkasan.targetTim)} poin · {d.ringkasan.persenTim}%</span>
                </div>
                <TargetBar poin={d.ringkasan.poinTim} target={d.ringkasan.targetTim} status={d.ringkasan.poinTim >= d.ringkasan.targetTim ? 'tercapai' : 'sesuai'} label="Poin gabungan tim" />
                <span style={{ ...hud, fontSize: '1.05rem', color: 'var(--rpg-ink-dim)' }}>
                  {d.ringkasan.tercapai} dari {d.ringkasan.peserta} anggota sudah mencapai target. Poin semua anggota dijumlahkan — saling bantu tetap menguntungkan tim.
                </span>
              </>
            : <span style={{ ...hud, fontSize: '1.05rem', color: 'var(--rpg-ink-faint)' }}>Belum ada target yang ditetapkan admin untuk periode ini.</span>}
        </section>

        <div className="rpg-pixbox" style={{ ...pixbox, padding: 'clamp(.8rem, 2vw, 1.3rem)' }}>
          {d.rows.length === 0
            ? <p style={{ ...hud, color: 'var(--rpg-ink-faint)', margin: 0 }}>Belum ada anggota produksi.</p>
            : <ol style={{ listStyle: 'none', margin: 0, padding: 0 }}>{d.rows.map(r => <Baris key={r.nama} r={r} fase={d.periode.fase} jalurPct={jalurPct} />)}</ol>}
        </div>
      </>)}
    </div>
  );
}
