import { useState, useEffect, useCallback } from 'react';
import { TIM, TIPE_COLOR, DIVISI_COLOR } from '../data/tim';
import { useAuth } from '../hooks/useAuth';
import { api } from '../services/api';


// Card statistik per anggota
function StatCard({ stat }) {
  const member = TIM.find(t => t.nama === stat.nama);
  const tc     = member ? (TIPE_COLOR[member.tipe] || {}) : {};
  const dc     = member ? (DIVISI_COLOR[member.divisi] || {}) : {};
  const inits  = stat.nama.split(' ').slice(0,2).map(w=>w[0]).join('');
  const lastDate = stat.terakhir_lapor
    ? new Date(stat.terakhir_lapor).toLocaleDateString('id-ID',{day:'numeric',month:'short'})
    : '—';

  return (
    <div className="card" style={{ display:'flex', alignItems:'center', gap:12 }}>
      <div style={{
        width:40, height:40, borderRadius:10, flexShrink:0,
        background: tc.bg||'var(--surface-2)', color: tc.text||'var(--text-2)',
        display:'flex', alignItems:'center', justifyContent:'center',
        fontSize:13, fontWeight:700,
      }}>{inits}</div>
      <div style={{ flex:1 }}>
        <div style={{ fontWeight:700, fontSize:13 }}>{stat.nama}</div>
        <div style={{ fontSize:10, color: dc.text||'var(--text-3)' }}>{dc.icon} {member?.divisi}</div>
      </div>
      <div style={{ textAlign:'right' }}>
        <div style={{ fontSize:18, fontWeight:800, color:'var(--green)', lineHeight:1 }}>
          {stat.total_order}
        </div>
        <div style={{ fontSize:9, color:'var(--text-3)' }}>total order</div>
      </div>
      <div style={{ textAlign:'right', minWidth:50 }}>
        <div style={{ fontSize:14, fontWeight:700 }}>{stat.total_hari}</div>
        <div style={{ fontSize:9, color:'var(--text-3)' }}>laporan</div>
      </div>
      <div style={{ textAlign:'right', minWidth:60 }}>
        <div style={{ fontSize:11, color:'var(--text-2)', fontWeight:600 }}>{lastDate}</div>
        <div style={{ fontSize:9, color:'var(--text-3)' }}>terakhir</div>
      </div>
    </div>
  );
}

