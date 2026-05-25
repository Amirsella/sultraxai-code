import React, { useState, useEffect, useCallback, memo } from 'react';
import { ComposableMap, Geographies, Geography } from 'react-simple-maps';

const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json';

// ISO alpha-3 → alpha-2 mapping for the countries we're likely to see
const A3_TO_A2 = {"ISR":"IL","USA":"US","GBR":"GB","DEU":"DE","FRA":"FR","NLD":"NL","CAN":"CA","AUS":"AU","IND":"IN","BRA":"BR","RUS":"RU","CHN":"CN","JPN":"JP","KOR":"KR","ZAF":"ZA","ARG":"AR","MEX":"MX","ITA":"IT","ESP":"ES","CHE":"CH","SWE":"SE","NOR":"NO","DNK":"DK","FIN":"FI","POL":"PL","UKR":"UA","TUR":"TR","SAU":"SA","ARE":"AE","SGP":"SG","HKG":"HK","NZL":"NZ","AUT":"AT","BEL":"BE","PRT":"PT","GRC":"GR","CZE":"CZ","ROU":"RO","HUN":"HU","BGD":"BD","PAK":"PK","EGY":"EG","NGA":"NG","KEN":"KE","MAR":"MA","THA":"TH","VNM":"VN","IDN":"ID","PHL":"PH","MYS":"MY","COL":"CO","CHL":"CL","PER":"PE","VEN":"VE","PRY":"PY","URY":"UY"};

const WorldMap = memo(({ countries }) => {
  const maxCount = Math.max(1, ...Object.values(countries).map(c => c.count));
  return (
    <ComposableMap projectionConfig={{ scale: 140, center: [10, 10] }}
      style={{ width: '100%', height: '100%' }}>
      <Geographies geography={GEO_URL}>
        {({ geographies }) => geographies.map(geo => {
          const a2 = A3_TO_A2[geo.properties.adm0_a3 || geo.id] || geo.id;
          const data = countries[a2];
          const intensity = data ? Math.max(0.15, data.count / maxCount) : 0;
          const fill = data
            ? `rgba(255, ${Math.round(51 + (1 - intensity) * 150)}, 51, ${0.2 + intensity * 0.75})`
            : '#111';
          return (
            <Geography key={geo.rsmKey} geography={geo}
              fill={fill} stroke="#1a1a1a" strokeWidth={0.4}
              style={{ default: { outline: 'none' }, hover: { fill: data ? '#ff6666' : '#1e1e1e', outline: 'none' }, pressed: { outline: 'none' } }} />
          );
        })}
      </Geographies>
    </ComposableMap>
  );
});

const API_BASE = '';

