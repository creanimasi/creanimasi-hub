import Sidebar from './Sidebar';

const PAGE_TITLES = {
  '/':           'Dashboard',
  '/tim':        'Tim',
  '/modul':      'Modul Belajar',
  '/jurnal':     'Jurnal Refleksi',
  '/jurnal/isi': 'Isi Jurnal Mingguan',
  '/profiling':  'Form Profiling Tim',
  '/sop':        'SOP Brief',
  '/reward':     'Reward & KPI',
  '/workshop':   'Workshop JRUHUB',
  '/skb':        'SKB — Studi Kelayakan Belajar',
  '/1on1':       'Sesi 1-on-1',
  '/kader':      'Kader Potensial',
};

function getNow() {
  return new Date().toLocaleDateString('id-ID', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });
}

export default function Layout({ children, path }) {
  const title = PAGE_TITLES[path] || 'Creanimasi Hub';
  return (
    <div className="app-layout">
      <Sidebar />
      <div className="main-area">
        <header className="topbar">
          <span className="topbar-title">{title}</span>
          <span className="topbar-date">{getNow()}</span>
        </header>
        <main className="page-content">
          {children}
        </main>
      </div>
    </div>
  );
}
