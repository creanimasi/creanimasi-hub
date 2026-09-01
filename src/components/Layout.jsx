import { useState, useEffect, useRef, createContext } from 'react';
import { useNavigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import { useDarkMode } from '../hooks/useDarkMode';
import { useAuth } from '../hooks/useAuth';
import { useTim } from '../hooks/useTim';
import { api } from '../services/api';
import { useNotifications } from '../hooks/useNotifications';
import { usePresence } from '../hooks/usePresence';
import { ToastContext, useToastState } from '../hooks/useToast';

// Context agar komponen lain bisa akses online status
export const PresenceContext = createContext({ onlineUsers: [], isOnline: () => false });

// ── TOAST ────────────────────────────────────────────────────
const TOAST_COLORS = {
  success: { bg: 'var(--green-light, rgba(0,214,143,0.12))', border: 'rgba(0,214,143,0.3)', color: 'var(--green)', icon: '✓' },
  error:   { bg: 'var(--red-light,   rgba(255,82,82,0.12))',  border: 'rgba(255,82,82,0.3)',  color: 'var(--red)',   icon: '✕' },
  info:    { bg: 'var(--blue-light,  rgba(79,195,247,0.12))', border: 'rgba(79,195,247,0.3)', color: 'var(--blue)',  icon: 'ℹ' },
  warning: { bg: 'var(--amber-light, rgba(255,184,48,0.12))', border: 'rgba(255,184,48,0.3)', color: 'var(--amber)', icon: '!' },
};

function ToastContainer({ toasts, removeToast }) {
  if (!toasts.length) return null;
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
    }}>
      {toasts.map(t => {
        const c = TOAST_COLORS[t.type] || TOAST_COLORS.success;
        return (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 10,
            background: 'var(--surface)', border: `1px solid ${c.border}`,
            borderLeft: `3px solid ${c.color}`,
            borderRadius: 10, padding: '10px 14px',
            boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
            fontSize: 13, fontWeight: 500, color: 'var(--text)',
            pointerEvents: 'all', cursor: 'pointer',
            animation: 'toastIn .2s ease',
            maxWidth: 320,
          }} onClick={() => removeToast(t.id)}>
            <span style={{ color: c.color, fontWeight: 700, fontSize: 15, flexShrink: 0 }}>{c.icon}</span>
            <span style={{ flex: 1 }}>{t.message}</span>
          </div>
        );
      })}
      <style>{`@keyframes toastIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
}

const PAGE_TITLES = {
  '/':            'Dashboard',
  '/tim':         'Tim',
  '/anggota':      'Kelola Anggota',
  '/tim/kelola':  'Kelola Tim',
  '/modul':       'Modul Belajar',
  '/jurnal':      'Jurnal Refleksi',
  '/jurnal/isi':     'Isi Jurnal Mingguan',
  '/jurnal/riwayat': 'Riwayat Jurnal',
  '/profil':         'Profil & Pengaturan',
  '/profiling':   'Form Profiling Tim',
  '/sop':         'SOP Brief',
  '/reward':      'Reward & KPI',
  '/workshop':    'Workshop JRUHUB',
  '/skb':         'SKB — Studi Kelayakan Belajar',
  '/1on1':        'Sesi 1-on-1',
  '/kader':       'Kader Potensial',
  '/friday-win':  'Friday Win',
  '/performa':    'Grafik Performa Tim',
  '/laporan-mentor': 'Laporan Mingguan Mentor',
  '/laporan-admin':  'Laporan Mingguan Admin',
  '/laporan-harian': 'Laporan Harian Tim',
  '/aktivitas':   'Aktivitas Tim',
  '/akses':       'Manajemen Akses',
  '/kalender':    'Kalender Kegiatan',
};

function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return { text: 'Selamat malam',  icon: '🌙' };
  if (h < 11) return { text: 'Selamat pagi',   icon: '☀️' };
  if (h < 15) return { text: 'Selamat siang',  icon: '🌤️' };
  if (h < 19) return { text: 'Selamat sore',   icon: '🌅' };
  return              { text: 'Selamat malam',  icon: '🌙' };
}

function getNow() {
  return new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

function ThemeToggle({ dark, toggle }) {
  return (
    <button onClick={toggle} title={dark ? 'Ganti ke mode terang' : 'Ganti ke mode gelap'} style={{
      width: 36, height: 36, borderRadius: 10,
      border: '1px solid var(--border-2)',
      background: 'var(--surface-2)',
      cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: 16, transition: 'background .15s, box-shadow .15s',
      flexShrink: 0,
    }}
      onMouseEnter={e => e.currentTarget.style.boxShadow = '0 0 12px rgba(0,214,143,0.2)'}
      onMouseLeave={e => e.currentTarget.style.boxShadow = ''}
    >
      {dark ? '☀️' : '🌙'}
    </button>
  );
}

function JurnalBanner({ user }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState(null); // null | 'sudah' | 'belum'
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    if (!user) return;
    const hari = new Date().getDay(); // 0=Min, 4=Kam, 5=Jum, 6=Sab
    if (hari < 4 || hari === 0) return; // hanya tampil Kamis-Sabtu
    api.getJurnal(user.nama)
      .then(res => {
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const sudah = (res.data || []).some(j => new Date(j.tanggal_jurnal || j.created_at) >= weekAgo);
        setStatus(sudah ? 'sudah' : 'belum');
      })
      .catch(() => {});
  }, [user]);

  if (!status || status === 'sudah' || dismissed) return null;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 20px',
      background: 'linear-gradient(90deg, var(--amber-light) 0%, var(--surface) 100%)',
      borderBottom: '1px solid rgba(255,180,50,0.25)',
      fontSize: 13,
    }}>
      <span style={{ fontSize: 18, flexShrink: 0 }}>📓</span>
      <div style={{ flex: 1 }}>
        <span style={{ fontWeight: 700, color: 'var(--amber)' }}>Saatnya isi jurnal minggu ini!</span>
        <span style={{ color: 'var(--text-2)', marginLeft: 8 }}>Luangkan 5 menit untuk refleksi sebelum akhir pekan.</span>
      </div>
      <button onClick={() => navigate('/jurnal/isi')}
        style={{ padding: '5px 14px', borderRadius: 8, border: '1px solid var(--amber)',
          background: 'var(--amber-light)', color: 'var(--amber)', fontWeight: 700,
          cursor: 'pointer', fontSize: 12, flexShrink: 0 }}>
        Isi Sekarang →
      </button>
      <button onClick={() => setDismissed(true)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16,
          color: 'var(--text-3)', padding: 4, flexShrink: 0 }}
        title="Tutup">✕</button>
    </div>
  );
}

function NotificationBell({ user }) {
  const navigate = useNavigate();
  const { notifs, unreadCount, readAll } = useNotifications(user);
  const [open, setOpen] = useState(false);
  const ref  = useRef(null);

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleClick = (n) => {
    const read = JSON.parse(localStorage.getItem('hub_notif_read') || '[]');
    localStorage.setItem('hub_notif_read', JSON.stringify([...new Set([...read, n.id])]));
    setOpen(false);
    navigate(n.path);
  };

  return (
    <div ref={ref} style={{ position: 'relative', flexShrink: 0 }}>
      <button onClick={() => { setOpen(o => !o); if (!open) readAll(); }}
        style={{ width:36, height:36, borderRadius:10, border:'1px solid var(--border-2)',
          background:'var(--surface-2)', cursor:'pointer', fontSize:16,
          display:'flex', alignItems:'center', justifyContent:'center', position:'relative' }}>
        🔔
        {unreadCount > 0 && (
          <span style={{ position:'absolute', top:-4, right:-4,
            width:16, height:16, borderRadius:'50%',
            background:'var(--red)', color:'#fff',
            fontSize:9, fontWeight:700,
            display:'flex', alignItems:'center', justifyContent:'center',
            border:'2px solid var(--bg)' }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notif-dropdown">
          <div style={{ padding:'12px 14px 8px', borderBottom:'1px solid var(--border)',
            display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span style={{ fontSize:13, fontWeight:700 }}>Notifikasi</span>
            {unreadCount > 0 && (
              <button onClick={readAll}
                style={{ fontSize:10, color:'var(--green)', background:'none', border:'none',
                  cursor:'pointer', fontWeight:600 }}>Tandai semua dibaca</button>
            )}
          </div>

          {notifs.length === 0 ? (
            <div style={{ padding:'24px 14px', textAlign:'center', fontSize:12, color:'var(--text-3)' }}>
              <div style={{ fontSize:24, marginBottom:8 }}>🎉</div>
              Semua beres! Tidak ada notifikasi baru.
            </div>
          ) : notifs.map(n => (
            <div key={n.id} className={`notif-item ${n.unread ? 'unread' : ''}`}
              onClick={() => handleClick(n)}>
              <span style={{ fontSize:20, flexShrink:0, marginTop:1 }}>{n.icon}</span>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontSize:12, fontWeight: n.unread ? 700 : 500,
                  color: n.urgent ? 'var(--red)' : 'var(--text)', marginBottom:2 }}>
                  {n.title}
                </div>
                {n.body && (
                  <div style={{ fontSize:11, color:'var(--text-2)',
                    overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {n.body}
                  </div>
                )}
                <div style={{ fontSize:10, color:'var(--text-3)', marginTop:3 }}>
                  {new Date(n.time).toLocaleDateString('id-ID',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Layout({ children, path }) {
  const { user }  = useAuth();
  const [dark, toggleDark] = useDarkMode(user?.tema);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem('hub_sidebar_collapsed') === '1'; } catch { return false; }
  });
  const title     = PAGE_TITLES[path] || 'Creanimasi Hub';
  const greeting  = getGreeting();
  const isHome    = path === '/';
  const firstName = user?.nama?.split(' ')[0] || 'Kamu';
  const isAdmin   = user?.role === 'admin';

  const handleToggleCollapse = () => {
    setSidebarCollapsed(c => {
      const next = !c;
      try { localStorage.setItem('hub_sidebar_collapsed', next ? '1' : '0'); } catch {}
      return next;
    });
  };

  // Real-time presence
  const presence  = usePresence(user);
  const tim       = useTim();

  // Toast
  const toast = useToastState();

  return (
    <ToastContext.Provider value={toast}>
    <PresenceContext.Provider value={presence}>
    <div className={`app-layout${sidebarCollapsed ? ' sidebar-collapsed' : ''}`}>
      {/* Overlay untuk mobile */}
      <div className={`sidebar-overlay ${sidebarOpen ? 'mobile-open' : ''}`}
        onClick={() => setSidebarOpen(false)} />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)}
        collapsed={sidebarCollapsed} onToggleCollapse={handleToggleCollapse} />
      <div className="main-area">
        <header className="topbar">
          {/* Hamburger — mobile only */}
          <button className="hamburger no-print" onClick={() => setSidebarOpen(o => !o)}>
            <span /><span /><span />
          </button>

          <div style={{ flex: 1 }}>
            {isHome ? (
              <div>
                <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 1 }}>
                  {greeting.icon} {greeting.text},
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.3px', lineHeight: 1 }}>
                  {firstName}
                  <span style={{ color: 'var(--green)', marginLeft: 4 }}>_</span>
                </div>
              </div>
            ) : (
              <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.2px' }}>{title}</div>
            )}
          </div>

          {/* Status indicator */}
          <div className="topbar-status" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 99,
            background: 'var(--green-light)',
            border: '1px solid rgba(0,214,143,0.2)',
            fontSize: 11, color: 'var(--green)', fontWeight: 600,
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)',
              boxShadow: '0 0 6px var(--green)', animation: 'pulseGlow 2s infinite' }} />
            {presence.onlineUsers.length > 0
              ? `${presence.onlineUsers.length} Online`
              : `${tim.length} Tim`}
          </div>

          <div className="topbar-date" style={{ fontSize: 11, color: 'var(--text-3)', flexShrink: 0 }}>{getNow()}</div>

          <NotificationBell user={user} />
          <ThemeToggle dark={dark} toggle={toggleDark} />
        </header>

        {!isAdmin && <JurnalBanner user={user} />}
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
    </PresenceContext.Provider>
    <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />
    </ToastContext.Provider>
  );
}
