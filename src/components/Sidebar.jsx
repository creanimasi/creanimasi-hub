import { useContext } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TIPE_COLOR } from '../data/tim';
import { useAuth } from '../hooks/useAuth';
import { useTim } from '../hooks/useTim';
import { PresenceContext } from './Layout';

const NAV_ADMIN = [
  { section: 'Utama' },
  { path: '/',           label: 'Dashboard',           badge: null,              badgeType: '' },
  { path: '/tim',        label: 'Tim',                 badge: null,              badgeType: 'green' },
  { path: '/anggota',    label: 'Kelola Anggota',       badge: null,              badgeType: '' },
  { path: '/modul',      label: 'Modul Belajar',       badge: null,              badgeType: '' },
  { path: '/jurnal',     label: 'Jurnal Refleksi',     badge: null,              badgeType: '' },
  { section: 'Form' },
  { path: '/laporan-admin',  label: 'Laporan Mingguan Admin',  badge: null, badgeType: '' },
  { path: '/jurnal/isi', label: 'Isi Jurnal Mingguan', badge: null, badgeType: '' },
  { path: '/profiling',  label: 'Form Profiling Tim',  badge: null, badgeType: '' },
  { section: 'Operasional' },
  { path: '/sop',        label: 'SOP Brief',           badge: null, badgeType: '' },
  { path: '/reward',     label: 'Reward & KPI',        badge: null, badgeType: '' },
  { path: '/workshop',   label: 'Workshop JRUHUB',     badge: null, badgeType: '' },
  { section: 'Analitik' },
  { path: '/performa',   label: 'Grafik Performa',     badge: null, badgeType: '' },
  { path: '/laporan-harian', label: 'Laporan Harian',   badge: null, badgeType: '' },
  { path: '/laporan-mentor', label: 'Laporan Mingguan Mentor', badge: null, badgeType: '' },
  { section: 'Pengembangan' },
  { path: '/friday-win', label: 'Friday Win',          badge: null, badgeType: '' },
  { path: '/kalender',   label: 'Kalender',             badge: null, badgeType: '' },
  { path: '/skb',        label: 'SKB',                 badge: null, badgeType: '' },
  { path: '/1on1',       label: 'Sesi 1-on-1',         badge: null, badgeType: '' },
  { path: '/kader',      label: 'Kader Potensial',     badge: null, badgeType: '' },
];

const NAV_MEMBER = [
  { section: 'Saya' },
  { path: '/',           label: 'Dashboard Saya',      badge: null, badgeType: '' },
  { path: '/modul',      label: 'Modul Belajar',       badge: null, badgeType: '' },
  { section: 'Isi Data' },
  { path: '/jurnal/isi',     label: 'Isi Jurnal Mingguan', badge: null, badgeType: '' },
  { path: '/jurnal/riwayat', label: 'Riwayat Jurnal',      badge: null, badgeType: '' },
  { path: '/profiling',      label: 'Form Profiling',       badge: null, badgeType: '' },
  { section: 'Referensi' },
  { path: '/sop',        label: 'SOP Brief',           badge: null, badgeType: '' },
  { section: 'Analitik' },
  { path: '/performa',      label: 'Grafik Performa',      badge: null, badgeType: '' },
  { section: 'Inisiatif' },
  { path: '/skb',        label: 'Ajukan SKB',          badge: null, badgeType: '' },
];

const ICONS = {
  '/':           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  '/tim':        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="18" cy="7" r="2"/><path d="M15 20c0-2.2 1.3-4 3-4.5"/></svg>,
  '/tim/kelola': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  '/anggota':    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><circle cx="18" cy="8" r="3"/><path d="M21 21v-1.5a3 3 0 0 0-2-2.83"/></svg>,
  '/modul':      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  '/jurnal':     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  '/jurnal/isi':     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  '/jurnal/riwayat': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 8v4l3 3"/><circle cx="12" cy="12" r="9"/></svg>,
  '/profiling':  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  '/sop':        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9,11 12,14 22,4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  '/reward':     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>,
  '/workshop':   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  '/skb':        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><polyline points="9,15 11,17 15,13"/></svg>,
  '/1on1':       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  '/kader':      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26 12,2"/></svg>,
  '/friday-win': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 21h8"/><path d="M12 21v-4"/><path d="M17 5H7L5 12h14L17 5z"/><path d="M5 12c0 3.3 3.1 6 7 6s7-2.7 7-6"/></svg>,
  '/performa':   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/></svg>,
  '/laporan-harian': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="9" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="15" y2="11"/><line x1="9" y1="15" x2="13" y2="15"/></svg>,
  '/laporan-mentor': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>,
  '/laporan-admin':  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>,
  '/kalender':   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
};

