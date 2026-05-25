import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://38.180.137.122:8000';
const ADMIN_KEY = 'sultrax_admin_key_2026';

function fmt(iso) {
  if (!iso) return '—';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) +
      ' ' + d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
  } catch { return iso; }
}

export default function AdminPanel({ onExit }) {
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('admin_authed') === '1');
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState('');
  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [deleteMsg, setDeleteMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/admin/users?key=${ADMIN_KEY}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setUsers(data.users || []);
      setTotal(data.total || 0);
    } catch {
      setKeyError('Failed to load users. Check server connection.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (authed) load();
  }, [authed, load]);

  const handleLogin = (e) => {
    e.preventDefault();
    if (keyInput === ADMIN_KEY) {
      sessionStorage.setItem('admin_authed', '1');
      setAuthed(true);
      setKeyError('');
    } else {
      setKeyError('Invalid admin key.');
    }
  };

  const handleDelete = async (id) => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/${id}?key=${ADMIN_KEY}`, { method: 'DELETE' });
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
      const res = await fetch(`${API_BASE}/api/admin/grant-subscription?key=${ADMIN_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '2rem' }}>
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
