import React, { useState, useMemo, useEffect, useRef } from 'react';
import MainTerminal from './components/MainTerminal';
import TheZone from './components/TheZone';
const API_BASE = 'http://38.180.137.122:8000';
const MOCK_STOCKS = ["BTC/USD", "ETH/USD", "AAPL", "TSLA", "NVDA", "AMZN", "GOOGL", "MSFT", "META", "NFLX", "SOL/USD", "XRP/USD", "AMD", "PLTR", "COIN"];

const isNative = typeof window !== 'undefined' &&
  (window.location.protocol === 'capacitor:' || !!window.Capacitor?.isNativePlatform?.());

export default function App() {
  // טעינת מצב ראשוני מה-LocalStorage כדי למנוע ניתוק בריפרש
  const [currentView, setCurrentView] = useState(() => {
    const saved = localStorage.getItem('currentView');
    const userId = localStorage.getItem('userId');
    if ((saved === 'main_app' || saved === 'onboarding') && userId) return saved;
    return 'landing';
  });
  const [userId, setUserId] = useState(() => localStorage.getItem('userId') || null);
  const [selectedAssets, setSelectedAssets] = useState(() => {
    const saved = localStorage.getItem('selectedAssets');
    return saved ? JSON.parse(saved) : [];
  });

  const [onboardingStep, setOnboardingStep] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingEmail, setPendingEmail] = useState(() => localStorage.getItem('pendingEmail') || '');
  const [assetSettings, setAssetSettings] = useState({}); 
  const [tradingProfile, setTradingProfile] = useState({ experience: 'Beginner (0-1 yrs)', frequency: 'Daily' });
  // עדכון ה-LocalStorage בכל פעם שהערכים משתנים
  useEffect(() => {
    localStorage.setItem('currentView', currentView);
  }, [currentView]);

  useEffect(() => {
    if (userId) localStorage.setItem('userId', userId);
    else localStorage.removeItem('userId');
  }, [userId]);

  useEffect(() => {
    localStorage.setItem('selectedAssets', JSON.stringify(selectedAssets));
  }, [selectedAssets]);

  useEffect(() => {
    if (pendingEmail) localStorage.setItem('pendingEmail', pendingEmail);
    else localStorage.removeItem('pendingEmail');
  }, [pendingEmail]);

 const handleRegisterSuccess = (id, email) => {
    setUserId(id);
    setPendingEmail(email); // שומר את המייל
    setSelectedAssets([]);
    setOnboardingStep(1);
    setCurrentView('verify');
  };

  const handleSignOut = () => {
    setUserId(null);
    setSelectedAssets([]);
    setAssetSettings({});
    setOnboardingStep(1);
    setErrorMessage('');
    setPendingEmail('');
    setCurrentView('landing');
    localStorage.clear();
  };

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
      if (res.ok) setCurrentView('main_app');
    } catch (e) { setErrorMessage("Failed to save data."); }
  };


  return (
    <div style={{ color: '#fff', minHeight: '100vh', background: '#020202', fontFamily: '-apple-system, BlinkMacSystemFont, system-ui, "Inter", sans-serif', position: 'relative', overflowX: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(-45deg, #020202, #0a0303, #140505, #020202)', backgroundSize: '400% 400%', zIndex: 0 }}></div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {['landing', 'signup', 'signin', 'main_app', 'zone'].includes(currentView) && !isNative && (
          <nav style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', padding: '1.5rem 5rem', alignItems: 'center' }}>
            <h1 onClick={() => { if (currentView !== 'main_app' && currentView !== 'zone') setCurrentView('landing'); }} style={{ fontSize: '1.5rem', fontWeight: '800', margin: 0, cursor: (currentView === 'main_app' || currentView === 'zone') ? 'default' : 'pointer' }}>SULTRAXAI</h1>
            {(currentView === 'main_app' || currentView === 'zone') ? (
              <button onClick={() => setCurrentView(currentView === 'zone' ? 'main_app' : 'zone')}
                style={{ border: `1px solid ${currentView === 'zone' ? '#4488ff' : 'rgba(68,136,255,0.35)'}`, color: '#4488ff', background: currentView === 'zone' ? 'rgba(68,136,255,0.12)' : 'rgba(68,136,255,0.05)', padding: '0.5rem 1.8rem', borderRadius: '50px', cursor: 'pointer', fontWeight: '700', fontSize: '0.82rem', letterSpacing: '0.06em' }}>
                THE ZONE
              </button>
            ) : <div />}
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', alignItems: 'center', justifyContent: 'flex-end' }}>
              {(currentView === 'main_app' || currentView === 'zone') ? (
                <button onClick={handleSignOut} style={{ border: '1px solid #ff3333', color: '#ff3333', padding: '0.5rem 1.5rem', borderRadius: '50px', background: 'transparent', cursor: 'pointer', fontWeight: '600' }}>
                  SIGN OUT
                </button>
              ) : (
                <>
                  <span style={{ color: '#888', cursor: 'pointer' }} onClick={() => setCurrentView('landing')}>TECHNOLOGY</span>
                  <button onClick={() => setCurrentView('signin')} style={{ background: 'none', border: 'none', color: '#888', cursor: 'pointer' }}>SIGN IN</button>
                  <button onClick={() => setCurrentView('signup')} style={{ border: '1px solid #ff3333', color: '#ff3333', padding: '0.5rem 1.5rem', borderRadius: '50px', background: 'none', cursor: 'pointer', fontWeight: '600' }}>SIGN UP</button>
                </>
              )}
            </div>
          </nav>
        )}

        {currentView === 'zone' && (
          <TheZone selectedAssets={selectedAssets} onBack={() => setCurrentView('main_app')} isNative={isNative} />
        )}

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>

          {currentView === 'landing' && (
            isNative ? (
              <div style={{ position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between', background: '#020202', overflow: 'hidden' }}>

                {/* Top: logo + name */}
                <div style={{ paddingTop: '80px', textAlign: 'center', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <img src="./sword-logo.png" alt="SultraxAI" style={{ width: '180px', height: '180px', objectFit: 'contain', marginBottom: '8px' }} />
                  <h1 style={{ fontSize: '2.4rem', fontWeight: '900', letterSpacing: '0.06em', margin: 0, color: '#fff' }}>SULTRAXAI</h1>
                  <p style={{ color: '#444', fontSize: '0.82rem', margin: '8px 0 0', letterSpacing: '0.06em' }}>Real-time market intelligence</p>
                </div>

                {/* Bottom: buttons */}
                <div style={{ width: '100%', padding: '0 28px 56px', display: 'flex', flexDirection: 'column', gap: '12px', position: 'relative', zIndex: 1 }}>
                  <button onClick={() => setCurrentView('signin')}
                    style={{ width: '100%', padding: '1rem', borderRadius: '14px', background: '#ff3333', border: 'none', color: '#fff', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', letterSpacing: '0.05em', boxShadow: '0 4px 24px rgba(255,51,51,0.35)' }}>
                    LOG IN
                  </button>
                  <button onClick={() => setCurrentView('signup')}
                    style={{ width: '100%', padding: '1rem', borderRadius: '14px', background: 'rgba(255,255,255,0.04)', border: '1px solid #2a2a2a', color: '#888', fontSize: '1rem', fontWeight: '600', cursor: 'pointer', letterSpacing: '0.05em' }}>
                    CREATE ACCOUNT
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', marginTop: '5rem' }}>
                <h2 style={{ fontSize: '5rem', fontWeight: '900', background: 'linear-gradient(to bottom, #fff, #444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ALPHA FROM <br/> SOCIAL VOLATILITY.</h2>
                <button onClick={() => setCurrentView('signup')} style={{ background: '#ff3333', padding: '1rem 3rem', borderRadius: '50px', border: 'none', color: '#fff', marginTop: '2rem', cursor: 'pointer', fontWeight: '600' }}>REQUEST ACCESS</button>
              </div>
            )
          )}

          {currentView === 'signup' && (
            <SignUpForm isNative={isNative} onBack={() => setCurrentView('landing')} onRegisterSuccess={handleRegisterSuccess} setErrorMessage={setErrorMessage} errorMessage={errorMessage} />
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
                  {errorMessage && <div style={{ color: '#ff3333', backgroundColor: 'rgba(255,51,51,0.1)', padding: '0.75rem', borderRadius: '10px', marginBottom: '1rem', fontSize: '0.88rem', textAlign: 'center' }}>{errorMessage}</div>}
                  <form onSubmit={async (e) => {
                    e.preventDefault(); setErrorMessage('');
                    try {
                      const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e.target[0].value, password: e.target[1].value }) });
                      const data = await res.json();
                      if (res.ok) { setUserId(data.user_id); if (data.onboarding_completed) { setSelectedAssets(data.assets); setCurrentView('main_app'); } else { setSelectedAssets([]); setOnboardingStep(1); setCurrentView('onboarding'); } } else setErrorMessage(data.detail);
                    } catch { setErrorMessage("Login failed."); }
                  }} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                    <input type="text" inputMode="email" placeholder="Email" required style={mobileInputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                    <input type="password" placeholder="Password" required style={mobileInputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                    <button type="submit" style={{ marginTop: '8px', width: '100%', padding: '1rem', borderRadius: '14px', background: '#ff3333', border: 'none', color: '#fff', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', letterSpacing: '0.04em', boxShadow: '0 4px 24px rgba(255,51,51,0.3)' }}>
                      Connect to Terminal
                    </button>
                  </form>
                  <button onClick={() => setCurrentView('signup')} style={{ marginTop: '28px', background: 'none', border: 'none', color: '#444', cursor: 'pointer', fontSize: '0.85rem', textAlign: 'center', width: '100%' }}>
                    Don't have an account? <span style={{ color: '#777' }}>Create one</span>
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ width: '400px', background: 'rgba(5, 5, 5, 0.7)', padding: '2.5rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
                <h3 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '1.5rem', textAlign: 'center' }}>Sign In</h3>
                {errorMessage && <div style={{ color: '#ff3333', backgroundColor: 'rgba(255,51,51,0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>{errorMessage}</div>}
                <form onSubmit={async (e) => {
                  e.preventDefault(); setErrorMessage('');
                  try {
                    const res = await fetch('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: e.target[0].value, password: e.target[1].value }) });
                    const data = await res.json();
                    if (res.ok) { setUserId(data.user_id); if (data.onboarding_completed) { setSelectedAssets(data.assets); setCurrentView('main_app'); } else { setSelectedAssets([]); setOnboardingStep(1); setCurrentView('onboarding'); } } else setErrorMessage(data.detail);
                  } catch { setErrorMessage("Login failed."); }
                }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                  <input type="text" inputMode="email" placeholder="Email Address" required style={inputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                  <input type="password" placeholder="Password" required style={inputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                  <button type="submit" style={{ backgroundColor: '#ff3333', color: '#fff', padding: '1rem', border: 'none', borderRadius: '12px', fontWeight: '600', cursor: 'pointer' }}>Connect to Terminal</button>
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
            <MainTerminal userId={userId} selectedAssets={selectedAssets} onSignOut={handleSignOut} onAssetsUpdate={setSelectedAssets} isNative={isNative} onNavigateToZone={() => setCurrentView('zone')} />
          )}

        </div>
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
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+972');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [agreeTerms, setAgreeTerms] = useState(false);

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
      const res = await fetch('http://38.180.137.122:8000/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          first_name: firstName,
          full_name: fullName,
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

const SYS_FONT = '-apple-system, BlinkMacSystemFont, system-ui, sans-serif';
const inputStyle = { padding: '1rem', background: '#111', border: '1px solid #222', borderRadius: '12px', color: '#fff', outline: 'none', fontFamily: SYS_FONT };
const mobileInputStyle = { padding: '1rem 1.25rem', background: '#111', border: '1px solid #1e1e1e', borderRadius: '14px', color: '#fff', outline: 'none', fontSize: '1rem', boxSizing: 'border-box', width: '100%', fontFamily: SYS_FONT };