import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, ArrowUpRight, Layers } from 'lucide-react';

const Register = ({ onLoginSuccess }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name || !email || !password) {
      setError('Please fill in all fields.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      });

      if (!response.ok) {
        let errorMsg = 'Registration failed';
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
      setError(err.message || 'Registration failed. Try again.');
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

      {/* RIGHT REGISTER FORM */}
      <div className="auth-right-form">
        <div className="auth-form-width">
          <h2 className="auth-title-primary">Get Started</h2>
          <p className="auth-desc-text">
            Create an account to start tracking office routines, walking sensors syncs, work metrics, and daily budgets.
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
              <label className="auth-input-label">Full Name</label>
              <input 
                type="text" 
                className="auth-input-field" 
                placeholder="Enter your full name" 
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

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
                  placeholder="Create a strong password" 
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

            <div style={{ marginTop: '1.5rem', marginBottom: '1.5rem' }}>
              <button type="submit" className="auth-submit-btn" disabled={loading}>
                {loading ? 'Creating Account...' : 'Register Your Space'}
              </button>
            </div>
          </form>

          <div className="auth-divider">or continue with</div>

          <div style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Already have an account? <Link to="/login" style={{ color: '#ea580c', fontWeight: 600, textDecoration: 'none' }}>Login</Link>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Register;
