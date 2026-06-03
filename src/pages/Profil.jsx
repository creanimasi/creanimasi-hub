import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { TIM, TIPE_COLOR, DIVISI_COLOR } from '../data/tim';
import { DIVISI_TO_PROFILING_ID } from '../data/constants';
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

  const divisiId  = DIVISI_TO_PROFILING_ID[member?.divisi] || 'admin';

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

      {/* Riwayat Profiling — dengan perbandingan antar pengisian */}
      {profilingList.length > 0 && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-title" style={{ cursor:'pointer' }}
            onClick={() => setShowRiwayat(v => !v)}>
            <div>
              <span>📋 Riwayat Profiling</span>
              <span style={{ fontSize:11, color:'var(--text-3)', marginLeft:6 }}>
                {profilingList.length} pengisian
              </span>
            </div>
            <span style={{ fontSize:11, color:'var(--text-3)' }}>{showRiwayat ? '▲' : '▼'}</span>
          </div>

          {showRiwayat && (
            <>
              {/* Skor kepuasan trend */}
              {profilingList.some(p => p.kepuasan_diri) && (
                <div style={{ marginBottom:14, paddingBottom:14, borderBottom:'1px solid var(--border)' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)',
                    textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
                    Tren Kepuasan Diri
                  </div>
                  <div style={{ display:'flex', gap:6, alignItems:'flex-end' }}>
                    {profilingList.filter(p => p.kepuasan_diri).map((p, i, arr) => {
                      const prev = arr[i - 1];
                      const val  = parseFloat(p.kepuasan_diri);
                      const delta = prev ? val - parseFloat(prev.kepuasan_diri) : null;
                      const color = val >= 7 ? 'var(--green)' : val >= 5 ? 'var(--amber)' : 'var(--red)';
                      return (
                        <div key={i} style={{ flex:1, textAlign:'center' }}>
                          <div style={{ fontSize:9, color:'var(--text-3)', marginBottom:4 }}>
                            {new Date(p.created_at).toLocaleDateString('id-ID',{month:'short',year:'2-digit'})}
                          </div>
                          <div style={{
                            height: `${val * 10}px`, minHeight: 20,
                            background: color, borderRadius: '4px 4px 0 0', opacity: 0.7,
                            transition: 'height .3s',
                          }} />
                          <div style={{ fontSize:12, fontWeight:700, color, marginTop:4 }}>{val}</div>
                          {delta !== null && (
                            <div style={{ fontSize:9, color: delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--text-3)' }}>
                              {delta > 0 ? `▲+${delta}` : delta < 0 ? `▼${delta}` : '='}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* List detail tiap pengisian */}
              {profilingList.map((p, i) => {
                const prev = profilingList[i - 1];
                return (
                  <div key={i} style={{ padding:'12px 0', borderTop: i > 0 ? '1px solid var(--border)' : 'none' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                      <div style={{
                        width:24, height:24, borderRadius:6, flexShrink:0,
                        background: i === profilingList.length - 1 ? 'var(--green-light)' : 'var(--surface-2)',
                        color: i === profilingList.length - 1 ? 'var(--green)' : 'var(--text-3)',
                        display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700,
                      }}>#{i + 1}</div>
                      <div style={{ fontSize:11, fontWeight:600 }}>
                        {new Date(p.created_at).toLocaleDateString('id-ID',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}
                      </div>
                      {i === profilingList.length - 1 && (
                        <span style={{ fontSize:9, background:'var(--green-light)', color:'var(--green)',
                          padding:'1px 7px', borderRadius:99, fontWeight:700 }}>Terbaru</span>
                      )}
                    </div>
                    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
                      {[
                        { label:'Level karier',    val:p.level_karier,    prev:prev?.level_karier },
                        { label:'Kepuasan diri',   val:p.kepuasan_diri != null ? `${p.kepuasan_diri}/10` : null, prev:prev?.kepuasan_diri != null ? `${prev.kepuasan_diri}/10` : null },
                        { label:'Sumber semangat', val:p.semangat_kerja,  prev:prev?.semangat_kerja },
                        { label:'Target 1 tahun',  val:p.target_1_tahun,  prev:prev?.target_1_tahun },
                      ].filter(x => x.val).map(x => (
                        <div key={x.label}>
                          <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)',
                            textTransform:'uppercase', letterSpacing:'.05em', marginBottom:2 }}>{x.label}</div>
                          <div style={{ fontSize:11 }}>{x.val}</div>
                          {x.prev && x.prev !== x.val && (
                            <div style={{ fontSize:9, color:'var(--text-3)', marginTop:2, fontStyle:'italic' }}>
                              sebelumnya: {x.prev}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </>
          )}
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
