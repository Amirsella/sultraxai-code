import React, { useState, useEffect, useRef } from 'react';

const API_BASE = 'http://38.180.137.122:8000';

function EditPanel({ userId, selectedAssets, thresholds, onSave, onClose }) {
  const [editAssets, setEditAssets] = useState([...selectedAssets]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef(null);

  const handleSearch = (value) => {
    clearTimeout(timerRef.current);
    if (!value.trim()) { setSearchResults([]); return; }
    timerRef.current = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/search-stocks?q=${encodeURIComponent(value)}`);
        const data = await res.json();
        setSearchResults(data.results || []);
      } catch { setSearchResults([]); }
      setSearchLoading(false);
    }, 300);
  };

  const toggle = (sym) => {
    setEditAssets(prev =>
      prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]
    );
  };

  const save = async () => {
    setSaving(true);
    const assets = editAssets.map(s => ({ symbol: s, threshold: thresholds[s] ?? 2.0 }));
    try {
      await fetch(`${API_BASE}/api/update-assets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, assets }),
      });
      onSave(editAssets);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '20px', padding: '2rem', width: '420px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Manage Watchlist</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: '1.2rem', cursor: 'pointer', lineHeight: 1 }}>✕</button>
        </div>

        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="Search stock or crypto..."
            onChange={e => handleSearch(e.target.value)}
            style={{ width: '100%', padding: '0.85rem 1rem', background: '#111', border: '1px solid #2a2a2a', borderRadius: '12px', color: '#fff', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem' }}
          />
          {(searchLoading || searchResults.length > 0) && (
            <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#111', border: '1px solid #2a2a2a', borderRadius: '12px', maxHeight: '200px', overflowY: 'auto', zIndex: 10 }}>
              {searchLoading && <div style={{ padding: '0.75rem 1rem', color: '#555', fontSize: '0.82rem' }}>Searching...</div>}
              {searchResults.map(item => (
                <div key={item.symbol} onMouseDown={e => e.preventDefault()} onClick={() => toggle(item.symbol)}
                  style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.65rem 1rem', cursor: 'pointer', borderBottom: '1px solid #1a1a1a', background: editAssets.includes(item.symbol) ? 'rgba(255,51,51,0.07)' : 'transparent' }}>
                  <div>
                    <span style={{ fontWeight: '600', color: '#fff', fontSize: '0.85rem' }}>{item.symbol}</span>
                    <span style={{ marginLeft: '8px', color: '#555', fontSize: '0.75rem' }}>{item.name}</span>
                  </div>
                  <span style={{ color: editAssets.includes(item.symbol) ? '#ff3333' : '#444', fontSize: '0.8rem' }}>
                    {editAssets.includes(item.symbol) ? '✓' : '+'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ overflowY: 'auto', flex: 1 }}>
          <div style={{ fontSize: '0.72rem', color: '#444', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
            Your Watchlist ({editAssets.length})
          </div>
          {editAssets.length === 0 ? (
            <p style={{ color: '#333', fontSize: '0.82rem', textAlign: 'center', padding: '1.5rem 0' }}>No assets selected</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {editAssets.map(s => (
                <div key={s} onClick={() => toggle(s)}
                  style={{ padding: '5px 12px', borderRadius: '20px', background: 'rgba(255,51,51,0.12)', border: '1px solid #ff333355', color: '#ff5555', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {s} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>✕</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <button onClick={save} disabled={saving || editAssets.length < 1}
          style={{ padding: '0.9rem', background: editAssets.length >= 1 ? '#ff3333' : '#1a1a1a', border: 'none', borderRadius: '12px', color: editAssets.length >= 1 ? '#fff' : '#444', fontWeight: '700', cursor: editAssets.length >= 1 ? 'pointer' : 'not-allowed', fontSize: '0.9rem' }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

export default function MainTerminal({ userId, selectedAssets, onSignOut, onAssetsUpdate }) {
  const [thresholds, setThresholds] = useState({});
  const [prices, setPrices] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const alertedRef = useRef(new Set());

  useEffect(() => {
    if (!userId) return;
    fetch(`${API_BASE}/api/user-assets/${userId}`)
      .then(r => r.json())
      .then(data => {
        const map = {};
        (data.assets || []).forEach(a => { map[a.symbol] = a.threshold; });
        setThresholds(map);
      })
      .catch(() => {});
  }, [userId]);

  const fetchPrices = async () => {
    if (!selectedAssets.length) return;
    try {
      const res = await fetch(`${API_BASE}/api/prices?symbols=${selectedAssets.join(',')}`);
      const data = await res.json();
      const newPrices = data.prices || {};
      const now = new Date();

      Object.entries(newPrices).forEach(([sym, p]) => {
        const threshold = thresholds[sym] ?? 2.0;
        const absPct = Math.abs(p.change_pct || 0);
        const windowKey = `${sym}-${Math.floor(now.getTime() / (5 * 60 * 1000))}`;
        if (absPct >= threshold && !alertedRef.current.has(windowKey)) {
          alertedRef.current.add(windowKey);
          setAlerts(prev => [{
            symbol: sym, pct: p.change_pct, price: p.price,
            time: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            threshold,
          }, ...prev].slice(0, 50));
        }
      });

      setPrices(newPrices);
      setLastUpdate(now);
      setLoading(false);
    } catch (e) {
      console.error('Price fetch error:', e);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedAssets.length) return;
    fetchPrices();
    const id = setInterval(fetchPrices, 5000);
    return () => clearInterval(id);
  }, [selectedAssets, thresholds]);

  const getStatus = (sym) => {
    const p = prices[sym];
    if (!p) return { label: 'LOADING', color: '#444' };
    const abs = Math.abs(p.change_pct || 0);
    const t = thresholds[sym] ?? 2.0;
    if (abs >= t) return { label: 'ALERT', color: '#ff3333' };
    if (abs >= t * 0.5) return { label: 'MOVING', color: '#ff9900' };
    return { label: 'CALM', color: '#44cc44' };
  };

  const handleSave = (newAssets) => {
    onAssetsUpdate(newAssets);
    setEditing(false);
  };

  return (
    <div style={{ width: '100%', maxWidth: '1400px', padding: '0 2rem 4rem', margin: '0 auto', color: '#fff' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
      `}</style>

      {editing && (
        <EditPanel
          userId={userId}
          selectedAssets={selectedAssets}
          thresholds={thresholds}
          onSave={handleSave}
          onClose={() => setEditing(false)}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem', marginTop: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '2rem', fontWeight: '900', margin: 0, background: 'linear-gradient(to bottom, #fff, #666)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            TERMINAL
          </h2>
          <p style={{ color: '#444', margin: '0.2rem 0 0', fontSize: '0.75rem' }}>
            {loading ? 'Connecting...' : lastUpdate ? `Updated ${lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <button onClick={() => setEditing(true)}
            style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid #2a2a2a', color: '#aaa', padding: '0.45rem 1rem', borderRadius: '20px', cursor: 'pointer', fontSize: '0.78rem', fontWeight: '600' }}>
            + Edit Watchlist
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#ff3333', fontSize: '0.72rem', fontWeight: '700', letterSpacing: '0.08em' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#ff3333', animation: 'pulse 2s infinite' }} />
            LIVE · {selectedAssets.length} ASSETS
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '14px' }}>
          {selectedAssets.map(sym => {
            const p = prices[sym];
            const status = getStatus(sym);
            const pct = p?.change_pct;
            const t = thresholds[sym] ?? 2.0;
            const barWidth = Math.min(100, (Math.abs(pct || 0) / t) * 100);

            return (
              <div key={sym} style={{ background: 'rgba(8,8,8,0.85)', border: `1px solid ${status.color}28`, borderRadius: '16px', padding: '1.25rem', backdropFilter: 'blur(12px)', transition: 'border-color 0.4s', animation: 'fadeIn 0.3s ease' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.6rem' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{sym}</span>
                  <span style={{ fontSize: '0.65rem', fontWeight: '700', color: status.color, background: `${status.color}18`, padding: '3px 8px', borderRadius: '20px' }}>
                    {status.label}
                  </span>
                </div>
                <div style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '0.3rem', fontVariantNumeric: 'tabular-nums' }}>
                  {p ? `$${p.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}
                </div>
                <div style={{ fontSize: '0.85rem', fontWeight: '600', color: pct > 0 ? '#44cc44' : pct < 0 ? '#ff4444' : '#666' }}>
                  {pct != null ? `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%` : '—'}
                </div>
                <div style={{ marginTop: '0.85rem', height: '3px', background: '#111', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${barWidth}%`, height: '100%', background: status.color, borderRadius: '2px', transition: 'width 0.6s ease' }} />
                </div>
                <div style={{ fontSize: '0.62rem', color: '#444', marginTop: '0.35rem' }}>
                  {barWidth.toFixed(0)}% of {t}% threshold
                </div>
              </div>
            );
          })}
        </div>

        <div style={{ width: '260px', flexShrink: 0 }}>
          <div style={{ background: 'rgba(8,8,8,0.85)', borderRadius: '16px', border: '1px solid #1a1a1a', padding: '1.25rem', backdropFilter: 'blur(12px)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '700', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Alert Feed</h3>
              {alerts.length > 0 && (
                <span style={{ fontSize: '0.65rem', background: '#ff333322', color: '#ff3333', padding: '2px 7px', borderRadius: '10px', fontWeight: '700' }}>
                  {alerts.length}
                </span>
              )}
            </div>
            {alerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 0.5rem' }}>
                <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>🔍</div>
                <p style={{ color: '#333', fontSize: '0.78rem', margin: 0, lineHeight: 1.5 }}>
                  No alerts yet.<br />Watching {selectedAssets.length} assets.
                </p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '520px', overflowY: 'auto' }}>
                {alerts.map((a, i) => (
                  <div key={i} style={{ padding: '0.7rem', borderRadius: '10px', background: '#0c0c0c', border: '1px solid #1c1c1c', animation: 'fadeIn 0.3s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span style={{ fontWeight: '700', color: '#fff', fontSize: '0.82rem' }}>{a.symbol}</span>
                      <span style={{ fontSize: '0.65rem', color: '#444' }}>{a.time}</span>
                    </div>
                    <div style={{ color: a.pct > 0 ? '#44cc44' : '#ff4444', fontSize: '0.8rem', fontWeight: '600' }}>
                      {a.pct > 0 ? '▲' : '▼'} {Math.abs(a.pct).toFixed(2)}% — threshold crossed
                    </div>
                    <div style={{ color: '#444', fontSize: '0.7rem', marginTop: '2px' }}>
                      ${a.price?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
