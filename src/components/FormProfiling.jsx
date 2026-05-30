import { useState } from 'react';
import { api } from '../services/api';

// ── FIELD HELPERS ─────────────────────────────────────────────────────────
function Field({ label, required, hint, children }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 5 }}>
        {label} {required && <span style={{ color: 'var(--red)' }}>*</span>}
        {hint && <span style={{ fontWeight: 400, color: 'var(--text-2)', marginLeft: 4 }}>— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Select({ value, onChange, options, placeholder }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder || '— Pilih —'}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Rating({ label, name, value, onChange, max = 5 }) {
  return (
    <Field label={label}>
      <div style={{ display: 'flex', gap: 6 }}>
        {Array.from({ length: max }, (_, i) => i + 1).map(n => (
          <button key={n} type="button"
            onClick={() => onChange(name, n)}
            style={{
              width: 36, height: 36, borderRadius: 8,
              border: `1px solid ${value >= n ? 'var(--green)' : 'var(--border-2)'}`,
              background: value >= n ? 'var(--green-light)' : 'var(--surface)',
              color: value >= n ? 'var(--green)' : 'var(--text-2)',
              fontWeight: 600, fontSize: 13, cursor: 'pointer',
            }}>
            {n}
          </button>
        ))}
        <span style={{ fontSize: 12, color: 'var(--text-2)', alignSelf: 'center', marginLeft: 4 }}>
          {value ? `${value}/${max}` : '—'}
        </span>
      </div>
    </Field>
  );
}

// ── BAGIAN UMUM (semua divisi) ─────────────────────────────────────────────
function BagianUmum({ form, set }) {
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--green)' }}>👤 Identitas & Latar Belakang</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <Field label="Nama lengkap" required>
          <input value={form.nama} onChange={e => set('nama', e.target.value)} placeholder="Nama lengkap" required />
        </Field>
        <Field label="Usia">
          <input type="number" value={form.usia} onChange={e => set('usia', e.target.value)} placeholder="Umur" min={15} max={60} />
        </Field>
        <Field label="Tanggal bergabung" required>
          <input type="date" value={form.tanggal_bergabung} onChange={e => set('tanggal_bergabung', e.target.value)} required />
        </Field>
        <Field label="Domisili kota">
          <input value={form.domisili} onChange={e => set('domisili', e.target.value)} placeholder="Kota" />
        </Field>
      </div>
      <Field label="Level karier saat ini">
        <Select value={form.level_karier} onChange={v => set('level_karier', v)}
          options={['Magang / Probation','Junior Team','Senior Team','Admin (L4)','Secondline','Koordinator']} />
      </Field>
    </div>
  );
}

function BagianKarakter({ form, set }) {
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--purple)' }}>🧠 Karakter & Cara Kerja</div>
      <Field label="Paling produktif di waktu">
        <Select value={form.produktif_waktu} onChange={v => set('produktif_waktu', v)}
          options={['Pagi','Siang','Sore','Malam','Fleksibel']} />
      </Field>
      <Field label="Gaya kerja">
        <Select value={form.gaya_kerja} onChange={v => set('gaya_kerja', v)}
          options={['Cepat selesai lalu revisi','Suka detail, perfeksionis','Seimbang keduanya']} />
      </Field>
      <Field label="Kalau dapat feedback / kritik">
        <Select value={form.respons_feedback} onChange={v => set('respons_feedback', v)}
          options={['Langsung terapkan','Pertimbangkan dulu','Butuh waktu untuk proses']} />
      </Field>
      <Field label="Ketika deadline mepet">
        <Select value={form.deadline_mepet} onChange={v => set('deadline_mepet', v)}
          options={['Makin fokus dan cepat','Panik tapi selesai','Butuh bantuan tim']} />
      </Field>
      <Rating label="Lebih suka bekerja sendiri atau tim? (1=sendiri, 5=tim)" name="skor_kerja_tim" value={form.skor_kerja_tim || 0} onChange={set} />
    </div>
  );
}

