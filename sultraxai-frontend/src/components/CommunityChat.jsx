import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';

const WS_BASE = 'ws://38.180.137.122:8000';

const ROOMS = [
  { id: 'crypto', label: 'Crypto', color: '#f7931a' },
  { id: 'stocks', label: 'Stocks', color: '#44cc44' },
];

const AVATAR_COLORS = ['#e05252','#e08844','#d4c244','#52b852','#44a8cc','#7c6cd4','#cc52a8','#52ccaa'];

function avatarColor(name) {
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
}

function renderText(text, roomColor, myUsername) {
  const parts = text.split(/(@\w+)/g);
  return parts.map((part, i) => {
    if (/^@\w+$/.test(part)) {
      const isMe = myUsername && part.slice(1).toLowerCase() === myUsername.toLowerCase();
      return (
        <span key={i} style={{
          color: isMe ? '#fff' : roomColor,
          background: isMe ? roomColor + '44' : roomColor + '18',
          borderRadius: '4px', padding: '0 3px', fontWeight: '700',
        }}>
          {part}
        </span>
      );
    }
    return part;
  });
}

export default function CommunityChat({ userId }) {
  const [open, setOpen]           = useState(false);
  const [room, setRoom]           = useState('crypto');
  const [dropdown, setDropdown]   = useState(false);
  const [messages, setMessages]   = useState({ crypto: [], stocks: [] });
  const [input, setInput]         = useState('');
  const [connected, setConnected] = useState(false);
  const [unread, setUnread]       = useState(0);
  const [chatError, setChatError] = useState('');
  const [mentionQuery, setMentionQuery] = useState(null); // null = closed, '' = show all
  const [mentionIndex, setMentionIndex] = useState(0);

  const wsRef        = useRef(null);
  const bottomRef    = useRef(null);
  const dropRef      = useRef(null);
  const inputRef     = useRef(null);
  const myUsernameRef = useRef('');
  const openRef      = useRef(open);
  const roomRef      = useRef(room);
  openRef.current = open;
  roomRef.current = room;

  // Close room dropdown on outside click
  useEffect(() => {
    if (!dropdown) return;
    const h = (e) => { if (dropRef.current && !dropRef.current.contains(e.target)) setDropdown(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [dropdown]);

  const connect = useCallback((targetRoom) => {
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }
    const ws = new WebSocket(`${WS_BASE}/ws/chat?user_id=${userId}&room=${targetRoom}`);
    ws.onopen  = () => setConnected(true);
    ws.onclose = () => { setConnected(false); setTimeout(() => connect(roomRef.current), 3000); };
    ws.onerror = () => ws.close();
    ws.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === 'history') {
        setMessages(prev => ({ ...prev, [targetRoom]: data.messages }));
        if (!myUsernameRef.current) {
          const mine = data.messages.find(m => String(m.user_id) === String(userId));
          if (mine) myUsernameRef.current = mine.first_name;
        }
      } else if (data.type === 'message') {
        if (String(data.user_id) === String(userId) && !myUsernameRef.current)
          myUsernameRef.current = data.first_name;
        setMessages(prev => ({ ...prev, [targetRoom]: [...prev[targetRoom], data] }));
        const mentioned = myUsernameRef.current &&
          data.message.toLowerCase().includes(`@${myUsernameRef.current.toLowerCase()}`);
        if (mentioned || !openRef.current || roomRef.current !== targetRoom)
          setUnread(n => n + 1);
      } else if (data.type === 'error') {
        setChatError(data.message);
        setTimeout(() => setChatError(''), 4000);
      }
    };
    wsRef.current = ws;
  }, [userId]);

  useEffect(() => {
    connect('crypto');
    return () => { if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); } };
  }, [connect]);

  const switchRoom = (newRoom) => {
    setDropdown(false);
    if (newRoom === room) return;
    setRoom(newRoom);
    connect(newRoom);
  };

  useEffect(() => {
    if (open) { setUnread(0); setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 60); }
  }, [open, room]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  // Build list of mentionable users from all loaded messages
  const mentionableUsers = useMemo(() => {
    const seen = new Set();
    const list = [];
    for (const msgs of Object.values(messages)) {
      for (const m of msgs) {
        if (String(m.user_id) !== String(userId) && m.first_name && !seen.has(m.first_name)) {
          seen.add(m.first_name);
          list.push(m.first_name);
        }
      }
    }
    return list;
  }, [messages, userId]);

  const filteredMentions = mentionQuery !== null
    ? mentionableUsers.filter(u => u.toLowerCase().startsWith(mentionQuery.toLowerCase()))
    : [];

  const onInputChange = (e) => {
    const val = e.target.value;
    setInput(val);
    const cursor = e.target.selectionStart;
    const match = val.slice(0, cursor).match(/@(\w*)$/);
    if (match) { setMentionQuery(match[1]); setMentionIndex(0); }
    else setMentionQuery(null);
  };

  const insertMention = (username) => {
    const cursor = inputRef.current?.selectionStart ?? input.length;
    const replaced = input.slice(0, cursor).replace(/@(\w*)$/, `@${username} `);
    setInput(replaced + input.slice(cursor));
    setMentionQuery(null);
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const send = () => {
    const text = input.trim();
    if (!text || wsRef.current?.readyState !== WebSocket.OPEN) return;
    wsRef.current.send(JSON.stringify({ message: text }));
    setInput('');
    setMentionQuery(null);
  };

  const onKey = (e) => {
    if (mentionQuery !== null && filteredMentions.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(i => Math.min(i + 1, filteredMentions.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIndex(i => Math.max(i - 1, 0)); return; }
      if (e.key === 'Enter')     { e.preventDefault(); insertMention(filteredMentions[mentionIndex]); return; }
      if (e.key === 'Escape')    { setMentionQuery(null); return; }
    }
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  const activeRoom = ROOMS.find(r => r.id === room);
  const currentMessages = messages[room] || [];

  return (
    <div style={{ position: 'fixed', bottom: '24px', left: '24px', zIndex: 9000, fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}>

      {open && (
        <div style={{ position: 'absolute', bottom: '56px', left: 0, width: '300px', height: '440px', background: '#080808', border: '1px solid #1a1a1a', borderRadius: '16px', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 8px 40px rgba(0,0,0,0.6)' }}>

          {/* Header */}
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #111', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.1em', color: '#fff' }}>COMMUNITY</span>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: connected ? '#44cc44' : '#444', boxShadow: connected ? '0 0 6px #44cc44' : 'none', display: 'inline-block' }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div ref={dropRef} style={{ position: 'relative' }}>
                <button onClick={() => setDropdown(d => !d)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: '6px' }}
                  onMouseEnter={e => e.currentTarget.style.background='#111'}
                  onMouseLeave={e => e.currentTarget.style.background='none'}>
                  <span style={{ fontSize: '0.68rem', fontWeight: '800', color: activeRoom.color, letterSpacing: '0.06em' }}>#{room.toUpperCase()}</span>
                  <span style={{ fontSize: '0.5rem', color: '#444' }}>▼</span>
                </button>
                {dropdown && (
                  <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: '10px', overflow: 'hidden', minWidth: '120px', boxShadow: '0 4px 20px rgba(0,0,0,0.5)', zIndex: 10 }}>
                    {ROOMS.map(r => (
                      <button key={r.id} onClick={() => switchRoom(r.id)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', padding: '9px 14px', background: room === r.id ? r.color + '14' : 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                        onMouseEnter={e => { if (room !== r.id) e.currentTarget.style.background='#161616'; }}
                        onMouseLeave={e => { if (room !== r.id) e.currentTarget.style.background='none'; }}>
                        <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: r.color, flexShrink: 0 }} />
                        <span style={{ fontSize: '0.75rem', fontWeight: '700', color: room === r.id ? r.color : '#888' }}>{r.label}</span>
                        {room === r.id && <span style={{ marginLeft: 'auto', fontSize: '0.6rem', color: r.color }}>✓</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '1.1rem', lineHeight: 1, padding: '2px 4px' }}>×</button>
            </div>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 12px', display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {currentMessages.length === 0 && (
              <div style={{ textAlign: 'center', color: '#2a2a2a', fontSize: '0.75rem', marginTop: '40px' }}>No messages in #{room} yet.</div>
            )}
            {currentMessages.map((m, i) => {
              const isMe = String(m.user_id) === String(userId);
              const color = isMe ? activeRoom.color : avatarColor(m.first_name);
              const isMentioned = myUsernameRef.current &&
                m.message.toLowerCase().includes(`@${myUsernameRef.current.toLowerCase()}`);
              return (
                <div key={m.id || i} style={{
                  display: 'flex', alignItems: 'flex-start', gap: '9px', padding: '5px 6px',
                  borderRadius: '8px',
                  background: isMentioned ? activeRoom.color + '14' : 'transparent',
                  borderLeft: isMentioned ? `2px solid ${activeRoom.color}` : '2px solid transparent',
                }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: color + '22', border: `1px solid ${color}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.62rem', fontWeight: '800', color, flexShrink: 0, marginTop: '1px' }}>
                    {(m.first_name || 'U').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ flex: 1, minWidth: 0, lineHeight: 1.5 }}>
                    <span style={{ fontWeight: '700', color: isMe ? activeRoom.color : '#ddd', fontSize: '0.82rem', marginRight: '6px' }}>
                      {m.first_name}
                    </span>
                    <span style={{ color: '#777', fontSize: '0.82rem', wordBreak: 'break-word' }}>
                      {renderText(m.message, activeRoom.color, myUsernameRef.current)}
                    </span>
                  </div>
                </div>
              );
            })}
            <div ref={bottomRef} />
          </div>

          {/* Moderation error */}
          {chatError && (
            <div style={{ margin: '0 12px 6px', padding: '7px 12px', background: 'rgba(255,51,51,0.1)', border: '1px solid rgba(255,51,51,0.25)', borderRadius: '8px', color: '#ff6666', fontSize: '0.72rem', flexShrink: 0 }}>
              {chatError}
            </div>
          )}

          {/* Input + mention dropdown */}
          <div style={{ padding: '10px 12px', borderTop: '1px solid #111', flexShrink: 0, position: 'relative' }}>

            {/* Mention dropdown */}
            {mentionQuery !== null && filteredMentions.length > 0 && (
              <div style={{ position: 'absolute', bottom: '100%', left: '12px', right: '12px', marginBottom: '6px', background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 -4px 20px rgba(0,0,0,0.5)', zIndex: 10, maxHeight: '160px', overflowY: 'auto' }}>
                {filteredMentions.map((u, idx) => (
                  <button key={u} onMouseDown={e => { e.preventDefault(); insertMention(u); }}
                    style={{ display: 'flex', alignItems: 'center', gap: '9px', width: '100%', padding: '8px 12px', background: idx === mentionIndex ? activeRoom.color + '18' : 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}
                    onMouseEnter={() => setMentionIndex(idx)}>
                    <div style={{ width: '22px', height: '22px', borderRadius: '50%', background: avatarColor(u) + '33', border: `1px solid ${avatarColor(u)}55`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.58rem', fontWeight: '800', color: avatarColor(u), flexShrink: 0 }}>
                      {u.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ fontSize: '0.8rem', fontWeight: '700', color: idx === mentionIndex ? activeRoom.color : '#888' }}>
                      @{u}
                    </span>
                  </button>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', gap: '8px' }}>
              <input
                ref={inputRef}
                value={input} onChange={onInputChange} onKeyDown={onKey}
                placeholder={`Message #${room}... (@ to mention)`} maxLength={500}
                style={{ flex: 1, background: '#111', border: '1px solid #1e1e1e', borderRadius: '10px', color: '#fff', padding: '8px 12px', fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit' }}
              />
              <button onClick={send} disabled={!input.trim() || !connected}
                style={{ background: input.trim() && connected ? activeRoom.color : '#111', border: 'none', borderRadius: '10px', color: input.trim() && connected ? '#fff' : '#333', width: '36px', cursor: input.trim() && connected ? 'pointer' : 'default', fontSize: '1rem', transition: 'all 0.15s', flexShrink: 0 }}>
                ↑
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button onClick={() => setOpen(o => !o)}
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
