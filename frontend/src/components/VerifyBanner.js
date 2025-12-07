import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export default function VerifyBanner({ user }) {
  const [cooldown, setCooldown] = useState(0);
  const [error, setError] = useState('');

  useEffect(() => {
    let timer;
    if (cooldown > 0) {
      timer = setInterval(() => setCooldown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [cooldown]);

  const navigate = useNavigate();

  const handleResend = async () => {
    // Navigate user to the verification page where they can enter the code.
    // Pass the user's email so the verification page can auto-request a code.
    try {
      navigate('/verify', { state: { email: user?.email } });
    } catch (err) {
      // fallback behavior: attempt to send code and show message
      setError('Unable to open verification page');
    }
  };

  if (!user || user.verified) return null;

  return (
    <div className="verify-banner">
      <div className="verify-banner__content">
        <strong className="verify-banner__title">Please Verify Your Email!</strong>
        <div className="verify-banner__subtitle">Check your email for a verification code to unlock full account features.</div>
      </div>
      <div className="verify-banner__actions">
        {error && <div className="verify-banner__message verify-banner__message--error">{error}</div>}
        <button className="btn btn-secondary verify-banner__btn" onClick={handleResend} disabled={cooldown > 0}>
          {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
        </button>
      </div>
    </div>
  );
}