function BagianMotivasi({ form, set }) {
  return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--amber)' }}>🔥 Motivasi & Arah</div>
      <Field label="Hal yang paling membuatmu semangat kerja" required>
        <input value={form.semangat_kerja} onChange={e => set('semangat_kerja', e.target.value)}
          placeholder="Apa yang bikin kamu bersemangat?" required />
      </Field>
      <Field label="Hal yang paling menguras energimu">
        <input value={form.penguras_energi} onChange={e => set('penguras_energi', e.target.value)}
          placeholder="Apa yang paling melelahkan?" />
      </Field>
      <Field label="Di mana kamu 1 tahun lagi?" required>
        <textarea rows={2} value={form.target_1_tahun} onChange={e => set('target_1_tahun', e.target.value)}
          placeholder="Visi atau target kamu 1 tahun ke depan..." required style={{ resize: 'vertical', minHeight: 56 }} />
      </Field>
      <Field label="Skill yang paling ingin dikuasai">
        <input value={form.skill_ingin_dikuasai} onChange={e => set('skill_ingin_dikuasai', e.target.value)}
          placeholder="Skill apa yang ingin kamu develop?" />
      </Field>
      <Field label="Tertarik memimpin tim?">
        <Select value={form.tertarik_memimpin} onChange={v => set('tertarik_memimpin', v)}
          options={['Ya, sangat tertarik','Mungkin, kalau sudah siap','Belum tertarik saat ini']} />
      </Field>
      <Field label="Alasan bergabung Creanimasi" required>
        <textarea rows={2} value={form.alasan_bergabung} onChange={e => set('alasan_bergabung', e.target.value)}
          placeholder="Kenapa kamu bergabung di Creanimasi?" required style={{ resize: 'vertical', minHeight: 56 }} />
      </Field>
      <Field label="1 hal yang ingin diubah atau diperbaiki di Creanimasi">
        <textarea rows={2} value={form.ingin_diubah} onChange={e => set('ingin_diubah', e.target.value)}
          placeholder="Kalau ada 1 hal yang bisa kamu ubah, apa itu?" style={{ resize: 'vertical', minHeight: 56 }} />
      </Field>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, fontWeight: 500, display: 'block', marginBottom: 8 }}>
          Kepuasan perkembangan diri di Creanimasi (1–10) *
          <span style={{ marginLeft: 8, fontWeight: 700, color: form.kepuasan_diri >= 7 ? 'var(--green)' : form.kepuasan_diri >= 5 ? 'var(--amber)' : 'var(--red)' }}>
            {form.kepuasan_diri}/10
          </span>
        </label>
        <input type="range" min={1} max={10} value={form.kepuasan_diri || 5}
          onChange={e => set('kepuasan_diri', parseInt(e.target.value))}
          style={{ width: '100%', accentColor: 'var(--green)' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-2)', marginTop: 2 }}>
          <span>1 — Sangat tidak puas</span><span>10 — Sangat puas</span>
        </div>
      </div>
    </div>
  );
}

