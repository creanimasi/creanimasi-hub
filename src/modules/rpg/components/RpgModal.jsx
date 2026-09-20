import { useEffect } from 'react';

// Modal bergaya RPG: Esc / klik latar menutup; role="dialog" untuk pembaca layar.
export default function RpgModal({ title, onClose, width = 560, children }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }} style={{
      position: 'fixed', inset: 0, background: 'rgba(5,6,16,.72)', zIndex: 1000, display: 'flex',
      alignItems: 'center', justifyContent: 'center', padding: '1rem',
    }}>
      <div role="dialog" aria-modal="true" aria-label={title} className="rpg-pixbox" style={{
        background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)',
        boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.35), inset -2px -2px 0 rgba(0,0,0,.4), 3px 3px 0 var(--rpg-bg-3)',
        width: `min(${width}px, 100%)`, maxHeight: '92vh', overflowY: 'auto', overflowX: 'hidden', padding: '1.3rem', color: 'var(--rpg-ink)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', margin: '0 0 1rem' }}>
          <h2 style={{ fontFamily: 'var(--rpg-font-display)', fontWeight: 400, fontSize: '.8rem', margin: 0, lineHeight: 1.6 }}>{title}</h2>
          <button type="button" onClick={onClose} aria-label="Tutup" style={{
            fontFamily: 'var(--rpg-font-hud)', fontSize: '1.05rem', cursor: 'pointer', flex: 'none',
            background: 'var(--rpg-bg-3)', color: 'var(--rpg-ink-dim)', border: '2px solid var(--rpg-line-dim)', padding: '.15rem .7rem',
          }}>Tutup</button>
        </div>
        {children}
      </div>
    </div>
  );
}
