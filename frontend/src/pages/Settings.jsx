import React, { useState, useEffect } from 'react';
import { MapPin, ShieldAlert, Award, Compass, RefreshCw, Trash2, HelpCircle } from 'lucide-react';
import { 
  isNativeApp, 
  requestHealthAuth, 
  checkHealthAuth, 
  getDailyStepsData 
} from '../services/nativeHealth';

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

  // Exporter controls
  const [exportLoading, setExportLoading] = useState(false);
  const [exportError, setExportError] = useState('');

  // Native sync controls
  const [nativeSyncLoading, setNativeSyncLoading] = useState(false);
  const [nativeSyncStatus, setNativeSyncStatus] = useState('');
  const [hasNativeAuth, setHasNativeAuth] = useState(false);

  useEffect(() => {
    if (isNativeApp()) {
      checkHealthAuth().then(auth => {
        setHasNativeAuth(auth);
      });
    }
  }, []);

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

  const handleCSVUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setSimLoading(true);
    setSimSuccess('Parsing CSV file...');

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
        if (lines.length < 2) {
          throw new Error('CSV file is empty or missing data lines.');
        }

        // Parse headers
        const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
        const dateIdx = headers.findIndex(h => h.includes('date') || h.includes('start') || h.includes('time'));
        const stepsIdx = headers.findIndex(h => h.includes('step'));

        if (dateIdx === -1 || stepsIdx === -1) {
          throw new Error('Could not find Date and Steps columns in the CSV. Make sure headers contain "Date" and "Steps".');
        }

        let importCount = 0;
        let totalStepsImported = 0;

        // Process data rows
        for (let i = 1; i < lines.length; i++) {
          const cols = lines[i].split(',').map(c => c.trim());
          if (cols.length <= Math.max(dateIdx, stepsIdx)) continue;

          const rawDate = cols[dateIdx];
          const rawSteps = parseInt(cols[stepsIdx]);

          if (isNaN(rawSteps) || !rawDate) continue;

          // Format date to YYYY-MM-DD
          // Handles "2026-08-13 00:00:00" -> "2026-08-13" or "13/08/2026" -> "2026-08-13"
          let cleanDate = '';
          if (rawDate.includes('-')) {
            cleanDate = rawDate.split(' ')[0]; // Take YYYY-MM-DD
          } else if (rawDate.includes('/')) {
            // Check if format is DD/MM/YYYY or YYYY/MM/DD
            const parts = rawDate.split(' ')[0].split('/');
            if (parts[0].length === 4) {
              cleanDate = `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
            } else {
              cleanDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            }
          } else {
            // Fallback: try parsing as Date object
            const d = new Date(rawDate);
            if (!isNaN(d.getTime())) {
              cleanDate = d.toISOString().split('T')[0];
            }
          }

          if (!cleanDate || !/^\d{4}-\d{2}-\d{2}$/.test(cleanDate)) continue;

          // Calculate estimated distance and duration
          const distance = rawSteps * 0.00075;
          const duration = rawSteps * 0.008;

          // Send POST update to backend
          await fetch('/api/activity/update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              date: cleanDate,
              steps: rawSteps,
              walkingDistance: parseFloat(distance.toFixed(2)),
              walkingDuration: Math.round(duration)
            })
          });

          importCount++;
          totalStepsImported += rawSteps;
        }

        setSimSuccess(`Successfully imported steps for ${importCount} days! Total Steps: ${totalStepsImported.toLocaleString()}`);
        triggerReloadUser();
        setTimeout(() => setSimSuccess(''), 6000);
      } catch (err) {
        alert(err.message);
      } finally {
        setSimLoading(false);
        e.target.value = ''; // Reset file input
      }
    };

    reader.readAsText(file);
  };

  // Export all user data as CSV / Excel sheet
  const handleExportData = async () => {
    setExportLoading(true);
    setExportError('');
    try {
      const headers = { 'Authorization': `Bearer ${token}` };
      const [activitiesRes, attendanceRes, workRes, expensesRes] = await Promise.all([
        fetch('/api/activity/history', { headers }),
        fetch('/api/attendance/history', { headers }),
        fetch('/api/work/history', { headers }),
        fetch('/api/expense/history', { headers })
      ]);

      if (!activitiesRes.ok || !attendanceRes.ok || !workRes.ok || !expensesRes.ok) {
        throw new Error('Failed to retrieve history logs from server.');
      }

      const [activities, attendance, work, expenses] = await Promise.all([
        activitiesRes.json(),
        attendanceRes.json(),
        workRes.json(),
        expensesRes.json()
      ]);

      // Merge all dates into a unified map
      const daysMap = {};
      const getDayRecord = (dateStr) => {
        if (!daysMap[dateStr]) {
          daysMap[dateStr] = {
            date: dateStr,
            steps: 0,
            distance: 0,
            duration: 0,
            arrival: '',
            departure: '',
            officeHours: 0,
            workSessions: [],
            totalSpent: 0,
            expensesList: [],
            workSummary: ''
          };
        }
        return daysMap[dateStr];
      };

      // 1. Populate activity steps
      activities.forEach(item => {
        if (item.date) {
          const rec = getDayRecord(item.date);
          rec.steps = item.steps || 0;
          rec.distance = item.walkingDistance || 0;
          rec.duration = item.walkingDuration || 0;
        }
      });

      // 2. Populate attendance check-ins
      attendance.forEach(item => {
        if (item.date) {
          const rec = getDayRecord(item.date);
          rec.arrival = item.arrivalTime ? new Date(item.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          rec.departure = item.departureTime ? new Date(item.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
          rec.officeHours = item.officeDuration ? (item.officeDuration / 3600000).toFixed(2) : 0;
          rec.workSummary = item.workSummary || '';
        }
      });

      // 3. Populate work sessions
      work.forEach(item => {
        if (item.date) {
          const rec = getDayRecord(item.date);
          const minutes = item.duration ? Math.round(item.duration / 60000) : 0;
          rec.workSessions.push(`${item.category} (${minutes}m)`);
        }
      });

      // 4. Populate expenses
      expenses.forEach(item => {
        if (item.date) {
          const rec = getDayRecord(item.date);
          rec.totalSpent += item.amount || 0;
          rec.expensesList.push(`${item.category}: ₹${item.amount}${item.note ? ' (' + item.note + ')' : ''}`);
        }
      });

      // Get sorted list of all unique dates
      const sortedDates = Object.keys(daysMap).sort((a, b) => new Date(b) - new Date(a));

      if (sortedDates.length === 0) {
        throw new Error('No tracker data exists to export yet.');
      }

      // Helper to escape values for CSV columns
      const escapeCSV = (val) => {
        if (val === undefined || val === null) return '""';
        const str = String(val);
        return `"${str.replace(/"/g, '""')}"`;
      };

      // Header row
      const csvHeaders = [
        'Date',
        'Steps Count',
        'Walking Distance (km)',
        'Walking Duration (mins)',
        'Office Arrival Time',
        'Office Departure Time',
        'Office Hours Logged',
        'Work Sessions Logged',
        'Total Money Spent (INR)',
        'Expense Notes',
        'Daily Work Done Summary'
      ];

      // Data rows
      const csvRows = sortedDates.map(date => {
        const rec = daysMap[date];
        return [
          escapeCSV(rec.date),
          escapeCSV(rec.steps),
          escapeCSV(rec.distance.toFixed(2)),
          escapeCSV(rec.duration),
          escapeCSV(rec.arrival),
          escapeCSV(rec.departure),
          escapeCSV(rec.officeHours),
          escapeCSV(rec.workSessions.join('; ')),
          escapeCSV(rec.totalSpent),
          escapeCSV(rec.expensesList.join('; ')),
          escapeCSV(rec.workSummary)
        ].join(',');
      });

      // Combine and trigger blob download
      const csvString = [csvHeaders.join(','), ...csvRows].join('\n');
      const blob = new Blob(["\uFEFF" + csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.setAttribute("href", url);
      link.setAttribute("download", `LifeTrack_Report_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error(err);
      setExportError(err.message || 'An error occurred exporting data.');
    } finally {
      setExportLoading(false);
    }
  };

  const handleNativeConnect = async () => {
    try {
      setNativeSyncLoading(true);
      setNativeSyncStatus('Requesting permissions...');
      await requestHealthAuth();
      const auth = await checkHealthAuth();
      setHasNativeAuth(auth);
      if (auth) {
        setNativeSyncStatus('Connected to Health sensors successfully!');
      } else {
        setNativeSyncStatus('Health access authorization denied.');
      }
    } catch (err) {
      setNativeSyncStatus(`Connection failed: ${err.message}`);
    } finally {
      setNativeSyncLoading(false);
      setTimeout(() => setNativeSyncStatus(''), 5000);
    }
  };

  const handleNativeSync = async () => {
    try {
      setNativeSyncLoading(true);
      setNativeSyncStatus('Reading native steps logs...');
      const samples = await getDailyStepsData(7);
      
      if (!samples || samples.length === 0) {
        setNativeSyncStatus('No steps data found in native health vault.');
        return;
      }

      setNativeSyncStatus(`Uploading ${samples.length} days of activity logs...`);
      let syncCount = 0;

      for (const sample of samples) {
        const dateObj = new Date(sample.startDate);
        const cleanDate = dateObj.toISOString().split('T')[0];
        const stepsVal = Math.round(sample.value || 0);

        if (stepsVal > 0) {
          const distance = stepsVal * 0.00075;
          const duration = stepsVal * 0.008;

          await fetch('/api/activity/update', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
              date: cleanDate,
              steps: stepsVal,
              walkingDistance: parseFloat(distance.toFixed(2)),
              walkingDuration: Math.round(duration)
            })
          });
          syncCount++;
        }
      }

      setNativeSyncStatus(`Successfully synchronized steps for ${syncCount} days!`);
      triggerReloadUser();
    } catch (err) {
      setNativeSyncStatus(`Sync error: ${err.message}`);
    } finally {
      setNativeSyncLoading(false);
      setTimeout(() => setNativeSyncStatus(''), 6000);
    }
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

      {/* 2.5 Apple Health CSV Importer */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Compass size={20} style={{ color: 'var(--primary)' }} />
          iPhone Apple Health CSV Importer
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Export your steps data from Apple Health on your iPhone to a CSV file (e.g. using the 100% free app <strong>QS Access</strong>), and upload it here to sync your steps history automatically!
        </p>

        <div style={{ backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: '1.25rem' }}>
          <label className="form-label" style={{ fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '0.5rem' }}>
            SELECT EXPORTED CSV FILE
          </label>
          <input 
            type="file" 
            accept=".csv" 
            onChange={handleCSVUpload} 
            disabled={simLoading}
            style={{
              width: '100%',
              fontSize: '0.85rem',
              color: 'var(--text-primary)',
              backgroundColor: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: 'var(--radius-md)',
              padding: '0.5rem',
              cursor: 'pointer'
            }}
          />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.85rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            <span>💡 <strong>Free iPhone App Suggestion:</strong> Search the App Store for <strong>QS Access</strong> (free, no ads).</span>
            <span>1. Open QS Access ➔ Check <strong>Steps</strong>.</span>
            <span>2. Choose <strong>1 Day</strong> frequency and tap <strong>Create Table</strong>.</span>
            <span>3. Tap the Share icon (top-right) and upload that file here!</span>
          </div>
        </div>
      </div>

      {/* 2.6 Native Mobile Health Sync */}
      {isNativeApp() ? (
        <div className="card" style={{ borderLeft: '4px solid #34c759' }}>
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={20} style={{ color: '#34c759' }} />
            Native iOS HealthKit / Android Health Connect Sync
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
            Synchronize your steps history directly from Apple Health (iOS) or Health Connect (Android) using the native device health API.
          </p>

          {nativeSyncStatus && (
            <div style={{ padding: '0.75rem', backgroundColor: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', marginBottom: '1rem', fontSize: '0.85rem', color: 'var(--text-primary)' }}>
              {nativeSyncStatus}
            </div>
          )}

          <div style={{ display: 'flex', gap: '1rem' }}>
            <button 
              onClick={handleNativeConnect} 
              className="btn btn-secondary" 
              style={{ flex: 1, display: 'flex', gap: '0.4rem', justifyContent: 'center', alignItems: 'center' }}
              disabled={nativeSyncLoading}
            >
              <span>🔗</span>
              <span>{hasNativeAuth ? 'Re-authorize Access' : 'Authorize Health App'}</span>
            </button>
            <button 
              onClick={handleNativeSync} 
              className="btn btn-primary" 
              style={{ flex: 1, display: 'flex', gap: '0.4rem', justifyContent: 'center', alignItems: 'center', backgroundColor: '#34c759', borderColor: '#34c759' }}
              disabled={nativeSyncLoading || !hasNativeAuth}
            >
              <span>🔄</span>
              <span>Sync Last 7 Days</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Award size={20} style={{ color: 'var(--text-muted)' }} />
            Native Mobile Health Sync
          </h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '0.75rem' }}>
            Direct background steps syncing via Apple HealthKit and Google Health Connect is available when running the application inside the mobile app wrapper.
          </p>
          <span style={{ fontSize: '0.75rem', color: 'var(--primary)', fontWeight: 600 }}>
            💡 Run this web app in iOS/Android simulator or native build to enable.
          </span>
        </div>
      )}

      {/* 2.75 Excel/CSV Exporter */}
      <div className="card">
        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <Award size={20} style={{ color: 'var(--success)' }} />
          Export Data to Excel List
        </h3>
        <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '1.25rem' }}>
          Download a complete, Excel-compatible daily spreadsheet report of all your steps, office times, focus work sessions, and expenses!
        </p>

        {exportError && (
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.85rem' }}>
            {exportError}
          </div>
        )}

        <button 
          onClick={handleExportData} 
          className="btn btn-primary"
          style={{ width: '100%', display: 'flex', gap: '0.5rem', justifyContent: 'center', alignItems: 'center' }}
          disabled={exportLoading}
        >
          {exportLoading ? (
            <>
              <RefreshCw size={18} className="anim-pulse" />
              <span>Generating Excel List...</span>
            </>
          ) : (
            <>
              <span>📥</span>
              <span>Download Excel CSV List</span>
            </>
          )}
        </button>
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