export default function Sidebar({ isOpen, onClose }) {
  const location       = useLocation();
  const navigate       = useNavigate();
  const { user, logout } = useAuth();
  const { isOnline }   = useContext(PresenceContext);
  const tim            = useTim();
  const isAdmin        = user?.role === 'admin';
  const isAdminDivisi  = !isAdmin && tim.some(m => m.nama === user?.nama && m.divisi === 'Admin');
  const baseNav        = isAdmin ? NAV_ADMIN : NAV_MEMBER;
  const NAV            = (!isAdmin && isAdminDivisi)
    ? baseNav.map(item =>
        item.path === '/jurnal/isi'
          ? [{ path: '/laporan-admin', label: 'Laporan Mingguan Admin', badge: null, badgeType: '' }, item]
          : item
      ).flat()
    : baseNav;

  // Top 5 tim untuk preview strip
  const teamPreview = tim.slice(0, 5);

  const goTo = (path) => { navigate(path); onClose?.(); };

  return (
    <aside className={`sidebar${isOpen ? ' mobile-open' : ''}`}>
      {/* Logo */}
      <div className="sidebar-logo">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img
            src="/logo192.png"
            alt="Flipspace"
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'var(--green-light)',
              border: '1px solid rgba(0,214,143,0.2)',
              objectFit: 'contain', padding: 3,
            }}
          />
          <div>
            <div className="sidebar-logo-name">Flipspace</div>
            <div className="sidebar-logo-sub">Internal Hub</div>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV.map((item, i) =>
          item.section ? (
            <div key={i} className="nav-section">{item.section}</div>
          ) : (
            <div key={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => goTo(item.path)}>
              {ICONS[item.path]}
              {item.label}
              {(item.path === '/tim' ? tim.length : item.badge) > 0 && (
                <span className={`nav-badge ${item.badgeType}`}>
                  {item.path === '/tim' ? tim.length : item.badge}
                </span>
              )}
            </div>
          )
        )}
      </nav>

      {/* Team preview strip — admin only */}
      {isAdmin && <div style={{
        padding: '10px 14px',
        borderTop: '1px solid var(--border)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div style={{ fontSize: 9, fontWeight: 700, color: 'var(--text-3)',
          textTransform: 'uppercase', letterSpacing: '.1em', marginBottom: 8 }}>
          Tim Aktif
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
          {teamPreview.map(m => {
            const tc     = TIPE_COLOR[m.tipe] || { bg: 'var(--surface-2)', text: 'var(--text-2)' };
            const inits  = m.nama.split(' ').slice(0, 2).map(w => w[0]).join('');
            const online = isOnline(m.nama);
            return (
              <div key={m.id}
                title={`${m.nama}${online ? ' — Online' : ''}`}
                onClick={() => goTo('/tim')}
                style={{ position: 'relative', width: 28, height: 28, cursor: 'pointer' }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 8,
                  background: tc.bg, color: tc.text,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 10, fontWeight: 700,
                  border: `1px solid ${online ? 'rgba(0,214,143,0.4)' : 'rgba(255,255,255,0.06)'}`,
                  transition: 'transform .15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.transform = 'scale(1.15)'}
                  onMouseLeave={e => e.currentTarget.style.transform = ''}
                >
                  {inits}
                </div>
                {/* Dot online/offline — selalu tampil */}
                <div style={{
                  position: 'absolute', bottom: -2, right: -2,
                  width: 10, height: 10, borderRadius: '50%',
                  background: online ? '#00D68F' : '#555',
                  border: '2px solid var(--bg, #080C14)',
                  boxShadow: online ? '0 0 6px #00D68F' : 'none',
                  transition: 'background .4s, box-shadow .4s',
                  zIndex: 1,
                }} />
              </div>
            );
          })}
          {tim.length > 5 && (
            <div onClick={() => goTo('/tim')} style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'var(--surface-2)', color: 'var(--text-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, cursor: 'pointer',
              border: '1px solid var(--border)',
            }}>
              +{tim.length - 5}
            </div>
          )}
        </div>
      </div>}

      {/* Footer user */}
      <div className="sidebar-footer">
        <div className="user-row">
          <div className="user-avatar" onClick={() => goTo('/profil')}
            style={{ cursor: 'pointer' }}
            title="Buka profil">
            {user?.nama?.split(' ').slice(0,2).map(w=>w[0]).join('') || '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }}
            onClick={() => goTo('/profil')}>
            <div className="user-name" style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
              {user?.nama || 'Guest'}
            </div>
            <div className="user-role" style={{ color: 'var(--text-3)', fontSize: 10 }}>
              {user?.role === 'admin' ? '👑 Admin' : '👤 Member'} · Profil & Sandi
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
            <div style={{
              width:7, height:7, borderRadius:'50%', background:'var(--green)',
              boxShadow:'0 0 6px var(--green)',
            }} />
            <button onClick={() => { logout(); goTo('/login'); }} title="Keluar"
              style={{
                width:26, height:26, borderRadius:7, border:'1px solid var(--border-2)',
                background:'var(--surface-2)', cursor:'pointer', fontSize:12,
                display:'flex', alignItems:'center', justifyContent:'center',
                color:'var(--text-3)', transition:'color .15s, background .15s',
              }}
              onMouseEnter={e=>{e.currentTarget.style.color='var(--red)';e.currentTarget.style.background='var(--red-light)';}}
              onMouseLeave={e=>{e.currentTarget.style.color='var(--text-3)';e.currentTarget.style.background='var(--surface-2)';}}
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                style={{ width:14, height:14, display:'block' }}>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
                <polyline points="16 17 21 12 16 7"/>
                <line x1="21" y1="12" x2="9" y2="12"/>
              </svg>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
}