// Card satu entri laporan harian
function LaporanCard({ l, expanded, onToggle }) {
  const member = TIM.find(t => t.nama === l.nama);
  const tc     = member ? (TIPE_COLOR[member.tipe]||{}) : {};
  const tgl    = new Date(l.tanggal);
  const inits  = l.nama.split(' ').slice(0,2).map(w=>w[0]).join('');

  const detailOrder = typeof l.detail_order === 'string'
    ? JSON.parse(l.detail_order || '{}')
    : (l.detail_order || {});

  return (
    <div className="card" style={{ marginBottom:8 }}>
      {/* Header baris */}
      <div style={{ display:'flex', alignItems:'center', gap:10, cursor:'pointer' }}
        onClick={onToggle}>
        {/* Avatar */}
        <div style={{
          width:36, height:36, borderRadius:9, flexShrink:0,
          background: tc.bg||'var(--surface-2)', color: tc.text||'var(--text-2)',
          display:'flex', alignItems:'center', justifyContent:'center',
          fontSize:12, fontWeight:700,
        }}>{inits}</div>

        {/* Info dasar */}
        <div style={{ flex:1 }}>
          <div style={{ fontWeight:700, fontSize:13 }}>{l.nama}</div>
          <div style={{ fontSize:10, color:'var(--text-3)', marginTop:1 }}>
            {l.akun && <span style={{ marginRight:8 }}>🏢 {l.akun}</span>}
            {l.jam_mulai && <span>⏰ {l.jam_mulai}–{l.jam_selesai}</span>}
          </div>
        </div>

        {/* Tanggal */}
        <div style={{ textAlign:'center', flexShrink:0 }}>
          <div style={{ fontSize:18, fontWeight:800, lineHeight:1 }}>{tgl.getDate()}</div>
          <div style={{ fontSize:9, color:'var(--text-3)', textTransform:'uppercase' }}>
            {tgl.toLocaleDateString('id-ID',{month:'short'})}
          </div>
        </div>

        {/* Metrik singkat */}
        {l.active_order > 0 && (
          <div style={{
            background:'var(--green-light)', color:'var(--green)',
            padding:'3px 10px', borderRadius:99, fontSize:11, fontWeight:700, flexShrink:0,
          }}>
            {l.active_order} order
          </div>
        )}
        {l.impresi && (
          <div style={{ fontSize:10, color:'var(--text-3)', flexShrink:0 }}>
            👁 {l.impresi}
          </div>
        )}

        <span style={{ fontSize:11, color:'var(--text-3)', flexShrink:0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {/* Detail expand */}
      {expanded && (
        <div style={{ marginTop:12, paddingTop:12, borderTop:'1px solid var(--border)' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>

            {/* Aktivitas */}
            {l.aktivitas && (
              <div style={{ gridColumn:'1/-1' }}>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--text-3)',
                  textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>Aktivitas</div>
                <div style={{ fontSize:12, color:'var(--text)' }}>{l.aktivitas}</div>
              </div>
            )}

            {/* Yang didapat */}
            {l.yang_didapat && (
              <div>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--green)',
                  textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>Yang Didapat</div>
                <div style={{ fontSize:12, whiteSpace:'pre-wrap' }}>{l.yang_didapat}</div>
              </div>
            )}

            {/* Capaian */}
            {(l.impresi || l.click || l.cr) && (
              <div>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--blue)',
                  textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Capaian</div>
                {[
                  {label:'Impresi', val:l.impresi},
                  {label:'Click',   val:l.click},
                  {label:'CR',      val:l.cr},
                ].filter(x=>x.val).map(x=>(
                  <div key={x.label} style={{ display:'flex', justifyContent:'space-between',
                    fontSize:12, marginBottom:3 }}>
                    <span style={{ color:'var(--text-2)' }}>{x.label}</span>
                    <span style={{ fontWeight:700 }}>{x.val}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Chat masuk */}
            {l.chat_masuk && (
              <div>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--purple)',
                  textTransform:'uppercase', letterSpacing:'.06em', marginBottom:4 }}>Chat Masuk</div>
                <div style={{ fontSize:12, whiteSpace:'pre-wrap', color:'var(--text-2)' }}>
                  {l.chat_masuk}
                </div>
              </div>
            )}

            {/* Order */}
            {(l.order_masuk || l.complete_order || l.active_order > 0) && (
              <div>
                <div style={{ fontSize:9, fontWeight:700, color:'var(--amber)',
                  textTransform:'uppercase', letterSpacing:'.06em', marginBottom:6 }}>Order</div>
                {l.active_order > 0 && (
                  <div style={{ fontSize:13, fontWeight:800, color:'var(--green)', marginBottom:4 }}>
                    Active: {l.active_order}
                  </div>
                )}
                {Object.entries(detailOrder).map(([k,v]) => (
                  <div key={k} style={{ display:'flex', justifyContent:'space-between',
                    fontSize:11, marginBottom:2 }}>
                    <span style={{ textTransform:'capitalize', color:'var(--text-2)' }}>{k}</span>
                    <span style={{ fontWeight:700 }}>{v}</span>
                  </div>
                ))}
                {l.complete_order && (
                  <div style={{ marginTop:4, fontSize:11, color:'var(--text-3)' }}>
                    Complete: {l.complete_order}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────────
export default function LaporanHarian() {
  const { user }    = useAuth();
  const isAdmin     = user?.role === 'admin';
  const [laporan,   setLaporan]   = useState([]);
  const [stats,     setStats]     = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [expanded,  setExpanded]  = useState(null);
  const [filterNama,setFilterNama]= useState('');
  const [view,      setView]      = useState('today'); // 'today' | 'week' | 'all'

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const now   = new Date();
      const today = now.toISOString().slice(0,10);
      const weekStart = new Date(now); weekStart.setDate(now.getDate()-6);
      const dari = view === 'today' ? today
                 : view === 'week'  ? weekStart.toISOString().slice(0,10)
                 : undefined;

      let q = dari ? `?dari=${dari}&sampai=${today}` : '';
      if (!isAdmin) q = `?dari=${dari||''}&sampai=${today}`;

      const [lRes, sRes] = await Promise.all([
        api.getLaporanHarian(q),
        isAdmin ? api.getLaporanHarianStats(dari ? `?dari=${dari}&sampai=${today}` : '') : Promise.resolve({ data:[] }),
      ]);
      setLaporan(lRes.data || []);
      setStats(sRes.data || []);
    } catch {}
    finally { setLoading(false); }
  }, [view, isAdmin]);

  useEffect(() => { load(); }, [load]);

  const filtered = filterNama
    ? laporan.filter(l => l.nama.toLowerCase().includes(filterNama.toLowerCase()))
    : laporan;

  const botUsername = 'Creanimasihub_bot';

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:800 }}>📋 Laporan Harian Tim</div>
          <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2 }}>
            Laporan harian dari Telegram Bot @{botUsername}
          </div>
        </div>
        {/* Info bot */}
        <div style={{
          padding:'8px 14px', borderRadius:10, fontSize:11,
          background:'var(--surface-2)', border:'1px solid var(--border)',
          display:'flex', alignItems:'center', gap:8,
        }}>
          <span style={{ fontSize:16 }}>🤖</span>
          <div>
            <div style={{ fontWeight:700 }}>@{botUsername}</div>
            <div style={{ color:'var(--text-3)', fontSize:10 }}>Kirim laporan harian ke bot ini</div>
          </div>
          <a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer"
            className="btn btn-sm btn-primary" style={{ fontSize:10, padding:'4px 10px' }}>
            Buka ↗
          </a>
        </div>
      </div>

      {/* Stats anggota (admin) */}
      {isAdmin && stats.length > 0 && (
        <div style={{ marginBottom:16 }}>
          <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)',
            textTransform:'uppercase', letterSpacing:'.06em', marginBottom:8 }}>
            Ringkasan Performa
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:8 }}>
            {stats.map(s => <StatCard key={s.nama} stat={s} />)}
          </div>
        </div>
      )}

      {/* Filter + toggle view */}
      <div style={{ display:'flex', gap:8, marginBottom:12, flexWrap:'wrap' }}>
        {['today','week','all'].map(v => (
          <button key={v} onClick={() => setView(v)}
            style={{
              padding:'5px 14px', borderRadius:8, fontSize:12, cursor:'pointer',
              border:`1px solid ${view===v ? 'var(--green)' : 'var(--border-2)'}`,
              background: view===v ? 'var(--green-light)' : 'var(--surface)',
              color: view===v ? 'var(--green)' : 'var(--text-2)',
              fontWeight: view===v ? 700 : 400,
            }}>
            {v==='today' ? 'Hari ini' : v==='week' ? '7 hari' : 'Semua'}
          </button>
        ))}
        {isAdmin && (
          <input value={filterNama} onChange={e=>setFilterNama(e.target.value)}
            placeholder="🔍 Cari nama..."
            style={{ fontSize:12, padding:'5px 10px', flex:1, maxWidth:200 }} />
        )}
        <button onClick={load} className="btn btn-sm" style={{ fontSize:11 }}>↻ Refresh</button>
      </div>

      {/* Laporan list */}
      {loading ? (
        <div style={{ textAlign:'center', padding:40, color:'var(--text-2)' }}>Memuat...</div>
      ) : filtered.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📋</div>
          <div className="empty-title">
            {view==='today' ? 'Belum ada laporan hari ini' : 'Belum ada laporan'}
          </div>
          <div className="empty-sub">
            Anggota tim kirim laporan harian ke <strong>@{botUsername}</strong> di Telegram
          </div>
          <a href={`https://t.me/${botUsername}`} target="_blank" rel="noreferrer"
            className="btn btn-primary" style={{ marginTop:12, display:'inline-block' }}>
            Buka @{botUsername} ↗
          </a>
        </div>
      ) : (
        <>
          <div style={{ fontSize:11, color:'var(--text-3)', marginBottom:8 }}>
            {filtered.length} laporan
          </div>
          {filtered.map(l => (
            <LaporanCard
              key={l.id}
              l={l}
              expanded={expanded === l.id}
              onToggle={() => setExpanded(expanded === l.id ? null : l.id)}
            />
          ))}
        </>
      )}
    </div>
  );
}
