import React, { useState } from 'react';
import LandingHero from './LandingHero';
import LandingAuth from './LandingAuth';

const TRANSITION_MS = 700;
const EASE = 'cubic-bezier(0.4, 0, 0.2, 1)';

export default function LandingPage({ onLoginSuccess }) {
  const [page, setPage] = useState('hero');
  const [authMode, setAuthMode] = useState('login');

  const handleOpenAuth = (mode = 'login') => {
    setAuthMode(mode);
    setPage('auth');
  };

  const slide = page === 'auth' ? 1 : 0;

  return (
    <div
      style={{
        height: '100vh',
        width: '100%',
        overflow: 'hidden',
        position: 'relative',
        backgroundColor: '#0f172a',
      }}
    >
      <div
        style={{
          transform: `translateY(-${slide * 100}vh)`,
          transition: `transform ${TRANSITION_MS}ms ${EASE}`,
          height: '200vh',
          width: '100%',
        }}
      >
        <LandingHero
          active={page === 'hero'}
          onReachEnd={handleOpenAuth}
        />
        <LandingAuth
          active={page === 'auth'}
          initialMode={authMode}
          onBack={() => setPage('hero')}
          onLoginSuccess={onLoginSuccess}
        />
      </div>
    </div>
  );
}
