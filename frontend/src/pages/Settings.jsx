import React, { useState, useEffect } from 'react';
import { MapPin, ShieldAlert, Award, Compass, RefreshCw, Trash2, HelpCircle } from 'lucide-react';

const Settings = ({ user, onLogout, triggerReloadUser }) => {
  // Office settings
  const [lat, setLat] = useState(user?.officeLocation?.lat || '');
  const [lng, setLng] = useState(user?.officeLocation?.lng || '');
  const [radius, setRadius] = useState(user?.officeRadius || 100);
  const [expectedHours, setExpectedHours] = useState(user?.expectedWorkingHours || 8);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSuccess, setSettingsSuccess] = useState('');

  // Simulator controls
  const [simSteps, setSimSteps] = useState('8250');
  const [simDistance, setSimDistance] = useState('6.4');
  const [simDuration, setSimDuration] = useState('45');
  const [simLoading, setSimLoading] = useState(false);
  const [simSuccess, setSimSuccess] = useState('');

  const token = localStorage.getItem('lifetrack_token');
  const todayStr = new Date().toISOString().split('T')[0];

  useEffect(() => {
    if (user) {
      setLat(user.officeLocation?.lat || '');
      setLng(user.officeLocation?.lng || '');
      setRadius(user.officeRadius || 100);
      setExpectedHours(user.expectedWorkingHours || 8);
    }
  }, [user]);

  // Fallback to IP geolocation if GPS is unavailable or blocked (e.g. insecure HTTP origin)
  const fallbackIPGeolocation = async (originalError = '') => {
    try {
      setSettingsSuccess('Estimating location via IP...');
      const res = await fetch('https://ipapi.co/json/');
      if (!res.ok) throw new Error('IP lookup failed');
      const data = await res.json();
      if (data.latitude && data.longitude) {
        setLat(data.latitude.toFixed(6));
        setLng(data.longitude.toFixed(6));
        setSettingsSuccess(`Estimated location via IP: ${data.city || 'Success'}`);
        setTimeout(() => setSettingsSuccess(''), 5000);
      } else {
        throw new Error('No coordinates in IP response');
      }
    } catch (err) {
      let msg = `Error detecting location: ${originalError || 'Unknown error'}`;
      if (originalError.toLowerCase().includes('secure origin') || originalError.toLowerCase().includes('origin')) {
        msg += `\n\nTip: Browser geolocation requires HTTPS or localhost. If you are testing over a local network IP, access the app via http://localhost:3000, or configure chrome://flags/#unsafely-treat-insecure-origin-as-secure in Chrome.`;
      }
      alert(msg);
      setSettingsSuccess('');
    }
  };

  // Detect current coords
  const detectCoordinates = () => {
    if (!navigator.geolocation) {
      fallbackIPGeolocation('Geolocation not supported by browser');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLat(position.coords.latitude.toFixed(6));
        setLng(position.coords.longitude.toFixed(6));
        setSettingsSuccess('GPS coordinates detected successfully!');
        setTimeout(() => setSettingsSuccess(''), 3000);
      },
      (error) => {
        console.warn(`GPS detection failed: ${error.message}. Attempting IP fallback...`);
        fallbackIPGeolocation(error.message);
      }
    );
  };

  // Update Settings API
  const handleSaveSettings = async (e) => {
    e.preventDefault();
    if (!lat || !lng || !radius) {
      alert('Please fill in coordinates and radius.');
      return;
    }
    setSettingsLoading(true);
    setSettingsSuccess('');

    try {
      const response = await fetch('/api/auth/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          officeLocation: { lat: parseFloat(lat), lng: parseFloat(lng) },
          officeRadius: parseInt(radius),
          expectedWorkingHours: parseFloat(expectedHours),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save settings');
      }

      setSettingsSuccess('Office settings saved successfully!');
      triggerReloadUser(); // Inform app shell
      setTimeout(() => setSettingsSuccess(''), 3000);
    } catch (err) {
      alert(err.message);
    } finally {
      setSettingsLoading(false);
    }
  };

  // Mock Simulations Actions
  const simulateCheckin = async () => {
    setSimLoading(true);
    setSimSuccess('');
    try {
      const res = await fetch('/api/attendance/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ date: todayStr })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Simulation checkin failed');
      setSimSuccess('Checked-in today successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setSimLoading(false);
    }
  };

  const simulateCheckout = async () => {
    setSimLoading(true);
    setSimSuccess('');
    try {
      const res = await fetch('/api/attendance/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ date: todayStr })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Simulation checkout failed');
      setSimSuccess('Checked-out today successfully!');
    } catch (err) {
      alert(err.message);
    } finally {
      setSimLoading(false);
    }
  };

  const simulateStepSync = async (e) => {
    e.preventDefault();
    setSimLoading(true);
    setSimSuccess('');
    try {
      const res = await fetch('/api/activity/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          steps: parseInt(simSteps),
          walkingDistance: parseFloat(simDistance),
          walkingDuration: parseInt(simDuration),
          activityType: 'Android Sync Simulation',
          date: todayStr
        })
      });
      if (res.ok) {
        setSimSuccess('Steps & Walking metrics synced successfully!');
      }
    } catch (err) {
      alert(err.message);
    } finally {
      setSimLoading(false);
    }
  };

  // Privacy: Delete account and records
  const handleDeleteData = async () => {
    const doubleCheck = window.confirm(
      'WARNING: This will permanently delete your account and ALL stored geofence logs, expenses, work sessions, and activities. This action CANNOT be undone.\n\nAre you sure you want to proceed?'
    );
    if (!doubleCheck) return;

    try {
      const response = await fetch('/api/auth/delete-data', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` },
      });

      if (response.ok) {
        alert('All personal data has been completely erased. Logging out.');
        onLogout();
      } else {
        alert('Failed to erase data. Please try again.');
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* 1. Office Location Settings */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <MapPin size={20} style={{ color: 'var(--primary)' }} />
          Office Location Geofence Settings
        </h3>

        {settingsSuccess && (
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--success-light)', color: 'var(--success)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 500 }}>
            {settingsSuccess}
          </div>
        )}

        <form onSubmit={handleSaveSettings}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Office Latitude</label>
              <input 
                type="number" 
                step="any"
                className="form-input" 
                placeholder="e.g. 28.535511" 
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Office Longitude</label>
              <input 
                type="number" 
                step="any"
                className="form-input" 
                placeholder="e.g. 77.391029" 
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Geofence Radius (meters)</label>
              <input 
                type="number" 
                className="form-input" 
                placeholder="e.g. 100" 
                value={radius}
                onChange={(e) => setRadius(e.target.value)}
                required
                min="10"
              />
            </div>
            <div className="form-group">
              <label className="form-label">Expected Work Hours / Day</label>
              <input 
                type="number" 
                step="any"
                className="form-input" 
                placeholder="e.g. 8" 
                value={expectedHours}
                onChange={(e) => setExpectedHours(e.target.value)}
                required
                min="1"
              />
            </div>
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button type="button" onClick={detectCoordinates} className="btn btn-secondary" style={{ flex: 1, display: 'flex', gap: '0.4rem', justifyContent: 'center' }}>
              <Compass size={16} /> Detect GPS Location
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={settingsLoading}>
              {settingsLoading ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>

      {/* 2. Developer Simulator Console */}
      <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <RefreshCw size={20} style={{ color: 'var(--warning)' }} />
          Simulation Console (Developer Testing)
        </h3>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Test features locally without physical movement or native device step integrations.
        </p>

        {simSuccess && (
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--success-light)', color: 'var(--success)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 500 }}>
            {simSuccess}
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', mdGridColumns: '1fr 1fr', gap: '1.5rem' }}>
          {/* Office check in triggers */}
          <div>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>1. Geofence Check-in Simulator</h4>
            <div style={{ display: 'flex', gap: '1rem' }}>
              <button onClick={simulateCheckin} className="btn btn-secondary" style={{ flex: 1 }} disabled={simLoading}>
                Simulate Check-in
              </button>
              <button onClick={simulateCheckout} className="btn btn-secondary" style={{ flex: 1 }} disabled={simLoading}>
                Simulate Check-out
              </button>
            </div>
          </div>

          {/* Step Count triggers */}
          <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1rem' }}>
            <h4 style={{ fontSize: '0.9rem', fontWeight: 700, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>2. Android Step Sensor Sync Simulator</h4>
            <form onSubmit={simulateStepSync} style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem', alignItems: 'end' }}>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Steps</label>
                <input type="number" className="form-input" value={simSteps} onChange={e => setSimSteps(e.target.value)} required />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Distance (km)</label>
                <input type="number" step="any" className="form-input" value={simDistance} onChange={e => setSimDistance(e.target.value)} required />
              </div>
              <div>
                <label className="form-label" style={{ fontSize: '0.75rem' }}>Time (mins)</label>
                <input type="number" className="form-input" value={simDuration} onChange={e => setSimDuration(e.target.value)} required />
              </div>
              <button type="submit" className="btn btn-primary" style={{ gridColumn: 'span 3', marginTop: '0.5rem' }} disabled={simLoading}>
                Simulate Step Sync
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* 2.5 iPhone Apple Health Auto-Sync */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Compass size={20} style={{ color: 'var(--primary)' }} />
          iPhone Apple Health Auto-Sync
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
          Automatically sync your actual iPhone steps to this app using the built-in iOS Shortcuts app.
        </p>
        
        <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>YOUR SECURITY ACCESS TOKEN</span>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
            <input 
              type="text" 
              readOnly 
              value={token || ''} 
              style={{
                flex: 1,
                fontSize: '0.75rem',
                fontFamily: 'monospace',
                backgroundColor: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-sm)',
                padding: '0.5rem',
                color: 'var(--text-secondary)',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            />
            <button 
              onClick={() => {
                navigator.clipboard.writeText(token);
                alert("Security Token copied to clipboard! You can paste it into your iOS Shortcuts setup.");
              }} 
              className="btn btn-secondary" 
              style={{ padding: '0.5rem 1rem', fontSize: '0.8rem', whiteSpace: 'nowrap' }}
            >
              Copy Token
            </button>
          </div>
        </div>
      </div>

      {/* 3. Privacy & Disclosures */}
      <div className="card" style={{ borderLeft: '4px solid var(--danger)' }}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <ShieldAlert size={20} style={{ color: 'var(--danger)' }} />
          Privacy &amp; Data Security
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.5rem' }}>
          LifeTrack is a personal tracker. We do not use third-party tracking libraries, nor do we sell or export your coordinates. All calculations are executed on-device or stored on your secure private account.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
            <div>
              <h4 style={{ fontSize: '0.9rem', fontWeight: 700 }}>Erase Account &amp; Tracking Data</h4>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Permanently erase all office geofence logs, expenses, steps, and user profile data.</p>
            </div>
            <button onClick={handleDeleteData} className="btn btn-danger" style={{ display: 'flex', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
              <Trash2 size={16} /> Delete My Data
            </button>
          </div>
        </div>
      </div>

    </div>
  );
};

export default Settings;
