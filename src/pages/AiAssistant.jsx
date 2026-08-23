import { useState, useRef, useEffect, useCallback } from 'react';
import { api } from '../services/api';
import { useAuth } from '../hooks/useAuth';

const QUICK = [
  { label: '📋 Kondisi Tim', prompt: 'Rangkum kondisi tim saat ini — siapa yang perlu perhatian?' },
  { label: '📝 Status Jurnal', prompt: 'Siapa yang belum isi jurnal minggu ini dan bagaimana tren skor jurnal tim?' },
  { label: '📊 Performa Ads', prompt: 'Analisis performa Meta Ads bulan ini — CTR, spend, dan rekomendasi.' },
  { label: '⭐ Top Performer', prompt: 'Siapa top performer tim bulan ini berdasarkan semua data yang ada?' },
  { label: '⚠️ At Risk', prompt: 'Anggota mana yang berisiko berdasarkan absensi, jurnal, dan profiling?' },
  { label: '💰 Revenue', prompt: 'Bagaimana revenue dan performa iklan bulan ini dibanding target?' },
];

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: 4, alignItems: 'center', padding: '4px 0' }}>
      {[0,1,2].map(i => (
        <div key={i} style={{
          width: 7, height: 7, borderRadius: '50%', background: '#A78BFA',
          animation: `bounce 1.2s ease-in-out ${i * 0.2}s infinite`,
        }} />
      ))}
      <style>{`@keyframes bounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }`}</style>
    </div>
  );
}

function renderInline(text) {
  const parts = text.split(/(\*\*.*?\*\*)/g);
  return parts.map((p, i) =>
    p.startsWith('**') && p.endsWith('**')
      ? <strong key={i}>{p.slice(2, -2)}</strong>
      : p
  );
}

