import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import './index.css';
import Layout from './components/Layout';
import Dashboard from './pages/Dashboard';
import Tim from './pages/Tim';
import { Modul, Jurnal, SOP, Reward, Workshop, Kader, SKB, OneOnOne } from './pages/Pages';
import { PageFormJurnal, PageFormProfiling } from './pages/FormPages';

function AppRoutes() {
  const location = useLocation();
  return (
    <Layout path={location.pathname}>
      <Routes>
        <Route path="/"                element={<Dashboard />} />
        <Route path="/tim"             element={<Tim />} />
        <Route path="/modul"           element={<Modul />} />
        <Route path="/jurnal"          element={<Jurnal />} />
        <Route path="/jurnal/isi"      element={<PageFormJurnal />} />
        <Route path="/profiling"       element={<PageFormProfiling />} />
        <Route path="/sop"             element={<SOP />} />
        <Route path="/reward"          element={<Reward />} />
        <Route path="/workshop"        element={<Workshop />} />
        <Route path="/kader"           element={<Kader />} />
        <Route path="/skb"             element={<SKB />} />
        <Route path="/1on1"            element={<OneOnOne />} />
      </Routes>
    </Layout>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  );
}
