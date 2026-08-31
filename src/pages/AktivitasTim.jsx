import { useSearchParams } from 'react-router-dom';
import { FridayWin } from './sections/FridayWin';
import { OneOnOne } from './sections/OneOnOne';
import { Absensi } from './sections/Absensi';
import { Jurnal } from './sections/Jurnal';

const TABS = [
  { key: 'friday-win', label: 'Friday Win' },
  { key: '1on1',       label: 'Sesi 1-on-1' },
  { key: 'absensi',    label: 'Absensi' },
  { key: 'jurnal',     label: 'Jurnal Tim' },
];

export default function AktivitasTim() {
  const [params, setParams] = useSearchParams();
  const activeTab = TABS.some(t => t.key === params.get('tab'))
    ? params.get('tab')
    : 'friday-win';

  const setTab = (key) => setParams({ tab: key }, { replace: true });

  return (
    <div style={{ padding: '24px 20px' }}>
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>🎯 Aktivitas Tim</div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
          Friday Win, Sesi 1-on-1, Absensi, Jurnal
        </div>
      </div>

      {/* Tab bar */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 24,
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 10, padding: 4, width: 'fit-content',
      }}>
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            style={{
              padding: '7px 16px', borderRadius: 7, border: 'none',
              fontSize: 13, fontWeight: 600, cursor: 'pointer',
              transition: 'background .15s, color .15s',
              background: activeTab === tab.key ? 'var(--green)' : 'transparent',
              color: activeTab === tab.key ? '#fff' : 'var(--text-2)',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content — conditional render, tidak mount semua sekaligus */}
      {activeTab === 'friday-win' && <FridayWin />}
      {activeTab === '1on1'       && <OneOnOne />}
      {activeTab === 'absensi'    && <Absensi />}
      {activeTab === 'jurnal'     && <Jurnal />}
    </div>
  );
}
