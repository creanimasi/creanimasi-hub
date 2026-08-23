export default function EmptyState({ icon = '📭', title, subtitle, action }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', padding: '48px 24px', textAlign: 'center',
      gap: 12,
    }}>
      <div style={{ fontSize: 48, lineHeight: 1, filter: 'grayscale(0.2)' }}>{icon}</div>
      <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</div>
      {subtitle && (
        <div style={{ fontSize: 13, color: 'var(--text-3)', maxWidth: 280, lineHeight: 1.5 }}>{subtitle}</div>
      )}
      {action && (
        <button onClick={action.onClick} style={{
          marginTop: 4, padding: '8px 20px', borderRadius: 10,
          border: '1px solid var(--green)', background: 'var(--green-light)',
          color: 'var(--green)', fontWeight: 700, fontSize: 13, cursor: 'pointer',
        }}>
          {action.label}
        </button>
      )}
    </div>
  );
}
