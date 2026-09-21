import TargetBar from './TargetBar';
import TargetChip from './TargetChip';
import { angka, kunciStatus, labelLevel, tanggalPendek } from '../utils/target';

const hud = { fontFamily: 'var(--rpg-font-hud)' };
const pixbox = {
  background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)',
  boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.35), inset -2px -2px 0 rgba(0,0,0,.4), 3px 3px 0 var(--rpg-bg-3)',
};

// Ringkasan satu periode untuk satu orang: angka besar + batang + status + petunjuk.
function Ringkas({ periode, saya }) {
  const fase = periode.fase;
  const status = kunciStatus(saya, fase);
  const jalurPct = fase === 'berjalan' ? (100 * periode.hariBerjalan) / periode.hariTotal : null;

  if (saya.status === 'dikecualikan') {
    return (
      <p style={{ ...hud, fontSize: '1.1rem', color: 'var(--rpg-ink-dim)', margin: 0 }}>
        Kamu dikecualikan dari target periode ini{saya.override?.catatan ? ` (${saya.override.catatan})` : ''}. Poin tetap dicatat: <b style={{ color: 'var(--rpg-ink)' }}>{angka(saya.poin)}</b>.
      </p>
    );
  }
  if (saya.status === 'tanpa_target') {
    return (
      <p style={{ ...hud, fontSize: '1.1rem', color: 'var(--rpg-ink-dim)', margin: 0 }}>
        Target untuk {saya.divisi}{labelLevel(saya.level) ? ` (${labelLevel(saya.level)})` : ''} belum ditetapkan admin. Poin periode ini tetap dicatat:{' '}
        <b style={{ color: 'var(--rpg-ink)' }}>{angka(saya.poin)}</b>.
      </p>
    );
  }
  const selisih = saya.poin - saya.target;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '.55rem' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '.7rem', flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '1.3rem', color: 'var(--rpg-gold)', textShadow: '2px 2px 0 rgba(0,0,0,.5)' }}>{angka(saya.poin)}</span>
        <span style={{ ...hud, fontSize: '1.25rem', color: 'var(--rpg-ink-dim)' }}>/ {angka(saya.target)} poin · {saya.persen}%</span>
        <TargetChip status={status} />
      </div>
      <TargetBar poin={saya.poin} target={saya.target} status={status} jalurPct={jalurPct} label={`Poin ${periode.label}`} />
      <div style={{ ...hud, fontSize: '1.05rem', color: 'var(--rpg-ink-dim)' }}>
        {saya.status === 'tercapai'
          ? <>Target tercapai{selisih > 0 ? <> — kelebihan <b style={{ color: 'var(--rpg-success)' }}>+{angka(selisih)}</b> poin</> : null}.</>
          : fase === 'berjalan'
            ? <>Kurang <b style={{ color: 'var(--rpg-ink)' }}>{angka(-selisih)}</b> poin{saya.butuhPerHari ? <> — sekitar <b style={{ color: 'var(--rpg-ink)' }}>{angka(saya.butuhPerHari)}</b> poin/hari</> : null}.</>
            : <>Kurang <b style={{ color: 'var(--rpg-ink)' }}>{angka(-selisih)}</b> poin.</>}
        {saya.peringkat ? <> · Peringkat <b style={{ color: 'var(--rpg-ink)' }}>#{saya.peringkat}</b></> : null}
        {saya.override?.target ? <> · Target disesuaikan admin</> : null}
      </div>
    </div>
  );
}

