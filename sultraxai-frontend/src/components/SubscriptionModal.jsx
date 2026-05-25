import React, { useState } from 'react';

const API_BASE = 'http://38.180.137.122:8000';

const FEATURES = [
  'Real-time price alerts on all your assets',
  'Smart Alerts — custom threshold per asset',
  'The Zone — live news, StockTwits & RSS feed',
  'Scanner — 100+ stocks & crypto every 60s',
  'AI-powered market intelligence terminal',
  'Unlimited watchlist assets',
];

export default function SubscriptionModal({ userId, expired, onSuccess, onSignOut }) {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState('');
  const [plan, setPlan]       = useState('monthly');

  const handleSubscribe = async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/create-checkout-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, plan_type: plan }),
      });
      const data = await res.json();
      if (data.url) {
        if (data.subscription_id) localStorage.setItem('paypal_sub_id', data.subscription_id);
        localStorage.setItem('paypal_plan_type', plan);
        window.location.href = data.url;
      } else {
        setError(data.detail || 'Could not start checkout. Try again.');
        setLoading(false);
      }
    } catch {
      setError('Connection error. Please try again.');
      setLoading(false);
    }
  };

  const monthlyTotal = (79.99 * 12).toFixed(0);

  return (
    <div style={{ minHeight: '100vh', background: '#020202', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', fontFamily: 'inherit' }}>
      <div style={{ width: '100%', maxWidth: '520px' }}>

        {/* Badge */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <span style={{ display: 'inline-block', background: 'rgba(255,51,51,0.08)', border: '1px solid rgba(255,51,51,0.2)', color: '#ff4444', fontSize: '0.62rem', fontWeight: '900', letterSpacing: '0.15em', padding: '5px 14px', borderRadius: '20px' }}>
            {expired ? 'SUBSCRIPTION EXPIRED' : 'PREMIUM ACCESS REQUIRED'}
          </span>
        </div>

        {/* Card */}
        <div style={{ background: '#080808', border: '1px solid #1a1a1a', borderRadius: '20px', overflow: 'hidden' }}>

          {/* Header */}
          <div style={{ padding: '2rem 2rem 1.5rem', borderBottom: '1px solid #111', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '8px' }}>⚡</div>
            <h2 style={{ margin: '0 0 6px', fontSize: '1.6rem', fontWeight: '900', color: '#fff', letterSpacing: '-0.01em' }}>SultraxAI Premium</h2>
            <p style={{ margin: 0, color: '#444', fontSize: '0.8rem', letterSpacing: '0.04em' }}>
              {expired ? 'Your subscription has ended — renew to regain access' : 'Full terminal access — everything, unlimited'}
            </p>
          </div>

          {/* Plan selector */}
          <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #111' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>

              {/* Monthly */}
              <div onClick={() => setPlan('monthly')} style={{ cursor: 'pointer', padding: '1rem', borderRadius: '12px', border: `1px solid ${plan === 'monthly' ? '#ff3333' : '#1e1e1e'}`, background: plan === 'monthly' ? 'rgba(255,51,51,0.06)' : 'transparent', transition: 'all 0.15s', textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', fontWeight: '800', letterSpacing: '0.12em', color: plan === 'monthly' ? '#ff4444' : '#333', marginBottom: '8px' }}>MONTHLY</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '2px' }}>
                  <span style={{ fontSize: '0.85rem', color: plan === 'monthly' ? '#888' : '#333', fontWeight: '700', paddingTop: '4px' }}>$</span>
                  <span style={{ fontSize: '2.2rem', fontWeight: '900', color: plan === 'monthly' ? '#fff' : '#444', lineHeight: 1 }}>79.99</span>
                </div>
                <div style={{ fontSize: '0.6rem', color: '#333', marginTop: '4px' }}>/ month</div>
              </div>

              {/* Yearly */}
              <div onClick={() => setPlan('yearly')} style={{ cursor: 'pointer', padding: '1rem', borderRadius: '12px', border: `1px solid ${plan === 'yearly' ? '#44cc44' : '#1e1e1e'}`, background: plan === 'yearly' ? 'rgba(68,204,68,0.06)' : 'transparent', transition: 'all 0.15s', textAlign: 'center', position: 'relative' }}>
                <div style={{ position: 'absolute', top: '-10px', left: '50%', transform: 'translateX(-50%)', background: '#44cc44', color: '#000', fontSize: '0.5rem', fontWeight: '900', letterSpacing: '0.1em', padding: '2px 10px', borderRadius: '20px', whiteSpace: 'nowrap' }}>
                  SAVE ${(monthlyTotal - 599.99).toFixed(0)}
                </div>
                <div style={{ fontSize: '0.6rem', fontWeight: '800', letterSpacing: '0.12em', color: plan === 'yearly' ? '#44cc44' : '#333', marginBottom: '8px' }}>YEARLY</div>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '2px' }}>
                  <span style={{ fontSize: '0.85rem', color: plan === 'yearly' ? '#888' : '#333', fontWeight: '700', paddingTop: '4px' }}>$</span>
                  <span style={{ fontSize: '2.2rem', fontWeight: '900', color: plan === 'yearly' ? '#fff' : '#444', lineHeight: 1 }}>599.99</span>
                </div>
                <div style={{ fontSize: '0.6rem', color: '#333', marginTop: '4px' }}>/ year</div>
              </div>

            </div>
          </div>

          {/* Features */}
          <div style={{ padding: '1.5rem 2rem', borderBottom: '1px solid #111' }}>
            {FEATURES.map(f => (
              <div key={f} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '10px' }}>
                <span style={{ color: '#44cc44', fontSize: '0.75rem', marginTop: '1px', flexShrink: 0 }}>✓</span>
                <span style={{ color: '#777', fontSize: '0.78rem', lineHeight: 1.4 }}>{f}</span>
              </div>
            ))}
          </div>

          {/* CTA */}
          <div style={{ padding: '1.5rem 2rem' }}>
            {error && (
              <div style={{ color: '#ff4444', background: 'rgba(255,51,51,0.08)', border: '1px solid rgba(255,51,51,0.15)', borderRadius: '8px', padding: '10px 14px', fontSize: '0.78rem', marginBottom: '12px', textAlign: 'center' }}>
                {error}
              </div>
            )}
            <button
              onClick={handleSubscribe}
              disabled={loading}
              style={{ width: '100%', padding: '1rem', background: loading ? '#330000' : '#ff3333', border: 'none', borderRadius: '12px', color: loading ? '#666' : '#fff', fontSize: '0.9rem', fontWeight: '800', cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.06em', boxShadow: loading ? 'none' : '0 4px 24px rgba(255,51,51,0.3)', transition: 'all 0.2s', fontFamily: 'inherit' }}
            >
              {loading ? 'REDIRECTING TO CHECKOUT…' : `SUBSCRIBE ${plan === 'yearly' ? 'YEARLY' : 'MONTHLY'} →`}
            </button>
            <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: '0.62rem', color: '#2a2a2a' }}>
              Secure payment via PayPal · SSL encrypted · Cancel anytime
            </p>
          </div>
        </div>

        {/* Sign out */}
        <div style={{ textAlign: 'center', marginTop: '16px' }}>
          <button onClick={onSignOut} style={{ background: 'none', border: 'none', color: '#2a2a2a', cursor: 'pointer', fontSize: '0.7rem', fontFamily: 'inherit' }}>
            Sign out
          </button>
        </div>
      </div>
    </div>
  );
}
