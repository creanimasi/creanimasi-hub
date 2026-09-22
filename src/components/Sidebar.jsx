import { useContext, useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { TIPE_COLOR } from '../data/tim';
import { useAuth } from '../hooks/useAuth';
import { useTim } from '../hooks/useTim';
import { PresenceContext } from './Layout';
import { api } from '../services/api';

// Daftar nav tunggal — item tanpa pageKey selalu tampil (halaman baseline,
// bisa diakses semua role). Item dengan pageKey difilter lewat page_access
// user (dihitung backend dari role_page_access, lihat Master Data > Hak
// Akses/Role). Label member-friendly ("Grafik Performa", "Riwayat Jurnal")
// ditangani lewat labelMember di item yang sama, bukan array terpisah.
const NAV_ITEMS = [
  { section: 'Utama' },
  { path: '/',              label: 'Dashboard',         badgeType: '' },
  { path: '/ai-assistant',  label: 'AI Assistant',      badgeType: '', pageKey: 'ai-assistant' },
  { path: '/kalender',      label: 'Kalender',          badgeType: '', pageKey: 'kalender' },
  { path: '/modul',         label: 'Modul Belajar',     badgeType: '' },
  { path: '/performa',      label: 'Performa',      labelMember: 'Grafik Performa', badgeType: '' },
  { path: '/profil',        label: 'Profil Saya',       badgeType: '' },
  { section: 'Guild' },
  { path: '/rpg/character',    label: 'Character Sheet',   badgeType: '', pageKey: 'rpg-character' },
  { path: '/rpg/quests',       label: 'Papan Quest',       badgeType: '', pageKey: 'rpg-quests' },
  { path: '/rpg/guild',        label: 'Guild Hall',        badgeType: '', pageKey: 'rpg-guild' },
  { path: '/rpg/achievements', label: 'Pencapaian',        badgeType: '', pageKey: 'rpg-achievements' },
  { path: '/rpg/anggota',      label: 'Pantau Anggota',    badgeType: '', pageKey: 'rpg-pantau' },
  { path: '/rpg/kelola',       label: 'Kelola RPG',        badgeType: '', pageKey: 'rpg-admin' },
  { path: '/rpg/analytics',    label: 'RPG Analytics',     badgeType: '', pageKey: 'rpg-analytics' },
  { section: 'Tim' },
  { path: '/tim',           label: 'Direktori Tim',     badgeType: 'green', pageKey: 'tim' },
  { path: '/master-data',   label: 'Master Data',       badgeType: '', pageKey: 'master-data' },
  { path: '/timeline',      label: 'Papan Timeline',    badgeType: '', pageKey: 'timeline' },
  { path: '/absensi',       label: 'Absensi',           badgeType: '', pageKey: 'absensi' },
  { section: 'Aksi Cepat' },
  { path: '/jurnal/isi',    label: 'Isi Jurnal',        badgeType: 'green' },
  { path: '/jurnal/riwayat',label: 'Riwayat Jurnal',    badgeType: '' },
  { path: '/laporan-admin', label: 'Laporan Mingguan',  badgeType: '', pageKey: 'laporan-admin' },
  { path: '/profiling',     label: 'Form Profiling',    badgeType: '' },
  { section: 'Marketing' },
  { path: '/ads-performance',  label: 'Ads Performance',   badgeType: '', pageKey: 'ads-performance' },
  { path: '/laporan-profit',   label: 'Laporan Profit',    badgeType: '', pageKey: 'laporan-profit' },
  { path: '/laporan-ads-mingguan', label: 'Laporan Ads Mingguan', badgeType: '', pageKey: 'ads-performance' },
  { section: 'Program' },
  { path: '/workshop',      label: 'Workshop',          badgeType: '', pageKey: 'workshop' },
  { path: '/aktivitas',     label: 'Aktivitas Tim',     badgeType: '', pageKey: 'aktivitas-tim' },
  { path: '/skb',           label: 'SKB',       labelMember: 'Ajukan SKB', badgeType: '' },
  { path: '/reward',        label: 'Reward & KPI',      badgeType: '', pageKey: 'reward' },
  { path: '/sop',           label: 'SOP Brief',         badgeType: '' },
  { path: '/kader',         label: 'Kader Potensial',   badgeType: '', pageKey: 'kader' },
  { group: 'Laporan' },
  { path: '/laporan-harian',   label: 'Laporan Harian',        badgeType: '', sub: true, groupKey: 'laporan', pageKey: 'laporan-harian' },
  { path: '/laporan-mentor',   label: 'Lap. Mingguan Mentor',  badgeType: '', sub: true, groupKey: 'laporan', pageKey: 'laporan-mentor' },
  { path: '/laporan-bulanan',  label: 'Laporan Bulanan',       badgeType: '', sub: true, groupKey: 'laporan', pageKey: 'laporan-bulanan' },
];

// Buang judul section/grup yang semua isinya sudah terfilter (mis. role tanpa akses
// laporan tidak boleh melihat judul "Laporan" atau "Marketing" yang kosong).
// Section punya anak = ada item biasa (termasuk sub-item) sebelum section berikutnya;
// grup punya anak = ada sub-item sebelum grup/section berikutnya.
function pruneEmptyHeaders(items) {
  return items.filter((it, i) => {
    if (!it.section && !it.group) return true;
    for (let j = i + 1; j < items.length; j++) {
      const n = items[j];
      if (n.section) return false;
      if (it.group && n.group) return false;
      if (!n.section && !n.group) return true;
    }
    return false;
  });
}

const ICONS = {
  '/':           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>,
  '/tim':        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="9" cy="7" r="3"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><circle cx="18" cy="7" r="2"/><path d="M15 20c0-2.2 1.3-4 3-4.5"/></svg>,
  '/master-data': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/></svg>,
  '/timeline':    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="8" cy="6" r="1.6" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="10" cy="18" r="1.6" fill="currentColor" stroke="none"/></svg>,
  '/tim/kelola': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>,
  '/anggota':    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><circle cx="18" cy="8" r="3"/><path d="M21 21v-1.5a3 3 0 0 0-2-2.83"/></svg>,
  '/akses':      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/><circle cx="12" cy="16" r="1" fill="currentColor"/></svg>,
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
  '/laporan-ads-mingguan': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="14" rx="2"/><path d="M8 21h8M12 18v3"/><polyline points="7,14 10,10 13,12 17,8"/></svg>,
  '/ai-assistant':    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2a7 7 0 0 1 7 7c0 3-1.8 5.6-4.5 6.7V18H9.5v-2.3C6.8 14.6 5 12 5 9a7 7 0 0 1 7-7z"/><path d="M9 21h6M10 17.5c0-1 .5-2 1-2.5M14 17.5c0-1-.5-2-1-2.5"/><circle cx="9.5" cy="9" r="1" fill="currentColor" stroke="none"/><circle cx="14.5" cy="9" r="1" fill="currentColor" stroke="none"/></svg>,
  '/aktivitas':       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/><polyline points="8,14 10,16 14,13"/><path d="M16 16h.01"/></svg>,
  '/rpg/character':    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M5 21c0-4 3-7 7-7s7 3 7 7"/><path d="M12 11v3"/></svg>,
  '/rpg/quests':       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 6h11M9 12h11M9 18h11"/><rect x="3" y="4.5" width="3" height="3"/><rect x="3" y="10.5" width="3" height="3"/><rect x="3" y="16.5" width="3" height="3"/></svg>,
  '/rpg/guild':        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M8 21h8M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></svg>,
  '/rpg/achievements': <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="9" r="6"/><path d="M8.5 14 7 22l5-3 5 3-1.5-8"/></svg>,
  '/rpg/anggota':      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7S1 12 1 12z"/><circle cx="12" cy="12" r="3"/></svg>,
  '/rpg/kelola':       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/><circle cx="9" cy="6" r="2" fill="currentColor"/><circle cx="15" cy="12" r="2" fill="currentColor"/><circle cx="8" cy="18" r="2" fill="currentColor"/></svg>,
  '/rpg/analytics':    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="6" y1="20" x2="6" y2="11"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="18" y1="20" x2="18" y2="14"/></svg>,
  '/profil':          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>,
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
  const LAPORAN_PATHS = ['/laporan-harian', '/laporan-mentor', '/laporan-bulanan'];
  const [laporanOpen, setLaporanOpen] = useState(() => LAPORAN_PATHS.includes(location.pathname));

  // Badge: jurnal belum isi minggu ini (member, hari Kamis-Sabtu)
  const [jurnalBelum, setJurnalBelum] = useState(false);
  useEffect(() => {
    if (!user || isAdmin) return;
    const hari = new Date().getDay();
    if (hari < 4 || hari === 0) return; // hanya Kamis(4), Jumat(5), Sabtu(6)
    api.getJurnal(user.nama).then(res => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const sudah = (res.data || []).some(j => new Date(j.tanggal_jurnal || j.created_at) >= weekAgo);
      setJurnalBelum(!sudah);
    }).catch(() => {});
  }, [user, isAdmin]);

  // Badge: SKB pending (admin = semua yg diajukan, member = milik sendiri yg pending)
  const [skbCount, setSkbCount] = useState(0);
  useEffect(() => {
    if (!user) return;
    api.getSKB().then(res => {
      const all = res.data || [];
      if (isAdmin) {
        setSkbCount(all.filter(s => s.status === 'diajukan').length);
      } else {
        setSkbCount(all.filter(s => s.nama === user.nama && s.status === 'diajukan').length);
      }
    }).catch(() => {});
  }, [user, isAdmin]);

  // Item baseline (tanpa pageKey) selalu tampil. Item dengan pageKey difilter
  // lewat page_access user — dihitung backend dari role_page_access, jadi
  // menu ikut berubah sesuai matriks di Master Data > Hak Akses/Role tanpa
  // perlu kode baru. /laporan-admin dapat pengecualian sama seperti backend
  // (RequirePage di App.jsx): tetap tampil untuk siapa pun divisi timnya "Admin".
  const pageAccess = user?.page_access || [];
  const NAV = pruneEmptyHeaders(
    NAV_ITEMS
      .filter(item => {
        if (item.section || item.group) return true; // header dinilai belakangan (pruneEmptyHeaders)
        if (!item.pageKey) return true; // halaman baseline
        if (pageAccess.includes(item.pageKey)) return true;
        if (item.pageKey === 'laporan-admin' && isAdminDivisi) return true;
        return false;
      })
      .map(item => (item.labelMember && !isAdmin) ? { ...item, label: item.labelMember } : item)
  );

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

          /* Collapsible group header (saat ini hanya "Laporan") */
          if (item.group) {
            const anyActive = LAPORAN_PATHS.includes(location.pathname);
            const label     = item.group;
            const toggle    = () => setLaporanOpen(o => !o);

            if (collapsed) return (
              <div key={`group-${label}`}
                className={`nav-item nav-item-collapsed${anyActive ? ' active' : ''}`}
                title={label} onClick={toggle}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:18,height:18}}>
                  <rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/>
                  <rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>
                </svg>
              </div>
            );
            return (
              <div key={`group-${label}`}
                className={`nav-item${anyActive ? ' active' : ''}`}
                onClick={toggle} style={{ userSelect: 'none' }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:15,height:15,flexShrink:0}}>
                  <rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/>
                  <rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/>
                </svg>
                <span style={{flex:1}}>{label}</span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
                  style={{width:12,height:12,flexShrink:0,transition:'transform .2s',transform:laporanOpen?'rotate(180deg)':'none'}}>
                  <polyline points="6,9 12,15 18,9"/>
                </svg>
              </div>
            );
          }

          /* Sub-items grup Laporan */
          if (item.sub) {
            if (!laporanOpen && !collapsed) return null;
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
          const isActive  = location.pathname === item.path;
          const isJurnal  = item.path === '/jurnal/isi';
          const isSKB     = item.path === '/skb';
          const isTim     = item.path === '/tim';
          const showJurnalBadge = isJurnal && jurnalBelum;
          const showSkbBadge   = isSKB && skbCount > 0;
          return (
            <div key={item.path}
              className={`nav-item${isActive ? ' active' : ''}${collapsed ? ' nav-item-collapsed' : ''}${isJurnal && !collapsed ? ' nav-item-accent' : ''}`}
              onClick={() => goTo(item.path)}
              title={collapsed ? item.label : undefined}>
              {ICONS[item.path]}
              {!collapsed && <span style={{flex:1}}>{item.label}</span>}
              {/* Badge: Tim count */}
              {!collapsed && isTim && timAktif.length > 0 && (
                <span className="nav-badge green">{timAktif.length}</span>
              )}
              {/* Badge: jurnal belum isi */}
              {showJurnalBadge && !collapsed && (
                <span className="nav-badge" style={{background:'rgba(255,82,82,0.15)',color:'var(--red)',borderColor:'rgba(255,82,82,0.25)'}}>!</span>
              )}
              {/* Badge: SKB pending */}
              {showSkbBadge && !collapsed && (
                <span className="nav-badge">{skbCount}</span>
              )}
              {/* Collapsed badge dots */}
              {collapsed && (showJurnalBadge || showSkbBadge) && (
                <span style={{position:'absolute',top:4,right:4,width:7,height:7,borderRadius:'50%',background:'var(--red)',border:'1.5px solid var(--surface)'}}/>
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
