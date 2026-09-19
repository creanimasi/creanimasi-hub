import { SkeletonList } from '../../../components/Skeleton';

const box = {
  background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)',
  boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.35), inset -2px -2px 0 rgba(0,0,0,.4), 3px 3px 0 var(--rpg-bg-3)',
  padding: 'clamp(1.1rem, 2.4vw, 1.6rem)', fontFamily: 'var(--rpg-font-hud)',
};

// Kondisi data halaman RPG: memuat / gagal / belum terhubung ke anggota tim.
// Mengembalikan elemen bila halaman TIDAK boleh menampilkan konten normal, selain itu null.
export function rpgGuard({ loading, error, data, retry }) {
  if (loading && !data) return <div style={{ padding: '.5rem 0' }}><SkeletonList count={4} /></div>;
  if (error && error.status === 404) {
    return (
      <div className="rpg-pixbox" style={box}>
        <div style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '.7rem', color: 'var(--rpg-gold)', marginBottom: '.7rem' }}>BELUM TERHUBUNG</div>
        <p style={{ margin: 0, fontSize: '1.1rem', color: 'var(--rpg-ink-dim)', maxWidth: '60ch' }}>
          Akunmu belum terhubung ke data anggota tim, jadi XP dan quest belum bisa ditampilkan.
          Minta admin menautkan akunmu di Master Data.
        </p>
      </div>
    );
  }
  if (error) {
    return (
      <div className="rpg-pixbox" style={box}>
        <div style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '.7rem', color: 'var(--rpg-warn)', marginBottom: '.7rem' }}>GAGAL MEMUAT</div>
        <p style={{ margin: '0 0 .9rem', fontSize: '1.1rem', color: 'var(--rpg-ink-dim)' }}>{error.message}</p>
        <button onClick={retry} style={{
          fontFamily: 'var(--rpg-font-hud)', fontSize: '1.05rem', cursor: 'pointer',
          background: 'var(--rpg-gold)', color: '#1a1206', border: 'none', padding: '.35rem 1rem',
        }}>Coba lagi</button>
      </div>
    );
  }
  return null;
}
