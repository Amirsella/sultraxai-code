import React, { useState, useEffect } from 'react';

const API_BASE = 'http://38.180.137.122:8000';
const SYS_FONT = '-apple-system, BlinkMacSystemFont, system-ui, "Inter", sans-serif';

const inputStyle = {
  padding: '0.75rem 1rem', background: '#0a0a0a', border: '1px solid #1e1e1e',
  borderRadius: '10px', color: '#e8e8e8', outline: 'none', fontFamily: SYS_FONT,
  fontSize: '0.88rem', width: '100%', boxSizing: 'border-box', transition: 'border-color 0.15s',
};

const isValidPhone = (p) => {
  const digits = p.replace(/[\s\-()+ ]/g, '');
  return /^[0-9]{7,15}$/.test(digits);
};

const Label = ({ children }) => (
  <div style={{ fontSize: '0.62rem', color: '#444', fontWeight: '700', letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '7px' }}>{children}</div>
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
  const [profileError, setProfileError] = useState('');

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
        setFirstName(snap.firstName); setFullName(snap.fullName);
        setPhone(snap.phone); setExperience(snap.experience); setFrequency(snap.frequency);
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
    setProfileError('');
    if (phone && !isValidPhone(phone)) {
      setProfileError('Please enter a valid phone number');
      return;
    }
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
      } else { setPwdError(data.detail || 'Failed to update password'); }
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
    { id: 'profile', label: 'Profile', icon: '👤' },
    { id: 'security', label: 'Security', icon: '🔒' },
    { id: 'preferences', label: 'Preferences', icon: '⚙️' },
    { id: 'danger', label: 'Danger Zone', icon: '⚠️', red: true },
  ];

  const initials = ((firstName || user?.email || 'U').charAt(0)).toUpperCase();

  if (isNative) {
    return <MobileSettings {...{ tab, setTab, TABS, user, loading, initials, firstName, setFirstName, fullName, setFullName, phone, setPhone, profileDirty, prefsDirty, profileSaving, profileSaved, profileError, saveProfile, experience, setExperience, frequency, setFrequency, currentPwd, setCurrentPwd, newPwd, setNewPwd, confirmPwd, setConfirmPwd, pwdCriteria, isPwdStrong, pwdSaving, pwdSaved, pwdError, changePassword, deleteConfirm, setDeleteConfirm, deleting, deleteAccount, onBack }} />;
  }

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: '#020202', color: '#fff', display: 'flex', justifyContent: 'center', paddingBottom: '4rem' }}>
      <style>{`
        ::-webkit-scrollbar{width:4px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1e1e1e;border-radius:2px}
        .acc-input:focus{border-color:#333!important}
        .acc-tab:hover{background:rgba(255,255,255,0.03)!important}
      `}</style>

      <div style={{ width: '100%', maxWidth: '900px', padding: '0 2rem' }}>

        {/* Page header */}
        <div style={{ paddingTop: '2.5rem', paddingBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #0f0f0f' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: '900', letterSpacing: '0.06em', background: 'linear-gradient(to right,#fff 50%,#555)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>ACCOUNT SETTINGS</h2>
            <p style={{ margin: '4px 0 0', fontSize: '0.65rem', color: '#333', letterSpacing: '0.04em' }}>Manage your profile, security, and preferences</p>
          </div>
          <button onClick={onBack} style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid #1e1e1e', color: '#555', padding: '8px 18px', borderRadius: '10px', cursor: 'pointer', fontSize: '0.72rem', fontWeight: '600', letterSpacing: '0.04em', transition: 'border-color 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.borderColor='#333'} onMouseLeave={e => e.currentTarget.style.borderColor='#1e1e1e'}>
            ← Back
          </button>
        </div>

        {loading ? (
          <div style={{ padding: '6rem', textAlign: 'center', color: '#2a2a2a', fontSize: '0.82rem' }}>Loading…</div>
        ) : (
          <div style={{ display: 'flex', gap: '2rem', paddingTop: '2rem' }}>

            {/* LEFT SIDEBAR */}
            <div style={{ width: '220px', flexShrink: 0 }}>

              {/* Avatar card */}
              <div style={{ background: '#080808', border: '1px solid #141414', borderRadius: '16px', padding: '1.5rem', textAlign: 'center', marginBottom: '12px' }}>
                <div style={{ width: '60px', height: '60px', borderRadius: '50%', background: 'linear-gradient(135deg,#2a0000,#ff333320)', border: '1px solid #ff333330', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', fontSize: '1.5rem', fontWeight: '900', color: '#ff6666' }}>
                  {initials}
                </div>
                <div style={{ fontSize: '0.9rem', fontWeight: '700', color: '#e0e0e0', marginBottom: '4px' }}>{[firstName, fullName].filter(Boolean).join(' ') || 'Your Name'}</div>
                <div style={{ fontSize: '0.62rem', color: '#333', wordBreak: 'break-all' }}>{user?.email}</div>
              </div>

              {/* Tab nav */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {TABS.map(t => (
                  <button key={t.id} onClick={() => setTab(t.id)} className="acc-tab"
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderRadius: '10px', border: `1px solid ${tab === t.id ? (t.red ? '#ff333330' : '#ffffff12') : 'transparent'}`, background: tab === t.id ? (t.red ? 'rgba(255,51,51,0.06)' : 'rgba(255,255,255,0.04)') : 'transparent', color: tab === t.id ? (t.red ? '#ff5555' : '#d0d0d0') : '#444', cursor: 'pointer', fontSize: '0.82rem', fontWeight: tab === t.id ? '600' : '400', textAlign: 'left', width: '100%', transition: 'all 0.15s' }}>
                    <span style={{ fontSize: '0.9rem', opacity: 0.7 }}>{t.icon}</span>
                    {t.label}
                    {tab === t.id && <div style={{ marginLeft: 'auto', width: '4px', height: '4px', borderRadius: '50%', background: t.red ? '#ff4444' : '#ff3333' }} />}
                  </button>
                ))}
              </div>
            </div>

            {/* RIGHT CONTENT */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ background: '#080808', border: '1px solid #141414', borderRadius: '16px', padding: '2rem' }}>

                {/* PROFILE */}
                {tab === 'profile' && (
                  <div>
                    <SectionHeader title="Personal Information" desc="Update your name and contact details" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                        <div>
                          <Label>First Name</Label>
                          <input className="acc-input" value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} autoCorrect="off" spellCheck={false} />
                        </div>
                        <div>
                          <Label>Last Name</Label>
                          <input className="acc-input" value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} autoCorrect="off" spellCheck={false} />
                        </div>
                      </div>
                      <div>
                        <Label>Email Address</Label>
                        <input value={user?.email || ''} disabled style={{ ...inputStyle, color: '#252525', cursor: 'not-allowed', border: '1px solid #111' }} />
                        <p style={{ fontSize: '0.62rem', color: '#222', margin: '5px 0 0' }}>Email cannot be changed</p>
                      </div>
                      <div>
                        <Label>Phone Number</Label>
                        <input className="acc-input" value={phone} onChange={e => setPhone(e.target.value)}
                          style={{ ...inputStyle, borderColor: phone && !isValidPhone(phone) ? '#662222' : '#1e1e1e' }}
                          placeholder="+1 555 000 0000" />
                        {phone && !isValidPhone(phone) && (
                          <p style={{ fontSize: '0.7rem', color: '#cc4444', margin: '5px 0 0' }}>Enter a valid phone number (7–15 digits)</p>
                        )}
                      </div>
                      {profileError && <ErrorBox>{profileError}</ErrorBox>}
                      <SaveButton dirty={profileDirty && (!phone || isValidPhone(phone))} saving={profileSaving} saved={profileSaved} onClick={saveProfile} />
                    </div>
                  </div>
                )}

                {/* SECURITY */}
                {tab === 'security' && (
                  <div>
                    <SectionHeader title="Change Password" desc="Use a strong password you don't use elsewhere" />
                    <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      {pwdError && <ErrorBox>{pwdError}</ErrorBox>}
                      <div>
                        <Label>Current Password</Label>
                        <input type="password" className="acc-input" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} required style={inputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                      </div>
                      <div>
                        <Label>New Password</Label>
                        <input type="password" className="acc-input" value={newPwd} onChange={e => setNewPwd(e.target.value)} required style={inputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                        {newPwd && (
                          <div style={{ display: 'flex', gap: '16px', marginTop: '10px', flexWrap: 'wrap' }}>
                            {[
                              { ok: pwdCriteria.hasMinLength, text: '8+ chars' },
                              { ok: pwdCriteria.hasUppercase, text: 'Uppercase' },
                              { ok: pwdCriteria.hasSpecialChar, text: 'Special char' },
                            ].map(c => (
                              <span key={c.text} style={{ fontSize: '0.72rem', color: c.ok ? '#44cc44' : '#333', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: '14px', height: '14px', borderRadius: '50%', background: c.ok ? '#44cc4422' : '#1a1a1a', border: `1px solid ${c.ok ? '#44cc4444' : '#222'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.6rem' }}>{c.ok ? '✓' : ''}</span>
                                {c.text}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div>
                        <Label>Confirm New Password</Label>
                        <input type="password" className="acc-input" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required
                          style={{ ...inputStyle, borderColor: confirmPwd && newPwd !== confirmPwd ? '#662222' : '#1e1e1e' }}
                          autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                        {confirmPwd && newPwd !== confirmPwd && <p style={{ fontSize: '0.7rem', color: '#cc4444', margin: '5px 0 0' }}>Passwords do not match</p>}
                      </div>
                      <SaveButton dirty={isPwdStrong && !!currentPwd && newPwd === confirmPwd} saving={pwdSaving} saved={pwdSaved} label="Update Password" savedLabel="✓ Password Updated" type="submit" />
                    </form>
                  </div>
                )}

                {/* PREFERENCES */}
                {tab === 'preferences' && (
                  <div>
                    <SectionHeader title="Trading Preferences" desc="Customize how the platform adapts to you" />
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                      <div>
                        <Label>Experience Level</Label>
                        <select className="acc-input" value={experience} onChange={e => setExperience(e.target.value)}
                          style={{ ...inputStyle, cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23444' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}>
                          <option>Beginner (0-1 yrs)</option>
                          <option>Intermediate (1-3 yrs)</option>
                          <option>Professional (3+ yrs)</option>
                        </select>
                      </div>
                      <div>
                        <Label>Market Check Frequency</Label>
                        <select className="acc-input" value={frequency} onChange={e => setFrequency(e.target.value)}
                          style={{ ...inputStyle, cursor: 'pointer', appearance: 'none', backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%23444' d='M6 8L1 3h10z'/%3E%3C/svg%3E")`, backgroundRepeat: 'no-repeat', backgroundPosition: 'right 12px center' }}>
                          <option>Every Hour</option>
                          <option>Daily</option>
                          <option>Weekly</option>
                        </select>
                      </div>
                      <SaveButton dirty={prefsDirty} saving={profileSaving} saved={profileSaved} onClick={saveProfile} label="Save Preferences" />
                    </div>
                  </div>
                )}

                {/* DANGER */}
                {tab === 'danger' && (
                  <div>
                    <SectionHeader title="Danger Zone" desc="Irreversible actions — proceed with caution" red />
                    <div style={{ border: '1px solid #1e0000', borderRadius: '12px', padding: '1.5rem', background: 'rgba(255,0,0,0.02)' }}>
                      <div style={{ fontSize: '0.88rem', fontWeight: '600', color: '#cc3333', marginBottom: '8px' }}>Delete Account</div>
                      <p style={{ fontSize: '0.8rem', color: '#3a3a3a', lineHeight: 1.7, margin: '0 0 1.25rem' }}>
                        Permanently deletes your account, watchlist, and all data. This cannot be undone.
                      </p>
                      <Label>Type <span style={{ color: '#ff4444', fontStyle: 'normal' }}>DELETE</span> to confirm</Label>
                      <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)}
                        placeholder="DELETE" className="acc-input"
                        style={{ ...inputStyle, border: '1px solid #1e0000', marginBottom: '14px' }}
                        autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                      <button onClick={deleteAccount} disabled={deleteConfirm !== 'DELETE' || deleting}
                        style={{ width: '100%', padding: '0.85rem', background: deleteConfirm === 'DELETE' ? '#7a0000' : '#0d0d0d', border: `1px solid ${deleteConfirm === 'DELETE' ? '#cc000050' : '#1a1a1a'}`, borderRadius: '10px', color: deleteConfirm === 'DELETE' ? '#ff8888' : '#2a2a2a', fontWeight: '700', cursor: deleteConfirm === 'DELETE' ? 'pointer' : 'default', fontSize: '0.85rem', opacity: deleting ? 0.7 : 1, transition: 'all 0.2s' }}>
                        {deleting ? 'Deleting…' : 'Delete Account Forever'}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function SectionHeader({ title, desc, red }) {
  return (
    <div style={{ marginBottom: '1.75rem', paddingBottom: '1rem', borderBottom: '1px solid #0f0f0f' }}>
      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: red ? '#cc3333' : '#e8e8e8' }}>{title}</h3>
      <p style={{ margin: '4px 0 0', fontSize: '0.72rem', color: '#333' }}>{desc}</p>
    </div>
  );
}

function ErrorBox({ children }) {
  return (
    <div style={{ background: '#1a0000', border: '1px solid #440000', borderRadius: '10px', padding: '0.75rem 1rem', fontSize: '0.82rem', color: '#ff6666', fontWeight: '500' }}>{children}</div>
  );
}

function SaveButton({ dirty, saving, saved, onClick, label = 'Save Changes', savedLabel = '✓ Changes Saved', type = 'button' }) {
  return (
    <div style={{ paddingTop: '0.5rem', borderTop: '1px solid #0f0f0f', marginTop: '0.5rem' }}>
      <button type={type} onClick={onClick} disabled={!dirty || saving}
        style={{ padding: '0.8rem 2rem', background: dirty ? '#ff3333' : '#0d0d0d', border: `1px solid ${dirty ? '#ff333350' : '#141414'}`, borderRadius: '10px', color: dirty ? '#fff' : '#2a2a2a', fontWeight: '700', cursor: dirty ? 'pointer' : 'default', fontSize: '0.85rem', opacity: saving ? 0.7 : 1, transition: 'all 0.2s', letterSpacing: '0.03em' }}>
        {saved ? savedLabel : saving ? 'Saving…' : label}
      </button>
    </div>
  );
}

function MobileSettings({ tab, setTab, TABS, user, loading, initials, firstName, setFirstName, fullName, setFullName, phone, setPhone, profileDirty, prefsDirty, profileSaving, profileSaved, profileError, saveProfile, experience, setExperience, frequency, setFrequency, currentPwd, setCurrentPwd, newPwd, setNewPwd, confirmPwd, setConfirmPwd, pwdCriteria, isPwdStrong, pwdSaving, pwdSaved, pwdError, changePassword, deleteConfirm, setDeleteConfirm, deleting, deleteAccount, onBack }) {
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#020202', display: 'flex', flexDirection: 'column', overflow: 'hidden', color: '#fff' }}>
      <style>{`::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:#1a1a1a;border-radius:2px}`}</style>
      <div style={{ paddingTop: '56px', padding: '56px 20px 14px', borderBottom: '1px solid #0f0f0f', flexShrink: 0 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: '#1a0000', border: '1px solid #ff333330', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1rem', fontWeight: '800', color: '#ff6666' }}>{initials}</div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: '800', color: '#fff' }}>{[firstName, fullName].filter(Boolean).join(' ') || 'ACCOUNT'}</div>
              <div style={{ fontSize: '0.6rem', color: '#333' }}>{user?.email}</div>
            </div>
          </div>
          <button onClick={onBack} style={{ background: 'none', border: '1px solid #1e1e1e', color: '#555', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600' }}>← Back</button>
        </div>
        <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', paddingBottom: '2px' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: '5px 12px', borderRadius: '7px', border: `1px solid ${tab === t.id ? (t.red ? '#ff3333' : '#333') : '#1a1a1a'}`, background: tab === t.id ? (t.red ? 'rgba(255,51,51,0.08)' : 'rgba(255,255,255,0.04)') : 'transparent', color: tab === t.id ? (t.red ? '#ff5555' : '#ccc') : '#444', cursor: 'pointer', fontSize: '0.62rem', fontWeight: '600', whiteSpace: 'nowrap', flexShrink: 0 }}>
              {t.label}
            </button>
          ))}
        </div>
      </div>
      {loading ? <div style={{ padding: '4rem', textAlign: 'center', color: '#2a2a2a', fontSize: '0.8rem' }}>Loading…</div> : (
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 20px 60px' }}>
          {tab === 'profile' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <MField label="First Name"><input className="acc-input" value={firstName} onChange={e => setFirstName(e.target.value)} style={inputStyle} /></MField>
              <MField label="Last Name"><input className="acc-input" value={fullName} onChange={e => setFullName(e.target.value)} style={inputStyle} /></MField>
              <MField label="Email"><input value={user?.email || ''} disabled style={{ ...inputStyle, color: '#252525', border: '1px solid #111' }} /></MField>
              <MField label="Phone">
                <input className="acc-input" value={phone} onChange={e => setPhone(e.target.value)} style={{ ...inputStyle, borderColor: phone && !isValidPhone(phone) ? '#662222' : '#1e1e1e' }} placeholder="+1 555 000 0000" />
                {phone && !isValidPhone(phone) && <p style={{ fontSize: '0.7rem', color: '#cc4444', margin: '5px 0 0' }}>Enter a valid phone number</p>}
              </MField>
              {profileError && <ErrorBox>{profileError}</ErrorBox>}
              <SaveButton dirty={profileDirty && (!phone || isValidPhone(phone))} saving={profileSaving} saved={profileSaved} onClick={saveProfile} />
            </div>
          )}
          {tab === 'security' && (
            <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {pwdError && <ErrorBox>{pwdError}</ErrorBox>}
              <MField label="Current Password"><input type="password" value={currentPwd} onChange={e => setCurrentPwd(e.target.value)} required style={inputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} /></MField>
              <MField label="New Password">
                <input type="password" value={newPwd} onChange={e => setNewPwd(e.target.value)} required style={inputStyle} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
                {newPwd && <div style={{ fontSize: '0.72rem', marginTop: '8px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  <span style={{ color: pwdCriteria.hasMinLength ? '#44cc44' : '#333' }}>✓ 8+ characters</span>
                  <span style={{ color: pwdCriteria.hasUppercase ? '#44cc44' : '#333' }}>✓ Uppercase letter</span>
                  <span style={{ color: pwdCriteria.hasSpecialChar ? '#44cc44' : '#333' }}>✓ Special character</span>
                </div>}
              </MField>
              <MField label="Confirm Password">
                <input type="password" value={confirmPwd} onChange={e => setConfirmPwd(e.target.value)} required style={{ ...inputStyle, borderColor: confirmPwd && newPwd !== confirmPwd ? '#662222' : '#1e1e1e' }} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
              </MField>
              <SaveButton dirty={isPwdStrong && !!currentPwd && newPwd === confirmPwd} saving={pwdSaving} saved={pwdSaved} label="Update Password" savedLabel="✓ Updated" type="submit" />
            </form>
          )}
          {tab === 'preferences' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <MField label="Experience Level">
                <select value={experience} onChange={e => setExperience(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option>Beginner (0-1 yrs)</option><option>Intermediate (1-3 yrs)</option><option>Professional (3+ yrs)</option>
                </select>
              </MField>
              <MField label="Check Frequency">
                <select value={frequency} onChange={e => setFrequency(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                  <option>Every Hour</option><option>Daily</option><option>Weekly</option>
                </select>
              </MField>
              <SaveButton dirty={prefsDirty} saving={profileSaving} saved={profileSaved} onClick={saveProfile} label="Save Preferences" />
            </div>
          )}
          {tab === 'danger' && (
            <div style={{ border: '1px solid #1e0000', borderRadius: '12px', padding: '1.25rem', background: 'rgba(255,0,0,0.02)' }}>
              <div style={{ fontSize: '0.88rem', fontWeight: '600', color: '#cc3333', marginBottom: '8px' }}>Delete Account</div>
              <p style={{ fontSize: '0.78rem', color: '#3a3a3a', lineHeight: 1.7, margin: '0 0 1rem' }}>Permanently deletes your account and all data. Cannot be undone.</p>
              <Label>Type <span style={{ color: '#ff4444' }}>DELETE</span> to confirm</Label>
              <input value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" style={{ ...inputStyle, border: '1px solid #1e0000', marginBottom: '12px' }} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
              <button onClick={deleteAccount} disabled={deleteConfirm !== 'DELETE' || deleting}
                style={{ width: '100%', padding: '0.85rem', background: deleteConfirm === 'DELETE' ? '#7a0000' : '#0d0d0d', border: `1px solid ${deleteConfirm === 'DELETE' ? '#cc000050' : '#1a1a1a'}`, borderRadius: '10px', color: deleteConfirm === 'DELETE' ? '#ff8888' : '#2a2a2a', fontWeight: '700', cursor: deleteConfirm === 'DELETE' ? 'pointer' : 'default', fontSize: '0.85rem', transition: 'all 0.2s' }}>
                {deleting ? 'Deleting…' : 'Delete Account Forever'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const MField = ({ label, children }) => (
  <div><Label>{label}</Label>{children}</div>
);
