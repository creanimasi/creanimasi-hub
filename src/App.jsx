import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import './index.css';
import { AuthProvider, useAuth } from './hooks/useAuth';
import { useTim } from './hooks/useTim';
import Layout from './components/Layout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Tim from './pages/Tim';
import ManajemenTim from './pages/ManajemenTim';
import KelolAnggota from './pages/KelolAnggota';
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

function AdminRoute({ children }) {
  const { user } = useAuth();
  if (user?.role !== 'admin') return <Navigate to="/" replace />;
  return children;
}

function AdminOrMarketRoute({ children }) {
  const { user } = useAuth();
  const tim = useTim();
  const isAdminDiv = tim.some(m => m.nama === user?.nama && m.divisi === 'Admin');
  if (user?.role !== 'admin' && !isAdminDiv) return <Navigate to="/" replace />;
  return children;
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

        {/* Admin only */}
        <Route path="/tim"          element={<AdminRoute><Tim /></AdminRoute>} />
        <Route path="/anggota"      element={<AdminRoute><KelolAnggota /></AdminRoute>} />
        <Route path="/tim/kelola"   element={<AdminRoute><ManajemenTim /></AdminRoute>} />
        <Route path="/jurnal"       element={<AdminRoute><Jurnal /></AdminRoute>} />
        <Route path="/kader"        element={<AdminRoute><Kader /></AdminRoute>} />
        <Route path="/reward"       element={<AdminRoute><Reward /></AdminRoute>} />
        <Route path="/1on1"         element={<AdminRoute><OneOnOne /></AdminRoute>} />
        <Route path="/workshop"     element={<AdminRoute><Workshop /></AdminRoute>} />
        <Route path="/absensi"      element={<AdminRoute><Absensi /></AdminRoute>} />
        <Route path="/friday-win"   element={<AdminRoute><FridayWin /></AdminRoute>} />
        <Route path="/aktivitas"    element={<AdminRoute><AktivitasTim /></AdminRoute>} />
        <Route path="/laporan-mentor"   element={<AdminRoute><LaporanMingguan /></AdminRoute>} />
        <Route path="/laporan-admin"    element={<AdminOrMarketRoute><LaporanAdminMingguan /></AdminOrMarketRoute>} />
        <Route path="/laporan-harian"    element={<AdminRoute><LaporanHarian /></AdminRoute>} />
        <Route path="/laporan-bulanan"   element={<AdminRoute><LaporanBulanan /></AdminRoute>} />
        <Route path="/ads-performance"    element={<AdminRoute><AdsPerformance /></AdminRoute>} />
        <Route path="/laporan-profit"     element={<AdminRoute><LaporanProfit /></AdminRoute>} />
        <Route path="/ai-assistant"       element={<AdminRoute><AiAssistant /></AdminRoute>} />
        <Route path="/kalender"     element={<AdminRoute><Kalender /></AdminRoute>} />

        <Route path="*"             element={<Navigate to="/" replace />} />
      </Routes>
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
