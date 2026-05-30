import { TIM, TIPE_COLOR } from '../data/tim';

function Avatar({ nama, bg, color, size = 28 }) {
  const initials = nama.split(' ').slice(0, 2).map(w => w[0]).join('');
  return (
    <div className="avatar" style={{ width: size, height: size, background: bg, color, fontSize: size * 0.38 }}>
      {initials}
    </div>
  );
}

export default function Dashboard() {
  const noJurnal = TIM.filter((_, i) => i > 8);
  const rising  = TIM.filter(t => t.tipe === 'Rising Star');

  return (
    <div>
      {/* Alerts */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="alert alert-red" style={{ flex: 1, minWidth: 220 }}>
          <span>⚠️</span>
          <div><strong>Ridho Ramadhan</strong> — sinyal At Risk dari profiling. Jadwalkan 1-on-1 segera dalam 48 jam.</div>
        </div>
        <div className="alert alert-amber" style={{ flex: 1, minWidth: 220 }}>
          <span>📅</span>
          <div><strong>Gathering belum dijadwalkan.</strong> Noval & Nanda sudah sinyal butuh momen komunal.</div>
        </div>
      </div>

      {/* Metrics */}
      <div className="metrics-grid">
        <div className="metric">
          <div className="metric-val">{TIM.filter(t => t.status === 'Aktif').length}</div>
          <div className="metric-lbl">Anggota aktif</div>
          <div className="metric-sub text-muted">+{TIM.filter(t => t.status === 'Probation').length} probation</div>
        </div>
        <div className="metric">
          <div className="metric-val text-red">{noJurnal.length}</div>
          <div className="metric-lbl">Belum isi jurnal</div>
          <div className="metric-sub text-red">minggu ini</div>
        </div>
        <div className="metric">
          <div className="metric-val text-green">{rising.length}</div>
          <div className="metric-lbl">Rising Star</div>
          <div className="metric-sub text-muted">dari hasil profiling</div>
        </div>
        <div className="metric">
          <div className="metric-val">$0</div>
          <div className="metric-lbl">Revenue bulan ini</div>
          <div className="metric-sub text-muted">target $5.000</div>
        </div>
      </div>

      <div className="grid-2">
        {/* Tim kondisi */}
        <div className="card">
          <div className="card-title">Kondisi tim saat ini</div>
          {TIM.map(m => {
            const tc = TIPE_COLOR[m.tipe];
            return (
              <div key={m.id} className="member-row">
                <Avatar nama={m.nama} bg={tc.bg} color={tc.text} />
                <span className="member-name">{m.nama}</span>
                <span style={{ fontSize: 11, color: 'var(--text-2)', marginRight: 6 }}>{m.divisi}</span>
                <span className={`tag tag-${tc.badge}`}>{m.tipe}</span>
              </div>
            );
          })}
        </div>

        <div>
          {/* Revenue Admin */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-title">Revenue Admin bulan ini</div>
            {[
              { n: 'Ariel', v: 0, t: 2000 },
              { n: 'Ryan',  v: 0, t: 2000 },
              { n: 'Nanda', v: 0, t: 1000 },
            ].map(r => (
              <div key={r.n} className="progress-row">
                <div className="progress-label">{r.n}</div>
                <div className="progress-bar">
                  <div className="progress-fill"
                    style={{ width: `${Math.round(r.v / r.t * 100)}%`,
                      background: r.v >= r.t ? 'var(--green)' : 'var(--red)' }} />
                </div>
                <div className="progress-val" style={{ color: r.v >= r.t ? 'var(--green)' : 'var(--red)' }}>
                  ${r.v}
                </div>
              </div>
            ))}
            <div style={{ fontSize: 11, color: 'var(--text-2)', marginTop: 8, textAlign: 'right' }}>
              Target total: $5.000 / bulan
            </div>
          </div>

          {/* Aksi cepat */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div className="card-title">Aksi prioritas minggu ini</div>
            {[
              { ico: '🔴', label: '1-on-1 dengan Ridho — At Risk', sub: 'Dalam 48 jam' },
              { ico: '⭐', label: 'Friday Win — apresiasi tim', sub: 'Jumat ini' },
              { ico: '🎉', label: 'Jadwalkan gathering / BBQ', sub: 'Bulan ini' },
              { ico: '📋', label: 'Bagikan SOP Brief ke Admin & PM', sub: 'Minggu ini' },
            ].map((a, i) => (
              <div key={i} className="member-row" style={{ alignItems: 'flex-start', padding: '7px 0' }}>
                <span style={{ fontSize: 16 }}>{a.ico}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, fontWeight: 500 }}>{a.label}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-2)' }}>{a.sub}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Kandidat Secondline */}
          <div className="card">
            <div className="card-title">Top kandidat Secondline</div>
            {[
              { r: 1, n: 'Ariel Tegar', s: 'Paling siap' },
              { r: 2, n: 'Ahmad Fathurrahman', s: 'Sangat siap' },
              { r: 3, n: 'Ryan Cavallera', s: 'Siap dikembangkan' },
            ].map(k => {
              const member = TIM.find(t => t.nama.startsWith(k.n.split(' ')[0]));
              const tc = member ? TIPE_COLOR[member.tipe] : TIPE_COLOR['Rising Star'];
              return (
                <div key={k.r} className="member-row">
                  <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--text-2)', width: 16 }}>{k.r}</div>
                  <Avatar nama={k.n} bg={tc.bg} color={tc.text} />
                  <span className="member-name">{k.n}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-2)' }}>{k.s}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
