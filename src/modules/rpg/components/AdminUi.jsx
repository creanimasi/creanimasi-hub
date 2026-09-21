import { useEffect } from 'react';

// Potongan UI bersama halaman admin RPG (Kelola & tab Target). Dipindah apa adanya dari RpgKelolaPage.
export const pixbox = {
  background: 'var(--rpg-bg-2)', border: '2px solid var(--rpg-line)',
  boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.35), inset -2px -2px 0 rgba(0,0,0,.4), 3px 3px 0 var(--rpg-bg-3)',
};
export const hud = { fontFamily: 'var(--rpg-font-hud)' };
export const pesanError = (e) => (e?.message || 'Terjadi kesalahan').replace(/^\d{3}: /, '');

export function Btn({ children, onClick, kind = 'ghost', disabled, type = 'button', small }) {
  const warna = {
    gold:  { background: 'var(--rpg-gold)', color: '#1a1206', border: '2px solid var(--rpg-gold)' },
    ghost: { background: 'var(--rpg-bg-3)', color: 'var(--rpg-ink-dim)', border: '2px solid var(--rpg-line-dim)' },
    ok:    { background: 'var(--rpg-success)', color: '#08240f', border: '2px solid var(--rpg-success)' },
    warn:  { background: 'transparent', color: 'var(--rpg-warn)', border: '2px solid var(--rpg-warn)' },
  }[kind];
  return (
    <button type={type} onClick={onClick} disabled={disabled} style={{
      ...hud, fontSize: small ? '.95rem' : '1.05rem', cursor: disabled ? 'not-allowed' : 'pointer',
      padding: small ? '.2rem .7rem' : '.4rem 1rem', opacity: disabled ? .55 : 1, ...warna,
    }}>{children}</button>
  );
}

export const inputStyle = {
  ...hud, fontSize: '1.05rem', width: '100%', boxSizing: 'border-box', color: 'var(--rpg-ink)',
  background: 'var(--rpg-bg)', border: '2px solid var(--rpg-line-dim)', padding: '.4rem .6rem',
};
// CSS global "input" melebarkan semua input; checkbox harus tetap selebar kotaknya.
export const cbStyle = { width: 'auto', flex: 'none', margin: 0, cursor: 'pointer' };

export function Field({ label, hint, children }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={{ ...hud, fontSize: '1rem', color: 'var(--rpg-ink-dim)', display: 'block', marginBottom: '.25rem' }}>{label}</span>
      {children}
      {hint && <span style={{ ...hud, fontSize: '.9rem', color: 'var(--rpg-ink-faint)', display: 'block', marginTop: '.2rem' }}>{hint}</span>}
    </label>
  );
}

export function Modal({ title, onClose, children }) {
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
        ...pixbox, width: 'min(560px, 100%)', maxHeight: '90vh', overflowY: 'auto', overflowX: 'hidden', padding: '1.3rem', color: 'var(--rpg-ink)',
      }}>
        <h2 style={{ fontFamily: 'var(--rpg-font-display)', fontWeight: 400, fontSize: '.8rem', margin: '0 0 1rem', lineHeight: 1.6 }}>{title}</h2>
        {children}
      </div>
    </div>
  );
}
