import React, { useState, useMemo, useEffect, useRef, lazy, Suspense } from 'react';
import MainTerminal from './components/MainTerminal';
const TheZone            = lazy(() => import('./components/TheZone'));
const Scanner            = lazy(() => import('./components/Scanner'));
const AccountSettings    = lazy(() => import('./components/AccountSettings'));
const AdminPanel         = lazy(() => import('./components/AdminPanel'));
const SubscriptionModal  = lazy(() => import('./components/SubscriptionModal'));
const SupportBot    = lazy(() => import('./components/SupportBot'));
const CommunityChat = lazy(() => import('./components/CommunityChat'));
const API_BASE = '';
const MOCK_STOCKS = ["BTC/USD", "ETH/USD", "AAPL", "TSLA", "NVDA", "AMZN", "GOOGL", "MSFT", "META", "NFLX", "SOL/USD", "XRP/USD", "AMD", "PLTR", "COIN"];

const isNative = typeof window !== 'undefined' &&
  (window.location.protocol === 'capacitor:' || !!window.Capacitor?.isNativePlatform?.());

const BETA_CODE = 'SULTRAX2026';

function BetaGate({ onUnlock }) {
  const [input, setInput] = useState('');
  const [error, setError] = useState('');

  const attempt = (e) => {
    e.preventDefault();
    if (input.trim().toUpperCase() === BETA_CODE) {
      localStorage.setItem('beta_unlocked', '1');
      onUnlock();
    } else {
      setError('Invalid access code.');
      setInput('');
    }
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#020202', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif', zIndex: 99999 }}>
      <div style={{ width: '100%', maxWidth: '360px', padding: '0 24px', textAlign: 'center' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: '900', letterSpacing: '0.08em', marginBottom: '6px' }}>
          <span style={{ color: '#ff3333' }}>SULTRAX</span><span style={{ color: '#fff' }}>AI</span>
        </div>
        <div style={{ fontSize: '0.65rem', color: '#444', letterSpacing: '0.2em', marginBottom: '48px' }}>PRIVATE BETA</div>

        <form onSubmit={attempt} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <input
            value={input} onChange={e => { setInput(e.target.value); setError(''); }}
            placeholder="Enter access code"
            autoFocus autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false}
            style={{ padding: '14px 16px', background: '#0d0d0d', border: `1px solid ${error ? '#ff3333' : '#1e1e1e'}`, borderRadius: '12px', color: '#fff', fontSize: '0.95rem', letterSpacing: '0.08em', textAlign: 'center', outline: 'none', fontFamily: 'inherit' }}
          />
          {error && <div style={{ color: '#ff4444', fontSize: '0.75rem' }}>{error}</div>}
          <button type="submit" disabled={!input.trim()}
            style={{ padding: '14px', background: input.trim() ? '#ff3333' : '#111', border: 'none', borderRadius: '12px', color: input.trim() ? '#fff' : '#333', fontWeight: '800', fontSize: '0.85rem', letterSpacing: '0.08em', cursor: input.trim() ? 'pointer' : 'default', transition: 'all 0.15s' }}>
            REQUEST ACCESS →
          </button>
        </form>
      </div>
    </div>
  );
}

