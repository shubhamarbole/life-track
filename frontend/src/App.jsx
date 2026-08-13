import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import BottomNav from './components/BottomNav';
import Header from './components/Header';

// Pages
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Analytics from './pages/Analytics';
import Money from './pages/Money';
import Settings from './pages/Settings';
import Login from './pages/Login';
import Register from './pages/Register';

function App() {
  const [user, setUser] = useState(null);
  const [theme, setTheme] = useState(localStorage.getItem('lifetrack_theme') || 'light');
  const [authLoading, setAuthLoading] = useState(true);

  const token = localStorage.getItem('lifetrack_token');

  // Load user profile
  const fetchUserProfile = async (customToken) => {
    const activeToken = customToken || localStorage.getItem('lifetrack_token');
    if (!activeToken) {
      setUser(null);
      setAuthLoading(false);
      return;
    }
    try {
      const response = await fetch('/api/auth/me', {
        headers: { 'Authorization': `Bearer ${activeToken}` }
      });
      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // Token invalid, clear it
        localStorage.removeItem('lifetrack_token');
        setUser(null);
      }
    } catch (err) {
      console.error('Error fetching user profile:', err);
    } finally {
      setAuthLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  // Update HTML data-theme attribute for CSS scoping
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('lifetrack_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleLoginSuccess = (userData) => {
    setUser(userData);
    fetchUserProfile(userData.token); // Reload with fresh token
  };

  const handleLogout = () => {
    localStorage.removeItem('lifetrack_token');
    setUser(null);
  };

  if (authLoading) {
    return <div style={{ display: 'flex', minHeight: '100vh', alignItems: 'center', justifyContent: 'center', backgroundColor: '#0f172a', color: '#fff' }}>Verifying account token...</div>;
  }

  return (
    <Router>
      <div className="app-container">
        {user ? (
          <>
            {/* Authenticated Layout */}
            <Header theme={theme} toggleTheme={toggleTheme} user={user} onLogout={handleLogout} />
            
            <main className="main-content-streamline">
              <Routes>
                <Route path="/" element={<Dashboard user={user} triggerReloadUser={fetchUserProfile} />} />
                <Route path="/history" element={<History />} />
                <Route path="/analytics" element={<Analytics />} />
                <Route path="/money" element={<Money />} />
                <Route path="/settings" element={<Settings user={user} onLogout={handleLogout} triggerReloadUser={fetchUserProfile} />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>

            <BottomNav />
          </>
        ) : (
          /* Unauthenticated Auth Guard */
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
            <main style={{ flex: 1, padding: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Routes>
                <Route path="/login" element={<Login onLoginSuccess={handleLoginSuccess} />} />
                <Route path="/register" element={<Register onLoginSuccess={handleLoginSuccess} />} />
                <Route path="*" element={<Navigate to="/login" replace />} />
              </Routes>
            </main>
          </div>
        )}
      </div>
    </Router>
  );
}

export default App;
