import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Layers, Sparkles } from 'lucide-react';

const Login = ({ onLoginSuccess }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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

  // Canvas Walking & Cycling loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    let animationFrameId;
    let width = (canvas.width = canvas.parentElement.offsetWidth || 500);
    let height = (canvas.height = canvas.parentElement.offsetHeight || 600);

    const handleResize = () => {
      if (canvas.parentElement) {
        width = canvas.width = canvas.parentElement.offsetWidth;
        height = canvas.height = canvas.parentElement.offsetHeight;
      }
    };
    window.addEventListener('resize', handleResize);

    const groundY = height * 0.82;
    let tick = 0;

    // Background Hill layers for parallax depth
    const hills = [
      { color: '#0d111d', speed: 0.1, amplitude: 30, wavelength: 250, offset: 0 },
      { color: '#131929', speed: 0.25, amplitude: 20, wavelength: 180, offset: 50 },
      { color: '#1a2238', speed: 0.5, amplitude: 10, wavelength: 120, offset: 100 }
    ];

    // Pedestrian object
    class Pedestrian {
      constructor(direction = 1) {
        this.dir = direction; // 1 = left to right, -1 = right to left
        this.reset();
        // Distribute them initially
        this.x = Math.random() * width;
      }

      reset() {
        this.x = this.dir === 1 ? -40 : width + 40;
        this.speed = Math.random() * 0.6 + 0.6;
        this.scale = Math.random() * 0.2 + 0.8;
        this.color = Math.random() > 0.5 ? '#a855f7' : '#6366f1'; // Purple/Indigo
        this.bobOffset = Math.random() * Math.PI;
      }

      update() {
        this.x += this.speed * this.dir;
        // Reset when walking off canvas boundary
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
        ctx.lineWidth = 3.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // Head
        ctx.beginPath();
        ctx.arc(0, -62 + bob, 6, 0, Math.PI * 2);
        ctx.fill();

        // Torso
        ctx.beginPath();
        ctx.moveTo(0, -56 + bob);
        ctx.lineTo(0, -28 + bob);
        ctx.stroke();

        // Arms (swinging in anti-phase to legs)
        const leftArmSwing = Math.sin(cycle) * 14;
        ctx.beginPath();
        ctx.moveTo(0, -50 + bob);
        ctx.lineTo(leftArmSwing, -32 + bob);
        ctx.stroke();

        const rightArmSwing = -Math.sin(cycle) * 14;
        ctx.beginPath();
        ctx.moveTo(0, -50 + bob);
        ctx.lineTo(rightArmSwing, -32 + bob);
        ctx.stroke();

        // Legs (walking swing)
        const leftLegSwing = Math.sin(cycle) * 16;
        ctx.beginPath();
        ctx.moveTo(0, -28 + bob);
        ctx.lineTo(leftLegSwing, 0);
        ctx.stroke();

        const rightLegSwing = -Math.sin(cycle) * 16;
        ctx.beginPath();
        ctx.moveTo(0, -28 + bob);
        ctx.lineTo(rightLegSwing, 0);
        ctx.stroke();

        ctx.restore();
      }
    }

    // Cyclist object
    class Cyclist {
      constructor() {
        this.reset();
        this.x = Math.random() * width; // distribute initially
      }

      reset() {
        this.x = -60;
        this.speed = Math.random() * 1.2 + 1.8; // Faster than pedestrians
        this.scale = Math.random() * 0.15 + 0.85;
        this.color = '#8f2ff0'; // Core signature violet theme
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

        const wheelRad = 13;
        const rearWheelX = -22;
        const frontWheelX = 22;
        const bottomBracketX = 0;
        const saddleX = -8;
        const handlebarX = 16;

        ctx.lineWidth = 2.5;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';

        // 1. Draw spinning wheels (Spokes)
        const spinAngle = tick * 0.22;
        [rearWheelX, frontWheelX].forEach((wX) => {
          ctx.beginPath();
          ctx.arc(wX, -wheelRad, wheelRad, 0, Math.PI * 2);
          ctx.strokeStyle = this.wheelColor;
          ctx.stroke();

          // Spokes
          for (let i = 0; i < 4; i++) {
            const angle = spinAngle + (i * Math.PI) / 4;
            ctx.beginPath();
            ctx.moveTo(wX, -wheelRad);
            ctx.lineTo(wX + Math.cos(angle) * wheelRad, -wheelRad + Math.sin(angle) * wheelRad);
            ctx.stroke();
          }
        });

        // 2. Bicycle frame
        ctx.strokeStyle = '#94a3b8';
        ctx.beginPath();
        // Rear axle -> Bottom Bracket -> Chainstay
        ctx.moveTo(rearWheelX, -wheelRad);
        ctx.lineTo(bottomBracketX, -wheelRad);
        // Bottom Bracket -> Saddle post
        ctx.lineTo(saddleX, -32);
        // Saddle post -> Rear axle -> Seat stay
        ctx.lineTo(rearWheelX, -wheelRad);
        // Bottom Bracket -> Headtube -> Down tube
        ctx.moveTo(bottomBracketX, -wheelRad);
        ctx.lineTo(handlebarX, -38);
        // Saddle post -> Headtube -> Top tube
        ctx.moveTo(saddleX, -32);
        ctx.lineTo(handlebarX, -38);
        // Fork to front wheel
        ctx.moveTo(handlebarX, -38);
        ctx.lineTo(frontWheelX, -wheelRad);
        ctx.stroke();

        // Saddle
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(saddleX - 6, -34, 12, 3);

        // Handlebars
        ctx.beginPath();
        ctx.moveTo(handlebarX, -38);
        ctx.lineTo(handlebarX + 4, -40);
        ctx.stroke();

        // 3. Draw Rider (pedaling leg mechanics)
        ctx.strokeStyle = this.color;
        ctx.fillStyle = this.color;
        ctx.lineWidth = 3.5;

        // Head (leaning slightly forward)
        const riderBob = Math.sin(tick * 0.15) * 1.5;
        ctx.beginPath();
        ctx.arc(-4, -54 + riderBob, 5.5, 0, Math.PI * 2);
        ctx.fill();

        // Torso
        ctx.beginPath();
        ctx.moveTo(-6, -32);
        ctx.lineTo(-4, -48 + riderBob);
        ctx.stroke();

        // Arm reaching to handle bars
        ctx.beginPath();
        ctx.moveTo(-4, -45 + riderBob);
        ctx.lineTo(handlebarX, -38);
        ctx.stroke();

        // Leg pedaling loop using dynamic sine/cosine pedal geometry
        const pedalAngle = tick * 0.15;
        const pedalX = Math.cos(pedalAngle) * 5;
        const pedalY = Math.sin(pedalAngle) * 5 - wheelRad;

        // Draw active leg from hip to knee to pedal
        ctx.beginPath();
        ctx.moveTo(-6, -32); // Hip
        ctx.lineTo(-2 + Math.cos(pedalAngle) * 3, -20); // Knee
        ctx.lineTo(pedalX, pedalY); // Foot on pedal
        ctx.stroke();

        ctx.restore();
      }
    }

    // Initialize walkers and riders
    const pedestrians = [
      new Pedestrian(1),
      new Pedestrian(1),
      new Pedestrian(-1)
    ];
    const cyclist = new Cyclist();

    const animate = () => {
      // Background gradient
      const skyGrad = ctx.createLinearGradient(0, 0, 0, height);
      skyGrad.addColorStop(0, '#060814');
      skyGrad.addColorStop(1, '#0e1122');
      ctx.fillStyle = skyGrad;
      ctx.fillRect(0, 0, width, height);

      tick++;

      // 1. Draw Parallax Hills
      hills.forEach((h, layerIdx) => {
        ctx.fillStyle = h.color;
        ctx.beginPath();
        ctx.moveTo(0, height);

        for (let x = 0; x <= width; x += 10) {
          const wave = Math.sin((x + tick * h.speed + h.offset) / h.wavelength) * h.amplitude;
          ctx.lineTo(x, groundY - 40 * (3 - layerIdx) + wave);
        }

        ctx.lineTo(width, height);
        ctx.closePath();
        ctx.fill();
      });

      // 2. Draw ground/road line
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, groundY);
      ctx.lineTo(width, groundY);
      ctx.stroke();

      // 3. Update & Draw Actors
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
          errorMsg = `Server error. Check backend connection.`;
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

  return (
    <div className="auth-split-wrapper">
      
      {/* LEFT ANIMATED CANVAS BANNER */}
      <div className="auth-left-banner" style={{ position: 'relative', overflow: 'hidden' }}>
        <canvas 
          ref={canvasRef} 
          style={{ 
            position: 'absolute', 
            top: 0, 
            left: 0, 
            width: '100%', 
            height: '100%', 
            zIndex: 1 
          }} 
        />

        <div className="auth-banner-content" style={{ position: 'relative', zIndex: 2 }}>
          {/* Logo Group */}
          <div className="auth-logo-group">
            <Layers size={28} style={{ color: '#8f2ff0' }} />
            <span className="auth-logo-text" style={{ color: '#fff' }}>DAY TRACKER</span>
          </div>

          {/* Banner bottom graphics */}
          <div className="auth-banner-bottom">
            <span className="auth-banner-label" style={{ color: '#8f2ff0', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
              <Sparkles size={14} /> ACTIVE TELEMETRY
            </span>
            <h2 className="auth-banner-heading" style={{ color: '#fff', fontSize: '2rem', fontWeight: 800 }}>
              Track Routines,<br/>
              Pedal Forward.
            </h2>
          </div>
        </div>
      </div>

      {/* RIGHT LOGIN FORM */}
      <div className="auth-right-form">
        <div className="auth-form-width">
          <h2 className="auth-title-primary">Welcome Back!</h2>
          <p className="auth-desc-text">
            Log in to access your dashboard, monitor daily activity, and manage your focus work limits.
          </p>

          {error && (
            <div style={{ 
              padding: '0.75rem', 
              backgroundColor: 'rgba(255, 59, 48, 0.1)', 
              color: '#ff453a', 
              borderRadius: '12px', 
              marginBottom: '1.25rem', 
              fontSize: '0.875rem', 
              fontWeight: 500,
              border: '1px solid rgba(255, 59, 48, 0.2)'
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
                    accentColor: '#8f2ff0',
                    cursor: 'pointer'
                  }}
                />
                <span>Remember me</span>
              </label>
              <a href="#forgot" className="auth-link" style={{ color: '#8f2ff0' }} onClick={(e) => { e.preventDefault(); alert("Click register to create a new profile."); }}>
                Forgot Password?
              </a>
            </div>

            <button 
              type="submit" 
              className="auth-submit-btn" 
              style={{ background: 'linear-gradient(to right, #8f2ff0, #3a2ff0)', border: 'none', color: '#fff', boxShadow: '0 8px 16px rgba(143,47,240,0.2)' }}
              disabled={loading}
            >
              {loading ? 'Logging in...' : 'Login to Your Space'}
            </button>
          </form>

          <div className="auth-divider">or continue with</div>

          <div style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
            Don't have an account? <Link to="/register" style={{ color: '#8f2ff0', fontWeight: 600, textDecoration: 'none' }}>Register</Link>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Login;