function fmt(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export default function AdminPanel({ onExit }) {
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem('admin_token') || '');
  const [authed, setAuthed] = useState(() => !!sessionStorage.getItem('admin_token'));
  const [keyInput, setKeyInput] = useState('');

  const authH = () => ({ Authorization: `Bearer ${adminToken}` });
  const [keyError, setKeyError] = useState('');
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [deleteMsg, setDeleteMsg] = useState('');

  const [blockedWords, setBlockedWords] = useState([]);
  const [newWord, setNewWord] = useState('');
  const [wordMsg, setWordMsg] = useState('');

  const [usernameBlockedWords, setUsernameBlockedWords] = useState([]);
  const [newUsernameWord, setNewUsernameWord] = useState('');
  const [usernameWordMsg, setUsernameWordMsg] = useState('');

  const [chatRoom, setChatRoom] = useState('crypto');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [onlineStats, setOnlineStats] = useState({ online_5m: 0, online_15m: 0, countries: {} });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users`, { headers: authH() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch {
      setKeyError('Failed to load users. Check server connection.');
    }
    setLoading(false);
  }, [adminToken]);

  const loadWords = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/blocked-words`, { headers: authH() });
      const data = await res.json();
      setBlockedWords(data.words || []);
    } catch {}
  }, [adminToken]);

  const loadChatMessages = useCallback(async (room) => {
    setChatLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/chat-messages?room=${room}&limit=50`, { headers: authH() });
      const data = await res.json();
      setChatMessages(data.messages || []);
    } catch {}
    setChatLoading(false);
  }, [adminToken]);

  const deleteChatMessage = async (id) => {
    await fetch(`${API_BASE}/api/admin/chat-messages/${id}`, { method: 'DELETE', headers: authH() });
    setChatMessages(prev => prev.filter(m => m.id !== id));
  };

  const loadUsernameWords = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/username-blocked-words`, { headers: authH() });
      const data = await res.json();
      setUsernameBlockedWords(data.words || []);
    } catch {}
  }, [adminToken]);

  const addUsernameWord = async () => {
    const w = newUsernameWord.trim().toLowerCase();
    if (!w) return;
    const res = await fetch(`${API_BASE}/api/admin/username-blocked-words`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...authH() },
      body: JSON.stringify({ word: w }),
    });
    const data = await res.json();
    if (res.ok) { setNewUsernameWord(''); loadUsernameWords(); setUsernameWordMsg(`"${w}" added`); }
    else setUsernameWordMsg(data.detail || 'Error');
    setTimeout(() => setUsernameWordMsg(''), 3000);
  };

  const removeUsernameWord = async (word) => {
    await fetch(`${API_BASE}/api/admin/username-blocked-words/${encodeURIComponent(word)}`, { method: 'DELETE', headers: authH() });
    loadUsernameWords();
  };

  const loadStats = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/stats`, { headers: authH() });
      if (res.ok) setOnlineStats(await res.json());
    } catch {}
  }, [adminToken]);

  useEffect(() => {
    if (authed) { load(); loadWords(); loadUsernameWords(); loadChatMessages('crypto'); loadStats(); }
  }, [authed, load, loadWords, loadUsernameWords, loadChatMessages, loadStats]);

  useEffect(() => {
    if (!authed) return;
    const id = setInterval(loadStats, 30000);
    return () => clearInterval(id);
  }, [authed, loadStats]);

  useEffect(() => {
    if (authed) loadChatMessages(chatRoom);
  }, [chatRoom, authed, loadChatMessages]);

  const addWord = async () => {
    const words = newWord.split(/[\n,]+/).map(w => w.trim().toLowerCase()).filter(Boolean);
    if (!words.length) return;
    let added = 0, skipped = 0;
    for (const w of words) {
      const res = await fetch(`${API_BASE}/api/admin/blocked-words`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...authH() },
        body: JSON.stringify({ word: w }),
      });
      if (res.ok) added++; else skipped++;
    }
    setNewWord('');
    loadWords();
    setWordMsg(skipped > 0 ? `${added} added, ${skipped} skipped (duplicates)` : `${added} word${added > 1 ? 's' : ''} added`);
    setTimeout(() => setWordMsg(''), 4000);
  };

  const removeWord = async (word) => {
    await fetch(`${API_BASE}/api/admin/blocked-words/${encodeURIComponent(word)}`, { method: 'DELETE', headers: authH() });
    loadWords();
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setKeyError('');
    try {
      const res = await fetch(`${API_BASE}/api/admin/auth`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: keyInput }),
      });
      if (!res.ok) { setKeyError('Invalid admin key.'); return; }
      const { token } = await res.json();
      sessionStorage.setItem('admin_token', token);
      setAdminToken(token);
      setAuthed(true);
    } catch {
      setKeyError('Connection error.');
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${id}`, { method: 'DELETE', headers: authH() });
      if (!res.ok) throw new Error();
      setDeleteMsg(`User #${id} deleted.`);
      setConfirmDelete(null);
      setExpanded(null);
      setTimeout(() => setDeleteMsg(''), 3000);
      load();
    } catch {
      setDeleteMsg('Delete failed.');
    }
  };

  const handleGrantSub = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/grant-subscription`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authH() },
        body: JSON.stringify({ user_id: id }),
      });
      if (!res.ok) throw new Error();
      setDeleteMsg(`Subscription granted to user #${id}.`);
      setTimeout(() => setDeleteMsg(''), 3000);
      load();
    } catch {
      setDeleteMsg('Grant failed.');
    }
  };

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    return !q || [u.first_name, u.full_name, u.email, u.phone, String(u.id)]
      .some(v => (v || '').toLowerCase().includes(q));
  });

  if (!authed) {
    return (
      <div style={{ minHeight: '100vh', background: '#020202', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }}>
        <div style={{ width: '360px', background: '#080808', border: '1px solid #1a1a1a', borderRadius: '20px', padding: '2.5rem' }}>
          <div style={{ marginBottom: '1.5rem', textAlign: 'center' }}>
            <span style={{ fontSize: '0.6rem', fontWeight: '900', letterSpacing: '0.15em', color: '#ff3333' }}>SULTRAXAI</span>
            <h2 style={{ margin: '8px 0 4px', fontSize: '1.4rem', fontWeight: '900', color: '#fff' }}>Admin Panel</h2>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#333' }}>Restricted access</p>
          </div>
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {keyError && <div style={{ color: '#ff4444', fontSize: '0.8rem', textAlign: 'center', background: 'rgba(255,51,51,0.08)', padding: '8px', borderRadius: '8px' }}>{keyError}</div>}
            <input
              type="password" placeholder="Admin Key" value={keyInput}
              onChange={e => setKeyInput(e.target.value)} autoFocus
              style={{ padding: '12px 16px', background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: '10px', color: '#fff', fontSize: '0.9rem', outline: 'none', fontFamily: 'inherit' }}
            />
            <button type="submit" style={{ padding: '12px', background: '#ff3333', border: 'none', borderRadius: '10px', color: '#fff', fontWeight: '700', cursor: 'pointer', fontSize: '0.85rem', letterSpacing: '0.05em' }}>
              ENTER
            </button>
          </form>
          <button onClick={onExit} style={{ marginTop: '16px', width: '100%', background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: '0.75rem', textAlign: 'center' }}>
            ← Back to site
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#020202', color: '#fff', fontFamily: 'inherit', padding: '0 0 4rem' }}>

      {/* Header */}
      <div style={{ borderBottom: '1px solid #0d0d0d', padding: '1rem 2rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <h1 style={{ margin: 0, fontSize: '1rem', fontWeight: '900', letterSpacing: '0.1em', color: '#fff' }}>ADMIN PANEL</h1>
          <span style={{ fontSize: '0.6rem', color: '#333', letterSpacing: '0.06em' }}>SULTRAXAI</span>
        </div>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button onClick={load} style={{ background: 'none', border: '1px solid #1a1a1a', color: '#444', padding: '5px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'inherit' }}>
            ↻ Refresh
          </button>
          <button onClick={() => { sessionStorage.removeItem('admin_authed'); setAuthed(false); }} style={{ background: 'none', border: '1px solid #1a1a1a', color: '#444', padding: '5px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'inherit' }}>
            Sign Out
          </button>
          <button onClick={onExit} style={{ background: 'none', border: '1px solid #1a1a1a', color: '#444', padding: '5px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'inherit' }}>
            ← Site
          </button>
        </div>
      </div>

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '2rem' }}>

        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '1rem' }}>
          {[
            { label: 'Total Users', value: total },
            { label: 'With Onboarding', value: users.filter(u => u.experience).length },
            { label: 'With Assets', value: users.filter(u => u.asset_count > 0).length },
          ].map(s => (
            <div key={s.label} style={{ background: '#080808', border: '1px solid #111', borderRadius: '12px', padding: '18px 20px' }}>
              <div style={{ fontSize: '1.8rem', fontWeight: '900', color: '#fff', lineHeight: 1 }}>{s.value}</div>
              <div style={{ fontSize: '0.65rem', color: '#333', marginTop: '4px', letterSpacing: '0.06em', fontWeight: '700' }}>{s.label.toUpperCase()}</div>
            </div>
          ))}
        </div>

        {/* Online now */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', marginBottom: '1rem' }}>
          <div style={{ background: '#080808', border: '1px solid #0d2b0d', borderRadius: '12px', padding: '18px 20px', position: 'relative', overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '12px', right: '14px', width: '7px', height: '7px', borderRadius: '50%', background: '#44cc44', boxShadow: '0 0 8px #44cc44' }} />
            <div style={{ fontSize: '2rem', fontWeight: '900', color: '#44cc44', lineHeight: 1 }}>{onlineStats.online_5m}</div>
            <div style={{ fontSize: '0.65rem', color: '#2a6b2a', marginTop: '4px', letterSpacing: '0.06em', fontWeight: '700' }}>ONLINE NOW · 5 MIN</div>
          </div>
          <div style={{ background: '#080808', border: '1px solid #111', borderRadius: '12px', padding: '18px 20px' }}>
            <div style={{ fontSize: '2rem', fontWeight: '900', color: '#888', lineHeight: 1 }}>{onlineStats.online_15m}</div>
            <div style={{ fontSize: '0.65rem', color: '#333', marginTop: '4px', letterSpacing: '0.06em', fontWeight: '700' }}>ACTIVE · 15 MIN</div>
          </div>
        </div>

        {/* World Map */}
        <div style={{ background: '#080808', border: '1px solid #111', borderRadius: '12px', padding: '20px', marginBottom: '2rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.65rem', fontWeight: '700', color: '#333', letterSpacing: '0.1em' }}>CONNECTED FROM · LAST 15 MIN</span>
            <span style={{ fontSize: '0.6rem', color: '#222' }}>{Object.keys(onlineStats.countries).length} countries</span>
          </div>
          <div style={{ height: '260px', borderRadius: '8px', overflow: 'hidden', background: '#050505' }}>
            <WorldMap countries={onlineStats.countries} />
          </div>
          {Object.keys(onlineStats.countries).length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '12px' }}>
              {Object.entries(onlineStats.countries)
                .sort((a, b) => b[1].count - a[1].count)
                .map(([code, { country, count }]) => (
                  <div key={code} style={{ display: 'flex', alignItems: 'center', gap: '5px', background: '#0d0d0d', border: '1px solid #1a1a1a', borderRadius: '8px', padding: '4px 10px' }}>
                    <img src={`https://flagcdn.com/16x12/${code.toLowerCase()}.png`} alt={code}
                      style={{ width: '16px', height: '12px', borderRadius: '2px', objectFit: 'cover' }}
                      onError={e => { e.target.style.display = 'none'; }} />
                    <span style={{ fontSize: '0.68rem', color: '#888', fontWeight: '600' }}>{country}</span>
                    <span style={{ fontSize: '0.62rem', color: '#ff4444', fontWeight: '700' }}>{count}</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        {/* Toast */}
        {deleteMsg && (
          <div style={{ background: 'rgba(255,51,51,0.08)', border: '1px solid rgba(255,51,51,0.2)', borderRadius: '10px', padding: '10px 16px', marginBottom: '16px', color: '#ff6666', fontSize: '0.8rem' }}>
            {deleteMsg}
          </div>
        )}

        {/* Search */}
        <input
          type="text" placeholder="Search by name, email, phone, ID..."
          value={search} onChange={e => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 16px', background: '#080808', border: '1px solid #1a1a1a', borderRadius: '10px', color: '#fff', fontSize: '0.82rem', outline: 'none', boxSizing: 'border-box', marginBottom: '12px', fontFamily: 'inherit' }}
        />

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#333', fontSize: '0.8rem' }}>Loading users…</div>
        ) : (
          <div style={{ background: '#080808', border: '1px solid #111', borderRadius: '14px', overflow: 'hidden' }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '48px 1fr 1fr 110px 90px 110px 140px', padding: '10px 16px', borderBottom: '1px solid #111', gap: '8px' }}>
              {['ID', 'Name', 'Email', 'Subscription', 'Assets', 'Joined', 'Actions'].map(h => (
                <div key={h} style={{ fontSize: '0.58rem', fontWeight: '800', color: '#333', letterSpacing: '0.1em' }}>{h.toUpperCase()}</div>
              ))}
            </div>

            {filtered.length === 0 && (
              <div style={{ textAlign: 'center', padding: '3rem', color: '#2a2a2a', fontSize: '0.8rem' }}>No users found</div>
            )}

            {filtered.map(u => (
              <div key={u.id}>
                {/* Row */}
                <div
                  onClick={() => setExpanded(expanded === u.id ? null : u.id)}
                  style={{ display: 'grid', gridTemplateColumns: '48px 1fr 1fr 110px 90px 110px 140px', padding: '13px 16px', borderBottom: '1px solid #0d0d0d', gap: '8px', cursor: 'pointer', transition: 'background 0.1s', background: expanded === u.id ? '#0d0d0d' : 'transparent', alignItems: 'center' }}
                  onMouseEnter={e => { if (expanded !== u.id) e.currentTarget.style.background = '#0a0a0a'; }}
                  onMouseLeave={e => { if (expanded !== u.id) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ fontSize: '0.72rem', color: '#444', fontWeight: '700' }}>#{u.id}</div>
                  <div>
                    <div style={{ fontSize: '0.8rem', fontWeight: '700', color: '#ddd' }}>
                      {[u.first_name, u.full_name].filter(Boolean).join(' ') || '—'}
                    </div>
                    {u.experience && <div style={{ fontSize: '0.62rem', color: '#333', marginTop: '2px' }}>{u.experience}</div>}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</div>
                  <div>
                    {u.subscription_status === 'active' ? (
                      <>
                        <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#44cc44' }}>
                          ● {u.subscription_plan === 'yearly' ? 'YEARLY' : u.subscription_plan === 'monthly' ? 'MONTHLY' : 'MANUAL'}
                        </div>
                        {u.subscription_expires && (
                          <div style={{ fontSize: '0.58rem', color: '#555', marginTop: '2px' }}>
                            until {fmt(u.subscription_expires).split(' ')[0]}
                          </div>
                        )}
                      </>
                    ) : (
                      <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#444' }}>○ FREE</div>
                    )}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: u.asset_count > 0 ? '#44cc44' : '#333', fontWeight: '700' }}>
                    {u.asset_count > 0 ? `${u.asset_count} assets` : 'None'}
                  </div>
                  <div style={{ fontSize: '0.65rem', color: '#444' }}>{fmt(u.created_at)}</div>
                  <div style={{ display: 'flex', gap: '4px' }}>
                    {u.subscription_status !== 'active' && (
                      <button onClick={e => { e.stopPropagation(); handleGrantSub(u.id); }}
                        style={{ background: 'rgba(68,204,68,0.07)', border: '1px solid rgba(68,204,68,0.2)', color: '#44cc44', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: '700', fontFamily: 'inherit' }}>
                        Grant
                      </button>
                    )}
                    <button onClick={e => { e.stopPropagation(); setConfirmDelete(u.id); }}
                      style={{ background: 'rgba(255,51,51,0.06)', border: '1px solid rgba(255,51,51,0.15)', color: '#ff4444', padding: '4px 8px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.6rem', fontWeight: '700', fontFamily: 'inherit' }}>
                      Delete
                    </button>
                  </div>
                </div>

                {/* Expanded detail */}
                {expanded === u.id && (
                  <div style={{ padding: '16px 20px 20px', background: '#0d0d0d', borderBottom: '1px solid #111' }}>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: u.assets ? '16px' : 0 }}>
                      <div>
                        <div style={{ fontSize: '0.58rem', color: '#333', fontWeight: '800', letterSpacing: '0.08em', marginBottom: '4px' }}>FULL DETAILS</div>
                        <div style={{ fontSize: '0.78rem', color: '#888', lineHeight: 1.8 }}>
                          <div><span style={{ color: '#555' }}>ID:</span> {u.id}</div>
                          <div><span style={{ color: '#555' }}>First Name:</span> {u.first_name || '—'}</div>
                          <div><span style={{ color: '#555' }}>Last Name:</span> {u.full_name || '—'}</div>
                          <div><span style={{ color: '#555' }}>Email:</span> {u.email}</div>
                          <div><span style={{ color: '#555' }}>Phone:</span> {u.phone || '—'}</div>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.58rem', color: '#333', fontWeight: '800', letterSpacing: '0.08em', marginBottom: '4px' }}>PROFILE & SUBSCRIPTION</div>
                        <div style={{ fontSize: '0.78rem', color: '#888', lineHeight: 1.8 }}>
                          <div><span style={{ color: '#555' }}>Experience:</span> {u.experience || '—'}</div>
                          <div><span style={{ color: '#555' }}>Frequency:</span> {u.frequency || '—'}</div>
                          <div><span style={{ color: '#555' }}>Joined:</span> {fmt(u.created_at)}</div>
                          <div><span style={{ color: '#555' }}>Onboarding:</span> {u.experience ? <span style={{ color: '#44cc44' }}>Complete</span> : <span style={{ color: '#ff4444' }}>Pending</span>}</div>
                          <div style={{ marginTop: '6px', paddingTop: '6px', borderTop: '1px solid #1a1a1a' }}>
                            <div><span style={{ color: '#555' }}>Plan:</span> {u.subscription_status === 'active' ? (u.subscription_plan || 'manual') : 'none'}</div>
                            <div><span style={{ color: '#555' }}>Next billing:</span> {u.subscription_expires ? fmt(u.subscription_expires) : '—'}</div>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.58rem', color: '#333', fontWeight: '800', letterSpacing: '0.08em', marginBottom: '8px' }}>WATCHLIST ({u.asset_count})</div>
                        {u.assets ? (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                            {u.assets.split(', ').map(sym => (
                              <span key={sym} style={{ background: '#111', border: '1px solid #1e1e1e', borderRadius: '5px', padding: '2px 8px', fontSize: '0.65rem', color: '#888', fontWeight: '700' }}>{sym}</span>
                            ))}
                          </div>
                        ) : <span style={{ fontSize: '0.75rem', color: '#333' }}>No assets</span>}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Chat Messages */}
        <div style={{ marginTop: '2.5rem', background: '#080808', border: '1px solid #111', borderRadius: '14px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.1em', color: '#fff', marginBottom: '3px' }}>CHAT MESSAGES</div>
              <div style={{ fontSize: '0.75rem', color: '#444' }}>Last 50 messages per room</div>
            </div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {['crypto', 'stocks'].map(r => (
                <button key={r} onClick={() => setChatRoom(r)}
                  style={{ padding: '5px 14px', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '800', fontFamily: 'inherit', letterSpacing: '0.06em',
                    background: chatRoom === r ? (r === 'crypto' ? 'rgba(247,147,26,0.15)' : 'rgba(68,204,68,0.15)') : '#111',
                    color: chatRoom === r ? (r === 'crypto' ? '#f7931a' : '#44cc44') : '#444' }}>
                  {r.toUpperCase()}
                </button>
              ))}
              <button onClick={() => loadChatMessages(chatRoom)} style={{ background: 'none', border: '1px solid #1a1a1a', color: '#444', padding: '5px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'inherit' }}>↻</button>
            </div>
          </div>

          {chatLoading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#2a2a2a', fontSize: '0.8rem' }}>Loading…</div>
          ) : chatMessages.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#2a2a2a', fontSize: '0.8rem' }}>No messages in #{chatRoom}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {chatMessages.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '8px', background: '#0a0a0a', border: '1px solid #111' }}>
                  <span style={{ fontSize: '0.65rem', color: '#444', fontWeight: '700', minWidth: '28px' }}>#{m.id}</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#ccc', minWidth: '90px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.username}</span>
                  <span style={{ flex: 1, fontSize: '0.78rem', color: '#666', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.message}</span>
                  <span style={{ fontSize: '0.6rem', color: '#2a2a2a', whiteSpace: 'nowrap' }}>{fmt(m.created_at)}</span>
                  <button onClick={() => deleteChatMessage(m.id)}
                    style={{ background: 'rgba(255,51,51,0.07)', border: '1px solid rgba(255,51,51,0.15)', color: '#ff4444', padding: '3px 8px', borderRadius: '5px', cursor: 'pointer', fontSize: '0.65rem', fontWeight: '700', fontFamily: 'inherit', flexShrink: 0 }}>
                    Delete
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Username Blocked Words */}
        <div style={{ marginTop: '2.5rem', background: '#080808', border: '1px solid #111', borderRadius: '14px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.1em', color: '#f7931a', marginBottom: '3px' }}>USERNAME MODERATION</div>
              <div style={{ fontSize: '0.75rem', color: '#444' }}>Blocked words — usernames containing these will be rejected</div>
            </div>
            <span style={{ fontSize: '0.7rem', color: '#333', fontWeight: '700' }}>{usernameBlockedWords.length} words</span>
          </div>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
            <input
              value={newUsernameWord} onChange={e => setNewUsernameWord(e.target.value.toLowerCase())}
              onKeyDown={e => e.key === 'Enter' && addUsernameWord()}
              placeholder="Add a word to block in usernames..."
              maxLength={40}
              style={{ flex: 1, padding: '9px 14px', background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: '8px', color: '#fff', fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit' }}
            />
            <button onClick={addUsernameWord} disabled={!newUsernameWord.trim()}
              style={{ padding: '9px 20px', background: newUsernameWord.trim() ? '#f7931a' : '#111', border: 'none', borderRadius: '8px', color: newUsernameWord.trim() ? '#fff' : '#333', cursor: newUsernameWord.trim() ? 'pointer' : 'default', fontSize: '0.78rem', fontWeight: '700', fontFamily: 'inherit', transition: 'all 0.15s' }}>
              + Add
            </button>
          </div>
          {usernameWordMsg && <div style={{ fontSize: '0.75rem', color: '#44cc44', marginBottom: '10px' }}>{usernameWordMsg}</div>}
          {usernameBlockedWords.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: '#2a2a2a', textAlign: 'center', padding: '1.5rem 0' }}>No custom blocked username words yet</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {usernameBlockedWords.map(({ word }) => (
                <div key={word} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(247,147,26,0.06)', border: '1px solid rgba(247,147,26,0.2)', borderRadius: '6px', padding: '4px 10px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#c47a15', fontWeight: '600' }}>{word}</span>
                  <button onClick={() => removeUsernameWord(word)}
                    style={{ background: 'none', border: 'none', color: '#6b4510', cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1, padding: '0 2px' }}>×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Blocked Words */}
        <div style={{ marginTop: '2.5rem', background: '#080808', border: '1px solid #111', borderRadius: '14px', padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.25rem' }}>
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.1em', color: '#ff3333', marginBottom: '3px' }}>CHAT MODERATION</div>
              <div style={{ fontSize: '0.75rem', color: '#444' }}>Blocked words — messages containing these will be rejected</div>
            </div>
            <span style={{ fontSize: '0.7rem', color: '#333', fontWeight: '700' }}>{blockedWords.length} words</span>
          </div>

          {/* Add words */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '1rem' }}>
            <textarea
              value={newWord} onChange={e => setNewWord(e.target.value.toLowerCase())}
              placeholder={"One word per line, or comma-separated:\nfuck, shit, scam\nguaranteed profit\npump and dump"}
              rows={4}
              style={{ padding: '10px 14px', background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: '8px', color: '#fff', fontSize: '0.82rem', outline: 'none', fontFamily: 'inherit', resize: 'vertical', lineHeight: 1.6 }}
            />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '0.7rem', color: '#333' }}>
                {newWord.split(/[\n,]+/).filter(w => w.trim()).length} word{newWord.split(/[\n,]+/).filter(w => w.trim()).length !== 1 ? 's' : ''} ready to add
              </span>
              <button onClick={addWord} disabled={!newWord.trim()}
                style={{ padding: '9px 24px', background: newWord.trim() ? '#ff3333' : '#111', border: 'none', borderRadius: '8px', color: newWord.trim() ? '#fff' : '#333', cursor: newWord.trim() ? 'pointer' : 'default', fontSize: '0.78rem', fontWeight: '700', fontFamily: 'inherit', transition: 'all 0.15s' }}>
                + Add All
              </button>
            </div>
          </div>

          {wordMsg && (
            <div style={{ fontSize: '0.75rem', color: '#44cc44', marginBottom: '10px' }}>{wordMsg}</div>
          )}

          {/* Word tags */}
          {blockedWords.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: '#2a2a2a', textAlign: 'center', padding: '1.5rem 0' }}>No custom blocked words yet</div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {blockedWords.map(({ word }) => (
                <div key={word} style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,51,51,0.06)', border: '1px solid rgba(255,51,51,0.15)', borderRadius: '6px', padding: '4px 10px' }}>
                  <span style={{ fontSize: '0.78rem', color: '#cc4444', fontWeight: '600' }}>{word}</span>
                  <button onClick={() => removeWord(word)}
                    style={{ background: 'none', border: 'none', color: '#553333', cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1, padding: '0 2px' }}>
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {/* Delete confirmation modal */}
      {confirmDelete !== null && (
        <div onClick={() => setConfirmDelete(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: '16px', padding: '2rem', width: '340px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.5rem', marginBottom: '12px' }}>⚠️</div>
            <h3 style={{ margin: '0 0 8px', fontSize: '1rem', fontWeight: '900' }}>Delete User #{confirmDelete}?</h3>
            <p style={{ color: '#555', fontSize: '0.8rem', margin: '0 0 1.5rem', lineHeight: 1.6 }}>
              This will permanently remove the user and all their assets and profile data. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center' }}>
              <button onClick={() => setConfirmDelete(null)} style={{ padding: '8px 20px', background: 'none', border: '1px solid #2a2a2a', color: '#555', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontFamily: 'inherit' }}>
                Cancel
              </button>
              <button onClick={() => handleDelete(confirmDelete)} style={{ padding: '8px 20px', background: '#ff3333', border: 'none', color: '#fff', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: '700', fontFamily: 'inherit' }}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
