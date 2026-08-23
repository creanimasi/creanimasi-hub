import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useTim } from '../hooks/useTim';
import { useAuth } from '../hooks/useAuth';

function FieldError({ msg }) {
  if (!msg) return null;
  return <div style={{ fontSize: 11, color: 'var(--red)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 4 }}>⚠ {msg}</div>;
}

function StarRating({ label, name, value, onChange, error }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button"
            onClick={() => onChange(name, n)}
            style={{
              width: 36, height: 36, borderRadius: 8,
              border: `1px solid ${error && !value ? 'var(--red)' : value >= n ? 'var(--green)' : 'var(--border-2)'}`,
              background: value >= n ? 'var(--green-light)' : 'var(--surface)',
              color: value >= n ? 'var(--green)' : 'var(--text-2)',
              fontWeight: 600, fontSize: 14, cursor: 'pointer'
            }}>
            {n}
          </button>
        ))}
        <span style={{ marginLeft: 8, fontSize: 12, color: 'var(--text-2)', alignSelf: 'center' }}>
          {value ? `${value}/5` : 'belum dipilih'}
        </span>
      </div>
      <FieldError msg={error} />
    </div>
  );
}

function MoodSlider({ value, onChange }) {
  const color = value >= 8 ? 'var(--green)' : value >= 5 ? 'var(--amber)' : 'var(--red)';
  const label = value >= 8 ? '😊 Bagus' : value >= 5 ? '😐 Sedang' : '😔 Berat';
  return (
    <div style={{ marginBottom: 16 }}>
      <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 8 }}>
        Mood & energi minggu ini <span style={{ color, fontWeight: 700 }}>{value}/10 — {label}</span>
      </label>
      <input type="range" min={1} max={10} value={value}
        onChange={e => onChange('mood', parseInt(e.target.value))}
        style={{ width: '100%', accentColor: color }} />
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'var(--text-2)', marginTop: 2 }}>
        <span>1 — Sangat berat</span><span>10 — Luar biasa</span>
      </div>
    </div>
  );
}

