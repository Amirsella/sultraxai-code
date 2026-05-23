import React, { useState, useEffect, useRef } from 'react';

const API_BASE = 'http://38.180.137.122:8000';

const SUGGESTIONS = [
  'How do I set a price alert?',
  'What is The Zone?',
  'How does the Scanner work?',
  'How do I add more assets?',
  'How do I change my password?',
];

function TypingDots() {
  return (
    <div style={{ display: 'flex', gap: '4px', alignItems: 'center', padding: '12px 14px' }}>
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          width: '6px', height: '6px', borderRadius: '50%', background: '#444',
          animation: `dotBounce 1.2s ${i * 0.2}s ease-in-out infinite`,
        }} />
      ))}
    </div>
  );
}

export default function SupportBot() {
  const [open, setOpen]       = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: "Hi! I'm the SultraxAI assistant.\nAsk me anything about the platform." }
  ]);
  const [input, setInput]     = useState('');
  const [loading, setLoading] = useState(false);
  const [unread, setUnread]   = useState(0);
  const bottomRef             = useRef(null);
  const inputRef              = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 150);
    }
  }, [open]);

  const send = async (text) => {
    const msg = (text || input).trim();
    if (!msg || loading) return;
    setInput('');

    const userMsg = { role: 'user', content: msg };
    const next = [...messages, userMsg];
    setMessages(next);
    setLoading(true);

    try {
      const res = await fetch(`${API_BASE}/api/support/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next }),
      });
      const data = await res.json();
      const reply = data.reply || "Sorry, I couldn't get a response. Please try again.";
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
      if (!open) setUnread(u => u + 1);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "Connection error. Please check your network and try again." }]);
    }
    setLoading(false);
  };

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const showSuggestions = messages.length <= 1;

  return (
    <div style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999, display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '12px' }}>
      <style>{`
        @keyframes dotBounce { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
        @keyframes chatSlide { from{opacity:0;transform:translateY(16px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
      `}</style>

      {/* Chat panel */}
      {open && (
        <div style={{ width: '360px', height: '520px', background: '#0a0a0a', border: '1px solid #1a1a1a', borderRadius: '18px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 60px rgba(0,0,0,0.6)', animation: 'chatSlide 0.2s ease both' }}>

          {/* Header */}
          <div style={{ padding: '16px 18px', borderBottom: '1px solid #111', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '8px', background: 'rgba(255,51,51,0.12)', border: '1px solid rgba(255,51,51,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem' }}>✦</div>
              <div>
                <div style={{ fontSize: '0.78rem', fontWeight: '800', color: '#ddd', letterSpacing: '0.05em' }}>SULTRAX SUPPORT</div>
                <div style={{ fontSize: '0.58rem', color: '#44cc44', fontWeight: '600', letterSpacing: '0.04em' }}>● ONLINE</div>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '1.1rem', padding: '4px', lineHeight: 1 }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 14px 4px' }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start', marginBottom: '8px' }}>
                <div style={{
                  maxWidth: '82%',
                  padding: '10px 13px',
                  borderRadius: m.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                  background: m.role === 'user' ? 'rgba(255,51,51,0.15)' : '#111',
                  border: `1px solid ${m.role === 'user' ? 'rgba(255,51,51,0.25)' : '#1a1a1a'}`,
                  fontSize: '0.8rem',
                  color: m.role === 'user' ? '#ffaaaa' : '#ccc',
                  lineHeight: 1.6,
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-word',
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start', marginBottom: '8px' }}>
                <div style={{ background: '#111', border: '1px solid #1a1a1a', borderRadius: '14px 14px 14px 4px' }}>
                  <TypingDots />
                </div>
              </div>
            )}

            {/* Suggested questions */}
            {showSuggestions && !loading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '8px' }}>
                {SUGGESTIONS.map((s, i) => (
                  <button key={i} onClick={() => send(s)}
                    style={{ textAlign: 'left', background: 'transparent', border: '1px solid #1a1a1a', borderRadius: '10px', padding: '8px 12px', color: '#444', fontSize: '0.75rem', cursor: 'pointer', fontFamily: 'inherit', transition: 'border-color 0.15s, color 0.15s' }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = '#2a2a2a'; e.currentTarget.style.color = '#777'; }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = '#1a1a1a'; e.currentTarget.style.color = '#444'; }}>
                    {s}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '12px 14px', borderTop: '1px solid #111', display: 'flex', gap: '8px', alignItems: 'flex-end', flexShrink: 0 }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask anything…"
              rows={1}
              style={{ flex: 1, background: '#111', border: '1px solid #1e1e1e', borderRadius: '10px', color: '#ddd', padding: '9px 12px', fontSize: '0.8rem', outline: 'none', resize: 'none', fontFamily: 'inherit', lineHeight: 1.5, maxHeight: '80px', overflowY: 'auto' }}
            />
            <button onClick={() => send()} disabled={!input.trim() || loading}
              style={{ width: '34px', height: '34px', borderRadius: '9px', background: input.trim() && !loading ? '#ff3333' : '#1a1a1a', border: 'none', color: input.trim() && !loading ? '#fff' : '#333', cursor: input.trim() && !loading ? 'pointer' : 'not-allowed', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'background 0.15s' }}>
              ↑
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '52px', height: '52px', borderRadius: '50%', background: open ? '#1a1a1a' : '#ff3333', border: `1px solid ${open ? '#2a2a2a' : '#ff3333'}`, color: '#fff', cursor: 'pointer', fontSize: open ? '1rem' : '1.3rem', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: open ? 'none' : '0 4px 24px rgba(255,51,51,0.4)', transition: 'all 0.2s', position: 'relative' }}>
        {open ? '✕' : '💬'}
        {unread > 0 && !open && (
          <div style={{ position: 'absolute', top: '-3px', right: '-3px', width: '18px', height: '18px', borderRadius: '50%', background: '#fff', color: '#ff3333', fontSize: '0.6rem', fontWeight: '800', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {unread}
          </div>
        )}
      </button>
    </div>
  );
}
