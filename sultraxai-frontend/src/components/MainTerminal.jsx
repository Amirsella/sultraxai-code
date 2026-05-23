import React, { useState, useEffect, useRef } from 'react';

const API_BASE = 'http://38.180.137.122:8000';

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

function ChartModal({ sym, price, rvol, symAlerts, onClose }) {
  const [activeInterval, setActiveInterval] = useState('5');
  const containerId = `tv_${sym.replace(/[^a-zA-Z0-9]/g, '_')}`;

  useEffect(() => {
    const el = document.getElementById(containerId);
    if (el) el.innerHTML = '';

    const init = () => {
      if (!window.TradingView || !document.getElementById(containerId)) return;
      new window.TradingView.widget({
        container_id: containerId,
        symbol: toTVSymbol(sym),
        interval: activeInterval,
        theme: 'dark',
        style: '1',
        width: '100%',
        height: 420,
        hide_side_toolbar: false,
        allow_symbol_change: false,
        save_image: false,
        locale: 'en',
        backgroundColor: '#070707',
        gridColor: 'rgba(255,255,255,0.03)',
        hide_top_toolbar: false,
      });
    };

    if (window.TradingView) {
      init();
    } else if (!document.getElementById('tv-script')) {
      const s = document.createElement('script');
      s.id = 'tv-script';
      s.src = 'https://s3.tradingview.com/tv.js';
      s.async = true;
      s.onload = init;
      document.head.appendChild(s);
    } else {
      const wait = setInterval(() => { if (window.TradingView) { clearInterval(wait); init(); } }, 100);
    }
  }, [sym, activeInterval]);

  const p = price;
  const signals = (symAlerts || []).filter(a => a.type === 'signal').slice(0, 4);
  const priceEvts = (symAlerts || []).filter(a => a.type === 'price').slice(0, 3);

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.88)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.25rem' }}>
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

        {/* Interval bar */}
        <div style={{ display: 'flex', gap: '4px', padding: '0.6rem 1.5rem', background: '#050505', borderBottom: '1px solid #0d0d0d' }}>
          {TV_INTERVALS.map(({ label, value }) => (
            <button key={value} onClick={() => setActiveInterval(value)}
              style={{ padding: '4px 16px', borderRadius: '7px', border: `1px solid ${activeInterval === value ? '#333' : '#111'}`, background: activeInterval === value ? '#1c1c1c' : 'transparent', color: activeInterval === value ? '#fff' : '#3a3a3a', cursor: 'pointer', fontSize: '0.72rem', fontWeight: activeInterval === value ? '700' : '500', transition: '0.15s' }}>
              {label}
            </button>
          ))}
        </div>

        {/* TradingView chart */}
        <div style={{ flex: 1, minHeight: 0 }}>
          <div id={containerId} style={{ width: '100%', height: '420px' }} />
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

