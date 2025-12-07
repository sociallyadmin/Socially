import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import GoogleLoginButton from '../components/GoogleLoginButton';

const resolveApiBase = () => {
  const envBase = process.env.REACT_APP_API_BASE;
  try {
    const { protocol, hostname, origin } = window.location;
    if (protocol === 'https:' && envBase && envBase.startsWith('http://localhost')) {
      return `${origin}/api`;
    }
    if (protocol === 'https:' && /sociallyapp\.org$/i.test(hostname) && (!envBase || envBase.startsWith('http://'))) {
      return `${origin}/api`;
    }
    return envBase || 'https://api.sociallyapp.org/api';
  } catch {
    return envBase || 'https://api.sociallyapp.org/api';
  }
};
const API_BASE = resolveApiBase();

export default function Login({ setToken, setUser }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [twoFARequired, setTwoFARequired] = useState(false);
  const [twoFAUserId, setTwoFAUserId] = useState(null);
  const [twoFACode, setTwoFACode] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await axios.post(`${API_BASE}/auth/login`, {
        email,
        password
      });

      if (response.data.twoFARequired) {
        setTwoFARequired(true);
        setTwoFAUserId(response.data.userId);
        setError('Two-factor code required. Enter it below.');
      } else {
        localStorage.setItem('token', response.data.token);
        setToken(response.data.token);
        setUser(response.data.user);
        navigate('/');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const submit2FA = async (e) => {
    e.preventDefault();
    if (!twoFACode || !twoFAUserId) return;
    setLoading(true);
    setError('');
    try {
      const res = await axios.post(`${API_BASE}/auth/login-2fa`, { userId: twoFAUserId, token: twoFACode });
      localStorage.setItem('token', res.data.token);
      setToken(res.data.token);
      setUser(res.data.user);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || '2FA verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>🎭 Socially</h2>
        <div style={{ background: '#FFF4E5', border: '1px solid #F59E0B', color: '#92400E', padding: '10px 12px', borderRadius: 6, marginBottom: '12px' }}>
          <strong>Important:</strong> you can not login / create an account on the Safari browser, and will not be able to do this until further notice.
        </div>
        {error && <div className="error-message">{error}</div>}
        
        <GoogleLoginButton 
          onSuccess={(user) => {
            setUser(user);
            navigate('/');
          }}
        />

        <div style={{ position: 'relative', margin: '1.5rem 0', textAlign: 'center' }}>
          <div style={{ borderTop: '1px solid #ddd', position: 'absolute', top: '50%', left: 0, right: 0 }}></div>
          <span style={{ backgroundColor: 'white', padding: '0 10px', position: 'relative' }}>or</span>
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

        <div className="form-group">
          <label>Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
        </div>

        {!twoFARequired ? (
          <button className="btn btn-primary" disabled={loading}>
            {loading ? 'Logging in...' : 'Login'}
          </button>
        ) : (
          <div style={{ marginTop: '1rem' }}>
            <div className="form-group">
              <label>2FA Code</label>
              <input value={twoFACode} onChange={(e) => setTwoFACode(e.target.value)} placeholder="123456" />
            </div>
            <button className="btn btn-primary" disabled={loading} onClick={submit2FA}>
              {loading ? 'Verifying...' : 'Verify 2FA'}
            </button>
          </div>
        )}

        <div className="auth-link">
          Don't have an account? <Link to="/register">Register here</Link>
        </div>
      </form>
    </div>
  );
}
