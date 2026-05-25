import React, { useState, useEffect, useRef, useCallback } from 'react';

const WS_BASE = 'ws://38.180.137.122:8000';

const ROOMS = [
  { id: 'crypto', label: 'Crypto', color: '#f7931a' },
  { id: 'stocks', label: 'Stocks', color: '#44cc44' },
];

function fmtTime(iso) {
  try { return new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }); }
  catch { return ''; }
}

export default function CommunityChat({ userId }) {
  const [open, setOpen]       = useState(false);
  const [room, setRoom]       = useState('crypto');
  const [messages, setMessages] = useState({ crypto: [], stocks: [] });
  const [input, setInput]     = useState('');
  const [connected, setConnected] = useState(false);
  const [unread, setUnread]   = useState(0);
  const wsRef    = useRef(null);
  const bottomRef = useRef(null);
  const openRef  = useRef(open);
  const roomRef  = useRef(room);
  openRef.current = open;
  roomRef.current = room;

  const connect = useCallback((targetRoom) => {
    if (wsRef.current) {
      wsRef.current.onclose = null;
      wsRef.current.close();
    }
    const ws = new WebSocket(
      `${WS_BASE}/ws/chat?user_id=${userId}&room=${targetRoom}`
    );
    ws.onopen  = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(() => connect(roomRef.current), 3000);
    };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'history') {
        setMessages(prev => ({ ...prev, [targetRoom]: data.messages }));
      } else if (data.type === 'message') {
        setMessages(prev => ({ ...prev, [targetRoom]: [...prev[targetRoom], data] }));
        if (!openRef.current || roomRef.current !== targetRoom)
          setUnread(n => n + 1);
      }
    };
    wsRef.current = ws;
  }, [userId]);

  useEffect(() => {
    connect('crypto');
    return () => { if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); } };
  }, [connect]);

  const switchRoom = (newRoom) => {
    if (newRoom === room) return;
    setRoom(newRoom);
    connect(newRoom);
  };

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60);
    }
  }, [open, room]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = () => {
    const text = input.trim();
    if (!text || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ message: text }));
    setInput('');
  };

  const onKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const activeRoom = ROOMS.find(r => r.id === room);
  const currentMessages = messages[room] || [];

  return (
    <div style={{ position: 'fixed', bottom: '24px', left: '24px', zIndex: 9000, fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>

      {/* Chat panel */}
      {open && (
        <div style={{ position: 'absolute', bottom: '56px', left: 0, width: '320px', height: '460px', background: '#080808', border: '1px solid #1a1a1a', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>

          {/* Header */}
          <div style={{ padding: '10px 14px 0', borderBottom: '1px solid #111', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.1em', color: '#fff' }}>COMMUNITY</span>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: connected ? '#44cc44' : '#444', boxShadow: connected ? '0 0 6px #44cc44' : 'none', display: 'inline-block' }} />
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, padding: '0 4px' }}>×</button>
            </div>

            {/* Room tabs */}
            <div style={{ display: 'flex', gap: '4px', paddingBottom: '0' }}>
              {ROOMS.map(r => (
                <button key={r.id} onClick={() => switchRoom(r.id)}
                  style={{
                    flex: 1, padding: '6px 0', border: 'none', cursor: 'pointer',
                    background: 'transparent', fontFamily: 'inherit',
                    fontSize: '0.7rem', fontWeight: '800', letterSpacing: '0.08em',
                    color: room === r.id ? r.color : '#333',
                    borderBottom: `2px solid ${room === r.id ? r.color : 'transparent'}`,
                    transition: 'all 0.15s', marginBottom: '-1px',
                  }}>
                  {r.label.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {currentMessages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#2a2a2a', fontSize: '0.75rem', marginTop: '40px' }}>
                No messages in #{room} yet.
              </div>
            )}
            {currentMessages.map((m, i) => {
              const isMe = String(m.user_id) === String(userId);
              return (
                <div key={m.id || i} style={{ display: 'flex', flexDirection: isMe ? 'row-reverse' : 'row', alignItems: 'flex-end', gap: '7px' }}>
                  {!isMe && (
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: '#1a1a1a', border: '1px solid #222', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem', fontWeight: '800', color: '#666', flexShrink: 0 }}>
                      {(m.first_name || 'U').charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div style={{ maxWidth: '72%' }}>
                    <div style={{ fontSize: '0.58rem', color: '#444', fontWeight: '700', marginBottom: '3px', paddingLeft: isMe ? 0 : '2px', textAlign: isMe ? 'right' : 'left' }}>{m.first_name}</div>
                    <div style={{
                      background: isMe ? activeRoom.color : '#111',
                      color: '#fff',
                      padding: '7px 11px',
                      borderRadius: isMe ? '12px 12px 3px 12px' : '12px 12px 12px 3px',
                      fontSize: '0.82rem', lineHeight: 1.45, wordBreak: 'break-word'
                    }}>
                      {m.message}
                    </div>
                    <div style={{ fontSize: '0.55rem', color: '#2a2a2a', marginTop: '3px', textAlign: isMe ? 'right' : 'left', paddingLeft: isMe ? 0 : '2px' }}>
                      {fmtTime(m.created_at)}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #111', display: 'flex', gap: '8px', flexShrink: 0 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder={`Message #${room}...`}
              maxLength={500}
              style={{ flex: 1, background: '#111', border: '1px solid #1e1e1e', borderRadius: '10px', color: '#fff', padding: '8px 12px', fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit' }}
            />
            <button
              onClick={send}
              disabled={!input.trim() || !connected}
              style={{ background: input.trim() && connected ? activeRoom.color : '#111', border: 'none', borderRadius: '10px', color: input.trim() && connected ? '#fff' : '#333', width: '36px', cursor: input.trim() && connected ? 'pointer' : 'default', fontSize: '1rem', transition: 'all 0.15s', flexShrink: 0 }}>
              ↑
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        style={{ width: '44px', height: '44px', borderRadius: '50%', background: open ? '#ff3333' : '#0d0d0d', border: `1px solid ${open ? '#ff333360' : '#1e1e1e'}`, color: open ? '#fff' : '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: open ? '0 4px 20px rgba(255,51,51,0.3)' : '0 2px 12px rgba(0,0,0,0.5)', transition: 'all 0.2s', position: 'relative' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        {unread > 0 && !open && (
          <span style={{ position: 'absolute', top: '-4px', right: '-4px', background: '#ff3333', color: '#fff', borderRadius: '50%', width: '18px', height: '18px', fontSize: '0.6rem', fontWeight: '900', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid #020202' }}>
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
    </div>
  );
}
