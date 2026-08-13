import React from 'react';
import { NavLink } from 'react-router-dom';
import { Sun, Moon, LogOut } from 'lucide-react';

const Header = ({ theme, toggleTheme, user, onLogout }) => {
  return (
    <header className="app-header-capsule">
      
      {/* Brand logo (Mockup style: blue diamond + bold text) */}
      <div className="navbar-logo-group">
        <div className="navbar-diamond-logo">
          <div className="diamond-inner"></div>
        </div>
        <span className="navbar-brand-text">DAY TRACKER</span>
      </div>

      {/* Navigation Pills (Desktop only inside navbar capsule) */}
      <nav className="navbar-links">
        <NavLink 
          to="/" 
          className={({ isActive }) => `navbar-pill-link ${isActive ? 'active' : ''}`}
        >
          Dashboard
        </NavLink>
        <NavLink 
          to="/history" 
          className={({ isActive }) => `navbar-pill-link ${isActive ? 'active' : ''}`}
        >
          History
        </NavLink>
        <NavLink 
          to="/analytics" 
          className={({ isActive }) => `navbar-pill-link ${isActive ? 'active' : ''}`}
        >
          Analytics
        </NavLink>
        <NavLink 
          to="/money" 
          className={({ isActive }) => `navbar-pill-link ${isActive ? 'active' : ''}`}
        >
          Money
        </NavLink>
        <NavLink 
          to="/settings" 
          className={({ isActive }) => `navbar-pill-link ${isActive ? 'active' : ''}`}
        >
          Settings
        </NavLink>
      </nav>

      {/* Right side items: Theme toggler + Profile avatar greet + Logout */}
      <div className="navbar-right-group">
        {/* Theme round toggle button */}
        <button 
          onClick={toggleTheme} 
          className="navbar-round-btn"
          title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        {user && (
          <>
            {/* User details greet container */}
            <div className="navbar-profile">
              <div className="profile-avatar">
                {user.name ? user.name[0].toUpperCase() : 'U'}
              </div>
              <div className="profile-text">
                <span className="profile-greet">Hello!</span>
                <span className="profile-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px', whiteSpace: 'nowrap' }}>
                  {user.name.split(' ')[0]}
                </span>
              </div>
            </div>

            {/* Logout Action */}
            <button 
              onClick={onLogout} 
              className="navbar-round-btn" 
              style={{ color: 'var(--danger)' }}
              title="Logout"
            >
              <LogOut size={15} />
            </button>
          </>
        )}
      </div>

    </header>
  );
};

export default Header;
