import React, { useEffect, useRef, useState } from 'react';
import { ArrowRight, ArrowUp, Eye, EyeOff } from 'lucide-react';

const inputStyle = {
  width: '100%',
  padding: '12px 4px',
  background: 'transparent',
  border: 'none',
  borderBottom: '1.5px solid rgba(27,31,59,0.25)',
  outline: 'none',
  fontSize: 15,
  fontFamily: "'Inter', sans-serif",
  color: '#1B1F3B',
  transition: 'border-color 150ms ease',
};

export default function LandingAuth({ active, initialMode = 'login', onBack, onLoginSuccess }) {
  const [mode, setMode] = useState(initialMode || 'login'); // 'login' | 'signup' | 'reset'
  const [name, setName] = useState('');
  const [email, setEmail] = useState(() => localStorage.getItem('lifetrack_remembered_email') || 'shubhamarbole@gmail.com');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const containerRef = useRef(null);
  const wheelAccum = useRef(0);
  const touchY = useRef(null);
  const lockRef = useRef(false);

  useEffect(() => {
    if (initialMode) setMode(initialMode);
  }, [initialMode]);

  // Load remembered email if available
  useEffect(() => {
    const savedEmail = localStorage.getItem('lifetrack_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  // Scroll up (or swipe down) to leave sign up and go back to hero
  useEffect(() => {
    if (!active) return;
    lockRef.current = false;
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e) => {
      if (lockRef.current) return;
      wheelAccum.current += e.deltaY;
      if (wheelAccum.current < -60) {
        lockRef.current = true;
        onBack();
        wheelAccum.current = 0;
      } else if (wheelAccum.current > 0) {
        wheelAccum.current = 0;
      }
    };

    el.addEventListener('wheel', onWheel, { passive: true });
    return () => el.removeEventListener('wheel', onWheel);
  }, [active, onBack]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key === 'ArrowUp' && !lockRef.current) {
        lockRef.current = true;
        onBack();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, onBack]);

  const onTouchStart = (e) => {
    if (!active) return;
    touchY.current = e.touches[0].clientY;
  };

  const onTouchEnd = (e) => {
    if (!active || touchY.current === null || lockRef.current) return;
    const dy = e.changedTouches[0].clientY - touchY.current;
    if (dy > 60) {
      lockRef.current = true;
      onBack();
    }
    touchY.current = null;
  };

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSuccessMsg('');

    if (!email || !password || (mode === 'signup' && !name)) {
      setError('Fill in every field to continue.');
      return;
    }
    if (mode === 'signup' && password.length < 4) {
      setError('Password needs at least 4 characters.');
      return;
    }

    setSubmitting(true);
    try {
      let endpoint = '/api/auth/login';
      let body = { email: email.trim(), password };

      if (mode === 'signup') {
        endpoint = '/api/auth/register';
        body = { name: name.trim(), email: email.trim(), password };
      } else if (mode === 'reset') {
        endpoint = '/api/auth/reset-password';
        body = { email: email.trim(), newPassword: password };
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || (mode === 'signup' ? 'Registration failed.' : 'Request failed.'));
      }

      if (data.token) {
        localStorage.setItem('lifetrack_token', data.token);
      }
      localStorage.setItem('lifetrack_remembered_email', email.trim());

      if (mode === 'reset' && !data.token) {
        setSuccessMsg('Password updated! You can now log in.');
        setMode('login');
      } else {
        onLoginSuccess(data);
      }
    } catch (err) {
      setError(err.message || 'Something went wrong. Please check your credentials.');
    } finally {
      setSubmitting(false);
    }
  }

  function switchMode(next) {
    setMode(next);
    setError('');
    setSuccessMsg('');
  }

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
      style={{
        height: '100vh',
        width: '100%',
        background: '#F7F3EC',
        color: '#1B1F3B',
        fontFamily: "'Inter', sans-serif",
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <button
        onClick={onBack}
        aria-label="Back to your day"
        style={{
          position: 'absolute',
          top: 24,
          left: 24,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          fontSize: 12,
          fontWeight: 600,
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
          opacity: 0.7,
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: '#1B1F3B',
        }}
      >
        <ArrowUp size={15} strokeWidth={2.25} />
        Back
      </button>

      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '0 24px',
        }}
      >
        <div style={{ width: '100%', maxWidth: 380 }}>
          <p
            style={{
              fontFamily: "'Anton', sans-serif",
              fontSize: 'clamp(32px, 5vw, 48px)',
              fontWeight: 400,
              letterSpacing: '-0.02em',
              lineHeight: 1,
              textTransform: 'uppercase',
              marginBottom: 12,
              color: '#1B1F3B',
            }}
          >
            {mode === 'login'
              ? 'Welcome back'
              : mode === 'signup'
              ? 'Begin tomorrow'
              : 'Reset password'}
          </p>
          <p
            style={{
              fontSize: 14,
              opacity: 0.7,
              lineHeight: 1.6,
              marginBottom: 28,
              color: '#1B1F3B',
            }}
          >
            {mode === 'login'
              ? 'Log in with your existing account to access your LifeTrack dashboard.'
              : mode === 'signup'
              ? 'Create an account and DayTrack picks up right where tonight left off.'
              : 'Set a new password for your existing account.'}
          </p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {mode === 'signup' && (
              <input
                style={inputStyle}
                type="text"
                placeholder="Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1B1F3B')}
                onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(27,31,59,0.25)')}
              />
            )}
            <input
              style={inputStyle}
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1B1F3B')}
              onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(27,31,59,0.25)')}
            />
            <div style={{ position: 'relative' }}>
              <input
                style={{ ...inputStyle, paddingRight: 32 }}
                type={showPassword ? 'text' : 'password'}
                placeholder={mode === 'reset' ? 'Enter new password' : 'Password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onFocus={(e) => (e.currentTarget.style.borderBottomColor = '#1B1F3B')}
                onBlur={(e) => (e.currentTarget.style.borderBottomColor = 'rgba(27,31,59,0.25)')}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                style={{
                  position: 'absolute',
                  right: 0,
                  top: 10,
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  opacity: 0.6,
                  color: '#1B1F3B',
                }}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>

            {error && (
              <p style={{ fontSize: 13, color: '#DC2626', margin: '4px 0 0 0', fontWeight: 500 }}>
                {error}
              </p>
            )}

            {successMsg && (
              <p style={{ fontSize: 13, color: '#16A34A', margin: '4px 0 0 0', fontWeight: 500 }}>
                {successMsg}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                marginTop: 8,
                padding: '14px 20px',
                background: '#1B1F3B',
                color: '#F7F3EC',
                border: 'none',
                fontSize: 13,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.14em',
                cursor: submitting ? 'default' : 'pointer',
                opacity: submitting ? 0.6 : 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                transition: 'opacity 150ms ease, transform 100ms ease',
              }}
            >
              {submitting
                ? 'Working…'
                : mode === 'login'
                ? 'Log in'
                : mode === 'signup'
                ? 'Create account'
                : 'Set Password & Enter'}
              {!submitting && <ArrowRight size={16} strokeWidth={2.25} />}
            </button>
          </form>

          <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10, fontSize: 13, opacity: 0.8 }}>
            {mode === 'login' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={() => switchMode('reset')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontWeight: 600,
                    textDecoration: 'underline',
                    color: '#1B1F3B',
                  }}
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={() => switchMode('signup')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontWeight: 600,
                    textDecoration: 'underline',
                    color: '#1B1F3B',
                  }}
                >
                  Create an account
                </button>
              </div>
            )}

            {mode === 'signup' && (
              <p style={{ margin: 0 }}>
                Already tracking?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontWeight: 600,
                    textDecoration: 'underline',
                    color: '#1B1F3B',
                  }}
                >
                  Log in
                </button>
              </p>
            )}

            {mode === 'reset' && (
              <p style={{ margin: 0 }}>
                Remember your password?{' '}
                <button
                  type="button"
                  onClick={() => switchMode('login')}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: 0,
                    cursor: 'pointer',
                    fontWeight: 600,
                    textDecoration: 'underline',
                    color: '#1B1F3B',
                  }}
                >
                  Back to Log in
                </button>
              </p>
            )}


          </div>
        </div>
      </div>
    </div>
  );
}

