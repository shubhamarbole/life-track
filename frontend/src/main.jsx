import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Global Fetch Interceptor to handle production API routing and prevent HTML JSON parser crashes
const originalFetch = window.fetch;
window.fetch = async function (url, options = {}) {
  // 1. Rewrite relative /api/ routes to use the production backend URL if configured
  if (typeof url === 'string' && url.startsWith('/api/')) {
    const API_BASE = import.meta.env.VITE_API_URL || '';
    if (API_BASE) {
      // Ensure there are no double slashes if API_BASE ends with a slash
      const cleanBase = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE;
      url = `${cleanBase}${url}`;
    }
  }

  const response = await originalFetch(url, options);

  // 2. Intercept and safely prevent HTML responses (like static index.html router fallbacks)
  // from crashing the frontend JSON parser.
  const originalJson = response.json;
  response.json = async function () {
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('text/html')) {
      throw new Error("API returned HTML instead of JSON. Please verify that your VITE_API_URL is set and points to the running backend.");
    }
    return await originalJson.call(response);
  };

  return response;
};

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
