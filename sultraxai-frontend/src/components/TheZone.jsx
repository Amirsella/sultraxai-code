import React, { useState, useEffect, useCallback } from 'react';

const API_BASE = '';

const ago = (val) => {
  if (!val) return '';
  const ts = typeof val === 'string' ? new Date(val).getTime() / 1000 : Number(val);
  if (!ts || isNaN(ts)) return '';
  const d = Date.now() / 1000 - ts;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
};

const toTs = (val) => {
  if (!val) return 0;
  if (typeof val === 'string') return new Date(val).getTime() / 1000;
  return Number(val);
};

const SOURCE_META = {
  finnhub:    { label: 'FINNHUB',    color: '#4488ff', bg: 'rgba(68,136,255,0.1)'  },
  stocktwits: { label: 'STOCKTWITS', color: '#44cc44', bg: 'rgba(68,204,68,0.1)'   },
  yahoo:      { label: 'YAHOO',      color: '#aa44ff', bg: 'rgba(170,68,255,0.1)'  },
  gnews:      { label: 'GNEWS',      color: '#4fbdff', bg: 'rgba(79,189,255,0.08)' },
  reddit:     { label: 'REDDIT',     color: '#ff6314', bg: 'rgba(255,99,20,0.08)'  },
};

function SourceBadge({ type }) {
  const m = SOURCE_META[type] || SOURCE_META.finnhub;
  return (
    <span style={{ fontSize: '0.55rem', fontWeight: '800', letterSpacing: '0.09em', color: m.color, background: m.bg, padding: '2px 8px', borderRadius: '5px', flexShrink: 0 }}>
      {m.label}
    </span>
  );
}

