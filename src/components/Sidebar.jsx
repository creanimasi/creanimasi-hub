import { useLocation, useNavigate } from 'react-router-dom';

const NAV = [
  { section: 'Utama' },
  { path: '/',           label: 'Dashboard',         badge: null, badgeType: '' },
  { path: '/tim',        label: 'Tim',                badge: 11,   badgeType: 'green' },
  { path: '/modul',      label: 'Modul Belajar',      badge: null, badgeType: '' },
  { path: '/jurnal',     label: 'Jurnal Refleksi',    badge: 3,    badgeType: 'red' },
  { section: 'Form' },
  { path: '/jurnal/isi', label: 'Isi Jurnal Mingguan',badge: null, badgeType: '' },
  { path: '/profiling',  label: 'Form Profiling Tim', badge: null, badgeType: '' },
  { section: 'Operasional' },
  { path: '/sop',        label: 'SOP Brief',          badge: null, badgeType: '' },
  { path: '/reward',     label: 'Reward & KPI',       badge: null, badgeType: '' },
  { path: '/workshop',   label: 'Workshop JRUHUB',    badge: null, badgeType: '' },
  { section: 'Pengembangan' },
  { path: '/skb',        label: 'SKB',                badge: null, badgeType: '' },
  { path: '/1on1',       label: 'Sesi 1-on-1',        badge: 3,    badgeType: 'red' },
  { path: '/kader',      label: 'Kader Potensial',    badge: null, badgeType: '' },
];

const ICONS = {
  '/':           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
  '/tim':        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="7" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="18" cy="7" r="2"/><path d="M15 20c0-2.2 1.3-4 3-4.5"/></svg>,
  '/modul':      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  '/jurnal':     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  '/jurnal/isi': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/></svg>,
  '/profiling':  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  '/sop':        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polyline points="9,11 12,14 22,4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
  '/reward':     <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/></svg>,
  '/workshop':   <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c3 3 9 3 12 0v-5"/></svg>,
  '/skb':        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><polyline points="9,15 11,17 15,13"/></svg>,
  '/1on1':       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  '/kader':      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26 12,2"/></svg>,
};

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <div className="sidebar-logo-name">Creanimasi</div>
        <div className="sidebar-logo-sub">Internal Hub</div>
      </div>
      <nav className="sidebar-nav">
        {NAV.map((item, i) =>
          item.section ? (
            <div key={i} className="nav-section">{item.section}</div>
          ) : (
            <div key={item.path}
              className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
              onClick={() => navigate(item.path)}>
              {ICONS[item.path]}
              {item.label}
              {item.badge && (
                <span className={`nav-badge ${item.badgeType}`}>{item.badge}</span>
              )}
            </div>
          )
        )}
      </nav>
      <div className="sidebar-footer">
        <div className="user-row">
          <div className="user-avatar">MK</div>
          <div>
            <div className="user-name">Mas Kholed</div>
            <div className="user-role">Owner / Koordinator</div>
          </div>
        </div>
      </div>
    </aside>
  );
}