export default function FormJurnal({ onSuccess }) {
  const { user } = useAuth();
  const tim = useTim();

  // Cari data anggota berdasarkan user yang login
  const timData = tim.find(t => t.nama === user?.nama);

  const [form, setForm] = useState({
    nama: user?.nama || '',
    divisi: timData?.divisi || '',
    level_karier: timData?.level || '',
    pencapaian_1: '', pencapaian_2: '', pencapaian_3: '',
    hambatan: '', pelajaran: '', target_depan: '',
    mood: 7, skor_karya: 0, skor_waktu: 0, skor_komunikasi: 0, skor_skill: 0,
    catatan_mentor: '', request_1on1: false, catatan_request: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (user?.nama) {
      const t = tim.find(x => x.nama === user.nama);
      setForm(f => ({ ...f, nama: user.nama, divisi: t?.divisi || '', level_karier: t?.level || '' }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.nama, tim]);

  const set = (k, v) => {
    setForm(f => ({ ...f, [k]: v }));
    if (errors[k]) setErrors(e => ({ ...e, [k]: '' }));
  };

  const validate = () => {
    const e = {};
    if (!form.pencapaian_1?.trim()) e.pencapaian_1 = 'Pencapaian utama wajib diisi';
    if (!form.target_depan?.trim()) e.target_depan = 'Target minggu depan wajib diisi';
    if (!form.skor_karya) e.skor_karya = 'Pilih skor kualitas karya';
    if (!form.skor_waktu) e.skor_waktu = 'Pilih skor manajemen waktu';
    if (!form.skor_komunikasi) e.skor_komunikasi = 'Pilih skor komunikasi';
    if (!form.skor_skill) e.skor_skill = 'Pilih skor perkembangan skill';
    return e;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); setError('Ada field yang belum diisi'); return; }
    setLoading(true); setError(''); setErrors({});
    try {
      await api.simpanJurnal(form);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onSuccess?.(); }, 2000);
      setForm(f => ({ ...f, pencapaian_1:'', pencapaian_2:'', pencapaian_3:'',
        hambatan:'', pelajaran:'', target_depan:'', catatan_mentor:'',
        mood:7, skor_karya:0, skor_waktu:0, skor_komunikasi:0, skor_skill:0,
        request_1on1: false, catatan_request: '' }));
    } catch (err) {
      setError(err.message);
    } finally { setLoading(false); }
  };

  if (success) return (
    <div style={{ textAlign:'center', padding:40 }}>
      <div style={{ fontSize:40, marginBottom:12 }}>✅</div>
      <div style={{ fontSize:16, fontWeight:600, color:'var(--green)' }}>Jurnal berhasil disimpan!</div>
      <div style={{ fontSize:13, color:'var(--text-2)', marginTop:4 }}>Terima kasih sudah meluangkan waktu untuk refleksi.</div>
    </div>
  );

  return (
    <form onSubmit={handleSubmit}>
      {error && Object.keys(errors).length > 0 && (
        <div className="alert alert-red" style={{ marginBottom:16 }}><span>⚠️</span><div>Lengkapi semua field yang ditandai di bawah</div></div>
      )}
      {error && Object.keys(errors).length === 0 && (
        <div className="alert alert-red" style={{ marginBottom:16 }}><span>⚠️</span><div>{error}</div></div>
      )}

      {/* Identitas */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color:'var(--green)' }}>👤 Identitas</div>
        <div style={{
          display:'flex', alignItems:'center', gap:12,
          padding:'10px 12px', borderRadius:10,
          background:'var(--surface-2)', border:'1px solid var(--border)',
        }}>
          <div style={{
            width:40, height:40, borderRadius:10, flexShrink:0,
            background:'var(--green-light)', color:'var(--green)',
            display:'flex', alignItems:'center', justifyContent:'center',
            fontSize:14, fontWeight:800,
          }}>
            {user?.nama?.split(' ').slice(0,2).map(w=>w[0]).join('')}
          </div>
          <div>
            <div style={{ fontSize:14, fontWeight:700 }}>{form.nama}</div>
            <div style={{ fontSize:11, color:'var(--text-2)', marginTop:2 }}>
              {form.divisi} — {form.level_karier}
            </div>
          </div>
          <div style={{ marginLeft:'auto', fontSize:10, color:'var(--green)', fontWeight:600,
            background:'var(--green-light)', padding:'3px 8px', borderRadius:6 }}>
            ✓ Terdeteksi otomatis
          </div>
        </div>
      </div>

      {/* Pencapaian */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color:'var(--purple)' }}>🏆 Pencapaian minggu ini</div>
        {[1,2,3].map(n => (
          <div key={n} style={{ marginBottom:10 }}>
            <label style={{ fontSize:12, fontWeight:500, display:'block', marginBottom:5 }}>
              Pencapaian {n} {n===1 ? <span style={{ color:'var(--red)' }}>*</span> : <span style={{ color:'var(--text-3)' }}>(opsional)</span>}
            </label>
            <input type="text" value={form[`pencapaian_${n}`]}
              onChange={e => set(`pencapaian_${n}`, e.target.value)}
              placeholder={n===1 ? 'Apa pencapaian terbaikmu minggu ini?' : 'Pencapaian lainnya...'}
              style={{ borderColor: n===1 && errors.pencapaian_1 ? 'var(--red)' : undefined }} />
            {n===1 && <FieldError msg={errors.pencapaian_1} />}
          </div>
        ))}
      </div>

      {/* Refleksi */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color:'var(--amber)' }}>💭 Refleksi</div>
        {[
          { key:'hambatan', label:'Hambatan minggu ini', placeholder:'Apa yang paling menghambatmu minggu ini?', required:false },
          { key:'pelajaran', label:'Pelajaran / insight', placeholder:'Apa yang paling kamu pelajari minggu ini?', required:false },
          { key:'target_depan', label:<>Target minggu depan <span style={{ color:'var(--red)' }}>*</span></>, placeholder:'Apa yang ingin kamu capai minggu depan?', required:true },
        ].map(f => (
          <div key={f.key} style={{ marginBottom:10 }}>
            <label style={{ fontSize:12, fontWeight:500, display:'block', marginBottom:5 }}>{f.label}</label>
            <textarea rows={2} value={form[f.key]}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder}
              style={{ resize:'vertical', minHeight:60, borderColor: f.required && errors[f.key] ? 'var(--red)' : undefined }} />
            {f.required && <FieldError msg={errors[f.key]} />}
          </div>
        ))}
      </div>

      {/* Self assessment */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:14, color:'var(--coral)' }}>📊 Self-assessment</div>
        <MoodSlider value={form.mood} onChange={set} />
        <StarRating label={<>Kualitas karya minggu ini <span style={{ color:'var(--red)' }}>*</span></>} name="skor_karya" value={form.skor_karya} onChange={set} error={errors.skor_karya} />
        <StarRating label={<>Manajemen waktu <span style={{ color:'var(--red)' }}>*</span></>} name="skor_waktu" value={form.skor_waktu} onChange={set} error={errors.skor_waktu} />
        <StarRating label={<>Komunikasi dengan tim <span style={{ color:'var(--red)' }}>*</span></>} name="skor_komunikasi" value={form.skor_komunikasi} onChange={set} error={errors.skor_komunikasi} />
        <StarRating label={<>Perkembangan skill <span style={{ color:'var(--red)' }}>*</span></>} name="skor_skill" value={form.skor_skill} onChange={set} error={errors.skor_skill} />
      </div>

      {/* Pesan ke Secondline / admin */}
      <div className="card" style={{ marginBottom:20 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:4, color:'var(--text-2)' }}>💌 Pesan ke Secondline / Koordinator (opsional)</div>
        <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:10 }}>Ada yang ingin kamu sampaikan ke Mas Kholed atau Secondline minggu ini?</div>
        <textarea rows={3} value={form.catatan_mentor}
          onChange={e => set('catatan_mentor', e.target.value)}
          placeholder="Ada hal yang ingin kamu sampaikan ke mentor atau Secondline?..."
          style={{ resize:'vertical' }} />
      </div>

      {/* Request sesi 1-on-1 */}
      <div className="card" style={{ marginBottom:20, border: form.request_1on1 ? '1.5px solid var(--green)' : '1px solid var(--border)', background: form.request_1on1 ? 'var(--green-light)' : 'var(--surface)', transition: 'all .2s' }}>
        <label style={{ display:'flex', alignItems:'flex-start', gap:12, cursor:'pointer' }}>
          <input
            type="checkbox"
            checked={form.request_1on1}
            onChange={e => set('request_1on1', e.target.checked)}
            style={{ marginTop:2, width:16, height:16, accentColor:'var(--green)', flexShrink:0 }}
          />
          <div>
            <div style={{ fontSize:13, fontWeight:700, color: form.request_1on1 ? 'var(--green)' : 'var(--text)' }}>
              🗣️ Saya ingin sesi ngobrol dengan mentor minggu ini
            </div>
            <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
              Mentor akan diberitahu dan menghubungimu untuk jadwal.
            </div>
          </div>
        </label>
        {form.request_1on1 && (
          <div style={{ marginTop:12 }}>
            <textarea
              rows={2}
              value={form.catatan_request}
              onChange={e => set('catatan_request', e.target.value)}
              placeholder="Topik yang ingin dibahas atau waktu yang memungkinkan... (opsional)"
              style={{ resize:'vertical', fontSize:12 }}
            />
          </div>
        )}
      </div>

      <button type="submit" className="btn btn-primary" style={{ width:'100%', padding:'10px', fontSize:14, justifyContent:'center' }} disabled={loading}>
        {loading ? 'Menyimpan...' : '✅ Kirim Jurnal Refleksi'}
      </button>
    </form>
  );
}