// ── BAGIAN TEKNIS PER DIVISI ───────────────────────────────────────────────
function TeknisDivisi({ divisi, form, set }) {
  if (divisi === 'admin') return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--coral)' }}>💼 Skill & Pengalaman Admin</div>
      <Field label="Platform yang dikuasai">
        <input value={form.platform_dikuasai} onChange={e => set('platform_dikuasai', e.target.value)}
          placeholder="Fiverr, VGen, Etsy, Instagram, dst..." />
      </Field>
      <Rating label="Skill copywriting (1=dasar, 5=mahir)" name="skill_copywriting" value={form.skill_copywriting || 0} onChange={set} />
      <Rating label="Nyaman komunikasi langsung dengan klien" name="skor_komunikasi" value={form.skor_komunikasi || 0} onChange={set} />
      <Field label="Pengalaman handle komplain klien?">
        <Select value={form.pengalaman_komplain} onChange={v => set('pengalaman_komplain', v)}
          options={['Ya, sering','Pernah beberapa kali','Belum pernah']} />
      </Field>
      <Field label="Bisa buat konten sosmed (desain & caption)?">
        <Select value={form.bisa_konten_sosmed} onChange={v => set('bisa_konten_sosmed', v)}
          options={['Ya, bisa keduanya','Hanya desain','Hanya caption','Belum bisa']} />
      </Field>
      <Field label="Tools desain yang dikuasai">
        <input value={form.tools_desain} onChange={e => set('tools_desain', e.target.value)}
          placeholder="Canva, Adobe Illustrator, Figma, dst..." />
      </Field>
    </div>
  );

  if (divisi === 'pm') return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--blue)' }}>📋 Skill & Pengalaman PM</div>
      <Field label="Tools manajemen project yang dikuasai">
        <input value={form.tools_project} onChange={e => set('tools_project', e.target.value)}
          placeholder="Trello, Notion, Google Sheets, Asana, dst..." />
      </Field>
      <Field label="Pengalaman koordinasi tim (berapa orang)">
        <Select value={form.pengalaman_koordinasi} onChange={v => set('pengalaman_koordinasi', v)}
          options={['1-2 orang','3-5 orang','6-10 orang','Lebih dari 10 orang']} />
      </Field>
      <Rating label="Skill komunikasi dengan tim & klien" name="skill_komunikasi" value={form.skill_komunikasi || 0} onChange={set} />
      <Rating label="Nyaman komunikasi langsung dengan klien/Admin" name="skor_komunikasi_klien" value={form.skor_komunikasi_klien || 0} onChange={set} />
      <Field label="Cara prioritas saat banyak project">
        <Select value={form.prioritas_project} onChange={v => set('prioritas_project', v)}
          options={['Berdasarkan deadline','Berdasarkan kompleksitas','Berdasarkan nilai order','First in first out']} />
      </Field>
      <Field label="Bahasa yang dikuasai">
        <input value={form.bahasa_dikuasai} onChange={e => set('bahasa_dikuasai', e.target.value)}
          placeholder="Indonesia, Inggris, dst..." />
      </Field>
    </div>
  );

  if (divisi === 'illustrator') return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--purple)' }}>🎨 Skill & Pengalaman Illustrator</div>
      <Field label="Software utama yang dikuasai">
        <input value={form.software_utama} onChange={e => set('software_utama', e.target.value)}
          placeholder="Clip Studio Paint, Procreate, Photoshop, dst..." />
      </Field>
      <Rating label="Skill level software utama" name="skill_level_csp" value={form.skill_level_csp || 0} onChange={set} />
      <Field label="Spesialisasi karakter">
        <input value={form.spesialisasi} onChange={e => set('spesialisasi', e.target.value)}
          placeholder="VTuber, Chibi, Semi-real, Anime, dst..." />
      </Field>
      <Field label="Rata-rata waktu pengerjaan 1 karakter full">
        <input value={form.waktu_1_karakter} onChange={e => set('waktu_1_karakter', e.target.value)}
          placeholder="Contoh: 4-6 jam" />
      </Field>
      <Field label="Bisa handle berapa project paralel?">
        <input type="number" value={form.kapasitas_paralel} onChange={e => set('kapasitas_paralel', e.target.value)}
          placeholder="Jumlah project" min={1} max={20} />
      </Field>
      <Field label="Link portofolio">
        <input type="url" value={form.link_portofolio} onChange={e => set('link_portofolio', e.target.value)}
          placeholder="https://..." />
      </Field>
      <Rating label="Nyaman komunikasi langsung dengan Admin/klien" name="skor_komunikasi" value={form.skor_komunikasi || 0} onChange={set} />
    </div>
  );

  if (divisi === 'rigger') return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--coral)' }}>🎬 Skill & Pengalaman Rigger</div>
      <Field label="Software rigging yang dikuasai">
        <input value={form.software_rigging} onChange={e => set('software_rigging', e.target.value)}
          placeholder="Live2D Cubism, After Effects, dst..." />
      </Field>
      <Rating label="Skill level Live2D" name="skill_level_live2d" value={form.skill_level_live2d || 0} onChange={set} />
      <Field label="Bisa setup physics & expression layer?">
        <Select value={form.bisa_physics_expr} onChange={v => set('bisa_physics_expr', v)}
          options={['Ya, bisa semua','Sebagian bisa','Masih belajar']} />
      </Field>
      <Field label="Pengalaman rigging VTuber model (jumlah project)">
        <input value={form.pengalaman_project} onChange={e => set('pengalaman_project', e.target.value)}
          placeholder="Contoh: 50 project, lebih dari 100, dst..." />
      </Field>
      <Field label="Rata-rata waktu rigging 1 model full">
        <input value={form.waktu_rigging} onChange={e => set('waktu_rigging', e.target.value)}
          placeholder="Contoh: 2-3 hari" />
      </Field>
      <Field label="Link portofolio">
        <input type="url" value={form.link_portofolio} onChange={e => set('link_portofolio', e.target.value)}
          placeholder="https://..." />
      </Field>
      <Rating label="Nyaman komunikasi langsung dengan Admin/klien" name="skor_komunikasi" value={form.skor_komunikasi || 0} onChange={set} />
    </div>
  );

  if (divisi === '3d') return (
    <div className="card" style={{ marginBottom: 14 }}>
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12, color: 'var(--blue)' }}>📦 Skill & Pengalaman 3D Modeler</div>
      <Field label="Software 3D yang dikuasai">
        <input value={form.software_3d} onChange={e => set('software_3d', e.target.value)}
          placeholder="Blender, VRoid Studio, ZBrush, dst..." />
      </Field>
      <Rating label="Skill level Blender" name="skill_level_blender" value={form.skill_level_blender || 0} onChange={set} />
      <Field label="Jenis output yang bisa dikerjakan">
        <input value={form.jenis_output} onChange={e => set('jenis_output', e.target.value)}
          placeholder="VRM, 3D Print, AR Filter, Chibi, dst..." />
      </Field>
      <Field label="Untuk VRM — bisa export & setup siap pakai?">
        <Select value={form.bisa_vrm_export} onChange={v => set('bisa_vrm_export', v)}
          options={['Bisa mandiri','Bisa tapi perlu bantuan','Masih belajar']} />
      </Field>
      <Field label="Untuk 3D Print — bisa watertight & siap cetak?">
        <Select value={form.bisa_3d_print} onChange={v => set('bisa_3d_print', v)}
          options={['Ya, bisa','Cukup bisa','Belum bisa']} />
      </Field>
      <Field label="Pernah publish AR Filter di IG/TikTok?">
        <Select value={form.pernah_ar_filter} onChange={v => set('pernah_ar_filter', v)}
          options={['Ya, sudah pernah','Sedang belajar','Belum pernah']} />
      </Field>
      <Field label="Rata-rata waktu pengerjaan 1 model VRM full">
        <input value={form.waktu_vrm} onChange={e => set('waktu_vrm', e.target.value)}
          placeholder="Contoh: 3-5 hari" />
      </Field>
      <Rating label="Nyaman komunikasi langsung dengan Admin/klien" name="skor_komunikasi" value={form.skor_komunikasi || 0} onChange={set} />
    </div>
  );

  return null;
}

