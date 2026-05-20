import React, { useState, useMemo, useEffect  } from 'react';
import MainTerminal from './components/MainTerminal';
const API_BASE = 'http://38.180.137.122:8000';
const MOCK_STOCKS = ["BTC/USD", "ETH/USD", "AAPL", "TSLA", "NVDA", "AMZN", "GOOGL", "MSFT", "META", "NFLX", "SOL/USD", "XRP/USD", "AMD", "PLTR", "COIN"];

export default function App() {
  // טעינת מצב ראשוני מה-LocalStorage כדי למנוע ניתוק בריפרש
  const [currentView, setCurrentView] = useState(() => localStorage.getItem('currentView') || 'landing');
  const [userId, setUserId] = useState(() => localStorage.getItem('userId') || null);
  const [selectedAssets, setSelectedAssets] = useState(() => {
    const saved = localStorage.getItem('selectedAssets');
    return saved ? JSON.parse(saved) : [];
  });

  const [onboardingStep, setOnboardingStep] = useState(1);
  const [errorMessage, setErrorMessage] = useState('');
  const [assetSettings, setAssetSettings] = useState({}); 
  const [tradingProfile, setTradingProfile] = useState({ experience: 'Beginner (0-1 yrs)', frequency: 'Daily' });
  const [searchTerm, setSearchTerm] = useState('');
const filteredStocks = useMemo(() => {
    return MOCK_STOCKS.filter(stock => 
      stock.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [searchTerm]);
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

  const handleRegisterSuccess = (id) => {
    setUserId(id);
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
    setCurrentView('landing');
    localStorage.clear(); // מנקה את הכל ביציאה מסודרת
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

  // --- קומפוננטות שלבי Onboarding ---
  const OnboardingStep1 = () => (
    <div style={{ textAlign: 'left' }}>
      <h3 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Step 1: Select Assets</h3>
      <p style={{ color: '#888', marginBottom: '2rem' }}>Choose at least 3 assets to follow in your terminal.</p>
      <input 
        type="text" placeholder="Search Symbol (e.g. BTC, TSLA)..." 
        value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
        style={{ width: '100%', padding: '1rem', background: '#111', border: '1px solid #333', borderRadius: '12px', color: '#fff', marginBottom: '1rem', outline: 'none' }}
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '10px', maxHeight: '250px', overflowY: 'auto', padding: '10px' }}>
        {filteredStocks?.map(s => (
          <div key={s} onClick={() => toggleAsset(s)} style={{ 
            padding: '10px', borderRadius: '8px', cursor: 'pointer', textAlign: 'center', fontSize: '0.8rem', border: '1px solid',
            borderColor: selectedAssets.includes(s) ? '#ff3333' : '#333',
            background: selectedAssets.includes(s) ? 'rgba(255,51,51,0.1)' : 'transparent',
            transition: '0.2s'
          }}>{s}</div>
        ))}
      </div>
      <button disabled={selectedAssets.length < 3} onClick={() => setOnboardingStep(2)} 
        style={{ marginTop: '2rem', width: '100%', padding: '1rem', background: selectedAssets.length >= 3 ? '#ff3333' : '#222', border: 'none', borderRadius: '12px', color: '#fff', cursor: selectedAssets.length >= 3 ? 'pointer' : 'not-allowed', fontWeight: '600' }}>
        Continue ({selectedAssets.length}/3)
      </button>
    </div>
  );

  const OnboardingStep2 = () => (
    <div style={{ textAlign: 'left' }}>
      <h3 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Step 2: Volatility Thresholds</h3>
      <p style={{ color: '#888', marginBottom: '2rem' }}>Define SD (Standard Deviation) for alerts.</p>
      <div style={{ maxHeight: '300px', overflowY: 'auto', paddingRight: '5px' }}>
        {selectedAssets.map(s => (
          <div key={s} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#111', padding: '1rem', borderRadius: '12px', marginBottom: '10px', border: '1px solid #222' }}>
            <span>{s}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '0.8rem', color: '#666' }}>SD:</span>
              <input type="number" step="0.1" defaultValue="2.0" 
                onChange={e => setAssetSettings({...assetSettings, [s]: parseFloat(e.target.value)})}
                style={{ width: '60px', background: '#000', border: '1px solid #333', color: '#fff', padding: '5px', borderRadius: '5px', textAlign: 'center', outline: 'none' }} />
            </div>
          </div>
        ))}
      </div>
      <button onClick={() => setOnboardingStep(3)} style={{ marginTop: '2rem', width: '100%', padding: '1rem', background: '#ff3333', border: 'none', borderRadius: '12px', color: '#fff', cursor: 'pointer', fontWeight: '600' }}>Next</button>
    </div>
  );

  const OnboardingStep3 = () => (
    <div style={{ textAlign: 'left' }}>
      <h3 style={{ fontSize: '2rem', marginBottom: '1rem' }}>Step 3: Trading Profile</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        <label style={{ fontSize: '0.9rem', color: '#aaa' }}>Experience Level
          <select value={tradingProfile.experience} onChange={e => setTradingProfile({...tradingProfile, experience: e.target.value})} style={{ width: '100%', padding: '1rem', background: '#111', color: '#fff', borderRadius: '12px', marginTop: '5px', border: '1px solid #222', outline: 'none', cursor: 'pointer' }}>
            <option>Beginner (0-1 yrs)</option><option>Intermediate (1-3 yrs)</option><option>Professional (3+ yrs)</option>
          </select>
        </label>
        <label style={{ fontSize: '0.9rem', color: '#aaa' }}>How often do you check markets?
          <select value={tradingProfile.frequency} onChange={e => setTradingProfile({...tradingProfile, frequency: e.target.value})} style={{ width: '100%', padding: '1rem', background: '#111', color: '#fff', borderRadius: '12px', marginTop: '5px', border: '1px solid #222', outline: 'none', cursor: 'pointer' }}>
            <option>Every Hour</option><option>Daily</option><option>Weekly</option>
          </select>
        </label>
      </div>
      <button onClick={submitOnboarding} style={{ marginTop: '2rem', width: '100%', padding: '1rem', background: '#ff3333', border: 'none', borderRadius: '12px', color: '#fff', cursor: 'pointer', fontWeight: 'bold' }}>FINISH & ENTER TERMINAL</button>
    </div>
  );

  return (
    <div style={{ color: '#fff', minHeight: '100vh', background: '#020202', fontFamily: 'Inter, sans-serif', position: 'relative', overflowX: 'hidden' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', background: 'linear-gradient(-45deg, #020202, #0a0303, #140505, #020202)', backgroundSize: '400% 400%', zIndex: 0 }}></div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {['landing', 'signup', 'signin', 'main_app'].includes(currentView) && (
          <nav style={{ display: 'flex', justifyContent: 'space-between', padding: '2rem 5rem', alignItems: 'center' }}>
            <h1 onClick={() => { if (currentView !== 'main_app') setCurrentView('landing'); }} style={{ fontSize: '1.5rem', fontWeight: '800', cursor: currentView === 'main_app' ? 'default' : 'pointer' }}>SULTRAXAI</h1>
            <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.9rem', alignItems: 'center' }}>
              {currentView === 'main_app' ? (
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

        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '2rem' }}>
          
          {currentView === 'landing' && (
            <div style={{ textAlign: 'center', marginTop: '5rem' }}>
              <h2 style={{ fontSize: '5rem', fontWeight: '900', background: 'linear-gradient(to bottom, #fff, #444)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ALPHA FROM <br/> SOCIAL VOLATILITY.</h2>
              <button onClick={() => setCurrentView('signup')} style={{ background: '#ff3333', padding: '1rem 3rem', borderRadius: '50px', border: 'none', color: '#fff', marginTop: '2rem', cursor: 'pointer', fontWeight: '600' }}>REQUEST ACCESS</button>
            </div>
          )}

          {currentView === 'signup' && (
            <SignUpForm onRegisterSuccess={handleRegisterSuccess} setErrorMessage={setErrorMessage} errorMessage={errorMessage} />
          )}

          {currentView === 'signin' && (
            <div style={{ width: '400px', background: 'rgba(5, 5, 5, 0.7)', padding: '2.5rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
              <h3 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '1.5rem', textAlign: 'center' }}>Sign In</h3>
              {errorMessage && <div style={{ color: '#ff3333', backgroundColor: 'rgba(255,51,51,0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>{errorMessage}</div>}
              <form onSubmit={async (e) => {
                e.preventDefault(); setErrorMessage('');
                try {
                  const res = await fetch('/api/login', { 
                    method: 'POST', 
                    headers: { 'Content-Type': 'application/json' }, 
                    body: JSON.stringify({ email: e.target[0].value, password: e.target[1].value }) 
                  });
                  const data = await res.json();
                  if (res.ok) { 
                    setUserId(data.user_id); 
                    if (data.onboarding_completed) {
                      // משתמש ותיק - טוענים את המניות שלו ומעבירים ישר לאפליקציה
                      setSelectedAssets(data.assets);
                      setCurrentView('main_app'); 
                    } else {
                      // משתמש שנרשם אך לא סיים שלבים - מעבירים ל-Onboarding
                      setSelectedAssets([]);
                      setOnboardingStep(1);
                      setCurrentView('onboarding');
                    }
                  } else setErrorMessage(data.detail);
                } catch { setErrorMessage("Login failed."); }
              }} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <input type="email" placeholder="Email Address" required style={inputStyle} />
                <input type="password" placeholder="Password" required style={inputStyle} />
                <button type="submit" style={{ backgroundColor: '#ff3333', color: '#fff', padding: '1rem', border: 'none', borderRadius: '12px', fontWeight: '600', cursor: 'pointer' }}>Connect to Terminal</button>
              </form>
            </div>
          )}

          {currentView === 'onboarding' && (
            <div style={{ width: '450px', background: 'rgba(5, 5, 5, 0.7)', padding: '2.5rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)', marginTop: '2rem' }}>
              <div style={{ display: 'flex', gap: '5px', marginBottom: '2rem' }}>
                {[1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: '4px', background: onboardingStep >= i ? '#ff3333' : '#333', borderRadius: '2px' }} />)}
              </div>
              {onboardingStep === 1 && <OnboardingStep1 />}
              {onboardingStep === 2 && <OnboardingStep2 />}
              {onboardingStep === 3 && <OnboardingStep3 />}
            </div>
          )}

         {currentView === 'main_app' && (
            <MainTerminal selectedAssets={selectedAssets} onSignOut={handleSignOut} />
          
          )}

        </div>
      </div>
    </div>
  );
}

function SignUpForm({ onRegisterSuccess, setErrorMessage, errorMessage }) {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!isFormValid) return;
    setErrorMessage('');

    try {
      const res = await fetch('http://38.180.137.122:8000/api/register',{
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
      if (res.ok) onRegisterSuccess(data.user_id);
      else setErrorMessage(data.detail);
    } catch (err) { setErrorMessage("Registration connection error."); }
  };

  return (
    <div style={{ width: '450px', background: 'rgba(5, 5, 5, 0.7)', padding: '2.5rem', borderRadius: '24px', border: '1px solid rgba(255,255,255,0.05)', backdropFilter: 'blur(10px)' }}>
      <h3 style={{ fontSize: '1.8rem', fontWeight: '800', marginBottom: '1.5rem', textAlign: 'center' }}>Create Account</h3>
      {errorMessage && <div style={{ color: '#ff3333', backgroundColor: 'rgba(255,51,51,0.1)', padding: '0.75rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center', border: '1px solid rgba(255,51,51,0.2)' }}>{errorMessage}</div>}
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem', textAlign: 'left' }}>
        <input type="text" placeholder="First Name" value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} required />
        <input type="text" placeholder="Full Name" value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} required />
        <input type="email" placeholder="Email Address" value={email} onChange={e => setEmail(e.target.value)} style={inputStyle} required />
        {email && !isEmailValid(email) && <span style={{ color: '#ff3333', fontSize: '0.8rem', marginTop: '-0.5rem' }}>Please enter a valid email format</span>}

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <select value={countryCode} onChange={e => setCountryCode(e.target.value)} style={{ ...inputStyle, width: '38%', cursor: 'pointer' }}>
            <option value="+972">🇮🇱 +972</option>
            <option value="+1">🇺🇸 +1</option>
            <option value="+44">🇬🇧 +44</option>
          </select>
          <input type="tel" placeholder="Phone Number" value={phone} onChange={e => setPhone(e.target.value)} style={{ ...inputStyle, width: '62%' }} required />
        </div>
        
        <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} style={inputStyle} required />
        
        {password && (
          <div style={{ fontSize: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.2rem', paddingLeft: '0.25rem', color: '#aaa' }}>
            <span style={{ color: pwdCriteria.hasMinLength ? '#44ff44' : '#ff3333' }}>✓ Minimum 8 characters</span>
            <span style={{ color: pwdCriteria.hasUppercase ? '#44ff44' : '#ff3333' }}>✓ At least one uppercase letter (A-Z)</span>
            <span style={{ color: pwdCriteria.hasSpecialChar ? '#44ff44' : '#ff3333' }}>✓ At least one special character (!@#$)</span>
          </div>
        )}

        <input type="password" placeholder="Confirm Password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} style={inputStyle} required />
        {password && confirmPassword && password !== confirmPassword && (
          <span style={{ color: '#ff3333', fontSize: '0.8rem' }}>Passwords do not match</span>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem', color: '#aaa', cursor: 'pointer', marginTop: '0.5rem' }}>
          <input type="checkbox" checked={agreeTerms} onChange={e => setAgreeTerms(e.target.checked)} style={{ cursor: 'pointer', width: '16px', height: '16px', accentColor: '#ff3333' }} />
          I agree to the Terms of Service & Privacy Policy
        </label>
        
        <button type="submit" disabled={!isFormValid} style={{ backgroundColor: isFormValid ? '#ff3333' : '#331111', color: isFormValid ? '#fff' : '#666', padding: '1rem', border: 'none', borderRadius: '12px', fontWeight: '600', cursor: isFormValid ? 'pointer' : 'not-allowed', marginTop: '0.5rem', transition: '0.3s' }}>
          Register & Continue
        </button>
      </form>
    </div>
  );
}

const inputStyle = { padding: '1rem', background: '#111', border: '1px solid #222', borderRadius: '12px', color: '#fff', outline: 'none' };