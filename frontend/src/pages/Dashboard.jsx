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

      // Background Google Fit sync if connected
      if (user && user.isGoogleFitConnected) {
        try {
          await fetch('/api/auth/google/google-sync', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ date: todayStr })
          });
        } catch (syncErr) {
          console.warn('Background Google Fit sync failed:', syncErr);
        }
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

  const getOfficeMs = () => {
    if (!attendance) return 0;
    if (attendance.departureTime) return attendance.officeDuration;
    const duration = new Date().getTime() - new Date(attendance.arrivalTime).getTime();
    return duration > 0 ? duration : 0;
  };

  const officeMs = getOfficeMs();
  const officePercent = Math.min(100, Math.round((officeMs / (8 * 3600000)) * 100)); // Target 8 hrs
  const stepsPercent = Math.min(100, Math.round(((activity?.steps || 0) / 8000) * 100)); // Target 8000
  const budgetPercent = Math.min(100, Math.round((Math.max(0, 10000 - spending.monthlyTotal) / 10000) * 100)); // Target 10k budget remaining

  const getHeaderDate = () => {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const d = new Date();
    return `${days[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
  };

  return (
    <div className="dashboard-wrapper-dark">
      {/* Radial glow background washes */}
      <div className="glow-wash-1"></div>
      <div className="glow-wash-2"></div>

      <style>{`
        .dashboard-wrapper-dark {
          position: relative;
          background-color: #000000;
          color: #ffffff;
          min-height: 100vh;
          padding: 1.5rem 1rem;
          font-family: -apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Pro Icons", "Helvetica Neue", Helvetica, Arial, sans-serif;
          overflow: hidden;
        }

        .glow-wash-1 {
          position: absolute;
          top: -10%;
          right: -10%;
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, rgba(0,0,0,0) 70%);
          pointer-events: none;
          z-index: 0;
          filter: blur(40px);
        }

        .glow-wash-2 {
          position: absolute;
          bottom: 10%;
          left: -10%;
          width: 350px;
          height: 350px;
          background: radial-gradient(circle, rgba(6, 182, 212, 0.1) 0%, rgba(0,0,0,0) 70%);
          pointer-events: none;
          z-index: 0;
          filter: blur(40px);
        }

        .phone-tilt-wrapper {
          position: relative;
          z-index: 1;
          max-width: 1200px;
          margin: 0 auto;
          background: #08080c;
          border-radius: 28px;
          border: 1px solid rgba(255, 255, 255, 0.08);
          box-shadow: 0 30px 60px rgba(0, 0, 0, 0.8), inset 0 1px 0 0 rgba(255, 255, 255, 0.05);
          padding: 2rem 1.5rem;
          transition: transform 0.6s cubic-bezier(0.16, 1, 0.3, 1), box-shadow 0.6s ease;
        }

        @media (min-width: 992px) {
          .phone-tilt-wrapper {
            transform: perspective(1200px) rotateX(1.5deg) rotateY(-2deg) rotateZ(0.5deg);
          }
          .phone-tilt-wrapper:hover {
            transform: perspective(1200px) rotateX(0deg) rotateY(0deg) rotateZ(0deg);
            box-shadow: 0 40px 80px rgba(0, 0, 0, 0.9);
          }
        }

        .dashboard-layout-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }

        @media (min-width: 992px) {
          .dashboard-layout-grid {
            grid-template-columns: 1.1fr 1.3fr;
          }
        }

        .glass-card-raised {
          background: linear-gradient(135deg, rgba(28, 28, 30, 0.75) 0%, rgba(18, 18, 20, 0.95) 100%);
          border: 1px solid rgba(255, 255, 255, 0.06);
          box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.1), 0 8px 24px rgba(0, 0, 0, 0.5);
          border-radius: 20px;
          padding: 1.25rem;
          backdrop-filter: blur(20px);
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }

        .glass-card-raised:hover {
          transform: translateY(-2px);
          box-shadow: inset 0 1px 0 0 rgba(255, 255, 255, 0.15), 0 12px 30px rgba(0, 0, 0, 0.6);
        }

        .icon-chip-glow {
          width: 36px;
          height: 36px;
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
        }

        .icon-chip-glow.purple {
          background: rgba(168, 85, 247, 0.2);
          border: 1px solid rgba(168, 85, 247, 0.4);
          filter: drop-shadow(0 0 6px rgba(168, 85, 247, 0.7));
        }

        .icon-chip-glow.orange {
          background: rgba(245, 158, 11, 0.2);
          border: 1px solid rgba(245, 158, 11, 0.4);
          filter: drop-shadow(0 0 6px rgba(245, 158, 11, 0.7));
        }

        .icon-chip-glow.green {
          background: rgba(16, 185, 129, 0.2);
          border: 1px solid rgba(16, 185, 129, 0.4);
          filter: drop-shadow(0 0 6px rgba(16, 185, 129, 0.7));
        }

        .icon-chip-glow.red {
          background: rgba(239, 68, 68, 0.2);
          border: 1px solid rgba(239, 68, 68, 0.4);
          filter: drop-shadow(0 0 6px rgba(239, 68, 68, 0.7));
        }

        .search-container {
          display: flex;
          align-items: center;
          background-color: #1c1c1e;
          border-radius: 10px;
          padding: 0.5rem 0.75rem;
          margin-bottom: 1.5rem;
          border: 1px solid rgba(255,255,255,0.03);
        }

        .search-input {
          background: transparent;
          border: none;
          color: #ffffff;
          font-size: 0.9rem;
          margin-left: 0.5rem;
          width: 100%;
          outline: none;
        }

        .search-input::placeholder {
          color: #8e8e93;
        }
      `}</style>

      {/* 3D phone wrapper */}
      <div className="phone-tilt-wrapper">
        
        {/* Date Greet Row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
          <span style={{ fontSize: '0.8rem', color: '#8e8e93', fontWeight: 500 }}>{getHeaderDate()}</span>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.85rem',
            fontWeight: 700,
            color: '#fff',
            filter: 'drop-shadow(0 0 6px rgba(139, 92, 246, 0.6))'
          }}>
            {user?.name ? user.name[0].toUpperCase() : 'U'}
          </div>
        </div>

        {/* Title */}
        <h1 style={{ fontSize: '2.25rem', fontWeight: 850, margin: '0 0 1rem 0', fontFamily: 'inherit', letterSpacing: '-0.03em' }}>
          Summary
        </h1>

        {/* Search Bar */}
        <div className="search-container">
          <span style={{ color: '#8e8e93', fontSize: '0.85rem' }}>🔍</span>
          <input type="text" className="search-input" placeholder="Search" />
        </div>

        {/* Main Grid Division */}
        <div className="dashboard-layout-grid">
          
          {/* Left Column: Rings + Highlights + Geofence */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Rings Widget Card */}
            <div className="glass-card-raised">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Today's Rings</h3>
                <span style={{ fontSize: '0.85rem', color: '#0a84ff', fontWeight: 600, cursor: 'pointer' }}>Show More ›</span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem', flexWrap: 'wrap' }}>
                {/* SVG Concentric Activity Rings */}
                <div style={{ flexShrink: 0, position: 'relative', width: '130px', height: '130px', margin: '0 auto' }}>
                  <svg width="130" height="130" viewBox="0 0 130 130">
                    {/* Background tracks */}
                    <circle cx="65" cy="65" r="50" fill="none" stroke="rgba(255, 45, 85, 0.12)" strokeWidth="12" />
                    <circle cx="65" cy="65" r="36" fill="none" stroke="rgba(76, 217, 100, 0.12)" strokeWidth="12" />
                    <circle cx="65" cy="65" r="22" fill="none" stroke="rgba(90, 200, 250, 0.12)" strokeWidth="12" />

                    {/* Foreground progress loops */}
                    {/* Office Progress - Pink */}
                    <circle
                      cx="65"
                      cy="65"
                      r="50"
                      fill="none"
                      stroke="#ff2d55"
                      strokeWidth="12"
                      strokeDasharray={2 * Math.PI * 50}
                      strokeDashoffset={2 * Math.PI * 50 - (Math.min(officePercent / 100, 0.999) * (2 * Math.PI * 50))}
                      strokeLinecap="round"
                      transform="rotate(-90 65 65)"
                      style={{ filter: 'drop-shadow(0 0 6px #ff2d55)', transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                    />
                    {/* Steps Progress - Green */}
                    <circle
                      cx="65"
                      cy="65"
                      r="36"
                      fill="none"
                      stroke="#4cd964"
                      strokeWidth="12"
                      strokeDasharray={2 * Math.PI * 36}
                      strokeDashoffset={2 * Math.PI * 36 - (Math.min(stepsPercent / 100, 0.999) * (2 * Math.PI * 36))}
                      strokeLinecap="round"
                      transform="rotate(-90 65 65)"
                      style={{ filter: 'drop-shadow(0 0 6px #4cd964)', transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                    />
                    {/* Budget Progress - Cyan */}
                    <circle
                      cx="65"
                      cy="65"
                      r="22"
                      fill="none"
                      stroke="#5ac8fa"
                      strokeWidth="12"
                      strokeDasharray={2 * Math.PI * 22}
                      strokeDashoffset={2 * Math.PI * 22 - (Math.min(budgetPercent / 100, 0.999) * (2 * Math.PI * 22))}
                      strokeLinecap="round"
                      transform="rotate(-90 65 65)"
                      style={{ filter: 'drop-shadow(0 0 6px #5ac8fa)', transition: 'stroke-dashoffset 0.5s ease-in-out' }}
                    />
                  </svg>
                </div>

                {/* Labels and values */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.85rem', flex: 1, minWidth: '150px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#ff2d55', filter: 'drop-shadow(0 0 3px #ff2d55)' }}></span>
                    <span style={{ color: '#8e8e93' }}>Office Time</span>
                    <span style={{ fontWeight: 600, marginLeft: 'auto' }}>{getOfficeDuration()}/8h</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#4cd964', filter: 'drop-shadow(0 0 3px #4cd964)' }}></span>
                    <span style={{ color: '#8e8e93' }}>Steps</span>
                    <span style={{ fontWeight: 600, marginLeft: 'auto' }}>{activity?.steps?.toLocaleString() || 0}/8,000</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#5ac8fa', filter: 'drop-shadow(0 0 3px #5ac8fa)' }}></span>
                    <span style={{ color: '#8e8e93' }}>Budget Left</span>
                    <span style={{ fontWeight: 600, marginLeft: 'auto' }}>{budgetPercent}%</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Highlights List Card */}
            <div className="glass-card-raised">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Highlights</h2>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
                  <div className="icon-chip-glow purple">
                    <Building size={16} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>First arrival</span>
                    <span style={{ fontSize: '0.75rem', color: '#8e8e93' }}>
                      {attendance ? `Today, ${new Date(attendance.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase()}` : 'Not checked in yet'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                  <div className="icon-chip-glow orange">
                    <Footprints size={16} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Step logs</span>
                    <span style={{ fontSize: '0.75rem', color: '#8e8e93' }}>
                      {activity?.steps > 0 ? `Today: ${activity.steps.toLocaleString()} steps logged` : 'No steps recorded today'}
                    </span>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '1rem' }}>
                  <div className="icon-chip-glow green">
                    <Wallet size={16} />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>On track with budget</span>
                    <span style={{ fontSize: '0.75rem', color: '#8e8e93' }}>
                      Spent ₹{spending.monthlyTotal.toLocaleString()} of ₹10,000 limit
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Geofence Status Toggle */}
            <div className="glass-card-raised" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0 }}>Geofence Check-in</h3>
                <p style={{ fontSize: '0.75rem', color: '#8e8e93', margin: '0.15rem 0 0 0' }}>
                  GPS: {geoStatus}
                </p>
              </div>
              <label className="switch" style={{ position: 'relative', display: 'inline-block', width: '50px', height: '26px' }}>
                <input 
                  type="checkbox" 
                  checked={trackingEnabled}
                  onChange={toggleLocationTracking}
                  style={{ opacity: 0, width: 0, height: 0 }}
                />
                <span className="slider" style={{
                  position: 'absolute', cursor: 'pointer', top: 0, left: 0, right: 0, bottom: 0,
                  backgroundColor: trackingEnabled ? '#34c759' : '#3a3a3c', borderRadius: '34px',
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

          {/* Right Column: Favorites Grid + Stopwatch + Budget Breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* Favorites Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, letterSpacing: '-0.02em' }}>Favorites</h2>
              <span style={{ fontSize: '0.9rem', color: '#0a84ff', fontWeight: 600, cursor: 'pointer' }}>Edit</span>
            </div>

            {/* Favorites Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              {/* Office Time Card */}
              <div className="glass-card-raised" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div className="icon-chip-glow purple">
                  <Building size={18} />
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#8e8e93', marginTop: '0.25rem' }}>Office Time</span>
                <h4 style={{ fontSize: '1.5rem', fontWeight: 850, margin: 0 }}>{getOfficeDuration()}</h4>
                <span style={{ fontSize: '0.7rem', color: '#636366', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {attendance ? `Arrival ${new Date(attendance.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }).toLowerCase()}` : 'Not checked in'}
                </span>
              </div>

              {/* Steps Card */}
              <div className="glass-card-raised" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div className="icon-chip-glow orange">
                  <Footprints size={18} />
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#8e8e93', marginTop: '0.25rem' }}>Steps</span>
                <h4 style={{ fontSize: '1.5rem', fontWeight: 850, margin: 0 }}>{activity?.steps?.toLocaleString() || '0'}</h4>
                <span style={{ fontSize: '0.7rem', color: '#636366' }}>
                  Dist: {activity?.walkingDistance?.toFixed(1) || 0.0} km
                </span>
              </div>

              {/* Spending Card */}
              <div className="glass-card-raised" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div className="icon-chip-glow green">
                  <Wallet size={18} />
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#8e8e93', marginTop: '0.25rem' }}>Spending</span>
                <h4 style={{ fontSize: '1.5rem', fontWeight: 850, margin: 0 }}>₹{spending.todayTotal}</h4>
                <span style={{ fontSize: '0.7rem', color: '#636366' }}>
                  Limit left: ₹{Math.max(0, 10000 - spending.monthlyTotal).toLocaleString()}
                </span>
              </div>

              {/* Work Sessions Card */}
              <div className="glass-card-raised" style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <div className="icon-chip-glow red">
                  <Clock size={18} />
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#8e8e93', marginTop: '0.25rem' }}>Work Hours</span>
                <h4 style={{ fontSize: '1.5rem', fontWeight: 850, margin: 0 }}>{formatDuration(getTotalWorkDuration())}</h4>
                <span style={{ fontSize: '0.7rem', color: '#636366' }}>
                  Coding: {formatDuration(catWorkTotals.Coding)}
                </span>
              </div>
            </div>

            {/* Controls: Work Session Stopwatch */}
            <div className="glass-card-raised">
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700, marginBottom: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Clock size={18} style={{ color: '#ff2d55' }} />
                Work Session Timer
              </h3>

              {activeSession ? (
                <div style={{ backgroundColor: 'rgba(255, 45, 85, 0.1)', border: '1px solid rgba(255, 45, 85, 0.3)', borderRadius: '12px', padding: '0.85rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#ff2d55' }}>RUNNING SESSION</span>
                    <h4 style={{ fontSize: '1rem', fontWeight: 700, margin: '0.15rem 0 0 0' }}>{activeSession.category}</h4>
                  </div>
                  <button onClick={handleStopWorkSession} className="btn btn-danger" style={{ display: 'flex', gap: '0.4rem', padding: '0.4rem 0.85rem', fontSize: '0.8rem', borderRadius: '8px' }}>
                    <Square size={14} /> Stop
                  </button>
                </div>
              ) : (
                <div>
                  <p style={{ fontSize: '0.8rem', color: '#8e8e93', marginBottom: '0.85rem' }}>
                    Select a category to start tracking:
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '0.5rem' }}>
                    <button onClick={() => handleStartWorkSession('Coding')} className="btn btn-secondary" style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.8rem', backgroundColor: '#1c1c1e', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}>
                      <Code size={14} style={{ color: '#30d158' }} /> Coding
                    </button>
                    <button onClick={() => handleStartWorkSession('Learning')} className="btn btn-secondary" style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.8rem', backgroundColor: '#1c1c1e', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}>
                      <BookOpen size={14} style={{ color: '#0a84ff' }} /> Learning
                    </button>
                    <button onClick={() => handleStartWorkSession('Meeting')} className="btn btn-secondary" style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.8rem', backgroundColor: '#1c1c1e', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}>
                      <Users size={14} style={{ color: '#ffd60a' }} /> Meeting
                    </button>
                    <button onClick={() => handleStartWorkSession('Other')} className="btn btn-secondary" style={{ display: 'flex', gap: '0.4rem', justifyContent: 'flex-start', padding: '0.5rem 0.75rem', fontSize: '0.8rem', backgroundColor: '#1c1c1e', border: '1px solid rgba(255,255,255,0.05)', color: '#fff' }}>
                      <Clock size={14} style={{ color: '#8e8e93' }} /> Other
                    </button>
                  </div>
                </div>
              )}

              {/* Today's Work list */}
              {workSessions.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '0.85rem', maxHeight: '140px', overflowY: 'auto' }}>
                  {workSessions.map((session, index) => (
                    <div key={session._id || index} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#a1a1aa' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: session.category === 'Coding' ? '#30d158' : session.category === 'Learning' ? '#0a84ff' : session.category === 'Meeting' ? '#ffd60a' : '#8e8e93' }}></span>
                        <span style={{ fontWeight: 600, color: '#fff' }}>{session.category}</span>
                      </div>
                      <span style={{ fontWeight: 700 }}>
                        {session.endTime ? formatDuration(session.duration) : 'Active'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Controls: Spending Category Breakdown */}
            <div className="glass-card-raised">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h3 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0 }}>Budget Allocation</h3>
                <button 
                  onClick={() => setIsSpendingModalOpen(true)}
                  style={{
                    background: 'rgba(10, 132, 255, 0.15)',
                    border: 'none',
                    borderRadius: '8px',
                    color: '#0a84ff',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    padding: '0.35rem 0.75rem',
                    cursor: 'pointer'
                  }}
                >
                  + Add Cost
                </button>
              </div>

              {Object.keys(spending.categoryTotals).length === 0 ? (
                <div style={{ padding: '1rem 0', textAlign: 'center', color: '#8e8e93', fontSize: '0.8rem', fontStyle: 'italic' }}>
                  No expenses logged this month yet.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {Object.entries(spending.categoryTotals).map(([cat, amount]) => {
                    const percent = Math.min(100, Math.round((amount / (spending.monthlyTotal || 1)) * 100));
                    let color = '#0a84ff';
                    if (cat === 'Food') color = '#ffd60a';
                    if (cat === 'Travel') color = '#30d158';
                    if (cat === 'Shopping') color = '#ff453a';
                    if (cat === 'Bills') color = '#bf5af2';

                    return (
                      <div key={cat} style={{ fontSize: '0.8rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.2rem' }}>
                          <span style={{ fontWeight: 500 }}>{cat}</span>
                          <span style={{ fontWeight: 600 }}>₹{amount} ({percent}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '6px', backgroundColor: '#1c1c1e', borderRadius: '4px', overflow: 'hidden' }}>
                          <div style={{ width: `${percent}%`, height: '100%', backgroundColor: color, borderRadius: '4px' }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

          </div>

        </div>

      </div>

      <SpendingModal 
        isOpen={isSpendingModalOpen} 
        onClose={() => setIsSpendingModalOpen(false)}
        onAddExpense={handleAddExpenseSubmit}
      />
    </div>
  );
};

export default Dashboard;
