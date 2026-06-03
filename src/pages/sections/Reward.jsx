import { useState, useEffect, useCallback } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { REWARD_LIST, TIM, TIPE_COLOR } from '../../data/tim';
import { STUDIO_CONFIG, REWARD_PERSONAL } from '../../data/constants';
import { useAuth } from '../../hooks/useAuth';
import { api } from '../../services/api';

const ADMIN_COLORS = ['#00D68F','#9B8FFF','#FFB84B'];  // warna per admin

// ── REWARD ─────────────────────────────────────────────────────────────────
export function Reward() {
  const { user: _u } = useAuth();
  const isAdmin   = _u?.role === 'admin';
  const now       = new Date();
  const [bulan, setBulan] = useState(now.getMonth() + 1);
  const [tahun, setTahun] = useState(now.getFullYear());
  const [revData,    setRevData]    = useState([]);
  const [revHistory, setRevHistory] = useState([]);
  const [rewardList, setRewardList] = useState([]);
  const [editRev,    setEditRev]    = useState({});
  const [saving,     setSaving]     = useState({});
  const [showRewardForm, setShowRewardForm] = useState(false);
  const [rewardForm, setRewardForm] = useState({ tanggal: now.toISOString().slice(0,10), nama:'', kategori:'', trigger:'', bentuk:'', nominal:'', catatan:'' });
  const [savingReward, setSavingReward] = useState(false);

  const ADMIN_LIST = TIM.filter(t => t.divisi === 'Admin');
  const TARGET_PER_ADMIN = STUDIO_CONFIG.targetRevenuePerAdmin;

  const loadRevenue = useCallback(() => {
    api.getRevenue(bulan, tahun).then(res => setRevData(res.data || [])).catch(() => {});
  }, [bulan, tahun]);

  const loadRewards = useCallback(() => {
    api.getReward().then(res => setRewardList(res.data || [])).catch(() => {});
  }, []);

  useEffect(() => { loadRevenue(); }, [loadRevenue]);
  useEffect(() => {
    api.getRevenueHistory().then(res => setRevHistory(res.data || [])).catch(() => {});
  }, []);
  useEffect(() => { loadRewards(); }, [loadRewards]);

  const handleSaveReward = async (e) => {
    e.preventDefault();
    setSavingReward(true);
    try {
      await api.simpanReward(rewardForm);
      setShowRewardForm(false);
      setRewardForm({ tanggal: new Date().toISOString().slice(0,10), nama:'', kategori:'', trigger:'', bentuk:'', nominal:'', catatan:'' });
      loadRewards();
    } catch {}
    finally { setSavingReward(false); }
  };

  const getJumlah = (nama) => {
    const row = revData.find(r => r.nama === nama);
    return row ? parseFloat(row.jumlah) : 0;
  };

  const handleSaveRev = async (nama) => {
    const jumlah = parseFloat(editRev[nama] ?? getJumlah(nama)) || 0;
    setSaving(s => ({ ...s, [nama]: true }));
    try {
      await api.saveRevenue({ bulan, tahun, nama, jumlah, target: TARGET_PER_ADMIN });
      loadRevenue();
      setEditRev(e => { const n = { ...e }; delete n[nama]; return n; });
    } catch {}
    finally { setSaving(s => { const n = { ...s }; delete n[nama]; return n; }); }
  };

  const totalRev    = ADMIN_LIST.reduce((s, a) => s + getJumlah(a.nama), 0);
  const totalTarget = ADMIN_LIST.length * TARGET_PER_ADMIN;
  const pctTotal    = totalTarget > 0 ? Math.round(totalRev / totalTarget * 100) : 0;

  const BULAN_NAMES = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agt','Sep','Okt','Nov','Des'];

  return (
    <div>
      {/* Metrics */}
      <div className="metrics-grid" style={{ marginBottom: 16 }}>
        <div className="metric">
          <div className="metric-val text-green">${totalRev.toLocaleString()}</div>
          <div className="metric-lbl">Revenue bulan ini</div>
        </div>
        <div className="metric">
          <div className="metric-val" style={{ color: pctTotal >= 100 ? 'var(--green)' : 'var(--amber)' }}>{pctTotal}%</div>
          <div className="metric-lbl">Dari target</div>
        </div>
        <div className="metric">
          <div className="metric-val">${totalTarget.toLocaleString()}</div>
          <div className="metric-lbl">Target total</div>
        </div>
        <div className="metric">
          <div className="metric-val">{STUDIO_CONFIG.seedFund}</div>
          <div className="metric-lbl">Seed fund</div>
        </div>
      </div>

      {/* Revenue tracker per admin */}
      <div className="card" style={{ marginBottom: 16 }}>
        {/* Header bulan/tahun picker */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div className="card-title" style={{ flex: 1, margin: 0 }}>Revenue Admin</div>
          <select value={bulan} onChange={e => setBulan(+e.target.value)}
            style={{ width: 'auto', padding: '4px 8px', fontSize: 12 }}>
            {BULAN_NAMES.map((b, i) => <option key={i} value={i+1}>{b}</option>)}
          </select>
          <input type="number" value={tahun} onChange={e => setTahun(+e.target.value)}
            style={{ width: 72, padding: '4px 8px', fontSize: 12 }} min={2024} max={2030} />
        </div>

        {/* Progress bar total */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11,
            color: 'var(--text-2)', marginBottom: 5 }}>
            <span>Total: ${totalRev.toLocaleString()}</span>
            <span style={{ fontWeight: 700, color: pctTotal>=100?'var(--green)':'var(--amber)' }}>
              {pctTotal}% dari ${totalTarget.toLocaleString()}
            </span>
          </div>
          <div style={{ height: 8, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${Math.min(100, pctTotal)}%`,
              background: pctTotal >= 100 ? 'var(--green)' : 'var(--amber)',
              borderRadius: 99, transition: 'width .5s',
              boxShadow: pctTotal >= 100 ? '0 0 8px var(--green)' : 'none' }} />
          </div>
        </div>

        {/* Per admin row */}
        {ADMIN_LIST.map(a => {
          const jumlah = editRev[a.nama] !== undefined ? editRev[a.nama] : getJumlah(a.nama);
          const pct    = Math.min(100, Math.round(jumlah / TARGET_PER_ADMIN * 100));
          const color  = pct >= 100 ? 'var(--green)' : pct >= 50 ? 'var(--amber)' : 'var(--red)';
          const tc     = TIPE_COLOR[a.tipe] || {};
          return (
            <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
              <div className="avatar" style={{ width: 30, height: 30, background: tc.bg, color: tc.text,
                fontSize: 11, flexShrink: 0 }}>
                {a.nama.split(' ').slice(0,2).map(w=>w[0]).join('')}
              </div>
              <div style={{ width: 60, flexShrink: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 600 }}>{a.nama.split(' ')[0]}</div>
                <div style={{ fontSize: 9, color: 'var(--text-3)' }}>{a.divisi}</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ height: 6, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${pct}%`, background: color,
                    borderRadius: 99, transition: 'width .4s' }} />
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                <span style={{ fontSize: 10, color, fontWeight: 700, width: 36, textAlign: 'right' }}>
                  {pct}%
                </span>
                <div style={{ position: 'relative' }}>
                  <span style={{ position: 'absolute', left: 8, top: '50%', transform: 'translateY(-50%)',
                    fontSize: 11, color: 'var(--text-3)', pointerEvents: 'none' }}>$</span>
                  <input type="number" value={jumlah} min={0}
                    onChange={e => setEditRev(v => ({ ...v, [a.nama]: e.target.value }))}
                    onBlur={() => handleSaveRev(a.nama)}
                    onKeyDown={e => e.key === 'Enter' && handleSaveRev(a.nama)}
                    style={{ width: 80, padding: '4px 6px 4px 18px', fontSize: 11,
                      borderColor: editRev[a.nama] !== undefined ? 'var(--green)' : 'var(--border-2)' }} />
                </div>
                {saving[a.nama] && <span style={{ fontSize: 10, color: 'var(--text-3)' }}>...</span>}
              </div>
            </div>
          );
        })}
        <div style={{ fontSize: 10, color: 'var(--text-3)', marginTop: 4 }}>
          Klik field angka → ubah → tekan Enter atau klik di luar untuk simpan.
        </div>
      </div>

      {/* Tren Revenue 6 Bulan */}
      {revHistory.length > 0 && (() => {
        // Bangun data chart: satu row per bulan, kolom per admin
        const bulanSet = [...new Set(revHistory.map(r => `${r.tahun}-${String(r.bulan).padStart(2,'0')}`))].sort();
        const chartData = bulanSet.map(bk => {
          const [y, m] = bk.split('-');
          const row = { bulan: BULAN_NAMES[parseInt(m)-1] + ' ' + y };
          ADMIN_LIST.forEach(a => {
            const found = revHistory.find(r => r.nama === a.nama && String(r.tahun) === y && Number(r.bulan) === parseInt(m));
            row[a.nama.split(' ')[0]] = found ? parseFloat(found.jumlah) : 0;
          });
          return row;
        });
        return (
          <div className="card" style={{ marginBottom:16 }}>
            <div className="card-title">📈 Tren Revenue 6 Bulan Terakhir</div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={chartData} margin={{ top:5, right:10, left:0, bottom:5 }}>
                <XAxis dataKey="bulan" tick={{ fontSize:10, fill:'var(--text-3)' }} />
                <YAxis tick={{ fontSize:10, fill:'var(--text-3)' }} tickFormatter={v => `$${v}`} />
                <Tooltip
                  contentStyle={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:8, fontSize:11 }}
                  formatter={(v, name) => [`$${v.toLocaleString()}`, name]}
                />
                <Legend iconSize={10} wrapperStyle={{ fontSize:11 }} />
                <ReferenceLine y={TARGET_PER_ADMIN} stroke="var(--border-2)" strokeDasharray="4 4"
                  label={{ value:`Target $${TARGET_PER_ADMIN}`, fill:'var(--text-3)', fontSize:9, position:'insideTopRight' }} />
                {ADMIN_LIST.map((a, i) => (
                  <Line key={a.id} type="monotone" dataKey={a.nama.split(' ')[0]}
                    stroke={ADMIN_COLORS[i % ADMIN_COLORS.length]}
                    strokeWidth={2} dot={{ r:3 }} activeDot={{ r:5 }} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        );
      })()}

      {/* Reward triggers */}
      <div className="grid-2">
        <div className="card">
          <div className="card-title">Trigger reward — semua kategori</div>
          {REWARD_LIST.map((r, i) => (
            <div key={i} className="reward-row">
              <span className="reward-ico">{r.ico}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 500 }}>{r.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{r.trigger}</div>
              </div>
              <span className="reward-val">{r.nilai}</span>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="card-title">Reward personal per anggota</div>
          {REWARD_PERSONAL.map(r => (
            <div key={r.username} className="member-row">
              <div className="avatar" style={{ width:24,height:24,background:'var(--green-light)',color:'var(--green)',fontSize:10 }}>{r.nama[0]}</div>
              <div style={{ flex:1 }}>
                <span style={{ fontWeight:500, fontSize:12 }}>{r.nama}</span>
                <div style={{ fontSize:11, color:'var(--text-2)' }}>{r.reward}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Reward Tracking — admin only */}
      {isAdmin && (
        <div className="card" style={{ marginTop:16 }}>
          <div className="card-title">
            <span>Riwayat Reward Diberikan</span>
            <button className="btn btn-primary btn-sm" onClick={() => setShowRewardForm(v=>!v)}>
              {showRewardForm ? 'Tutup' : '+ Catat Reward'}
            </button>
          </div>

          {showRewardForm && (
            <form onSubmit={handleSaveReward} style={{ marginBottom:16, padding:'12px 14px',
              background:'var(--surface-2)', borderRadius:10, border:'1px solid var(--border)' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10, marginBottom:10 }}>
                <div>
                  <label style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:4 }}>Tanggal *</label>
                  <input type="date" value={rewardForm.tanggal} required onChange={e=>setRewardForm(f=>({...f,tanggal:e.target.value}))} />
                </div>
                <div>
                  <label style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:4 }}>Penerima *</label>
                  <select value={rewardForm.nama} required onChange={e=>setRewardForm(f=>({...f,nama:e.target.value}))}>
                    <option value="">— Pilih anggota —</option>
                    {TIM.map(t=><option key={t.id} value={t.nama}>{t.nama}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:4 }}>Kategori *</label>
                  <select value={rewardForm.kategori} required onChange={e=>setRewardForm(f=>({...f,kategori:e.target.value}))}>
                    <option value="">— Pilih —</option>
                    {['Naik level','Revenue bonus','Kualitas project','Gathering','Budget kursus','Mentor kaderisasi','Apresiasi khusus'].map(k=><option key={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:4 }}>Nominal (Rp)</label>
                  <input type="number" value={rewardForm.nominal} min={0}
                    onChange={e=>setRewardForm(f=>({...f,nominal:e.target.value}))} placeholder="0" />
                </div>
              </div>
              <div style={{ marginBottom:10 }}>
                <label style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:4 }}>Bentuk reward</label>
                <input value={rewardForm.bentuk} onChange={e=>setRewardForm(f=>({...f,bentuk:e.target.value}))} placeholder="Uang tunai / budget kursus / apresiasi publik / dll" />
              </div>
              <div style={{ marginBottom:12 }}>
                <label style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'.05em', display:'block', marginBottom:4 }}>Catatan</label>
                <textarea rows={2} value={rewardForm.catatan} onChange={e=>setRewardForm(f=>({...f,catatan:e.target.value}))}
                  placeholder="Alasan pemberian reward..." style={{ resize:'vertical' }} />
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <button type="submit" className="btn btn-primary" disabled={savingReward} style={{ fontSize:12 }}>
                  {savingReward ? 'Menyimpan...' : '🏆 Simpan Reward'}
                </button>
                <button type="button" className="btn" style={{ fontSize:12 }} onClick={()=>setShowRewardForm(false)}>Batal</button>
              </div>
            </form>
          )}

          {rewardList.length === 0 ? (
            <div style={{ textAlign:'center', padding:'20px 0', fontSize:12, color:'var(--text-3)' }}>
              Belum ada reward yang dicatat.
            </div>
          ) : rewardList.slice(0,10).map(r => {
            const member = TIM.find(t => t.nama === r.nama);
            const tc = member ? (TIPE_COLOR[member.tipe]||{}) : {};
            return (
              <div key={r.id} className="member-row" style={{ alignItems:'flex-start', padding:'8px 0' }}>
                <div className="avatar" style={{ width:28,height:28,background:tc.bg||'var(--green-light)',color:tc.text||'var(--green)',fontSize:10 }}>
                  {r.nama?.split(' ').slice(0,2).map(w=>w[0]).join('')}
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, fontWeight:600 }}>{r.nama}</div>
                  <div style={{ fontSize:11, color:'var(--text-2)' }}>{r.kategori}{r.bentuk ? ` — ${r.bentuk}` : ''}</div>
                  {r.catatan && <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>{r.catatan}</div>}
                </div>
                <div style={{ textAlign:'right', flexShrink:0 }}>
                  {r.nominal > 0 && <div style={{ fontSize:12, fontWeight:700, color:'var(--green)' }}>Rp {parseInt(r.nominal).toLocaleString()}</div>}
                  <div style={{ fontSize:10, color:'var(--text-3)' }}>
                    {new Date(r.tanggal||r.created_at).toLocaleDateString('id-ID',{day:'numeric',month:'short',year:'numeric'})}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

