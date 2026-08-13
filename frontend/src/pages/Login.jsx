import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowUpRight, Layers } from 'lucide-react';

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        let errorMsg = 'Login failed';
        try {
          const data = await response.json();
          errorMsg = data.message || errorMsg;
        } catch (_) {
          errorMsg = `Server error (Status ${response.status}). Please make sure your backend server is running.`;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      localStorage.setItem('lifetrack_token', data.token);
      onLoginSuccess(data);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split-wrapper">
      
      {/* LEFT SPLIT BANNER (Mockup design layout) */}
      <div className="auth-left-banner">
        <div className="auth-banner-content">
          {/* Logo Group */}
          <div className="auth-logo-group">
            <Layers size={28} style={{ color: '#0f172a' }} />
            <span className="auth-logo-text">DAY TRACKER</span>
          </div>

          {/* Banner bottom graphics */}
          <div className="auth-banner-bottom">
            <span className="auth-banner-label">Your WORK IS HERE</span>
            <h2 className="auth-banner-heading">
              Smart Tools for<br/>
              Smarter Work
            </h2>
            
            <div className="auth-banner-actions">
              {/* Solid Circle Arrow */}
              <button className="auth-banner-btn-circle solid" type="button" aria-label="Explore tools">
                <ArrowUpRight size={20} />
              </button>
              {/* Outline Circle */}
              <button className="auth-banner-btn-circle" type="button" aria-label="Info" style={{ width: '2rem', height: '2rem', borderOpacity: 0.5 }}></button>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT LOGIN FORM */}
      <div className="auth-right-form">
        <div className="auth-form-width">
          <h2 className="auth-title-primary">Welcome Back!</h2>
          <p className="auth-desc-text">
            Log in to access your dashboard, manage your daily routine, and continue securely with full control.
          </p>

          {error && (
            <div style={{ 
              padding: '0.75rem', 
              backgroundColor: 'var(--danger-light)', 
              color: 'var(--danger)', 
              borderRadius: '12px', 
              marginBottom: '1.25rem', 
              fontSize: '0.875rem', 
              fontWeight: 500 
            }}>
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="auth-input-label">Email Address</label>
              <input 
                type="email" 
                className="auth-input-field" 
                placeholder="Enter your email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label className="auth-input-label">Password</label>
              <div style={{ position: 'relative' }}>
                <input 
                  type={showPassword ? 'text' : 'password'} 
                  className="auth-input-field" 
                  placeholder="Enter your password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  style={{ paddingRight: '3rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '1rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            <div className="auth-action-row">
              <label className="auth-checkbox-label">
                <input 
                  type="checkbox" 
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  style={{
                    width: '16px',
                    height: '16px',
                    borderRadius: '4px',
                    accentColor: '#ea580c',
                    cursor: 'pointer'
                  }}
                />
                <span>Remember me</span>
              </label>
              <a href="#forgot" className="auth-link" onClick={(e) => { e.preventDefault(); alert("Local demo: Click register if you need to create a new profile."); }}>
                Forgot Password?
              </a>
            </div>

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Logging in...' : 'Login to Your Space'}
            </button>
          </form>

          <div className="auth-divider">or continue with</div>

          <div style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Don't have an account? <Link to="/register" style={{ color: '#ea580c', fontWeight: 600, textDecoration: 'none' }}>Register</Link>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Login;