// ── MAIN COMPONENT ──────────────────────────────────────────────────────────
const DIVISI_LIST = [
  { id: 'admin',       label: 'Admin Market',    ico: '💼' },
  { id: 'pm',          label: 'Project Manager', ico: '📋' },
  { id: 'illustrator', label: 'Illustrator',     ico: '🎨' },
  { id: 'rigger',      label: 'Rigger/Animator', ico: '🎬' },
  { id: '3d',          label: '3D Modeler',      ico: '📦' },
];

const defaultForm = () => ({
  nama:'', usia:'', tanggal_bergabung:'', domisili:'', level_karier:'',
  platform_dikuasai:'', skill_copywriting:0, pengalaman_komplain:'',
  bisa_konten_sosmed:'', tools_desain:'',
  tools_project:'', pengalaman_koordinasi:'', skill_komunikasi:0,
  skor_komunikasi_klien:0, prioritas_project:'', bahasa_dikuasai:'',
  software_utama:'', skill_level_csp:0, spesialisasi:'',
  waktu_1_karakter:'', kapasitas_paralel:'', link_portofolio:'',
  software_rigging:'', skill_level_live2d:0, bisa_physics_expr:'',
  pengalaman_project:'', waktu_rigging:'',
  software_3d:'', skill_level_blender:0, jenis_output:'',
  bisa_vrm_export:'', bisa_3d_print:'', pernah_ar_filter:'', waktu_vrm:'',
  produktif_waktu:'', gaya_kerja:'', respons_feedback:'', deadline_mepet:'',
  skor_kerja_tim:0, skor_komunikasi:0,
  semangat_kerja:'', penguras_energi:'', target_1_tahun:'',
  skill_ingin_dikuasai:'', tertarik_memimpin:'', alasan_bergabung:'',
  ingin_diubah:'', kepuasan_diri:5,
});

export default function FormProfiling({ onSuccess }) {
  const [divisi, setDivisi] = useState('');
  const [form, setForm] = useState(defaultForm());
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!divisi) { setError('Pilih divisimu dulu'); return; }
    if (!form.nama) { setError('Nama wajib diisi'); return; }
    setLoading(true); setError('');
    try {
      await api.simpanProfiling(divisi, { ...form, divisi });
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onSuccess?.(); }, 2500);
      setForm(defaultForm()); setDivisi('');
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  if (success) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>🎉</div>
      <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--green)' }}>Profiling berhasil disimpan!</div>
      <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 4 }}>Data kamu sudah masuk ke Command Center Creanimasi.</div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      {error && <div className="alert alert-red" style={{ marginBottom: 16 }}><span>⚠️</span><div>{error}</div></div>}

      {/* Pilih divisi */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 12 }}>Kamu di divisi mana? *</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {DIVISI_LIST.map(d => (
            <button key={d.id} type="button"
              onClick={() => setDivisi(d.id)}
              style={{
                padding: '8px 14px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${divisi === d.id ? 'var(--green)' : 'var(--border-2)'}`,
                background: divisi === d.id ? 'var(--green-light)' : 'var(--surface)',
                color: divisi === d.id ? 'var(--green)' : 'var(--text)',
                fontWeight: divisi === d.id ? 600 : 400, fontSize: 13,
              }}>
              {d.ico} {d.label}
            </button>
          ))}
        </div>
      </div>

      {divisi && (
        <>
          <BagianUmum form={form} set={set} />
          <TeknisDivisi divisi={divisi} form={form} set={set} />
          <BagianKarakter form={form} set={set} />
          <BagianMotivasi form={form} set={set} />

          <button type="submit" className="btn btn-primary"
            style={{ width: '100%', padding: '10px', fontSize: 14, justifyContent: 'center' }}
            disabled={loading}>
            {loading ? 'Menyimpan...' : '✅ Kirim Form Profiling'}
          </button>
        </>
      )}
    </form>
  );
}
