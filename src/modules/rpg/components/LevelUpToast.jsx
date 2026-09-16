// Banner notifikasi level-up. Untuk sekarang dirender inline (sesuai mockup);
// begitu disambung ke event real-time, bisa dibungkus jadi floating toast yang
// auto-dismiss tanpa mengubah tampilan intinya.
export default function LevelUpToast({ message }) {
  if (!message) return null;

  return (
    <div style={{
      marginTop: '1.15rem',
      display: 'flex', alignItems: 'center', gap: '.65rem',
      background: 'var(--rpg-bg-3)',
      border: '2px solid var(--rpg-stat-konsistensi)',
      padding: '.6rem .85rem',
    }}>
      <span className="rpg-blink" style={{ width: 9, height: 9, background: 'var(--rpg-stat-konsistensi)', flex: 'none' }} />
      <span style={{ fontFamily: 'var(--rpg-font-hud)', fontSize: '1.05rem', color: 'var(--rpg-ink)' }}>
        <b style={{
          fontFamily: 'var(--rpg-font-display)', fontSize: '.68rem',
          color: 'var(--rpg-stat-konsistensi)', display: 'block', marginBottom: '.3rem',
        }}>
          LEVEL UP!
        </b>
        {message}
      </span>
    </div>
  );
}
