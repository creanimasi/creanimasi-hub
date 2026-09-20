import { useNavigate } from 'react-router-dom';
import { SkeletonList } from '../../../components/Skeleton';
import { useAuth } from '../../../hooks/useAuth';

const box = {
  background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)',
  boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.35), inset -2px -2px 0 rgba(0,0,0,.4), 3px 3px 0 var(--rpg-bg-3)',
  padding: 'clamp(1.1rem, 2.4vw, 1.6rem)', fontFamily: 'var(--rpg-font-hud)',
};

// Akun yang tidak tertaut ke data anggota tim (umumnya akun admin) tidak punya Character Sheet/quest sendiri.
// Bila akun itu pemegang akses Pantau Anggota, arahkan ke sana — saran "minta admin menautkan" tidak relevan
// untuk Super Admin, dan tanpa petunjuk ini fitur pantau semua anggota tidak mudah ditemukan.
function BelumTerhubung() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const bisaPantau = (user?.page_access || []).includes('rpg-pantau');
  return (
    <div className="rpg-pixbox" style={box}>
      <div style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '.7rem', color: 'var(--rpg-gold)', marginBottom: '.7rem' }}>
        {bisaPantau ? 'AKUN INI TIDAK PUNYA KARAKTER' : 'BELUM TERHUBUNG'}
      </div>
      {bisaPantau ? (
        <>
          <p style={{ margin: '0 0 .9rem', fontSize: '1.1rem', color: 'var(--rpg-ink-dim)', maxWidth: '64ch' }}>
            Akun ini tidak tertaut ke data anggota tim (umum untuk akun admin), jadi tidak punya Character Sheet, quest, atau pencapaian sendiri.
            Untuk melihat kondisi <b style={{ color: 'var(--rpg-ink)' }}>semua anggota</b> — Character Sheet, Papan Quest, dan Pencapaian mereka —
            buka Pantau Anggota.
          </p>
          <button type="button" onClick={() => navigate('/rpg/anggota')} style={{
            fontFamily: 'var(--rpg-font-hud)', fontSize: '1.1rem', cursor: 'pointer',
            background: 'var(--rpg-gold)', color: '#1a1206', border: 'none', padding: '.4rem 1.1rem',
          }}>Buka Pantau Anggota →</button>
        </>
      ) : (
        <p style={{ margin: 0, fontSize: '1.1rem', color: 'var(--rpg-ink-dim)', maxWidth: '60ch' }}>
          Akunmu belum terhubung ke data anggota tim, jadi XP dan quest belum bisa ditampilkan.
          Minta admin menautkan akunmu di Master Data.
        </p>
      )}
    </div>
  );
}

// Kondisi data halaman RPG: memuat / gagal / belum terhubung ke anggota tim.
// Mengembalikan elemen bila halaman TIDAK boleh menampilkan konten normal, selain itu null.
export function rpgGuard({ loading, error, data, retry }) {
  if (loading && !data) return <div style={{ padding: '.5rem 0' }}><SkeletonList count={4} /></div>;
  if (error && error.status === 404) return <BelumTerhubung />;
  if (error && error.status === 403) {
    return (
      <div className="rpg-pixbox" style={box}>
        <div style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '.7rem', color: 'var(--rpg-warn)', marginBottom: '.7rem' }}>AKSES DITUTUP</div>
        <p style={{ margin: 0, fontSize: '1.1rem', color: 'var(--rpg-ink-dim)', maxWidth: '60ch' }}>
          Role-mu tidak lagi punya akses ke halaman ini. Muat ulang halaman; bila menu ini masih kamu perlukan, minta admin mengaktifkannya di Master Data.
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
