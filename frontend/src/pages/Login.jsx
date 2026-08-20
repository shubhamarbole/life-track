import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Layers, ArrowDown, Activity, Sparkles, Building, Wallet } from 'lucide-react';

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [scrollY, setScrollY] = useState(0);
  const [windowHeight, setWindowHeight] = useState(window.innerHeight);

  const canvasRef = useRef(null);
  const navigate = useNavigate();

  // Load rememberMe email on mount if exists
  useEffect(() => {
    const savedEmail = localStorage.getItem('lifetrack_remembered_email');
    if (savedEmail) {
      setEmail(savedEmail);
      setRememberMe(true);
    }
  }, []);

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

  // Canvas Walking & Cycling background loop
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

    const groundY = height * 0.85;
    let tick = 0;

    // Background Hill layers for parallax depth
    const hills = [
      { color: '#090c15', speed: 0.1, amplitude: 25, wavelength: 260, offset: 0 },
      { color: '#0f1322', speed: 0.2, amplitude: 15, wavelength: 190, offset: 40 },
      { color: '#161b2e', speed: 0.4, amplitude: 8, wavelength: 130, offset: 80 }
    ];

    // Pedestrian object
    class Pedestrian {
      constructor(direction = 1) {
        this.dir = direction; // 1 = left to right, -1 = right to left
        this.reset();
        this.x = Math.random() * width;
      }

      reset() {
        this.x = this.dir === 1 ? -40 : width + 40;
        this.speed = Math.random() * 0.5 + 0.5;
        this.scale = Math.random() * 0.15 + 0.8;
        this.color = Math.random() > 0.5 ? '#a855f7' : '#6366f1';
        this.bobOffset = Math.random() * Math.PI;
      }

      update() {
        this.x += this.speed * this.dir;
        if (this.dir === 1 && this.x > width + 40) this.reset();
        if (this.dir === -1 && this.x < -40) this.reset();
      }

      draw() {
        ctx.save();
        ctx.translate(this.x, groundY);
        ctx.scale(this.scale, this.scale);

        const cycle = tick * 0.08 + this.bobOffset;
        const bob = Math.abs(Math.sin(cycle * 2)) * 2;

        ctx.strokeStyle = this.color;
        ctx.fillStyle = this.color;
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Head
        ctx.beginPath();
        ctx.arc(0, -60 + bob, 5.5, 0, Math.PI * 2);
        ctx.fill();

        // Torso
        ctx.beginPath();
        ctx.moveTo(0, -54 + bob);
        ctx.lineTo(0, -26 + bob);
        ctx.stroke();

        // Arms
        const leftArmSwing = Math.sin(cycle) * 12;
        ctx.beginPath();
        ctx.moveTo(0, -48 + bob);
        ctx.lineTo(leftArmSwing, -30 + bob);
        ctx.stroke();

        const rightArmSwing = -Math.sin(cycle) * 12;
        ctx.beginPath();
        ctx.moveTo(0, -48 + bob);
        ctx.lineTo(rightArmSwing, -30 + bob);
        ctx.stroke();

        // Legs
        const leftLegSwing = Math.sin(cycle) * 14;
        ctx.beginPath();
        ctx.moveTo(0, -26 + bob);
        ctx.lineTo(leftLegSwing, 0);
        ctx.stroke();

        const rightLegSwing = -Math.sin(cycle) * 14;
        ctx.beginPath();
        ctx.moveTo(0, -26 + bob);
        ctx.lineTo(rightLegSwing, 0);
        ctx.stroke();

        ctx.restore();
      }
    }

    // Cyclist object
    class Cyclist {
      constructor() {
        this.reset();
        this.x = Math.random() * width;
      }

      reset() {
        this.x = -60;
        this.speed = Math.random() * 1.0 + 1.6;
        this.scale = Math.random() * 0.12 + 0.85;
        this.color = '#8f2ff0';
        this.wheelColor = '#475569';
      }

      update() {
        this.x += this.speed;
        if (this.x > width + 60) this.reset();
      }

      draw() {
        ctx.save();
        ctx.translate(this.x, groundY);
        ctx.scale(this.scale, this.scale);

        const wheelRad = 12;
        const rearWheelX = -20;
        const frontWheelX = 20;
        const bottomBracketX = 0;
        const saddleX = -8;
        const handlebarX = 14;

        ctx.lineWidth = 2.2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Wheels (Spokes)
        const spinAngle = tick * 0.2;
        [rearWheelX, frontWheelX].forEach((wX) => {
          ctx.beginPath();
          ctx.arc(wX, -wheelRad, wheelRad, 0, Math.PI * 2);
          ctx.strokeStyle = this.wheelColor;
          ctx.stroke();

          for (let i = 0; i < 4; i++) {
            const angle = spinAngle + (i * Math.PI) / 4;
            ctx.beginPath();
            ctx.moveTo(wX, -wheelRad);
            ctx.lineTo(wX + Math.cos(angle) * wheelRad, -wheelRad + Math.sin(angle) * wheelRad);
            ctx.stroke();
          }
        });

        // Frame
        ctx.strokeStyle = '#94a3b8';
        ctx.beginPath();
        ctx.moveTo(rearWheelX, -wheelRad);
        ctx.lineTo(bottomBracketX, -wheelRad);
        ctx.lineTo(saddleX, -30);
        ctx.lineTo(rearWheelX, -wheelRad);
        ctx.moveTo(bottomBracketX, -wheelRad);
        ctx.lineTo(handlebarX, -36);
        ctx.moveTo(saddleX, -30);
        ctx.lineTo(handlebarX, -36);
        ctx.moveTo(handlebarX, -36);
        ctx.lineTo(frontWheelX, -wheelRad);
        ctx.stroke();

        // Saddle
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(saddleX - 5, -32, 10, 2.5);

        // Handlebars
        ctx.beginPath();
        ctx.moveTo(handlebarX, -36);
        ctx.lineTo(handlebarX + 3, -38);
        ctx.stroke();

        // Rider
        ctx.strokeStyle = this.color;
        ctx.fillStyle = this.color;
        ctx.lineWidth = 3.2;

        const riderBob = Math.sin(tick * 0.14) * 1.2;
        ctx.beginPath();
        ctx.arc(-4, -50 + riderBob, 5, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(-6, -30);
        ctx.lineTo(-4, -45 + riderBob);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(-4, -42 + riderBob);
        ctx.lineTo(handlebarX, -36);
        ctx.stroke();

        const pedalAngle = tick * 0.14;
        const pedalX = Math.cos(pedalAngle) * 4.5;
        const pedalY = Math.sin(pedalAngle) * 4.5 - wheelRad;

        ctx.beginPath();
        ctx.moveTo(-6, -30);
        ctx.lineTo(-2 + Math.cos(pedalAngle) * 2.5, -18);
        ctx.lineTo(pedalX, pedalY);
        ctx.stroke();

        ctx.restore();
      }
    }

    const pedestrians = [
      new Pedestrian(1),
      new Pedestrian(1),
      new Pedestrian(-1)
    ];
    const cyclist = new Cyclist();

    const animate = () => {
      // Sky backdrop
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, '#060814');
      skyGrad.addColorStop(1, '#0e1122');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      tick++;

      // Parallax Hills
      hills.forEach((h, layerIdx) => {
        ctx.fillStyle = h.color;
        ctx.beginPath();
        ctx.moveTo(0, height);

        for (let x = 0; x <= width; x += 12) {
          const wave = Math.sin((x + tick * h.speed + h.offset) / h.wavelength) * h.amplitude;
          ctx.lineTo(x, groundY - 35 * (3 - layerIdx) + wave);
        }

        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
      });

      // Ground path
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(width, groundY);
      ctx.stroke();

      // Draw Actors
      pedestrians.forEach((p) => {
        p.update();
        p.draw();
      });

      cyclist.update();
      cyclist.draw();

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
          errorMsg = `Server error. Please verify connections.`;
        }
        throw new Error(errorMsg);
      }

      const data = await response.json();
      localStorage.setItem('lifetrack_token', data.token);

      if (rememberMe) {
        localStorage.setItem('lifetrack_remembered_email', email);
      } else {
        localStorage.removeItem('lifetrack_remembered_email');
      }

      onLoginSuccess(data);
      navigate('/');
    } catch (err) {
      setError(err.message || 'Invalid email or password');
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

  // 3D Perspective CSS Class definitions
  const styles = `
    .perspective-container {
      perspective: 1200px;
      perspective-origin: 50% 50%;
    }
    .floating-3d-card {
      transition: transform 0.1s ease-out;
      transform-style: preserve-3d;
      box-shadow: 0 30px 60px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.08);
      background: rgba(15, 23, 42, 0.75);
      backdrop-filter: blur(12px);
    }
    .parallax-detail-card {
      transition: transform 0.1s ease-out;
      transform-style: preserve-3d;
      background: rgba(30, 41, 59, 0.5);
      border: 1px solid rgba(255, 255, 255, 0.06);
      backdrop-filter: blur(8px);
      box-shadow: 0 20px 40px rgba(0,0,0,0.3);
    }
    .login-form-3d-card {
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

  // Interpolation ranges
  const section1Progress = getInterpolation(0, windowHeight, scrollY);
  const section2Progress = getInterpolation(windowHeight, windowHeight * 2, scrollY);
  const section3Progress = getInterpolation(windowHeight * 1.8, windowHeight * 2.6, scrollY);

  return (
    <div style={{ position: 'relative', overflowX: 'hidden', backgroundColor: '#060814', color: '#fff', minHeight: '300vh' }}>
      <style>{styles}</style>
      
      {/* Animated Walking & Cycling Canvas Scenery (Fixed Background) */}
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
        
        {/* SECTION 1: WELCOME & LOGO (0vh - 100vh) */}
        <section style={{ 
          height: '100vh', 
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'center', 
          alignItems: 'center', 
          padding: '2rem',
          position: 'relative'
        }}>
          {/* Logo Group */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '2rem', zIndex: 3 }}>
            <Layers size={32} style={{ color: '#8f2ff0' }} />
            <span style={{ fontSize: '1.5rem', fontWeight: 900, letterSpacing: '0.05em' }}>DAYTRACKER</span>
          </div>

          <div style={{ textAlign: 'center', marginBottom: '3rem', zIndex: 3, maxWidth: '600px' }}>
            <h1 style={{ fontSize: '3rem', fontWeight: 900, marginBottom: '1rem', letterSpacing: '-0.03em', lineHeight: '1.1' }}>
              Welcome Back.<br/>
              Pedal Forward.
            </h1>
            <p style={{ color: '#94a3b8', fontSize: '1rem', lineHeight: '1.5' }}>
              Scroll down to log back into your tracking space and sync your sensors.
            </p>
          </div>

          {/* 3D Floating Security Shield Card */}
          <div className="perspective-container" style={{ width: '100%', maxWidth: '580px', height: '240px', zIndex: 3 }}>
            <div 
              className="floating-3d-card" 
              style={{
                width: '100%',
                height: '100%',
                borderRadius: '20px',
                padding: '2rem',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                // Angle turns flat as you scroll down
                transform: `rotateX(${15 - section1Progress * 15}deg) rotateY(${-15 + section1Progress * 15}deg) translateZ(0px) scale(${1 - section1Progress * 0.15})`
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#8f2ff0', textTransform: 'uppercase' }}>Secure Authentication</span>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#8f2ff0', boxShadow: '0 0 8px #8f2ff0' }} />
              </div>

              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, marginBottom: '0.5rem' }}>Protected Dashboard Space</h3>
                <p style={{ fontSize: '0.8rem', color: '#64748b', lineHeight: '1.4', margin: 0 }}>
                  Enter your credentials below to access geofence logs, focus lists, step statistics, and expenses.
                </p>
              </div>

              <div style={{ height: '3px', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: '2px', width: '100%', overflow: 'hidden' }}>
                <div style={{ height: '100%', width: '100%', background: 'linear-gradient(to right, #8f2ff0, #3a2ff0)' }} />
              </div>
            </div>
          </div>

          {/* Scroll Down Prompt */}
          <div className="custom-scroll-prompt" style={{ position: 'absolute', bottom: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem', color: '#94a3b8', fontSize: '0.8rem', zIndex: 3 }}>
            <span>SCROLL DOWN TO LOGIN</span>
            <ArrowDown size={16} />
          </div>
        </section>

        {/* SECTION 2: PARALLAX SECURITY DETAILS (100vh - 200vh) */}
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
            Continuous Cloud Sync
          </h2>

          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', 
            gap: '1.5rem', 
            width: '100%', 
            maxWidth: '850px',
            zIndex: 3
          }}>
            {/* Detail Card 1 */}
            <div 
              className="parallax-detail-card"
              style={{
                borderRadius: '16px',
                padding: '1.5rem',
                transform: `translateY(${100 - section2Progress * 150}px) translateZ(40px) rotateY(10deg)`
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(143, 47, 240, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8f2ff0', marginBottom: '1.5rem' }}>
                <Building size={20} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.5rem' }}>Geofence Logs</h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4' }}>
                Access logs and statistics calculated from automatic entry and exits on active devices.
              </p>
            </div>

            {/* Detail Card 2 */}
            <div 
              className="parallax-detail-card"
              style={{
                borderRadius: '16px',
                padding: '1.5rem',
                transform: `translateY(${180 - section2Progress * 230}px) translateZ(0px) rotateY(0deg)`
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(143, 47, 240, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8f2ff0', marginBottom: '1.5rem' }}>
                <Activity size={20} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.5rem' }}>MQTT Telemetry</h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4' }}>
                Real-time steps updating from smartwatches and automated scripts via lightweight pub/sub.
              </p>
            </div>

            {/* Detail Card 3 */}
            <div 
              className="parallax-detail-card"
              style={{
                borderRadius: '16px',
                padding: '1.5rem',
                transform: `translateY(${60 - section2Progress * 110}px) translateZ(-40px) rotateY(-10deg)`
              }}
            >
              <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: 'rgba(143, 47, 240, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8f2ff0', marginBottom: '1.5rem' }}>
                <Wallet size={20} />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 800, marginBottom: '0.5rem' }}>Secure Databases</h3>
              <p style={{ fontSize: '0.8rem', color: '#94a3b8', lineHeight: '1.4' }}>
                All transaction logs, budget categories, and step arrays stored on secure Atlas clusters.
              </p>
            </div>
          </div>
        </section>

        {/* SECTION 3: LOGIN FORM CARD ROLL-IN (200vh - 300vh) */}
        <section style={{ 
          height: '100vh', 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          padding: '2rem',
          position: 'relative'
        }} className="perspective-container">
          
          <div 
            className="login-form-3d-card"
            style={{
              width: '100%',
              maxWidth: '460px',
              padding: '2rem',
              zIndex: 3,
              opacity: section3Progress,
              // Pivots forward: starts tilted back, aligns flat as scroll approaches bottom
              transform: `rotateX(${-25 + section3Progress * 25}deg) translateZ(${-150 + section3Progress * 150}px) translateY(${100 - section3Progress * 100}px)`
            }}
          >
            <div style={{ display: 'flex', gap: '0.45rem', alignItems: 'center', marginBottom: '0.75rem', justifyContent: 'center' }}>
              <Sparkles size={20} style={{ color: '#8f2ff0' }} />
              <h2 style={{ fontSize: '1.5rem', fontWeight: 900, margin: 0, letterSpacing: '-0.02em' }}>Secure Login</h2>
            </div>
            
            <p style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', marginBottom: '1.5rem', lineHeight: '1.4' }}>
              Sign back in to access your tracking space and AI voice assistants.
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
                    placeholder="Enter your password" 
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

              {/* Action row with rememberMe check */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', marginTop: '0.25rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', cursor: 'pointer', color: '#94a3b8' }}>
                  <input 
                    type="checkbox" 
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{
                      width: '15px',
                      height: '15px',
                      borderRadius: '4px',
                      accentColor: '#8f2ff0',
                      cursor: 'pointer'
                    }}
                  />
                  <span>Remember me</span>
                </label>
                <a 
                  href="#forgot" 
                  style={{ color: '#8f2ff0', textDecoration: 'none', fontWeight: 600 }}
                  onClick={(e) => { e.preventDefault(); alert("Local demo: Click Register below if you need to create a new profile."); }}
                >
                  Forgot Password?
                </a>
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
                  {loading ? 'Logging in...' : 'Login to Your Space'}
                </button>
              </div>
            </form>

            <div style={{ margin: '1rem 0', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#64748b', fontSize: '0.75rem' }}>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.05)' }}></div>
              <span>OR</span>
              <div style={{ flex: 1, height: '1px', backgroundColor: 'rgba(255,255,255,0.05)' }}></div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '0.8rem', color: '#94a3b8' }}>
              Don't have an account? <Link to="/register" style={{ color: '#8f2ff0', fontWeight: 700, textDecoration: 'none' }}>Register instead</Link>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default Login;
