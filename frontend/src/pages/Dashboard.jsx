import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { 
  Building, 
  MapPin, 
  Footprints, 
  Clock, 
  Code, 
  BookOpen, 
  Users, 
  Briefcase, 
  Plus, 
  Wallet,
  AlertTriangle,
  Play,
  Square,
  Filter,
  ChevronDown
} from 'lucide-react';
import SpendingModal from '../components/SpendingModal';

const Dashboard = ({ user, triggerReloadUser }) => {
  const [loading, setLoading] = useState(true);
  const [attendance, setAttendance] = useState(null);
  const [activity, setActivity] = useState({ steps: 0, walkingDistance: 0, walkingDuration: 0, activityEvents: [] });
  const [workSessions, setWorkSessions] = useState([]);
  const [spending, setSpending] = useState({ todayTotal: 0, weeklyTotal: 0, monthlyTotal: 0, categoryTotals: {} });
  const [activeSession, setActiveSession] = useState(null);
  const [isSpendingModalOpen, setIsSpendingModalOpen] = useState(false);
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [geoStatus, setGeoStatus] = useState('Off'); // Off, Active, Inside Office, Outside Office
  const [geoError, setGeoError] = useState('');
  
  const token = localStorage.getItem('lifetrack_token');
  const todayStr = new Date().toISOString().split('T')[0];

  // Fetch all dashboard data
  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = { 'Authorization': `Bearer ${token}` };

      // Get today's attendance
      const attendanceRes = await fetch(`/api/attendance/today?date=${todayStr}`, { headers });
      if (attendanceRes.ok) {
        const attData = await attendanceRes.json();
        setAttendance(attData);
      }

      // Get today's activity
      const activityRes = await fetch(`/api/activity/today?date=${todayStr}`, { headers });
      if (activityRes.ok) {
        const actData = await activityRes.json();
        setActivity(actData);
      }

      // Get today's work sessions
      const workRes = await fetch(`/api/work/today?date=${todayStr}`, { headers });
      if (workRes.ok) {
        const workData = await workRes.json();
        setWorkSessions(workData);
        // Find active session
        const active = workData.find(s => !s.endTime);
        setActiveSession(active || null);
      }

      // Get spending summary
      const spendingRes = await fetch(`/api/expense/summary?clientDate=${todayStr}`, { headers });
      if (spendingRes.ok) {
        const spData = await spendingRes.json();
        setSpending(spData);
      }

    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const savedPref = localStorage.getItem('lifetrack_location_tracking');
    const isTracking = savedPref === null ? true : savedPref === 'true';
    setTrackingEnabled(isTracking);
    if (savedPref === null) {
      localStorage.setItem('lifetrack_location_tracking', 'true');
    }
  }, []);

  // Geolocation Geofencing Watcher
  useEffect(() => {
    if (!trackingEnabled || !user || !user.officeLocation) {
      setGeoStatus('Off');
      return;
    }

    setGeoStatus('Initializing...');
    setGeoError('');

    if (!navigator.geolocation) {
      setGeoStatus('Not Supported');
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }

    const getDistance = (lat1, lon1, lat2, lon2) => {
      const R = 6371e3; // meters
      const phi1 = lat1 * Math.PI / 180;
      const phi2 = lat2 * Math.PI / 180;
      const deltaPhi = (lat2 - lat1) * Math.PI / 180;
      const deltaLambda = (lon2 - lon1) * Math.PI / 180;

      const a = Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
                Math.cos(phi1) * Math.cos(phi2) *
                Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      return R * c; // in meters
    };

    const handleSuccess = async (position) => {
      const { latitude, longitude } = position.coords;
      const officeLat = user.officeLocation?.lat ?? 0;
      const officeLng = user.officeLocation?.lng ?? 0;
      const radius = user.officeRadius || 100;

      if (officeLat === 0 && officeLng === 0) {
        setGeoStatus('Config Required');
        return;
      }

      const distance = getDistance(latitude, longitude, officeLat, officeLng);
      const isInside = distance <= radius;

      setGeoStatus(isInside ? 'Inside Office Geofence' : 'Outside Office');

      const headers = { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}` 
      };

      try {
        if (isInside) {
          if (!attendance) {
            console.log('Automated Geofence check-in triggered.');
            const res = await fetch('/api/attendance/checkin', {
              method: 'POST',
              headers,
              body: JSON.stringify({ date: todayStr })
            });
            if (res.ok) {
              const newAtt = await res.json();
              setAttendance(newAtt);
              await fetch('/api/activity/update', {
                method: 'POST',
                headers,
                body: JSON.stringify({ activityType: 'Entered Office Geofence', date: todayStr })
              });
            }
          }
        } else {
          if (attendance && !attendance.departureTime) {
            console.log('Automated Geofence check-out triggered.');
            const res = await fetch('/api/attendance/checkout', {
              method: 'POST',
              headers,
              body: JSON.stringify({ date: todayStr })
            });
            if (res.ok) {
              const updatedAtt = await res.json();
              setAttendance(updatedAtt);
              await fetch('/api/activity/update', {
                method: 'POST',
                headers,
                body: JSON.stringify({ activityType: 'Exited Office Geofence', date: todayStr })
              });
            }
          }
        }
      } catch (err) {
        console.error('Geofence error:', err);
      }
    };

    const handleError = (error) => {
      setGeoStatus('Access Denied');
      setGeoError(error.message || 'Permission denied.');
    };

    const watchId = navigator.geolocation.watchPosition(handleSuccess, handleError, {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 0
    });

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  }, [trackingEnabled, user, attendance]);

  const toggleLocationTracking = (e) => {
    const checked = e.target.checked;
    setTrackingEnabled(checked);
    localStorage.setItem('lifetrack_location_tracking', checked ? 'true' : 'false');
  };

  const handleAddExpenseSubmit = async (expenseData) => {
    const headers = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    };
    const response = await fetch('/api/expense/add', {
      method: 'POST',
      headers,
      body: JSON.stringify(expenseData),
    });
    if (!response.ok) {
      const errData = await response.json();
      throw new Error(errData.message || 'Failed to record expense');
    }
    const summaryRes = await fetch(`/api/expense/summary?clientDate=${todayStr}`, { headers: { 'Authorization': `Bearer ${token}` } });
    if (summaryRes.ok) {
      const spData = await summaryRes.json();
      setSpending(spData);
    }
  };

  const handleStartWorkSession = async (category) => {
    try {
      const response = await fetch('/api/work/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ category, date: todayStr })
      });
      if (response.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleStopWorkSession = async () => {
    try {
      const response = await fetch('/api/work/stop', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ date: todayStr })
      });
      if (response.ok) {
        fetchData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const formatDuration = (ms) => {
    if (!ms) return '0m';
    const mins = Math.floor(ms / 60000);
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return hrs > 0 ? `${hrs}h ${remainingMins}m` : `${remainingMins}m`;
  };

  const getOfficeDuration = () => {
    if (!attendance) return '0m';
    if (attendance.departureTime) {
      return formatDuration(attendance.officeDuration);
    }
    const duration = new Date().getTime() - new Date(attendance.arrivalTime).getTime();
    return formatDuration(duration > 0 ? duration : 0);
  };

  const getTotalWorkDuration = () => {
    let totalMs = 0;
    workSessions.forEach((s) => {
      if (s.endTime) {
        totalMs += s.duration;
      } else {
        totalMs += new Date().getTime() - new Date(s.startTime).getTime();
      }
    });
    return totalMs;
  };

  const workSessionCategoryTotals = () => {
    const categories = { Coding: 0, Learning: 0, Meeting: 0, Other: 0 };
    workSessions.forEach((s) => {
      const duration = s.endTime ? s.duration : (new Date().getTime() - new Date(s.startTime).getTime());
      if (categories[s.category] !== undefined) {
        categories[s.category] += duration;
      } else {
        categories['Other'] += duration;
      }
    });
    return categories;
  };

  const catWorkTotals = workSessionCategoryTotals();

  if (loading && !attendance && workSessions.length === 0) {
    return <div style={{ padding: '2rem', textAlign: 'center' }}>Loading Dashboard...</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* 1. Dashboard Overview Header Section (Mockup Design) */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1.25rem' }}>
        <div>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--text-primary)', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}>
            Dashboard Overview
          </h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.25rem' }}>
            Monitor your personal routines and budget in real-time
          </p>
        </div>

        {/* Right Header filters (Mockup buttons) */}
        <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          {/* Timeframe selector */}
          <div style={{
            position: 'relative',
            display: 'flex',
            alignItems: 'center',
            backgroundColor: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-full)',
            padding: '0.5rem 1.25rem',
            fontSize: '0.85rem',
            fontWeight: 600,
            color: 'var(--text-secondary)',
            cursor: 'pointer'
          }}>
            <span>This Month</span>
            <ChevronDown size={14} style={{ marginLeft: '0.5rem' }} />
          </div>

          {/* Filter button */}
          <button className="btn btn-primary" style={{ borderRadius: 'var(--radius-full)', padding: '0.5rem 1.25rem', fontSize: '0.85rem', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
            <Filter size={14} /> Filter
          </button>
        </div>
      </div>

      {/* Geofence Alert Ribbon (Optional banner if warning present) */}
      {trackingEnabled && (geoError || geoStatus === 'Config Required') && (
        <div style={{ padding: '0.75rem 1.25rem', backgroundColor: 'var(--warning-light)', color: 'var(--warning)', borderRadius: 'var(--radius-md)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', fontSize: '0.85rem', border: '1px solid var(--warning)', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flex: 1 }}>
            <AlertTriangle size={16} style={{ flexShrink: 0 }} />
            <span>
              {geoStatus === 'Config Required' ? (
                'Office coordinates are not configured. Please set your office location in settings.'
              ) : (
                <>
                  <strong>Location tracking disabled:</strong> {geoError || 'Permission denied.'}
                  {geoError && (geoError.toLowerCase().includes('secure origin') || geoError.toLowerCase().includes('origin')) && (
                    <div style={{ marginTop: '0.25rem', fontSize: '0.78rem', color: 'var(--warning)', opacity: 0.9 }}>
                      Tip: Geolocation requires a secure origin (HTTPS or localhost). If testing on a local IP, use <code>http://localhost:3000</code> or enable <code>chrome://flags/#unsafely-treat-insecure-origin-as-secure</code>.
                    </div>
                  )}
                </>
              )}
            </span>
          </div>
          <Link to="/settings" style={{ color: 'var(--warning)', fontWeight: 600, textDecoration: 'underline', whiteSpace: 'nowrap' }}>
            Go to Settings
          </Link>
        </div>
      )}

      {/* 2. Streamline Metrics Cards Grid (Mockup Layout) */}
      <div className="streamline-grid">
        
        {/* Card 1: Office Duration (Primary Blue Card) */}
        <div className="card-streamline primary-blue">
          <div className="card-streamline-left">
            <span className="card-streamline-label">Total Office Time</span>
            <h3 className="card-streamline-metric">{getOfficeDuration()}</h3>
            <span className="card-streamline-subtext">
              {attendance ? `Arrival: ${new Date(attendance.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Not checked in'}
            </span>
          </div>
          <div className="card-streamline-icon-wrapper white">
            <Building size={20} />
          </div>
        </div>

        {/* Card 2: Activity Steps (Light Card + Black icon) */}
        <div className="card-streamline">
          <div className="card-streamline-left">
            <span className="card-streamline-label">Activity Steps</span>
            <h3 className="card-streamline-metric">{activity?.steps?.toLocaleString() || '0'}</h3>
            <span className="card-streamline-subtext">
              Dist: {activity?.walkingDistance?.toFixed(1) || 0.0} km
            </span>
          </div>
          <div className="card-streamline-icon-wrapper black">
            <Footprints size={20} />
          </div>
        </div>

        {/* Card 3: Working Time (Light Card + Blue icon + Blue Metric) */}
        <div className="card-streamline">
          <div className="card-streamline-left">
            <span className="card-streamline-label">Working Hours</span>
            <h3 className="card-streamline-metric blue">{formatDuration(getTotalWorkDuration())}</h3>
            <span className="card-streamline-subtext">
              Coding: {formatDuration(catWorkTotals.Coding)}
            </span>
          </div>
          <div className="card-streamline-icon-wrapper blue">
            <Clock size={20} />
          </div>
        </div>

        {/* Card 4: Daily Spending (Light Card + Black icon) */}
        <div className="card-streamline">
          <div className="card-streamline-left">
            <span className="card-streamline-label">Today's Spending</span>
            <h3 className="card-streamline-metric">₹{spending.todayTotal}</h3>
            <span className="card-streamline-subtext">
              Monthly: ₹{spending.monthlyTotal}
            </span>
          </div>
          <div className="card-streamline-icon-wrapper black">
            <Wallet size={20} strokeWidth={2} />
          </div>
        </div>

      </div>

      {/* Geofence Configuration Summary bar */}
      <div className="card-glass" style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', borderLeft: '4px solid var(--primary)' }}>
        <div>
          <h3 style={{ fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 700 }}>
            <MapPin size={18} className="anim-pulse" style={{ color: 'var(--primary)' }} />
            Geofence Tracker Status
          </h3>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Current state: <strong>{geoStatus}</strong> {user?.officeLocation?.lat && user.officeLocation.lat !== 0 ? `(Target: ${user.officeLocation.lat.toFixed(3)}, ${user.officeLocation.lng.toFixed(3)})` : ''}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.25rem' }}>
          <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
            <input 
              type="checkbox" 
              checked={trackingEnabled}
              onChange={toggleLocationTracking}
              style={{ opacity: 0, width: 0, height: 0 }}
            />
            <span className="slider" style={{
              position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: trackingEnabled ? 'var(--primary)' : '#ccc', borderRadius: '34px',
              transition: '.4s'
            }}>
              <span style={{
                position: 'absolute', content: '""', height: '18px', width: '18px', left: '4px', bottom: '4px',
                backgroundColor: 'white', borderRadius: '50%', transition: '.4s',
                transform: trackingEnabled ? 'translateX(24px)' : 'none'
              }}></span>
            </span>
          </label>
        </div>
      </div>

      {/* Main Bottom Section: Work Session Tracker and Expense Visualizer */}
      <div className="analytics-grid">
        
        {/* Work session tracker card */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Briefcase size={20} style={{ color: 'var(--primary)' }} />
            Work Session Timer
          </h3>

          {activeSession ? (
            <div style={{ backgroundColor: 'var(--primary-light)', border: '1px solid var(--primary)', borderRadius: 'var(--radius-md)', padding: '1rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--primary)' }}>RUNNING SESSION</span>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 700 }}>{activeSession.category}</h4>
              </div>
              <button onClick={handleStopWorkSession} className="btn btn-danger" style={{ display: 'flex', gap: '0.4rem', padding: '0.5rem 1rem', fontSize: '0.85rem' }}>
                <Square size={16} /> Stop Session
              </button>
            </div>
          ) : (
            <div style={{ marginBottom: '1.5rem' }}>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
                Select a category to start tracking your working hours:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.75rem' }}>
                <button onClick={() => handleStartWorkSession('Coding')} className="btn btn-secondary" style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-start', padding: '0.6rem 0.85rem' }}>
                  <Code size={16} style={{ color: 'var(--primary)' }} /> Coding
                </button>
                <button onClick={() => handleStartWorkSession('Learning')} className="btn btn-secondary" style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-start', padding: '0.6rem 0.85rem' }}>
                  <BookOpen size={16} style={{ color: 'var(--success)' }} /> Learning
                </button>
                <button onClick={() => handleStartWorkSession('Meeting')} className="btn btn-secondary" style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-start', padding: '0.6rem 0.85rem' }}>
                  <Users size={16} style={{ color: 'var(--warning)' }} /> Meeting
                </button>
                <button onClick={() => handleStartWorkSession('Other')} className="btn btn-secondary" style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-start', padding: '0.6rem 0.85rem' }}>
                  <Clock size={16} style={{ color: 'var(--text-secondary)' }} /> Other
                </button>
              </div>
            </div>
          )}

          {/* Daily Work Sessions List */}
          <h4 style={{ fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', paddingTop: '1rem', marginBottom: '0.75rem' }}>
            Today's Sessions
          </h4>
          {workSessions.length === 0 ? (
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No work sessions logged today.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', maxHeight: '180px', overflowY: 'auto' }}>
              {workSessions.map((session, index) => (
                <div key={session._id || index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: session.category === 'Coding' ? 'var(--primary)' : session.category === 'Learning' ? 'var(--success)' : session.category === 'Meeting' ? 'var(--warning)' : 'var(--text-secondary)' }}></span>
                    <span style={{ fontWeight: 600 }}>{session.category}</span>
                    <span style={{ color: 'var(--text-muted)' }}>
                      {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - {session.endTime ? new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Active'}
                    </span>
                  </div>
                  <span style={{ fontWeight: 700 }}>
                    {session.endTime ? formatDuration(session.duration) : 'Tracking...'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Expenses categories breakdown card */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Spending Breakdown (This Month)</h3>
            </div>
            
            {Object.keys(spending.categoryTotals).length === 0 ? (
              <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                No expenses logged this month yet.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', marginBottom: '1.5rem' }}>
                {Object.entries(spending.categoryTotals).map(([cat, amount]) => {
                  const percent = Math.min(100, Math.round((amount / (spending.monthlyTotal || 1)) * 100));
                  let color = 'var(--primary)';
                  if (cat === 'Food') color = 'var(--warning)';
                  if (cat === 'Travel') color = 'var(--success)';
                  if (cat === 'Shopping') color = 'var(--danger)';
                  if (cat === 'Bills') color = '#a855f7';

                  return (
                    <div key={cat} style={{ fontSize: '0.85rem' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontWeight: 500 }}>
                        <span>{cat}</span>
                        <span style={{ fontWeight: 600 }}>₹{amount} ({percent}%)</span>
                      </div>
                      <div style={{ width: '100%', height: '8px', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                        <div style={{ width: `${percent}%`, height: '100%', backgroundColor: color, borderRadius: 'var(--radius-full)' }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <button 
            onClick={() => setIsSpendingModalOpen(true)}
            className="btn btn-primary" 
            style={{ width: '100%', display: 'flex', gap: '0.5rem', justifyContent: 'center' }}
          >
            <Plus size={18} />
            <span>Add Today's Spending</span>
          </button>
        </div>
      </div>

      {/* Floating Action Button (for mobile focus) */}
      <button 
        onClick={() => setIsSpendingModalOpen(true)} 
        className="fab"
        title="Add Expense"
      >
        <Plus size={24} />
      </button>

      <SpendingModal 
        isOpen={isSpendingModalOpen} 
        onClose={() => setIsSpendingModalOpen(false)}
        onAddExpense={handleAddExpenseSubmit}
      />
    </div>
  );
};

export default Dashboard;
