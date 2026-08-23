import { useContext, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TIPE_COLOR } from '../data/tim';
import { useAuth } from '../hooks/useAuth';
import { useTim } from '../hooks/useTim';
import { PresenceContext } from './Layout';

const NAV_ADMIN = [
  { section: 'Utama' },
  { path: '/',              label: 'Dashboard',         badgeType: '' },
  { path: '/ai-assistant',  label: 'AI Assistant',      badgeType: '' },
  { path: '/kalender',      label: 'Kalender',          badgeType: '' },
  { section: 'Tim' },
  { path: '/tim',           label: 'Direktori Tim',     badgeType: 'green' },
  { path: '/anggota',       label: 'Kelola Anggota',    badgeType: '' },
  { path: '/performa',      label: 'Performa',          badgeType: '' },
  { path: '/absensi',       label: 'Absensi',           badgeType: '' },
  { section: 'Aksi Cepat' },
  { path: '/jurnal/isi',    label: 'Isi Jurnal',        badgeType: 'green' },
  { path: '/laporan-admin', label: 'Laporan Mingguan',  badgeType: '' },
  { path: '/profiling',     label: 'Form Profiling',    badgeType: '' },
  { section: 'Program' },
  { path: '/modul',         label: 'Modul Belajar',     badgeType: '' },
  { path: '/workshop',      label: 'Workshop',          badgeType: '' },
  { path: '/friday-win',    label: 'Friday Win',        badgeType: '' },
  { path: '/1on1',          label: 'Sesi 1-on-1',       badgeType: '' },
  { path: '/skb',           label: 'SKB',               badgeType: '' },
  { path: '/reward',        label: 'Reward & KPI',      badgeType: '' },
  { path: '/sop',           label: 'SOP Brief',         badgeType: '' },
  { path: '/kader',         label: 'Kader Potensial',   badgeType: '' },
  { group: 'Laporan' },
  { path: '/laporan-harian',   label: 'Laporan Harian',        badgeType: '', sub: true, groupKey: 'laporan' },
  { path: '/laporan-mentor',   label: 'Lap. Mingguan Mentor',  badgeType: '', sub: true, groupKey: 'laporan' },
  { path: '/laporan-bulanan',  label: 'Laporan Bulanan',       badgeType: '', sub: true, groupKey: 'laporan' },
  { group: 'Marketing' },
  { path: '/ads-performance',  label: 'Ads Performance',       badgeType: '', sub: true, groupKey: 'marketing' },
  { path: '/laporan-profit',   label: 'Laporan Profit',        badgeType: '', sub: true, groupKey: 'marketing' },
];

const NAV_MEMBER = [
  { section: 'Utama' },
  { path: '/',              label: 'Dashboard',         badgeType: '' },
  { path: '/modul',         label: 'Modul Belajar',     badgeType: '' },
  { path: '/performa',      label: 'Grafik Performa',   badgeType: '' },
  { section: 'Aksi Cepat' },
  { path: '/jurnal/isi',    label: 'Isi Jurnal',        badgeType: 'green' },
  { path: '/jurnal/riwayat',label: 'Riwayat Jurnal',    badgeType: '' },
  { path: '/profiling',     label: 'Form Profiling',    badgeType: '' },
  { section: 'Program' },
  { path: '/sop',           label: 'SOP Brief',         badgeType: '' },
  { path: '/skb',           label: 'Ajukan SKB',        badgeType: '' },
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
  '/laporan-admin':   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>,
  '/laporan-bulanan': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><polyline points="8,14 10,16 16,13"/></svg>,
  '/kalender':   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  '/absensi':         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><polyline points="9,15 11,17 15,13"/></svg>,
  '/ads-performance': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/><circle cx="19" cy="5" r="2" fill="currentColor" stroke="none"/></svg>,
  '/laporan-profit':  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  '/ai-assistant':    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a7 7 0 0 1 7 7c0 3-1.8 5.6-4.5 6.7V18H9.5v-2.3C6.8 14.6 5 12 5 9a7 7 0 0 1 7-7z"/><path d="M9 21h6M10 17.5c0-1 .5-2 1-2.5M14 17.5c0-1-.5-2-1-2.5"/><circle cx="9.5" cy="9" r="1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="9" r="1" fill="currentColor" stroke="none"/></svg>,
};