export default function App() {
  const [betaUnlocked, setBetaUnlocked] = useState(() => localStorage.getItem('beta_unlocked') === '1');
  const [isAdminMode] = useState(() => new URLSearchParams(window.location.search).has('admin'));

  // Payment redirect params (Lemon Squeezy)
  const [stripePayment] = useState(() => new URLSearchParams(window.location.search).get('payment') || '');
  const [stripeUserId]  = useState(() => new URLSearchParams(window.location.search).get('user_id') || '');

  // טעינת מצב ראשוני מה-LocalStorage כדי למנוע ניתוק בריפרש
  const [resetToken, setResetToken] = useState(() => new URLSearchParams(window.location.search).get('reset_token') || '');

  const [currentView, setCurrentView] = useState(() => {
    if (new URLSearchParams(window.location.search).get('reset_token')) return 'reset_password';
    const saved = localStorage.getItem('currentView');
    const userId = localStorage.getItem('userId');
    if (['main_app', 'onboarding', 'zone', 'scanner', 'settings'].includes(saved) && userId) return saved;
    const publicViews = ['contact', 'terms', 'privacy'];
    if (publicViews.includes(saved)) return saved;
    return 'landing';
  });
  const [userId, setUserId] = useState(() => localStorage.getItem('userId') || null);
  const [sessionToken, setSessionToken] = useState(() => localStorage.getItem('sessionToken') || '');
  const [firstName, setFirstName] = useState(() => localStorage.getItem('firstName') || '');
  const [selectedAssets, setSelectedAssets] = useState(() => {
    const saved = localStorage.getItem('selectedAssets');
    return saved ? JSON.parse(saved) : [];
  });

  const [previousView, setPreviousView] = useState('landing');
  const [onboardingStep, setOnboardingStep] = useState(1);
  const [subscriptionStatus, setSubscriptionStatus] = useState(() => localStorage.getItem('subscriptionStatus') || '');
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingEmail, setPendingEmail] = useState(() => localStorage.getItem('pendingEmail') || '');
  const [assetSettings, setAssetSettings] = useState({}); 
  const [tradingProfile, setTradingProfile] = useState({ experience: 'Beginner (0-1 yrs)', frequency: 'Daily' });
  const inactivityRef = useRef(null);
  const [sessionError, setSessionError] = useState('');

  // Persist subscription status
  useEffect(() => {
    localStorage.setItem('subscriptionStatus', subscriptionStatus);
  }, [subscriptionStatus]);

  // Handle payment redirect back from PayPal
  useEffect(() => {
    if (stripePayment === 'success' && stripeUserId) {
      window.history.replaceState({}, '', '/');
      const subId    = localStorage.getItem('paypal_sub_id') || '';
      const planType = localStorage.getItem('paypal_plan_type') || 'monthly';
      fetch(`${API_BASE}/api/verify-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: parseInt(stripeUserId), subscription_id: subId, plan_type: planType }),
      })
        .then(r => r.json())
        .then(d => {
          if (d.status === 'active') {
            localStorage.removeItem('paypal_sub_id');
            localStorage.removeItem('paypal_plan_type');
            setSubscriptionStatus('active');
            setUserId(stripeUserId);
            setCurrentView('main_app');
          }
        })
        .catch(() => {});
    }
  }, []);

  // Validate userId on startup — check user exists and subscription is still active
  useEffect(() => {
    const storedId = localStorage.getItem('userId');
    const storedView = localStorage.getItem('currentView');
    if (!storedId || !['main_app', 'zone', 'scanner', 'settings'].includes(storedView)) return;
    fetch(`${API_BASE}/api/user/${storedId}`)
      .then(res => {
        if (res.status === 404) {
          localStorage.clear();
          setUserId(null);
          setFirstName('');
          setSelectedAssets([]);
          setSessionError('Your session has expired. Please sign in again.');
          setCurrentView('signin');
          return;
        }
        return res.json();
      })
      .then(data => {
        if (!data) return;
        const serverStatus = data.subscription_status || '';
        setSubscriptionStatus(serverStatus);
        localStorage.setItem('subscriptionStatus', serverStatus);
        if (serverStatus !== 'active') {
          setCurrentView('subscription');
        }
      })
      .catch(() => {});
  }, []);

  // עדכון ה-LocalStorage בכל פעם שהערכים משתנים
  useEffect(() => {
    localStorage.setItem('currentView', currentView);
  }, [currentView]);

  useEffect(() => {
    if (userId) localStorage.setItem('userId', userId);
    else localStorage.removeItem('userId');
  }, [userId]);

  useEffect(() => {
    if (sessionToken) localStorage.setItem('sessionToken', sessionToken);
    else localStorage.removeItem('sessionToken');
  }, [sessionToken]);

  useEffect(() => {
    if (firstName) localStorage.setItem('firstName', firstName);
    else localStorage.removeItem('firstName');
  }, [firstName]);

  useEffect(() => {
    localStorage.setItem('selectedAssets', JSON.stringify(selectedAssets));
  }, [selectedAssets]);

  useEffect(() => {
    if (pendingEmail) localStorage.setItem('pendingEmail', pendingEmail);
    else localStorage.removeItem('pendingEmail');
  }, [pendingEmail]);

 const handleRegisterSuccess = (id, email) => {
    setUserId(id);
    setPendingEmail(email);
    setSelectedAssets([]);
    setOnboardingStep(1);
    setSubscriptionStatus('');
    setCurrentView('verify');
  };

  const handleSignOut = () => {
    clearTimeout(inactivityRef.current);
    const id = localStorage.getItem('userId');
    if (id) fetch(`${API_BASE}/api/logout?user_id=${id}`, { method: 'POST' }).catch(() => {});
    setUserId(null);
    setSessionToken('');
    setFirstName('');
    setSelectedAssets([]);
    setAssetSettings({});
    setOnboardingStep(1);
    setErrorMessage('');
    setPendingEmail('');
    setSubscriptionStatus('');
    setCurrentView('landing');
    localStorage.clear();
  };

  const handleSessionReplaced = () => {
    clearTimeout(inactivityRef.current);
    setUserId(null);
    setSessionToken('');
    setFirstName('');
    setSelectedAssets([]);
    setSubscriptionStatus('');
    localStorage.clear();
    setSessionError('Your account was signed in on another device. Please sign in again.');
    setCurrentView('signin');
  };

  useEffect(() => {
    if (!userId) return;
    const reset = () => {
      clearTimeout(inactivityRef.current);
      inactivityRef.current = setTimeout(() => {
        clearTimeout(inactivityRef.current);
        setUserId(null); setFirstName(''); setSelectedAssets([]);
        setAssetSettings({}); setOnboardingStep(1); setErrorMessage('');
        setPendingEmail(''); setCurrentView('landing');
        localStorage.clear();
      }, 60 * 60 * 1000);
    };
    const events = ['mousemove', 'keydown', 'click', 'touchstart', 'scroll'];
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset();
    return () => {
      events.forEach(e => window.removeEventListener(e, reset));
      clearTimeout(inactivityRef.current);
    };
  }, [userId]);

  const toggleAsset = (symbol) => {
    if (selectedAssets.includes(symbol)) {
      setSelectedAssets(selectedAssets.filter(a => a !== symbol));
    } else {
      setSelectedAssets([...selectedAssets, symbol]);
    }
  };

  const submitOnboarding = async () => {
    const finalAssets = selectedAssets.map(s => ({ symbol: s, threshold: assetSettings[s] || 2.0 }));
    try {
      const res = await fetch(`${API_BASE}/api/complete-onboarding`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: userId,
          assets: finalAssets,
          experience: tradingProfile.experience,
          frequency: tradingProfile.frequency
        })
      });
      if (res.ok) {
        setCurrentView(subscriptionStatus === 'active' ? 'main_app' : 'subscription');
      } else {
        const data = await res.json().catch(() => ({}));
        setErrorMessage(data.detail || 'Failed to save profile. Please try again.');
      }
    } catch (e) { setErrorMessage("Connection error. Please try again."); }
  };


  if (isAdminMode) {
    return (
      <Suspense fallback={null}>
        <AdminPanel onExit={() => { window.history.replaceState({}, '', '/'); window.location.reload(); }} />
      </Suspense>
    );
  }

  if (!betaUnlocked) {
    return <BetaGate onUnlock={() => setBetaUnlocked(true)} />;
  }

  return (
    <div style={{ color: '#fff', minHeight: '100vh', background: '#020202', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, "Inter", sans-serif', position: 'relative', overflowX: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(-45deg, #020202, #0a0303, #140505, #020202)', backgroundSize: '400% 400%', zIndex: 0 }}></div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        <style>{`
          .sultrax-nav { display: flex; justify-content: space-between; align-items: center; padding: 1.2rem 4rem; border-bottom: 1px solid #0d0d0d; }
          .nav-btn { border: 1px solid #222; color: #555; background: transparent; padding: 0.45rem 1.2rem; border-radius: 8px; cursor: pointer; font-weight: 700; font-size: 0.76rem; letter-spacing: 0.06em; font-family: inherit; transition: border-color 0.15s, color 0.15s, background 0.15s; white-space: nowrap; }
          .nav-btn:hover { border-color: #333; color: #888; }
          .nav-btn.active { border-color: #ff333355; color: #fff; background: rgba(255,51,51,0.07); box-shadow: 0 0 0 1px rgba(255,51,51,0.15); }
          .nav-btn.danger { border-color: #ff333340; color: #ff4444; }
          .nav-btn.danger:hover { border-color: #ff3333; }
          @keyframes tickerScroll { 0% { transform: translateX(0) } 100% { transform: translateX(-33.333%) } }
          @keyframes fadeUp { from { opacity: 0; transform: translateY(20px) } to { opacity: 1; transform: translateY(0) } }
          .land-card { background: #080808; border: 1px solid #111; border-radius: 16px; padding: 28px 24px; transition: border-color 0.2s; }
          .land-card:hover { border-color: #1e1e1e; }
          @media (max-width: 800px) { .land-features { grid-template-columns: 1fr !important; } .land-hero h1 { font-size: 2.8rem !important; } }
          @media (max-width: 540px) { .land-hero h1 { font-size: 2.2rem !important; } .land-cta { flex-direction: column; align-items: center; } }
          .nav-logo { font-size: 1.3rem; font-weight: 800; margin: 0; letter-spacing: 0.04em; white-space: nowrap; display: flex; align-items: center; gap: 8px; }
          .nav-center { display: flex; gap: 6px; }
          .nav-right { display: flex; gap: 6px; align-items: center; }
          @media (max-width: 900px) {
            .sultrax-nav { padding: 1rem 1.5rem; }
            .nav-btn { padding: 0.4rem 0.8rem; font-size: 0.7rem; }
            .nav-logo { font-size: 1.1rem; }
          }
          @media (max-width: 680px) {
            .sultrax-nav { padding: 0.9rem 1rem; }
            .nav-btn { padding: 0.35rem 0.65rem; font-size: 0.65rem; letter-spacing: 0.03em; }
            .nav-logo { font-size: 1rem; }
            .nav-btn-label { display: none; }
          }
        `}</style>
        {['landing', 'signup', 'signin', 'main_app', 'zone', 'scanner', 'settings'].includes(currentView) && !isNative && (
          <nav className="sultrax-nav">
            <h1 className="nav-logo" onClick={() => { if (!['main_app', 'zone', 'scanner', 'settings'].includes(currentView)) setCurrentView('landing'); }}
              style={{ cursor: ['main_app', 'zone', 'settings'].includes(currentView) ? 'default' : 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 12 34" style={{ width: '11px', height: '31px', flexShrink: 0 }}>
                <defs>
                  <linearGradient id="nb" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#6b0000"/>
                    <stop offset="38%" stopColor="#dd1515"/>
                    <stop offset="54%" stopColor="#ff5252"/>
                    <stop offset="100%" stopColor="#6b0000"/>
                  </linearGradient>
                  <linearGradient id="ng" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#3a0000"/>
                    <stop offset="50%" stopColor="#bb0f0f"/>
                    <stop offset="100%" stopColor="#3a0000"/>
                  </linearGradient>
                </defs>
                <polygon points="6,0 4,21 6,21.8 8,21" fill="url(#nb)"/>
                <line x1="6" y1="1" x2="4.1" y2="20.5" stroke="#ff9090" strokeWidth="0.3" opacity="0.55"/>
                <rect x="0" y="21" width="12" height="2.5" rx="1.25" fill="url(#ng)"/>
                <rect x="4.8" y="23.5" width="2.4" height="7" rx="1.2" fill="#7a0000"/>
                <circle cx="6" cy="32" r="2" fill="url(#ng)"/>
                <circle cx="6" cy="32" r="0.9" fill="#cc1010"/>
              </svg>
              SULTRAXAI
            </h1>

            {['main_app', 'zone', 'scanner', 'settings'].includes(currentView) ? (
              <div className="nav-center">
                <button className={`nav-btn${currentView === 'main_app' ? ' active' : ''}`} onClick={() => setCurrentView('main_app')}>DASHBOARD</button>
                <button className={`nav-btn${currentView === 'zone' ? ' active' : ''}`} onClick={() => setCurrentView('zone')}>THE ZONE</button>
                <button className={`nav-btn${currentView === 'scanner' ? ' active' : ''}`} onClick={() => setCurrentView('scanner')}>SCANNER</button>
              </div>
            ) : <div />}

            <div className="nav-right">
              {['main_app', 'zone', 'scanner', 'settings'].includes(currentView) ? (
                <>
                  <button className={`nav-btn${currentView === 'settings' ? ' active' : ''}`} onClick={() => setCurrentView('settings')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: '#1a1a1a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.58rem', fontWeight: '800', color: '#666', flexShrink: 0, border: '1px solid #2a2a2a' }}>
                      {(firstName || 'U').charAt(0).toUpperCase()}
                    </span>
                    <span className="nav-btn-label">ACCOUNT</span>
                  </button>
                  <button className="nav-btn danger" onClick={handleSignOut}>SIGN OUT</button>
                </>
              ) : (
                <>
                  {currentView !== 'signin' && <button className="nav-btn" onClick={() => setCurrentView('signin')}>SIGN IN</button>}
                  {currentView !== 'signup' && <button className="nav-btn danger" onClick={() => setCurrentView('signup')}>SIGN UP</button>}
                </>
              )}
            </div>
          </nav>
        )}

        <Suspense fallback={null}>
        {currentView === 'zone' && (
          <TheZone selectedAssets={selectedAssets} onBack={() => setCurrentView('main_app')} isNative={isNative} />
        )}

        {currentView === 'scanner' && (
          <Scanner isNative={isNative} />
        )}

        {currentView === 'settings' && (
          <AccountSettings userId={userId} sessionToken={sessionToken} onBack={() => setCurrentView('main_app')} onSignOut={handleSignOut} isNative={isNative} onProfileUpdate={setFirstName} />
        )}

        {currentView === 'subscription' && (
          <SubscriptionModal userId={userId} expired={!!userId} onSuccess={() => { setSubscriptionStatus('active'); setCurrentView('main_app'); }} onSignOut={handleSignOut} />
        )}
        </Suspense>

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: currentView === 'landing' ? 'flex-start' : 'center', padding: currentView === 'landing' ? '0' : '2rem' }}>

          {currentView === 'contact' && <ContactPage onBack={() => setCurrentView(previousView)} />}
        {currentView === 'terms'   && <TermsPage   onBack={() => setCurrentView(previousView)} />}
        {currentView === 'privacy' && <PrivacyPage onBack={() => setCurrentView(previousView)} />}

        {currentView === 'landing' && (
            isNative ? (
              <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', background: '#020202', overflow: 'hidden' }}>
                <div style={{ paddingTop: '80px', textAlign: 'center', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <img src="./sword-logo.png" alt="SultraxAI" style={{ width: '180px', height: '180px', objectFit: 'contain', marginBottom: '8px' }} />
                  <h1 style={{ fontSize: '2.4rem', fontWeight: '900', letterSpacing: '0.06em', margin: 0, color: '#fff' }}>SULTRAXAI</h1>
                  <p style={{ color: '#444', fontSize: '0.82rem', margin: '8px 0 0', letterSpacing: '0.06em' }}>Real-time market intelligence</p>
                </div>
                <div style={{ width: '100%', padding: '0 28px 56px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 1 }}>
                  <button onClick={() => setCurrentView('signin')} style={{ width: '100%', padding: '1rem', borderRadius: '14px', background: '#ff3333', border: 'none', color: '#fff', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', letterSpacing: '0.05em', boxShadow: '0 4px 24px rgba(255,51,51,0.35)' }}>LOG IN</button>
                  <button onClick={() => setCurrentView('signup')} style={{ width: '100%', padding: '1rem', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid #2a2a2a', color: '#888', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', letterSpacing: '0.05em' }}>CREATE ACCOUNT</button>
                </div>
              </div>
            ) : (
              <LandingPage onSignUp={() => setCurrentView('signup')} onSignIn={() => setCurrentView('signin')} onNavigateStatic={v => { setPreviousView('landing'); setCurrentView(v); }} />
            )
          )}

          {currentView === 'signup' && (
            <SignUpForm isNative={isNative} onBack={() => setCurrentView('landing')} onRegisterSuccess={handleRegisterSuccess} setErrorMessage={setErrorMessage} errorMessage={errorMessage} />
          )}

          {currentView === 'forgot_password' && (
            <ForgotPasswordForm isNative={isNative} onBack={() => setCurrentView('signin')} />
          )}

          {currentView === 'reset_password' && (
            <ResetPasswordForm isNative={isNative} token={resetToken} onSuccess={(userData) => {
              setUserId(userData.user_id);
              setFirstName(userData.first_name || '');
              setSelectedAssets(userData.assets || []);
              window.history.replaceState({}, document.title, '/');
              setCurrentView(userData.onboarding_completed ? 'main_app' : 'onboarding');
            }} />
          )}

          {currentView === 'verify' && (
            <div style={{ textAlign: 'center', color: '#fff', padding: '2rem', border: '1px solid #333', borderRadius: '24px', background: 'rgba(5,5,5,0.7)', width: '380px' }}>
              <h2 style={{ fontSize: '2rem' }}>Verify Account</h2>
              <p style={{ color: '#aaa', margin: '1rem 0' }}>Enter the 6-digit code sent to {pendingEmail}</p>
              <input
                type="text"
                maxLength="6"
                placeholder="000000"
                autoCorrect="off" autoCapitalize="none" spellCheck={false} inputMode="numeric" pattern="[0-9]*"
                style={{ width: '100%', padding: '1rem', background: '#000', border: '1px solid #333', color: '#fff', textAlign: 'center', fontSize: '1.5rem', letterSpacing: '0.5rem', marginBottom: '1rem', borderRadius: '12px', outline: 'none', boxSizing: 'border-box' }}
                onChange={(e) => {
                  if(e.target.value.length === 6) {
                    fetch(`${API_BASE}/api/verify-code`, {
                      method: 'POST',
                      headers: {'Content-Type': 'application/json'},
                      body: JSON.stringify({ email: pendingEmail, code: e.target.value })
                    })
                    .then(res => res.json())
                    .then(data => {
                      if (data.status === 'success') {
                        setPendingEmail('');
                        setCurrentView('onboarding');
                      }
                      else alert("Invalid code, please try again.");
                    });
                  }
                }}
              />
              <button onClick={() => { setPendingEmail(''); setCurrentView('signin'); }}
                style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', fontSize: '0.85rem', marginTop: '0.5rem' }}>
                ← Back to Sign In
              </button>
            </div>
          )}

          {currentView === 'signin' && (
            isNative ? (
              <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#020202' }}>
                <button onClick={() => setCurrentView('landing')}
                  style={{ position: 'absolute', top: '56px', left: '24px', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '1.5rem', zIndex: 10, padding: '4px 8px', lineHeight: 1 }}>
                  ←
                </button>
                <div style={{ flex: 1, padding: '100px 28px 48px', display: 'flex', flexDirection: 'column' }}>
                  <h2 style={{ fontSize: '2.4rem', fontWeight: '900', color: '#fff', margin: '0 0 6px', letterSpacing: '-0.01em' }}>Welcome back</h2>
                  <p style={{ color: '#555', fontSize: '0.88rem', margin: '0 0 36px', letterSpacing: '0.02em' }}>Sign in to your terminal</p>
                  {sessionError && <div style={{ color: '#ff9900', backgroundColor: 'rgba(255,153,0,0.1)', padding: '0.75rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.88rem', textAlign: 'center', border: '1px solid rgba(255,153,0,0.2)' }}>{sessionError}</div>}
                  {errorMessage && <div style={{ color: '#ff3333', backgroundColor: 'rgba(255,51,51,0.1)', padding: '0.75rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.88rem', textAlign: 'center' }}>{errorMessage}</div>}
                  <form onSubmit={async (e) => {
                    e.preventDefault(); setErrorMessage('');
                    try {
                      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e.target[0].value, password: e.target[1].value }) });
                      const data = await res.json();
                      if (res.ok) { setSessionError(''); setUserId(data.user_id); setSessionToken(data.session_token || ''); setFirstName(data.first_name || ''); setSubscriptionStatus(data.subscription_status || ''); if (data.chat_terms_accepted) localStorage.setItem('chat_terms_v1', 'accepted'); if (data.onboarding_completed) { setSelectedAssets(data.assets); setCurrentView(data.subscription_status === 'active' ? 'main_app' : 'subscription'); } else { setSelectedAssets([]); setOnboardingStep(1); setCurrentView('onboarding'); } } else setErrorMessage(data.detail);
                    } catch { setErrorMessage("Login failed."); }
                  }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <input type="text" inputMode="email" placeholder="Email" required style={mobileInputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                    <input type="password" placeholder="Password" required style={mobileInputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                    <button type="submit" style={{ marginTop: '8px', width: '100%', padding: '1rem', borderRadius: '14px', background: '#ff3333', border: 'none', color: '#fff', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', letterSpacing: '0.04em', boxShadow: '0 4px 24px rgba(255,51,51,0.3)' }}>
                      Connect to Terminal
                    </button>
                  </form>
                  <button type="button" onClick={() => setCurrentView('forgot_password')} style={{ marginTop: '12px', background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '0.85rem', textAlign: 'center', width: '100%' }}>
                    Forgot password?
                  </button>
                  <button onClick={() => setCurrentView('signup')} style={{ marginTop: '8px', background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '0.85rem', textAlign: 'center', width: '100%' }}>
                    Don't have an account? <span style={{ color: '#777' }}>Create one</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ width: '400px', background: 'rgba(5, 5, 5, 0.7)', padding: '2.5rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
                <h3 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '1.5rem', textAlign: 'center' }}>Sign In</h3>
                {sessionError && <div style={{ color: '#ff9900', backgroundColor: 'rgba(255,153,0,0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center', border: '1px solid rgba(255,153,0,0.2)' }}>{sessionError}</div>}
                {errorMessage && <div style={{ color: '#ff3333', backgroundColor: 'rgba(255,51,51,0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>{errorMessage}</div>}
                <form onSubmit={async (e) => {
                  e.preventDefault(); setErrorMessage('');
                  try {
                    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e.target[0].value, password: e.target[1].value }) });
                    const data = await res.json();
                    if (res.ok) { setSessionError(''); setUserId(data.user_id); setSessionToken(data.session_token || ''); setFirstName(data.first_name || ''); setSubscriptionStatus(data.subscription_status || ''); if (data.chat_terms_accepted) localStorage.setItem('chat_terms_v1', 'accepted'); if (data.onboarding_completed) { setSelectedAssets(data.assets); setCurrentView(data.subscription_status === 'active' ? 'main_app' : 'subscription'); } else { setSelectedAssets([]); setOnboardingStep(1); setCurrentView('onboarding'); } } else setErrorMessage(data.detail);
                  } catch { setErrorMessage("Login failed."); }
                }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <input type="text" inputMode="email" placeholder="Email Address" required style={inputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                  <input type="password" placeholder="Password" required style={inputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                  <button type="submit" style={{ backgroundColor: '#ff3333', color: '#fff', padding: '1rem', border: 'none', borderRadius: '12px', fontWeight: '600', cursor: 'pointer' }}>Connect to Terminal</button>
                  <button type="button" onClick={() => setCurrentView('forgot_password')} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.82rem', textAlign: 'center', marginTop: '0.25rem' }}>Forgot password?</button>
                </form>
              </div>
            )
          )}

          {currentView === 'onboarding' && (
            <div style={{ width: '450px', background: 'rgba(5, 5, 5, 0.7)', padding: '2.5rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', marginTop: '2rem' }}>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '2rem' }}>
                {[1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: '4px', background: onboardingStep >= i ? '#ff3333' : '#333', borderRadius: '2px' }} />)}
              </div>
              {onboardingStep === 1 && <OnboardingStep1
                selectedAssets={selectedAssets} toggleAsset={toggleAsset}
                setOnboardingStep={setOnboardingStep}
              />}
              {onboardingStep === 2 && <OnboardingStep2
                selectedAssets={selectedAssets}
                assetSettings={assetSettings} setAssetSettings={setAssetSettings}
                setOnboardingStep={setOnboardingStep}
              />}
              {onboardingStep === 3 && <OnboardingStep3
                tradingProfile={tradingProfile} setTradingProfile={setTradingProfile}
                submitOnboarding={submitOnboarding}
              />}
            </div>
          )}

         {currentView === 'main_app' && (
            <MainTerminal userId={userId} sessionToken={sessionToken} selectedAssets={selectedAssets} onSignOut={handleSignOut} onSessionReplaced={handleSessionReplaced} onAssetsUpdate={setSelectedAssets} isNative={isNative} onNavigateToZone={() => setCurrentView('zone')} onNavigateToSettings={() => setCurrentView('settings')} onNavigateToScanner={() => setCurrentView('scanner')} />
          )}

        </div>
      {['main_app', 'zone', 'scanner', 'settings'].includes(currentView) && !isNative && (
        <SupportBot />
      )}
      {['main_app', 'zone', 'scanner', 'settings'].includes(currentView) && !isNative && (
        <CommunityChat userId={userId} sessionToken={sessionToken} />
      )}
      {!isNative && (
        <div style={{ borderTop: '1px solid #0a0a0a', padding: '14px 0', display: 'flex', justifyContent: 'center', gap: '28px' }}>
          {[['Contact', 'contact'], ['Terms of Service', 'terms'], ['Privacy Policy', 'privacy']].map(([label, view]) => (
            <button key={view} onClick={() => { setPreviousView(currentView); setCurrentView(view); }}
              style={{ background: 'none', border: 'none', color: '#252525', cursor: 'pointer', fontSize: '0.6rem', fontWeight: '600', letterSpacing: '0.08em', fontFamily: 'inherit', textTransform: 'uppercase', transition: 'color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.color = '#555'}
              onMouseLeave={e => e.currentTarget.style.color = '#252525'}>
              {label}
            </button>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}

function OnboardingStep1({ selectedAssets, toggleAsset, setOnboardingStep }) {
  const [searchResults, setSearchResults] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
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

  return (
    <div style={{ textAlign: 'left' }}>
      <h3 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Step 1: Select Assets</h3>
      <p style={{ color: '#888', marginBottom: '2rem' }}>Search and choose at least 3 assets to follow.</p>

      <div style={{ position: 'relative', marginBottom: '1rem' }}>
        <input
          type="text"
          placeholder="Search any stock or crypto (e.g. TSLA, BTC)..."
          onChange={e => handleSearch(e.target.value)}
          dir="auto"
          style={{ width: '100%', padding: '1rem', background: '#111', border: '1px solid #333', borderRadius: '12px', color: '#fff', outline: 'none', boxSizing: 'border-box', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, sans-serif' }}
        />
        {(searchLoading || searchResults.length > 0) && (
          <div style={{ position: 'absolute', top: 'calc(100% + 4px)', left: 0, right: 0, background: '#111', border: '1px solid #333', borderRadius: '12px', maxHeight: '240px', overflowY: 'auto', zIndex: 100 }}>
            {searchLoading && <div style={{ padding: '1rem', color: '#666', textAlign: 'center', fontSize: '0.85rem' }}>Searching...</div>}
            {searchResults.map(item => (
              <div key={item.symbol} onMouseDown={e => e.preventDefault()} onClick={() => toggleAsset(item.symbol)} style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '0.75rem 1rem', cursor: 'pointer', borderBottom: '1px solid #1a1a1a',
                background: selectedAssets.includes(item.symbol) ? 'rgba(255,51,51,0.08)' : 'transparent',
              }}>
                <div>
                  <span style={{ fontWeight: '600', color: '#fff' }}>{item.symbol}</span>
                  <span style={{ marginLeft: '10px', color: '#666', fontSize: '0.8rem' }}>{item.name}</span>
                </div>
                {selectedAssets.includes(item.symbol)
                  ? <span style={{ color: '#ff3333', fontSize: '0.8rem' }}>✓</span>
                  : <span style={{ color: '#555', fontSize: '0.8rem' }}>+</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedAssets.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '1rem' }}>
          {selectedAssets.map(s => (
            <div key={s} onClick={() => toggleAsset(s)} style={{ padding: '5px 12px', borderRadius: '20px', background: 'rgba(255,51,51,0.15)', border: '1px solid #ff3333', color: '#ff3333', fontSize: '0.8rem', cursor: 'pointer' }}>
              {s} ✕
            </div>
          ))}
        </div>
      )}

      <button disabled={selectedAssets.length < 3} onClick={() => setOnboardingStep(2)}
        style={{ marginTop: '0.5rem', width: '100%', padding: '1rem', background: selectedAssets.length >= 3 ? '#ff3333' : '#222', border: 'none', borderRadius: '12px', color: selectedAssets.length >= 3 ? '#fff' : '#555', cursor: selectedAssets.length >= 3 ? 'pointer' : 'not-allowed', fontWeight: '600' }}>
        Continue ({selectedAssets.length}/3 selected)
      </button>
    </div>
  );
}

const SENSITIVITY_LEVELS = [
  { label: 'Major only', desc: '>5% move', value: 5.0, color: '#ff3333' },
  { label: 'Standard', desc: '>2% move', value: 2.0, color: '#ff9900' },
  { label: 'All signals', desc: '>1% move', value: 1.0, color: '#44cc44' },
];

function OnboardingStep2({ selectedAssets, assetSettings, setAssetSettings, setOnboardingStep }) {
  const getLevel = (symbol) => assetSettings[symbol] ?? 2.0;

  return (
    <div style={{ textAlign: 'left' }}>
      <h3 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Step 2: Alert Sensitivity</h3>
      <p style={{ color: '#888', marginBottom: '2rem' }}>How sensitive should alerts be for each asset?</p>
      <div style={{ maxHeight: '320px', overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {selectedAssets.map(s => (
          <div key={s} style={{ background: '#111', padding: '1rem', borderRadius: '12px', border: '1px solid #222' }}>
            <div style={{ fontWeight: '600', marginBottom: '0.6rem' }}>{s}</div>
            <div style={{ display: 'flex', gap: '8px' }}>
              {SENSITIVITY_LEVELS.map(lvl => {
                const selected = getLevel(s) === lvl.value;
                return (
                  <button key={lvl.value} onClick={() => setAssetSettings({ ...assetSettings, [s]: lvl.value })}
                    style={{ flex: 1, padding: '0.5rem 0.25rem', borderRadius: '8px', border: `1px solid ${selected ? lvl.color : '#333'}`, background: selected ? `${lvl.color}22` : 'transparent', color: selected ? lvl.color : '#666', cursor: 'pointer', fontSize: '0.75rem', fontWeight: selected ? '700' : '400', transition: '0.15s' }}>
                    <div>{lvl.label}</div>
                    <div style={{ fontSize: '0.65rem', opacity: 0.8 }}>{lvl.desc}</div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => setOnboardingStep(3)} style={{ marginTop: '2rem', width: '100%', padding: '1rem', background: '#ff3333', border: 'none', borderRadius: '12px', color: '#fff', cursor: 'pointer', fontWeight: '600' }}>Next</button>
    </div>
  );
}

function OnboardingStep3({ tradingProfile, setTradingProfile, submitOnboarding }) {
  return (
    <div style={{ textAlign: 'left' }}>
      <h3 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Step 3: Trading Profile</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <label style={{ fontSize: '0.9rem', color: '#aaa' }}>Experience Level
          <select value={tradingProfile.experience} onChange={e => setTradingProfile({ ...tradingProfile, experience: e.target.value })} style={{ width: '100%', padding: '1rem', background: '#111', color: '#fff', borderRadius: '12px', marginTop: '5px', border: '1px solid #222', outline: 'none', cursor: 'pointer' }}>
            <option>Beginner (0-1 yrs)</option><option>Intermediate (1-3 yrs)</option><option>Professional (3+ yrs)</option>
          </select>
        </label>
        <label style={{ fontSize: '0.9rem', color: '#aaa' }}>How often do you check markets?
          <select value={tradingProfile.frequency} onChange={e => setTradingProfile({ ...tradingProfile, frequency: e.target.value })} style={{ width: '100%', padding: '1rem', background: '#111', color: '#fff', borderRadius: '12px', marginTop: '5px', border: '1px solid #222', outline: 'none', cursor: 'pointer' }}>
            <option>Every Hour</option><option>Daily</option><option>Weekly</option>
          </select>
        </label>
      </div>
      <button onClick={submitOnboarding} style={{ marginTop: '2rem', width: '100%', padding: '1rem', background: '#ff3333', border: 'none', borderRadius: '12px', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>FINISH & ENTER TERMINAL</button>
    </div>
  );
}

function SignUpForm({ isNative, onBack, onRegisterSuccess, setErrorMessage, errorMessage }) {
  const [firstName, setFirstName] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [usernameAvailable, setUsernameAvailable] = useState(null);
  const [usernameMsg, setUsernameMsg] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+972');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

  useEffect(() => {
    if (!username.trim() || username.length < 3) {
      setUsernameAvailable(null); setUsernameMsg('');
      return;
    }
    const timer = setTimeout(async () => {
      setCheckingUsername(true);
      try {
        const res = await fetch(`/api/check-username?username=${encodeURIComponent(username)}`);
        const data = await res.json();
        setUsernameAvailable(data.available);
        setUsernameMsg(data.available ? 'Username is available' : (data.error || 'Not available'));
      } catch { setUsernameAvailable(null); setUsernameMsg(''); }
      setCheckingUsername(false);
    }, 600);
    return () => clearTimeout(timer);
  }, [username]);

  const isPasswordStrong = (pwd) => {
    const hasMinLength = pwd.length >= 8;
    const hasUppercase = /[A-Z]/.test(pwd);
    const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>_+\-\[\]\/\\]/.test(pwd);
    return { hasMinLength, hasUppercase, hasSpecialChar, isValid: hasMinLength && hasUppercase && hasSpecialChar };
  };

  const pwdCriteria = isPasswordStrong(password);
  const isEmailValid = (em) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em);

  const isFormValid =
    firstName.trim() !== '' && fullName.trim() !== '' &&
    username.trim() !== '' && usernameAvailable === true &&
    isEmailValid(email) && phone.trim() !== '' &&
    pwdCriteria.isValid && password === confirmPassword && agreeTerms;

  const [showValidationErrors, setShowValidationErrors] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) { setShowValidationErrors(true); return; }
    setShowValidationErrors(false);
    setErrorMessage('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          full_name: fullName,
          username: username.trim(),
          email: email.trim(),
          phone: `${countryCode}${phone.trim()}`,
          password: password
        })
      });
      const data = await res.json();
      if (res.ok) onRegisterSuccess(data.user_id, email);
      else setErrorMessage(data.detail);
    } catch (err) {
      setErrorMessage("Connection error. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const formContent = (
    <>
      <h3 style={{ fontSize: isNative ? '2.4rem' : '1.8rem', fontWeight: '800', marginBottom: isNative ? '6px' : '1.5rem', textAlign: isNative ? 'left' : 'center', letterSpacing: isNative ? '-0.01em' : 'normal' }}>Create Account</h3>
      {isNative && <p style={{ color: '#555', fontSize: '0.88rem', margin: '0 0 28px', letterSpacing: '0.02em' }}>Join the terminal</p>}
      {errorMessage && <div style={{ color: '#ff3333', backgroundColor: 'rgba(255,51,51,0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center', border: '1px solid rgba(255,51,51,0.2)' }}>{errorMessage}</div>}
      
      <form onSubmit={handleSubmit} noValidate style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
        <div contentEditable="plaintext-only" suppressContentEditableWarning data-placeholder="First Name"
          onInput={e => setFirstName(e.currentTarget.textContent || '')}
          dir="auto"
          style={{ ...(isNative ? mobileInputStyle : inputStyle), minHeight: '1.4em', cursor: 'text', whiteSpace: 'nowrap', overflowX: 'hidden' }} />
        <div contentEditable="plaintext-only" suppressContentEditableWarning data-placeholder="Full Name"
          onInput={e => setFullName(e.currentTarget.textContent || '')}
          dir="auto"
          style={{ ...(isNative ? mobileInputStyle : inputStyle), minHeight: '1.4em', cursor: 'text', whiteSpace: 'nowrap', overflowX: 'hidden' }} />
        <div style={{ position: 'relative' }}>
          <input
            type="text" placeholder="Username"
            value={username} onChange={e => setUsername(e.target.value.replace(/\s/g, ''))}
            style={{ ...(isNative ? mobileInputStyle : inputStyle), paddingRight: '2.5rem',
              borderColor: usernameAvailable === true ? '#225522' : usernameAvailable === false ? '#662222' : undefined }}
            autoCorrect="off" autoCapitalize="none" spellCheck={false} maxLength={20}
          />
          <span style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '0.7rem' }}>
            {checkingUsername ? '...' : usernameAvailable === true ? '✓' : usernameAvailable === false ? '✗' : ''}
          </span>
        </div>
        {usernameMsg && (
          <span style={{ color: usernameAvailable ? '#44cc44' : '#ff6666', fontSize: '0.75rem', marginTop: '-0.5rem' }}>
            {usernameMsg}
          </span>
        )}
        <input type="text" inputMode="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} style={isNative ? mobileInputStyle : inputStyle} required autoCorrect="off" autoCapitalize="none" spellCheck={false} />
        {email && !isEmailValid(email) && <span style={{ color: '#ff3333', fontSize: '0.8rem', marginTop: '-0.5rem' }}>Please enter a valid email format</span>}

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select value={countryCode} onChange={e => setCountryCode(e.target.value)} style={{ ...(isNative ? mobileInputStyle : inputStyle), width: '38%', cursor: 'pointer' }}>
            {isNative ? (
              <>
                <option value="+972">+972 IL</option>
                <option value="+1">+1 US</option>
                <option value="+44">+44 GB</option>
              </>
            ) : (
              <>
                <option value="+972">🇮🇱 +972</option>
                <option value="+1">🇺🇸 +1</option>
                <option value="+44">🇬🇧 +44</option>
              </>
            )}
          </select>
          <input type="tel" placeholder="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} style={{ ...(isNative ? mobileInputStyle : inputStyle), width: '62%' }} required inputMode="numeric" pattern="[0-9]*" />
        </div>

        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={isNative ? mobileInputStyle : inputStyle} required autoCorrect="off" autoCapitalize="none" spellCheck={false} />

        {password && (
          <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '0.25rem', color: '#aaa' }}>
            <span style={{ color: pwdCriteria.hasMinLength ? '#44ff44' : '#ff3333' }}>✓ Minimum 8 characters</span>
            <span style={{ color: pwdCriteria.hasUppercase ? '#44ff44' : '#ff3333' }}>✓ At least one uppercase letter (A-Z)</span>
            <span style={{ color: pwdCriteria.hasSpecialChar ? '#44ff44' : '#ff3333' }}>✓ At least one special character (!@#$)</span>
          </div>
        )}

        <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={isNative ? mobileInputStyle : inputStyle} required autoCorrect="off" autoCapitalize="none" spellCheck={false} />
        {password && confirmPassword && password !== confirmPassword && (
          <span style={{ color: '#ff3333', fontSize: '0.8rem' }}>Passwords do not match</span>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#aaa', cursor: 'pointer', marginTop: '0.5rem' }}>
          <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#ff3333' }} />
          I agree to the Terms of Service & Privacy Policy
        </label>
        
        {!isFormValid && showValidationErrors && (
          <div style={{ fontSize: '0.85rem', color: '#ff6666', background: 'rgba(255,51,51,0.08)', border: '1px solid rgba(255,51,51,0.3)', padding: '0.75rem', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {!firstName.trim() && <span>• First name is required</span>}
            {!fullName.trim() && <span>• Full name is required</span>}
            {!username.trim() && <span>• Username is required</span>}
            {username.trim() && usernameAvailable !== true && <span>• Choose a valid, available username</span>}
            {!isEmailValid(email) && <span>• Valid email is required</span>}
            {!phone.trim() && <span>• Phone number is required</span>}
            {!pwdCriteria.isValid && <span>• Password doesn't meet requirements</span>}
            {password !== confirmPassword && <span>• Passwords do not match</span>}
            {!agreeTerms && <span>• You must agree to the Terms of Service</span>}
          </div>
        )}
        <button type="submit" disabled={isLoading} style={{ backgroundColor: isFormValid && !isLoading ? '#ff3333' : '#331111', color: isFormValid && !isLoading ? '#fff' : '#666', padding: '1rem', border: 'none', borderRadius: isNative ? '14px' : '12px', fontWeight: '600', cursor: isLoading ? 'not-allowed' : 'pointer', marginTop: '0.5rem', transition: '0.3s', boxShadow: isNative && isFormValid ? '0 4px 24px rgba(255,51,51,0.3)' : 'none' }}>
          {isLoading ? 'Creating account...' : 'Register & Continue'}
        </button>
      </form>
    </>
  );

  return isNative ? (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#020202' }}>
      <button onClick={onBack}
        style={{ position: 'absolute', top: '56px', left: '24px', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '1.5rem', zIndex: 10, padding: '4px 8px', lineHeight: 1 }}>
        ←
      </button>
      <div style={{ flex: 1, padding: '100px 28px 48px', overflowY: 'auto' }}>
        {formContent}
      </div>
    </div>
  ) : (
    <div style={{ width: '450px', background: 'rgba(5, 5, 5, 0.7)', padding: '2.5rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
      {formContent}
    </div>
  );
}

function ForgotPasswordForm({ isNative, onBack }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true); setError('');
    try {
      await fetch(`${API_BASE}/api/forgot-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() })
      });
      setSent(true);
    } catch { setError('Connection error. Please try again.'); }
    setLoading(false);
  };

  const content = (
    <>
      <h3 style={{ fontSize: isNative ? '2.4rem' : '1.8rem', fontWeight: '800', marginBottom: isNative ? '6px' : '1.5rem', textAlign: isNative ? 'left' : 'center' }}>Reset Password</h3>
      {isNative && <p style={{ color: '#555', fontSize: '0.88rem', margin: '0 0 28px' }}>Enter your account email</p>}
      {sent ? (
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>📬</div>
          <p style={{ color: '#aaa', fontSize: '0.9rem', lineHeight: 1.7 }}>Check your inbox.<br />A reset link has been sent.</p>
          <button onClick={onBack} style={{ marginTop: '1.5rem', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.85rem' }}>← Back to Sign In</button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div style={{ color: '#ff3333', background: 'rgba(255,51,51,0.1)', padding: '0.75rem', borderRadius: '8px', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}
          <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} required style={isNative ? mobileInputStyle : inputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
          <button type="submit" disabled={loading} style={{ backgroundColor: '#ff3333', color: '#fff', padding: '1rem', border: 'none', borderRadius: isNative ? '14px' : '12px', fontWeight: '600', cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Sending…' : 'Send Reset Link'}
          </button>
          <button type="button" onClick={onBack} style={{ background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '0.85rem', textAlign: 'center' }}>← Back to Sign In</button>
        </form>
      )}
    </>
  );

  return isNative ? (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#020202' }}>
      <button onClick={onBack} style={{ position: 'absolute', top: '56px', left: '24px', background: 'none', border: 'none', color: '#555', cursor: 'pointer', fontSize: '1.5rem', zIndex: 10, padding: '4px 8px', lineHeight: 1 }}>←</button>
      <div style={{ flex: 1, padding: '100px 28px 48px', display: 'flex', flexDirection: 'column' }}>{content}</div>
    </div>
  ) : (
    <div style={{ width: '400px', background: 'rgba(5,5,5,0.7)', padding: '2.5rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>{content}</div>
  );
}

function ResetPasswordForm({ isNative, token, onSuccess }) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const criteria = {
    hasMinLength: password.length >= 8,
    hasUppercase: /[A-Z]/.test(password),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>_+\-[\]/\\]/.test(password),
  };
  const isStrong = criteria.hasMinLength && criteria.hasUppercase && criteria.hasSpecialChar;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (password !== confirm) { setError('Passwords do not match'); return; }
    if (!isStrong) { setError('Password does not meet requirements'); return; }
    setLoading(true); setError('');
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const res = await fetch(`${API_BASE}/api/reset-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      const data = await res.json();
      if (res.ok) {
        setDone(true);
        setTimeout(() => onSuccess(data), 1200);
      } else {
        setError(data.detail || 'Invalid or expired link. Please request a new reset email.');
      }
    } catch (err) {
      setError(err.name === 'AbortError' ? 'Request timed out. Check your connection.' : 'Connection error. Please try again.');
    }
    setLoading(false);
  };

  const content = (
    <>
      <h3 style={{ fontSize: isNative ? '2.4rem' : '1.8rem', fontWeight: '800', marginBottom: isNative ? '6px' : '1.5rem', textAlign: isNative ? 'left' : 'center' }}>New Password</h3>
      {isNative && <p style={{ color: '#555', fontSize: '0.88rem', margin: '0 0 28px' }}>Choose a strong password</p>}
      {done ? (
        <div style={{ textAlign: 'center', padding: '1rem 0' }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>✓</div>
          <p style={{ color: '#44cc44', fontSize: '0.9rem' }}>Password updated. Entering terminal…</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {error && <div style={{ color: '#fff', background: '#cc0000', padding: '0.85rem', borderRadius: '10px', fontSize: '0.88rem', textAlign: 'center', fontWeight: '600' }}>{error}</div>}
          <input type="password" placeholder="New Password" value={password} onChange={e => setPassword(e.target.value)} required style={isNative ? mobileInputStyle : inputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
          {password && (
            <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '0.25rem' }}>
              <span style={{ color: criteria.hasMinLength ? '#44ff44' : '#ff4444' }}>✓ Minimum 8 characters</span>
              <span style={{ color: criteria.hasUppercase ? '#44ff44' : '#ff4444' }}>✓ At least one uppercase letter (A-Z)</span>
              <span style={{ color: criteria.hasSpecialChar ? '#44ff44' : '#ff4444' }}>✓ At least one special character (!@#$)</span>
            </div>
          )}
          <input type="password" placeholder="Confirm Password" value={confirm} onChange={e => setConfirm(e.target.value)} required style={isNative ? mobileInputStyle : inputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
          {password && confirm && password !== confirm && <span style={{ color: '#ff4444', fontSize: '0.8rem' }}>Passwords do not match</span>}
          <button type="submit" disabled={loading || !isStrong} style={{ backgroundColor: isStrong && !loading ? '#ff3333' : '#222', color: isStrong && !loading ? '#fff' : '#555', padding: '1rem', border: 'none', borderRadius: isNative ? '14px' : '12px', fontWeight: '700', cursor: isStrong && !loading ? 'pointer' : 'not-allowed', marginTop: '0.5rem', transition: '0.2s', letterSpacing: '0.04em' }}>
            {loading ? '⏳ Saving…' : 'Set New Password'}
          </button>
        </form>
      )}
    </>
  );

  return isNative ? (
    <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', background: '#020202' }}>
      <div style={{ flex: 1, padding: '100px 28px 48px', display: 'flex', flexDirection: 'column' }}>{content}</div>
    </div>
  ) : (
    <div style={{ width: '400px', background: 'rgba(5,5,5,0.7)', padding: '2.5rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>{content}</div>
  );
}

const TICKER_DATA = [
  { sym: 'AAPL',    pct: '+0.59', up: true  },
  { sym: 'TSLA',    pct: '-1.33', up: false },
  { sym: 'NVDA',    pct: '+2.10', up: true  },
  { sym: 'BTC/USD', pct: '+1.24', up: true  },
  { sym: 'ETH/USD', pct: '-0.87', up: false },
  { sym: 'AMZN',    pct: '+1.64', up: true  },
  { sym: 'MSFT',    pct: '-0.53', up: false },
  { sym: 'META',    pct: '+1.73', up: true  },
  { sym: 'GOOGL',   pct: '+1.25', up: true  },
  { sym: 'AMD',     pct: '-1.98', up: false },
  { sym: 'PLTR',    pct: '+3.76', up: true  },
  { sym: 'SOL/USD', pct: '+3.58', up: true  },
  { sym: 'COIN',    pct: '-2.11', up: false },
  { sym: 'NFLX',    pct: '+0.94', up: true  },
  { sym: 'XRP/USD', pct: '+4.20', up: true  },
];

const FEATURES = [
  {
    tag: 'DASHBOARD',
    headline: 'Live Price Terminal',
    body: 'Real-time price feeds across stocks and crypto. Instant alerts when any asset crosses your threshold.',
    accent: '#4488ff',
    bg: 'rgba(68,136,255,0.06)',
  },
  {
    tag: 'THE ZONE',
    headline: 'Unified Intel Feed',
    body: 'Breaking news, social posts, and analyst takes — merged into one feed, tagged by source, sorted by time.',
    accent: '#ff3333',
    bg: 'rgba(255,51,51,0.06)',
  },
  {
    tag: 'SMART ALERTS',
    headline: 'Custom Sensitivity',
    body: 'Set individual alert thresholds per asset. Filter out noise. Only get notified when it actually matters.',
    accent: '#44cc44',
    bg: 'rgba(68,204,68,0.06)',
  },
];

function LandingPage({ onSignUp, onSignIn, onNavigateStatic }) {
  return (
    <div style={{ width: '100%', animation: 'fadeUp 0.5s ease both' }}>

      {/* Scrolling ticker tape */}
      <div style={{ overflow: 'hidden', borderBottom: '1px solid #0d0d0d', padding: '9px 0', marginBottom: '5rem' }}>
        <div style={{ display: 'flex', width: 'max-content', animation: 'tickerScroll 40s linear infinite' }}>
          {[...TICKER_DATA, ...TICKER_DATA, ...TICKER_DATA].map((t, i) => (
            <span key={i} style={{ marginRight: '2.5rem', fontSize: '0.68rem', fontWeight: '700', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>
              <span style={{ color: '#2a2a2a' }}>{t.sym}</span>
              <span style={{ color: t.up ? '#44cc44' : '#ff4444', marginLeft: '6px' }}>{t.up ? '▲' : '▼'} {t.pct}%</span>
            </span>
          ))}
        </div>
      </div>

      {/* Hero */}
      <div className="land-hero" style={{ textAlign: 'center', padding: '0 2rem', marginBottom: '5rem' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.6rem', fontWeight: '800', letterSpacing: '0.14em', color: '#ff3333', background: 'rgba(255,51,51,0.07)', border: '1px solid rgba(255,51,51,0.18)', padding: '4px 14px', borderRadius: '20px', marginBottom: '2rem' }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#ff3333', boxShadow: '0 0 6px #ff3333', display: 'inline-block' }} />
          REAL-TIME MARKET INTELLIGENCE
        </div>

        <h1 style={{ fontSize: '5.5rem', fontWeight: '900', lineHeight: 1.0, margin: '0 0 1.5rem', background: 'linear-gradient(to bottom, #ffffff 30%, #333333 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', letterSpacing: '-0.03em' }}>
          MOVE BEFORE<br />THE MARKET DOES.
        </h1>

        <p style={{ color: '#3a3a3a', fontSize: '1.05rem', maxWidth: '500px', margin: '0 auto 2.5rem', lineHeight: 1.75 }}>
          Track stocks and crypto in real-time. Monitor breaking news, social sentiment, and price alerts — all in one dark terminal built for traders.
        </p>

        <div className="land-cta" style={{ display: 'flex', justifyContent: 'center' }}>
          <button onClick={onSignUp} style={{ background: '#ff3333', border: 'none', color: '#fff', padding: '0.85rem 2.4rem', borderRadius: '10px', fontWeight: '700', fontSize: '0.82rem', letterSpacing: '0.07em', cursor: 'pointer', boxShadow: '0 4px 28px rgba(255,51,51,0.3)', fontFamily: 'inherit' }}>
            GET STARTED →
          </button>
        </div>
      </div>

      {/* Feature cards */}
      <div className="land-features" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', maxWidth: '920px', margin: '0 auto 6rem', padding: '0 2rem' }}>
        {FEATURES.map((f, i) => (
          <div key={i} className="land-card" style={{ background: f.bg, borderColor: f.accent + '18' }}>
            <div style={{ fontSize: '0.58rem', fontWeight: '800', letterSpacing: '0.12em', color: f.accent, marginBottom: '12px', background: f.bg, border: `1px solid ${f.accent}30`, display: 'inline-block', padding: '3px 10px', borderRadius: '5px' }}>{f.tag}</div>
            <div style={{ fontSize: '0.95rem', fontWeight: '800', color: '#ccc', marginBottom: '10px', letterSpacing: '-0.01em' }}>{f.headline}</div>
            <p style={{ color: '#2e2e2e', fontSize: '0.8rem', lineHeight: 1.7, margin: 0 }}>{f.body}</p>
          </div>
        ))}
      </div>

    </div>
  );
}

const SYS_FONT = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';
const inputStyle = { padding: '1rem', background: '#111', border: '1px solid #222', borderRadius: '12px', color: '#fff', outline: 'none', fontFamily: SYS_FONT };
const mobileInputStyle = { padding: '1rem 1.25rem', background: '#111', border: '1px solid #1e1e1e', borderRadius: '14px', color: '#fff', outline: 'none', fontSize: '1rem', boxSizing: 'border-box', width: '100%', fontFamily: SYS_FONT };

// ─── STATIC PAGES ────────────────────────────────────────────────────────────

function PageShell({ title, onBack, children }) {
  return (
    <div style={{ minHeight: '100vh', background: '#020202', color: '#fff', fontFamily: SYS_FONT }}>
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '3rem 2rem 6rem' }}>
        <button onClick={onBack} style={{ background: 'none', border: '1px solid #1e1e1e', color: '#555', padding: '7px 18px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '600', marginBottom: '2.5rem', fontFamily: 'inherit' }}>← Back</button>
        <h1 style={{ fontSize: '1.8rem', fontWeight: '900', letterSpacing: '0.04em', marginBottom: '0.5rem', background: 'linear-gradient(to right,#fff 50%,#555)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{title}</h1>
        <div style={{ height: '1px', background: '#111', margin: '1.5rem 0 2rem' }} />
        {children}
      </div>
    </div>
  );
}

function ContactPage({ onBack }) {
  const [form, setForm] = useState({ name: '', email: '', subject: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));
  const valid = form.name && form.email && form.subject && form.message;

  const send = async (e) => {
    e.preventDefault();
    setSending(true); setError('');
    try {
      const res = await fetch(`${API_BASE}/api/contact`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) setSent(true);
      else setError('Failed to send. Please try again.');
    } catch { setError('Connection error. Please try again.'); }
    setSending(false);
  };

  const fi = { width: '100%', padding: '0.85rem 1rem', background: '#0a0a0a', border: '1px solid #1e1e1e', borderRadius: '10px', color: '#e8e8e8', outline: 'none', fontFamily: SYS_FONT, fontSize: '0.88rem', boxSizing: 'border-box' };

  return (
    <PageShell title="Contact Us" onBack={onBack}>
      {sent ? (
        <div style={{ textAlign: 'center', padding: '3rem 0' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✓</div>
          <p style={{ color: '#44cc44', fontSize: '1rem', fontWeight: '600' }}>Message sent!</p>
          <p style={{ color: '#444', fontSize: '0.85rem', marginTop: '8px' }}>We'll get back to you at {form.email}</p>
        </div>
      ) : (
        <form onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
          <p style={{ color: '#333', fontSize: '0.85rem', lineHeight: 1.7, margin: '0 0 0.5rem' }}>Have a question, bug report, or feature request? We read every message.</p>
          {error && <div style={{ background: '#1a0000', border: '1px solid #440000', borderRadius: '10px', padding: '0.75rem 1rem', color: '#ff6666', fontSize: '0.82rem' }}>{error}</div>}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div><label style={{ fontSize: '0.62rem', color: '#444', fontWeight: '700', letterSpacing: '0.1em', display: 'block', marginBottom: '7px' }}>NAME</label><input value={form.name} onChange={e => set('name', e.target.value)} style={fi} required /></div>
            <div><label style={{ fontSize: '0.62rem', color: '#444', fontWeight: '700', letterSpacing: '0.1em', display: 'block', marginBottom: '7px' }}>EMAIL</label><input type="email" value={form.email} onChange={e => set('email', e.target.value)} style={fi} required /></div>
          </div>
          <div><label style={{ fontSize: '0.62rem', color: '#444', fontWeight: '700', letterSpacing: '0.1em', display: 'block', marginBottom: '7px' }}>SUBJECT</label><input value={form.subject} onChange={e => set('subject', e.target.value)} style={fi} required /></div>
          <div><label style={{ fontSize: '0.62rem', color: '#444', fontWeight: '700', letterSpacing: '0.1em', display: 'block', marginBottom: '7px' }}>MESSAGE</label><textarea value={form.message} onChange={e => set('message', e.target.value)} rows={6} style={{ ...fi, resize: 'vertical', lineHeight: 1.6 }} required /></div>
          <button type="submit" disabled={!valid || sending} style={{ padding: '0.85rem', background: valid ? '#ff3333' : '#0d0d0d', border: `1px solid ${valid ? '#ff333350' : '#141414'}`, borderRadius: '10px', color: valid ? '#fff' : '#2a2a2a', fontWeight: '700', cursor: valid ? 'pointer' : 'default', fontSize: '0.88rem', opacity: sending ? 0.7 : 1, fontFamily: SYS_FONT }}>
            {sending ? 'Sending…' : 'Send Message'}
          </button>
        </form>
      )}
    </PageShell>
  );
}

function TermsPage({ onBack }) {
  const S = { color: '#888', fontSize: '0.88rem', lineHeight: 1.8, margin: '0 0 1.5rem' };
  const H = { color: '#ccc', fontSize: '0.95rem', fontWeight: '700', margin: '2rem 0 0.5rem' };
  const WARN = { background: '#1a0800', border: '1px solid #ff440033', borderRadius: '10px', padding: '1rem 1.2rem', color: '#ff8844', fontSize: '0.85rem', lineHeight: 1.8, margin: '0 0 2rem' };
  return (
    <PageShell title="Terms of Service" onBack={onBack}>
      <p style={{ ...S, color: '#444', fontSize: '0.75rem' }}>Last updated: May 2025</p>

      <div style={WARN}>
        <strong>RISK WARNING:</strong> Trading financial instruments including stocks, cryptocurrencies, and derivatives involves a high level of risk and may not be suitable for all investors. You may lose some or all of your invested capital. Past performance is not indicative of future results. SultraxAI does not provide investment advice. All trading decisions are made solely at your own risk.
      </div>

      <p style={S}>By accessing or using SultraxAI ("the Platform", "we", "us"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.</p>

      <h3 style={H}>1. Description of Service</h3>
      <p style={S}>SultraxAI is a market intelligence platform that provides real-time market data, volume anomaly signals, price alerts, and analytical tools. All content is provided for informational and educational purposes only. The Platform does not execute trades, manage funds, or hold any assets on your behalf.</p>

      <h3 style={H}>2. No Investment or Financial Advice</h3>
      <p style={S}>Nothing on SultraxAI — including signals, alerts, scores, analysis, community chat, or any other content — constitutes financial advice, investment advice, trading advice, or any other type of advice. We are not a licensed investment advisor, broker, or financial institution. You should consult a qualified financial advisor before making any investment decisions. Any reliance on information provided through the Platform is strictly at your own risk.</p>

      <h3 style={H}>3. Eligibility</h3>
      <p style={S}>You must be at least 18 years of age to use SultraxAI. By using the Platform, you represent and warrant that you are 18 or older and that your use of the Platform does not violate any applicable laws or regulations in your jurisdiction. Access may be restricted in certain countries due to local regulations. It is your responsibility to ensure compliance with local laws.</p>

      <h3 style={H}>4. Account Registration</h3>
      <p style={S}>You must provide accurate and complete information when creating an account. You are solely responsible for maintaining the confidentiality of your login credentials and for all activity that occurs under your account. You must notify us immediately of any unauthorized access or security breach. We reserve the right to suspend or terminate accounts that violate these Terms.</p>

      <h3 style={H}>5. Subscription and Fees</h3>
      <p style={S}>Certain features of SultraxAI require a paid subscription. Fees are charged in advance on a monthly or annual basis as selected during registration. Subscriptions automatically renew unless cancelled before the renewal date. All fees are non-refundable except where required by applicable law. We reserve the right to change pricing with 30 days notice.</p>

      <h3 style={H}>6. Prohibited Uses</h3>
      <p style={S}>You agree not to: (a) use the Platform for any unlawful purpose; (b) attempt to gain unauthorized access to any part of the Platform; (c) scrape, copy, or redistribute content without permission; (d) use the Platform to manipulate markets or engage in any form of market abuse; (e) share your account credentials with third parties; (f) reverse engineer or attempt to extract source code from the Platform.</p>

      <h3 style={H}>7. Data Accuracy and No Warranty</h3>
      <p style={S}>Market data is sourced from third-party providers and may be delayed, incomplete, or contain errors. SultraxAI makes no warranty, express or implied, regarding the accuracy, completeness, reliability, or timeliness of any data or content. THE PLATFORM IS PROVIDED "AS IS" WITHOUT WARRANTY OF ANY KIND. We do not guarantee that the service will be uninterrupted, error-free, or free of viruses.</p>

      <h3 style={H}>8. Limitation of Liability</h3>
      <p style={S}>To the maximum extent permitted by law, SultraxAI and its operators, employees, and affiliates shall not be liable for any direct, indirect, incidental, special, consequential, or punitive damages, including but not limited to trading losses, loss of profits, loss of data, or loss of goodwill, arising out of or in connection with your use of or inability to use the Platform, even if we have been advised of the possibility of such damages. Our total liability to you for any claim shall not exceed the amount you paid us in the 12 months preceding the claim.</p>

      <h3 style={H}>9. Indemnification</h3>
      <p style={S}>You agree to indemnify, defend, and hold harmless SultraxAI and its operators from any claims, liabilities, damages, losses, and expenses (including reasonable legal fees) arising out of your use of the Platform, your violation of these Terms, or your violation of any third-party rights.</p>

      <h3 style={H}>10. Intellectual Property</h3>
      <p style={S}>All content, features, and functionality of SultraxAI — including but not limited to software, algorithms, design, text, and graphics — are the exclusive property of SultraxAI and are protected by applicable intellectual property laws. You are granted a limited, non-exclusive, non-transferable license to access and use the Platform for personal, non-commercial purposes only.</p>

      <h3 style={H}>11. Termination</h3>
      <p style={S}>We reserve the right to suspend or terminate your access to the Platform at any time, with or without notice, for conduct that we believe violates these Terms or is harmful to other users, us, or third parties. Upon termination, your right to use the Platform ceases immediately.</p>

      <h3 style={H}>12. Governing Law and Jurisdiction</h3>
      <p style={S}>These Terms shall be governed by and construed in accordance with the laws of the State of Israel, without regard to conflict of law principles. Any disputes arising under these Terms shall be subject to the exclusive jurisdiction of the competent courts in Israel.</p>

      <h3 style={H}>13. Modifications to Terms</h3>
      <p style={S}>We reserve the right to modify these Terms at any time. Material changes will be communicated via email or a notice on the Platform. Continued use of the Platform after any changes constitutes acceptance of the revised Terms.</p>

      <h3 style={H}>14. Contact</h3>
      <p style={S}>For questions regarding these Terms, contact us at <span style={{ color: '#ff4444' }}>support@sultraxai.com</span></p>
    </PageShell>
  );
}

function PrivacyPage({ onBack }) {
  const S = { color: '#888', fontSize: '0.88rem', lineHeight: 1.8, margin: '0 0 1.5rem' };
  const H = { color: '#ccc', fontSize: '0.95rem', fontWeight: '700', margin: '2rem 0 0.5rem' };
  return (
    <PageShell title="Privacy Policy" onBack={onBack}>
      <p style={{ ...S, color: '#444', fontSize: '0.75rem' }}>Last updated: May 2025</p>
      <p style={S}>SultraxAI ("we", "us", "our") is committed to protecting your personal data. This Privacy Policy explains what information we collect, how we use it, and your rights regarding it. By using SultraxAI, you agree to the practices described in this policy.</p>

      <h3 style={H}>1. Data Controller</h3>
      <p style={S}>SultraxAI operates this platform. For privacy-related inquiries, contact us at <span style={{ color: '#ff4444' }}>support@sultraxai.com</span>.</p>

      <h3 style={H}>2. Data We Collect</h3>
      <p style={S}><strong style={{ color: '#aaa' }}>Account data:</strong> First name, last name, email address, username, and hashed password provided during registration.</p>
      <p style={S}><strong style={{ color: '#aaa' }}>Usage data:</strong> Watchlist preferences, alert settings, selected assets, trading profile (experience level, frequency), and subscription status.</p>
      <p style={S}><strong style={{ color: '#aaa' }}>Technical data:</strong> IP address, browser type, and device information collected automatically when you use the Platform.</p>
      <p style={S}><strong style={{ color: '#aaa' }}>Communications:</strong> Messages sent through our Contact form and community chat messages.</p>
      <p style={S}>We do not collect payment card details directly. Payments are processed by third-party payment providers.</p>

      <h3 style={H}>3. Legal Basis for Processing (GDPR)</h3>
      <p style={S}>We process your personal data on the following legal bases: (a) <strong style={{ color: '#aaa' }}>Contract</strong> — to provide the service you signed up for; (b) <strong style={{ color: '#aaa' }}>Legitimate interests</strong> — to improve the platform and ensure security; (c) <strong style={{ color: '#aaa' }}>Consent</strong> — for optional communications; (d) <strong style={{ color: '#aaa' }}>Legal obligation</strong> — where required by applicable law.</p>

      <h3 style={H}>4. How We Use Your Data</h3>
      <p style={S}>Your data is used to: provide and operate the Platform; send account verification and security emails; deliver price alerts and notifications you have set up; process subscription payments; respond to support requests; improve the Platform's features and performance; comply with legal obligations. We do not sell your personal data to third parties.</p>

      <h3 style={H}>5. Third-Party Services</h3>
      <p style={S}><strong style={{ color: '#aaa' }}>Finnhub.io</strong> — provides real-time market data. Your watchlist symbols may be transmitted to Finnhub's WebSocket service. See <span style={{ color: '#555' }}>finnhub.io/privacy</span>.</p>
      <p style={S}><strong style={{ color: '#aaa' }}>Brevo (Sendinblue)</strong> — handles transactional emails (verification, alerts). Your email address is shared with Brevo for this purpose. See <span style={{ color: '#555' }}>brevo.com/legal/privacypolicy</span>.</p>
      <p style={S}><strong style={{ color: '#aaa' }}>Groq</strong> — powers the AI support assistant. Messages sent to the support bot may be processed by Groq. See <span style={{ color: '#555' }}>groq.com/privacy</span>.</p>
      <p style={S}>All third-party providers are required to handle your data in accordance with applicable data protection laws.</p>

      <h3 style={H}>6. Data Retention</h3>
      <p style={S}>We retain your account data for as long as your account is active or as needed to provide the service. If you delete your account, all personal data associated with it is permanently deleted from our systems within 30 days. Chat messages may be retained in anonymized form for platform improvement purposes. You may request earlier deletion by contacting us.</p>

      <h3 style={H}>7. Data Security</h3>
      <p style={S}>We implement industry-standard security measures including password hashing (bcrypt), encrypted data transmission (HTTPS/WSS), and access controls. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.</p>

      <h3 style={H}>8. Cookies and Local Storage</h3>
      <p style={S}>SultraxAI uses browser local storage (not cookies) to save your session, preferences, and view state between visits. This data is stored only on your device and is never transmitted to third parties. We do not use third-party tracking or advertising cookies.</p>

      <h3 style={H}>9. Your Rights</h3>
      <p style={S}>Depending on your jurisdiction, you may have the following rights regarding your personal data:</p>
      <p style={S}><strong style={{ color: '#aaa' }}>Access</strong> — request a copy of the data we hold about you.<br /><strong style={{ color: '#aaa' }}>Rectification</strong> — request correction of inaccurate data via Account Settings.<br /><strong style={{ color: '#aaa' }}>Erasure</strong> — delete your account and all associated data via Account Settings → Danger Zone.<br /><strong style={{ color: '#aaa' }}>Portability</strong> — request your data in a machine-readable format.<br /><strong style={{ color: '#aaa' }}>Objection</strong> — object to processing based on legitimate interests.<br /><strong style={{ color: '#aaa' }}>Restriction</strong> — request that we limit processing of your data in certain circumstances.</p>
      <p style={S}>To exercise any of these rights, contact us at <span style={{ color: '#ff4444' }}>support@sultraxai.com</span>. We will respond within 30 days.</p>

      <h3 style={H}>10. International Data Transfers</h3>
      <p style={S}>Your data may be processed on servers located outside your country of residence. Where data is transferred outside the European Economic Area, we ensure appropriate safeguards are in place in accordance with applicable data protection laws.</p>

      <h3 style={H}>11. Children's Privacy</h3>
      <p style={S}>SultraxAI is not intended for individuals under the age of 18. We do not knowingly collect personal data from minors. If we become aware that a minor has provided us with personal data, we will delete it immediately.</p>

      <h3 style={H}>12. Changes to This Policy</h3>
      <p style={S}>We may update this Privacy Policy from time to time. Material changes will be communicated via email or a notice on the Platform. The date at the top of this page reflects the most recent revision. Continued use of the Platform after changes constitutes acceptance of the updated policy.</p>

      <h3 style={H}>13. Contact</h3>
      <p style={S}>For any privacy-related questions or to exercise your rights, contact us at <span style={{ color: '#ff4444' }}>support@sultraxai.com</span></p>
    </PageShell>
  );
}