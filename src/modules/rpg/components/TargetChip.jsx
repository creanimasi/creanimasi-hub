import { STATUS_TARGET } from '../utils/target';

// Lencana status target: teks + bingkai berwarna (warna hanyalah isyarat tambahan).
export default function TargetChip({ status }) {
  const s = STATUS_TARGET[status] || STATUS_TARGET.tanpa_target;
  return (
    <span style={{
      fontFamily: 'var(--rpg-font-hud)', fontSize: '.95rem', lineHeight: 1.4, whiteSpace: 'nowrap', flex: 'none',
      color: s.warna, border: `2px solid ${s.warna}`, padding: '0 .4rem',
    }}>{s.teks}</span>
  );
}
