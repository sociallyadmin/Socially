import React, { useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Settings({ user, apiBase, setUser, handleLogout }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const [username, setUsername] = useState(user?.username || '');
  const [email, setEmail] = useState(user?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [avatarPreview, setAvatarPreview] = useState(user?.avatar || '');
  const [avatarFile, setAvatarFile] = useState(null);
  // 2FA state
  const [twoFAEnabled, setTwoFAEnabled] = useState(user?.twoFA?.enabled || false);
  const [qrData, setQrData] = useState('');
  const [twoFASecret, setTwoFASecret] = useState('');
  const [showSetup, setShowSetup] = useState(false);
  const [twoFACode, setTwoFACode] = useState('');

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    try {
      const response = await axios.put(`${apiBase}/users/${user.id}`, {
        username,
        email
      });
      setUser(response.data);
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setAvatarFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setAvatarPreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleUploadAvatar = async () => {
    if (!avatarFile) {
      setError('Please select an image first');
      return;
    }

    setLoading(true);
    setMessage('');
    setError('');

    const formData = new FormData();
    formData.append('avatar', avatarFile);

    try {
      console.log('Uploading avatar for user:', user.id);
      const response = await axios.post(`${apiBase}/users/${user.id}/avatar`, formData);
      console.log('Avatar upload response:', response.data);
      setUser(response.data);
      setAvatarFile(null);
      setAvatarPreview(response.data.avatar);
      setMessage('Profile picture updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      console.error('Upload error details:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
        config: err.config
      });
      setError(err.response?.data?.error || err.message || 'Failed to upload profile picture');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');
    setError('');

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match');
      setLoading(false);
      return;
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      await axios.post(`${apiBase}/users/${user.id}/change-password`, {
        currentPassword,
        newPassword
      });
      setMessage('Password changed successfully!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  const handleLogoutClick = () => {
    handleLogout();
    navigate('/login');
  };

  const authHeader = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } });

  // eslint-disable-next-line no-unused-vars
  const fetch2FAStatus = async () => {
    try {
      const res = await axios.get(`${apiBase}/auth/2fa/status`, authHeader());
      setTwoFAEnabled(res.data.twoFA?.enabled || false);
    } catch (err) {
      // ignore
    }
  };

  const start2FASetup = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${apiBase}/auth/2fa/setup`, {}, authHeader());
      setQrData(res.data.qr);
      setTwoFASecret(res.data.secret);
      setShowSetup(true);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to start 2FA setup');
    } finally {
      setLoading(false);
    }
  };

  const verifyAndEnable2FA = async () => {
    setLoading(true);
    setError('');
    try {
      await axios.post(`${apiBase}/auth/2fa/enable`, { token: twoFACode }, authHeader());
      setTwoFAEnabled(true);
      setShowSetup(false);
      setTwoFACode('');
      setMessage('2FA enabled successfully');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to enable 2FA');
    } finally {
      setLoading(false);
    }
  };

  const disable2FA = async () => {
    const confirmVal = window.confirm('Are you sure you want to disable 2FA?');
    if (!confirmVal) return;
    const pw = window.prompt('Enter your password (or enter a valid 2FA code)');
    if (!pw) return;
    setLoading(true);
    setError('');
    try {
      // Try as password first
      await axios.post(`${apiBase}/auth/2fa/disable`, { password: pw }, authHeader());
      setTwoFAEnabled(false);
      setMessage('2FA disabled');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      // Maybe pw was TOTP code - try as token
      try {
        await axios.post(`${apiBase}/auth/2fa/disable`, { token: pw }, authHeader());
        setTwoFAEnabled(false);
        setMessage('2FA disabled');
        setTimeout(() => setMessage(''), 3000);
      } catch (err2) {
        setError(err2.response?.data?.error || 'Failed to disable 2FA');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="settings-page">
      <div className="settings-container">
        <h1>⚙️ Settings</h1>

        <div className="settings-tabs">
          <button
            className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            Profile
          </button>
          <button
            className={`settings-tab ${activeTab === 'password' ? 'active' : ''}`}
            onClick={() => setActiveTab('password')}
          >
            Password
          </button>
          <button
            className={`settings-tab ${activeTab === 'account' ? 'active' : ''}`}
            onClick={() => setActiveTab('account')}
          >
            Account
          </button>
        </div>

        {message && <div className="success-message">{message}</div>}
        {error && <div className="error-message">{error}</div>}

        {activeTab === 'profile' && (
          <form onSubmit={handleUpdateProfile} className="settings-form">
            <h2>Update Profile</h2>

            <div className="form-group">
              <label>Profile Picture</label>
              <div style={{ textAlign: 'center', marginBottom: '1rem' }}>
                <img 
                  src={avatarPreview || '/default-avatar.svg'} 
                  alt="Profile" 
                  style={{ 
                    width: '120px', 
                    height: '120px', 
                    borderRadius: '50%', 
                    objectFit: 'cover',
                    border: '3px solid #6366f1'
                  }} 
                />
              </div>
              <div style={{ marginBottom: '1rem' }}>
                <input
                  id="avatar-input"
                  type="file"
                  accept="image/*"
                  onChange={handleAvatarChange}
                />
              </div>
              {avatarFile && (
                <>
                  <p style={{ fontSize: '0.9rem', color: '#6b7280', marginBottom: '0.5rem' }}>
                    Selected: {avatarFile.name}
                  </p>
                  <button
                    type="button"
                    className="btn btn-primary"
                    onClick={handleUploadAvatar}
                    disabled={loading}
                    style={{ width: '100%' }}
                  >
                    {loading ? 'Uploading...' : 'Upload Profile Picture'}
                  </button>
                </>
              )}
            </div>
            
            <div className="form-group">
              <label>Username</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                required
              />
            </div>

            <div className="form-group">
              <label>Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Enter your email"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </form>
        )}

        {activeTab === 'password' && (
          <form onSubmit={handleChangePassword} className="settings-form">
            <h2>Change Password</h2>

            <div className="form-group">
              <label>Current Password</label>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter your current password"
                required
              />
            </div>

            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter your new password"
                required
              />
            </div>

            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                required
              />
            </div>

            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Updating...' : 'Change Password'}
            </button>
          </form>
        )}

        {activeTab === 'account' && (
          <div className="settings-form">
            <h2>Account Settings</h2>
            <div style={{ marginTop: '2rem' }}>
              <p style={{ color: '#6b7280', marginBottom: '1.5rem' }}>
                Manage your account and security options.
              </p>
              {/* Phone verification removed per request */}

              <div style={{ marginBottom: '1rem' }}>
                <strong>Two-Factor Authentication (2FA):</strong>
                <div style={{ marginTop: '0.5rem' }}>
                  {twoFAEnabled ? (
                    <>
                      <p style={{ margin: 0, color: '#16a34a' }}>Enabled</p>
                      <button className="btn" onClick={disable2FA} disabled={loading} style={{ marginTop: '0.5rem' }}>
                        Disable 2FA
                      </button>
                    </>
                  ) : (
                    <>
                      <p style={{ margin: 0, color: '#374151' }}>Not enabled</p>
                      <button className="btn btn-primary" onClick={start2FASetup} disabled={loading} style={{ marginTop: '0.5rem' }}>
                        Enable 2FA
                      </button>
                    </>
                  )}
                </div>
              </div>

              {showSetup && (
                <div style={{ marginTop: '1rem', padding: '1rem', border: '1px solid #e5e7eb' }}>
                  <p>Scan the QR with Google Authenticator (or copy the secret):</p>
                  {qrData && <img src={qrData} alt="2FA QR" style={{ maxWidth: '220px' }} />}
                  <p style={{ fontSize: '0.9rem', color: '#6b7280', marginTop: '0.5rem' }}>Secret: {twoFASecret}</p>
                  <div style={{ marginTop: '0.5rem' }}>
                    <label>Enter code from app</label>
                    <input value={twoFACode} onChange={(e) => setTwoFACode(e.target.value)} placeholder="123456" />
                    <button className="btn btn-primary" onClick={verifyAndEnable2FA} disabled={loading || !twoFACode} style={{ marginLeft: '0.5rem' }}>
                      Verify & Enable
                    </button>
                  </div>
                </div>
              )}

              <button
                type="button"
                className="btn btn-danger"
                onClick={handleLogoutClick}
                style={{ width: '100%', marginTop: '1rem' }}
              >
                Logout
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
