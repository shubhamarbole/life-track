import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Layers, ArrowDown, Activity, Sparkles, Building, Wallet } from 'lucide-react';

const Register = ({ onLoginSuccess }) => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  const canvasRef = useRef(null);
  const navigate = useNavigate();

  // Listen to scroll events
  useEffect(() => {
    const handleScroll = () => {
      setScrollY(window.scrollY);
    };
    const handleResize = () => {
      setWindowHeight(window.innerHeight);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('scroll', handleScroll);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // 3D Particle Background Canvas animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    let animationFrameId;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const handleResize = () => {
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };
    window.addEventListener('resize', handleResize);

    // Particle class representing dots moving in pseudo 3D space
    class Particle {
      constructor() {
        this.reset();
      }

      reset() {
        this.x = (Math.random() - 0.5) * width * 1.5;
        this.y = (Math.random() - 0.5) * height * 1.5;
        this.z = Math.random() * 800 + 200; // Depth coordinate
        this.size = Math.random() * 1.5 + 0.5;
        this.color = Math.random() > 0.5 ? '#8f2ff0' : '#3a2ff0'; // Purple or Blue glow
      }

      update(scrollVelocity) {
        // Particles move forward based on scroll speed
        this.z -= 1.5 + scrollVelocity * 5;
        if (this.z <= 0) {
          this.reset();
        }
      }

      draw() {
        // Perspective projection: map 3D coords to 2D screen
        const fov = 300; // Field of view depth
        const scale = fov / this.z;
        const screenX = this.x * scale + width / 2;
        const screenY = this.y * scale + height / 2;

        if (screenX >= 0 && screenX <= width && screenY >= 0 && screenY <= height) {
          ctx.beginPath();
          ctx.arc(screenX, screenY, this.size * scale, 0, Math.PI * 2);
          ctx.fillStyle = this.color;
          ctx.globalAlpha = Math.min(1, (1000 - this.z) / 800); // Fade out as they get deeper
          ctx.fill();
        }
      }
    }

    const particleCount = 120;
    const particles = Array.from({ length: particleCount }, () => new Particle());

    let lastScrollY = window.scrollY;
    
    const animate = () => {
      ctx.fillStyle = '#070a13';
      ctx.globalAlpha = 1;
      ctx.fillRect(0, 0, width, height);

      // Scroll speed shifts velocity
      const currentScroll = window.scrollY;
      const scrollVelocity = Math.abs(currentScroll - lastScrollY);
      lastScrollY = currentScroll;

      particles.forEach((p) => {
        p.update(scrollVelocity);
        p.draw();
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

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
          errorMsg = `Server error (Status ${response.status}).`;
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

  // Interpolation helper for scroll positions
  const getInterpolation = (start, end, current) => {
    const total = end - start;
    const progress = Math.max(0, Math.min(1, (current - start) / total));
    return progress;
  };

  // CSS Styles for 3D Perspective Layout
  const styles = `
    .perspective-container {
      perspective: 1200px;
      perspective-origin: 50% 50%;
    }
    .floating-3d-dashboard {
      transition: transform 0.1s ease-out;
      transform-style: preserve-3d;
      box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(12px);
    }
    .parallax-feature-card {
      transition: transform 0.1s ease-out;
      transform-style: preserve-3d;
      background: rgba(30, 41, 59, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(8px);
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    }
    .register-form-3d-card {
      transition: transform 0.15s ease-out, opacity 0.15s ease-out;
      transform-style: preserve-3d;
      background: rgba(15, 23, 42, 0.85);
      border: 1px solid rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      box-shadow: 0 40px 80px rgba(0, 0, 0, 0.6);
      border-radius: 24px;
    }
    .custom-scroll-prompt {
      animation: bounce-prompt 2s infinite;
    }
    @keyframes bounce-prompt {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(10px); }
    }
  `;

  // Interpolation progress values
  const section1Progress = getInterpolation(0, windowHeight, scrollY);
  const section2Progress = getInterpolation(windowHeight, windowHeight * 2, scrollY);
  const section3Progress = getInterpolation(windowHeight * 1.8, windowHeight * 2.6, scrollY);

  return (
    <div style={{ position: 'relative', overflowX: 'hidden', backgroundColor: '#070a13', color: '#fff', minHeight: '300vh' }}>
      <style>{styles}</style>
      
      {/* 3D Particle Canvas Background */}
      <canvas 
        ref={canvasRef} 
        style={{ 
          position: 'fixed', 
          top: 0, 
          left: 0, 
          width: '100vw', 
          height: '100vh', 
          zIndex: 1, 
          pointerEvents: 'none' 
        }} 
      />

      <div style={{ position: 'relative', zIndex: 2 }}>
        
        {/* SECTION 1: 3D DASHBOARD PREVIEW (0vh - 100vh) */}
        <section style={{ 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          padding: '2rem',
          position: 'relative'
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', zIndex: 3 }}>
            <Layers size={32} style={{ color: '#8f2ff0' }} />
            <span style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '0.05em' }}>DAYTRACKER</span>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '3rem', zIndex: 3, maxWidth: '600px' }}>
            <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '1rem', letterSpacing: '-0.03em', lineHeight: '1.1' }}>
              Smarter Work.<br/>
              Simpler Tracking.
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: '1.5' }}>
              Scroll down to explore how we monitor metrics in real-time before registering your account.
            </p>
          </div>

          {/* 3D Floating Dashboard Card */}
          <div className="perspective-container" style={{ width: '100%', maxWidth: '580px', height: '240px', zIndex: 3 }}>
            <div 
              className="floating-3d-dashboard" 
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '20px',
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                // Rotates from angled to flat as user scrolls
                transform: `rotateX(${15 - section1Progress * 15}deg) rotateY(${-15 + section1Progress * 15}deg) translateZ(0px) scale(${1 - section1Progress * 0.15})`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8f2ff0', textTransform: 'uppercase' }}>Preview Dashboard</span>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4ade80', boxShadow: '0 0 8px #4ade80' }} />
              </div>

              {/* Simulated UI layout */}
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '12px' }}>
                  <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>DAILY STEPS</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 850, color: '#ff9500' }}>8,450</span>
                </div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '12px' }}>
                  <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>OFFICE HOURS</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 850, color: '#8f2ff0' }}>6h 40m</span>
                </div>
                <div style={{ backgroundColor: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', padding: '0.75rem', borderRadius: '12px' }}>
                  <span style={{ fontSize: '0.65rem', color: '#64748b', display: 'block' }}>SPENDING</span>
                  <span style={{ fontSize: '1.2rem', fontWeight: 850, color: '#34c759' }}>₹1,240</span>
                </div>
              </div>

              <div style={{ height: '3px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '2px', width: '100%', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '70%', backgroundColor: '#8f2ff0' }} />
              </div>
            </div>
          </div>

          {/* Scroll Down Prompt */}
          <div className="custom-scroll-prompt" style={{ position: 'absolute', bottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '0.8rem', zIndex: 3 }}>
            <span>SCROLL DOWN</span>
            <ArrowDown size={16} />
          </div>
        </section>

        {/* SECTION 2: 3D PARALLAX FEATURE CARDS (100vh - 200vh) */}
        <section style={{ 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          padding: '2rem',
          position: 'relative',
        }} className="perspective-container">
          <h2 style={{ fontSize: '2rem', fontWeight: 900, marginBottom: '3rem', textAlign: 'center', letterSpacing: '-0.02em', zIndex: 3 }}>
            Features at a Glance
          </h2>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
            gap: '1.5rem', 
            width: '100%', 
            maxWidth: '850px',
            zIndex: 3
          }}>
            {/* Card 1: Hours */}
            <div 
              className="parallax-feature-card"
              style={{
                borderRadius: '16px',
                padding: '1.5rem',
                transform: `translateY(${100 - section2Progress * 150}px) translateZ(40px) rotateY(10deg)`
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(143, 47, 240, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8f2ff0', marginBottom: '1.5rem' }}>
                <Building size={20} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.5rem' }}>Office Attendance</h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4' }}>
                Automated geofence detection logs entry/exits and expected work durations without clicking.
              </p>
            </div>

            {/* Card 2: Steps */}
            <div 
              className="parallax-feature-card"
              style={{
                borderRadius: '16px',
                padding: '1.5rem',
                transform: `translateY(${180 - section2Progress * 230}px) translateZ(0px) rotateY(0deg)`
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(255, 149, 0, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ff9500', marginBottom: '1.5rem' }}>
                <Activity size={20} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.5rem' }}>Android Sensor Sync</h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4' }}>
                Sync steps securely in background via Apple Shortcuts or native Android Health Connect APIs.
              </p>
            </div>

            {/* Card 3: Money */}
            <div 
              className="parallax-feature-card"
              style={{
                borderRadius: '16px',
                padding: '1.5rem',
                transform: `translateY(${60 - section2Progress * 110}px) translateZ(-40px) rotateY(-10deg)`
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(52, 199, 89, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#34c759', marginBottom: '1.5rem' }}>
                <Wallet size={20} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.5rem' }}>Budget Tracking</h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4' }}>
                Track daily and monthly spendings, categorize lists dynamically, and manage limits.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 3: 3D FORM CARD TRANSITION (200vh - 300vh) */}
        <section style={{ 
          height: '100vh', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          padding: '2rem',
          position: 'relative'
        }} className="perspective-container">
          
          <div 
            className="register-form-3d-card"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '2rem',
              zIndex: 3,
              opacity: section3Progress,
              // Pivots forward: starts at -25deg backward tilt and aligns flat as user reaches bottom
              transform: `rotateX(${-25 + section3Progress * 25}deg) translateZ(${-150 + section3Progress * 150}px) translateY(${100 - section3Progress * 100}px)`
            }}
          >
            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', marginBottom: '0.75rem', justifyContent: 'center' }}>
              <Sparkles size={20} style={{ color: '#8f2ff0' }} />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>Register Account</h2>
            </div>
            
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              Get started with LifeTrack today and synchronize your smart office routines.
            </p>

            {error && (
              <div style={{ 
                padding: '0.75rem', 
                backgroundColor: 'rgba(255, 59, 48, 0.1)', 
                color: '#ff453a', 
                borderRadius: '10px', 
                marginBottom: '1rem', 
                fontSize: '0.8rem', 
                fontWeight: 600,
                border: '1px solid rgba(255, 59, 48, 0.2)' 
              }}>
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>Full Name</label>
                <input 
                  type="text" 
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.9rem',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                  placeholder="Enter your name" 
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>Email Address</label>
                <input 
                  type="email" 
                  style={{
                    width: '100%',
                    padding: '0.7rem 0.9rem',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255,255,255,0.03)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    color: '#fff',
                    fontSize: '0.85rem',
                    outline: 'none'
                  }}
                  placeholder="Enter your email" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>

              <div>
                <label style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', display: 'block', marginBottom: '0.35rem' }}>Password</label>
                <div style={{ position: 'relative' }}>
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    style={{
                      width: '100%',
                      padding: '0.7rem 2.8rem 0.7rem 0.9rem',
                      borderRadius: '10px',
                      backgroundColor: 'rgba(255,255,255,0.03)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      color: '#fff',
                      fontSize: '0.85rem',
                      outline: 'none'
                    }}
                    placeholder="Create a strong password" 
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '0.85rem',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: '#64748b',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <button 
                  type="submit" 
                  style={{ 
                    width: '100%', 
                    padding: '0.8rem', 
                    fontSize: '0.9rem', 
                    fontWeight: 700, 
                    borderRadius: '10px', 
                    border: 'none', 
                    background: 'linear-gradient(to right, #8f2ff0, #3a2ff0)', 
                    color: '#fff', 
                    cursor: 'pointer',
                    boxShadow: '0 8px 16px rgba(143, 47, 240, 0.2)'
                  }}
                  disabled={loading}
                >
                  {loading ? 'Creating Account...' : 'Register Space'}
                </button>
              </div>
            </form>

            <div style={{ margin: '1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.75rem' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.05)' }}></div>
              <span>OR</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.05)' }}></div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
              Already registered? <Link to="/login" style={{ color: '#8f2ff0', fontWeight: 700, textDecoration: 'none' }}>Login instead</Link>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default Register;
