import { useState, useEffect } from 'react';
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine,
} from 'recharts';
import { TIPE_COLOR, DIVISI_COLOR } from '../data/tim';
import { useAuth } from '../hooks/useAuth';
import { useTim } from '../hooks/useTim';
import { api } from '../services/api';

const METRIK = [
  { key: 'skor_total',     label: 'Skor Total',  color: '#00D68F', max: 100 },
  { key: 'avg_mood',       label: 'Mood',        color: '#9B8FFF', max: 10  },
  { key: 'avg_karya',      label: 'Karya',       color: '#FFB84B', max: 5   },
  { key: 'avg_skill',      label: 'Skill',       color: '#4BC8FF', max: 5   },
  { key: 'avg_komunikasi', label: 'Komunikasi',  color: '#FF6B9D', max: 5   },
  { key: 'avg_waktu',      label: 'Waktu',       color: '#A8E063', max: 5   },
];

// Custom tooltip dengan styling dark
function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--surface)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '10px 14px', fontSize: 12, minWidth: 160,
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: 'var(--text-2)' }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginBottom: 3 }}>
          <span style={{ color: p.color }}>{p.name}</span>
          <span style={{ fontWeight: 700, color: p.color }}>{p.value}</span>
        </div>
      ))}
    </div>
  );
}

