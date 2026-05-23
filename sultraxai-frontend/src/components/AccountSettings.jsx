import React, { useState, useEffect } from 'react';

const API_BASE = 'http://38.180.137.122:8000';
const SYS_FONT = '-apple-system, BlinkMacSystemFont, system-ui, "Inter", sans-serif';
const inputStyle = { padding: '0.9rem 1rem', background: '#111', border: '1px solid #222', borderRadius: '12px', color: '#fff', outline: 'none', fontFamily: SYS_FONT, fontSize: '0.9rem', width: '100%', boxSizing: 'border-box' };

const Label = ({ children }) => (
  <span style={{ fontSize: '0.62rem', color: '#555', fontWeight: '700', letterSpacing: '0.09em', textTransform: 'uppercase', display: 'block', marginBottom: '7px' }}>{children}</span>
);

const SaveBtn = ({ onClick, saving, saved, disabled, label = 'Save Changes', savedLabel = '✓ Saved' }) => (
  <button onClick={onClick} disabled={saving || disabled}
    style={{ padding: '0.9rem', background: disabled ? '#1a1a1a' : '#ff3333', border: 'none', borderRadius: '12px', color: disabled ? '#444' : '#fff', fontWeight: '700', cursor: disabled ? 'not-allowed' : 'pointer', fontSize: '0.88rem', marginTop: '8px', opacity: saving ? 0.7 : 1, width: '100%', transition: 'background 0.2s' }}>
    {saved ? savedLabel : saving ? 'Saving…' : label}
  </button>
);

