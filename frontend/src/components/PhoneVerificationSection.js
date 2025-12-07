import React, { useEffect, useRef, useState } from 'react';
import { getAuth, RecaptchaVerifier, signInWithPhoneNumber, onAuthStateChanged, updateProfile } from 'firebase/auth';
import { app } from '../firebase';

export default function PhoneVerificationSection({ user, apiBase, setUser }) {
  const [phone, setPhone] = useState(user?.phone || '');
  const [code, setCode] = useState('');
  const [status, setStatus] = useState(user?.phoneVerified ? 'verified' : 'unverified');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [codeSent, setCodeSent] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);
  const confirmationResultRef = useRef(null);
  const recaptchaRef = useRef(null);
  const recaptchaWidgetIdRef = useRef(null);

  useEffect(() => {
    (async () => {
      const auth = getAuth(app);
      try {
        // Localize if desired
        // auth.languageCode = 'en';

        if (!recaptchaRef.current) {
          // Use visible widget for reliability; switch to invisible later if desired
          recaptchaRef.current = new RecaptchaVerifier('recaptcha-container', { size: 'invisible' }, auth);
          recaptchaWidgetIdRef.current = await recaptchaRef.current.render();
        }
      } catch (e) {
        console.warn('reCAPTCHA init failed:', e);
        setError(e?.message || 'reCAPTCHA init failed');
        setErrorCode(e?.code || '');
      }

      const unsub = onAuthStateChanged(auth, () => {});
      return () => unsub();
    })();
  }, []);

  const requestCode = async () => {
    if (!phone) {
      setError('Please enter your phone number');
      return;
    }
    setLoading(true);
    setError('');
    setMessage('');
    try {
      const auth = getAuth(app);
      // Ensure phone is in E.164 format
      const e164 = normalizePhone(phone.trim());
      if (!/^\+\d{8,15}$/.test(e164)) {
        setError('Please enter a valid phone number in E.164 format, e.g. +16144899684');
        setErrorCode('auth/invalid-phone-number');
        setLoading(false);
        return;
      }
      if (!recaptchaRef.current) {
        throw new Error('reCAPTCHA not initialized');
      }
      try {
        await recaptchaRef.current.verify();
      } catch (verErr) {
        setErrorCode(verErr?.code || '');
        throw new Error(`reCAPTCHA verification failed: ${verErr && verErr.message ? verErr.message : verErr}`);
      }
      confirmationResultRef.current = await signInWithPhoneNumber(auth, e164, recaptchaRef.current);
      setCodeSent(true);
      setMessage('Verification code sent via SMS!');
      // Start resend countdown (e.g., 60s)
      setResendSeconds(60);
      const id = setInterval(() => {
        setResendSeconds(prev => {
          if (prev <= 1) {
            clearInterval(id);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (err) {
      console.error('send code error:', err);
      const msg = (err && err.message) || 'Failed to send code';
      setError(msg);
      setErrorCode(err?.code || '');
      // Reset reCAPTCHA so user can retry
      try {
        // global grecaptcha may not be defined in testing mode
        if (window.grecaptcha && recaptchaWidgetIdRef.current !== null) {
          window.grecaptcha.reset(recaptchaWidgetIdRef.current);
        }
      } catch {}
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    // guard: countdown must be finished
    if (resendSeconds > 0) return;
    // reuse requestCode flow
    await requestCode();
  };

  const normalizePhone = (raw) => {
    if (!raw) return '';
    const cleaned = raw.replace(/[\s\-().]/g, '');
    // Ensure plus sign
    if (cleaned.startsWith('+')) return cleaned;
    // If user omitted '+', attempt to prepend '+'
    return `+${cleaned}`;
  };

  const verifyCode = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');
    try {
      if (!confirmationResultRef.current) {
        setError('Please request a code first');
        setLoading(false);
        return;
      }
      const result = await confirmationResultRef.current.confirm(code);
      const firebaseUser = result.user;
      // Mark verified in app state; optionally persist phone locally
      setStatus('verified');
      setMessage('Phone verified successfully');
      setUser && setUser({ ...user, phone, phoneVerified: true });
      try {
        await updateProfile(firebaseUser, {});
      } catch {}
    } catch (err) {
      setError(err.message || 'Verification failed');
      setErrorCode(err?.code || '');
    } finally {
      setLoading(false);
    }
  };

  const resetRecaptcha = async () => {
    try {
      if (window.grecaptcha && recaptchaWidgetIdRef.current !== null) {
        window.grecaptcha.reset(recaptchaWidgetIdRef.current);
      }
      if (recaptchaRef.current?.clear) {
        recaptchaRef.current.clear();
        recaptchaRef.current = null;
      }
      const auth = getAuth(app);
      recaptchaRef.current = new RecaptchaVerifier('recaptcha-container', { size: 'invisible' }, auth);
      recaptchaWidgetIdRef.current = await recaptchaRef.current.render();
      setError('');
      setErrorCode('');
      setMessage('');
    } catch (e) {
      console.warn('Failed to reset reCAPTCHA:', e);
      setError(e?.message || 'Failed to reset reCAPTCHA');
      setErrorCode(e?.code || '');
    }
  };

  return (
    <div className="phone-verification card" style={{ maxWidth: 420, margin: '2rem auto', boxShadow: 'var(--card-shadow)' }}>
      <div className="form-row" style={{ display: 'flex', flexDirection: 'row', gap: '1.5rem', alignItems: 'flex-end' }}>
        <div className="form-group" style={{ flex: 1 }}>
          <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>Phone Number</label>
          <input
            className="form-control"
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value)}
            placeholder="e.g. +16144899684"
            disabled={status === 'verified'}
          />
          <div className="hint" style={{ color: 'var(--text-light)', fontSize: '0.95em', marginTop: 4 }}>We'll send a verification code via SMS.</div>
        </div>

        {status === 'verified' ? (
          <div style={{ alignSelf: 'flex-end' }}>
            <span style={{ color: 'var(--success)', fontWeight: 700 }}>Verified</span>
          </div>
        ) : (
          <div style={{ alignSelf: 'flex-end' }} className="send-btn">
            <button className="btn btn-primary" style={{ minWidth: 120 }} onClick={requestCode} disabled={loading || !phone}>
              {loading ? 'Sending...' : 'Send Code'}
            </button>
          </div>
        )}
      </div>

      {codeSent && status !== 'verified' && (
        <form onSubmit={verifyCode} className="code-form" style={{ marginTop: 24 }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontWeight: 600, marginBottom: 6, display: 'block' }}>Enter Verification Code</label>
            <input
              className="form-control"
              type="text"
              value={code}
              onChange={e => setCode(e.target.value)}
              placeholder="6-digit code"
              required
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', marginTop: 8 }}>
            <button type="submit" className="btn btn-success" style={{ minWidth: 120 }} disabled={loading || !code}>
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button type="button" className="btn" onClick={resendCode} disabled={loading || resendSeconds > 0}>
              {resendSeconds > 0 ? `Resend in ${resendSeconds}s` : 'Resend Code'}
            </button>
          </div>
        </form>
      )}

      {error && (
        <div className="error-message" style={{ marginTop: 16, color: 'var(--error)', fontSize: '0.95em' }}>
          {error}
          {errorCode ? (
            <div style={{ marginTop: 6, fontFamily: 'monospace' }}>Error code: {errorCode}</div>
          ) : null}
          <div style={{ marginTop: 10 }}>
            <button type="button" className="btn btn-outline" onClick={resetRecaptcha} disabled={loading}>Reset reCAPTCHA</button>
          </div>
        </div>
      )}
      {message && <div className="success-message" style={{ marginTop: 16, color: 'var(--success)', fontSize: '0.95em' }}>{message}</div>}
      {/* Diagnostics */}
      <div className="diagnostics" style={{ marginTop: 16, fontSize: '0.85em', color: '#374151', borderTop: '1px solid #e5e7eb', paddingTop: 10 }}>
        <div>reCAPTCHA: {recaptchaRef.current ? 'initialized' : 'not initialized'}</div>
        <div>Code sent: {codeSent ? 'yes' : 'no'}</div>
        <div>Status: {status}</div>
        {errorCode ? <div>Last error code: <span style={{ fontFamily: 'monospace' }}>{errorCode}</span></div> : null}
      </div>
      <div id="recaptcha-container" style={{ marginTop: 12 }} />
    </div>
  );
}
