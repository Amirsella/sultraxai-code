import React, { useState, useEffect } from 'react';

const API_BASE = 'http://38.180.137.122:8000';

const ago = (val) => {
  if (!val) return '';
  const ts = typeof val === 'string' ? new Date(val).getTime() / 1000 : Number(val);
  const d = Date.now() / 1000 - ts;
  if (d < 60) return 'just now';
  if (d < 3600) return `${Math.floor(d / 60)}m ago`;
  if (d < 86400) return `${Math.floor(d / 3600)}h ago`;
  return `${Math.floor(d / 86400)}d ago`;
};

function NewsCard({ item }) {
  return (
    <a href={item.url} target="_blank" rel="noreferrer" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
      <div style={{ padding: '14px', borderRadius: '12px', background: '#0a0a0a', border: '1px solid #151515', marginBottom: '8px', transition: 'border-color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.borderColor='#2a2a2a'}
        onMouseLeave={e => e.currentTarget.style.borderColor='#151515'}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
          <span style={{ fontSize: '0.6rem', color: '#555', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{item.source}</span>
          <span style={{ fontSize: '0.6rem', color: '#2a2a2a' }}>{ago(item.time)}</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.84rem', color: '#e0e0e0', fontWeight: '600', lineHeight: 1.45 }}>{item.headline}</p>
        {item.summary && <p style={{ margin: '6px 0 0', fontSize: '0.75rem', color: '#555', lineHeight: 1.5, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{item.summary}</p>}
      </div>
    </a>
  );
}

function TwitCard({ item }) {
  const bull = item.sentiment === 'Bullish';
  const bear = item.sentiment === 'Bearish';
  return (
    <div style={{ padding: '14px', borderRadius: '12px', background: '#0a0a0a', border: `1px solid ${bull ? 'rgba(68,204,68,0.12)' : bear ? 'rgba(255,68,68,0.12)' : '#151515'}`, marginBottom: '8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '7px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
          <span style={{ fontSize: '0.7rem', color: '#444', fontWeight: '600' }}>@{item.user}</span>
          {bull && <span style={{ fontSize: '0.58rem', color: '#44cc44', background: 'rgba(68,204,68,0.1)', padding: '1px 7px', borderRadius: '5px', fontWeight: '700' }}>BULL</span>}
          {bear && <span style={{ fontSize: '0.58rem', color: '#ff4444', background: 'rgba(255,68,68,0.1)', padding: '1px 7px', borderRadius: '5px', fontWeight: '700' }}>BEAR</span>}
        </div>
        <span style={{ fontSize: '0.6rem', color: '#2a2a2a' }}>{ago(item.time)}</span>
      </div>
      <p style={{ margin: 0, fontSize: '0.82rem', color: '#ccc', lineHeight: 1.55 }}>{item.text}</p>
      {item.likes > 0 && <span style={{ fontSize: '0.6rem', color: '#333', marginTop: '6px', display: 'block' }}>♥ {item.likes}</span>}
    </div>
  );
}

function RedditCard({ item }) {
  return (
    <a href={item.url} target="_blank" rel="noreferrer" style={{ display: 'block', textDecoration: 'none', color: 'inherit' }}>
      <div style={{ padding: '14px', borderRadius: '12px', background: '#0a0a0a', border: '1px solid #151515', marginBottom: '8px', transition: 'border-color 0.15s' }}
        onMouseEnter={e => e.currentTarget.style.borderColor='#2a2a2a'}
        onMouseLeave={e => e.currentTarget.style.borderColor='#151515'}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '7px' }}>
          <span style={{ fontSize: '0.6rem', color: '#e05a1e', fontWeight: '700' }}>r/{item.subreddit}</span>
          <span style={{ fontSize: '0.6rem', color: '#2a2a2a' }}>{ago(item.time)}</span>
        </div>
        <p style={{ margin: 0, fontSize: '0.84rem', color: '#e0e0e0', fontWeight: '500', lineHeight: 1.45 }}>{item.title}</p>
        <div style={{ display: 'flex', gap: '14px', marginTop: '8px' }}>
          <span style={{ fontSize: '0.65rem', color: '#444' }}>▲ {item.score.toLocaleString()}</span>
          <span style={{ fontSize: '0.65rem', color: '#444' }}>💬 {item.comments}</span>
        </div>
      </div>
    </a>
  );
}

function Column({ title, color, count, children, loading }) {
  return (
    <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px', paddingBottom: '10px', borderBottom: `1px solid ${color}22` }}>
        <span style={{ fontSize: '0.65rem', fontWeight: '800', letterSpacing: '0.1em', color }}>{title}</span>
        {count > 0 && <span style={{ fontSize: '0.58rem', color, background: `${color}15`, padding: '1px 7px', borderRadius: '6px', fontWeight: '700' }}>{count}</span>}
        {loading && <span style={{ fontSize: '0.58rem', color: '#333', marginLeft: 'auto' }}>loading…</span>}
      </div>
      <div style={{ overflowY: 'auto', flex: 1, paddingRight: '4px' }}>
        {!loading && count === 0 && <p style={{ color: '#2a2a2a', fontSize: '0.75rem', textAlign: 'center', marginTop: '3rem' }}>No data yet</p>}
        {children}
      </div>
    </div>
  );
}

export default function TheZone({ selectedAssets, onBack, isNative }) {
  const [activeAsset, setActiveAsset] = useState(selectedAssets[0] || '');
  const [activeTab, setActiveTab] = useState('news');
  const [data, setData] = useState({ news: [], stocktwits: [], reddit: [], sentiment: { bull: 0, bear: 0, pct: 50 } });
  const [loading, setLoading] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);

  const load = async (sym) => {
    if (!sym) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/zone/all?symbol=${encodeURIComponent(sym)}`);
      setData(await res.json());
      setLastUpdate(new Date());
    } catch { /* silent */ }
    setLoading(false);
  };

  useEffect(() => {
    load(activeAsset);
    const id = setInterval(() => load(activeAsset), 90000);
    return () => clearInterval(id);
  }, [activeAsset]);

  const { news = [], stocktwits = [], reddit = [], sentiment } = data;
  const bull = sentiment?.pct ?? 50;
  const bear = 100 - bull;
  const hasSentiment = (sentiment?.bull ?? 0) + (sentiment?.bear ?? 0) > 0;

  const TABS = [
    { id: 'news', label: 'NEWS', color: '#4488ff', count: news.length },
    { id: 'twits', label: 'STOCKTWITS', color: '#44cc44', count: stocktwits.length },
    { id: 'reddit', label: 'REDDIT', color: '#e05a1e', count: reddit.length },
  ];

  const containerStyle = isNative
    ? { position: 'fixed', inset: 0, background: '#020202', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
    : { width: '100%', minHeight: '100vh', background: '#020202', padding: '0 2rem 4rem', color: '#fff' };

  return (
    <div style={containerStyle}>
      <style>{`
        @keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }
        ::-webkit-scrollbar { width: 3px; } ::-webkit-scrollbar-track { background: transparent; } ::-webkit-scrollbar-thumb { background: #1a1a1a; border-radius: 2px; }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ paddingTop: isNative ? '56px' : '1.5rem', paddingBottom: '16px', paddingLeft: isNative ? '20px' : 0, paddingRight: isNative ? '20px' : 0, borderBottom: '1px solid #0f0f0f', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', letterSpacing: '0.07em', background: 'linear-gradient(to right,#fff 40%,#555)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>THE ZONE</h2>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: loading ? '#ff9900' : '#44cc44', boxShadow: `0 0 6px ${loading ? '#ff9900' : '#44cc44'}`, animation: 'spin 1s linear' + (loading ? ' infinite' : ' 0') }} />
            </div>
            {lastUpdate && <p style={{ margin: '2px 0 0', fontSize: '0.6rem', color: '#2a2a2a' }}>Updated {lastUpdate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</p>}
          </div>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1e1e1e', color: '#666', padding: '7px 14px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600' }}>← BACK</button>
        </div>

        {/* Asset tabs */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '14px', overflowX: 'auto', paddingBottom: '2px' }}>
          {selectedAssets.map(sym => (
            <button key={sym} onClick={() => setActiveAsset(sym)}
              style={{ padding: '5px 14px', borderRadius: '8px', border: `1px solid ${activeAsset === sym ? '#ff3333' : '#1a1a1a'}`, background: activeAsset === sym ? 'rgba(255,51,51,0.1)' : 'transparent', color: activeAsset === sym ? '#ff4444' : '#444', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '700', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {sym}
            </button>
          ))}
        </div>

        {/* Sentiment bar */}
        {hasSentiment && (
          <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '0.58rem', color: '#44cc44', fontWeight: '700', width: '30px' }}>{bull}%</span>
            <div style={{ flex: 1, height: '4px', borderRadius: '2px', background: '#111', overflow: 'hidden' }}>
              <div style={{ width: `${bull}%`, height: '100%', background: `linear-gradient(to right,#44cc44,#ff4444)`, borderRadius: '2px', transition: 'width 0.6s ease' }} />
            </div>
            <span style={{ fontSize: '0.58rem', color: '#ff4444', fontWeight: '700', width: '30px', textAlign: 'right' }}>{bear}%</span>
            <span style={{ fontSize: '0.55rem', color: '#2a2a2a' }}>bull / bear · {(sentiment?.bull ?? 0) + (sentiment?.bear ?? 0)} signals</span>
          </div>
        )}
      </div>

      {/* ── WEB: 3 columns ── */}
      {!isNative && (
        <div style={{ display: 'flex', gap: '20px', marginTop: '20px', height: 'calc(100vh - 200px)' }}>
          <Column title="NEWS" color="#4488ff" count={news.length} loading={loading}>
            {news.map((item, i) => <NewsCard key={i} item={item} />)}
          </Column>
          <Column title="STOCKTWITS" color="#44cc44" count={stocktwits.length} loading={loading}>
            {stocktwits.map((item, i) => <TwitCard key={i} item={item} />)}
          </Column>
          <Column title="REDDIT" color="#e05a1e" count={reddit.length} loading={loading}>
            {reddit.map((item, i) => <RedditCard key={i} item={item} />)}
          </Column>
        </div>
      )}

      {/* ── NATIVE: tab bar + content ── */}
      {isNative && (
        <>
          <div style={{ flex: 1, overflowY: 'auto', padding: '14px 16px 8px' }}>
            {activeTab === 'news' && (loading && news.length === 0
              ? <p style={{ color: '#2a2a2a', textAlign: 'center', marginTop: '4rem', fontSize: '0.8rem' }}>Loading…</p>
              : news.map((item, i) => <NewsCard key={i} item={item} />)
            )}
            {activeTab === 'twits' && (loading && stocktwits.length === 0
              ? <p style={{ color: '#2a2a2a', textAlign: 'center', marginTop: '4rem', fontSize: '0.8rem' }}>Loading…</p>
              : stocktwits.map((item, i) => <TwitCard key={i} item={item} />)
            )}
            {activeTab === 'reddit' && (loading && reddit.length === 0
              ? <p style={{ color: '#2a2a2a', textAlign: 'center', marginTop: '4rem', fontSize: '0.8rem' }}>Loading…</p>
              : reddit.map((item, i) => <RedditCard key={i} item={item} />)
            )}
          </div>

          <div style={{ flexShrink: 0, display: 'flex', background: '#070707', borderTop: '1px solid #0f0f0f', paddingBottom: '30px' }}>
            {TABS.map(tab => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)}
                style={{ flex: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '12px 0 6px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                <span style={{ fontSize: '0.58rem', fontWeight: '700', letterSpacing: '0.08em', color: activeTab === tab.id ? tab.color : '#333', transition: 'color 0.15s' }}>{tab.label}</span>
                {tab.count > 0 && <span style={{ fontSize: '0.5rem', background: tab.color, color: '#000', padding: '0px 5px', borderRadius: '6px', fontWeight: '700', lineHeight: 1.6 }}>{tab.count}</span>}
                <div style={{ width: '18px', height: '2px', background: activeTab === tab.id ? tab.color : 'transparent', borderRadius: '1px', transition: 'background 0.15s' }} />
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