export default function AccountSettings({ userId, onBack, onSignOut, isNative, onProfileUpdate }) {
  const [tab, setTab] = useState('profile');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const [firstName, setFirstName] = useState('');
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [experience, setExperience] = useState('Beginner (0-1 yrs)');
  const [frequency, setFrequency] = useState('Daily');
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);

  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdSaving, setPwdSaving] = useState(false);
  const [pwdSaved, setPwdSaved] = useState(false);
  const [pwdError, setPwdError] = useState('');

  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetch(`${API_BASE}/api/user/${userId}`)
      .then(r => r.json())
      .then(data => {
        setUser(data);
        setFirstName(data.first_name || '');
        setFullName(data.full_name || '');
        setPhone(data.phone || '');
        setExperience(data.experience || 'Beginner (0-1 yrs)');
        setFrequency(data.frequency || 'Daily');
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  const pwdCriteria = {
    hasMinLength: newPwd.length >= 8,
    hasUppercase: /[A-Z]/.test(newPwd),
    hasSpecialChar: /[!@#$%^&*(),.?":{}|<>_+\-[\]/\\]/.test(newPwd),
  };
  const isPwdStrong = pwdCriteria.hasMinLength && pwdCriteria.hasUppercase && pwdCriteria.hasSpecialChar;

  const saveProfile = async () => {
    setProfileSaving(true); setProfileSaved(false);
    try {
      const res = await fetch(`${API_BASE}/api/update-profile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: parseInt(userId), first_name: firstName, full_name: fullName, phone, experience, frequency })
      });
      if (res.ok) {
        setProfileSaved(true);
        onProfileUpdate && onProfileUpdate(firstName);
        setTimeout(() => setProfileSaved(false), 2500);
      }
    } catch {}
    setProfileSaving(false);
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (newPwd !== confirmPwd) { setPwdError('Passwords do not match'); return; }
    if (!isPwdStrong) { setPwdError('Password does not meet requirements'); return; }
    setPwdSaving(true); setPwdError(''); setPwdSaved(false);
    try {
      const res = await fetch(`${API_BASE}/api/change-password`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: parseInt(userId), current_password: currentPwd, new_password: newPwd })
      });
      const data = await res.json();
      if (res.ok) {
        setPwdSaved(true);
        setCurrentPwd(''); setNewPwd(''); setConfirmPwd('');
        setTimeout(() => setPwdSaved(false), 2500);
      } else {
        setPwdError(data.detail || 'Failed to update password');
      }
    } catch { setPwdError('Connection error. Please try again.'); }
    setPwdSaving(false);
  };

  const deleteAccount = async () => {
    if (deleteConfirm !== 'DELETE') return;
    setDeleting(true);
    try {
      await fetch(`${API_BASE}/api/delete-account/${userId}`, { method: 'DELETE' });
      onSignOut();
    } catch { setDeleting(false); }
  };

  const TABS = [
    { id: 'profile', label: 'PROFILE' },
    { id: 'security', label: 'SECURITY' },
    { id: 'preferences', label: 'PREFERENCES' },
    { id: 'danger', label: 'DANGER ZONE', red: true },
  ];

  const containerStyle = isNative
    ? { position: 'fixed', inset: 0, background: '#020202', display: 'flex', flexDirection: 'column', overflow: 'hidden' }
    : { width: '100%', minHeight: '100vh', background: '#020202', padding: '0 2rem 4rem', color: '#fff' };

  return (
    <div style={containerStyle}>
      <style>{`
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1a1a1a;border-radius:2px}
      `}</style>

      {/* Header */}
      <div style={{ paddingTop: isNative ? '56px' : '1.5rem', paddingBottom: '16px', paddingLeft: isNative ? '20px' : 0, paddingRight: isNative ? '20px' : 0, borderBottom: '1px solid #0f0f0f', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: '900', letterSpacing: '0.07em', background: 'linear-gradient(to right,#fff 40%,#555)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ACCOUNT</h2>
            {user && <p style={{ margin: '2px 0 0', fontSize: '0.6rem', color: '#2a2a2a' }}>{user.email}</p>}
          </div>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #1e1e1e', color: '#666', padding: '7px 14px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600' }}>← BACK</button>
        </div>

        <div style={{ display: 'flex', gap: '4px', marginTop: '16px', overflowX: 'auto', paddingBottom: '2px' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '5px 14px', borderRadius: '8px', border: `1px solid ${tab === t.id ? (t.red ? '#ff3333' : '#ff333355') : '#1a1a1a'}`, background: tab === t.id ? (t.red ? 'rgba(255,51,51,0.12)' : 'rgba(255,51,51,0.06)') : 'transparent', color: tab === t.id ? (t.red ? '#ff4444' : '#ff7777') : '#444', cursor: 'pointer', fontSize: '0.62rem', fontWeight: '700', whiteSpace: 'nowrap', flexShrink: 0, letterSpacing: '0.06em' }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '3rem', textAlign: 'center', color: '#2a2a2a', fontSize: '0.8rem' }}>Loading…</div>
      ) : (
        <div style={{ flex: 1, overflowY: 'auto', padding: isNative ? '20px 20px 60px' : '24px 0 60px', maxWidth: isNative ? undefined : '480px' }}>

          {/* PROFILE */}
          {tab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div>
                <Label>First Name</Label>
                <input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <Label>Full Name</Label>
                <input value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <Label>Email</Label>
                <input value={user?.email || ''} disabled style={{ ...inputStyle, color: '#3a3a3a', cursor: 'not-allowed', border: '1px solid #1a1a1a' }} />
                <p style={{ fontSize: '0.62rem', color: '#2a2a2a', margin: '5px 0 0' }}>Email address cannot be changed</p>
              </div>
              <div>
                <Label>Phone</Label>
                <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
              </div>
              <SaveBtn onClick={saveProfile} saving={profileSaving} saved={profileSaved} />
            </div>
          )}

          {/* SECURITY */}
          {tab === 'security' && (
            <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {pwdError && (
                <div style={{ color: '#fff', background: '#cc0000', padding: '0.85rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '600' }}>{pwdError}</div>
              )}
              <div>
                <Label>Current Password</Label>
                <input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} required style={inputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
              </div>
              <div>
                <Label>New Password</Label>
                <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required style={inputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                {newPwd && (
                  <div style={{ fontSize: '0.75rem', display: 'flex', flexDirection: 'column', gap: '3px', paddingLeft: '2px', marginTop: '8px' }}>
                    <span style={{ color: pwdCriteria.hasMinLength ? '#44ff44' : '#ff4444' }}>✓ Minimum 8 characters</span>
                    <span style={{ color: pwdCriteria.hasUppercase ? '#44ff44' : '#ff4444' }}>✓ At least one uppercase letter</span>
                    <span style={{ color: pwdCriteria.hasSpecialChar ? '#44ff44' : '#ff4444' }}>✓ At least one special character</span>
                  </div>
                )}
              </div>
              <div>
                <Label>Confirm New Password</Label>
                <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required style={inputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                {newPwd && confirmPwd && newPwd !== confirmPwd && (
                  <span style={{ fontSize: '0.75rem', color: '#ff4444', marginTop: '5px', display: 'block' }}>Passwords do not match</span>
                )}
              </div>
              <SaveBtn onClick={null} saving={pwdSaving} saved={pwdSaved} disabled={!isPwdStrong || !currentPwd} label="Update Password" savedLabel="✓ Password Updated" />
            </form>
          )}

          {/* PREFERENCES */}
          {tab === 'preferences' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div>
                <Label>Experience Level</Label>
                <select value={experience} onChange={e => setExperience(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option>Beginner (0-1 yrs)</option>
                  <option>Intermediate (1-3 yrs)</option>
                  <option>Professional (3+ yrs)</option>
                </select>
              </div>
              <div>
                <Label>Market Check Frequency</Label>
                <select value={frequency} onChange={e => setFrequency(e.target.value)}
                  style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option>Every Hour</option>
                  <option>Daily</option>
                  <option>Weekly</option>
                </select>
              </div>
              <SaveBtn onClick={saveProfile} saving={profileSaving} saved={profileSaved} label="Save Preferences" />
            </div>
          )}

          {/* DANGER ZONE */}
          {tab === 'danger' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ padding: '20px', borderRadius: '14px', background: 'rgba(255,51,51,0.04)', border: '1px solid rgba(255,51,51,0.12)' }}>
                <h3 style={{ margin: '0 0 8px', fontSize: '0.92rem', fontWeight: '700', color: '#ff4444' }}>Delete Account</h3>
                <p style={{ margin: '0 0 20px', fontSize: '0.78rem', color: '#555', lineHeight: 1.7 }}>
                  This will permanently delete your account, watchlist, and all associated data. This action cannot be undone.
                </p>
                <Label>Type <span style={{ color: '#ff4444', fontStyle: 'normal' }}>DELETE</span> to confirm</Label>
                <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                  placeholder="DELETE" style={{ ...inputStyle, border: '1px solid rgba(255,51,51,0.18)', marginBottom: '14px' }}
                  autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                <button onClick={deleteAccount} disabled={deleteConfirm !== 'DELETE' || deleting}
                  style={{ width: '100%', padding: '0.9rem', background: deleteConfirm === 'DELETE' ? '#cc0000' : '#1a1a1a', border: `1px solid ${deleteConfirm === 'DELETE' ? '#ff3333' : '#2a2a2a'}`, borderRadius: '12px', color: deleteConfirm === 'DELETE' ? '#fff' : '#444', fontWeight: '700', cursor: deleteConfirm === 'DELETE' ? 'pointer' : 'not-allowed', fontSize: '0.88rem', opacity: deleting ? 0.7 : 1, transition: 'background 0.2s' }}>
                  {deleting ? 'Deleting…' : 'Delete Account Forever'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
