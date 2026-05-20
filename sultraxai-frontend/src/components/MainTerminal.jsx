import React from 'react';

export default function MainTerminal({ selectedAssets }) {
  return (
    <div style={{ padding: '0 2rem 4rem 2rem', maxWidth: '1200px', margin: '0 auto', color: '#fff', textAlign: 'center' }}>
      
      {/* כותרת נקייה ומיושרת למרכז */}
      <div style={{ marginBottom: '3rem', marginTop: '2rem' }}>
        <h2 style={{ fontSize: '3rem', fontWeight: '900', margin: '0 0 0.5rem 0', background: 'linear-gradient(to bottom, #fff, #888)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Terminal Dashboard
        </h2>
        <p style={{ color: '#ff3333', fontSize: '1.1rem', margin: 0, fontWeight: '500' }}>
          Alpha Stream Active: {selectedAssets.join(', ')}
        </p>
      </div>

      {/* גריד הכרטיסיות */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '25px', textAlign: 'left' }}>
        {selectedAssets.map(asset => (
          <div key={asset} style={{ background: 'rgba(10, 10, 10, 0.8)', padding: '2rem', borderRadius: '16px', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
            <h3 style={{ margin: '0 0 1rem 0', color: '#aaa', fontSize: '1.3rem', fontWeight: '700' }}>{asset}</h3>
            <div style={{ fontSize: '1.4rem', fontWeight: '800', marginBottom: '0.75rem', color: '#fff' }}>SIGNAL: NEUTRAL</div>
            <div style={{ height: '6px', background: '#111', borderRadius: '3px', overflow: 'hidden', border: '1px solid #222' }}>
              <div style={{ width: '40%', height: '100%', background: '#ff3333' }}></div>
            </div>
            <p style={{ fontSize: '0.8rem', marginTop: '1.2rem', color: '#555', marginBottom: 0 }}>Last Update: Just now</p>
          </div>
        ))}
      </div>
    </div>
  );
}