// Kartu "Target Poin" anggota produksi. `data` = respons GET /rpg/target (atau target dari Pantau — identik).
export default function TargetCard({ data }) {
  if (!data || !data.ikut) return null;
  const { periode, saya, kontribusi, sebelumnya, riwayat } = data;
  const menunggu = saya.menunggu;
  const nSetuju = kontribusi.filter(k => k.status === 'disetujui').length, nTunggu = kontribusi.length - nSetuju;

  return (
    <section aria-label="Target poin periode" className="rpg-pixbox" style={{ ...pixbox, padding: 'clamp(1rem, 2.2vw, 1.4rem)', display: 'flex', flexDirection: 'column', gap: '.9rem' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem', flexWrap: 'wrap', alignItems: 'baseline' }}>
        <h2 style={{ fontFamily: 'var(--rpg-font-display)', fontWeight: 400, fontSize: '.7rem', margin: 0, color: 'var(--rpg-ink)' }}>
          TARGET POIN · {periode.label.toUpperCase()}
        </h2>
        <span style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-faint)' }}>
          {periode.rentang}{periode.fase === 'berjalan' ? ` · sisa ${periode.sisaHari} hari` : ' · menunggu penguncian'}
        </span>
      </header>

      <Ringkas periode={periode} saya={saya} />

      {menunggu.n > 0 && (
        <div style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-dim)', border: '2px dashed var(--rpg-line-dim)', padding: '.35rem .6rem' }}>
          {menunggu.n} quest ({angka(menunggu.poin)} poin) menunggu persetujuan admin — belum dihitung, dan akan masuk periode ini bila disetujui.
        </div>
      )}

      <details>
        <summary style={{ ...hud, fontSize: '1.05rem', color: 'var(--rpg-ink-dim)', cursor: 'pointer' }}>Rincian quest periode ini ({nSetuju}{nTunggu ? ` + ${nTunggu} menunggu` : ''})</summary>
        {kontribusi.length === 0
          ? <p style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-faint)', margin: '.5rem 0 0' }}>Belum ada quest yang disetujui di periode ini.</p>
          : <ul style={{ listStyle: 'none', margin: '.5rem 0 0', padding: 0, display: 'flex', flexDirection: 'column', gap: '.3rem' }}>
              {kontribusi.map(k => (
                <li key={k.id} style={{ ...hud, fontSize: '1.05rem', display: 'flex', gap: '.6rem', alignItems: 'baseline', borderBottom: '1px dashed var(--rpg-line-dim)', paddingBottom: '.25rem' }}>
                  <span style={{ flex: 1, minWidth: 0, overflowWrap: 'anywhere', color: 'var(--rpg-ink)' }}>{k.judul}</span>
                  <span style={{ color: 'var(--rpg-ink-faint)', flex: 'none' }}>{tanggalPendek(k.tanggal)}</span>
                  <span style={{ flex: 'none', minWidth: 78, textAlign: 'right', color: k.status === 'disetujui' ? 'var(--rpg-success)' : 'var(--rpg-ink-faint)' }}>
                    {k.status === 'disetujui' ? `+${angka(k.poin)}` : `${angka(k.poin)} · menunggu`}
                  </span>
                </li>
              ))}
            </ul>}
      </details>

      {sebelumnya && (
        <div style={{ border: '2px solid var(--rpg-line-dim)', background: 'var(--rpg-bg-3)', padding: '.7rem .8rem', display: 'flex', flexDirection: 'column', gap: '.45rem' }}>
          <div style={{ ...hud, fontSize: '1.05rem', color: 'var(--rpg-ink)' }}>
            Periode {sebelumnya.periode.label} <span style={{ color: 'var(--rpg-ink-faint)' }}>· hasil sementara — final setelah admin mengunci</span>
          </div>
          <Ringkas periode={sebelumnya.periode} saya={sebelumnya.saya} />
        </div>
      )}

      {riwayat.length > 0 && (
        <div>
          <div style={{ ...hud, fontSize: '1.05rem', color: 'var(--rpg-ink-dim)', marginBottom: '.3rem' }}>Riwayat periode</div>
          <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '.25rem' }}>
            {riwayat.map(r => (
              <li key={r.kode} style={{ ...hud, fontSize: '1.05rem', display: 'flex', gap: '.6rem', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ minWidth: 120, color: 'var(--rpg-ink)' }}>{r.label}</span>
                <span style={{ color: 'var(--rpg-ink-dim)' }}>{angka(r.poin)}{r.target ? ` / ${angka(r.target)}` : ''} poin</span>
                <TargetChip status={r.status} />
                {r.peringkat ? <span style={{ color: 'var(--rpg-ink-faint)' }}>#{r.peringkat}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