export default function Sidebar({ isOpen, onClose, collapsed, onToggleCollapse }) {
  const location       = useLocation();
  const navigate       = useNavigate();
  const { user, logout } = useAuth();
  const { isOnline }   = useContext(PresenceContext);
  const tim            = useTim();
  const timAktif       = tim;
  const isAdmin        = user?.role === 'admin';
  const isAdminDivisi  = !isAdmin && tim.some(m => m.nama === user?.nama && m.divisi === 'Admin');
  const LAPORAN_PATHS   = ['/laporan-harian', '/laporan-mentor', '/laporan-bulanan'];
  const MARKETING_PATHS = ['/ads-performance', '/laporan-profit'];
  const [laporanOpen,   setLaporanOpen]   = useState(() => LAPORAN_PATHS.includes(location.pathname));
  const [marketingOpen, setMarketingOpen] = useState(() => MARKETING_PATHS.includes(location.pathname));

  const baseNav = isAdmin ? NAV_ADMIN : NAV_MEMBER;
  const NAV = (!isAdmin && isAdminDivisi)
    ? baseNav.map(item =>
        item.path === '/jurnal/isi'
          ? [{ path: '/laporan-admin', label: 'Laporan Mingguan', badgeType: '' }, item]
          : item
      ).flat()
    : baseNav;

  const teamPreview = tim.slice(0, 5);

  const goTo = (path) => { navigate(path); onClose?.(); };

  const cls = `sidebar${isOpen ? ' mobile-open' : ''}${collapsed ? ' collapsed' : ''}`;

  return (
    <aside className={cls}>
      {/* Logo + toggle collapse */}
      <div className="sidebar-logo" style={{ justifyContent: collapsed ? 'center' : undefined }}>
        {!collapsed && (
          <img
            src="/logo192.png"
            alt="Creanimasi"
            style={{
              width: 30, height: 30, borderRadius: 8, flexShrink: 0,
              background: 'var(--green-light)',
              border: '1px solid rgba(0,214,143,0.2)',
              objectFit: 'contain', padding: 3,
            }}
          />
        )}
        {!collapsed && (
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="sidebar-logo-name">Creanimasi</div>
            <div className="sidebar-logo-sub">Internal Hub</div>
          </div>
        )}
        <button
          onClick={onToggleCollapse}
          title={collapsed ? 'Perluas sidebar' : 'Perkecil sidebar'}
          style={{
            marginLeft: collapsed ? 0 : 'auto', flexShrink: 0,
            width: 32, height: 32, borderRadius: 8,
            border: '1px solid var(--border-2)',
            background: 'transparent',
            cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: 'var(--text-3)', transition: 'background .15s, color .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'var(--green-light)'; e.currentTarget.style.color = 'var(--green)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-3)'; }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
            style={{ width: 14, height: 14, display: 'block', transition: 'transform .2s', transform: collapsed ? 'rotate(180deg)' : 'none' }}>
            <polyline points="15,18 9,12 15,6"/>
          </svg>
        </button>
      </div>

      {/* Scrollable area: nav + team preview + footer */}
      <div className="sidebar-scroll">
      {/* Nav */}
      <nav className="sidebar-nav">
        {NAV.map((item, i) => {
          /* Section header */
          if (item.section) {
            if (collapsed) return null;
            return <div key={i} className="nav-section">{item.section}</div>;
          }

          /* Collapsible group headers */
          if (item.group) {
            const isMarketing = item.group === 'Marketing';
            const paths       = isMarketing ? MARKETING_PATHS : LAPORAN_PATHS;
            const isOpen      = isMarketing ? marketingOpen : laporanOpen;
            const toggle      = isMarketing ? () => setMarketingOpen(o => !o) : () => setLaporanOpen(o => !o);
            const anyActive   = paths.includes(location.pathname);
            const label       = item.group;
            const icon        = isMarketing
              ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15,flexShrink:0}}>
                  <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
                  <circle cx="19" cy="5" r="2" fill="currentColor" stroke="none"/>
                </svg>
              : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15,flexShrink:0}}>
                  <rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/>
                  <rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>
                </svg>;

            if (collapsed) return (
              <div key={`group-${label}`}
                className={`nav-item nav-item-collapsed${anyActive ? ' active' : ''}`}
                title={label} onClick={toggle}>
                {isMarketing
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}>
                      <polyline points="22,12 18,12 15,21 9,3 6,12 2,12"/>
                      <circle cx="19" cy="5" r="2" fill="currentColor" stroke="none"/>
                    </svg>
                  : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}>
                      <rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/>
                      <rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>
                    </svg>
                }
              </div>
            );
            return (
              <div key={`group-${label}`}
                className={`nav-item${anyActive ? ' active' : ''}`}
                onClick={toggle} style={{ userSelect: 'none' }}>
                {icon}
                <span style={{flex:1}}>{label}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{width:12,height:12,flexShrink:0,transition:'transform .2s',transform:isOpen?'rotate(180deg)':'none'}}>
                  <polyline points="6,9 12,15 18,9"/>
                </svg>
              </div>
            );
          }

          /* Sub-items — show based on which group they belong to */
          if (item.sub) {
            const isMarketing = item.groupKey === 'marketing';
            const isOpen      = isMarketing ? marketingOpen : laporanOpen;
            if (!isOpen && !collapsed) return null;
            return (
              <div key={item.path}
                className={`nav-item${location.pathname === item.path ? ' active' : ''}${collapsed ? ' nav-item-collapsed' : ' nav-item-sub'}`}
                onClick={() => goTo(item.path)}
                title={item.label}>
                {collapsed
                  ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}>
                      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none"/>
                    </svg>
                  : <><span className="nav-sub-dot"/>{item.label}</>
                }
              </div>
            );
          }

          /* Regular nav item */
          const isActive = location.pathname === item.path;
          const isJurnal = item.path === '/jurnal/isi';
          return (
            <div key={item.path}
              className={`nav-item${isActive ? ' active' : ''}${collapsed ? ' nav-item-collapsed' : ''}${isJurnal && !collapsed ? ' nav-item-accent' : ''}`}
              onClick={() => goTo(item.path)}
              title={collapsed ? item.label : undefined}>
              {ICONS[item.path]}
              {!collapsed && <span style={{flex:1}}>{item.label}</span>}
              {!collapsed && item.path === '/tim' && timAktif.length > 0 && (
                <span className={`nav-badge ${item.badgeType}`}>{timAktif.length}</span>
              )}
            </div>
          );
        })}
      </nav>

      {/* Team preview strip — admin only, hidden when collapsed */}
      {isAdmin && !collapsed && <div style={{
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
          {timAktif.length > 5 && (
            <div onClick={() => goTo('/tim')} style={{
              width: 28, height: 28, borderRadius: 8,
              background: 'var(--surface-2)', color: 'var(--text-3)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 9, fontWeight: 700, cursor: 'pointer',
              border: '1px solid var(--border)',
            }}>
              +{timAktif.length - 5}
            </div>
          )}
        </div>
      </div>}

      {/* Footer user */}
      <div className="sidebar-footer">
        {collapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
            <div className="user-avatar" onClick={() => goTo('/profil')}
              style={{ cursor: 'pointer' }} title={user?.nama || 'Profil'}>
              {user?.nama?.split(' ').slice(0,2).map(w=>w[0]).join('') || '?'}
            </div>
            <button onClick={() => { logout(); goTo('/login'); }} title="Keluar"
              style={{
                width:26, height:26, borderRadius:7, border:'1px solid var(--border-2)',
                background:'var(--surface-2)', cursor:'pointer',
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
        ) : (
          <div className="user-row">
            <div className="user-avatar" onClick={() => goTo('/profil')}
              style={{ cursor: 'pointer' }} title="Buka profil">
              {user?.nama?.split(' ').slice(0,2).map(w=>w[0]).join('') || '?'}
            </div>
            <div style={{ flex: 1, minWidth: 0, cursor: 'pointer' }} onClick={() => goTo('/profil')}>
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
        )}

      </div>
      </div>{/* end sidebar-scroll */}
    </aside>
  );
}
