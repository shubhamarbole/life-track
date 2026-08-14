import React, { useState, useEffect } from 'react';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend, LineChart, Line 
} from 'recharts';
import { FileText, Calendar, Clock, Footprints, DollarSign, Award } from 'lucide-react';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#a855f7', '#06b6d4'];

const Analytics = () => {
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth());
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [loading, setLoading] = useState(false);

  // History states
  const [expenses, setExpenses] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [activities, setActivities] = useState([]);
  const [workSessions, setWorkSessions] = useState([]);

  const token = localStorage.getItem('lifetrack_token');

  const fetchData = async () => {
    try {
      setLoading(true);
      const headers = { 'Authorization': `Bearer ${token}` };
      const [expenseRes, attendanceRes, activityRes, workRes] = await Promise.all([
        fetch('/api/expense/history', { headers }),
        fetch('/api/attendance/history', { headers }),
        fetch('/api/activity/history', { headers }),
        fetch('/api/work/history', { headers })
      ]);

      if (expenseRes.ok) {
        const data = await expenseRes.json();
        setExpenses(Array.isArray(data) ? data : []);
      }
      if (attendanceRes.ok) {
        const data = await attendanceRes.json();
        setAttendance(Array.isArray(data) ? data : []);
      }
      if (activityRes.ok) {
        const data = await activityRes.json();
        setActivities(Array.isArray(data) ? data : []);
      }
      if (workRes.ok) {
        const data = await workRes.json();
        setWorkSessions(Array.isArray(data) ? data : []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Filter helper for selected month & year (YYYY-MM-DD matches YYYY-MM)
  const prefix = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;
  
  const filteredExpenses = Array.isArray(expenses) ? expenses.filter(exp => exp && exp.date && exp.date.startsWith(prefix)) : [];
  const filteredAttendance = Array.isArray(attendance) ? attendance.filter(att => att && att.date && att.date.startsWith(prefix)) : [];
  const filteredActivities = Array.isArray(activities) ? activities.filter(act => act && act.date && act.date.startsWith(prefix)) : [];
  
  // Work sessions matching this month
  const filteredWorkSessions = Array.isArray(workSessions) ? workSessions.filter(ws => ws && ws.date && ws.date.startsWith(prefix)) : [];

  // Calendar calculations
  const totalDaysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();

  // Aggregate daily records
  const dailyWorkData = [];
  const dailyWalkingData = [];
  const dailySpendingData = [];

  for (let d = 1; d <= totalDaysInMonth; d++) {
    const dayStr = `${prefix}-${String(d).padStart(2, '0')}`;
    const dayLabel = `${d}`;

    // 1. Work sessions
    const daySessions = filteredWorkSessions.filter(ws => ws && ws.date === dayStr);
    const dayWorkMs = daySessions.reduce((sum, s) => sum + (s.duration || 0), 0);
    const dayWorkHrs = parseFloat((dayWorkMs / 3600000).toFixed(2));

    // 2. Walking distance
    const dayActivity = filteredActivities.find(act => act && act.date === dayStr);
    const dayDistance = dayActivity && typeof dayActivity.walkingDistance === 'number' ? dayActivity.walkingDistance : 0;

    // 3. Spending
    const dayExpenses = filteredExpenses.filter(exp => exp && exp.date === dayStr);
    const daySpending = dayExpenses.reduce((sum, exp) => sum + (exp.amount || 0), 0);

    dailyWorkData.push({ day: dayLabel, Hours: dayWorkHrs || 0 });
    dailyWalkingData.push({ day: dayLabel, Distance: parseFloat((dayDistance || 0).toFixed(1)) });
    dailySpendingData.push({ day: dayLabel, Amount: daySpending });
  }

  // 4. Spending by categories
  const spendingCategories = {};
  filteredExpenses.forEach(exp => {
    if (exp && exp.category && typeof exp.amount === 'number') {
      spendingCategories[exp.category] = (spendingCategories[exp.category] || 0) + exp.amount;
    }
  });
  
  const categoryData = Object.entries(spendingCategories).map(([name, value]) => ({
    name,
    value
  }));

  // Statistics Calculations
  const totalOfficeDays = filteredAttendance.filter(att => att && att.officeDuration > 0).length;
  const totalOfficeMs = filteredAttendance.reduce((sum, att) => sum + (att && att.officeDuration || 0), 0);
  const totalOfficeHours = parseFloat((totalOfficeMs / 3600000).toFixed(1)) || 0;
  const avgOfficeHoursPerDay = totalOfficeDays > 0 ? (totalOfficeHours / totalOfficeDays).toFixed(1) : 0;

  const totalWorkMs = filteredWorkSessions.reduce((sum, ws) => sum + (ws && ws.duration || 0), 0);
  const totalWorkHours = parseFloat((totalWorkMs / 3600000).toFixed(1)) || 0;
  const avgWorkHoursPerDay = totalOfficeDays > 0 ? (totalWorkHours / totalOfficeDays).toFixed(1) : totalDaysInMonth > 0 ? (totalWorkHours / totalDaysInMonth).toFixed(1) : 0;

  const totalSteps = filteredActivities.reduce((sum, act) => sum + (act && act.steps || 0), 0);
  const totalWalkingDistance = filteredActivities.reduce((sum, act) => sum + (act && act.walkingDistance || 0), 0);
  const activeDays = filteredActivities.filter(act => act && act.steps > 0).length;
  const avgStepsPerDay = activeDays > 0 ? Math.round(totalSteps / activeDays) : 0;
  const avgDistancePerDay = activeDays > 0 ? (totalWalkingDistance / activeDays).toFixed(1) : 0;

  const totalSpending = filteredExpenses.reduce((sum, exp) => sum + (exp && exp.amount || 0), 0);
  const avgSpendingPerDay = totalSpending > 0 ? Math.round(totalSpending / totalDaysInMonth) : 0;

  const formatTextReport = () => {
    const monthName = new Date(selectedYear, selectedMonth, 1).toLocaleString('default', { month: 'LONG' }).toUpperCase();
    let report = `${monthName} ${selectedYear}\n\n`;
    report += `Office Days: ${totalOfficeDays}\n`;
    report += `Office Time: ${Math.floor(totalOfficeHours)}h ${Math.round((totalOfficeHours % 1) * 60)}m\n`;
    report += `Average Office Time: ${avgOfficeHoursPerDay}h\n\n`;
    report += `Working Time: ${Math.floor(totalWorkHours)}h ${Math.round((totalWorkHours % 1) * 60)}m\n\n`;
    report += `Steps: ${totalSteps.toLocaleString()}\n`;
    report += `Walking Distance: ${totalWalkingDistance.toFixed(1)} km\n\n`;
    report += `Total Spending: ₹${totalSpending.toLocaleString()}\n`;
    report += `Average Daily Spending: ₹${avgSpendingPerDay}\n\n`;
    
    if (categoryData.length > 0) {
      report += `Spending by Category:\n`;
      categoryData.forEach(c => {
        report += `- ${c.name}: ₹${c.value.toLocaleString()}\n`;
      });
    }
    return report;
  };

  const copyReport = () => {
    navigator.clipboard.writeText(formatTextReport());
    alert('Monthly text report copied to clipboard!');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Month Picker Selection bar */}
      <div className="card-glass" style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Choose Month:</h3>
        <select 
          className="form-input" 
          style={{ width: 'auto', minWidth: '150px' }}
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
        >
          {Array.from({ length: 12 }).map((_, i) => (
            <option key={i} value={i}>
              {new Date(2026, i, 1).toLocaleString('default', { month: 'long' })}
            </option>
          ))}
        </select>
        <select 
          className="form-input" 
          style={{ width: 'auto', minWidth: '100px' }}
          value={selectedYear}
          onChange={(e) => setSelectedYear(parseInt(e.target.value))}
        >
          {[2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div style={{ padding: '2rem', textAlign: 'center' }}>Analyzing tracker logs...</div>
      ) : (
        <>
          {/* Summary Metric Stats Card */}
          <div className="dashboard-grid">
            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--primary)', marginBottom: '0.5rem' }}>
                <Calendar size={16} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>OFFICE ATTENDANCE</span>
              </div>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{totalOfficeDays} Days</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Total: {totalOfficeHours} hrs | Avg: {avgOfficeHoursPerDay} hrs/day
              </p>
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--warning)', marginBottom: '0.5rem' }}>
                <Clock size={16} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>WORKING HOURS</span>
              </div>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{totalWorkHours} hrs</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Avg: {avgWorkHoursPerDay} hrs/day
              </p>
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--success)', marginBottom: '0.5rem' }}>
                <Footprints size={16} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>WALKING / STEPS</span>
              </div>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 700 }}>{totalSteps.toLocaleString()} steps</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Total Dist: {totalWalkingDistance.toFixed(1)} km | Avg: {avgStepsPerDay} steps/day
              </p>
            </div>

            <div className="card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--danger)', marginBottom: '0.5rem' }}>
                <DollarSign size={16} />
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>SPENDING</span>
              </div>
              <h4 style={{ fontSize: '1.25rem', fontWeight: 700 }}>₹{totalSpending.toLocaleString()}</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Avg: ₹{avgSpendingPerDay}/day
              </p>
            </div>
          </div>

          {/* Recharts Graphical Visuals section */}
          <div className="analytics-grid">
            
            {/* Daily Work Sessions Chart */}
            <div className="card">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem' }}>Daily Working Hours</h3>
              <div style={{ width: '100%', minHeight: '240px' }}>
                <ResponsiveContainer width="100%" height={240} id="work-hours-container">
                  <BarChart data={dailyWorkData} margin={{ left: -20, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                    <Tooltip cursor={{ fill: 'var(--bg-tertiary)' }} />
                    <Bar dataKey="Hours" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Daily Walking Distance Chart */}
            <div className="card">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem' }}>Daily Walking Distance (km)</h3>
              <div style={{ width: '100%', minHeight: '240px' }}>
                <ResponsiveContainer width="100%" height={240} id="walking-distance-container">
                  <LineChart data={dailyWalkingData} margin={{ left: -20, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="Distance" stroke="var(--success)" strokeWidth={2} activeDot={{ r: 6 }} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Daily Spending Chart */}
            <div className="card">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem' }}>Daily Spending (₹)</h3>
              <div style={{ width: '100%', minHeight: '240px' }}>
                <ResponsiveContainer width="100%" height={240} id="daily-spending-container">
                  <BarChart data={dailySpendingData} margin={{ left: -20, right: 10 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="day" stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                    <YAxis stroke="var(--text-muted)" fontSize={10} tickLine={false} />
                    <Tooltip />
                    <Bar dataKey="Amount" fill="var(--danger)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Category Expenses Breakdown */}
            <div className="card">
              <h3 style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '1.25rem' }}>Expenses by Category</h3>
              {categoryData.length === 0 ? (
                <div style={{ height: '240px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  No categories to display
                </div>
              ) : (
                <div style={{ width: '100%', height: '240px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ width: '100%', minHeight: '190px', position: 'relative' }}>
                    <ResponsiveContainer width="100%" height={190} id="spending-pie-container">
                      <PieChart>
                        <Pie
                          data={categoryData}
                          cx="50%"
                          cy="50%"
                          innerRadius={60}
                          outerRadius={80}
                          paddingAngle={5}
                          dataKey="value"
                        >
                          {categoryData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => `₹${value}`} />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  {/* Custom Legend */}
                  <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 600 }}>
                    {categoryData.map((entry, index) => (
                      <span key={entry.name} style={{ display: 'inline-flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: COLORS[index % COLORS.length] }}></span>
                        {entry.name} (₹{entry.value})
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Monthly Report Exporter */}
          <div className="card" style={{ borderLeft: '4px solid var(--warning)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileText size={20} style={{ color: 'var(--warning)' }} />
                  Monthly Report Generator
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Quick text report copy for emails or notes.
                </p>
              </div>
              <button onClick={copyReport} className="btn btn-secondary" style={{ display: 'flex', gap: '0.4rem', fontSize: '0.85rem' }}>
                <Award size={16} /> Copy Report Text
              </button>
            </div>
            
            {/* Display Report Previews */}
            <pre style={{
              backgroundColor: 'var(--bg-tertiary)',
              padding: '1.25rem',
              borderRadius: 'var(--radius-md)',
              fontSize: '0.85rem',
              lineHeight: 1.6,
              color: 'var(--text-primary)',
              fontFamily: 'monospace',
              whiteSpace: 'pre-wrap',
              overflowX: 'auto',
              border: '1px solid var(--border)'
            }}>
              {formatTextReport()}
            </pre>
          </div>
        </>
      )}

    </div>
  );
};

export default Analytics;
