import React, { useState, useEffect } from 'react';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_BASE || 'https://api.sociallyapp.org/api';

export default function EmailVerification({ email, onVerified, autoRequest = false }) {
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(false);

  const requestCode = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    try {
      await axios.post(`${API_BASE}/auth/request-verification`, { email });
      setRequested(true);
      setMessage('Verification code sent to your email.');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to send code');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (autoRequest && email) {
      requestCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRequest, email]);

  const verifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const res = await axios.post(`${API_BASE}/auth/verify-email`, { email, code });
      setMessage(res.data.message);
      if (res.data.message.includes('success')) {
        onVerified && onVerified();
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Verification failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="verify-container">
      <h3>Email Verification</h3>
      {!requested ? (
        <button onClick={requestCode} disabled={loading} className="btn btn-primary">
          {loading ? 'Sending...' : 'Send Verification Code'}
        </button>
      ) : (
        <form onSubmit={verifyCode} className="verify-form">
          <label>Enter Verification Code</label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value)}
            placeholder="6-digit code"
            required
          />
          <button type="submit" className="btn btn-success" disabled={loading}>
            {loading ? 'Verifying...' : 'Verify Email'}
          </button>
        </form>
      )}
      {message && <div className="success-message">{message}</div>}
      {error && <div className="error-message">{error}</div>}
    </div>
  );
}
