import React from 'react';
import { NavLink } from 'react-router-dom';
import { Home, Bot, Calendar, DollarSign, Settings } from 'lucide-react';

const BottomNav = () => {
  return (
    <nav className="bottom-nav">
      <NavLink 
        to="/" 
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <Home />
        <span>Dashboard</span>
      </NavLink>
      <NavLink 
        to="/assistant" 
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <Bot />
        <span>Assistant</span>
      </NavLink>
      <NavLink 
        to="/history" 
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <Calendar />
        <span>History</span>
      </NavLink>
      <NavLink 
        to="/money" 
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <DollarSign />
        <span>Money</span>
      </NavLink>
      <NavLink 
        to="/settings" 
        className={({ isActive }) => `bottom-nav-item ${isActive ? 'active' : ''}`}
      >
        <Settings />
        <span>Settings</span>
      </NavLink>
    </nav>
  );
};

export default BottomNav;