function MsgBubble({ msg, userInitials = '?' }) {
  const isUser = msg.role === 'user';

  const formatText = (text) => {
    const lines = text.split('\n');
    const result = [];
    let tableLines = [];
    let i = 0;

    const flushTable = () => {
      if (tableLines.length < 2) {
        tableLines.forEach((l, j) => result.push(<div key={`tl-${i}-${j}`} style={{ marginBottom: 1 }}>{renderInline(l)}</div>));
        tableLines = [];
        return;
      }
      const rows = tableLines.filter(l => !l.match(/^\|[-| :]+\|$/));
      result.push(
        <div key={`tbl-${i}`} style={{ overflowX: 'auto', margin: '8px 0' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 12, width: '100%' }}>
            <tbody>
              {rows.map((row, ri) => {
                const cells = row.split('|').filter((_, ci) => ci > 0 && ci < row.split('|').length - 1);
                const Tag = ri === 0 ? 'th' : 'td';
                return (
                  <tr key={ri} style={{ background: ri % 2 === 0 ? 'var(--surface-3, rgba(0,0,0,0.06))' : 'transparent' }}>
                    {cells.map((cell, ci) => (
                      <Tag key={ci} style={{
                        padding: '5px 10px', border: '1px solid var(--border, rgba(0,0,0,0.12))',
                        textAlign: 'left', fontWeight: ri === 0 ? 700 : 400,
                        whiteSpace: ri === 0 ? 'nowrap' : 'normal',
                      }}>{renderInline(cell.trim())}</Tag>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      );
      tableLines = [];
    };

    while (i < lines.length) {
      const line = lines[i];
      if (line.trim().startsWith('|')) {
        tableLines.push(line);
      } else {
        if (tableLines.length) flushTable();
        if (line.match(/^#{1,3} /)) {
          result.push(<div key={i} style={{ fontWeight: 800, fontSize: 14, marginTop: 10, marginBottom: 4 }}>{renderInline(line.replace(/^#+\s*/,''))}</div>);
        } else if (line.startsWith('- ') || line.startsWith('• ') || line.startsWith('* ')) {
          result.push(
            <div key={i} style={{ display: 'flex', gap: 6, paddingLeft: 4, marginBottom: 2 }}>
              <span style={{ color: '#A78BFA', flexShrink: 0 }}>•</span>
              <span>{renderInline(line.slice(2))}</span>
            </div>
          );
        } else if (line.match(/^\d+\./)) {
          result.push(<div key={i} style={{ paddingLeft: 4, marginBottom: 2 }}>{renderInline(line)}</div>);
        } else if (line.trim() === '') {
          result.push(<div key={i} style={{ height: 6 }} />);
        } else {
          result.push(<div key={i} style={{ marginBottom: 1 }}>{renderInline(line)}</div>);
        }
      }
      i++;
    }
    if (tableLines.length) flushTable();
    return result;
  };

  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', flexDirection: isUser ? 'row-reverse' : 'row' }}>
      <div style={{
        width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: isUser ? 13 : 16,
        background: isUser ? 'var(--green)' : 'linear-gradient(135deg, #7C5CFC, #A78BFA)',
        color: '#fff', fontWeight: 700,
      }}>
        {isUser ? userInitials : '✨'}
      </div>
      <div style={{
        maxWidth: '75%', padding: '12px 16px',
        borderRadius: isUser ? '18px 4px 18px 18px' : '4px 18px 18px 18px',
        background: isUser ? 'var(--green)' : 'var(--surface-2)',
        color: isUser ? '#fff' : 'var(--text-1)',
        fontSize: 13, lineHeight: 1.65,
        boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
      }}>
        {isUser ? msg.content : formatText(msg.content)}
        {msg.time && (
          <div style={{ fontSize: 10, color: isUser ? 'rgba(255,255,255,0.6)' : 'var(--text-3)', marginTop: 6, textAlign: 'right' }}>
            {msg.time}
          </div>
        )}
      </div>
    </div>
  );
}

export default function AiAssistant() {
  const { user } = useAuth();
  const userInitials = user?.nama?.split(' ').slice(0, 2).map(w => w[0]).join('') || '?';
  const [pesan, setPesan] = useState('');
  const [chat, setChat] = useState([{
    role: 'assistant',
    content: 'Halo! Saya AI Assistant Creanimasi 🎨\n\nSaya punya akses ke semua data internal — tim, jurnal, absensi, Meta Ads, revenue, reward, SKB, dan profiling.\n\nTanya apapun atau pilih topik cepat di bawah.',
    time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
  }]);
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chat, loading]);

  const kirim = useCallback(async (teks) => {
    const msg = (teks || pesan).trim();
    if (!msg || loading) return;
    setPesan('');
    const time = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const riwayat = chat.slice(-8).map(c => ({ role: c.role, content: c.content }));
    setChat(prev => [...prev, { role: 'user', content: msg, time }]);
    setLoading(true);
    try {
      const r = await api.aiChat(msg, riwayat);
      const replyTime = new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
      setChat(prev => [...prev, { role: 'assistant', content: r.jawaban, time: replyTime }]);
    } catch (e) {
      setChat(prev => [...prev, { role: 'assistant', content: '❌ Gagal terhubung ke AI: ' + e.message, time }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [pesan, chat, loading]);

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); kirim(); }
  };

  const clearChat = () => setChat([{
    role: 'assistant',
    content: 'Chat dibersihkan. Ada yang bisa saya bantu?',
    time: new Date().toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
  }]);

  return (
    <div style={{ height: 'calc(100vh - 60px)', display: 'flex', flexDirection: 'column', maxWidth: 800, margin: '0 auto', padding: '0 16px 16px' }}>

      {/* Header */}
      <div style={{ padding: '20px 0 16px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 44, height: 44, borderRadius: 12, background: 'linear-gradient(135deg, #7C5CFC, #A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: '0 4px 12px rgba(124,92,252,0.3)' }}>✨</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: 18 }}>AI Assistant</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 1 }}>Powered by Groq · Compound Mini · Data real-time</div>
            </div>
          </div>
          <button onClick={clearChat} style={{ padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', cursor: 'pointer', fontSize: 12 }}>
            🗑 Bersihkan
          </button>
        </div>
      </div>

      {/* Quick prompts */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'nowrap', overflowX: 'auto', marginBottom: 12, flexShrink: 0, paddingBottom: 2, WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none', msOverflowStyle: 'none' }}>
        {QUICK.map(q => (
          <button key={q.label} onClick={() => kirim(q.prompt)} disabled={loading}
            style={{ padding: '6px 14px', borderRadius: 20, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontSize: 12, cursor: loading ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s', flexShrink: 0 }}
            onMouseEnter={e => { if (!loading) { e.target.style.borderColor = '#7C5CFC'; e.target.style.color = '#A78BFA'; }}}
            onMouseLeave={e => { e.target.style.borderColor = 'var(--border)'; e.target.style.color = 'var(--text-2)'; }}
          >
            {q.label}
          </button>
        ))}
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16, padding: '16px', background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px 16px 0 0', minHeight: 0 }}>
        {chat.map((c, i) => <MsgBubble key={i} msg={c} userInitials={userInitials} />)}
        {loading && (
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #7C5CFC, #A78BFA)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>✨</div>
            <div style={{ padding: '12px 16px', borderRadius: '4px 18px 18px 18px', background: 'var(--surface-2)' }}>
              <TypingDots />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input bar */}
      <div style={{ flexShrink: 0, background: 'var(--surface)', border: '1px solid var(--border)', borderTop: 'none', borderRadius: '0 0 16px 16px', padding: '12px 14px', display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <textarea
          ref={inputRef}
          value={pesan}
          onChange={e => { setPesan(e.target.value); e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'; }}
          onKeyDown={handleKey}
          placeholder="Tanya apapun tentang tim, ads, jurnal, performa... (Enter untuk kirim)"
          disabled={loading}
          rows={1}
          style={{ flex: 1, padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface-2)', color: 'var(--text-1)', fontSize: 13, outline: 'none', resize: 'none', lineHeight: 1.5, fontFamily: 'inherit', minHeight: 38, maxHeight: 120, overflowY: 'auto' }}
        />
        <button onClick={() => kirim()} disabled={loading || !pesan.trim()}
          style={{ padding: '9px 20px', borderRadius: 10, border: 'none', background: loading || !pesan.trim() ? 'var(--surface-2)' : 'linear-gradient(135deg, #7C5CFC, #A78BFA)', color: loading || !pesan.trim() ? 'var(--text-3)' : '#fff', fontWeight: 700, cursor: loading || !pesan.trim() ? 'not-allowed' : 'pointer', fontSize: 13, transition: 'all 0.2s', flexShrink: 0, height: 38 }}>
          Kirim
        </button>
      </div>
    </div>
  );
}
