import { useState, useEffect } from 'react';
import { rpgGuard } from '../../components/RpgState';
import TargetChip from '../../components/TargetChip';
import { Btn, Field, Modal, inputStyle, cbStyle, hud, pixbox, pesanError } from '../../components/AdminUi';
import { useTargetConfig, useTargetRekap } from '../../hooks/useRpg';
import { api } from '../../../../services/api';
import { useToast } from '../../../../hooks/useToast';
import { downloadCsv } from '../../../../utils/exportCsv';
import { angka, kunciStatus, labelLevel, STATUS_TARGET, tanggalPendek } from '../../utils/target';

const TARGET_MAKS = 100000;
const bilanganAtauNull = (v) => {
  const t = String(v).trim();
  if (t === '') return { nilai: null };
  if (!/^\d+$/.test(t) || Number(t) < 1 || Number(t) > TARGET_MAKS) return { error: `Target harus bilangan bulat 1–${angka(TARGET_MAKS)}` };
  return { nilai: Number(t) };
};

// ── Matriks target: divisi × level. Kosong = ikut kolom "Semua level"; bila itu juga kosong → belum ada target. ──
function Matriks({ onChanged }) {
  const res = useTargetConfig();
  const { showToast } = useToast();
  const [vals, setVals] = useState({});
  const [galat, setGalat] = useState({});
  const [simpan, setSimpan] = useState(null);
  const d = res.data;

  useEffect(() => {
    if (!d) return;
    setVals(Object.fromEntries(d.target.map(t => [`${t.divisi}|${t.level}`, String(t.target)])));
  }, [d]);

  if (!d) return rpgGuard(res);
  const kolom = [['*', 'Semua level'], ...d.level.map(l => [l.key, l.label])];
  const tersimpan = (kunci) => { const t = d.target.find(x => `${x.divisi}|${x.level}` === kunci); return t ? String(t.target) : ''; };

  const commit = async (divisi, level) => {
    const kunci = `${divisi}|${level}`, mentah = vals[kunci] ?? '';
    if (mentah.trim() === tersimpan(kunci)) { setGalat(g => ({ ...g, [kunci]: null })); return; }
    const { nilai, error } = bilanganAtauNull(mentah);
    if (error) { setGalat(g => ({ ...g, [kunci]: error })); return; }
    setGalat(g => ({ ...g, [kunci]: null })); setSimpan(kunci);
    try {
      await api.rpgAdminSetTarget(divisi, level, nilai);
      showToast(nilai == null ? `Target ${divisi}${level === '*' ? '' : ' ' + labelLevel(level)} dihapus` : `Target ${divisi}${level === '*' ? '' : ' ' + labelLevel(level)} = ${angka(nilai)} poin`);
      res.reload(); onChanged();
    } catch (e) { setGalat(g => ({ ...g, [kunci]: pesanError(e) })); }
    finally { setSimpan(null); }
  };

  return (
    <section aria-label="Pengaturan target" className="rpg-pixbox" style={{ ...pixbox, padding: '1rem 1.2rem', display: 'flex', flexDirection: 'column', gap: '.8rem' }}>
      <div>
        <div style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '.7rem' }}>TARGET POIN PER PERIODE</div>
        <p style={{ ...hud, fontSize: '1.05rem', color: 'var(--rpg-ink-dim)', margin: '.4rem 0 0', maxWidth: '70ch' }}>
          Poin satu orang = jumlah XP quest yang disetujui dan diajukan dalam periode (tanggal 28 bulan lalu sampai tanggal {d.tutup}).
          Sel level yang kosong ikut “Semua level”. Divisi tanpa angka sama sekali = target belum ditetapkan (poin tetap dicatat).
          Perubahan berlaku untuk periode yang <b style={{ color: 'var(--rpg-ink)' }}>belum dikunci</b>; hasil yang sudah dikunci tidak berubah.
        </p>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
          <thead>
            <tr>
              <th scope="col" style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-dim)', textAlign: 'left', padding: '.3rem .5rem', borderBottom: '2px solid var(--rpg-line-dim)' }}>Divisi</th>
              {kolom.map(([k, t]) => <th key={k} scope="col" style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-dim)', textAlign: 'left', padding: '.3rem .5rem', borderBottom: '2px solid var(--rpg-line-dim)' }}>{t}</th>)}
            </tr>
          </thead>
          <tbody>
            {d.divisi.map(div => (
              <tr key={div}>
                <th scope="row" style={{ ...hud, fontSize: '1.1rem', color: 'var(--rpg-ink)', textAlign: 'left', padding: '.4rem .5rem', borderBottom: '1px dashed var(--rpg-line-dim)' }}>{div}</th>
                {kolom.map(([k, t]) => {
                  const kunci = `${div}|${k}`;
                  return (
                    <td key={k} style={{ padding: '.35rem .5rem', borderBottom: '1px dashed var(--rpg-line-dim)', verticalAlign: 'top' }}>
                      <input type="text" inputMode="numeric" aria-label={`Target ${div} ${t}`} placeholder="—" value={vals[kunci] ?? ''} disabled={simpan === kunci}
                        aria-invalid={galat[kunci] ? 'true' : undefined}
                        onChange={e => setVals(v => ({ ...v, [kunci]: e.target.value }))}
                        onBlur={() => commit(div, k)} onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                        style={{ ...inputStyle, width: 110, borderColor: galat[kunci] ? 'var(--rpg-warn)' : undefined }} />
                      {galat[kunci] && <div role="alert" style={{ ...hud, fontSize: '.9rem', color: 'var(--rpg-warn)', maxWidth: 150 }}>{galat[kunci]}</div>}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ ...hud, fontSize: '.95rem', color: 'var(--rpg-ink-faint)' }}>Tersimpan otomatis saat kolom ditinggalkan atau menekan Enter. Kosongkan lalu tinggalkan untuk menghapus.</div>
    </section>
  );
}

// ── Sesuaikan target satu orang untuk satu periode (cuti / anggota baru) ──
function SesuaikanModal({ row, periode, onClose, onSaved }) {
  const { showToast } = useToast();
  const [target, setTarget] = useState(row.override?.target != null ? String(row.override.target) : '');
  const [dikecualikan, setDikecualikan] = useState(!!row.override?.dikecualikan);
  const [catatan, setCatatan] = useState(row.override?.catatan || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const simpan = async () => {
    const { nilai, error } = bilanganAtauNull(target);
    if (error) return setErr(error);
    setBusy(true); setErr('');
    try {
      await api.rpgAdminOverride({ periode, tim_id: row.timId, target: nilai, dikecualikan, catatan });
      showToast(`Penyesuaian ${row.nama} disimpan`); onSaved();
    } catch (e) { setErr(pesanError(e)); setBusy(false); }
  };
  const bersihkan = async () => {
    setBusy(true); setErr('');
    try { await api.rpgAdminOverride({ periode, tim_id: row.timId, target: null, dikecualikan: false }); showToast('Penyesuaian dihapus'); onSaved(); }
    catch (e) { setErr(pesanError(e)); setBusy(false); }
  };

  return (
    <Modal title={`SESUAIKAN · ${row.nama}`} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '.9rem' }}>
        <div style={{ ...hud, fontSize: '1.05rem', color: 'var(--rpg-ink-dim)' }}>
          Hanya untuk periode ini. Target dasar: <b style={{ color: 'var(--rpg-ink)' }}>{row.targetDasar != null ? `${angka(row.targetDasar)} poin` : 'belum ada'}</b>.
        </div>
        <Field label="Target khusus (poin)" hint="Kosong = pakai target dasar. Berguna untuk anggota yang baru bergabung atau cuti sebagian.">
          <input style={inputStyle} type="text" inputMode="numeric" value={target} onChange={e => setTarget(e.target.value)} disabled={dikecualikan} placeholder="mis. 150" />
        </Field>
        <label style={{ ...hud, fontSize: '1.05rem', display: 'flex', gap: '.5rem', alignItems: 'center', cursor: 'pointer' }}>
          <input type="checkbox" style={cbStyle} checked={dikecualikan} onChange={e => setDikecualikan(e.target.checked)} />
          Dikecualikan dari target periode ini (mis. cuti panjang)
        </label>
        <Field label="Catatan (opsional, terlihat oleh anggota)">
          <input style={inputStyle} maxLength={200} value={catatan} onChange={e => setCatatan(e.target.value)} placeholder="mis. Cuti 2 minggu" />
        </Field>
        {err && <div role="alert" style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-warn)' }}>{err}</div>}
        <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {row.override && <Btn kind="warn" disabled={busy} onClick={bersihkan}>Hapus penyesuaian</Btn>}
          <Btn onClick={onClose} disabled={busy}>Batal</Btn>
          <Btn kind="gold" onClick={simpan} disabled={busy}>Simpan</Btn>
        </div>
      </div>
    </Modal>
  );
}

const FASE_LABEL = { berjalan: 'Berjalan', menunggu_kunci: 'Menunggu penguncian', final: 'Terkunci' };

// ── Rekap satu periode + kunci / buka ──
function Rekap({ refreshKey }) {
  const [periode, setPeriode] = useState('sekarang');
  const res = useTargetRekap(periode);
  const { showToast } = useToast();
  const [modal, setModal] = useState(null); // { jenis: 'kunci'|'buka'|'sesuaikan', row? }
  const [busy, setBusy] = useState(false);
  const d = res.data;
  const { reload } = res;
  useEffect(() => { if (refreshKey > 0) reload(); }, [refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!d) return rpgGuard(res);
  const kode = d.periode.kode;
  const r = d.ringkasan;

  const jalankan = async (fn, pesan) => {
    setBusy(true);
    try { await fn(); showToast(pesan); setModal(null); res.reload(); }
    catch (e) { showToast(pesanError(e), 'error'); res.reload(); }
    finally { setBusy(false); }
  };

  const ekspor = () => {
    const H = ['Peringkat', 'Nama', 'Divisi', 'Level', 'Target', 'Poin', 'Persen', 'Status', 'Menunggu (poin)'];
    downloadCsv(`target-poin-${kode}.csv`, d.rows.map(x => ({
      Peringkat: x.peringkat ?? '', Nama: x.nama, Divisi: x.divisi, Level: labelLevel(x.level) || '', Target: x.target ?? '', Poin: x.poin,
      Persen: x.persen ?? '', Status: STATUS_TARGET[x.status].teks, 'Menunggu (poin)': x.menunggu?.poin || 0,
    })), H);
  };

  return (
    <section aria-label="Rekap periode" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      <div style={{ display: 'flex', gap: '.8rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <label style={{ ...hud, fontSize: '1.05rem', color: 'var(--rpg-ink-dim)', display: 'flex', gap: '.5rem', alignItems: 'center' }}>
          Periode
          <select value={kode} onChange={e => setPeriode(e.target.value)} aria-label="Pilih periode" style={{ ...inputStyle, width: 'auto' }}>
            {d.daftarPeriode.map(p => <option key={p.kode} value={p.kode}>{p.label}</option>)}
          </select>
        </label>
        <span style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-faint)' }}>{d.periode.rentang}</span>
        <span style={{ ...hud, fontSize: '.95rem', color: d.dikunci ? 'var(--rpg-success)' : 'var(--rpg-gold)', border: `2px solid ${d.dikunci ? 'var(--rpg-success)' : 'var(--rpg-gold)'}`, padding: '0 .4rem' }}>
          {FASE_LABEL[d.fase]}
        </span>
        <span style={{ flex: 1 }} />
        <Btn small onClick={ekspor}>Ekspor CSV</Btn>
        {d.bisaDikunci && <Btn kind="gold" disabled={busy} onClick={() => setModal({ jenis: 'kunci' })}>Kunci periode</Btn>}
        {d.dikunci && <Btn kind="warn" disabled={busy} onClick={() => setModal({ jenis: 'buka' })}>Buka kembali</Btn>}
      </div>

      {d.dikunci && (
        <div style={{ ...hud, fontSize: '1.05rem', color: 'var(--rpg-ink-dim)' }}>
          Dikunci oleh <b style={{ color: 'var(--rpg-ink)' }}>{d.dikunciOleh}</b> pada {new Date(d.dikunciPada).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })}. Hasil di bawah adalah potret saat dikunci.
        </div>
      )}
      {!d.dikunci && d.fase === 'menunggu_kunci' && (
        <div style={{ ...hud, fontSize: '1.05rem', color: 'var(--rpg-ink-dim)' }}>
          Periode sudah berakhir; hasil di bawah masih <b style={{ color: 'var(--rpg-ink)' }}>sementara</b> (pengajuan yang baru disetujui tetap ikut terhitung).
          {d.tahanKunci
            ? ' Penguncian otomatis ditahan karena periode dibuka kembali — kunci manual bila sudah siap.'
            : <> Bila belum dikunci, sistem mengunci otomatis pada <b style={{ color: 'var(--rpg-ink)' }}>{tanggalPendek(d.kunciOtomatisPada)}</b>.</>}
        </div>
      )}
      {!d.dikunci && d.fase === 'berjalan' && (
        <div style={{ ...hud, fontSize: '1.05rem', color: 'var(--rpg-ink-dim)' }}>
          Periode berjalan · sisa {d.periode.sisaHari} hari. Baru bisa dikunci setelah tanggal {d.periode.akhir.slice(8)} lewat.
        </div>
      )}

      <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
        {[[`${r.tercapai}/${r.peserta}`, 'Tercapai'], [r.belum, 'Belum'], [r.tanpaTarget, 'Tanpa target'], [r.dikecualikan, 'Dikecualikan'],
          [r.targetTim ? `${angka(r.poinTim)} / ${angka(r.targetTim)}` : angka(r.poinTim), r.targetTim ? `Poin tim (${r.persenTim}%)` : 'Poin tim']].map(([v, l]) => (
          <div key={l} className="rpg-pixbox" style={{ ...pixbox, padding: '.5rem .9rem' }}>
            <div style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '.9rem', color: 'var(--rpg-gold)' }}>{v}</div>
            <div style={{ ...hud, fontSize: '.95rem', color: 'var(--rpg-ink-dim)' }}>{l}</div>
          </div>
        ))}
      </div>

      <div className="rpg-pixbox" style={{ ...pixbox, padding: '.6rem', overflowX: 'auto' }}>
        {d.rows.length === 0
          ? <p style={{ ...hud, color: 'var(--rpg-ink-faint)', margin: '.5rem' }}>Belum ada anggota produksi.</p>
          : <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 760 }}>
              <thead>
                <tr>{['#', 'Nama', 'Level', 'Target', 'Poin', '%', 'Status', 'Menunggu', ''].map((h, i) => (
                  <th key={i} scope="col" style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-dim)', textAlign: 'left', padding: '.3rem .5rem', borderBottom: '2px solid var(--rpg-line-dim)' }}>{h}</th>))}</tr>
              </thead>
              <tbody>
                {d.rows.map(x => (
                  <tr key={x.timId}>
                    <td style={{ ...hud, fontSize: '1.05rem', padding: '.4rem .5rem', color: 'var(--rpg-ink-faint)', borderBottom: '1px dashed var(--rpg-line-dim)' }}>{x.peringkat ?? '–'}</td>
                    <td style={{ ...hud, fontSize: '1.1rem', padding: '.4rem .5rem', color: 'var(--rpg-ink)', borderBottom: '1px dashed var(--rpg-line-dim)' }}>
                      {x.nama}<br /><span style={{ fontSize: '.9rem', color: 'var(--rpg-ink-faint)' }}>{x.divisi}</span>
                    </td>
                    <td style={{ ...hud, fontSize: '1.05rem', padding: '.4rem .5rem', color: 'var(--rpg-ink-dim)', borderBottom: '1px dashed var(--rpg-line-dim)' }}>{labelLevel(x.level) || '—'}</td>
                    <td style={{ ...hud, fontSize: '1.05rem', padding: '.4rem .5rem', color: 'var(--rpg-ink-dim)', borderBottom: '1px dashed var(--rpg-line-dim)' }}>
                      {x.target != null ? angka(x.target) : '—'}
                      {x.override?.target != null && <span style={{ fontSize: '.85rem', color: 'var(--rpg-gold)' }}> (disesuaikan)</span>}
                    </td>
                    <td style={{ ...hud, fontSize: '1.1rem', padding: '.4rem .5rem', color: 'var(--rpg-ink)', borderBottom: '1px dashed var(--rpg-line-dim)' }}>{angka(x.poin)}</td>
                    <td style={{ ...hud, fontSize: '1.05rem', padding: '.4rem .5rem', color: 'var(--rpg-ink-dim)', borderBottom: '1px dashed var(--rpg-line-dim)' }}>{x.persen != null ? `${x.persen}%` : '—'}</td>
                    <td style={{ padding: '.4rem .5rem', borderBottom: '1px dashed var(--rpg-line-dim)' }}><TargetChip status={kunciStatus(x, d.fase)} /></td>
                    <td style={{ ...hud, fontSize: '1.05rem', padding: '.4rem .5rem', color: 'var(--rpg-ink-faint)', borderBottom: '1px dashed var(--rpg-line-dim)' }}>
                      {x.menunggu?.n ? `${x.menunggu.n} quest · ${angka(x.menunggu.poin)}` : '—'}
                    </td>
                    <td style={{ padding: '.4rem .5rem', borderBottom: '1px dashed var(--rpg-line-dim)', textAlign: 'right' }}>
                      {!d.dikunci && <Btn small onClick={() => setModal({ jenis: 'sesuaikan', row: x })}>Sesuaikan</Btn>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>}
      </div>

      {modal?.jenis === 'sesuaikan' && (
        <SesuaikanModal row={modal.row} periode={kode} onClose={() => setModal(null)} onSaved={() => { setModal(null); res.reload(); }} />
      )}
      {modal?.jenis === 'kunci' && (
        <Modal title={`KUNCI PERIODE ${d.periode.label.toUpperCase()}?`} onClose={() => setModal(null)}>
          <p style={{ ...hud, fontSize: '1.1rem', color: 'var(--rpg-ink-dim)', margin: '0 0 1rem' }}>
            Hasil {r.peserta + r.tanpaTarget + r.dikecualikan} anggota disimpan sebagai <b style={{ color: 'var(--rpg-ink)' }}>final</b> ({r.tercapai} tercapai, {r.belum} belum).
            Mengubah target sesudahnya tidak memengaruhi periode ini, dan lencana target diberikan kepada yang berhak. Bila salah kunci, periode masih bisa dibuka kembali.
          </p>
          <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'flex-end' }}>
            <Btn onClick={() => setModal(null)} disabled={busy}>Batal</Btn>
            <Btn kind="gold" disabled={busy} onClick={() => jalankan(() => api.rpgAdminKunciPeriode(kode), `Periode ${d.periode.label} dikunci`)}>Ya, kunci</Btn>
          </div>
        </Modal>
      )}
      {modal?.jenis === 'buka' && (
        <Modal title={`BUKA KEMBALI ${d.periode.label.toUpperCase()}?`} onClose={() => setModal(null)}>
          <p style={{ ...hud, fontSize: '1.1rem', color: 'var(--rpg-ink-dim)', margin: '0 0 1rem' }}>
            Potret hasil dihapus dan periode kembali dihitung langsung dari data. Lencana target yang lahir dari periode ini ikut dicabut (yang masih memenuhi syarat dari periode lain dikembalikan).
            Penguncian otomatis ditahan sampai kamu mengunci lagi.
          </p>
          <div style={{ display: 'flex', gap: '.6rem', justifyContent: 'flex-end' }}>
            <Btn onClick={() => setModal(null)} disabled={busy}>Batal</Btn>
            <Btn kind="warn" disabled={busy} onClick={() => jalankan(() => api.rpgAdminBukaPeriode(kode), `Periode ${d.periode.label} dibuka kembali`)}>Ya, buka kembali</Btn>
          </div>
        </Modal>
      )}
    </section>
  );
}

// Tab "Target" di Kelola RPG.
export default function TargetTab() {
  const [versi, setVersi] = useState(0); // naik tiap target diubah → rekap dimuat ulang
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <Matriks onChanged={() => setVersi(v => v + 1)} />
      <Rekap refreshKey={versi} />
    </div>
  );
}