function Sparkline({ sym, prices }) {
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
}

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

  const toggle = (sym) =>
    setEditAssets(prev => prev.includes(sym) ? prev.filter(s => s !== sym) : [...prev, sym]);

  const save = async () => {
    setSaving(true);
    const assets = editAssets.map(s => ({ symbol: s, threshold: thresholds[s] ?? 2.0 }));
    try {
      await fetch(`${API_BASE}/api/update-assets`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: parseInt(userId), assets }),
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
          <input type="text" placeholder="Search stock or crypto..." onChange={e => handleSearch(e.target.value)}
            style={{ width: '100%', padding: '0.85rem 1rem', background: '#111', border: '1px solid #2a2a2a', borderRadius: '12px', color: '#fff', outline: 'none', boxSizing: 'border-box', fontSize: '0.9rem' }} />
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

export default function MainTerminal({ userId, selectedAssets, onSignOut, onAssetsUpdate }) {
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
  const [chartSym, setChartSym] = useState(null);

  const wsRef = useRef(null);
  const reconnectTimerRef = useRef(null);
  const reconnectCountRef = useRef(0);
  const flashTimersRef = useRef({});
  const baselinePricesRef = useRef({});
  const lastAlertTimeRef = useRef({});
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

  useEffect(() => {
    localStorage.setItem('sultrax_alerts', JSON.stringify(alerts));
  }, [alerts]);

  useEffect(() => {
    selectedAssets.forEach(sym => {
      if (!volumeTrackingRef.current[sym]) {
        volumeTrackingRef.current[sym] = {
          emaVol: 0, emaVolSq: 0, tradeCount: 0,
          vwapNum: 0, vwapDen: 0,
          flowWindow: [],
          lastPrice: null,
          pendingConfirmation: null,
          lastSignalTime: 0,
          trades5m: [],
        };
      }
    });
  }, [selectedAssets]);

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

  useEffect(() => {
    if (!selectedAssets.length) return;
    const load = () =>
      fetch(`${API_BASE}/api/history-batch?symbols=${selectedAssets.join(',')}`)
        .then(r => r.json())
        .then(data => setHistory(data.history || {}))
        .catch(() => {});
    load();
    const id = setInterval(load, 5 * 60 * 1000);
    return () => clearInterval(id);
  }, [selectedAssets]);

  // Load historical average volumes for RVOL calculation
  useEffect(() => {
    if (!selectedAssets.length) return;
    fetch(`${API_BASE}/api/avg-volume?symbols=${selectedAssets.join(',')}`)
      .then(r => r.json())
      .then(data => setAvgVolumes(data.volumes || {}))
      .catch(() => {});
  }, [selectedAssets]);

  const triggerFlash = (sym, dir) => {
    if (flashTimersRef.current[sym]) return;
    setFlashing(prev => ({ ...prev, [sym]: dir }));
    flashTimersRef.current[sym] = setTimeout(() => {
      delete flashTimersRef.current[sym];
      setFlashing(prev => { const n = { ...prev }; delete n[sym]; return n; });
    }, 700);
  };

  const connectWS = (key, symbols) => {
    clearTimeout(reconnectTimerRef.current);
    if (wsRef.current) { wsRef.current.onclose = null; wsRef.current.close(); }

    setWsStatus('connecting');
    const ws = new WebSocket(`wss://ws.finnhub.io?token=${key}`);
    wsRef.current = ws;

    ws.onopen = () => {
      reconnectCountRef.current = 0;
      setWsStatus('live');
      symbols.forEach(sym => ws.send(JSON.stringify({ type: 'subscribe', symbol: toFinnhubSym(sym) })));
    };

    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type !== 'trade' || !msg.data?.length) return;

      const now = Date.now();
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

        // VWAP
        tracking.vwapNum += price * vol;
        tracking.vwapDen += vol;
        const vwap = tracking.vwapDen > 0 ? tracking.vwapNum / tracking.vwapDen : price;

        // RVOL badge
        tracking.trades5m.push({ vol, time: now });
        tracking.trades5m = tracking.trades5m.filter(t => now - t.time < 5 * 60 * 1000);
        const avgVol = avgVolumesRef.current[sym];
        if (avgVol > 0) {
          const avgVol5m = (avgVol / (sym.endsWith('-USD') ? 1440 : 390)) * 5;
          const cur5m = tracking.trades5m.reduce((s, t) => s + t.vol, 0);
          rvolUpdates[sym] = parseFloat((avgVol5m > 0 ? cur5m / avgVol5m : 0).toFixed(2));
        }

        // Trade direction
        const dir = tracking.lastPrice !== null
          ? (price >= tracking.lastPrice ? 'buy' : 'sell') : 'buy';
        tracking.lastPrice = price;

        // Order flow window (rolling 30s)
        tracking.flowWindow.push({ dir, time: now });
        tracking.flowWindow = tracking.flowWindow.filter(t => now - t.time < 30000);

        // Z-score EMA (α=0.1 → ~10 trade window)
        const α = 0.1;
        if (tracking.tradeCount === 0) {
          tracking.emaVol = vol;
          tracking.emaVolSq = vol * vol;
        } else {
          tracking.emaVol = α * vol + (1 - α) * tracking.emaVol;
          tracking.emaVolSq = α * vol * vol + (1 - α) * tracking.emaVolSq;
        }
        tracking.tradeCount++;

        // Signal detection
        if (tracking.tradeCount < 20) return;
        if (now - tracking.lastSignalTime < 3 * 60 * 1000) return;

        const variance = Math.max(0, tracking.emaVolSq - tracking.emaVol * tracking.emaVol);
        const std = Math.sqrt(variance);
        if (std < 0.001) return;

        const z = (vol - tracking.emaVol) / std;
        if (z < 2.5) return;

        // ── CONVICTION SCORE ──
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

        tracking.lastSignalTime = now;
        const alertId = `${sym}-${now}`;
        const strengthLabel = score >= 80
          ? (isBuy ? 'STRONG BUY' : 'STRONG SELL')
          : score >= 60 ? (isBuy ? 'BUY' : 'SELL') : 'NOTABLE';

        newAlerts.push({
          type: 'signal', id: alertId,
          symbol: sym, dir: isBuy ? 'buy' : 'sell',
          score, strengthLabel,
          volMultiplier: parseFloat((vol / tracking.emaVol).toFixed(1)),
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
        const baseline = baselinePricesRef.current[sym] ?? newPrice;
        const moveFromBaseline = baseline ? ((newPrice - baseline) / baseline) * 100 : 0;
        const lastAlertTime = lastAlertTimeRef.current[sym] ?? 0;
        if (Math.abs(moveFromBaseline) >= priceThreshold && (now - lastAlertTime) > 30000) {
          baselinePricesRef.current[sym] = newPrice;
          lastAlertTimeRef.current[sym] = now;
          newAlerts.push({
            type: 'price', symbol: sym,
            pct: moveFromBaseline, price: newPrice,
            time: new Date(now).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            threshold: priceThreshold,
          });
        }
      });

      if (!Object.keys(priceUpdates).length) return;
      setPrices(prev => ({ ...prev, ...priceUpdates }));
      pricesRef.current = { ...pricesRef.current, ...priceUpdates };
      Object.entries(flashUpdates).forEach(([sym, dir]) => triggerFlash(sym, dir));
      if (newAlerts.length) setAlerts(prev => [...newAlerts, ...prev].slice(0, 100));
      setLastUpdate(new Date(now));
      setLoading(false);

      if (Object.keys(rvolUpdates).length > 0 && now - lastRvolUpdateRef.current > 5000) {
        lastRvolUpdateRef.current = now;
        setRvols(prev => ({ ...prev, ...rvolUpdates }));
      }
    };

    ws.onerror = () => ws.close();
    ws.onclose = () => {
      setWsStatus('reconnecting');
      if (reconnectCountRef.current < 10) {
        reconnectCountRef.current++;
        const delay = Math.min(3000 * reconnectCountRef.current, 30000);
        reconnectTimerRef.current = setTimeout(() => connectWS(key, watchlistRef.current), delay);
      }
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
          bonus: directedImpact >= 0.1 ? 10 : directedImpact >= 0.05 ? 5 : 0,
        };
      });
      if (Object.keys(updates).length > 0) {
        setAlerts(prev => prev.map(a => {
          const u = updates[a.id];
          if (!u) return a;
          return { ...a, priceImpact: u.priceImpact, confirmed: u.confirmed, score: Math.min(100, (a.score || 0) + u.bonus) };
        }));
      }
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!selectedAssets.length) return;
    let cancelled = false;

    fetch(`${API_BASE}/api/config`)
      .then(r => r.json())
      .then(cfg => fetch(`${API_BASE}/api/prices?symbols=${selectedAssets.join(',')}`)
        .then(r => r.json())
        .then(data => {
          if (cancelled) return;
          const initial = data.prices || {};
          pricesRef.current = initial;
          Object.entries(initial).forEach(([sym, p]) => {
            if (baselinePricesRef.current[sym] === undefined && p.prev_close) {
              baselinePricesRef.current[sym] = p.prev_close;
            }
          });
          setPrices(initial);
          setLoading(false);
          connectWS(cfg.finnhub_key, selectedAssets);
        })
      )
      .catch(err => { console.error('Init error:', err); setLoading(false); });

    return () => {
      cancelled = true;
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
        body: JSON.stringify({ user_id: parseInt(userId), assets }),
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

  return (
    <div style={{ width: '100%', padding: '0 2rem 4rem', color: '#fff' }}>
      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes fadeIn { from{opacity:0;transform:translateY(-6px)} to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar { width: 4px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #2a2a2a; border-radius: 2px; }
      `}</style>

      {editing && (
        <EditPanel
          userId={userId} selectedAssets={selectedAssets} thresholds={thresholds}
          onSave={(newAssets) => { onAssetsUpdate(newAssets); setEditing(false); }}
          onClose={() => setEditing(false)}
        />
      )}

      {chartSym && (
        <ChartModal
          sym={chartSym}
          price={prices[chartSym]}
          rvol={rvols[chartSym]}
          symAlerts={alerts.filter(a => a.symbol === chartSym)}
          onClose={() => setChartSym(null)}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.75rem', paddingTop: '1.5rem' }}>
        <div>
          <h2 style={{ fontSize: '1.6rem', fontWeight: '900', margin: 0, letterSpacing: '0.06em', background: 'linear-gradient(to right, #fff 50%, #555)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>TERMINAL</h2>
          <p style={{ color: '#333', margin: '0.2rem 0 0', fontSize: '0.72rem' }}>
            {loading ? 'Loading…' : lastUpdate ? `Last trade ${lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : 'Waiting for trades…'}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              <div key={sym} style={{ background: cardBg, border: `1px solid ${status.color}22`, borderLeft: `3px solid ${status.color}`, borderRadius: '16px', padding: '1.25rem', backdropFilter: 'blur(12px)', transition: 'background 0.2s ease, border-color 0.4s', animation: 'fadeIn 0.35s ease', boxShadow: status.label === 'ALERT' ? `0 0 24px ${status.color}18, 0 2px 8px rgba(0,0,0,0.4)` : '0 2px 8px rgba(0,0,0,0.3)', cursor: 'pointer' }}
                onClick={() => setChartSym(sym)}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                  <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{sym}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.65rem', fontWeight: '700', color: status.color, background: `${status.color}18`, padding: '3px 8px', borderRadius: '20px' }}>
                      {status.label}
                    </span>
                    <button onClick={e => { e.stopPropagation(); setExpandedCard(expandedCard === sym ? null : sym); }}
                      style={{ background: 'none', border: 'none', color: expandedCard === sym ? '#fff' : '#444', cursor: 'pointer', fontSize: '0.85rem', lineHeight: 1, padding: '2px' }}>
                      ⚙
                    </button>
                  </div>
                </div>

                {/* RVOL badge */}
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
                            <input
                              type="number" min="0.3" max="20" step="0.1"
                              placeholder="e.g. 1.5"
                              value={raw}
                              onChange={e => setCustomValues(prev => ({ ...prev, [sym]: e.target.value }))}
                              onKeyDown={e => { if (e.key === 'Enter' && valid) updateThreshold(sym, num); }}
                              style={{ flex: 1, padding: '0.4rem 0.6rem', background: '#111', border: `1px solid ${outOfRange ? '#ff3333' : '#2a2a2a'}`, borderRadius: '8px', color: outOfRange ? '#ff4444' : '#fff', fontSize: '0.78rem', outline: 'none', width: '0' }}
                            />
                            <button
                              onClick={() => valid && !savingThreshold && updateThreshold(sym, num)}
                              style={{ padding: '0.4rem 0.7rem', borderRadius: '8px', border: `1px solid ${valid ? '#555' : '#2a2a2a'}`, background: 'transparent', color: valid ? '#fff' : '#444', cursor: valid ? 'pointer' : 'default', fontSize: '0.72rem', fontWeight: '600', whiteSpace: 'nowrap' }}>
                              Set %
                            </button>
                          </div>
                          {outOfRange && (
                            <div style={{ fontSize: '0.62rem', color: '#ff4444', marginTop: '4px' }}>
                              Range: 0.3% – 20%
                            </div>
                          )}
                          {!outOfRange && (
                            <div style={{ fontSize: '0.62rem', color: '#333', marginTop: '4px' }}>
                              Custom range: 0.3% – 20%
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* ── RIGHT COLUMN: two feeds ── */}
        <div style={{ width: '270px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '14px' }}>

          {/* ── SIGNAL FEED (RVOL/VWAP unusual activity) ── */}
          {(() => {
            const signals = alerts.filter(a => a.type === 'signal');
            return (
              <div style={{ background: 'rgba(8,8,8,0.85)', borderRadius: '16px', border: '1px solid #1a1a1a', padding: '1.25rem', backdropFilter: 'blur(12px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '700', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Signal Feed</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {signals.length > 0 && <span style={{ fontSize: '0.65rem', background: '#ff990022', color: '#ff9900', padding: '2px 7px', borderRadius: '10px', fontWeight: '700' }}>{signals.length}</span>}
                    {signals.length > 0 && <button onClick={() => setAlerts(prev => prev.filter(a => a.type !== 'signal'))} title="Clear signals" style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: '0.75rem', lineHeight: 1, padding: '2px' }}>✕</button>}
                  </div>
                </div>
                {signals.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
                    <div style={{ fontSize: '1.3rem', marginBottom: '0.4rem' }}>📡</div>
                    <p style={{ color: '#333', fontSize: '0.75rem', margin: 0, lineHeight: 1.5 }}>
                      Scanning for anomalous<br />order flow activity.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', maxHeight: '320px', overflowY: 'auto' }}>
                    {signals.map((a, i) => {
                      const isBuy = a.dir === 'buy';
                      const score = a.score || 0;
                      const accent = isBuy ? '#ff9900' : '#ff4444';
                      const isExpanded = expandedSignal === i;
                      const confirmIcon = a.confirmed === null ? '⏳' : a.confirmed ? '✓' : '↔';
                      const confirmColor = a.confirmed === null ? '#333' : a.confirmed ? '#44cc44' : '#444';

                      return (
                        <div key={i} style={{ borderRadius: '10px', overflow: 'hidden', border: `1px solid ${isExpanded ? accent + '40' : '#1a1a1a'}`, animation: i === 0 ? 'fadeIn 0.3s ease' : 'none', background: isExpanded ? (isBuy ? 'rgba(255,153,0,0.05)' : 'rgba(255,50,50,0.05)') : 'transparent', transition: 'border-color 0.15s, background 0.15s' }}>

                          {/* Compact row */}
                          <div onClick={() => setExpandedSignal(isExpanded ? null : i)}
                            style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto auto', alignItems: 'center', gap: '8px', padding: '0.5rem 0.7rem', cursor: 'pointer', userSelect: 'none' }}>

                            {/* Symbol */}
                            <span style={{ fontWeight: '700', color: '#fff', fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                              {isBuy ? '🐋' : '🔴'} {a.symbol}
                            </span>

                            {/* Strength label */}
                            <span style={{ fontSize: '0.65rem', fontWeight: '700', color: accent, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {a.strengthLabel}
                            </span>

                            {/* Multiplier */}
                            <span style={{ fontSize: '0.65rem', color: '#555', whiteSpace: 'nowrap' }}>×{a.volMultiplier}</span>

                            {/* Score badge */}
                            <span style={{ fontSize: '0.6rem', fontWeight: '800', color: accent, background: `${accent}18`, padding: '2px 5px', borderRadius: '5px', whiteSpace: 'nowrap' }}>
                              {score}
                            </span>

                            {/* Confirm + time */}
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
                              <span style={{ fontSize: '0.65rem', color: confirmColor }}>{confirmIcon}</span>
                              <span style={{ fontSize: '0.58rem', color: '#333' }}>{a.time}</span>
                            </div>
                          </div>

                          {/* Expanded detail */}
                          {isExpanded && (
                            <div style={{ padding: '0 0.7rem 0.65rem', borderTop: `1px solid ${accent}20` }}>
                              {/* Score bar */}
                              <div style={{ marginTop: '0.6rem', marginBottom: '0.6rem' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                                  <span style={{ fontSize: '0.6rem', color: '#444', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Conviction</span>
                                  <span style={{ fontSize: '0.62rem', fontWeight: '700', color: accent }}>{score}/100</span>
                                </div>
                                <div style={{ height: '3px', background: '#111', borderRadius: '2px', overflow: 'hidden' }}>
                                  <div style={{ width: `${score}%`, height: '100%', background: `linear-gradient(to right, ${accent}88, ${accent})`, borderRadius: '2px' }} />
                                </div>
                              </div>

                              {/* Stats grid */}
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '0.65rem', color: '#555' }}>Volume spike</span>
                                  <span style={{ fontSize: '0.65rem', color: '#aaa', fontWeight: '600' }}>×{a.volMultiplier} larger than usual</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '0.65rem', color: '#555' }}>Buyers</span>
                                  <span style={{ fontSize: '0.65rem', fontWeight: '600', color: isBuy && a.flowRatio >= 0.65 ? accent : '#aaa' }}>{Math.round(a.flowRatio * 100)}%</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: '0.65rem', color: '#555' }}>Price</span>
                                  <span style={{ fontSize: '0.65rem', color: '#aaa', fontWeight: '600' }}>
                                    ${fmtPrice(a.price)} <span style={{ color: a.price >= a.vwap ? '#44cc44' : '#ff4444', fontSize: '0.6rem' }}>({a.price >= a.vwap ? 'above' : 'below'} avg)</span>
                                  </span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px', paddingTop: '6px', borderTop: `1px solid ${accent}18` }}>
                                  <span style={{ fontSize: '0.65rem', color: '#555' }}>Result</span>
                                  <span style={{ fontSize: '0.65rem', fontWeight: '600', color: confirmColor }}>
                                    {a.confirmed === null ? '⏳ Confirming in 30s…'
                                      : a.confirmed ? `✓ Confirmed ${a.priceImpact > 0 ? '+' : ''}${a.priceImpact?.toFixed(2)}%`
                                      : `↔ No follow-through (${a.priceImpact?.toFixed(2)}%)`}
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
            );
          })()}

          {/* ── PRICE ALERTS (threshold-based movements) ── */}
          {(() => {
            const priceAlerts = alerts.filter(a => a.type === 'price');
            return (
              <div style={{ background: 'rgba(8,8,8,0.85)', borderRadius: '16px', border: '1px solid #1a1a1a', padding: '1.25rem', backdropFilter: 'blur(12px)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                  <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: '700', color: '#555', letterSpacing: '0.1em', textTransform: 'uppercase' }}>Price Alerts</h3>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {priceAlerts.length > 0 && <span style={{ fontSize: '0.65rem', background: '#ff333322', color: '#ff3333', padding: '2px 7px', borderRadius: '10px', fontWeight: '700' }}>{priceAlerts.length}</span>}
                    {priceAlerts.length > 0 && <button onClick={() => setAlerts(prev => prev.filter(a => a.type !== 'price'))} title="Clear price alerts" style={{ background: 'none', border: 'none', color: '#333', cursor: 'pointer', fontSize: '0.75rem', lineHeight: 1, padding: '2px' }}>✕</button>}
                  </div>
                </div>
                {priceAlerts.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '1.5rem 0.5rem' }}>
                    <div style={{ fontSize: '1.3rem', marginBottom: '0.4rem' }}>🔔</div>
                    <p style={{ color: '#333', fontSize: '0.75rem', margin: 0, lineHeight: 1.5 }}>
                      Alerts fire when price moves<br />past your set threshold.
                    </p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '260px', overflowY: 'auto' }}>
                    {priceAlerts.map((a, i) => (
                      <div key={i} style={{ padding: '0.7rem', borderRadius: '10px', animation: 'fadeIn 0.3s ease', background: '#0c0c0c', border: '1px solid #1c1c1c' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                          <span style={{ fontWeight: '700', color: '#fff', fontSize: '0.82rem' }}>{a.symbol}</span>
                          <span style={{ fontSize: '0.65rem', color: '#444' }}>{a.time}</span>
                        </div>
                        <div style={{ color: a.pct > 0 ? '#44cc44' : '#ff4444', fontSize: '0.8rem', fontWeight: '600' }}>
                          {a.pct > 0 ? '▲' : '▼'} {Math.abs(a.pct).toFixed(2)}% move
                        </div>
                        <div style={{ color: '#444', fontSize: '0.7rem', marginTop: '2px' }}>
                          ${fmtPrice(a.price)} · threshold {a.threshold}%
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}

        </div>
      </div>
    </div>
  );
}
