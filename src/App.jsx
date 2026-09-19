import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './index.css';
import './modules/rpg/styles/rpg-tokens.css'; // token warna/font retro — dipakai tema "retro" & modul RPG
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useTim } from './hooks/useTim';
import Layout from './components/Layout';
import ErrorBoundary from './components/ErrorBoundary';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tim from './pages/Tim';
import MasterData from './pages/MasterData';
import { Modul, Jurnal, SOP, Reward, Workshop, Kader, SKB, OneOnOne, FridayWin, Absensi } from './pages/Pages';
import AktivitasTim from './pages/AktivitasTim';
import { PageFormJurnal, PageFormProfiling, PageRiwayatJurnal } from './pages/FormPages';
import Profil from './pages/Profil';
import Performa from './pages/Performa';
import LaporanMingguan from './pages/LaporanMingguan';
import LaporanAdminMingguan from './pages/LaporanAdminMingguan';
import LaporanHarian from './pages/LaporanHarian';
import LaporanBulanan from './pages/LaporanBulanan';
import AdsPerformance from './pages/AdsPerformance';
import LaporanProfit from './pages/LaporanProfit';
import AiAssistant from './pages/AiAssistant';
import Kalender from './pages/Kalender';
import CharacterSheetPage from './modules/rpg/pages/CharacterSheetPage';
import QuestBoardPage from './modules/rpg/pages/QuestBoardPage';
import GuildHallPage from './modules/rpg/pages/GuildHallPage';
import AchievementsPage from './modules/rpg/pages/AchievementsPage';
import RpgAnalyticsPage from './modules/rpg/pages/admin/RpgAnalyticsPage';

// Gerbang akses generik berbasis page_access (dihitung backend dari
// role_page_access, dibawa lewat /auth/me & /auth/login). Menggantikan
// AdminRoute/AdminOrMarketRoute lama — satu-satunya sisa pengecualian
// non-role-based ada di /laporan-admin (boleh diakses siapa pun yang
// divisi tim-nya "Admin", sama seperti middleware backend-nya).
function RequirePage({ pageKey, children }) {
  const { user } = useAuth();
  const tim = useTim();
  if (user?.page_access?.includes(pageKey)) return children;
  if (pageKey === 'laporan-admin') {
    const isAdminDiv = tim.some(m => m.nama === user?.nama && m.divisi === 'Admin');
    if (isAdminDiv) return children;
  }
  return <Navigate to="/" replace />;
}

function ProtectedRoutes() {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return (
    <div style={{
      minHeight: '100vh', background: 'var(--bg)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 12,
    }}>
      <div style={{ fontSize: 28 }}>🎨</div>
      <div style={{ fontSize: 13, color: 'var(--text-2)' }}>Memuat...</div>
    </div>
  );

  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;

  return (
    <Layout path={location.pathname}>
      <ErrorBoundary resetKey={location.pathname}>
      <Routes>
        {/* Semua role */}
        <Route path="/"             element={<Dashboard />} />
        <Route path="/modul"        element={<Modul />} />
        <Route path="/jurnal/isi"      element={<PageFormJurnal />} />
        <Route path="/jurnal/riwayat"  element={<PageRiwayatJurnal />} />
        <Route path="/profil"          element={<Profil />} />
        <Route path="/profiling"    element={<PageFormProfiling />} />
        <Route path="/sop"          element={<SOP />} />
        <Route path="/skb"          element={<SKB />} />
        <Route path="/performa"     element={<Performa />} />

        {/* Modul RPG — preview, data dummy, belum production-ready */}
        <Route path="/rpg/character" element={<CharacterSheetPage />} />
        <Route path="/rpg/quests"    element={<QuestBoardPage />} />
        <Route path="/rpg/guild"     element={<GuildHallPage />} />
        <Route path="/rpg/achievements" element={<AchievementsPage />} />

        {/* Diatur lewat Master Data > Hak Akses/Role, bukan lagi admin/member biner */}
        <Route path="/tim"          element={<RequirePage pageKey="tim"><Tim /></RequirePage>} />
        <Route path="/master-data"  element={<RequirePage pageKey="master-data"><MasterData /></RequirePage>} />
        <Route path="/jurnal"       element={<RequirePage pageKey="jurnal-admin"><Jurnal /></RequirePage>} />
        <Route path="/kader"        element={<RequirePage pageKey="kader"><Kader /></RequirePage>} />
        <Route path="/reward"       element={<RequirePage pageKey="reward"><Reward /></RequirePage>} />
        <Route path="/1on1"         element={<RequirePage pageKey="sesi-1on1"><OneOnOne /></RequirePage>} />
        <Route path="/workshop"     element={<RequirePage pageKey="workshop"><Workshop /></RequirePage>} />
        <Route path="/absensi"      element={<RequirePage pageKey="absensi"><Absensi /></RequirePage>} />
        <Route path="/friday-win"   element={<RequirePage pageKey="friday-win"><FridayWin /></RequirePage>} />
        <Route path="/aktivitas"    element={<RequirePage pageKey="aktivitas-tim"><AktivitasTim /></RequirePage>} />
        <Route path="/laporan-mentor"   element={<RequirePage pageKey="laporan-mentor"><LaporanMingguan /></RequirePage>} />
        <Route path="/laporan-admin"    element={<RequirePage pageKey="laporan-admin"><LaporanAdminMingguan /></RequirePage>} />
        <Route path="/laporan-harian"    element={<RequirePage pageKey="laporan-harian"><LaporanHarian /></RequirePage>} />
        <Route path="/laporan-bulanan"   element={<RequirePage pageKey="laporan-bulanan"><LaporanBulanan /></RequirePage>} />
        <Route path="/ads-performance"    element={<RequirePage pageKey="ads-performance"><AdsPerformance /></RequirePage>} />
        <Route path="/laporan-profit"     element={<RequirePage pageKey="laporan-profit"><LaporanProfit /></RequirePage>} />
        <Route path="/ai-assistant"       element={<RequirePage pageKey="ai-assistant"><AiAssistant /></RequirePage>} />
        <Route path="/kalender"     element={<RequirePage pageKey="kalender"><Kalender /></RequirePage>} />
        <Route path="/rpg/analytics" element={<RequirePage pageKey="rpg-analytics"><RpgAnalyticsPage /></RequirePage>} />

        <Route path="*"             element={<Navigate to="/" replace />} />
      </Routes>
      </ErrorBoundary>
    </Layout>
  );
}

function AppRoutes() {
  const { user } = useAuth();
  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/*"     element={<ProtectedRoutes />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
