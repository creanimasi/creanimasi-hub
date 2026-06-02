import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TIM, TIPE_COLOR, DIVISI_COLOR } from '../data/tim';
import { api } from '../services/api';

export default function Profil() {
  const { user, logout } = useAuth();
  const navigate         = useNavigate();
  const member           = TIM.find(t => t.nama === user?.nama);
  const tc               = member ? (TIPE_COLOR[member.tipe]  || {}) : {};
  const dc               = member ? (DIVISI_COLOR[member.divisi] || {}) : {};
  const inits            = user?.nama?.split(' ').slice(0, 2).map(w => w[0]).join('') || '?';

  const [form, setForm]     = useState({ password_lama: '', password_baru: '', konfirmasi: '' });

  // Edit info pribadi
  const [editInfo, setEditInfo]     = useState(false);
  const [infoForm, setInfoForm]     = useState({ semangat_kerja:'', penguras_energi:'', target_1_tahun:'' });
  const [savingInfo, setSavingInfo] = useState(false);
  const [infoMsg, setInfoMsg]       = useState(null);
  const [profilingList, setProfilingList] = useState([]);
  const [showRiwayat, setShowRiwayat]     = useState(false);

  const divisiMap = { 'Admin':'admin','PM':'pm','Illustrator':'illustrator','Rigger':'rigger','3D Modeler':'3d' };
  const divisiId  = divisiMap[member?.divisi] || 'admin';

  useEffect(() => {
    api.getProfilingMe()
      .then(res => {
        if (res.data) setInfoForm({
          semangat_kerja:  res.data.semangat_kerja  || member?.semangat || '',
          penguras_energi: res.data.penguras_energi || member?.energi   || '',
          target_1_tahun:  res.data.target_1_tahun  || member?.target   || '',
        });
      }).catch(() => {});
    // Ambil riwayat profiling
    if (member?.divisi) {
      api.getProfiling(divisiId)
        .then(res => setProfilingList((res.data||[]).filter(p => p.nama === user?.nama)))
        .catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSaveInfo = async (e) => {
    e.preventDefault();
    setSavingInfo(true); setInfoMsg(null);
    try {
      await api.updateProfil(infoForm);
      setInfoMsg({ type:'ok', text:'Info pribadi berhasil diperbarui!' });
      setEditInfo(false);
    } catch { setInfoMsg({ type:'err', text:'Gagal menyimpan.' }); }
    finally { setSavingInfo(false); }
  };
  const [showPass, setShow] = useState({ lama: false, baru: false, kon: false });
  const [loading, setLoad]  = useState(false);
  const [msg, setMsg]       = useState(null); // { type: 'ok'|'err', text }

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  const handleGantiPass = async (e) => {
    e.preventDefault();
    if (form.password_baru !== form.konfirmasi) {
      setMsg({ type: 'err', text: 'Konfirmasi password tidak cocok.' }); return;
    }
    if (form.password_baru.length < 6) {
      setMsg({ type: 'err', text: 'Password baru minimal 6 karakter.' }); return;
    }
    setLoad(true); setMsg(null);
    try {
      await api.gantiPassword(form.password_lama, form.password_baru);
      setMsg({ type: 'ok', text: 'Password berhasil diubah. Silakan login ulang.' });
      setForm({ password_lama: '', password_baru: '', konfirmasi: '' });
      setTimeout(() => { logout(); navigate('/login'); }, 2000);
    } catch (err) {
      setMsg({ type: 'err', text: err.message || 'Gagal mengubah password.' });
    } finally { setLoad(false); }
  };

  const RANK_ICON = {
    'Rising Star': '⭐', 'High Potential': '💎',
    'Silent Expert': '🛡️', 'At Risk': '⚠️',
  };

  return (
    <div style={{ maxWidth: 560, margin: '0 auto' }}>

      {/* ── Kartu identitas ── */}
      <div className="card" style={{
        marginBottom: 20, overflow: 'hidden', position: 'relative',
        border: `1px solid ${tc.text || 'var(--border)'}30`,
      }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 4,
          background: tc.text || 'var(--green)', opacity: .7 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingTop: 8 }}>
          {/* Avatar */}
          <div style={{
            width: 64, height: 64, borderRadius: 16, flexShrink: 0,
            background: tc.bg || 'var(--green-light)',
            color:  tc.text || 'var(--green)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22, fontWeight: 800,
            border: `2px solid ${tc.text || 'var(--green)'}30`,
            boxShadow: `0 0 20px ${tc.text || 'var(--green)'}15`,
          }}>{inits}</div>

          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 6 }}>{user?.nama}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {member && (
                <span style={{ background: dc.bg, color: dc.text,
                  padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 600 }}>
                  {dc.icon} {member.divisi}
                </span>
              )}
              {member && (
                <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{member.level}</span>
              )}
              {member?.tipe && (
                <span style={{ background: tc.bg, color: tc.text,
                  padding: '2px 9px', borderRadius: 99, fontSize: 11, fontWeight: 700,
                  border: `1px solid ${tc.text}30` }}>
                  {RANK_ICON[member.tipe]} {member.tipe}
                </span>
              )}
              <span style={{ fontSize: 11, padding: '2px 9px', borderRadius: 99,
                background: user?.role === 'admin' ? 'var(--amber-light)' : 'var(--surface-2)',
                color: user?.role === 'admin' ? 'var(--amber)' : 'var(--text-3)',
                fontWeight: 600 }}>
                {user?.role === 'admin' ? '👑 Admin' : '👤 Member'}
              </span>
            </div>
          </div>

          {member && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: 10, color: 'var(--text-3)', marginBottom: 2 }}>Bergabung</div>
              <div style={{ fontSize: 13, fontWeight: 600 }}>{member.bergabung}</div>
              <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{member.lama}</div>
            </div>
          )}
        </div>

        {/* Info tambahan */}
        {member && (
          <div style={{ marginTop:16, paddingTop:14, borderTop:'1px solid var(--border)' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)',
                textTransform:'uppercase', letterSpacing:'.06em' }}>Info Pribadi</div>
              <button onClick={() => setEditInfo(!editInfo)} className="btn btn-sm"
                style={{ fontSize:11, padding:'3px 10px' }}>
                {editInfo ? 'Batal' : '✏️ Edit'}
              </button>
            </div>

            {infoMsg && (
              <div className={`alert ${infoMsg.type==='ok'?'alert-green':'alert-red'}`}
                style={{ marginBottom:10, fontSize:12 }}>
                <span>{infoMsg.type==='ok'?'✅':'⚠️'}</span><div>{infoMsg.text}</div>
              </div>
            )}

            {editInfo ? (
              <form onSubmit={handleSaveInfo}>
                {[
                  { key:'semangat_kerja',  label:'💪 Sumber semangat',  ph:'Apa yang membuatmu semangat?' },
                  { key:'penguras_energi', label:'⚡ Penguras energi',   ph:'Apa yang paling melelahkan?' },
                  { key:'target_1_tahun',  label:'🎯 Target 1 tahun',    ph:'Di mana kamu 1 tahun ke depan?' },
                ].map(f => (
                  <div key={f.key} style={{ marginBottom:10 }}>
                    <label style={{ fontSize:10, fontWeight:700, color:'var(--text-3)',
                      textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:4 }}>
                      {f.label}
                    </label>
                    <textarea rows={2} value={infoForm[f.key]}
                      onChange={e => setInfoForm(x=>({...x,[f.key]:e.target.value}))}
                      placeholder={f.ph} style={{ resize:'vertical', minHeight:52 }} />
                  </div>
                ))}
                <button type="submit" className="btn btn-primary"
                  style={{ fontSize:12, padding:'7px 16px' }} disabled={savingInfo}>
                  {savingInfo ? 'Menyimpan...' : '💾 Simpan'}
                </button>
              </form>
            ) : (
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { label:'💪 Sumber semangat', val:infoForm.semangat_kerja || member.semangat },
                  { label:'⚡ Penguras energi',  val:infoForm.penguras_energi || member.energi  },
                  { label:'🎯 Target 1 tahun',   val:infoForm.target_1_tahun || member.target   },
                  { label:'🏠 Username',          val:user?.username },
                ].filter(x => x.val).map(x => (
                  <div key={x.label}>
                    <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)',
                      textTransform:'uppercase', letterSpacing:'.06em', marginBottom:3 }}>{x.label}</div>
                    <div style={{ fontSize:12 }}>{x.val}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Ganti password ── */}
      <div className="card">
        <div className="card-title">🔐 Ganti Password</div>

        {msg && (
          <div className={`alert ${msg.type === 'ok' ? 'alert-green' : 'alert-red'}`}
            style={{ marginBottom: 16 }}>
            <span>{msg.type === 'ok' ? '✅' : '⚠️'}</span>
            <div>{msg.text}</div>
          </div>
        )}

        <form onSubmit={handleGantiPass}>
          {[
            { key: 'password_lama', label: 'Password lama *',        show: showPass.lama, toggle: () => setShow(s=>({...s,lama:!s.lama})) },
            { key: 'password_baru', label: 'Password baru *',         show: showPass.baru, toggle: () => setShow(s=>({...s,baru:!s.baru})) },
            { key: 'konfirmasi',    label: 'Konfirmasi password baru *', show: showPass.kon,  toggle: () => setShow(s=>({...s,kon:!s.kon})) },
          ].map(f => (
            <div key={f.key} style={{ marginBottom: 14 }}>
              <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)',
                textTransform: 'uppercase', letterSpacing: '.06em', display: 'block', marginBottom: 6 }}>
                {f.label}
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={f.show ? 'text' : 'password'}
                  value={form[f.key]} required
                  onChange={e => set(f.key, e.target.value)}
                  placeholder="••••••••"
                  style={{ paddingRight: 40, letterSpacing: f.show ? 0 : '0.1em' }}
                />
                <button type="button" onClick={f.toggle}
                  style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-3)', fontSize: 14, padding: 4 }}>
                  {f.show ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          ))}

          <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 16 }}>
            Password minimal 6 karakter. Setelah diubah kamu akan diminta login ulang.
          </div>

          <button type="submit" className="btn btn-primary"
            style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
            disabled={loading}>
            {loading ? 'Menyimpan...' : '🔐 Ubah Password'}
          </button>
        </form>
      </div>

      {/* Riwayat Profiling */}
      {profilingList.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title" style={{ cursor:'pointer' }}
            onClick={() => setShowRiwayat(v => !v)}>
            <span>📋 Riwayat Profiling ({profilingList.length} pengisian)</span>
            <span style={{ fontSize:11, color:'var(--text-3)' }}>{showRiwayat ? '▲' : '▼'}</span>
          </div>
          {showRiwayat && profilingList.map((p, i) => (
            <div key={i} style={{ padding:'10px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase',
                letterSpacing:'.05em', marginBottom:6 }}>
                Pengisian #{i + 1} — {new Date(p.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'long',year:'numeric'})}
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                {[
                  { label:'Level karier',    val:p.level_karier },
                  { label:'Domisili',        val:p.domisili },
                  { label:'Sumber semangat', val:p.semangat_kerja },
                  { label:'Penguras energi', val:p.penguras_energi },
                  { label:'Target 1 tahun',  val:p.target_1_tahun },
                  { label:'Kepuasan diri',   val:p.kepuasan_diri ? `${p.kepuasan_diri}/10` : null },
                ].filter(x => x.val).map(x => (
                  <div key={x.label}>
                    <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em', marginBottom:2 }}>{x.label}</div>
                    <div style={{ fontSize:11 }}>{x.val}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Logout */}
      <div style={{ marginTop: 16, textAlign: 'center' }}>
        <button onClick={() => { logout(); navigate('/login'); }}
          style={{ background: 'none', border: 'none', cursor: 'pointer',
            fontSize: 12, color: 'var(--text-3)', padding: '8px 16px',
            borderRadius: 8, transition: 'color .15s' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--red)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--text-3)'}>
          ⏻ Keluar dari akun
        </button>
      </div>
    </div>
  );
}
