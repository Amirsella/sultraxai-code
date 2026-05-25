import React, { useState, useEffect, useRef, useCallback } from 'react';

const API_BASE = '';

const SENSITIVITY_LEVELS = [
  { label: 'Major only', desc: '>5%', value: 5.0, color: '#ff3333' },
  { label: 'Standard',   desc: '>2%', value: 2.0, color: '#ff9900' },
  { label: 'All signals',desc: '>1%', value: 1.0, color: '#44cc44' },
];

const toFinnhubSym = (yahoo) => {
  if (yahoo.endsWith('-USD')) return `BINANCE:${yahoo.slice(0, -4)}USDT`;
  return yahoo;
};

const fromFinnhubSym = (finnhub, watchlist) => {
  if (finnhub.startsWith('BINANCE:') && finnhub.endsWith('USDT')) {
    const yahoo = `${finnhub.slice(8, -4)}-USD`;
    return watchlist.includes(yahoo) ? yahoo : null;
  }
  return watchlist.includes(finnhub) ? finnhub : null;
};

const fmtPrice = (p) =>
  p?.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) ?? '—';

const toTVSymbol = (yahoo) => {
  const map = { 'BTC-USD':'COINBASE:BTCUSD', 'ETH-USD':'COINBASE:ETHUSD', 'SOL-USD':'COINBASE:SOLUSD', 'XRP-USD':'COINBASE:XRPUSD', 'DOGE-USD':'COINBASE:DOGEUSD', 'BNB-USD':'BINANCE:BNBUSDT' };
  if (map[yahoo]) return map[yahoo];
  if (yahoo.endsWith('-USD')) return `BINANCE:${yahoo.slice(0,-4)}USDT`;
  return yahoo;
};

const TV_INTERVALS = [
  { label: '1m',  value: '1' },
  { label: '5m',  value: '5' },
  { label: '15m', value: '15' },
  { label: '1H',  value: '60' },
  { label: '4H',  value: '240' },
  { label: '1D',  value: 'D' },
  { label: '1W',  value: 'W' },
  { label: '1M',  value: 'M' },
];