// Komponen chart untuk satu anggota
function MemberChart({ nama, data, metrikKey, periode, tim }) {
  const metrik   = METRIK.find(m => m.key === metrikKey) || METRIK[0];
  const member   = tim.find(t => t.nama === nama);
  const tc       = member ? (TIPE_COLOR[member.tipe] || {}) : {};
  const dc       = member ? (DIVISI_COLOR[member.divisi] || {}) : {};
  const inits    = nama.split(' ').slice(0, 2).map(w => w[0]).join('');

  if (!data || data.length === 0) return (
    <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
      Belum ada data jurnal
    </div>
  );

  // Hitung trend (naik/turun)
  const first = data[0]?.[metrikKey] || 0;
  const last  = data[data.length - 1]?.[metrikKey] || 0;
  const delta = last - first;
  const trendColor = delta > 0 ? 'var(--green)' : delta < 0 ? 'var(--red)' : 'var(--text-3)';
  const trendIcon  = delta > 0 ? '▲' : delta < 0 ? '▼' : '→';
  const avg = data.length > 0
    ? Math.round(data.reduce((s, d) => s + (d[metrikKey] || 0), 0) / data.length * 10) / 10
    : 0;

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      {/* Header anggota */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div style={{
          width: 36, height: 36, borderRadius: 10, flexShrink: 0,
          background: tc.bg || 'var(--surface-2)', color: tc.text || 'var(--text-2)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, fontWeight: 700,
        }}>{inits}</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700, fontSize: 13 }}>{nama}</div>
          <div style={{ fontSize: 10, color: dc.text || 'var(--text-3)' }}>{dc.icon} {member?.divisi} · {member?.level}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: metrik.color, lineHeight: 1 }}>
            {last}
            <span style={{ fontSize: 11, color: 'var(--text-3)' }}>/{metrik.max}</span>
          </div>
          <div style={{ fontSize: 11, color: trendColor, fontWeight: 600 }}>
            {trendIcon} {Math.abs(delta).toFixed(1)} dari {data.length} {periode === 'bulan' ? 'bulan' : 'minggu'}
          </div>
        </div>
        <div style={{
          textAlign: 'center', padding: '4px 10px', borderRadius: 8,
          background: `${metrik.color}18`, border: `1px solid ${metrik.color}30`,
        }}>
          <div style={{ fontSize: 9, color: 'var(--text-3)', textTransform: 'uppercase' }}>Rata-rata</div>
          <div style={{ fontSize: 16, fontWeight: 800, color: metrik.color }}>{avg}</div>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} />
          <YAxis domain={[0, metrik.max]} tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine y={avg} stroke={metrik.color} strokeDasharray="4 4" strokeOpacity={0.4} />
          <Line
            type="monotone" dataKey={metrikKey} name={metrik.label}
            stroke={metrik.color} strokeWidth={2.5} dot={{ r: 3, fill: metrik.color }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

// Komponen perbandingan semua anggota (admin view)
function TeamCompareChart({ data, metrikKey, periode }) {
  const metrik = METRIK.find(m => m.key === metrikKey) || METRIK[0];

  // Buat data: rata-rata per anggota
  const teamData = Object.entries(data).map(([nama, rows]) => {
    const avg = rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + (r[metrikKey] || 0), 0) / rows.length * 10) / 10
      : 0;
    const last  = rows[rows.length - 1]?.[metrikKey] || 0;
    const first = rows[0]?.[metrikKey] || 0;
    const delta = last - first;
    return { nama: nama.split(' ')[0], avg, delta, last };
  }).sort((a, b) => b.avg - a.avg);

  return (
    <div className="card" style={{ marginBottom: 16 }}>
      <div className="card-title">
        Perbandingan Tim — {metrik.label}
        <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 400, marginLeft: 6 }}>
          rata-rata {periode === 'bulan' ? 'bulanan' : 'mingguan'}
        </span>
      </div>
      <ResponsiveContainer width="100%" height={160}>
        <BarChart data={teamData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis dataKey="nama" tick={{ fontSize: 10, fill: 'var(--text-2)' }} tickLine={false} />
          <YAxis domain={[0, metrik.max]} tick={{ fontSize: 9, fill: 'var(--text-3)' }} tickLine={false} />
          <Tooltip
            content={({ active, payload, label }) => active && payload?.length ? (
              <div style={{ background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 8, padding: '8px 12px', fontSize: 12 }}>
                <div style={{ fontWeight: 700, marginBottom: 4 }}>{label}</div>
                <div style={{ color: metrik.color }}>Rata-rata: <strong>{payload[0]?.value}</strong></div>
                <div style={{ color: payload[0]?.payload?.delta >= 0 ? 'var(--green)' : 'var(--red)', fontSize: 11 }}>
                  Trend: {payload[0]?.payload?.delta >= 0 ? '▲' : '▼'} {Math.abs(payload[0]?.payload?.delta).toFixed(1)}
                </div>
              </div>
            ) : null}
          />
          <Bar dataKey="avg" name={metrik.label} fill={metrik.color} radius={[5, 5, 0, 0]} maxBarSize={40} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────────
export default function Performa() {
  const { user }    = useAuth();
  const tim         = useTim();
  const isAdmin     = user?.role === 'admin';
  const [data,      setData]      = useState({});
  const [loading,   setLoading]   = useState(true);
  const [periode,   setPeriode]   = useState('minggu');
  const [metrikKey, setMetrikKey] = useState('skor_total');
  const [filter,    setFilter]    = useState('Semua'); // divisi filter (admin)

  useEffect(() => {
    setLoading(true);
    api.getPerforma(periode, 12)
      .then(res => setData(res.data || {}))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [periode]);

  const divisiList = ['Semua', ...new Set(tim.map(t => t.divisi))];

  const timAktifNames = new Set(tim.map(t => t.nama));

  const filteredNames = isAdmin
    ? Object.keys(data).filter(nama => {
        if (!timAktifNames.has(nama)) return false;
        if (filter === 'Semua') return true;
        const m = tim.find(t => t.nama === nama);
        return m?.divisi === filter;
      })
    : Object.keys(data);

  return (
    <div>
      {/* Header & kontrol */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>📈 Grafik Performa Tim</div>
          <div style={{ fontSize: 12, color: 'var(--text-2)', marginTop: 2 }}>
            Tren performa berdasarkan data jurnal refleksi
          </div>
        </div>
        {/* Periode toggle */}
        <div style={{ display: 'flex', gap: 4 }}>
          {['minggu', 'bulan'].map(p => (
            <button key={p} onClick={() => setPeriode(p)}
              style={{
                padding: '6px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                border: `1px solid ${periode === p ? 'var(--green)' : 'var(--border-2)'}`,
                background: periode === p ? 'var(--green-light)' : 'var(--surface)',
                color: periode === p ? 'var(--green)' : 'var(--text-2)',
                fontWeight: periode === p ? 700 : 400,
              }}>
              Per {p.charAt(0).toUpperCase() + p.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Pilih metrik */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {METRIK.map(m => (
          <button key={m.key} onClick={() => setMetrikKey(m.key)}
            style={{
              padding: '5px 12px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
              border: `1px solid ${metrikKey === m.key ? m.color : 'var(--border-2)'}`,
              background: metrikKey === m.key ? `${m.color}18` : 'var(--surface)',
              color: metrikKey === m.key ? m.color : 'var(--text-2)',
              fontWeight: metrikKey === m.key ? 700 : 400,
            }}>
            {m.label}
          </button>
        ))}
      </div>

      {/* Filter divisi (admin) */}
      {isAdmin && (
        <div className="tabs" style={{ marginBottom: 14 }}>
          {divisiList.map(d => (
            <div key={d} className={`tab ${filter === d ? 'active' : ''}`}
              onClick={() => setFilter(d)} style={{ fontSize: 11 }}>
              {d}
            </div>
          ))}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-2)' }}>
          Memuat data performa...
        </div>
      ) : filteredNames.length === 0 ? (
        <div className="empty">
          <div className="empty-icon">📊</div>
          <div className="empty-title">Belum ada data jurnal</div>
          <div className="empty-sub">
            Grafik akan muncul setelah anggota mengisi jurnal refleksi mingguan
          </div>
        </div>
      ) : (
        <>
          {/* Chart perbandingan tim (admin only) */}
          {isAdmin && filteredNames.length > 1 && (
            <TeamCompareChart
              data={Object.fromEntries(filteredNames.map(n => [n, data[n]]))}
              metrikKey={metrikKey}
              periode={periode}
            />
          )}

          {/* Chart per anggota */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))', gap: 12 }}>
            {filteredNames.map(nama => (
              <MemberChart
                key={nama}
                nama={nama}
                data={data[nama] || []}
                metrikKey={metrikKey}
                periode={periode}
                tim={tim}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
