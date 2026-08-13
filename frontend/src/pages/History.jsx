import React, { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Building, Footprints, Clock, Wallet, Trash2 } from 'lucide-react';

const History = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [loading, setLoading] = useState(false);
  
  // Historical data loaded from backend
  const [expenses, setExpenses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [activities, setActivities] = useState([]);
  const [workSessions, setWorkSessions] = useState([]);
  
  // Selected day for the detailed view modal/panel
  const [selectedDateStr, setSelectedDateStr] = useState(new Date().toISOString().split('T')[0]);

  const token = localStorage.getItem('lifetrack_token');

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const headers = { 'Authorization': `Bearer ${token}` };

      // Parallel fetching of all history
      const [expenseRes, attendanceRes, activityRes, workRes] = await Promise.all([
        fetch('/api/expense/history', { headers }),
        fetch('/api/attendance/history', { headers }),
        fetch('/api/activity/history', { headers }),
        fetch('/api/work/history', { headers }),
      ]);

      if (expenseRes.ok) setExpenses(await expenseRes.json());
      if (attendanceRes.ok) setAttendance(await attendanceRes.json());
      if (activityRes.ok) setActivities(await activityRes.json());
      if (workRes.ok) setWorkSessions(await workRes.json());

    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handlePrevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  // Calendar calculations
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 is Sunday, 1 is Monday...
  // Convert Sunday index so calendar starts on Monday (Monday = 0, Sunday = 6)
  const adjustedFirstDayIndex = firstDayIndex === 0 ? 6 : firstDayIndex - 1;

  const totalDaysInMonth = new Date(year, month + 1, 0).getDate();

  // Create lookup maps by YYYY-MM-DD
  const formatIndexDate = (y, m, d) => {
    return `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  };

  const attendanceMap = {};
  attendance.forEach((att) => {
    attendanceMap[att.date] = att;
  });

  const expenseMap = {};
  expenses.forEach((exp) => {
    if (!expenseMap[exp.date]) expenseMap[exp.date] = [];
    expenseMap[exp.date].push(exp);
  });

  const activityMap = {};
  activities.forEach((act) => {
    activityMap[act.date] = act;
  });

  const workMap = {};
  workSessions.forEach((ws) => {
    if (!workMap[ws.date]) workMap[ws.date] = [];
    workMap[ws.date].push(ws);
  });

  // Math formatting helper
  const formatHours = (ms) => {
    if (!ms) return '';
    const mins = Math.floor(ms / 60000);
    const hrs = (mins / 60).toFixed(1);
    return `${hrs}h`;
  };

  const formatHoursDetailed = (ms) => {
    if (!ms) return '0h 0m';
    const mins = Math.floor(ms / 60000);
    const hrs = Math.floor(mins / 60);
    const remainingMins = mins % 60;
    return `${hrs}h ${remainingMins}m`;
  };

  // Detailed selected day report
  const selectedDayExpenses = expenseMap[selectedDateStr] || [];
  const selectedDayAttendance = attendanceMap[selectedDateStr] || null;
  const selectedDayActivity = activityMap[selectedDateStr] || null;
  const selectedDayWork = workMap[selectedDateStr] || [];

  const totalWorkMs = selectedDayWork.reduce((acc, ws) => {
    return acc + (ws.duration || 0);
  }, 0);

  const totalDaySpending = selectedDayExpenses.reduce((acc, exp) => acc + exp.amount, 0);

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Delete this expense?')) return;
    try {
      const response = await fetch(`/api/expense/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.ok) {
        setExpenses(expenses.filter(exp => exp._id !== id));
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Grid container splitting screen into Calendar (left) and Daily Detail report (right) */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '2rem' }}>
        
        {/* Calendar Card */}
        <div className="card">
          <div className="calendar-header" style={{ marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>
              {currentDate.toLocaleString('default', { month: 'long' })} {year}
            </h2>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button onClick={handlePrevMonth} className="btn btn-secondary btn-icon" style={{ width: '2.25rem', height: '2.25rem' }}>
                <ChevronLeft size={18} />
              </button>
              <button onClick={handleNextMonth} className="btn btn-secondary btn-icon" style={{ width: '2.25rem', height: '2.25rem' }}>
                <ChevronRight size={18} />
              </button>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem', textAlign: 'center', marginBottom: '0.5rem' }}>
            {['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'].map((d) => (
              <span key={d} style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)' }}>{d}</span>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '0.4rem' }}>
            {/* Empty days before 1st of month */}
            {Array.from({ length: adjustedFirstDayIndex }).map((_, i) => (
              <div key={`empty-${i}`} style={{ aspectRatio: '1', opacity: 0 }}></div>
            ))}

            {/* Days of Month */}
            {Array.from({ length: totalDaysInMonth }).map((_, i) => {
              const dayNum = i + 1;
              const dateStr = formatIndexDate(year, month, dayNum);
              const isToday = dateStr === new Date().toISOString().split('T')[0];
              const isSelected = dateStr === selectedDateStr;

              // Extract summaries for calendar cell
              const att = attendanceMap[dateStr];
              const officeHrs = att ? formatHours(att.officeDuration) : '';
              
              const dayExps = expenseMap[dateStr] || [];
              const spendingTotal = dayExps.reduce((sum, item) => sum + item.amount, 0);

              return (
                <div 
                  key={dateStr}
                  onClick={() => setSelectedDateStr(dateStr)}
                  className={`calendar-day-cell ${isToday ? 'today' : ''}`}
                  style={{
                    border: isSelected ? '2px solid var(--primary)' : '1px solid var(--border)',
                    backgroundColor: isSelected ? 'var(--primary-light)' : (isToday ? 'var(--bg-tertiary)' : 'var(--bg-secondary)'),
                    padding: '0.35rem',
                    minHeight: '65px',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    cursor: 'pointer'
                  }}
                >
                  <span style={{ 
                    fontWeight: 700, 
                    fontSize: '0.85rem', 
                    color: isSelected ? 'var(--primary)' : 'var(--text-primary)'
                  }}>{dayNum}</span>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', fontSize: '0.65rem', fontWeight: 600 }}>
                    {officeHrs && <span style={{ color: 'var(--success)' }}>{officeHrs}</span>}
                    {spendingTotal > 0 && <span style={{ color: 'var(--danger)' }}>₹{spendingTotal}</span>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Selected Date Summary Panel */}
        <div className="card" style={{ borderTop: '4px solid var(--primary)' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem', fontFamily: 'var(--font-display)' }}>
            Report: {new Date(selectedDateStr + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '1.25rem' }}>
            
            {/* Desktop columns layout for summary */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
              
              {/* Office Duration */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <Building size={18} style={{ color: 'var(--primary)', marginTop: '0.15rem' }} />
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>OFFICE</span>
                  {selectedDayAttendance ? (
                    <>
                      <h4 style={{ fontWeight: 700 }}>{formatHoursDetailed(selectedDayAttendance.officeDuration)}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        In: {new Date(selectedDayAttendance.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} <br/>
                        Out: {selectedDayAttendance.departureTime ? new Date(selectedDayAttendance.departureTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Present'}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No attendance logged</span>
                  )}
                </div>
              </div>

              {/* Activity Info */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <Footprints size={18} style={{ color: 'var(--success)', marginTop: '0.15rem' }} />
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>ACTIVITY</span>
                  {selectedDayActivity ? (
                    <>
                      <h4 style={{ fontWeight: 700 }}>{selectedDayActivity.steps?.toLocaleString() || 0} steps</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Distance: {selectedDayActivity.walkingDistance?.toFixed(1) || 0.0} km <br/>
                        Duration: {selectedDayActivity.walkingDuration || 0}m
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No activity sync logged</span>
                  )}
                </div>
              </div>

              {/* Working Hours */}
              <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'flex-start', padding: '1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                <Clock size={18} style={{ color: 'var(--warning)', marginTop: '0.15rem' }} />
                <div>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block' }}>WORKING TIME</span>
                  {totalWorkMs > 0 ? (
                    <>
                      <h4 style={{ fontWeight: 700 }}>{formatHoursDetailed(totalWorkMs)}</h4>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Sessions logged: {selectedDayWork.length}
                      </span>
                    </>
                  ) : (
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>No work sessions logged</span>
                  )}
                </div>
              </div>

            </div>

            {/* Expenses List */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  <Wallet size={16} style={{ color: 'var(--danger)' }} /> Expenses
                </h3>
                <span style={{ fontWeight: 700, color: 'var(--danger)', fontSize: '1.05rem' }}>Total: ₹{totalDaySpending}</span>
              </div>

              {selectedDayExpenses.length === 0 ? (
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>No expenses entered for this day.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {selectedDayExpenses.map((exp) => (
                    <div key={exp._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.85rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                      <div>
                        <span style={{ fontWeight: 600, marginRight: '0.5rem' }}>{exp.category}</span>
                        {exp.note && <span style={{ color: 'var(--text-secondary)' }}>({exp.note})</span>}
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                        <span style={{ fontWeight: 700 }}>₹{exp.amount}</span>
                        <button 
                          onClick={() => handleDeleteExpense(exp._id)}
                          className="btn btn-secondary" 
                          style={{ padding: '0.2rem', minHeight: 0, height: 'auto', color: 'var(--danger)', borderColor: 'transparent' }}
                          title="Delete Expense"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

          </div>
        </div>

      </div>

    </div>
  );
};

export default History;