function ChartModal({ sym, price, rvol, symAlerts, onClose, onRegisterLive }) {
  const [activeInterval, setActiveInterval] = useState('5');
  const [liveMode, setLiveMode] = useState(false);
  const [liveReady, setLiveReady] = useState(false);
  const containerId = `tv_${sym.replace(/[^a-zA-Z0-9]/g, '_')}`;
  const liveContainerRef = useRef(null);
  const lwChartRef = useRef(null);
  const candleSeriesRef = useRef(null);
  const liveCandlesRef = useRef({});

  // TradingView widget
  useEffect(() => {
    if (liveMode) return;
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = '';

    const init = () => {
      if (!window.TradingView || !document.getElementById(containerId)) return;
      new window.TradingView.widget({
        container_id: containerId,
        symbol: toTVSymbol(sym),
        interval: activeInterval,
        theme: 'dark', style: '1',
        width: '100%', height: 420,
        hide_side_toolbar: false,
        allow_symbol_change: false,
        save_image: false,
        locale: 'en',
        backgroundColor: '#070707',
        gridColor: 'rgba(255,255,255,0.03)',
      });
    };

    if (window.TradingView) { init(); }
    else if (!document.getElementById('tv-script')) {
      const s = document.createElement('script');
      s.id = 'tv-script'; s.src = 'https://s3.tradingview.com/tv.js'; s.async = true; s.onload = init;
      document.head.appendChild(s);
    } else {
      const t = setInterval(() => { if (window.TradingView) { clearInterval(t); init(); } }, 100);
    }
  }, [sym, activeInterval, liveMode]);

  // Lightweight Charts LIVE mode
  useEffect(() => {
    if (!liveMode) return;
    liveCandlesRef.current = {};
    setLiveReady(false);

    const initLW = () => {
      if (!window.LightweightCharts || !liveContainerRef.current) return;
      const w = liveContainerRef.current.clientWidth || 920;
      lwChartRef.current = window.LightweightCharts.createChart(liveContainerRef.current, {
        width: w,
        height: 420,
        layout: { backgroundColor: '#070707', textColor: '#888' },
        grid: { vertLines: { color: '#0d0d0d' }, horzLines: { color: '#0d0d0d' } },
        rightPriceScale: { borderColor: '#1a1a1a' },
        timeScale: { borderColor: '#1a1a1a', timeVisible: true, secondsVisible: true },
        crosshair: { mode: 1 },
      });
      candleSeriesRef.current = lwChartRef.current.addCandlestickSeries({
        upColor: '#26a69a', downColor: '#ef5350',
        borderUpColor: '#26a69a', borderDownColor: '#ef5350',
        wickUpColor: '#26a69a', wickDownColor: '#ef5350',
      });

      onRegisterLive((newPrice, ts) => {
        const bucketTs = Math.floor(ts / 5000) * 5; // 5-second candles
        const c = liveCandlesRef.current;
        if (!c[bucketTs]) {
          c[bucketTs] = { time: bucketTs, open: newPrice, high: newPrice, low: newPrice, close: newPrice };
        } else {
          c[bucketTs].high = Math.max(c[bucketTs].high, newPrice);
          c[bucketTs].low = Math.min(c[bucketTs].low, newPrice);
          c[bucketTs].close = newPrice;
        }
        try {
          candleSeriesRef.current?.update(c[bucketTs]);
          lwChartRef.current?.timeScale().scrollToRealTime();
        } catch {}
        setLiveReady(true);
      });
    };

    if (window.LightweightCharts) { initLW(); }
    else {
      const s = document.createElement('script');
      s.src = 'https://unpkg.com/lightweight-charts@3.8.0/dist/lightweight-charts.standalone.production.js';
      s.onload = initLW;
      document.head.appendChild(s);
    }

    return () => {
      onRegisterLive(null);
      lwChartRef.current?.remove();
      lwChartRef.current = null;
      candleSeriesRef.current = null;
    };
  }, [liveMode, sym]);

  const p = price;
  const signals = (symAlerts || []).filter(a => a.type === 'signal').slice(0, 4);
  const priceEvts = (symAlerts || []).filter(a => a.type === 'price').slice(0, 3);

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.97)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
      <div style={{ background: '#070707', border: '1px solid #1c1c1c', borderRadius: '20px', width: '100%', maxWidth: '1020px', maxHeight: '92vh', overflow: 'hidden', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 80px rgba(0,0,0,0.7)' }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.1rem 1.5rem', borderBottom: '1px solid #111' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontWeight: '900', fontSize: '1.25rem', letterSpacing: '0.04em' }}>{sym}</span>
            {p && <>
              <span style={{ fontWeight: '800', fontSize: '1.1rem', fontVariantNumeric: 'tabular-nums', color: '#fff' }}>${fmtPrice(p.price)}</span>
              <span style={{ fontWeight: '700', fontSize: '0.88rem', color: (p.change_pct || 0) >= 0 ? '#44cc44' : '#ff4444' }}>
                {(p.change_pct || 0) >= 0 ? '+' : ''}{(p.change_pct || 0).toFixed(2)}%
              </span>
            </>}
            {rvol >= 1.5 && (
              <span style={{ fontSize: '0.65rem', fontWeight: '700', color: rvol >= 3 ? '#ff9900' : '#666', background: rvol >= 3 ? 'rgba(255,153,0,0.1)' : 'rgba(255,255,255,0.04)', padding: '3px 9px', borderRadius: '6px', border: `1px solid ${rvol >= 3 ? 'rgba(255,153,0,0.2)' : '#1a1a1a'}` }}>
                {rvol >= 5 ? '🔥' : '⚡'} {rvol.toFixed(1)}x VOL
              </span>
            )}
          </div>
          <button onClick={onClose} style={{ background: 'none', border: '1px solid #222', color: '#555', borderRadius: '8px', width: '32px', height: '32px', cursor: 'pointer', fontSize: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: '0.15s' }}>✕</button>
        </div>

        {/* Interval bar + LIVE toggle */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0.6rem 1.5rem', background: '#050505', borderBottom: '1px solid #0d0d0d' }}>
          {!liveMode && TV_INTERVALS.map(({ label, value }) => (
            <button key={value} onClick={() => setActiveInterval(value)}
              style={{ padding: '4px 16px', borderRadius: '7px', border: `1px solid ${activeInterval === value ? '#333' : '#111'}`, background: activeInterval === value ? '#1c1c1c' : 'transparent', color: activeInterval === value ? '#fff' : '#3a3a3a', cursor: 'pointer', fontSize: '0.72rem', fontWeight: activeInterval === value ? '700' : '500', transition: '0.15s' }}>
              {label}
            </button>
          ))}
          {liveMode && (
            <span style={{ fontSize: '0.68rem', color: '#2a2a2a' }}>5s candles · real-time feed</span>
          )}
          <div style={{ flex: 1 }} />
          <button onClick={() => setLiveMode(m => !m)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '4px 14px', borderRadius: '7px', border: `1px solid ${liveMode ? 'rgba(68,204,68,0.3)' : '#222'}`, background: liveMode ? 'rgba(68,204,68,0.08)' : 'transparent', color: liveMode ? '#44cc44' : '#3a3a3a', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '700', transition: '0.2s' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: liveMode ? '#44cc44' : '#333', display: 'inline-block', flexShrink: 0, animation: liveMode ? 'pulse 1.5s infinite' : 'none', boxShadow: liveMode ? '0 0 6px #44cc44' : 'none' }} />
            LIVE
          </button>
        </div>

        {/* Chart area */}
        <div style={{ flex: 1, minHeight: 0, position: 'relative' }}>
          {liveMode ? (
            <>
              <div ref={liveContainerRef} style={{ width: '100%', height: '420px', overflow: 'hidden' }} />
              {!liveReady && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#070707' }}>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontSize: '1.8rem', marginBottom: '0.6rem' }}>📡</div>
                    <div style={{ fontSize: '0.82rem', color: '#555', fontWeight: '600' }}>Waiting for first trade…</div>
                    <div style={{ fontSize: '0.68rem', color: '#2a2a2a', marginTop: '6px' }}>Candles will appear as trades stream in</div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div id={containerId} style={{ width: '100%', height: '420px' }} />
          )}
        </div>

        {/* Recent activity */}
        {(signals.length > 0 || priceEvts.length > 0) && (
          <div style={{ borderTop: '1px solid #0d0d0d', padding: '0.85rem 1.5rem', background: '#050505' }}>
            <div style={{ fontSize: '0.6rem', color: '#2a2a2a', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: '0.6rem' }}>Recent Activity</div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {signals.map((a, i) => (
                <div key={i} style={{ padding: '5px 11px', borderRadius: '8px', background: a.dir === 'buy' ? 'rgba(255,153,0,0.07)' : 'rgba(255,68,68,0.07)', border: `1px solid ${a.dir === 'buy' ? 'rgba(255,153,0,0.18)' : 'rgba(255,68,68,0.18)'}` }}>
                  <span style={{ fontSize: '0.7rem', color: a.dir === 'buy' ? '#ff9900' : '#ff4444', fontWeight: '700' }}>{a.dir === 'buy' ? '🐋' : '🔴'} {a.strengthLabel}</span>
                  <span style={{ fontSize: '0.62rem', color: '#444', marginLeft: '7px' }}>{a.score}/100 · {a.time}</span>
                </div>
              ))}
              {priceEvts.map((a, i) => (
                <div key={i} style={{ padding: '5px 11px', borderRadius: '8px', background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
                  <span style={{ fontSize: '0.7rem', color: a.pct > 0 ? '#44cc44' : '#ff4444', fontWeight: '700' }}>{a.pct > 0 ? '▲' : '▼'} {Math.abs(a.pct).toFixed(2)}% move</span>
                  <span style={{ fontSize: '0.62rem', color: '#444', marginLeft: '7px' }}>{a.time}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const Sparkline = React.memo(function Sparkline({ sym, prices }) {
  if (!prices || prices.length < 2) {
    return (
      <div style={{ height: '48px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#1e1e1e', fontSize: '0.65rem' }}>no data</span>
      </div>
    );
  }
  const min = Math.min(...prices), max = Math.max(...prices);
  const range = max - min || 0.001;
  const W = 200, H = 48, pad = 3;
  const px = (i) => ((i / (prices.length - 1)) * W).toFixed(2);
  const py = (p) => (H - pad - ((p - min) / range) * (H - pad * 2)).toFixed(2);
  const linePoints = prices.map((p, i) => `${px(i)},${py(p)}`).join(' ');
  const areaPoints = `0,${H} ` + prices.map((p, i) => `${px(i)},${py(p)}`).join(' ') + ` ${W},${H}`;
  const isUp = prices[prices.length - 1] >= prices[0];
  const color = isUp ? '#44cc44' : '#ff4444';
  const gradId = `sg-${sym.replace(/[^a-zA-Z0-9]/g, '')}`;
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ display: 'block', overflow: 'visible' }}>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaPoints} fill={`url(#${gradId})`} />
      <polyline points={linePoints} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
});

function TopMoversTicker({ onMoverClick }) {
  const [movers, setMovers] = useState([]);
  const hasDataRef = useRef(false);

  useEffect(() => {
    let retryId = null;
    let intervalId = null;

    const load = () =>
      fetch(`${API_BASE}/api/scanner?threshold=0.1`)
        .then(r => r.json())
        .then(d => {
          const m = (d.movers || []).slice(0, 20);
          setMovers(m);
          if (m.length > 0 && !hasDataRef.current) {
            // Scanner just populated — switch to slow 60s poll
            hasDataRef.current = true;
            clearInterval(retryId);
            retryId = null;
            intervalId = setInterval(load, 60000);
          }
        })
        .catch(() => {});

    load();
    // Fast retry every 8s until scanner cache is populated, then slow 60s poll
    retryId = setInterval(load, 8000);
    return () => { clearInterval(retryId); clearInterval(intervalId); };
  }, []);

  if (!movers.length) return null;

  const items = [...movers, ...movers, ...movers];

  return (
    <div style={{ overflow: 'hidden', borderBottom: '1px solid #0d0d0d', padding: '8px 0', marginBottom: '1.75rem', position: 'relative' }}>
      <div style={{ display: 'flex', width: 'max-content', animation: 'tickerScroll 50s linear infinite' }}>
        {items.map((m, i) => {
          const up = m.pct >= 0;
          return (
            <span
              key={i}
              onClick={() => onMoverClick(m)}
              style={{ marginRight: '2.2rem', fontSize: '0.68rem', fontWeight: '700', letterSpacing: '0.05em', whiteSpace: 'nowrap', cursor: 'pointer' }}
              title={`Open ${m.symbol} chart`}
            >
              <span style={{ color: '#555', transition: 'color 0.15s' }}
                onMouseEnter={e => e.currentTarget.style.color = '#aaa'}
                onMouseLeave={e => e.currentTarget.style.color = '#555'}
              >{m.symbol.replace('-USD', '/USD')}</span>
              <span style={{ color: up ? '#44cc44' : '#ff4444', marginLeft: '5px' }}>{up ? '▲' : '▼'} {Math.abs(m.pct).toFixed(2)}%</span>
            </span>
          );
        })}
      </div>
      <div style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: '60px', background: 'linear-gradient(to left, #020202, transparent)', pointerEvents: 'none' }} />
    </div>
  );
}

function EditPanel({ userId, sessionToken, selectedAssets, thresholds, onSave, onClose }) {
  const [editAssets, setEditAssets] = useState([...selectedAssets]);
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const timerRef = useRef(null);
  const searchDivRef = useRef(null);

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
    setEditAssets(prev => prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]);
    if (searchDivRef.current) { searchDivRef.current.textContent = ''; }
    setSearchResults([]);
  };

  const save = async () => {
    setSaving(true);
    const assets = editAssets.map(s => ({ symbol: s, threshold: thresholds[s] ?? 2.0 }));
    try {
      await fetch(`${API_BASE}/api/update-assets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: parseInt(userId), assets, session_token: sessionToken || '' }),
      });
      onSave(editAssets);
    } catch (e) { console.error(e); }
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div style={{ background: '#0a0a0a', border: '1px solid #222', borderRadius: '20px', padding: '2rem', width: '420px', maxHeight: '80vh', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: '700' }}>Manage Watchlist</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#666', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ position: 'relative' }}>
          <div
            ref={searchDivRef}
            contentEditable="plaintext-only"
            suppressContentEditableWarning
            data-placeholder="Search stock or crypto..."
            onInput={e => handleSearch(e.currentTarget.textContent || '')}
            dir="auto"
            style={{ width: '100%', padding: '0.85rem 1rem', background: '#111', border: '1px solid #2a2a2a', borderRadius: '12px', color: '#fff', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif', minHeight: '1.4em', cursor: 'text', whiteSpace: 'nowrap', overflowX: 'hidden' }}
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
          {editAssets.length === 0
            ? <p style={{ color: '#333', fontSize: '0.82rem', textAlign: 'center', padding: '1.5rem 0' }}>No assets selected</p>
            : <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                {editAssets.map(s => (
                  <div key={s} onClick={() => toggle(s)} style={{ padding: '5px 12px', borderRadius: '20px', background: 'rgba(255,51,51,0.12)', border: '1px solid #ff333355', color: '#ff5555', fontSize: '0.8rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {s} <span style={{ fontSize: '0.7rem', opacity: 0.7 }}>✕</span>
                  </div>
                ))}
              </div>
          }
        </div>
        <button onClick={save} disabled={saving || editAssets.length < 1}
          style={{ padding: '0.9rem', background: editAssets.length >= 1 ? '#ff3333' : '#1a1a1a', border: 'none', borderRadius: '12px', color: editAssets.length >= 1 ? '#fff' : '#444', fontWeight: '700', cursor: editAssets.length >= 1 ? 'pointer' : 'not-allowed', fontSize: '0.9rem' }}>
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>
    </div>
  );
}

export default function MainTerminal({ userId, sessionToken, selectedAssets, onSignOut, onSessionReplaced, onAssetsUpdate, isNative, onNavigateToZone, onNavigateToSettings, onNavigateToScanner }) {
  const [thresholds, setThresholds] = useState({});
  const [prices, setPrices] = useState({});
  const [history, setHistory] = useState({});
  const [avgVolumes, setAvgVolumes] = useState({});
  const [rvols, setRvols] = useState({});
  const [alerts, setAlerts] = useState(() => {
    try { return JSON.parse(localStorage.getItem('sultrax_alerts') || '[]'); }
    catch { return []; }
  });
  const [lastUpdate, setLastUpdate] = useState(null);
  const [loading, setLoading] = useState(true);
  const [wsStatus, setWsStatus] = useState('connecting');
  const [editing, setEditing] = useState(false);
  const [flashing, setFlashing] = useState({});
  const [expandedCard, setExpandedCard] = useState(null);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [savedCard, setSavedCard] = useState(null);
  const [customValues, setCustomValues] = useState({});
  const [expandedSignal, setExpandedSignal] = useState(null);
  const [activeTab, setActiveTab] = useState('assets');
  const [flashOn, setFlashOn] = useState(false);
  const mountTimeRef = useRef(Date.now());
  const wsPingRef = useRef(null);
  const lastUpdateTsRef = useRef(0);
  const [soundMuted, setSoundMuted] = useState(() => localStorage.getItem('sultrax_sound_muted') === 'true');
  const soundMutedRef = useRef(soundMuted);
  const audioCtxRef = useRef(null);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const audioUnlockedRef = useRef(false);
  const [chartSym, setChartSym] = useState(null);
  const chartSymRef = useRef(null);
  const chartCallbackRef = useRef(null);

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectCountRef = useRef(0);
  const flashTimersRef = useRef({});
  const sessionBaselineRef = useRef({});   // first price of the trading day per symbol
  const dailyLevelsFiredRef = useRef({});  // which threshold multiples fired today per symbol
  const watchlistRef = useRef(selectedAssets);
  const thresholdsRef = useRef(thresholds);
  const pricesRef = useRef(prices);
  const avgVolumesRef = useRef({});
  const volumeTrackingRef = useRef({});
  const lastRvolUpdateRef = useRef(0);

  useEffect(() => { watchlistRef.current = selectedAssets; }, [selectedAssets]);
  useEffect(() => { thresholdsRef.current = thresholds; }, [thresholds]);
  useEffect(() => { pricesRef.current = prices; }, [prices]);
  useEffect(() => { avgVolumesRef.current = avgVolumes; }, [avgVolumes]);
  useEffect(() => { chartSymRef.current = chartSym; }, [chartSym]);

  useEffect(() => {
    soundMutedRef.current = soundMuted;
    localStorage.setItem('sultrax_sound_muted', soundMuted);
  }, [soundMuted]);

  useEffect(() => {
    const unlock = () => {
      if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume().then(() => {
          if (!audioUnlockedRef.current) {
            audioUnlockedRef.current = true;
            setAudioUnlocked(true);
          }
        });
      } else {
        if (!audioUnlockedRef.current) {
          audioUnlockedRef.current = true;
          setAudioUnlocked(true);
        }
      }
    };
    window.addEventListener('click', unlock);
    window.addEventListener('touchstart', unlock);
    return () => { window.removeEventListener('click', unlock); window.removeEventListener('touchstart', unlock); };
  }, []);

  const _getCtx = useCallback(async () => {
    if (!audioCtxRef.current) audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtxRef.current.state === 'suspended') await audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  // Signal alert — ascending "di-ding" (880 → 1175 Hz)
  const playBeep = useCallback(() => {
    if (soundMutedRef.current) return;
    _getCtx().then(ctx => {
      try {
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator(); const g1 = ctx.createGain();
        osc1.connect(g1); g1.connect(ctx.destination);
        osc1.type = 'sine'; osc1.frequency.value = 880;
        g1.gain.setValueAtTime(0.28, now);
        g1.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        osc1.start(now); osc1.stop(now + 0.12);

        const osc2 = ctx.createOscillator(); const g2 = ctx.createGain();
        osc2.connect(g2); g2.connect(ctx.destination);
        osc2.type = 'sine'; osc2.frequency.value = 1175;
        g2.gain.setValueAtTime(0, now);
        g2.gain.setValueAtTime(0.3, now + 0.1);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
        osc2.start(now); osc2.stop(now + 0.55);
      } catch {}
    }).catch(() => {});
  }, [_getCtx]);

  // Price alert — single descending bell (1040 → 660 Hz), softer
  const playPriceBeep = useCallback(() => {
    if (soundMutedRef.current) return;
    _getCtx().then(ctx => {
      try {
        const now = ctx.currentTime;
        const osc1 = ctx.createOscillator(); const g1 = ctx.createGain();
        osc1.connect(g1); g1.connect(ctx.destination);
        osc1.type = 'sine'; osc1.frequency.value = 1040;
        g1.gain.setValueAtTime(0.22, now);
        g1.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
        osc1.start(now); osc1.stop(now + 0.18);

        const osc2 = ctx.createOscillator(); const g2 = ctx.createGain();
        osc2.connect(g2); g2.connect(ctx.destination);
        osc2.type = 'sine'; osc2.frequency.value = 660;
        g2.gain.setValueAtTime(0, now);
        g2.gain.setValueAtTime(0.25, now + 0.15);
        g2.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
        osc2.start(now); osc2.stop(now + 0.6);
      } catch {}
    }).catch(() => {});
  }, [_getCtx]);

  useEffect(() => {
    localStorage.setItem('sultrax_alerts', JSON.stringify(alerts));
  }, [alerts]);

  useEffect(() => {
    const id = setInterval(() => {
      const hasNew = alerts.some(a => {
        const ts = parseInt((a.id || '').split('-').pop());
        return !isNaN(ts) && ts >= mountTimeRef.current && Date.now() - ts < 60000;
      });
      if (hasNew) setFlashOn(v => !v);
      else setFlashOn(false);
    }, 500);
    return () => clearInterval(id);
  }, [alerts]);

  const lastSoundIdRef = useRef(null);
  useEffect(() => {
    const newest = alerts.find(a => a.type === 'signal');
    if (!newest) return;
    const ts = parseInt((newest.id || '').split('-').pop());
    if (!isNaN(ts) && ts >= mountTimeRef.current && newest.id !== lastSoundIdRef.current) {
      lastSoundIdRef.current = newest.id;
      playBeep();
    }
  }, [alerts, playBeep]);

  const lastPriceSoundIdRef = useRef(null);
  useEffect(() => {
    const newest = alerts.find(a => a.type === 'price');
    if (!newest) return;
    const ts = parseInt((newest.id || '').split('-').pop());
    if (!isNaN(ts) && ts >= mountTimeRef.current && newest.id !== lastPriceSoundIdRef.current) {
      lastPriceSoundIdRef.current = newest.id;
      playPriceBeep();
    }
  }, [alerts, playPriceBeep]);

  useEffect(() => {
    selectedAssets.forEach(sym => {
      if (!volumeTrackingRef.current[sym]) {
        volumeTrackingRef.current[sym] = {
          emaVol: 0, emaVar: 0, tradeCount: 0,
          vwapNum: 0, vwapDen: 0, vwapDate: new Date().toISOString().slice(0, 10),
          flowWindow: [],
          lastPrice: null,
          lastDir: null,
          pendingConfirmation: null,
          lastSignalTime: 0,
          trades5m: [],
          priceHistory: [],            // [{price, time}] rolling 10-min buffer
          momentumCooldown: { up: 0, down: 0 }, // last spike alert time per direction
        };
      }
    });
  }, [selectedAssets]);

  // Single init call: thresholds + history + avg-volumes in one round-trip.
  // Re-runs when assets change. History refreshes every 5 min via interval.
  useEffect(() => {
    if (!userId || !selectedAssets.length) return;
    const load = () =>
      fetch(`${API_BASE}/api/init?user_id=${userId}&session_token=${encodeURIComponent(sessionToken || '')}`)
        .then(r => r.json())
        .then(data => {
          setThresholds(data.thresholds || {});
          setHistory(data.history || {});
          setAvgVolumes(data.avg_volumes || {});
          setLoading(false);
        })
        .catch(() => setLoading(false));
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [userId, selectedAssets.join(','), sessionToken]);

  // Heartbeat — tracks online users + validates session token.
  // 401 means another device logged in and replaced this session → force sign-out.
  useEffect(() => {
    if (!userId) return;
    const ping = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: parseInt(userId), session_token: sessionToken || '' }),
        });
        if (res.status === 401) {
          onSessionReplaced?.();
        }
      } catch {}
    };
    ping();
    const id = setInterval(ping, 60000);
    return () => clearInterval(id);
  }, [userId, sessionToken, onSessionReplaced]);

  const triggerFlash = (sym, dir) => {
    if (flashTimersRef.current[sym]) return;
    setFlashing(prev => ({ ...prev, [sym]: dir }));
    flashTimersRef.current[sym] = setTimeout(() => {
      delete flashTimersRef.current[sym];
      setFlashing(prev => { const n = { ...prev }; delete n[sym]; return n; });
    }, 700);
  };

  const connectWS = (symbols) => {
    clearTimeout(reconnectTimerRef.current);
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }

    setWsStatus('connecting');
    // Connect to backend relay — backend owns the single Finnhub WS connection
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${proto}//${window.location.host}/ws/prices`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectCountRef.current = 0;
      setWsStatus('live');
      symbols.forEach(sym => ws.send(JSON.stringify({ type: 'subscribe', symbol: toFinnhubSym(sym) })));
      // Keepalive ping every 25s — prevents Finnhub from closing idle connections
      clearInterval(wsPingRef.current);
      wsPingRef.current = setInterval(() => {
        if (wsRef.current?.readyState === WebSocket.OPEN)
          wsRef.current.send(JSON.stringify({ type: 'ping' }));
      }, 25000);
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type !== 'trade' || !msg.data?.length) return;

      const now = Date.now();
      // Compute once per batch — never inside the trade loop
      const today = new Date(now).toISOString().slice(0, 10);
      const latestPriceByFinnhub = {};
      const newAlerts = [];
      const rvolUpdates = {};

      // ── PROCESS EACH TRADE INDIVIDUALLY ──
      msg.data.forEach(trade => {
        const sym = fromFinnhubSym(trade.s, watchlistRef.current);
        if (!sym) return;

        const price = trade.p;
        const vol = trade.v || 0;

        latestPriceByFinnhub[trade.s] = price;

        const tracking = volumeTrackingRef.current[sym];
        if (!tracking || vol <= 0) return;

        // VWAP — reset daily at midnight UTC
        if (tracking.vwapDate !== today) {
          tracking.vwapNum = 0;
          tracking.vwapDen = 0;
          tracking.vwapDate = today;
        }
        tracking.vwapNum += price * vol;
        tracking.vwapDen += vol;
        const vwap = tracking.vwapDen > 0 ? tracking.vwapNum / tracking.vwapDen : price;

        // Live chart feed
        if (chartSymRef.current === sym && chartCallbackRef.current) {
          chartCallbackRef.current(price, now);
        }

        // RVOL badge — trim front in-place, no new array created
        tracking.trades5m.push({ vol, time: now });
        const cut5m = now - 300000;
        while (tracking.trades5m.length > 0 && tracking.trades5m[0].time < cut5m)
          tracking.trades5m.shift();
        const avgVol = avgVolumesRef.current[sym];
        if (avgVol > 0) {
          const avgVol5m = (avgVol / (sym.endsWith('-USD') ? 1440 : 390)) * 5;
          const cur5m = tracking.trades5m.reduce((s, t) => s + t.vol, 0);
          rvolUpdates[sym] = parseFloat((avgVol5m > 0 ? cur5m / avgVol5m : 0).toFixed(2));
        }

        // Price history buffer — trim front in-place, cap at 600 entries (~60s for BTC)
        tracking.priceHistory.push({ price, time: now });
        const cut10m = now - 600000;
        while (tracking.priceHistory.length > 0 && tracking.priceHistory[0].time < cut10m)
          tracking.priceHistory.shift();
        if (tracking.priceHistory.length > 600)
          tracking.priceHistory.splice(0, tracking.priceHistory.length - 600);

        // Trade direction
        const dir = tracking.lastPrice !== null
          ? (price > tracking.lastPrice ? 'buy' : price < tracking.lastPrice ? 'sell' : (tracking.lastDir || 'buy'))
          : 'buy';
        tracking.lastDir = dir;
        tracking.lastPrice = price;

        // Order flow window (rolling 30s) — trim front in-place
        tracking.flowWindow.push({ dir, time: now });
        const cut30s = now - 30000;
        while (tracking.flowWindow.length > 0 && tracking.flowWindow[0].time < cut30s)
          tracking.flowWindow.shift();

        // EWMA mean and variance (α=0.1 → ~10 trade window)
        // Variance tracked directly to avoid catastrophic cancellation from E[X²]-(E[X])²
        const α = 0.1;
        const prevEmaVol = tracking.emaVol;
        const prevEmaVar = tracking.emaVar;
        if (tracking.tradeCount === 0) {
          tracking.emaVol = vol;
          tracking.emaVar = 0;
        } else {
          const diff = vol - prevEmaVol;
          tracking.emaVol = α * vol + (1 - α) * prevEmaVol;
          tracking.emaVar = α * diff * diff + (1 - α) * prevEmaVar;
        }
        tracking.tradeCount++;

        // Signal detection
        if (tracking.tradeCount < 20) return;
        if (now - tracking.lastSignalTime < 3 * 60 * 1000) return;

        const std = Math.sqrt(prevEmaVar);
        if (std < 0.001) return;

        const z = (vol - prevEmaVol) / std;
        if (z < 2.5) return;

        // ── CONVICTION SCORE (raw 0–90) ──
        let score = 0;

        // Z-score component (max 40)
        if (z >= 5.0) score += 40;
        else if (z >= 3.5) score += 30;
        else score += 20;

        // Order flow component (max 30)
        const buyCount = tracking.flowWindow.filter(t => t.dir === 'buy').length;
        const flowRatio = tracking.flowWindow.length > 3
          ? buyCount / tracking.flowWindow.length : 0.5;
        const isBuy = dir === 'buy';
        if (isBuy && flowRatio >= 0.65) score += 30;
        else if (!isBuy && flowRatio <= 0.35) score += 30;
        else if (isBuy && flowRatio >= 0.55) score += 15;
        else if (!isBuy && flowRatio <= 0.45) score += 15;

        // VWAP alignment (max 20, -10 counter-VWAP penalty)
        if (isBuy && price >= vwap) score += 20;
        else if (!isBuy && price <= vwap) score += 20;
        else score = Math.max(0, score - 10);

        if (score < 40) return;

        // Normalize to 0–100 scale (raw max is 90)
        const displayScore = Math.round((score / 90) * 100);

        tracking.lastSignalTime = now;
        const alertId = `${sym}-${now}`;
        const strengthLabel = score >= 80
          ? (isBuy ? 'STRONG BUY' : 'STRONG SELL')
          : score >= 60 ? (isBuy ? 'BUY' : 'SELL') : (isBuy ? 'WEAK BUY' : 'WEAK SELL');

        newAlerts.push({
          type: 'signal', id: alertId,
          symbol: sym, dir: isBuy ? 'buy' : 'sell',
          score: displayScore, strengthLabel,
          volMultiplier: parseFloat((vol / prevEmaVol).toFixed(1)),
          flowRatio: parseFloat(flowRatio.toFixed(2)),
          price, vwap: parseFloat(vwap.toFixed(2)),
          time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          confirmed: null, priceImpact: null,
        });

        tracking.pendingConfirmation = {
          alertId, entryPrice: price,
          dir: isBuy ? 'buy' : 'sell',
          deadline: now + 30000,
        };
      });

      // ── PRICE UPDATES + PRICE ALERTS ──
      const priceUpdates = {};
      const flashUpdates = {};
      Object.entries(latestPriceByFinnhub).forEach(([finnhubSym, newPrice]) => {
        const sym = fromFinnhubSym(finnhubSym, watchlistRef.current);
        if (!sym) return;

        const prev = pricesRef.current[sym];
        const prevClose = prev?.prev_close ?? newPrice;
        const changePct = prevClose ? ((newPrice - prevClose) / prevClose) * 100 : 0;
        priceUpdates[sym] = {
          price: newPrice,
          change_pct: parseFloat(changePct.toFixed(4)),
          prev_close: prevClose,
        };

        if (prev?.price !== undefined && Math.abs(newPrice - prev.price) > 0.0001) {
          flashUpdates[sym] = newPrice > prev.price ? 'up' : 'down';
        }

        const priceThreshold = thresholdsRef.current[sym] ?? 2.0;

        // ── LAYER 1: DAILY MOVE ALERT ──
        // Measures from session open (first price of the day). Fires once per threshold
        // multiple per direction — e.g. at 2%, 4%, 6% if threshold=2%. Resets each day.
        if (!sessionBaselineRef.current[sym] || sessionBaselineRef.current[sym].date !== today) {
          sessionBaselineRef.current[sym] = { price: newPrice, date: today };
        }
        const sessionBase = sessionBaselineRef.current[sym].price;
        const dailyMove = ((newPrice - sessionBase) / sessionBase) * 100;
        const dailyLevel = Math.floor(Math.abs(dailyMove) / priceThreshold);

        if (dailyLevel >= 1) {
          if (!dailyLevelsFiredRef.current[sym] || dailyLevelsFiredRef.current[sym].date !== today) {
            dailyLevelsFiredRef.current[sym] = { date: today, up: new Set(), down: new Set() };
          }
          const firedLevels = dailyLevelsFiredRef.current[sym];
          const dailyDir = dailyMove >= 0 ? 'up' : 'down';

          if (!firedLevels[dailyDir].has(dailyLevel)) {
            firedLevels[dailyDir].add(dailyLevel);
            newAlerts.push({
              type: 'price', subtype: 'daily',
              id: `price-${sym}-${now}`,
              symbol: sym,
              pct: parseFloat(dailyMove.toFixed(2)),
              price: newPrice,
              level: dailyLevel,
              threshold: priceThreshold,
              time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            });
          }
        }

        // ── LAYER 2: MOMENTUM SPIKE ALERT ──
        // Detects short-term acceleration: if price moved >= threshold/4 in the last 5 min,
        // fire a SPIKE alert. Cooldown: 5 min per direction to prevent spam.
        const tracking = volumeTrackingRef.current[sym];
        if (tracking) {
          const spikeThreshold = Math.max(priceThreshold / 4, 0.25);
          // Reference price: newest point in the 4.5–6 min window
          // Iterate from end (newest) — no array copy, no reverse()
          const hist = tracking.priceHistory;
          let ref5m = null;
          for (let i = hist.length - 1; i >= 0; i--) {
            const age = now - hist[i].time;
            if (age < 270000) continue;
            if (age <= 360000) { ref5m = hist[i]; break; }
            break;
          }
          if (ref5m) {
            const momentum5m = ((newPrice - ref5m.price) / ref5m.price) * 100;
            const spikeDir = momentum5m >= 0 ? 'up' : 'down';
            const cooldownMs = 5 * 60 * 1000;
            if (Math.abs(momentum5m) >= spikeThreshold && (now - tracking.momentumCooldown[spikeDir]) > cooldownMs) {
              tracking.momentumCooldown[spikeDir] = now;
              newAlerts.push({
                type: 'price', subtype: 'spike',
                id: `spike-${sym}-${now}`,
                symbol: sym,
                pct: parseFloat(momentum5m.toFixed(2)),
                price: newPrice,
                threshold: spikeThreshold,
                time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
              });
            }
          }
        }
      });

      if (!Object.keys(priceUpdates).length) return;

      // Only trigger re-render if at least one price value actually changed
      const prevPrices = pricesRef.current;
      const changed = Object.entries(priceUpdates).some(
        ([sym, data]) => !prevPrices[sym] || prevPrices[sym].price !== data.price
      );
      if (changed) {
        setPrices(prev => ({ ...prev, ...priceUpdates }));
      }
      pricesRef.current = { ...pricesRef.current, ...priceUpdates };

      Object.entries(flashUpdates).forEach(([sym, dir]) => triggerFlash(sym, dir));
      if (newAlerts.length) setAlerts(prev => [...newAlerts, ...prev].slice(0, 100));
      // Throttle to 1 re-render/sec — Finnhub can send 10+ messages/sec for BTC
      if (now - lastUpdateTsRef.current > 1000) {
        lastUpdateTsRef.current = now;
        setLastUpdate(new Date(now));
      }
      setLoading(false);

      if (Object.keys(rvolUpdates).length > 0 && now - lastRvolUpdateRef.current > 5000) {
        lastRvolUpdateRef.current = now;
        setRvols(prev => ({ ...prev, ...rvolUpdates }));
      }
    };

    ws.onerror = () => ws.close();
    ws.onclose = () => {
      clearInterval(wsPingRef.current);
      setWsStatus('reconnecting');
      // Never stop retrying — cap backoff at 30s after 10 attempts
      reconnectCountRef.current++;
      const delay = Math.min(3000 * Math.min(reconnectCountRef.current, 10), 30000);
      reconnectTimerRef.current = setTimeout(() => connectWS(watchlistRef.current), delay);
    };
  };

  // Price impact confirmation: 30s after signal, check if price moved in signal direction
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const updates = {};
      Object.entries(volumeTrackingRef.current).forEach(([sym, tracking]) => {
        if (!tracking.pendingConfirmation) return;
        const { alertId, entryPrice, dir, deadline } = tracking.pendingConfirmation;
        if (now < deadline) return;
        tracking.pendingConfirmation = null;
        const currentPrice = pricesRef.current[sym]?.price;
        if (!currentPrice) return;
        const impact = ((currentPrice - entryPrice) / entryPrice) * 100;
        const directedImpact = dir === 'buy' ? impact : -impact;
        updates[alertId] = {
          priceImpact: parseFloat(impact.toFixed(3)),
          confirmed: directedImpact >= 0.05,
        };
      });
      if (Object.keys(updates).length > 0) {
        setAlerts(prev => prev.map(a => {
          const u = updates[a.id];
          if (!u) return a;
          return { ...a, priceImpact: u.priceImpact, confirmed: u.confirmed };
        }));
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedAssets.length) return;
    let cancelled = false;

    // Connect WebSocket directly to backend relay (no API-key roundtrip needed)
    connectWS(selectedAssets);

    // Fetch initial price snapshot in parallel (memory-read on backend, ~5ms)
    fetch(`${API_BASE}/api/prices?symbols=${selectedAssets.join(',')}`)
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        const initial = data.prices || {};
        pricesRef.current = { ...pricesRef.current, ...initial };
        setPrices(prev => ({ ...prev, ...initial }));
        setLoading(false);
      })
      .catch(() => setLoading(false));

    return () => {
      cancelled = true;
      clearInterval(wsPingRef.current);
      clearTimeout(reconnectTimerRef.current);
      Object.values(flashTimersRef.current).forEach(clearTimeout);
      flashTimersRef.current = {};
      if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); wsRef.current = null; }
    };
  }, [selectedAssets]);

  const updateThreshold = async (sym, value) => {
    setSavingThreshold(true);
    const newThresholds = { ...thresholds, [sym]: value };
    const assets = selectedAssets.map(s => ({ symbol: s, threshold: newThresholds[s] ?? 2.0 }));
    try {
      const res = await fetch(`${API_BASE}/api/update-assets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: parseInt(userId), assets, session_token: sessionToken || '' }),
      });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      setThresholds(newThresholds);
      setSavedCard(sym);
      setTimeout(() => { setSavedCard(null); setExpandedCard(null); }, 900);
    } catch (e) {
      console.error('Failed to save threshold:', e);
      alert('Failed to save. Check connection.');
    }
    setSavingThreshold(false);
  };

  const getStatus = (sym) => {
    const p = prices[sym];
    if (!p) return { label: 'LOADING', color: '#444' };
    const abs = Math.abs(p.change_pct || 0);
    const t = thresholds[sym] ?? 2.0;
    if (abs >= t) return { label: 'ALERT', color: '#ff3333' };
    if (abs >= t * 0.5) return { label: 'MOVING', color: '#ff9900' };
    return { label: 'CALM', color: '#44cc44' };
  };

  const getRvolStyle = (rvol) => {
    if (!rvol || rvol < 1.5) return null;
    if (rvol >= 5) return { color: '#ff6600', bg: 'rgba(255,102,0,0.1)', border: 'rgba(255,102,0,0.3)', icon: '🔥' };
    if (rvol >= 3) return { color: '#ff9900', bg: 'rgba(255,153,0,0.1)', border: 'rgba(255,153,0,0.25)', icon: '⚡' };
    return { color: '#666', bg: 'transparent', border: 'transparent', icon: '' };
  };

  const statusDot = wsStatus === 'live' ? '#44cc44' : wsStatus === 'reconnecting' ? '#ff9900' : '#555';
  const statusLabel = wsStatus === 'live' ? 'LIVE' : wsStatus === 'reconnecting' ? 'RECONNECTING' : 'CONNECTING';

  const signals = alerts.filter(a => a.type === 'signal');
  const priceAlerts = alerts.filter(a => a.type === 'price');

  const sharedModals = (
    <>
      {editing && (
        <EditPanel userId={userId} sessionToken={sessionToken} selectedAssets={selectedAssets} thresholds={thresholds}
          onSave={(newAssets) => { onAssetsUpdate(newAssets); setEditing(false); }}
          onClose={() => setEditing(false)} />
      )}
      {chartSym && (
        <ChartModal sym={chartSym} price={prices[chartSym]} rvol={rvols[chartSym]}
          symAlerts={alerts.filter(a => a.symbol === chartSym)}
          onClose={() => { setChartSym(null); chartCallbackRef.current = null; }}
          onRegisterLive={cb => { chartCallbackRef.current = cb; }} />
      )}
    </>
  );

  // ── NATIVE MOBILE LAYOUT ──
  if (isNative) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: '#020202', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <style>{`
          @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
          @keyframes fadeIn { from{opacity:0;transform:translateY(-5px)} to{opacity:1;transform:translateY(0)} }
          @keyframes newSignal { 0%,100%{box-shadow:none} 50%{box-shadow:0 0 0 2px #ff3333,0 0 16px rgba(255,51,51,0.5)} }
          ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }
        `}</style>
        {sharedModals}

        {/* ── Native Header ── */}
        <div style={{ paddingTop: '56px', paddingLeft: '20px', paddingRight: '20px', paddingBottom: '14px', background: '#020202', borderBottom: '1px solid #0f0f0f', flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', letterSpacing: '0.07em', color: '#fff' }}>TERMINAL</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '3px' }}>
              <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: statusDot, animation: wsStatus === 'live' ? 'pulse 2s infinite' : 'none', boxShadow: wsStatus === 'live' ? `0 0 6px ${statusDot}` : 'none' }} />
              <span style={{ fontSize: '0.62rem', color: statusDot, fontWeight: '700', letterSpacing: '0.06em' }}>{statusLabel}</span>
              {lastUpdate && <span style={{ fontSize: '0.58rem', color: '#2a2a2a' }}>· {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={() => setEditing(true)} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1e1e1e', color: '#666', padding: '7px 13px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600' }}>
              + LIST
            </button>
            <button onClick={onNavigateToZone} style={{ background: 'rgba(68,136,255,0.08)', border: '1px solid rgba(68,136,255,0.2)', color: '#4488ff', padding: '7px 13px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '700' }}>
              ZONE
            </button>
            <button onClick={onNavigateToSettings} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #2a2a2a', color: '#666', padding: '7px 13px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '700' }}>
              ⚙
            </button>
            <button onClick={onSignOut} style={{ background: 'rgba(255,51,51,0.07)', border: '1px solid rgba(255,51,51,0.18)', color: '#ff4444', padding: '7px 13px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '700' }}>
              OUT
            </button>
          </div>
        </div>

        {/* ── Tab content ── */}
        <div style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden' }}>

          {/* ASSETS */}
          {activeTab === 'assets' && (
            <div style={{ padding: '14px 16px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {selectedAssets.map(sym => {
                const p = prices[sym];
                const status = getStatus(sym);
                const pct = p?.change_pct;
                const t = thresholds[sym] ?? 2.0;
                const barWidth = Math.min(100, (Math.abs(pct || 0) / t) * 100);
                const flash = flashing[sym];
                const cardBg = flash === 'up' ? 'rgba(68,204,68,0.07)' : flash === 'down' ? 'rgba(255,68,68,0.07)' : '#0a0a0a';
                const priceColor = flash === 'up' ? '#44cc44' : flash === 'down' ? '#ff4444' : '#fff';
                const rvolStyle = getRvolStyle(rvols[sym]);
                return (
                  <div key={sym}
                    style={{ background: cardBg, border: '1px solid #111', borderLeft: `3px solid ${status.color}`, borderRadius: '14px', padding: '14px 16px', cursor: 'pointer', transition: 'background 0.2s', animation: 'fadeIn 0.3s ease', boxShadow: status.label === 'ALERT' ? `0 0 20px ${status.color}12` : 'none' }}
                    onClick={() => setChartSym(sym)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '7px', flexWrap: 'wrap' }}>
                          <span style={{ fontWeight: '800', fontSize: '0.95rem', color: '#fff' }}>{sym}</span>
                          <span style={{ fontSize: '0.6rem', fontWeight: '700', color: status.color, background: `${status.color}18`, padding: '2px 8px', borderRadius: '20px' }}>{status.label}</span>
                          {rvolStyle && <span style={{ fontSize: '0.58rem', fontWeight: '700', color: rvolStyle.color }}>{rvolStyle.icon} {rvols[sym].toFixed(1)}x</span>}
                          <button onClick={e => { e.stopPropagation(); setExpandedCard(prev => prev === sym ? null : sym); }}
                            style={{ background: 'none', border: 'none', color: expandedCard === sym ? '#aaa' : '#2a2a2a', cursor: 'pointer', fontSize: '0.88rem', marginLeft: 'auto', padding: '2px 4px', lineHeight: 1 }}>⚙</button>
                        </div>
                        <div style={{ fontSize: '1.55rem', fontWeight: '800', fontVariantNumeric: 'tabular-nums', color: priceColor, transition: 'color 0.15s', lineHeight: 1.1 }}>
                          {p ? `$${fmtPrice(p.price)}` : '—'}
                        </div>
                        <div style={{ fontSize: '0.82rem', fontWeight: '600', color: pct > 0 ? '#44cc44' : pct < 0 ? '#ff4444' : '#444', marginTop: '2px' }}>
                          {pct != null ? `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%` : '—'}
                        </div>
                      </div>
                      <div style={{ width: '110px', marginTop: '2px', flexShrink: 0 }}>
                        <Sparkline sym={sym} prices={history[sym]} />
                      </div>
                    </div>
                    <div style={{ marginTop: '10px', height: '2px', background: '#1a1a1a', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${barWidth}%`, height: '100%', background: status.color, transition: 'width 0.4s' }} />
                    </div>
                    <div style={{ fontSize: '0.6rem', color: '#2a2a2a', marginTop: '3px' }}>{barWidth.toFixed(0)}% of {t}% threshold</div>

                    {expandedCard === sym && (
                      <div onClick={e => e.stopPropagation()} style={{ marginTop: '12px', paddingTop: '12px', borderTop: '1px solid #1a1a1a' }}>
                        <div style={{ fontSize: '0.62rem', color: '#444', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.07em' }}>Alert sensitivity</div>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {SENSITIVITY_LEVELS.map(lvl => {
                            const active = t === lvl.value;
                            return (
                              <button key={lvl.value} onClick={() => !savingThreshold && updateThreshold(sym, lvl.value)}
                                style={{ flex: 1, padding: '0.5rem 0.25rem', borderRadius: '8px', border: `1px solid ${active ? lvl.color : '#2a2a2a'}`, background: active ? `${lvl.color}20` : 'transparent', color: active ? lvl.color : '#444', cursor: 'pointer', fontSize: '0.68rem', fontWeight: active ? '700' : '400' }}>
                                <div>{savedCard === sym && active ? '✓' : lvl.label}</div>
                                <div style={{ fontSize: '0.6rem', opacity: 0.75 }}>{lvl.desc}</div>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* SIGNALS */}
          {activeTab === 'signals' && (
            <div style={{ padding: '14px 16px 20px' }}>
              <div style={{ fontSize: '0.65rem', color: '#333', lineHeight: 1.6, marginBottom: '12px', padding: '6px 10px', borderLeft: '2px solid #1e1e1e' }}>
                Signals are statistical anomalies in order flow — not investment advice. Trade at your own risk.
              </div>
              {!audioUnlocked && !soundMuted && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(255,153,0,0.08)', border: '1px solid rgba(255,153,0,0.2)', borderRadius: '8px', padding: '7px 12px', marginBottom: '10px', fontSize: '0.7rem', color: '#ff9900' }}>
                  <span>🔔</span>
                  <span style={{ flex: 1 }}>Click anywhere to enable alert sounds</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: '700', color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Signal Feed</span>
                  {signals.length > 0 && <span style={{ fontSize: '0.62rem', background: 'rgba(255,153,0,0.15)', color: '#ff9900', padding: '1px 7px', borderRadius: '8px', fontWeight: '700' }}>{signals.length}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button onClick={() => setSoundMuted(m => !m)} title={soundMuted ? 'Unmute' : 'Mute'} style={{ background: 'none', border: 'none', color: soundMuted ? '#333' : '#666', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 4px', lineHeight: 1 }}>{soundMuted ? '🔇' : '🔔'}</button>
                  {signals.length > 0 && <button onClick={() => setAlerts(prev => prev.filter(a => a.type !== 'signal'))} style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: '0.75rem', padding: '2px 6px' }}>Clear</button>}
                </div>
              </div>
              {signals.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '5rem 1rem' }}>
                  <div style={{ fontSize: '2.2rem', marginBottom: '1rem' }}>📡</div>
                  <p style={{ color: '#2a2a2a', fontSize: '0.82rem', margin: 0, lineHeight: 1.7 }}>Scanning for anomalous<br />order flow activity.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {signals.map((a, i) => {
                    const isBuy = a.dir === 'buy';
                    const score = a.score || 0;
                    const accent = isBuy ? '#ff9900' : '#ff4444';
                    const rowKey = a.id || `sig-${i}`;
                    const isExpanded = expandedSignal === rowKey;
                    const confirmIcon = a.confirmed === null ? '⏳' : a.confirmed ? '✓' : '↔';
                    const confirmColor = a.confirmed === null ? '#555' : a.confirmed ? '#44cc44' : '#666';
                    const label = a.strengthLabel || (score >= 80 ? (isBuy ? 'STRONG BUY' : 'STRONG SELL') : score >= 60 ? (isBuy ? 'BUY' : 'SELL') : (isBuy ? 'WEAK BUY' : 'WEAK SELL'));
                    const sigTs = parseInt((a.id || '').split('-').pop());
                    const isFlashing = !isExpanded && !isNaN(sigTs) && sigTs >= mountTimeRef.current && Date.now() - sigTs < 60000;
                    return (
                      <div key={rowKey} onClick={() => setExpandedSignal(isExpanded ? null : rowKey)}
                        style={{ padding: '12px 14px', borderRadius: '12px', background: isExpanded ? (isBuy ? 'rgba(255,153,0,0.07)' : 'rgba(255,68,68,0.07)') : (isFlashing && flashOn ? 'rgba(255,51,51,0.07)' : '#0d0d0d'), border: `1px solid ${isFlashing && flashOn ? '#ff3333' : isExpanded ? accent + '44' : '#1a1a1a'}`, boxShadow: isFlashing && flashOn ? '0 0 10px rgba(255,51,51,0.4)' : 'none', cursor: 'pointer', animation: i === 0 && !isFlashing ? 'fadeIn 0.3s ease' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span>{isBuy ? '🐋' : '🔴'}</span>
                            <span style={{ fontWeight: '700', color: '#e8e8e8', fontSize: '0.9rem' }}>{a.symbol}</span>
                            <span style={{ fontSize: '0.63rem', fontWeight: '700', color: accent, background: `${accent}18`, padding: '2px 8px', borderRadius: '6px' }}>{label}</span>
                          </div>
                          <span style={{ fontSize: '0.62rem', color: '#444' }}>{a.time}</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '8px' }}>
                          {a.price != null && <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#bbb', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>${fmtPrice(a.price)}</span>}
                          <div style={{ flex: 1, height: '3px', background: '#1a1a1a', borderRadius: '2px', overflow: 'hidden' }}>
                            <div style={{ width: `${score}%`, height: '100%', background: `linear-gradient(to right, ${accent}66, ${accent})` }} />
                          </div>
                          <span style={{ fontSize: '0.65rem', color: '#666', flexShrink: 0 }}>{score}/100</span>
                          <span style={{ fontSize: '0.62rem', color: '#444', flexShrink: 0 }}>×{a.volMultiplier ?? '–'}</span>
                          <span style={{ fontSize: '0.75rem', color: confirmColor, flexShrink: 0 }}>{confirmIcon}</span>
                        </div>
                        {isExpanded && (
                          <div style={{ marginTop: '12px', paddingTop: '12px', borderTop: `1px solid ${accent}22` }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                              {[['Entry price', a.price != null ? `$${fmtPrice(a.price)}` : '—'], ['Volume spike', `×${a.volMultiplier ?? '–'} above avg`], ['Order flow', `${Math.round((a.flowRatio || 0) * 100)}% buyers`], ['vs VWAP', `${(a.price || 0) >= (a.vwap || 0) ? 'above ↑' : 'below ↓'} avg`]].map(([lbl, val]) => (
                                <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '0.72rem', color: '#444' }}>{lbl}</span>
                                  <span style={{ fontSize: '0.72rem', color: lbl === 'Entry price' ? '#ddd' : '#888', fontWeight: '600' }}>{val}</span>
                                </div>
                              ))}
                              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '6px', borderTop: `1px solid ${accent}18` }}>
                                <span style={{ fontSize: '0.72rem', color: '#444' }}>Result</span>
                                <span style={{ fontSize: '0.72rem', fontWeight: '600', color: confirmColor }}>
                                  {a.confirmed === null ? '⏳ Confirming…' : a.confirmed ? `✓ +${Math.abs(a.priceImpact || 0).toFixed(2)}%` : `↔ ${(a.priceImpact || 0).toFixed(2)}%`}
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ALERTS */}
          {activeTab === 'alerts' && (
            <div style={{ padding: '14px 16px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.68rem', fontWeight: '700', color: '#444', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Price Alerts</span>
                  {priceAlerts.length > 0 && <span style={{ fontSize: '0.62rem', background: 'rgba(255,51,51,0.15)', color: '#ff4444', padding: '1px 7px', borderRadius: '8px', fontWeight: '700' }}>{priceAlerts.length}</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button onClick={() => setSoundMuted(m => !m)} title={soundMuted ? 'Unmute' : 'Mute'} style={{ background: 'none', border: 'none', color: soundMuted ? '#333' : '#666', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 4px', lineHeight: 1 }}>{soundMuted ? '🔇' : '🔔'}</button>
                  {priceAlerts.length > 0 && <button onClick={() => setAlerts(prev => prev.filter(a => a.type !== 'price'))} style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: '0.75rem', padding: '2px 6px' }}>Clear</button>}
                </div>
              </div>
              {priceAlerts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '5rem 1rem' }}>
                  <div style={{ fontSize: '2.2rem', marginBottom: '1rem' }}>🔔</div>
                  <p style={{ color: '#2a2a2a', fontSize: '0.82rem', margin: 0, lineHeight: 1.7 }}>Alerts fire when daily move crosses<br />your threshold, or spikes in 5 min.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {priceAlerts.map((a, i) => {
                    const accent = a.pct > 0 ? '#44cc44' : '#ff4444';
                    const isSpike = a.subtype === 'spike';
                    const spikeColor = '#ff9900';
                    const badgeColor = isSpike ? spikeColor : accent;
                    const alertTs = parseInt((a.id || '').split('-').pop());
                    const isFlashing = !isNaN(alertTs) && alertTs >= mountTimeRef.current && Date.now() - alertTs < 60000;
                    const flashAccent = isSpike ? spikeColor : accent;
                    const barPct = isSpike
                      ? Math.min(100, (Math.abs(a.pct) / a.threshold) * 100)
                      : Math.min(100, ((Math.abs(a.pct) / a.threshold) % 1 || 1) * 100);
                    return (
                      <div key={a.id || i}
                        style={{ padding: '14px', borderRadius: '12px', background: isFlashing && flashOn ? `${flashAccent}0f` : '#0d0d0d', border: `1px solid ${isFlashing && flashOn ? flashAccent : '#1a1a1a'}`, boxShadow: isFlashing && flashOn ? `0 0 10px ${flashAccent}44` : 'none', transition: 'border-color 0.25s, box-shadow 0.25s', animation: i === 0 && !isFlashing ? 'fadeIn 0.3s ease' : 'none' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.78rem' }}>{isSpike ? '⚡' : a.pct > 0 ? '▲' : '▼'}</span>
                            <span style={{ fontWeight: '700', color: '#e8e8e8', fontSize: '0.9rem' }}>{a.symbol}</span>
                            <span style={{ fontSize: '0.58rem', fontWeight: '800', color: badgeColor, background: `${badgeColor}18`, padding: '1px 6px', borderRadius: '5px', letterSpacing: '0.07em' }}>
                              {isSpike ? 'SPIKE' : `DAILY ×${a.level ?? 1}`}
                            </span>
                          </div>
                          <span style={{ fontSize: '0.62rem', color: '#444' }}>{a.time}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                          <span style={{ color: accent, fontSize: '0.88rem', fontWeight: '700' }}>
                            {a.pct > 0 ? '+' : ''}{a.pct.toFixed(2)}%
                          </span>
                          <span style={{ color: '#444', fontSize: '0.68rem' }}>
                            ${fmtPrice(a.price)} · {isSpike ? `${a.threshold.toFixed(2)}% / 5m` : `${a.threshold}% thr`}
                          </span>
                        </div>
                        <div style={{ height: '3px', background: '#1a1a1a', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${barPct}%`, height: '100%', background: `linear-gradient(to right, ${badgeColor}66, ${badgeColor})`, borderRadius: '2px' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Bottom tab bar ── */}
        <div style={{ flexShrink: 0, display: 'flex', background: '#070707', borderTop: '1px solid #0f0f0f', paddingBottom: '30px' }}>
          {[
            { id: 'assets',  label: 'ASSETS',  count: 0 },
            { id: 'signals', label: 'SIGNALS', count: signals.length },
            { id: 'alerts',  label: 'ALERTS',  count: priceAlerts.length },
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '13px 0 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '0.62rem', fontWeight: '700', letterSpacing: '0.1em', color: activeTab === tab.id ? '#fff' : '#333', transition: 'color 0.15s' }}>{tab.label}</span>
              {tab.count > 0 && (
                <span style={{ fontSize: '0.55rem', background: tab.id === 'signals' ? '#ff9900' : '#ff3333', color: '#fff', padding: '1px 6px', borderRadius: '8px', fontWeight: '700', lineHeight: 1.5 }}>{tab.count}</span>
              )}
              <div style={{ width: '20px', height: '2px', background: activeTab === tab.id ? '#ff3333' : 'transparent', borderRadius: '1px', transition: 'background 0.15s', marginTop: '2px' }} />
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ── WEB LAYOUT ──
  return (
    <div style={{ width: '100%', padding: '0 2rem 4rem', color: '#fff' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        @keyframes tickerScroll { 0%{transform:translateX(0)} 100%{transform:translateX(-33.333%)} }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
      `}</style>

      {sharedModals}

      <TopMoversTicker onMoverClick={(m) => {
        setPrices(prev => prev[m.symbol] ? prev : {
          ...prev,
          [m.symbol]: { price: m.price, change_pct: m.pct, prev_close: m.prev_close }
        });
        setChartSym(m.symbol);
      }} />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '1.75rem', position: 'relative' }}>
        <div style={{ flex: 1 }}>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '900', margin: 0, letterSpacing: '0.06em', background: 'linear-gradient(to right, #fff 50%, #555)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TERMINAL</h2>
          <p style={{ color: '#333', margin: '0.2rem 0 0', fontSize: '0.72rem' }}>
            {loading ? 'Loading…' : lastUpdate ? `Last trade ${lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Waiting for trades…'}
          </p>
        </div>
        <div style={{ position: 'absolute', left: '50%', transform: 'translateX(-50%)', display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: statusDot, animation: wsStatus === 'live' ? 'pulse 2s infinite' : 'none', boxShadow: wsStatus === 'live' ? `0 0 8px ${statusDot}` : 'none' }} />
            <span style={{ fontSize: '0.68rem', color: statusDot, fontWeight: '700', letterSpacing: '0.08em' }}>{statusLabel}</span>
            <span style={{ fontSize: '0.65rem', color: '#2a2a2a' }}>· {selectedAssets.length} assets</span>
          </div>
          <button onClick={() => setEditing(true)}
            style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #222', color: '#666', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '600' }}>
            + Watchlist
          </button>
        </div>
        <div style={{ flex: 1 }} />
      </div>

      <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'flex-start' }}>
        {/* ── WATCHLIST ── */}
        <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: '14px' }}>
          {selectedAssets.map(sym => {
            const p = prices[sym];
            const status = getStatus(sym);
            const pct = p?.change_pct;
            const t = thresholds[sym] ?? 2.0;
            const barWidth = Math.min(100, (Math.abs(pct || 0) / t) * 100);
            const flash = flashing[sym];
            const cardBg = flash === 'up' ? 'rgba(68,204,68,0.09)' : flash === 'down' ? 'rgba(255,68,68,0.09)' : 'rgba(8,8,8,0.85)';
            const priceColor = flash === 'up' ? '#44cc44' : flash === 'down' ? '#ff4444' : '#fff';
            const rvolStyle = getRvolStyle(rvols[sym]);

            return (
              <div key={sym} style={{ background: cardBg, border: `1px solid ${status.color}22`, borderLeft: `3px solid ${status.color}`, borderRadius: '16px', padding: '1.25rem', backdropFilter: 'blur(12px)', transition: 'background 0.2s ease, border-color 0.4s', animation: 'fadeIn 0.35s ease', boxShadow: status.label === 'ALERT' ? `0 0 24px ${status.color}18, 0 2px 8px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.3)', cursor: 'pointer', alignSelf: 'flex-start' }}
                onClick={() => setChartSym(sym)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{sym}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '700', color: status.color, background: `${status.color}18`, padding: '3px 8px', borderRadius: '20px' }}>
                      {status.label}
                    </span>
                    <button onClick={e => { e.stopPropagation(); setExpandedCard(prev => prev === sym ? null : sym); }}
                      style={{ background: 'none', border: 'none', color: expandedCard === sym ? '#fff' : '#444', cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1, padding: '2px' }}>
                      ⚙
                    </button>
                  </div>
                </div>

                {rvolStyle && (
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.6rem', fontWeight: '700', color: rvolStyle.color, background: rvolStyle.bg, border: `1px solid ${rvolStyle.border}`, padding: '2px 7px', borderRadius: '8px', marginBottom: '0.4rem' }}>
                    {rvolStyle.icon} {rvols[sym].toFixed(1)}x VOL
                  </div>
                )}

                <div style={{ fontSize: '1.45rem', fontWeight: '800', fontVariantNumeric: 'tabular-nums', color: priceColor, transition: 'color 0.15s ease' }}>
                  {p ? `$${fmtPrice(p.price)}` : '—'}
                </div>
                <div style={{ fontSize: '0.82rem', fontWeight: '600', color: pct > 0 ? '#44cc44' : pct < 0 ? '#ff4444' : '#666', marginBottom: '0.6rem' }}>
                  {pct != null ? `${pct > 0 ? '+' : ''}${pct.toFixed(2)}%` : '—'}
                </div>

                <Sparkline sym={sym} prices={history[sym]} />

                <div style={{ marginTop: '0.75rem', height: '3px', background: '#111', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ width: `${barWidth}%`, height: '100%', background: status.color, borderRadius: '2px', transition: 'width 0.4s ease' }} />
                </div>
                <div style={{ fontSize: '0.62rem', color: '#444', marginTop: '0.35rem' }}>
                  {barWidth.toFixed(0)}% of {t}% threshold
                </div>

                {expandedCard === sym && (
                  <div onClick={e => e.stopPropagation()} style={{ marginTop: '0.85rem', paddingTop: '0.85rem', borderTop: '1px solid #1a1a1a' }}>
                    <div style={{ fontSize: '0.65rem', color: '#555', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                      Alert on move ≥ <span style={{ color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{t}%</span>
                    </div>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '0.5rem' }}>
                      {SENSITIVITY_LEVELS.map(lvl => {
                        const active = t === lvl.value;
                        return (
                          <button key={lvl.value} onClick={() => !savingThreshold && updateThreshold(sym, lvl.value)}
                            style={{ flex: 1, padding: '0.45rem 0.2rem', borderRadius: '8px', border: `1px solid ${active ? lvl.color : '#2a2a2a'}`, background: active ? `${lvl.color}20` : 'transparent', color: active ? lvl.color : '#555', cursor: savingThreshold ? 'wait' : 'pointer', fontSize: '0.68rem', fontWeight: active ? '700' : '400', transition: '0.15s' }}>
                            <div>{savedCard === sym && active ? '✓' : lvl.label}</div>
                            <div style={{ fontSize: '0.6rem', opacity: 0.75 }}>{lvl.desc}</div>
                          </button>
                        );
                      })}
                    </div>
                    {(() => {
                      const raw = customValues[sym] ?? '';
                      const num = parseFloat(raw);
                      const valid = raw !== '' && !isNaN(num) && num >= 0.3 && num <= 20;
                      const outOfRange = raw !== '' && !isNaN(num) && (num < 0.3 || num > 20);
                      return (
                        <>
                          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                            <input type="number" min="0.3" max="20" step="0.1" placeholder="e.g. 1.5" value={raw}
                              onChange={e => setCustomValues(prev => ({ ...prev, [sym]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter' && valid) updateThreshold(sym, num); }}
                              style={{ flex: 1, padding: '0.4rem 0.6rem', background: '#111', border: `1px solid ${outOfRange ? '#ff3333' : '#2a2a2a'}`, borderRadius: '8px', color: outOfRange ? '#ff4444' : '#fff', fontSize: '0.78rem', outline: 'none', width: '0' }} />
                            <button onClick={() => valid && !savingThreshold && updateThreshold(sym, num)}
                              style={{ padding: '0.4rem 0.7rem', borderRadius: '8px', border: `1px solid ${valid ? '#555' : '#2a2a2a'}`, background: 'transparent', color: valid ? '#fff' : '#444', cursor: valid ? 'pointer' : 'default', fontSize: '0.72rem', fontWeight: '600', whiteSpace: 'nowrap' }}>
                              Set %
                            </button>
                          </div>
                          {outOfRange && <div style={{ fontSize: '0.62rem', color: '#ff4444', marginTop: '4px' }}>Range: 0.3% – 20%</div>}
                          {!outOfRange && <div style={{ fontSize: '0.62rem', color: '#333', marginTop: '4px' }}>Custom range: 0.3% – 20%</div>}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── RIGHT COLUMN ── */}
        <div style={{ width: '300px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '14px', position: 'sticky', top: '80px', alignSelf: 'flex-start', maxHeight: 'calc(100vh - 100px)', overflowY: 'auto' }}>
          <div style={{ background: '#0a0a0a', borderRadius: '16px', border: '1px solid #1c1c1c', padding: '1rem 1rem 0.75rem', flexShrink: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '0.7rem', fontWeight: '700', color: '#444', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Signal Feed</h3>
                {signals.length > 0 && <span style={{ fontSize: '0.62rem', background: 'rgba(255,153,0,0.15)', color: '#ff9900', padding: '1px 7px', borderRadius: '8px', fontWeight: '700' }}>{signals.length}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button onClick={() => setSoundMuted(m => !m)} title={soundMuted ? 'Unmute' : 'Mute'} style={{ background: 'none', border: 'none', color: soundMuted ? '#333' : '#666', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 4px', lineHeight: 1 }}>{soundMuted ? '🔇' : '🔔'}</button>
                {signals.length > 0 && <button onClick={() => setAlerts(prev => prev.filter(a => a.type !== 'signal'))} style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: '0.72rem', padding: '2px 4px' }}>✕</button>}
              </div>
            </div>
            {signals.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
                <div style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>📡</div>
                <p style={{ color: '#2a2a2a', fontSize: '0.73rem', margin: 0, lineHeight: 1.6 }}>Scanning for anomalous<br />order flow activity.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '320px', overflowY: 'auto', paddingBottom: '0.25rem' }}>
                {signals.map((a, i) => {
                  const isBuy = a.dir === 'buy';
                  const score = a.score || 0;
                  const accent = isBuy ? '#ff9900' : '#ff4444';
                  const rowKey = a.id || `sig-${i}`;
                  const isExpanded = expandedSignal === rowKey;
                  const confirmIcon = a.confirmed === null ? '⏳' : a.confirmed ? '✓' : '↔';
                  const confirmColor = a.confirmed === null ? '#555' : a.confirmed ? '#44cc44' : '#666';
                  const label = a.strengthLabel || (score >= 80 ? (isBuy ? 'STRONG BUY' : 'STRONG SELL') : score >= 60 ? (isBuy ? 'BUY' : 'SELL') : (isBuy ? 'WEAK BUY' : 'WEAK SELL'));
                  const sigTs = parseInt((a.id || '').split('-').pop());
                  const isFlashing = !isExpanded && !isNaN(sigTs) && sigTs >= mountTimeRef.current && Date.now() - sigTs < 60000;
                  return (
                    <div key={rowKey} onClick={() => setExpandedSignal(isExpanded ? null : rowKey)}
                      style={{ padding: '0.65rem 0.75rem', borderRadius: '10px', background: isExpanded ? (isBuy ? 'rgba(255,153,0,0.07)' : 'rgba(255,68,68,0.07)') : (isFlashing && flashOn ? 'rgba(255,51,51,0.07)' : '#111'), border: `1px solid ${isFlashing && flashOn ? '#ff3333' : isExpanded ? accent + '44' : '#1e1e1e'}`, boxShadow: isFlashing && flashOn ? '0 0 10px rgba(255,51,51,0.4)' : 'none', cursor: 'pointer', animation: i === 0 && !isFlashing ? 'fadeIn 0.3s ease' : 'none' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                          <span style={{ fontSize: '0.78rem' }}>{isBuy ? '🐋' : '🔴'}</span>
                          <span style={{ fontWeight: '700', color: '#e8e8e8', fontSize: '0.85rem' }}>{a.symbol}</span>
                          <span style={{ fontSize: '0.62rem', fontWeight: '700', color: accent, background: `${accent}18`, padding: '1px 6px', borderRadius: '5px' }}>{label}</span>
                        </div>
                        <span style={{ fontSize: '0.6rem', color: '#444', flexShrink: 0 }}>{a.time}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '6px' }}>
                        {a.price != null && <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#bbb', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>${fmtPrice(a.price)}</span>}
                        <div style={{ flex: 1, height: '3px', background: '#1a1a1a', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${score}%`, height: '100%', background: `linear-gradient(to right, ${accent}66, ${accent})`, borderRadius: '2px' }} />
                        </div>
                        <span style={{ fontSize: '0.63rem', color: '#666', whiteSpace: 'nowrap', flexShrink: 0 }}>{score}/100</span>
                        <span style={{ fontSize: '0.6rem', color: '#444', whiteSpace: 'nowrap', flexShrink: 0 }}>×{a.volMultiplier ?? '–'}</span>
                        <span style={{ fontSize: '0.7rem', color: confirmColor, flexShrink: 0 }}>{confirmIcon}</span>
                      </div>
                      {isExpanded && (
                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: `1px solid ${accent}22` }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {[['Entry price', a.price != null ? `$${fmtPrice(a.price)}` : '—'], ['Volume spike', `×${a.volMultiplier ?? '–'} above avg`], ['Order flow', `${Math.round((a.flowRatio || 0) * 100)}% buyers`], ['vs VWAP', `${(a.price || 0) >= (a.vwap || 0) ? 'above ↑' : 'below ↓'} avg`]].map(([lbl, val]) => (
                              <div key={lbl} style={{ display: 'flex', justifyContent: 'space-between' }}>
                                <span style={{ fontSize: '0.65rem', color: '#444' }}>{lbl}</span>
                                <span style={{ fontSize: '0.65rem', color: lbl === 'Entry price' ? '#ddd' : '#888', fontWeight: '600' }}>{val}</span>
                              </div>
                            ))}
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '5px', borderTop: `1px solid ${accent}18` }}>
                              <span style={{ fontSize: '0.65rem', color: '#444' }}>Result</span>
                              <span style={{ fontSize: '0.65rem', fontWeight: '600', color: confirmColor }}>
                                {a.confirmed === null ? '⏳ Confirming…' : a.confirmed ? `✓ +${Math.abs(a.priceImpact || 0).toFixed(2)}%` : `↔ ${(a.priceImpact || 0).toFixed(2)}%`}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div style={{ background: '#0a0a0a', borderRadius: '16px', border: '1px solid #1c1c1c', padding: '1rem 1rem 0.75rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '0.7rem', fontWeight: '700', color: '#444', letterSpacing: '0.12em', textTransform: 'uppercase' }}>Price Alerts</h3>
                {priceAlerts.length > 0 && <span style={{ fontSize: '0.62rem', background: 'rgba(255,51,51,0.15)', color: '#ff4444', padding: '1px 7px', borderRadius: '8px', fontWeight: '700' }}>{priceAlerts.length}</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <button onClick={() => setSoundMuted(m => !m)} title={soundMuted ? 'Unmute' : 'Mute'} style={{ background: 'none', border: 'none', color: soundMuted ? '#333' : '#666', cursor: 'pointer', fontSize: '0.8rem', padding: '2px 4px', lineHeight: 1 }}>{soundMuted ? '🔇' : '🔔'}</button>
                {priceAlerts.length > 0 && <button onClick={() => setAlerts(prev => prev.filter(a => a.type !== 'price'))} style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: '0.72rem', padding: '2px 4px' }}>✕</button>}
              </div>
            </div>
            {priceAlerts.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
                <div style={{ fontSize: '1.4rem', marginBottom: '0.4rem' }}>🔔</div>
                <p style={{ color: '#2a2a2a', fontSize: '0.73rem', margin: 0, lineHeight: 1.6 }}>Alerts fire when daily move crosses<br />your threshold, or spikes in 5 min.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', maxHeight: '260px', overflowY: 'auto', paddingBottom: '0.25rem' }}>
                {priceAlerts.map((a, i) => {
                  const accent = a.pct > 0 ? '#44cc44' : '#ff4444';
                  const isSpike = a.subtype === 'spike';
                  const spikeColor = '#ff9900';
                  const badgeColor = isSpike ? spikeColor : accent;
                  const alertTs = parseInt((a.id || '').split('-').pop());
                  const isFlashing = !isNaN(alertTs) && alertTs >= mountTimeRef.current && Date.now() - alertTs < 60000;
                  const flashAccent = isSpike ? spikeColor : accent;
                  // Progress bar: daily → % of threshold band; spike → % of spike threshold
                  const barPct = isSpike
                    ? Math.min(100, (Math.abs(a.pct) / a.threshold) * 100)
                    : Math.min(100, ((Math.abs(a.pct) / a.threshold) % 1 || 1) * 100);
                  return (
                    <div key={a.id || i}
                      style={{ padding: '0.65rem 0.75rem', borderRadius: '10px', background: isFlashing && flashOn ? `${flashAccent}0f` : '#111', border: `1px solid ${isFlashing && flashOn ? flashAccent : '#1e1e1e'}`, boxShadow: isFlashing && flashOn ? `0 0 10px ${flashAccent}44` : 'none', animation: i === 0 && !isFlashing ? 'fadeIn 0.3s ease' : 'none', transition: 'border-color 0.25s, box-shadow 0.25s' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.78rem' }}>{isSpike ? '⚡' : a.pct > 0 ? '▲' : '▼'}</span>
                          <span style={{ fontWeight: '700', color: '#e8e8e8', fontSize: '0.85rem' }}>{a.symbol}</span>
                          <span style={{ fontSize: '0.58rem', fontWeight: '800', color: badgeColor, background: `${badgeColor}18`, padding: '1px 6px', borderRadius: '5px', letterSpacing: '0.07em' }}>
                            {isSpike ? 'SPIKE' : `DAILY ×${a.level ?? 1}`}
                          </span>
                          <span style={{ fontSize: '0.62rem', fontWeight: '700', color: accent }}>{a.pct > 0 ? '+' : ''}{a.pct.toFixed(2)}%</span>
                        </div>
                        <span style={{ fontSize: '0.6rem', color: '#444', flexShrink: 0 }}>{a.time}</span>
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                        <span style={{ fontSize: '0.72rem', fontWeight: '700', color: '#bbb', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>${fmtPrice(a.price)}</span>
                        <div style={{ flex: 1, height: '3px', background: '#1a1a1a', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ width: `${barPct}%`, height: '100%', background: `linear-gradient(to right, ${badgeColor}66, ${badgeColor})`, borderRadius: '2px' }} />
                        </div>
                        <span style={{ fontSize: '0.6rem', color: '#555', flexShrink: 0 }}>
                          {isSpike ? `${a.threshold.toFixed(2)}% / 5m` : `${a.threshold}% thr`}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
