import React, { useState, useEffect, useCallback } from 'react';
import { 
  Bot, RefreshCw, CheckCircle2, AlertCircle, XCircle, 
  Calendar, Briefcase, Mail, Building, Video, Phone, 
  MapPin, Clock, ArrowRight, ShieldAlert, AlertTriangle
} from 'lucide-react';

const AiYouDashboard = ({ user }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [loadingSync, setLoadingSync] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState('');
  const [notifications, setNotifications] = useState([]);
  const [interviews, setInterviews] = useState([]);
  const [activities, setActivities] = useState([]);
  const [loadingData, setLoadingData] = useState(true);

  const token = localStorage.getItem('lifetrack_token');

  // Fetch connection status
  const checkConnectionStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/gmail/status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setIsConnected(data.connected);
      }
    } catch (err) {
      console.error('Error checking Gmail connection:', err);
    }
  }, [token]);

  // Fetch all dashboard data
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoadingData(true);
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [resNotif, resInterviews, resActivities] = await Promise.all([
        fetch('/api/gmail/notifications', { headers }),
        fetch('/api/gmail/interviews', { headers }),
        fetch('/api/gmail/activities', { headers })
      ]);

      if (resNotif.ok) setNotifications(await resNotif.json());
      if (resInterviews.ok) setInterviews(await resInterviews.json());
      if (resActivities.ok) setActivities(await resActivities.json());
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
    } finally {
      setLoadingData(false);
    }
  }, [token]);

  useEffect(() => {
    checkConnectionStatus();
    fetchDashboardData();
  }, [checkConnectionStatus, fetchDashboardData]);

  // Handle Gmail connect redirect
  const handleConnectGmail = () => {
    if (!token) return;
    window.location.href = `/api/gmail/login?token=${token}`;
  };

  // Handle Gmail disconnect
  const handleDisconnectGmail = async () => {
    if (!window.confirm('Are you sure you want to disconnect Gmail?')) return;
    try {
      const res = await fetch('/api/gmail/disconnect', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setIsConnected(false);
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Error disconnecting Gmail:', err);
    }
  };

  // Trigger Sync
  const handleSync = async () => {
    if (loadingSync) return;
    setLoadingSync(true);
    setSyncStatusMsg('Agent checking Gmail inbox...');
    try {
      const res = await fetch('/api/gmail/sync', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'simulated') {
          setSyncStatusMsg('Sync simulated! Mock data loaded.');
        } else {
          setSyncStatusMsg(`Sync complete! Processed ${data.newCount} job email(s).`);
        }
        // Refresh connection status & data
        checkConnectionStatus();
        fetchDashboardData();
      } else {
        setSyncStatusMsg('Sync failed. Please check backend config.');
      }
    } catch (err) {
      console.error('Error running sync:', err);
      setSyncStatusMsg('Sync failed.');
    } finally {
      setTimeout(() => {
        setLoadingSync(false);
        setSyncStatusMsg('');
      }, 3000);
    }
  };

  // Helper to mark notification as read
  const handleMarkAsRead = async (id) => {
    try {
      const res = await fetch(`/api/gmail/read/${id}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchDashboardData();
      }
    } catch (err) {
      console.error('Error marking as read:', err);
    }
  };

  const getClassificationBadge = (classification) => {
    switch (classification) {
      case 'interview_invite':
      case 'interview_schedule':
        return <span className="badge badge-success">Interview Invitation</span>;
      case 'shortlisted':
        return <span className="badge badge-success" style={{ backgroundColor: 'rgba(16, 185, 129, 0.2)', color: '#10b981' }}>Shortlisted</span>;
      case 'recruiter_message':
        return <span className="badge badge-warning">Recruiter Msg</span>;
      case 'application_update':
        return <span className="badge badge-warning" style={{ backgroundColor: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' }}>Application Update</span>;
      case 'rejection':
        return <span className="badge badge-danger">Rejection</span>;
      default:
        return <span className="badge badge-secondary">Job Related</span>;
    }
  };

  const getInterviewIcon = (type) => {
    switch (type?.toLowerCase()) {
      case 'online':
        return <Video size={16} className="text-success" />;
      case 'phone':
        return <Phone size={16} className="text-warning" />;
      default:
        return <MapPin size={16} className="text-primary" />;
    }
  };

  return (
    <div className="main-content" style={{ paddingBottom: '6rem' }}>
      {/* Dashboard Top Header bar */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '1rem',
        marginBottom: '2rem',
        borderBottom: '1px solid var(--border)',
        paddingBottom: '1rem'
      }}>
        <div>
          <h1 style={{ fontSize: '1.8rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Bot size={32} style={{ color: 'var(--primary)' }} />
            AI YOU
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Personal Autonomous Job Agent
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {/* Gmail OAuth connection status toggle */}
          {isConnected ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--success-light)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
              <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--success)' }}>Gmail Connected</span>
              <button 
                onClick={handleDisconnectGmail} 
                className="btn btn-secondary" 
                style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', marginLeft: '0.5rem' }}
              >
                Disconnect
              </button>
            </div>
          ) : (
            <button 
              onClick={handleConnectGmail} 
              className="btn btn-secondary" 
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', borderColor: 'var(--warning)' }}
            >
              <AlertCircle size={16} style={{ color: 'var(--warning)' }} />
              <span style={{ color: 'var(--text-primary)', fontSize: '0.85rem' }}>Connect Gmail</span>
            </button>
          )}

          {/* Sync Button */}
          <button 
            onClick={handleSync} 
            disabled={loadingSync}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '120px' }}
          >
            <RefreshCw size={16} className={loadingSync ? 'anim-pulse' : ''} />
            <span>{loadingSync ? 'Syncing...' : 'Sync Emails'}</span>
          </button>
        </div>
      </div>

      {syncStatusMsg && (
        <div style={{
          padding: '0.75rem 1.25rem',
          backgroundColor: 'var(--primary-light)',
          color: 'var(--primary)',
          borderRadius: 'var(--radius-md)',
          marginBottom: '1.5rem',
          fontSize: '0.9rem',
          fontWeight: 500,
          border: '1px solid rgba(59, 130, 246, 0.2)',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <Bot size={18} className="anim-pulse" />
          {syncStatusMsg}
        </div>
      )}

      {/* Overview Cards Grid */}
      <div className="dashboard-grid" style={{ marginBottom: '2rem' }}>
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>INTERVIEWS</span>
              <h2 style={{ fontSize: '2rem', marginTop: '0.25rem' }}>{interviews.length}</h2>
            </div>
            <div style={{ backgroundColor: 'var(--success-light)', color: 'var(--success)', padding: '0.6rem', borderRadius: '50%' }}>
              <Calendar size={22} />
            </div>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Upcoming interview events detected</p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>JOB MATCHES</span>
              <h2 style={{ fontSize: '2rem', marginTop: '0.25rem' }}>0</h2>
            </div>
            <div style={{ backgroundColor: 'var(--primary-light)', color: 'var(--primary)', padding: '0.6rem', borderRadius: '50%' }}>
              <Briefcase size={22} />
            </div>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Matching jobs from Phase 3</p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>APPLICATIONS</span>
              <h2 style={{ fontSize: '2rem', marginTop: '0.25rem' }}>0</h2>
            </div>
            <div style={{ backgroundColor: 'var(--warning-light)', color: 'var(--warning)', padding: '0.6rem', borderRadius: '50%' }}>
              <Mail size={22} />
            </div>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>Prepared/submitted job applications</p>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>AGENT STATUS</span>
              <h2 style={{ fontSize: '1.25rem', marginTop: '0.75rem', color: isConnected ? 'var(--success)' : 'var(--warning)' }}>
                {isConnected ? 'MONITORING' : 'DEMO MODE'}
              </h2>
            </div>
            <div style={{ 
              backgroundColor: isConnected ? 'var(--success-light)' : 'var(--warning-light)', 
              color: isConnected ? 'var(--success)' : 'var(--warning)', 
              padding: '0.6rem', 
              borderRadius: '50%' 
            }}>
              <Bot size={22} />
            </div>
          </div>
          <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            {isConnected ? 'Connected to Gmail API' : 'Configure Google Client ID in .env'}
          </p>
        </div>
      </div>

      {/* Main Grid: Left column (Interviews & Notifications) | Right column (Activity logs) */}
      <div className="analytics-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Upcoming Interviews widget */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Calendar size={18} style={{ color: 'var(--success)' }} />
              Upcoming Interviews
            </h3>
            
            {loadingData ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading interviews...</p>
            ) : interviews.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-secondary)' }}>
                <Calendar size={32} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                <p style={{ fontSize: '0.9rem' }}>No upcoming interviews detected yet.</p>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Sync your emails or connect your Gmail account to search.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {interviews.map((item) => (
                  <div 
                    key={item._id} 
                    style={{
                      padding: '1rem',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      backgroundColor: 'var(--bg-tertiary)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.5rem'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <h4 style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          {item.extractedDetails.jobRole || 'Software Developer'}
                        </h4>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.25rem', marginTop: '0.1rem' }}>
                          <Building size={14} />
                          {item.extractedDetails.companyName || 'Unknown Company'}
                        </span>
                      </div>
                      <span className="badge badge-success" style={{ textTransform: 'uppercase', fontSize: '0.7rem' }}>
                        {item.extractedDetails.interviewType || 'Online'}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.25rem', borderTop: '1px solid var(--border)', paddingTop: '0.5rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Calendar size={13} />
                        {item.extractedDetails.interviewDate || 'TBD'}
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <Clock size={13} />
                        {item.extractedDetails.interviewTime || 'TBD'}
                      </span>
                      {item.extractedDetails.locationOrLink && (
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '200px' }}>
                          {getInterviewIcon(item.extractedDetails.interviewType)}
                          {item.extractedDetails.locationOrLink.startsWith('http') ? (
                            <a href={item.extractedDetails.locationOrLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--primary)', textDecoration: 'underline' }}>
                              Join Call Link
                            </a>
                          ) : (
                            item.extractedDetails.locationOrLink
                          )}
                        </span>
                      )}
                    </div>

                    {item.extractedDetails.importantInstructions && (
                      <div style={{ padding: '0.5rem 0.75rem', backgroundColor: 'var(--bg-secondary)', borderLeft: '3px solid var(--warning)', borderRadius: '0 var(--radius-sm) var(--radius-sm) 0', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                        <strong>Instructions:</strong> {item.extractedDetails.importantInstructions}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Job Alerts / Notifications widget */}
          <div className="card">
            <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Mail size={18} style={{ color: 'var(--primary)' }} />
              Agent Notifications
            </h3>

            {loadingData ? (
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading notifications...</p>
            ) : notifications.length === 0 ? (
              <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '1rem 0' }}>
                No notifications logged.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {notifications.map((notif) => (
                  <div 
                    key={notif._id} 
                    style={{
                      padding: '0.75rem 1rem',
                      border: '1px solid var(--border)',
                      borderRadius: 'var(--radius-md)',
                      opacity: notif.status === 'read' ? 0.7 : 1,
                      backgroundColor: notif.status === 'read' ? 'transparent' : 'var(--primary-light)',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem',
                      position: 'relative'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        From: {notif.from}
                      </span>
                      {getClassificationBadge(notif.classification)}
                    </div>
                    <h4 style={{ fontSize: '0.9rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {notif.subject}
                    </h4>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {notif.snippet}
                    </p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.5rem', borderTop: '1px dotted var(--border)', paddingTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      <span>Received: {new Date(notif.receivedAt).toLocaleDateString()}</span>
                      {notif.status === 'unread' && (
                        <button 
                          onClick={() => handleMarkAsRead(notif._id)} 
                          style={{
                            border: 'none',
                            background: 'none',
                            color: 'var(--primary)',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          Mark read
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: Live Agent activity logs */}
        <div className="card" style={{ height: 'fit-content' }}>
          <h3 style={{ fontSize: '1.1rem', marginBottom: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Bot size={20} style={{ color: 'var(--primary)' }} />
            Agent Activity Logs
          </h3>

          {loadingData ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Loading activities...</p>
          ) : activities.length === 0 ? (
            <p style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.9rem', padding: '2rem 0' }}>
              No activity logs. Start syncing emails.
            </p>
          ) : (
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '1rem',
              borderLeft: '2px solid var(--border)',
              paddingLeft: '1rem',
              marginLeft: '0.5rem'
            }}>
              {activities.map((act) => (
                <div key={act._id} style={{ position: 'relative' }}>
                  {/* Circle marker on timeline */}
                  <div style={{
                    position: 'absolute',
                    left: 'calc(-1rem - 6px)',
                    top: '4px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: act.action.includes('error') ? 'var(--danger)' : 'var(--primary)',
                    border: '2px solid var(--bg-secondary)'
                  }} />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {new Date(act.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)', marginTop: '0.1rem', fontWeight: 500 }}>
                    {act.details}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AiYouDashboard;
