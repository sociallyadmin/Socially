import React, { useRef, useCallback, useEffect } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const GoogleLoginButton = ({ onSuccess }) => {
  const navigate = useNavigate();
  const scriptRef = useRef(null);
  const buttonRef = useRef(null);
  const clientId = process.env.REACT_APP_GOOGLE_CLIENT_ID;

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

  const handleCredentialResponse = useCallback(async (response) => {
    try {
      const { credential } = response;
      console.log('Google token received, sending to backend...');

      const result = await axios.post(`${API_BASE}/auth/google`, {
        token: credential
      });

      localStorage.setItem('token', result.data.token);
      localStorage.setItem('user', JSON.stringify(result.data.user));
      
      if (onSuccess) {
        onSuccess(result.data.user);
      } else {
        navigate('/');
      }
    } catch (error) {
      console.error('Google login error:', error);
      alert(error.response?.data?.error || 'Google sign-in failed');
    }
  }, [navigate, onSuccess]);

  const initializeGoogleSignIn = useCallback(() => {
    if (window.google && clientId) {
      window.google.accounts.id.initialize({
        client_id: clientId,
        callback: handleCredentialResponse
      });
      if (buttonRef.current) {
        window.google.accounts.id.renderButton(buttonRef.current, {
          type: 'standard',
          size: 'large',
          theme: 'outline',
          text: 'signin_with',
          shape: 'rectangular',
          logo_alignment: 'left'
        });
      }
      window.google.accounts.id.prompt();
    }
  }, [handleCredentialResponse, clientId]);

  useEffect(() => {
    // Load Google Sign-In SDK
    if (!window.google) {
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      document.body.appendChild(script);
      scriptRef.current = script;

      script.onload = () => {
        initializeGoogleSignIn();
      };
    } else {
      initializeGoogleSignIn();
    }

    return () => {
      // Cleanup
      if (scriptRef.current && scriptRef.current.parentNode) {
        scriptRef.current.parentNode.removeChild(scriptRef.current);
      }
    };
  }, [initializeGoogleSignIn]);

  return (
    <div style={{ textAlign: 'center', margin: '20px 0' }}>
      {clientId ? (
        <div ref={buttonRef} />
      ) : (
        <div style={{ color: '#9ca3af', fontSize: '0.9rem' }}>
          Google Sign-In is not configured.
        </div>
      )}
    </div>
  );
};

export default GoogleLoginButton;
