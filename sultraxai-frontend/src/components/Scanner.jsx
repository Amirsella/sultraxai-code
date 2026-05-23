import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = 'http://38.180.137.122:8000';

const THRESHOLDS = [
  { label: '>1%',  value: 1.0 },
  { label: '>2%',  value: 2.0 },
  { label: '>5%',  value: 5.0 },
  { label: '>10%', value: 10.0 },
];

const REFRESH_SEC = 60;

function MoverRow({ m, onZone }) {
  const up = m.pct >= 0;
  const color = up ? '#44cc44' : '#ff4444';
  const barWidth = Math.min(Math.abs(m.pct) * 8, 100);

  return (
    <div
      onClick={() => onZone(m.symbol)}
      style={{ display: 'grid', gridTemplateColumns: '90px 1fr 90px 90px', alignItems: 'center', padding: '12px 16px', borderRadius: '10px', background: '#080808', border: '1px solid #111', marginBottom: '6px', cursor: 'pointer', transition: 'border-color 0.15s' }}
      onMouseEnter={e => e.currentTarget.style.borderColor = '#1e1e1e'}
      onMouseLeave={e => e.currentTarget.style.borderColor = '#111'}
    >
      {/* Symbol */}
      <div style={{ fontWeight: '800', fontSize: '0.88rem', color: '#ddd', letterSpacing: '0.03em' }}>{m.symbol.replace('-USD', '/USD')}</div>

      {/* Bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <div style={{ flex: 1, height: '3px', background: '#111', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${barWidth}%`, height: '100%', background: color, borderRadius: '2px', transition: 'width 0.4s ease' }} />
        </div>
      </div>

      {/* Price */}
      <div style={{ textAlign: 'right', fontSize: '0.82rem', color: '#666', fontWeight: '600' }}>
        ${m.price.toLocaleString()}
      </div>

      {/* Pct */}
      <div style={{ textAlign: 'right', fontWeight: '800', fontSize: '0.9rem', color, letterSpacing: '0.02em' }}>
        {up ? '▲' : '▼'} {Math.abs(m.pct).toFixed(2)}%
      </div>
    </div>
  );
}

export default function Scanner({ onNavigateToZone, isNative }) {
  const [movers, setMovers]         = useState([]);
  const [threshold, setThreshold]   = useState(1.0);
  const [loading, setLoading]       = useState(false);
  const [error, setError]           = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [scanned, setScanned]       = useState(0);
  const [countdown, setCountdown]   = useState(REFRESH_SEC);

  const load = useCallback(async (thr) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/scanner?threshold=${thr}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setMovers(data.movers || []);
      setScanned(data.total_scanned || 0);
      setLastUpdate(new Date());
      setCountdown(REFRESH_SEC);
    } catch {
      setError('Failed to load scanner data.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(threshold);
    const id = setInterval(() => load(threshold), REFRESH_SEC * 1000);
    return () => clearInterval(id);
  }, [threshold, load]);

  useEffect(() => {
    const id = setInterval(() => setCountdown(c => (c > 0 ? c - 1 : REFRESH_SEC)), 1000);
    return () => clearInterval(id);
  }, []);

  const up   = movers.filter(m => m.pct > 0);
  const down = movers.filter(m => m.pct < 0);

  const containerStyle = isNative
    ? { position: 'fixed', inset: 0, background: '#020202', display: 'flex', flexDirection: 'column', overflow: 'hidden', color: '#fff' }
    : { width: '100%', minHeight: '100vh', background: '#020202', color: '#fff', padding: '0 2rem 4rem' };

  return (
    <div style={containerStyle}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>

      {/* HEADER */}
      <div style={{ paddingTop: isNative ? '56px' : '1.5rem', paddingBottom: '14px', paddingLeft: isNative ? '20px' : 0, paddingRight: isNative ? '20px' : 0, borderBottom: '1px solid #0f0f0f', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', letterSpacing: '0.07em', background: 'linear-gradient(to right,#fff 40%,#555)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>SCANNER</h2>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: loading ? '#ff9900' : error ? '#ff3333' : '#44cc44', boxShadow: `0 0 6px ${loading ? '#ff9900' : error ? '#ff3333' : '#44cc44'}`, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {scanned > 0 && <span style={{ fontSize: '0.6rem', color: '#222' }}>{scanned} symbols scanned</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {lastUpdate && <span style={{ fontSize: '0.58rem', color: '#1e1e1e' }}>↻ {countdown}s</span>}
          </div>
        </div>

        {/* Stats row */}
        {movers.length > 0 && (
          <div style={{ display: 'flex', gap: '16px', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.62rem', color: '#44cc44', fontWeight: '700' }}>▲ {up.length} up</span>
            <span style={{ fontSize: '0.62rem', color: '#ff4444', fontWeight: '700' }}>▼ {down.length} down</span>
          </div>
        )}

        {/* Threshold filters */}
        <div style={{ display: 'flex', gap: '6px' }}>
          {THRESHOLDS.map(t => {
            const active = threshold === t.value;
            return (
              <button key={t.value} onClick={() => setThreshold(t.value)}
                style={{ padding: '4px 14px', borderRadius: '7px', border: `1px solid ${active ? '#ff333355' : '#1a1a1a'}`, background: active ? 'rgba(255,51,51,0.08)' : 'transparent', color: active ? '#ff4444' : '#333', cursor: 'pointer', fontSize: '0.62rem', fontWeight: '700', letterSpacing: '0.05em', fontFamily: 'inherit' }}>
                {t.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* MOVERS LIST */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isNative ? '12px 16px 24px' : '16px 0 0', maxWidth: isNative ? undefined : '760px' }}>
        {loading && movers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '5rem 1rem', color: '#2a2a2a', fontSize: '0.82rem' }}>
            <div style={{ marginBottom: '12px', fontSize: '1.5rem' }}>⏳</div>
            Scanning {THRESHOLDS[0] ? scanned || '~50' : ''} symbols…
          </div>
        )}

        {error && !loading && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <p style={{ color: '#444', fontSize: '0.8rem', margin: '0 0 16px' }}>{error}</p>
            <button onClick={() => load(threshold)} style={{ background: 'none', border: '1px solid #2a2a2a', color: '#555', padding: '6px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontFamily: 'inherit' }}>Try Again</button>
          </div>
        )}

        {!loading && !error && movers.length === 0 && (
          <div style={{ textAlign: 'center', padding: '5rem 1rem', color: '#2a2a2a', fontSize: '0.8rem' }}>
            No movers above {threshold}% right now
          </div>
        )}

        {/* Up movers */}
        {up.length > 0 && (
          <>
            <div style={{ fontSize: '0.58rem', fontWeight: '800', color: '#44cc44', letterSpacing: '0.1em', marginBottom: '8px', opacity: 0.6 }}>GAINING</div>
            {up.map(m => <MoverRow key={m.symbol} m={m} onZone={onNavigateToZone} />)}
          </>
        )}

        {/* Down movers */}
        {down.length > 0 && (
          <>
            <div style={{ fontSize: '0.58rem', fontWeight: '800', color: '#ff4444', letterSpacing: '0.1em', margin: `${up.length > 0 ? '20px' : '0px'} 0 8px`, opacity: 0.6 }}>DECLINING</div>
            {down.map(m => <MoverRow key={m.symbol} m={m} onZone={onNavigateToZone} />)}
          </>
        )}
      </div>
    </div>
  );
}
