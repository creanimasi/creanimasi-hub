import { useState } from 'react';
import { TIM, TIPE_COLOR, DIVISI_COLOR } from '../data/tim';

function Avatar({ nama, bg, color, size = 36 }) {
  const initials = nama.split(' ').slice(0, 2).map(w => w[0]).join('');
  return (
    <div className="avatar" style={{ width: size, height: size, background: bg, color, fontSize: size * 0.36 }}>
      {initials}
    </div>
  );
}

export default function Tim() {
  const [filter, setFilter] = useState('Semua');
  const [selected, setSelected] = useState(null);

  const divisis = ['Semua', 'Admin', 'PM', 'Rigger', 'Illustrator', '3D Modeler'];
  const filtered = filter === 'Semua' ? TIM : TIM.filter(t => t.divisi === filter);

  return (
    <div>
      <div className="tabs">
        {divisis.map(d => (
          <div key={d} className={`tab ${filter === d ? 'active' : ''}`} onClick={() => setFilter(d)}>
            {d} {d === 'Semua' ? `(${TIM.length})` : `(${TIM.filter(t => t.divisi === d).length})`}
          </div>
        ))}
      </div>

      <div className="grid-2">
        {filtered.map(m => {
          const tc = TIPE_COLOR[m.tipe];
          const dc = DIVISI_COLOR[m.divisi] || { bg: '#F3F4F6', text: '#374151', icon: '👤' };
          return (
            <div
              key={m.id}
              className="card"
              style={{ cursor: 'pointer', transition: 'box-shadow .15s',
                boxShadow: selected?.id === m.id ? '0 0 0 2px var(--green)' : 'none' }}
              onClick={() => setSelected(selected?.id === m.id ? null : m)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <Avatar nama={m.nama} bg={tc.bg} color={tc.text} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{m.nama}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)' }}>
                    <span style={{ background: dc.bg, color: dc.text, padding: '1px 6px', borderRadius: 10, fontSize: 10, fontWeight: 500 }}>
                      {dc.icon} {m.divisi}
                    </span>
                    <span style={{ marginLeft: 5 }}>{m.level}</span>
                  </div>
                </div>
                <span className={`tag tag-${tc.badge}`}>{m.tipe}</span>
              </div>

              <div style={{ display: 'flex', gap: 8, fontSize: 11, color: 'var(--text-2)', flexWrap: 'wrap' }}>
                <span>📅 {m.bergabung}</span>
                <span>⏱ {m.lama}</span>
                <span className={`tag tag-${m.status === 'Aktif' ? 'aktif' : 'probation'}`}>{m.status}</span>
              </div>

              {/* Detail expanded */}
              {selected?.id === m.id && (
                <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--border)' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
                    {[
                      { l: 'Kepuasan diri', v: `${m.kepuasan}/10`, c: m.kepuasan >= 7 ? 'var(--green)' : m.kepuasan >= 5 ? 'var(--amber)' : 'var(--red)' },
                      { l: 'Kriteria Kibo', v: `${m.kriteria}/5`, c: m.kriteria >= 4 ? 'var(--green)' : 'var(--amber)' },
                      { l: 'Skill level', v: `${m.skill}/5`, c: 'var(--text)' },
                      { l: 'Komunikasi', v: `${m.komunikasi}/5`, c: m.komunikasi >= 4 ? 'var(--green)' : 'var(--amber)' },
                    ].map(r => (
                      <div key={r.l} style={{ background: 'var(--surface-2)', padding: '6px 8px', borderRadius: 6 }}>
                        <div style={{ color: 'var(--text-2)', fontSize: 10, marginBottom: 2 }}>{r.l}</div>
                        <div style={{ fontWeight: 600, color: r.c }}>{r.v}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ marginTop: 10, fontSize: 12 }}>
                    <div style={{ marginBottom: 5 }}>
                      <span style={{ color: 'var(--text-2)' }}>Semangat: </span>{m.semangat}
                    </div>
                    <div style={{ marginBottom: 5 }}>
                      <span style={{ color: 'var(--text-2)' }}>Penguras energi: </span>{m.energi}
                    </div>
                    <div>
                      <span style={{ color: 'var(--text-2)' }}>Target 1 tahun: </span>{m.target}
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
