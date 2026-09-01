import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, ChevronDown } from 'lucide-react';
import { PHASES } from './phases';
import './landing.css';

const PHOTO_SRC = '/photo.png';
const TRANSITION_MS = 650;
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';
const LAST_INDEX = PHASES.length - 1;

// Dynamic character stances across phases of the day
const PHASE_STANCES = [
  { x: 0, y: 0, scale: 1, rotate: 0 },          // Morning: Centered, upright, fresh
  { x: 32, y: -10, scale: 1.04, rotate: 1.2 },  // Midday: Shifted right, energetic focus
  { x: -32, y: 8, scale: 1.02, rotate: -1.4 },  // Evening: Shifted left, relaxed stance
  { x: 0, y: 16, scale: 0.98, rotate: 0.8 },    // Night: Grounded, restful pose
];

export default function LandingHero({ active, onReachEnd }) {
  const [index, setIndex] = useState(0);
  const [popped, setPopped] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const [scrollPhysics, setScrollPhysics] = useState({ y: 0, rotate: 0, scale: 1 });

  const containerRef = useRef(null);
  const lockRef = useRef(false);
  const indexRef = useRef(0);
  const wheelAccum = useRef(0);
  const touchX = useRef(null);
  const touchStartY = useRef(null);
  const decayRafRef = useRef(null);

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  useEffect(() => {
    return () => {
      if (decayRafRef.current) cancelAnimationFrame(decayRafRef.current);
    };
  }, []);

  // Preload photo
  useEffect(() => {
    const img = new Image();
    img.src = PHOTO_SRC;
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 640);
    check();
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  const navigate = useCallback(
    (dir) => {
      if (lockRef.current) return;
      const current = indexRef.current;

      if (dir === 'next' && current === LAST_INDEX) {
        lockRef.current = true;
        onReachEnd();
        return;
      }
      if (dir === 'prev' && current === 0) {
        return;
      }

      lockRef.current = true;
      setPopped(false);
      setIndex((prev) => (dir === 'next' ? prev + 1 : prev - 1));
      window.setTimeout(() => setPopped(true), 30);
      window.setTimeout(() => {
        lockRef.current = false;
      }, TRANSITION_MS);
    },
    [onReachEnd]
  );

  // Real-time scroll physics + 3D carousel navigation
  useEffect(() => {
    if (!active) return;
    const el = containerRef.current;
    if (!el) return;

    const onWheel = (e) => {
      e.preventDefault();

      // Real-time reactive scroll displacement
      setScrollPhysics((prev) => {
        const nextY = Math.max(-55, Math.min(55, prev.y + e.deltaY * 0.22));
        const nextRot = Math.max(-3.5, Math.min(3.5, nextY * 0.05));
        const nextScale = Math.max(0.95, Math.min(1.05, 1 - Math.abs(nextY) * 0.0008));
        return { y: nextY, rotate: nextRot, scale: nextScale };
      });

      // Physics spring dampening back to rest
      if (decayRafRef.current) cancelAnimationFrame(decayRafRef.current);
      const damp = () => {
        setScrollPhysics((prev) => {
          if (Math.abs(prev.y) < 0.3) return { y: 0, rotate: 0, scale: 1 };
          decayRafRef.current = requestAnimationFrame(damp);
          return {
            y: prev.y * 0.88,
            rotate: prev.rotate * 0.88,
            scale: 1 + (prev.scale - 1) * 0.88,
          };
        });
      };
      decayRafRef.current = requestAnimationFrame(damp);

      wheelAccum.current += e.deltaY;
      if (Math.abs(wheelAccum.current) < 28) return;
      navigate(wheelAccum.current > 0 ? 'next' : 'prev');
      wheelAccum.current = 0;
    };

    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [active, navigate]);

  useEffect(() => {
    if (!active) return;
    const onKey = (e) => {
      if (e.key === 'ArrowRight' || e.key === 'ArrowDown') navigate('next');
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') navigate('prev');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [active, navigate]);

  useEffect(() => {
    if (active) lockRef.current = false;
  }, [active]);

  const onTouchStart = (e) => {
    if (!active) return;
    touchX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  };

  const onTouchMove = (e) => {
    if (!active || touchX.current === null) return;
    const dx = e.touches[0].clientX - touchX.current;
    const dy = touchStartY.current !== null ? e.touches[0].clientY - touchStartY.current : 0;
    setScrollPhysics({
      y: Math.max(-45, Math.min(45, -dy * 0.25)),
      rotate: Math.max(-3, Math.min(3, -dx * 0.04)),
      scale: 1,
    });
  };

  const onTouchEnd = (e) => {
    if (!active || touchX.current === null) return;
    const dx = e.changedTouches[0].clientX - touchX.current;
    const dy = touchStartY.current !== null ? e.changedTouches[0].clientY - touchStartY.current : 0;

    if (Math.abs(dx) > 35) {
      navigate(dx < 0 ? 'next' : 'prev');
    } else if (dy < -50 && index === LAST_INDEX) {
      navigate('next');
    }
    touchX.current = null;
    touchStartY.current = null;

    // Damp scroll physics
    if (decayRafRef.current) cancelAnimationFrame(decayRafRef.current);
    const damp = () => {
      setScrollPhysics((prev) => {
        if (Math.abs(prev.y) < 0.3) return { y: 0, rotate: 0, scale: 1 };
        decayRafRef.current = requestAnimationFrame(damp);
        return {
          y: prev.y * 0.88,
          rotate: prev.rotate * 0.88,
          scale: 1 + (prev.scale - 1) * 0.88,
        };
      });
    };
    decayRafRef.current = requestAnimationFrame(damp);
  };

  const onMouseMove = (e) => {
    if (isMobile) return;
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    setTilt({ x: px * 10, y: py * -8 });
  };

  const onMouseLeave = () => setTilt({ x: 0, y: 0 });

  const phase = PHASES[index];
  const isLastPhase = index === LAST_INDEX;
  const stance = PHASE_STANCES[index] || PHASE_STANCES[0];
  const stanceX = isMobile ? stance.x * 0.45 : stance.x;
  const stanceY = isMobile ? stance.y * 0.45 : stance.y;

  return (
    <div
      style={{
        backgroundColor: phase.bg,
        transition: `background-color ${TRANSITION_MS}ms ${EASE}`,
        fontFamily: "'Inter', sans-serif",
        position: 'relative',
        width: '100%',
        height: '100vh',
        overflow: 'hidden',
      }}
    >
      <div
        ref={containerRef}
        style={{
          position: 'relative',
          width: '100%',
          height: '100vh',
          overflow: 'hidden',
        }}
        onMouseMove={onMouseMove}
        onMouseLeave={onMouseLeave}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {/* Grain overlay */}
        <div className="daytrack-grain" />

        {/* Giant ghost text */}
        <div className="daytrack-ghost-wrap">
          <span
            className="daytrack-ghost-text"
            style={{
              opacity: popped ? 1 : 0,
              transition: `opacity ${TRANSITION_MS}ms ${EASE}`,
            }}
          >
            {phase.ghost}
          </span>
        </div>

        {/* Brand label */}
        <div
          style={{
            position: 'absolute',
            top: 24,
            left: isMobile ? 16 : 32,
            fontSize: 12,
            fontWeight: 700,
            textTransform: 'uppercase',
            color: '#ffffff',
            letterSpacing: '0.18em',
            zIndex: 60,
            opacity: 0.95,
          }}
        >
          DayTrack
        </div>

        {/* Top-right header: Phase pills + Log In button */}
        <div
          style={{
            position: 'absolute',
            top: 20,
            right: isMobile ? 16 : 32,
            display: 'flex',
            alignItems: 'center',
            gap: isMobile ? 10 : 16,
            zIndex: 60,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            {PHASES.map((p, i) => (
              <span
                key={p.id}
                style={{
                  display: 'inline-block',
                  height: 4,
                  width: i === index ? (isMobile ? 16 : 24) : 6,
                  borderRadius: 9999,
                  backgroundColor: `rgba(255, 255, 255, ${i === index ? 0.95 : 0.4})`,
                  transition: `width ${TRANSITION_MS}ms ${EASE}, background-color ${TRANSITION_MS}ms ${EASE}`,
                }}
              />
            ))}
          </div>

          <button
            onClick={() => onReachEnd('login')}
            aria-label="Log in to existing account"
            style={{
              padding: isMobile ? '6px 12px' : '8px 18px',
              borderRadius: 9999,
              border: '1.5px solid rgba(255, 255, 255, 0.85)',
              background: 'rgba(255, 255, 255, 0.15)',
              backdropFilter: 'blur(8px)',
              color: '#ffffff',
              fontSize: isMobile ? 11 : 12,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              cursor: 'pointer',
              transition: 'background-color 150ms ease, transform 150ms ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.28)';
              e.currentTarget.style.transform = 'scale(1.04)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.15)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
          >
            Log In
          </button>
        </div>

        {/* The photo cutout — with smooth real-time scroll physics & floating */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: isMobile ? '20%' : 0,
            height: isMobile ? '58%' : '90%',
            width: 'min(560px, 82vw)',
            transform: `translateX(calc(-50% + ${stanceX}px)) translateY(${
              stanceY + tilt.y + scrollPhysics.y
            }px) rotate(${stance.rotate + tilt.x * 0.35 + scrollPhysics.rotate}deg) scale(${
              (popped ? stance.scale : 0.94) * scrollPhysics.scale
            })`,
            transition: `transform ${TRANSITION_MS}ms ${EASE}, filter ${TRANSITION_MS}ms ${EASE}`,
            filter: popped
              ? 'blur(0px) drop-shadow(0 18px 38px rgba(0,0,0,0.22))'
              : 'blur(3px) drop-shadow(0 10px 20px rgba(0,0,0,0.15))',
            zIndex: 20,
            pointerEvents: 'none',
            userSelect: 'none',
            willChange: 'transform, filter',
          }}
        >
          <div className="daytrack-floating" style={{ width: '100%', height: '100%' }}>
            <img
              src={PHOTO_SRC}
              alt="Portrait"
              draggable={false}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                objectPosition: 'bottom center',
              }}
            />
          </div>
        </div>

        {/* Dynamic Grounding Shadow */}
        <div
          style={{
            position: 'absolute',
            left: '50%',
            bottom: isMobile ? '18%' : '2%',
            width: isMobile ? '46%' : '38%',
            height: 28,
            transform: `translateX(calc(-50% + ${stanceX + scrollPhysics.rotate * 2.5}px)) translateY(${
              scrollPhysics.y * 0.12
            }px) scale(${
              (popped ? stance.scale : 0.92) * (1 - Math.abs(scrollPhysics.y) * 0.0025)
            })`,
            transition: `transform ${TRANSITION_MS}ms ${EASE}`,
            background: 'radial-gradient(ellipse at center, rgba(0,0,0,0.32) 0%, rgba(0,0,0,0) 70%)',
            pointerEvents: 'none',
            zIndex: 15,
          }}
        />

        {/* Bottom-left copy + nav */}
        <div
          style={{
            position: 'absolute',
            bottom: isMobile ? 24 : 80,
            left: isMobile ? 16 : 80,
            zIndex: 60,
            maxWidth: 340,
          }}
        >
          <p
            style={{
              fontFamily: "'Inter', sans-serif",
              fontWeight: 700,
              fontSize: isMobile ? 16 : 22,
              textTransform: 'uppercase',
              marginBottom: isMobile ? 8 : 12,
              color: '#ffffff',
              letterSpacing: '0.02em',
              opacity: popped ? 0.95 : 0,
              transition: `opacity ${TRANSITION_MS}ms ${EASE}`,
            }}
          >
            {phase.heading}
          </p>
          <p
            style={{
              display: isMobile ? 'none' : 'block',
              fontSize: 14,
              color: '#ffffff',
              marginBottom: 20,
              lineHeight: 1.6,
              opacity: popped ? 0.85 : 0,
              transition: `opacity ${TRANSITION_MS}ms ${EASE}`,
            }}
          >
            {phase.copy}
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button
              onClick={() => navigate('prev')}
              aria-label="Previous part of the day"
              className="daytrack-nav-btn"
            >
              <ArrowLeft size={24} strokeWidth={2.25} />
            </button>
            <button
              onClick={() => navigate('next')}
              aria-label={isLastPhase ? 'Continue to sign up' : 'Next part of the day'}
              className="daytrack-nav-btn"
            >
              <ArrowRight size={24} strokeWidth={2.25} />
            </button>
          </div>
        </div>

        {/* Bottom-right CTA button */}
        <button
          onClick={onReachEnd}
          style={{
            position: 'absolute',
            bottom: isMobile ? 24 : 80,
            right: isMobile ? 16 : 48,
            zIndex: 60,
            fontFamily: "'Anton', sans-serif",
            fontSize: 'clamp(18px, 3.4vw, 46px)',
            fontWeight: 400,
            letterSpacing: '-0.02em',
            lineHeight: 1,
            textTransform: 'uppercase',
            background: 'none',
            border: 'none',
            color: '#ffffff',
            cursor: 'pointer',
            padding: 0,
            display: 'flex',
            alignItems: 'center',
            opacity: 0.95,
            transition: 'opacity 200ms ease, transform 150ms ease',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '1';
            e.currentTarget.style.transform = 'translateX(4px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '0.95';
            e.currentTarget.style.transform = 'translateX(0)';
          }}
        >
          Start tracking
          <ArrowRight style={{ marginLeft: 8, width: isMobile ? 20 : 32, height: isMobile ? 20 : 32 }} strokeWidth={2.25} />
        </button>

        {/* Scroll hint on last phase */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 12,
            display: 'flex',
            justifyContent: 'center',
            pointerEvents: 'none',
            zIndex: 60,
            opacity: isLastPhase && popped ? 0.85 : 0,
            transition: `opacity ${TRANSITION_MS}ms ${EASE}`,
          }}
        >
          <div
            className={isLastPhase ? 'daytrack-bouncing' : ''}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              color: '#ffffff',
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.18em',
                opacity: 0.8,
              }}
            >
              Sign up
            </span>
            <ChevronDown size={16} strokeWidth={2.25} />
          </div>
        </div>
      </div>
    </div>
  );
}

