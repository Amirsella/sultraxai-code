import React, { useState, useEffect } from 'react';

const API_BASE = 'http://38.180.137.122:8000';
const SYS_FONT = '-apple-system, BlinkMacSystemFont, system-ui, "Inter", sans-serif';
const inputStyle = { padding: '0.9rem 1rem', background: '#0d0d0d', border: '1px solid #1e1e1e', borderRadius: '12px', color: '#fff', outline: 'none', fontFamily: SYS_FONT, fontSize: '0.9rem', width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s' };

const Label = ({ children }) => (
  <span style={{ fontSize: '0.62rem', color: '#444', fontWeight: '700', letterSpacing: '0.09em', textTransform: 'uppercase', display: 'block', marginBottom: '8px' }}>{children}</span>
);

const Field = ({ label, children }) => (
  <div style={{ display: 'flex', flexDirection: 'column' }}>
    <Label>{label}</Label>
    {children}
  </div>
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
  const [original, setOriginal] = useState({});

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
        const snap = {
          firstName: data.first_name || '',
          fullName: data.full_name || '',
          phone: data.phone || '',
          experience: data.experience || 'Beginner (0-1 yrs)',
          frequency: data.frequency || 'Daily',
        };
        setUser(data);
        setFirstName(snap.firstName);
        setFullName(snap.fullName);
        setPhone(snap.phone);
        setExperience(snap.experience);
        setFrequency(snap.frequency);
        setOriginal(snap);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [userId]);

  const profileDirty = firstName !== original.firstName || fullName !== original.fullName || phone !== original.phone;
  const prefsDirty = experience !== original.experience || frequency !== original.frequency;

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
        setOriginal(prev => ({ ...prev, firstName, fullName, phone, experience, frequency }));
        setProfileSaved(true);
        onProfileUpdate && onProfileUpdate(firstName);
        setTimeout(() => setProfileSaved(false), 2000);
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
        setTimeout(() => setPwdSaved(false), 2000);
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

  const SaveBtn = ({ onClick, saving, saved, dirty, label = 'Save Changes', savedLabel = '✓ Saved', type = 'button' }) => (
    <button type={type} onClick={onClick} disabled={saving || !dirty}
      style={{ padding: '0.9rem', background: dirty ? '#ff3333' : '#111', border: `1px solid ${dirty ? '#ff333360' : '#1a1a1a'}`, borderRadius: '12px', color: dirty ? '#fff' : '#333', fontWeight: '700', cursor: dirty ? 'pointer' : 'default', fontSize: '0.88rem', marginTop: '4px', opacity: saving ? 0.7 : 1, width: '100%', transition: 'all 0.2s', letterSpacing: '0.03em' }}>
      {saved ? savedLabel : saving ? 'Saving…' : label}
    </button>
  );

  const containerStyle = isNative
    ? { position: 'fixed', inset: 0, background: '#020202', display: 'flex', flexDirection: 'column', overflow: 'hidden', color: '#fff' }
    : { width: '100%', minHeight: '100vh', background: '#020202', color: '#fff', display: 'flex', flexDirection: 'column', alignItems: 'center' };

  const innerWidth = isNative ? '100%' : '520px';

  return (
    <div style={containerStyle}>
      <style>{`
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1a1a1a;border-radius:2px}
        input:focus, select:focus { border-color: #333 !important; }
      `}</style>

      <div style={{ width: innerWidth, display: 'flex', flexDirection: 'column', flex: isNative ? 1 : undefined, overflow: isNative ? 'hidden' : undefined, padding: isNative ? '0' : '0' }}>

        {/* Header */}
        <div style={{ paddingTop: isNative ? '56px' : '2.5rem', paddingBottom: '18px', paddingLeft: isNative ? '20px' : 0, paddingRight: isNative ? '20px' : 0, borderBottom: '1px solid #0f0f0f', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: '900', letterSpacing: '0.07em', background: 'linear-gradient(to right,#fff 40%,#555)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ACCOUNT</h2>
              {user && <p style={{ margin: '3px 0 0', fontSize: '0.62rem', color: '#333' }}>{user.email}</p>}
            </div>
            <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e1e1e', color: '#555', padding: '7px 16px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600', letterSpacing: '0.04em' }}>← BACK</button>
          </div>

          <div style={{ display: 'flex', gap: '4px', marginTop: '18px' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ padding: '6px 16px', borderRadius: '8px', border: `1px solid ${tab === t.id ? (t.red ? '#ff3333' : '#ff333540') : '#1a1a1a'}`, background: tab === t.id ? (t.red ? 'rgba(255,51,51,0.1)' : 'rgba(255,51,51,0.05)') : 'transparent', color: tab === t.id ? (t.red ? '#ff4444' : '#cc6666') : '#3a3a3a', cursor: 'pointer', fontSize: '0.62rem', fontWeight: '700', whiteSpace: 'nowrap', flexShrink: 0, letterSpacing: '0.07em', transition: 'all 0.15s' }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div style={{ padding: '4rem', textAlign: 'center', color: '#2a2a2a', fontSize: '0.8rem' }}>Loading…</div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: isNative ? '24px 20px 60px' : '28px 0 60px' }}>

            {/* PROFILE */}
            {tab === 'profile' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
                  <Field label="First Name">
                    <input value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} autoCorrect="off" spellCheck={false} />
                  </Field>
                  <Field label="Full Name">
                    <input value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} autoCorrect="off" spellCheck={false} />
                  </Field>
                </div>
                <Field label="Email Address">
                  <input value={user?.email || ''} disabled style={{ ...inputStyle, color: '#2a2a2a', cursor: 'not-allowed', border: '1px solid #141414' }} />
                  <span style={{ fontSize: '0.6rem', color: '#252525', marginTop: '5px' }}>Email address cannot be changed</span>
                </Field>
                <Field label="Phone Number">
                  <input value={phone} onChange={e => setPhone(e.target.value)} style={inputStyle} />
                </Field>
                <SaveBtn onClick={saveProfile} saving={profileSaving} saved={profileSaved} dirty={profileDirty} />
              </div>
            )}

            {/* SECURITY */}
            {tab === 'security' && (
              <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {pwdError && (
                  <div style={{ color: '#fff', background: '#9a0000', padding: '0.85rem 1rem', borderRadius: '10px', fontSize: '0.85rem', fontWeight: '600', border: '1px solid #cc000060' }}>{pwdError}</div>
                )}
                <Field label="Current Password">
                  <input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} required style={inputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                </Field>
                <Field label="New Password">
                  <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required style={inputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                  {newPwd && (
                    <div style={{ fontSize: '0.74rem', display: 'flex', flexDirection: 'column', gap: '4px', paddingLeft: '2px', marginTop: '9px' }}>
                      <span style={{ color: pwdCriteria.hasMinLength ? '#44cc44' : '#555' }}>✓ Minimum 8 characters</span>
                      <span style={{ color: pwdCriteria.hasUppercase ? '#44cc44' : '#555' }}>✓ At least one uppercase letter</span>
                      <span style={{ color: pwdCriteria.hasSpecialChar ? '#44cc44' : '#555' }}>✓ At least one special character</span>
                    </div>
                  )}
                </Field>
                <Field label="Confirm New Password">
                  <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required style={inputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                  {newPwd && confirmPwd && newPwd !== confirmPwd && (
                    <span style={{ fontSize: '0.74rem', color: '#ff4444', marginTop: '5px' }}>Passwords do not match</span>
                  )}
                </Field>
                <SaveBtn type="submit" saving={pwdSaving} saved={pwdSaved} dirty={isPwdStrong && !!currentPwd} label="Update Password" savedLabel="✓ Password Updated" />
              </form>
            )}

            {/* PREFERENCES */}
            {tab === 'preferences' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                <Field label="Experience Level">
                  <select value={experience} onChange={e => setExperience(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option>Beginner (0-1 yrs)</option>
                    <option>Intermediate (1-3 yrs)</option>
                    <option>Professional (3+ yrs)</option>
                  </select>
                </Field>
                <Field label="Market Check Frequency">
                  <select value={frequency} onChange={e => setFrequency(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option>Every Hour</option>
                    <option>Daily</option>
                    <option>Weekly</option>
                  </select>
                </Field>
                <SaveBtn onClick={saveProfile} saving={profileSaving} saved={profileSaved} dirty={prefsDirty} label="Save Preferences" />
              </div>
            )}

            {/* DANGER ZONE */}
            {tab === 'danger' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div style={{ padding: '22px', borderRadius: '16px', background: 'rgba(255,30,30,0.03)', border: '1px solid rgba(255,51,51,0.1)' }}>
                  <h3 style={{ margin: '0 0 10px', fontSize: '0.95rem', fontWeight: '700', color: '#cc3333' }}>Delete Account</h3>
                  <p style={{ margin: '0 0 22px', fontSize: '0.8rem', color: '#444', lineHeight: 1.75 }}>
                    This will permanently delete your account, watchlist, and all associated data. This action cannot be undone.
                  </p>
                  <Label>Type <span style={{ color: '#ff4444' }}>DELETE</span> to confirm</Label>
                  <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                    placeholder="DELETE" style={{ ...inputStyle, border: '1px solid rgba(255,51,51,0.15)', marginBottom: '14px' }}
                    autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                  <button onClick={deleteAccount} disabled={deleteConfirm !== 'DELETE' || deleting}
                    style={{ width: '100%', padding: '0.9rem', background: deleteConfirm === 'DELETE' ? '#9a0000' : '#111', border: `1px solid ${deleteConfirm === 'DELETE' ? '#cc000060' : '#1a1a1a'}`, borderRadius: '12px', color: deleteConfirm === 'DELETE' ? '#fff' : '#333', fontWeight: '700', cursor: deleteConfirm === 'DELETE' ? 'pointer' : 'default', fontSize: '0.88rem', opacity: deleting ? 0.7 : 1, transition: 'all 0.2s' }}>
                    {deleting ? 'Deleting…' : 'Delete Account Forever'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