function FeedItem({ item }) {
  const isLink = !!item.url;
  const inner = (
    <div style={{ padding: '14px 16px', borderRadius: '12px', background: '#080808', border: '1px solid #141414', marginBottom: '8px', transition: 'border-color 0.15s', cursor: isLink ? 'pointer' : 'default' }}
      onMouseEnter={e => { if (isLink) e.currentTarget.style.borderColor = '#252525'; }}
      onMouseLeave={e => { if (isLink) e.currentTarget.style.borderColor = '#141414'; }}>

      {/* Row 1: source + meta + time */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginBottom: '8px', flexWrap: 'wrap' }}>
        <SourceBadge type={item.type} />

        {/* Stocktwits: username + sentiment */}
        {item.type === 'stocktwits' && (
          <>
            <span style={{ fontSize: '0.65rem', color: '#333', fontWeight: '600' }}>@{item.user}</span>
            {item.sentiment === 'Bullish' && <span style={{ fontSize: '0.55rem', color: '#44cc44', background: 'rgba(68,204,68,0.08)', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>BULL</span>}
            {item.sentiment === 'Bearish' && <span style={{ fontSize: '0.55rem', color: '#ff4444', background: 'rgba(255,68,68,0.08)', padding: '1px 6px', borderRadius: '4px', fontWeight: '700' }}>BEAR</span>}
          </>
        )}

        {/* Reddit: subreddit + upvotes + comments */}
        {item.type === 'reddit' && (
          <>
            <span style={{ fontSize: '0.62rem', color: '#ff6314', fontWeight: '700' }}>{item.user}</span>
            {item.ups > 0 && <span style={{ fontSize: '0.55rem', color: '#444', fontWeight: '600' }}>▲ {item.ups >= 1000 ? `${(item.ups/1000).toFixed(1)}k` : item.ups}</span>}
            {item.comments > 0 && <span style={{ fontSize: '0.55rem', color: '#333' }}>💬 {item.comments}</span>}
          </>
        )}

        {/* Yahoo: source */}
        {item.type === 'yahoo' && item.source && (
          <span style={{ fontSize: '0.62rem', color: '#aa44ff', fontWeight: '600' }}>{item.source}</span>
        )}

        {/* GNews: source */}
        {item.type === 'gnews' && item.source && (
          <span style={{ fontSize: '0.62rem', color: '#4fbdff', fontWeight: '600' }}>{item.source}</span>
        )}

        {/* Finnhub: source name */}
        {item.type === 'finnhub' && item.source && (
          <span style={{ fontSize: '0.62rem', color: '#333' }}>{item.source}</span>
        )}

        <span style={{ fontSize: '0.6rem', color: '#222', marginLeft: 'auto' }}>{ago(item.time)}</span>
      </div>

      {/* Row 2: content */}
      <p style={{ margin: 0, fontSize: '0.84rem', color: '#d8d8d8', fontWeight: item.type === 'stocktwits' ? '400' : '600', lineHeight: 1.5 }}>
        {item.content}
      </p>

      {/* Row 3: summary (news only) */}
      {item.summary && (
        <p style={{ margin: '6px 0 0', fontSize: '0.74rem', color: '#444', lineHeight: 1.55, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {item.summary}
        </p>
      )}


      {/* Row 4: stocktwits likes */}
      {item.type === 'stocktwits' && item.likes > 0 && (
        <span style={{ fontSize: '0.6rem', color: '#2a2a2a', marginTop: '6px', display: 'block' }}>♥ {item.likes}</span>
      )}
    </div>
  );

  return isLink
    ? <a href={item.url} target="_blank" rel="noreferrer" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>{inner}</a>
    : inner;
}

function buildFeed(data) {
  const { news = [], stocktwits = [], yahoo = [], gnews = [], reddit = [] } = data;
  const items = [
    ...news.map(n      => ({ type: 'finnhub',    content: n.headline, summary: n.summary, source: n.source, url: n.url, time: n.time })),
    ...stocktwits.map(t => ({ type: 'stocktwits', content: t.text, user: t.user, sentiment: t.sentiment, likes: t.likes, time: t.time })),
    ...yahoo.map(y     => ({ type: 'yahoo',      content: y.headline, summary: y.summary, source: y.source, url: y.url, time: y.time })),
    ...gnews.map(g     => ({ type: 'gnews',      content: g.headline, summary: g.summary, source: g.source, url: g.url, time: g.time })),
    ...reddit.map(r    => ({ type: 'reddit',     content: r.text, user: r.user, ups: r.ups, comments: r.comments, url: r.url, time: r.time })),
  ];
  return items.sort((a, b) => toTs(b.time) - toTs(a.time));
}

export default function TheZone({ selectedAssets, onBack, isNative }) {
  const [activeAsset, setActiveAsset] = useState(selectedAssets[0] || '');
  const [feed, setFeed] = useState([]);
  const [counts, setCounts] = useState({ finnhub: 0, stocktwits: 0, yahoo: 0, gnews: 0, reddit: 0 });
  const [sentiment, setSentiment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastUpdate, setLastUpdate] = useState(null);
  const [filter, setFilter] = useState('all');

  const load = useCallback(async (sym) => {
    if (!sym) return;
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/zone/all?symbol=${encodeURIComponent(sym)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const { news = [], stocktwits = [], yahoo = [], gnews = [], reddit = [] } = data;
      setFeed(buildFeed(data));
      setCounts({ finnhub: news.length, stocktwits: stocktwits.length, yahoo: yahoo.length, gnews: gnews.length, reddit: reddit.length });
      setSentiment(data.sentiment || null);
      setLastUpdate(new Date());
    } catch (e) {
      setError('Failed to load data. The source may be unavailable.');
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load(activeAsset);
    const id = setInterval(() => load(activeAsset), 90000);
    return () => clearInterval(id);
  }, [activeAsset, load]);

  const visible = filter === 'all' ? feed : feed.filter(i => i.type === filter);
  const bull = sentiment?.pct ?? 50;
  const bear = 100 - bull;
  const hasSentiment = (sentiment?.bull ?? 0) + (sentiment?.bear ?? 0) > 0;
  const total = counts.finnhub + counts.stocktwits + counts.yahoo + counts.gnews + counts.reddit;

  const FILTERS = [
    { id: 'all',        label: 'ALL',        count: total },
    { id: 'finnhub',    label: 'FINNHUB',    count: counts.finnhub },
    { id: 'stocktwits', label: 'STOCKTWITS', count: counts.stocktwits },
    { id: 'yahoo',      label: 'YAHOO',      count: counts.yahoo },
    { id: 'gnews',      label: 'GNEWS',      count: counts.gnews },
    { id: 'reddit',     label: 'REDDIT',     count: counts.reddit },
  ];

  const containerStyle = isNative
    ? { position: 'fixed', inset: 0, background: '#020202', display: 'flex', flexDirection: 'column', overflow: 'hidden', color: '#fff' }
    : { width: '100%', minHeight: '100vh', background: '#020202', color: '#fff', padding: '0 2rem 4rem' };

  return (
    <div style={containerStyle}>
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1a1a1a;border-radius:2px}
      `}</style>

      {/* HEADER */}
      <div style={{ paddingTop: isNative ? '56px' : '1.5rem', paddingBottom: '14px', paddingLeft: isNative ? '20px' : 0, paddingRight: isNative ? '20px' : 0, borderBottom: '1px solid #0f0f0f', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', letterSpacing: '0.07em', background: 'linear-gradient(to right,#fff 40%,#555)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>THE ZONE</h2>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: loading ? '#ff9900' : error ? '#ff3333' : '#44cc44', boxShadow: `0 0 6px ${loading ? '#ff9900' : error ? '#ff3333' : '#44cc44'}`, animation: loading ? 'spin 1s linear infinite' : 'none' }} />
            {lastUpdate && <span style={{ fontSize: '0.58rem', color: '#252525' }}>Updated {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>}
          </div>
          {isNative && <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e1e1e', color: '#555', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600' }}>← BACK</button>}
        </div>

        {/* Asset selector */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '10px' }}>
          {selectedAssets.map(sym => (
            <button key={sym} onClick={() => setActiveAsset(sym)}
              style={{ padding: '4px 14px', borderRadius: '7px', border: `1px solid ${activeAsset === sym ? '#ff3333' : '#1a1a1a'}`, background: activeAsset === sym ? 'rgba(255,51,51,0.1)' : 'transparent', color: activeAsset === sym ? '#ff4444' : '#444', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '700', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {sym}
            </button>
          ))}
        </div>

        {/* Sentiment bar */}
        {hasSentiment && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
            <span style={{ fontSize: '0.58rem', color: '#44cc44', fontWeight: '700', width: '32px' }}>{bull}%</span>
            <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: '#111', overflow: 'hidden' }}>
              <div style={{ width: `${bull}%`, height: '100%', background: 'linear-gradient(to right,#44cc44,#ff4444)', transition: 'width 0.6s ease' }} />
            </div>
            <span style={{ fontSize: '0.58rem', color: '#ff4444', fontWeight: '700', width: '32px', textAlign: 'right' }}>{bear}%</span>
            <span style={{ fontSize: '0.55rem', color: '#222' }}>bull/bear · {(sentiment?.bull ?? 0) + (sentiment?.bear ?? 0)} signals</span>
          </div>
        )}

        {/* Source filters */}
        <div style={{ display: 'flex', gap: '5px', overflowX: 'auto', paddingBottom: '2px' }}>
          {FILTERS.map(f => {
            const m = SOURCE_META[f.id] || { color: '#888', bg: 'rgba(255,255,255,0.06)' };
            const active = filter === f.id;
            return (
              <button key={f.id} onClick={() => setFilter(f.id)}
                style={{ display: 'flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '7px', border: `1px solid ${active ? (f.id === 'all' ? '#333' : m.color + '55') : '#1a1a1a'}`, background: active ? (f.id === 'all' ? 'rgba(255,255,255,0.05)' : m.bg) : 'transparent', color: active ? (f.id === 'all' ? '#ccc' : m.color) : '#333', cursor: 'pointer', fontSize: '0.62rem', fontWeight: '700', letterSpacing: '0.06em', whiteSpace: 'nowrap', flexShrink: 0 }}>
                {f.label}
                {f.count > 0 && <span style={{ fontSize: '0.55rem', background: active ? 'rgba(0,0,0,0.25)' : 'transparent', padding: '0 4px', borderRadius: '4px' }}>{f.count}</span>}
              </button>
            );
          })}
        </div>
      </div>

      {/* FEED */}
      <div style={{ flex: 1, overflowY: 'auto', padding: isNative ? '12px 16px 24px' : '16px 0 0', maxWidth: isNative ? undefined : '760px' }}>
        {loading && feed.length === 0 && (
          <div style={{ textAlign: 'center', padding: '5rem 1rem', color: '#2a2a2a', fontSize: '0.82rem' }}>
            <div style={{ marginBottom: '12px', fontSize: '1.5rem' }}>⏳</div>
            Loading intel for {activeAsset}…
          </div>
        )}
        {error && !loading && (
          <div style={{ textAlign: 'center', padding: '4rem 1rem' }}>
            <div style={{ fontSize: '1.4rem', marginBottom: '10px' }}>⚠️</div>
            <p style={{ color: '#444', fontSize: '0.8rem', margin: '0 0 16px', lineHeight: 1.6 }}>{error}</p>
            <button onClick={() => load(activeAsset)} style={{ background: 'none', border: '1px solid #2a2a2a', color: '#555', padding: '6px 18px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600' }}>
              Try Again
            </button>
          </div>
        )}
        {!loading && !error && visible.length === 0 && (
          <div style={{ textAlign: 'center', padding: '5rem 1rem', color: '#2a2a2a', fontSize: '0.8rem' }}>
            No data available for {activeAsset}
          </div>
        )}
        {visible.map((item, i) => <FeedItem key={i} item={item} />)}
      </div>
    </div>
  );
}
