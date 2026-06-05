import { useState, useEffect } from 'react';
import { api } from '../services/api';

const BULAN_NAMES = ['Januari','Februari','Maret','April','Mei','Juni','Juli','Agustus','September','Oktober','November','Desember'];
const HARI_SHORT  = ['Min','Sen','Sel','Rab','Kam','Jum','Sab'];

function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
function firstDay(y, m)    { return new Date(y, m, 1).getDay(); }

export default function Kalender() {
  const now    = new Date();
  const [tahun, setTahun]   = useState(now.getFullYear());
  const [bulan, setBulan]   = useState(now.getMonth());
  const [events, setEvents] = useState([]);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      const evs = [];
      try {
        const [fw, s1, skb] = await Promise.all([
          api.getFridayWin(),
          api.getSesi1on1(),
          api.getSKB(),
        ]);
        (fw.data||[]).forEach(w => evs.push({
          date: w.tanggal?.slice(0,10), type:'fw', icon:'🏆', color:'var(--amber)',
          label: w.headline, sub: w.penerima || 'Tim'
        }));
        (s1.data||[]).forEach(s => evs.push({
          date: s.tanggal, type:'1on1', icon:'💬', color:'var(--blue)',
          label:`1-on-1: ${s.anggota?.split(' ')[0]}`, sub:`${s.tipe} · ${s.durasi_menit}m`
        }));
        (skb.data||[]).filter(s => s.status==='disetujui').forEach(s => evs.push({
          date: s.created_at?.slice(0,10), type:'skb', icon:'📋', color:'var(--purple)',
          label:`SKB: ${s.judul?.slice(0,30)}`, sub: s.nama
        }));
      } catch {}

      // Tambah Jumat otomatis sebagai reminder jurnal
      const d = daysInMonth(tahun, bulan);
      for (let day = 1; day <= d; day++) {
        const dt = new Date(tahun, bulan, day);
        if (dt.getDay() === 5) {
          const dateStr = `${tahun}-${String(bulan+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
          evs.push({ date:dateStr, type:'jurnal', icon:'📓', color:'var(--green)',
            label:'Deadline Jurnal', sub:'Rutin tiap Jumat' });
        }
      }
      setEvents(evs);
    };
    fetchAll();
  }, [tahun, bulan]);

  const days = daysInMonth(tahun, bulan);
  const start = firstDay(tahun, bulan);
  const cells = [];
  for (let i = 0; i < start; i++) cells.push(null);
  for (let d = 1; d <= days; d++) cells.push(d);

  const getEvents = (day) => {
    if (!day) return [];
    const dateStr = `${tahun}-${String(bulan+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return events.filter(e => e.date === dateStr);
  };

  const todayStr = now.toISOString().slice(0,10);
  const isToday  = (day) =>
    `${tahun}-${String(bulan+1).padStart(2,'0')}-${String(day).padStart(2,'0')}` === todayStr;

  const selectedEvs = selected ? getEvents(selected) : [];

  return (
    <div>
      {/* Header navigasi bulan */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button className="btn" onClick={() => {
          if (bulan === 0) { setBulan(11); setTahun(y => y-1); }
          else setBulan(b => b-1);
        }}>←</button>
        <div style={{ flex:1, textAlign:'center' }}>
          <div style={{ fontSize:18, fontWeight:800 }}>{BULAN_NAMES[bulan]} {tahun}</div>
        </div>
        <button className="btn" onClick={() => {
          if (bulan === 11) { setBulan(0); setTahun(y => y+1); }
          else setBulan(b => b+1);
        }}>→</button>
        <button className="btn" onClick={() => { setBulan(now.getMonth()); setTahun(now.getFullYear()); }}>
          Hari ini
        </button>
      </div>

      <div className="grid-2" style={{ gap:16, alignItems:'start' }}>
        {/* Grid kalender */}
        <div className="card" style={{ padding:0, overflow:'hidden' }}>
          {/* Header hari */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)',
            borderBottom:'1px solid var(--border)' }}>
            {HARI_SHORT.map(h => (
              <div key={h} style={{ textAlign:'center', padding:'8px 0', fontSize:10,
                fontWeight:700, color:'var(--text-3)', textTransform:'uppercase' }}>{h}</div>
            ))}
          </div>
          {/* Cells */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
            {cells.map((day, i) => {
              const evs = getEvents(day);
              const today = day && isToday(day);
              const isSel = day && selected === day;
              return (
                <div key={i}
                  onClick={() => day && setSelected(isSel ? null : day)}
                  style={{
                    minHeight:72, padding:'6px 4px', fontSize:12,
                    borderRight: (i+1)%7===0 ? 'none' : '1px solid var(--border)',
                    borderBottom:'1px solid var(--border)',
                    background: isSel ? 'var(--green-light)' : today ? 'var(--surface-2)' : 'transparent',
                    cursor: day ? 'pointer' : 'default',
                    transition:'background .12s',
                  }}>
                  {day && (
                    <>
                      <div style={{
                        width:22, height:22, borderRadius:'50%', marginBottom:3,
                        display:'flex', alignItems:'center', justifyContent:'center',
                        background: today ? 'var(--green)' : 'transparent',
                        color: today ? '#000' : 'var(--text)',
                        fontSize:11, fontWeight: today ? 800 : 400,
                      }}>{day}</div>
                      {evs.slice(0,2).map((e, ei) => (
                        <div key={ei} style={{
                          fontSize:9, padding:'1px 4px', borderRadius:3, marginBottom:2,
                          background: `${e.color}25`, color: e.color,
                          overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
                          fontWeight:600,
                        }}>{e.icon} {e.label}</div>
                      ))}
                      {evs.length > 2 && (
                        <div style={{ fontSize:9, color:'var(--text-3)' }}>+{evs.length-2} lagi</div>
                      )}
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Panel detail */}
        <div>
          {/* Legend */}
          <div className="card" style={{ marginBottom:12 }}>
            <div className="card-title">Legenda</div>
            {[
              { icon:'📓', color:'var(--green)',  label:'Deadline Jurnal Mingguan' },
              { icon:'🏆', color:'var(--amber)',  label:'Friday Win' },
              { icon:'💬', color:'var(--blue)',   label:'Sesi 1-on-1' },
              { icon:'📋', color:'var(--purple)', label:'SKB Disetujui' },
            ].map(l => (
              <div key={l.label} style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 0',
                fontSize:12, borderBottom:'1px solid var(--border)' }}>
                <span>{l.icon}</span>
                <span style={{ color:l.color, width:8, height:8, borderRadius:'50%',
                  background:l.color, flexShrink:0 }} />
                <span>{l.label}</span>
              </div>
            ))}
          </div>

          {/* Detail tanggal terpilih */}
          {selected && (
            <div className="card">
              <div className="card-title">
                {selected} {BULAN_NAMES[bulan]} {tahun}
              </div>
              {selectedEvs.length === 0 ? (
                <div style={{ fontSize:12, color:'var(--text-3)', textAlign:'center', padding:'12px 0' }}>
                  Tidak ada kegiatan hari ini.
                </div>
              ) : selectedEvs.map((e, i) => (
                <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start',
                  padding:'8px 0', borderBottom: i < selectedEvs.length-1 ? '1px solid var(--border)' : 'none' }}>
                  <span style={{ fontSize:18 }}>{e.icon}</span>
                  <div>
                    <div style={{ fontSize:12, fontWeight:700, color:e.color }}>{e.label}</div>
                    <div style={{ fontSize:11, color:'var(--text-2)' }}>{e.sub}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Upcoming events */}
          <div className="card" style={{ marginTop:12 }}>
            <div className="card-title">Kegiatan mendatang</div>
            {events
              .filter(e => e.date >= todayStr)
              .sort((a,b) => a.date.localeCompare(b.date))
              .slice(0, 8)
              .map((e, i) => (
                <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start',
                  padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
                  <div style={{ flexShrink:0, textAlign:'center', width:36,
                    padding:'4px 0', borderRadius:8, background:`${e.color}18` }}>
                    <div style={{ fontSize:9, color:e.color, fontWeight:700 }}>
                      {new Date(e.date).toLocaleDateString('id-ID',{day:'numeric',month:'short'})}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize:11, fontWeight:600 }}>{e.icon} {e.label}</div>
                    <div style={{ fontSize:10, color:'var(--text-3)' }}>{e.sub}</div>
                  </div>
                </div>
              ))}
            {events.filter(e => e.date >= todayStr).length === 0 && (
              <div style={{ fontSize:12, color:'var(--text-3)', textAlign:'center', padding:'12px 0' }}>
                Tidak ada kegiatan mendatang.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
