import { useState, useEffect } from 'react';

const STATUS_BADGE = {
  diajukan: { text: 'MENUNGGU', color: 'var(--rpg-gold)' },
  selesai:  { text: 'SELESAI', color: 'var(--rpg-success)' },
};

// Kartu quest — dua variant:
// - "compact" (default): dipakai di sidebar Character Sheet
// - "full": baris list di Quest Board (ikon tipe quest + meta + aksi)
//   status: 'aktif' | 'diajukan' | 'ditolak' | 'selesai'
//   onComplete → tombol "Selesai" (atau "Ajukan lagi" bila ditolak); onProgress(pct) → slider progres
export default function QuestCard({
  variant = 'compact', title, xpReward, dueLabel, progressPct, warn, icon, status = 'aktif',
  onComplete, onProgress, busy = false,
}) {
  const [pct, setPct] = useState(progressPct ?? 0);
  useEffect(() => { setPct(progressPct ?? 0); }, [progressPct]);

  if (variant === 'full') {
    const badge = STATUS_BADGE[status];
    const bisaUbah = status === 'aktif' || status === 'ditolak';
    return (
      <div className="rpg-pixbox" style={{
        background: 'var(--rpg-bg-2)',
        border: `2px solid ${warn ? 'var(--rpg-warn)' : 'var(--rpg-line)'}`,
        boxShadow: 'inset 2px 2px 0 rgba(159,227,255,.35), inset -2px -2px 0 rgba(0,0,0,.4), 3px 3px 0 var(--rpg-bg-3)',
        padding: '.9rem 1.1rem',
        display: 'grid',
        gridTemplateColumns: '34px minmax(0,1fr) auto',
        gap: '.9rem',
        alignItems: 'center',
      }}>
        <div style={{
          width: 34, height: 34, flex: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'var(--rpg-bg-3)', border: `2px solid ${warn ? 'var(--rpg-warn)' : 'var(--rpg-line-dim)'}`,
        }}>
          {icon}
        </div>

        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--rpg-font-body)', fontWeight: 600, fontSize: '.95rem', color: 'var(--rpg-ink)' }}>
            {title}
          </div>
          <div style={{
            fontFamily: 'var(--rpg-font-hud)', fontSize: '.98rem', color: 'var(--rpg-ink-faint)',
            marginTop: '.25rem', display: 'flex', gap: '.9rem', flexWrap: 'wrap',
          }}>
            <span style={{ color: warn ? 'var(--rpg-warn)' : 'var(--rpg-ink-faint)' }}>{dueLabel}</span>
          </div>
          {typeof progressPct === 'number' && (
            onProgress && bisaUbah ? (
              <input
                type="range" min="0" max="100" step="5" value={pct} disabled={busy}
                aria-label={`Progres ${title}`}
                onChange={e => setPct(Number(e.target.value))}
                onPointerUp={() => pct !== progressPct && onProgress(pct)}
                onKeyUp={() => pct !== progressPct && onProgress(pct)}
                style={{ display: 'block', width: '100%', maxWidth: 320, marginTop: '.45rem', accentColor: 'var(--rpg-gold)', cursor: 'pointer' }}
              />
            ) : (
              <div style={{ height: 6, background: 'var(--rpg-bg)', border: '1px solid var(--rpg-line-dim)', marginTop: '.5rem', maxWidth: 320, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--rpg-gold)' }} />
              </div>
            )
          )}
        </div>

        <div style={{ textAlign: 'right', flex: 'none', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '.4rem' }}>
          <div style={{ fontFamily: 'var(--rpg-font-hud)', fontSize: '1.2rem', color: 'var(--rpg-success)' }}>+{xpReward} XP</div>
          {typeof progressPct === 'number' && (
            <div style={{ fontFamily: 'var(--rpg-font-hud)', fontSize: '.95rem', color: 'var(--rpg-ink-faint)' }}>{pct}%</div>
          )}
          {badge && (
            <span style={{ fontFamily: 'var(--rpg-font-display)', fontSize: '.55rem', color: badge.color, border: `2px solid ${badge.color}`, padding: '.25rem .45rem' }}>
              {badge.text}
            </span>
          )}
          {onComplete && bisaUbah && (
            <button onClick={onComplete} disabled={busy} style={{
              fontFamily: 'var(--rpg-font-hud)', fontSize: '.95rem', cursor: busy ? 'wait' : 'pointer',
              background: 'var(--rpg-gold)', color: '#1a1206', border: 'none', padding: '.2rem .7rem', opacity: busy ? .6 : 1,
            }}>
              {status === 'ditolak' ? 'Ajukan lagi' : 'Selesai'}
            </button>
          )}
        </div>
      </div>
    );
  }

  // variant="compact"
  return (
    <div style={{
      border: '2px solid var(--rpg-line-dim)', padding: '.8rem .9rem',
      background: 'var(--rpg-bg-3)', marginBottom: '.75rem',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.6rem', alignItems: 'flex-start' }}>
        <span style={{ fontFamily: 'var(--rpg-font-hud)', fontSize: '1.05rem', color: 'var(--rpg-ink)', lineHeight: 1.3 }}>
          {title}
        </span>
        <span style={{ flex: 'none', fontFamily: 'var(--rpg-font-hud)', fontSize: '1.05rem', color: 'var(--rpg-success)', whiteSpace: 'nowrap' }}>
          +{xpReward} XP
        </span>
      </div>
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '.5rem',
        fontFamily: 'var(--rpg-font-hud)', fontSize: '.92rem',
        color: warn ? 'var(--rpg-warn)' : 'var(--rpg-ink-faint)',
      }}>
        <span>{dueLabel}</span>
        {typeof progressPct === 'number' && <span>{progressPct}%</span>}
      </div>
      {typeof progressPct === 'number' && (
        <div style={{ height: 6, background: 'var(--rpg-bg)', border: '1px solid var(--rpg-line-dim)', marginTop: '.5rem' }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: 'var(--rpg-gold)' }} />
        </div>
      )}
    </div>
  );
}
