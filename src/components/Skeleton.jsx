function SkeletonBox({ width = '100%', height = 16, radius = 6, style = {} }) {
  return (
    <div style={{
      width, height, borderRadius: radius,
      background: 'var(--surface-2)',
      position: 'relative', overflow: 'hidden',
      flexShrink: 0,
      ...style,
    }}>
      <div style={{
        position: 'absolute', inset: 0,
        background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.04) 50%, transparent 100%)',
        animation: 'skeletonShimmer 1.4s infinite',
      }} />
    </div>
  );
}

/* Preset: baris card metric (4 kotak sejajar) */
export function SkeletonMetrics({ count = 4 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: `repeat(${count}, 1fr)`, gap: 12, marginBottom: 16 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <SkeletonBox height={28} width="50%" radius={6} />
          <SkeletonBox height={12} width="70%" radius={4} />
        </div>
      ))}
    </div>
  );
}

/* Preset: baris list item (avatar + 2 baris teks) */
export function SkeletonList({ count = 5 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
          <SkeletonBox width={36} height={36} radius={10} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <SkeletonBox height={13} width={`${50 + (i * 13) % 30}%`} radius={4} />
            <SkeletonBox height={11} width={`${30 + (i * 7) % 25}%`} radius={4} />
          </div>
          <SkeletonBox height={22} width={60} radius={20} />
        </div>
      ))}
    </div>
  );
}

/* Preset: tabel (header + rows) */
export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16 }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonBox key={i} height={12} width={`${60 + (i * 11) % 40}px`} radius={4} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 16, alignItems: 'center' }}>
          <SkeletonBox width={28} height={28} radius={8} style={{ flexShrink: 0 }} />
          {Array.from({ length: cols - 1 }).map((_, j) => (
            <SkeletonBox key={j} height={12} width={`${50 + (j * 17 + i * 5) % 40}px`} radius={4} />
          ))}
        </div>
      ))}
    </div>
  );
}

/* Preset: halaman umum (metrics + list) */
export function SkeletonPage({ metrics = 4, items = 5 }) {
  return (
    <div>
      <SkeletonMetrics count={metrics} />
      <SkeletonList count={items} />
    </div>
  );
}

/* Preset: kartu grid (Tim page) */
export function SkeletonCards({ count = 9 }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="card" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <SkeletonBox width={44} height={44} radius={12} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <SkeletonBox height={13} width="70%" radius={4} />
              <SkeletonBox height={11} width="50%" radius={4} />
            </div>
          </div>
          <SkeletonBox height={1} style={{ background: 'var(--border)', marginTop: 4 }} />
          <div style={{ display: 'flex', gap: 6 }}>
            <SkeletonBox height={22} width={70} radius={20} />
            <SkeletonBox height={22} width={55} radius={20} />
          </div>
        </div>
      ))}
    </div>
  );
}

export default SkeletonBox;
