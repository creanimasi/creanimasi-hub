import { useState, useEffect } from 'react';
import { api } from '../services/api';
import { useTim } from '../hooks/useTim';
import { useAuth } from '../hooks/useAuth';

function StarRating({ label, name, value, onChange }) {
  return (
    <div style={{ marginBottom: 14 }}>
      <label style={{ fontSize: 13, fontWeight: 500, display: 'block', marginBottom: 6 }}>{label}</label>
      <div style={{ display: 'flex', gap: 6 }}>
        {[1,2,3,4,5].map(n => (
          <button key={n} type="button"
            onClick={() => onChange(name, n)}
            style={{
              width: 36, height: 36, borderRadius: 8,
              border: `1px solid ${value >= n ? 'var(--green)' : 'var(--border-2)'}`,
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
    catatan_mentor: '',
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user?.nama) {
      const t = tim.find(x => x.nama === user.nama);
      setForm(f => ({ ...f, nama: user.nama, divisi: t?.divisi || '', level_karier: t?.level || '' }));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.nama, tim]);

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.nama || !form.mood) { setError('Nama dan mood wajib diisi'); return; }
    if (!form.skor_karya || !form.skor_waktu || !form.skor_komunikasi || !form.skor_skill) {
      setError('Pilih skor untuk semua self-assessment (karya, waktu, komunikasi, skill)'); return;
    }
    setLoading(true); setError('');
    try {
      await api.simpanJurnal(form);
      setSuccess(true);
      setTimeout(() => { setSuccess(false); onSuccess?.(); }, 2000);
      setForm(f => ({ ...f, pencapaian_1:'', pencapaian_2:'', pencapaian_3:'',
        hambatan:'', pelajaran:'', target_depan:'', catatan_mentor:'',
        mood:7, skor_karya:0, skor_waktu:0, skor_komunikasi:0, skor_skill:0 }));
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
      {error && <div className="alert alert-red" style={{ marginBottom:16 }}><span>⚠️</span><div>{error}</div></div>}

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
              Pencapaian {n} {n===1?'*':'(opsional)'}
            </label>
            <input type="text" value={form[`pencapaian_${n}`]}
              onChange={e => set(`pencapaian_${n}`, e.target.value)}
              placeholder={n===1 ? 'Apa pencapaian terbaikmu minggu ini?' : 'Pencapaian lainnya...'}
              required={n===1} />
          </div>
        ))}
      </div>

      {/* Refleksi */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:12, color:'var(--amber)' }}>💭 Refleksi</div>
        {[
          { key:'hambatan', label:'Hambatan minggu ini', placeholder:'Apa yang paling menghambatmu minggu ini?' },
          { key:'pelajaran', label:'Pelajaran / insight', placeholder:'Apa yang paling kamu pelajari minggu ini?' },
          { key:'target_depan', label:'Target minggu depan *', placeholder:'Apa yang ingin kamu capai minggu depan?', required:true },
        ].map(f => (
          <div key={f.key} style={{ marginBottom:10 }}>
            <label style={{ fontSize:12, fontWeight:500, display:'block', marginBottom:5 }}>{f.label}</label>
            <textarea rows={2} value={form[f.key]}
              onChange={e => set(f.key, e.target.value)}
              placeholder={f.placeholder} required={f.required}
              style={{ resize:'vertical', minHeight:60 }} />
          </div>
        ))}
      </div>

      {/* Self assessment */}
      <div className="card" style={{ marginBottom:16 }}>
        <div style={{ fontSize:13, fontWeight:600, marginBottom:14, color:'var(--coral)' }}>📊 Self-assessment</div>
        <MoodSlider value={form.mood} onChange={set} />
        <StarRating label="Kualitas karya minggu ini" name="skor_karya" value={form.skor_karya} onChange={set} />
        <StarRating label="Manajemen waktu" name="skor_waktu" value={form.skor_waktu} onChange={set} />
        <StarRating label="Komunikasi dengan tim" name="skor_komunikasi" value={form.skor_komunikasi} onChange={set} />
        <StarRating label="Perkembangan skill" name="skor_skill" value={form.skor_skill} onChange={set} />
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

      <button type="submit" className="btn btn-primary" style={{ width:'100%', padding:'10px', fontSize:14, justifyContent:'center' }} disabled={loading}>
        {loading ? 'Menyimpan...' : '✅ Kirim Jurnal Refleksi'}
      </button>
    </form>
  );
}
