import { useState, useEffect, useCallback } from 'react';
import { WORKSHOP_JRUHUB, TIM, TIPE_COLOR, DIVISI_COLOR } from '../../data/tim';
import { api } from '../../services/api';
import { useAuth } from '../../hooks/useAuth';
import { downloadCsv } from '../../utils/exportCsv';

// ── WORKSHOP ───────────────────────────────────────────────────────────────
export function Workshop() {
  const { user }    = useAuth();
  const isAdmin     = user?.role === 'admin';
  const [kehadiran, setKehadiran] = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [saving,    setSaving]    = useState({});
  const [expanded,  setExpanded]  = useState(null);

  const load = useCallback(async () => {
    try {
      const res = await api.getWorkshop();
      setKehadiran(res.data);
    } catch { /* fallback kosong */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (nama, layerId, sesiIdx, curr) => {
    const key = `${nama}|${layerId}|${sesiIdx}`;
    setSaving(s => ({ ...s, [key]: true }));
    const next = !curr;
    setKehadiran(prev => {
      const exists = prev.find(r => r.nama === nama && r.layer_id === layerId && r.sesi_idx === sesiIdx);
      if (exists) return prev.map(r => r.nama === nama && r.layer_id === layerId && r.sesi_idx === sesiIdx ? { ...r, hadir: next } : r);
      return [...prev, { nama, layer_id: layerId, sesi_idx: sesiIdx, hadir: next }];
    });
    try { await api.updateWorkshop(nama, layerId, sesiIdx, next); }
    catch { load(); }
    finally { setSaving(s => { const n = { ...s }; delete n[key]; return n; }); }
  };

  const isHadir = (nama, layerId, sesiIdx) =>
    !!(kehadiran.find(r => r.nama === nama && r.layer_id === layerId && r.sesi_idx === sesiIdx)?.hadir);

  // Statistik keseluruhan
  const totalSesi  = WORKSHOP_JRUHUB.reduce((s, w) => s + w.items.length, 0); // 19
  const totalSlot  = TIM.length * totalSesi;
  const totalHadir = kehadiran.filter(r => r.hadir).length;
  const grandPct   = totalSlot > 0 ? Math.round(totalHadir / totalSlot * 100) : 0;

  const anggota = isAdmin ? TIM : TIM.filter(t => t.nama === user?.nama);

  if (loading) return (
    <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-2)' }}>Memuat data workshop...</div>
  );

  return (
    <div>
      {/* Header stats */}
      <div className="metrics-grid" style={{ marginBottom: 16 }}>
        <div className="metric"><div className="metric-val">{totalSesi}</div><div className="metric-lbl">Total sesi</div></div>
        <div className="metric"><div className="metric-val">{WORKSHOP_JRUHUB.length * 5}</div><div className="metric-lbl">Bulan program</div></div>
        <div className="metric">
          <div className="metric-val text-green">{totalHadir}</div>
          <div className="metric-lbl">Kehadiran tercatat</div>
        </div>
        <div className="metric">
          <div className="metric-val" style={{ color: 'var(--amber)' }}>{grandPct}%</div>
          <div className="metric-lbl">Rata-rata hadir</div>
        </div>
      </div>

      {/* Export */}
      <div style={{ textAlign:'right', marginBottom:12 }}>
        <button className="btn btn-sm" onClick={() => {
          const rows = [];
          TIM.forEach(t => WORKSHOP_JRUHUB.forEach(w => w.items.forEach((item, idx) => {
            const h = !!(kehadiran.find(r => r.nama===t.nama && r.layer_id===w.id && r.sesi_idx===idx)?.hadir);
            rows.push({ nama:t.nama, divisi:t.divisi, layer:w.label, sesi_no:idx+1, sesi_nama:item, hadir:h?'Ya':'Tidak' });
          })));
          downloadCsv('workshop_kehadiran.csv', rows, ['nama','divisi','layer','sesi_no','sesi_nama','hadir']);
        }} style={{ fontSize:11, padding:'4px 12px' }}>⬇ Export Kehadiran CSV</button>
      </div>

      {/* Per-layer cards */}
      {WORKSHOP_JRUHUB.map(w => {
        const isOpen    = expanded === w.id;
        // Hitung kehadiran layer ini
        const layerHadir = kehadiran.filter(r => r.layer_id === w.id && r.hadir).length;
        const layerSlot  = anggota.length * w.items.length;
        const layerPct   = layerSlot > 0 ? Math.round(layerHadir / layerSlot * 100) : 0;

        return (
          <div key={w.id} className="card" style={{ marginBottom: 10 }}>
            {/* Header layer */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }}
              onClick={() => setExpanded(isOpen ? null : w.id)}>
              <div style={{
                width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                background: w.bg, color: w.warna,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
              }}>🎓</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>{w.label}</div>
                <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                  {w.bulan} · {w.items.length} sesi
                </div>
              </div>
              <div style={{ width: 110, flexShrink: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10,
                  color: 'var(--text-3)', marginBottom: 3 }}>
                  <span>{layerHadir}/{layerSlot} slot</span>
                  <span style={{ color: w.warna, fontWeight: 700 }}>{layerPct}%</span>
                </div>
                <div style={{ height: 5, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${layerPct}%`, background: w.warna, borderRadius: 99, transition: 'width .4s' }} />
                </div>
              </div>
              <span style={{ fontSize: 12, color: 'var(--text-3)', flexShrink: 0 }}>{isOpen ? '▲' : '▼'}</span>
            </div>

            {/* Tabel kehadiran per anggota × sesi */}
            {isOpen && (
              <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--border)', overflowX: 'auto' }}>
                {/* Header kolom sesi */}
                <div style={{ display: 'flex', gap: 0, marginBottom: 8, marginLeft: 170 }}>
                  {w.items.map((item, idx) => (
                    <div key={idx} style={{
                      width: 36, flexShrink: 0, textAlign: 'center',
                      fontSize: 9, color: 'var(--text-3)', lineHeight: 1.3,
                      padding: '0 2px',
                    }} title={item}>
                      S{idx + 1}
                    </div>
                  ))}
                  <div style={{ width: 60, flexShrink: 0, fontSize: 9, color: 'var(--text-3)', textAlign: 'right', paddingRight: 4 }}>
                    Hadir
                  </div>
                </div>

                {/* Baris per anggota */}
                {anggota.map(tim => {
                  const tc    = TIPE_COLOR[tim.tipe] || {};
                  const dc    = DIVISI_COLOR[tim.divisi] || {};
                  const inits = tim.nama.split(' ').slice(0, 2).map(x => x[0]).join('');
                  const hadirCount = w.items.filter((_, idx) => isHadir(tim.nama, w.id, idx)).length;
                  const pctMember  = Math.round(hadirCount / w.items.length * 100);
                  const barColor   = pctMember >= 80 ? 'var(--green)' : pctMember >= 50 ? 'var(--amber)' : 'var(--red)';

                  return (
                    <div key={tim.id} style={{ display: 'flex', alignItems: 'center', gap: 0, marginBottom: 6 }}>
                      {/* Avatar + nama */}
                      <div style={{ width: 170, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 8, paddingRight: 8 }}>
                        <div style={{
                          width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                          background: tc.bg || 'var(--surface-2)',
                          color: tc.text || 'var(--text-2)',
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: 10, fontWeight: 700,
                        }}>{inits}</div>
                        <div>
                          <div style={{ fontSize: 11, fontWeight: 600, lineHeight: 1.2, whiteSpace: 'nowrap',
                            overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 120 }}>
                            {tim.nama.split(' ')[0]}
                          </div>
                          <div style={{ fontSize: 9, color: dc.text || 'var(--text-3)' }}>{dc.icon} {tim.divisi}</div>
                        </div>
                      </div>

                      {/* Checkbox per sesi */}
                      {w.items.map((_, sesiIdx) => {
                        const hadir  = isHadir(tim.nama, w.id, sesiIdx);
                        const key    = `${tim.nama}|${w.id}|${sesiIdx}`;
                        const isBusy = !!saving[key];
                        return (
                          <div key={sesiIdx} style={{ width: 36, flexShrink: 0, display: 'flex', justifyContent: 'center' }}>
                            <button
                              disabled={isBusy || !isAdmin}
                              onClick={() => toggle(tim.nama, w.id, sesiIdx, hadir)}
                              title={`${tim.nama} — ${w.items[sesiIdx]}: ${hadir ? 'hadir' : 'tidak hadir'}`}
                              style={{
                                width: 22, height: 22, borderRadius: 6, border: 'none',
                                background: hadir ? w.warna : 'var(--surface-2)',
                                color: hadir ? '#fff' : 'var(--text-3)',
                                cursor: isAdmin ? (isBusy ? 'wait' : 'pointer') : 'default',
                                fontSize: 11, fontWeight: 700, display: 'flex',
                                alignItems: 'center', justifyContent: 'center',
                                transition: 'background .15s, transform .1s',
                                transform: isBusy ? 'scale(.9)' : '',
                                boxShadow: hadir ? `0 0 6px ${w.warna}60` : 'none',
                              }}>
                              {hadir ? '✓' : '·'}
                            </button>
                          </div>
                        );
                      })}

                      {/* Counter hadir */}
                      <div style={{ width: 60, flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5, paddingLeft: 6 }}>
                        <div style={{ flex: 1, height: 4, background: 'var(--border)', borderRadius: 99, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pctMember}%`, background: barColor, borderRadius: 99 }} />
                        </div>
                        <span style={{ fontSize: 10, fontWeight: 700, color: barColor, flexShrink: 0 }}>
                          {hadirCount}/{w.items.length}
                        </span>
                      </div>
                    </div>
                  );
                })}

                {/* Legend sesi */}
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)',
                  display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {w.items.map((item, idx) => (
                    <span key={idx} style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: w.bg, color: w.warna }}>
                      S{idx+1} — {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

