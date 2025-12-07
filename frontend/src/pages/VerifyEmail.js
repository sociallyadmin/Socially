import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import EmailVerification from '../components/EmailVerification';

export default function VerifyEmail() {
  const location = useLocation();
  const navigate = useNavigate();
  const emailFromState = location.state && location.state.email;
  const query = new URLSearchParams(location.search);
  const emailFromQuery = query.get('email');
  const email = emailFromState || emailFromQuery || '';

  return (
    <div className="auth-container">
      <div className="auth-form">
        <h2>Verify Your Email</h2>
        <p>Please check your inbox for a verification code. Enter it below to verify your account.</p>
        <EmailVerification email={email} autoRequest={!!email} onVerified={() => navigate('/login')} />

        <div style={{ marginTop: 16 }}>
          <button className="btn btn-link" onClick={() => navigate('/register')}>Back to Register</button>
        </div>
      </div>
    </div>
  );
}
