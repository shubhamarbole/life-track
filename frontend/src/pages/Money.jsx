import React, { useState, useEffect } from 'react';
import { Plus, Wallet, TrendingUp, Calendar, Trash2, Tag, FileText, ChevronLeft, Building } from 'lucide-react';
import SpendingModal from '../components/SpendingModal';

const Money = () => {
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState([]);
  const [summary, setSummary] = useState({ todayTotal: 0, weeklyTotal: 0, monthlyTotal: 0, categoryTotals: {} });
  const [isModalOpen, setIsModalOpen] = useState(false);

  const token = localStorage.getItem('lifetrack_token');
  const todayStr = new Date().toISOString().split('T')[0];

  const fetchMoneyData = async () => {
    try {
      setLoading(true);
      const headers = { 'Authorization': `Bearer ${token}` };
      
      const [historyRes, summaryRes] = await Promise.all([
        fetch('/api/expense/history', { headers }),
        fetch(`/api/expense/summary?clientDate=${todayStr}`, { headers })
      ]);

      if (historyRes.ok) setExpenses(await historyRes.json());
      if (summaryRes.ok) setSummary(await summaryRes.json());

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMoneyData();
  }, []);

  const handleAddExpense = async (expenseData) => {
    const headers = { 
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}` 
    };
    const res = await fetch('/api/expense/add', {
      method: 'POST',
      headers,
      body: JSON.stringify(expenseData)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Failed to add expense');
    }
    fetchMoneyData();
  };

  const handleDeleteExpense = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) return;
    try {
      const res = await fetch(`/api/expense/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchMoneyData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Maps database category values to custom iOS-style titles, emojis, and colors
  const getCategoryDetails = (cat) => {
    switch (cat) {
      case 'Food': 
        return { name: 'Food & Dining', emoji: '🍔', color: '#5856d6' };
      case 'Travel': 
        return { name: 'Travel & Transfers', emoji: '💸', color: '#34c759' };
      case 'Shopping': 
        return { name: 'Shopping & Lifestyle', emoji: '🛍️', color: '#ffcc00' };
      case 'Bills': 
        return { name: 'Bills & Utilities', emoji: '📄', color: '#007aff' };
      case 'Entertainment': 
        return { name: 'Health & Wellness', emoji: '🏋️', color: '#ff2d55' };
      case 'Services':
        return { name: 'Services', emoji: '⚙️', color: '#ff9500' };
      default: 
        return { name: cat, emoji: '🏷️', color: '#8e8e93' };
    }
  };

  // Compares and aggregates monthly data dynamically for the last 6 months
  const getMonthlyComparison = () => {
    const monthlySum = {};
    expenses.forEach((exp) => {
      if (!exp.date) return;
      const monthKey = exp.date.substring(0, 7); // "YYYY-MM"
      monthlySum[monthKey] = (monthlySum[monthKey] || 0) + exp.amount;
    });

    const list = [];
    const now = new Date();
    const shortNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const monthNum = String(d.getMonth() + 1).padStart(2, '0');
      const monthKey = `${year}-${monthNum}`;
      const label = shortNames[d.getMonth()];
      const isCurrent = i === 0;

      list.push({
        label,
        key: monthKey,
        amount: monthlySum[monthKey] || 0,
        isCurrent
      });
    }
    return list;
  };

  const monthlyList = getMonthlyComparison();
  const maxAmount = Math.max(...monthlyList.map(m => m.amount), 1000);
  const avgAmount = Math.round(monthlyList.reduce((acc, m) => acc + m.amount, 0) / monthlyList.length);
  const avgLinePercentage = 100 - (avgAmount / maxAmount * 100);

  // Format currency with standard commas
  const formatCurrency = (val) => {
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(val);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '2rem' }}>
      
      {/* Spend summary header */}
      <div style={{ textAlign: 'center', marginTop: '0.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.25rem' }}>
        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          August '26
        </span>
        <h1 style={{ fontSize: '2.5rem', fontWeight: 900, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.03em' }}>
          ₹{formatCurrency(summary.monthlyTotal)}
        </h1>
        <div style={{ width: '80px', height: '3px', backgroundColor: '#ff9500', borderRadius: '2px', marginTop: '0.5rem' }}></div>
      </div>

      {/* Grid Container for Layout */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'window.innerWidth > 992 ? "1.2fr 1fr" : "1fr"',
        gap: '1.5rem',
        alignItems: 'start'
      }} className="analytics-grid">
        
        {/* Left Section: Chart & Categories */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* 6-Month Comparison Bar Chart Card */}
          <div className="card" style={{ padding: '1.5rem', position: 'relative' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 800, margin: '0 0 1.5rem 0', color: 'var(--text-primary)' }}>Monthly comparison</h3>
            
            {/* Chart Area */}
            <div style={{ 
              height: '160px', 
              position: 'relative', 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'flex-end',
              padding: '0 0.5rem',
              marginTop: '1rem'
            }}>
              {/* Dashed Average Guide Line */}
              <div style={{
                position: 'absolute',
                left: 0,
                right: 0,
                top: `${avgLinePercentage}%`,
                borderTop: '1px dashed rgba(142, 142, 147, 0.4)',
                display: 'flex',
                alignItems: 'center',
                zIndex: 1
              }}>
                <span style={{ 
                  fontSize: '0.65rem', 
                  backgroundColor: 'var(--bg-secondary)', 
                  color: 'var(--text-secondary)', 
                  padding: '0.1rem 0.35rem', 
                  borderRadius: '4px',
                  border: '1px solid var(--border)',
                  fontWeight: 700,
                  marginLeft: '0.5rem',
                  transform: 'translateY(-50%)'
                }}>
                  AVG. ₹{avgAmount >= 1000 ? `${(avgAmount / 1000).toFixed(1)}k` : avgAmount}
                </span>
              </div>

              {/* Monthly Bars */}
              {monthlyList.map((m) => {
                const heightPercent = (m.amount / maxAmount) * 100;
                return (
                  <div key={m.label} style={{ 
                    display: 'flex', 
                    flexDirection: 'column', 
                    alignItems: 'center', 
                    flex: 1, 
                    zIndex: 2 
                  }}>
                    {/* Value indicator above bar */}
                    <span style={{ 
                      fontSize: '0.65rem', 
                      color: 'var(--text-secondary)', 
                      marginBottom: '0.35rem',
                      fontWeight: 600
                    }}>
                      {m.amount > 0 ? `₹${m.amount >= 1000 ? `${(m.amount / 1000).toFixed(1)}k` : m.amount}` : ''}
                    </span>

                    {/* Bar Pill */}
                    <div style={{
                      width: '32px',
                      height: `${Math.max(heightPercent, 4)}px`,
                      borderRadius: '16px',
                      background: m.isCurrent 
                        ? 'linear-gradient(to top, #3a2ff0, #8f2ff0)' 
                        : 'var(--bg-tertiary)',
                      boxShadow: m.isCurrent ? '0 0 12px rgba(143, 47, 240, 0.3)' : 'none',
                      transition: 'height 0.4s ease'
                    }} />

                    {/* Month Label below bar */}
                    <span style={{ 
                      fontSize: '0.75rem', 
                      color: m.isCurrent ? 'var(--text-primary)' : 'var(--text-muted)', 
                      fontWeight: m.isCurrent ? 700 : 500,
                      marginTop: '0.5rem'
                    }}>
                      {m.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Categories Card with Progress Bars */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, margin: '0 0 1.25rem 0', color: 'var(--text-primary)' }}>Categories</h3>
            {Object.keys(summary.categoryTotals).length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No expenses recorded this month.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
                {Object.entries(summary.categoryTotals)
                  .sort((a, b) => b[1] - a[1]) // Sort categories by highest spend
                  .map(([cat, val]) => {
                    const percent = summary.monthlyTotal > 0 ? Math.round((val / summary.monthlyTotal) * 100) : 0;
                    const details = getCategoryDetails(cat);
                    
                    return (
                      <div key={cat} style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                        {/* Title and Value */}
                        <div style={{ display: 'flex', alignItems: 'center', justifyRules: 'space-between', justifyContent: 'space-between' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                            <div style={{
                              width: '36px',
                              height: '36px',
                              borderRadius: '10px',
                              backgroundColor: `${details.color}15`, // 15% opacity background
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '1.2rem'
                            }}>
                              {details.emoji}
                            </div>
                            <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                              {details.name}
                            </span>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--text-primary)' }}>
                              ₹{formatCurrency(val)}
                            </span>
                          </div>
                        </div>

                        {/* Progress Bar Container */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                          <div style={{ 
                            flex: 1, 
                            height: '6px', 
                            backgroundColor: 'var(--bg-tertiary)', 
                            borderRadius: '3px',
                            overflow: 'hidden'
                          }}>
                            <div style={{ 
                              width: `${percent}%`, 
                              height: '100%', 
                              backgroundColor: details.color,
                              borderRadius: '3px'
                            }} />
                          </div>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', minWidth: '32px', textAlign: 'right', fontWeight: 600 }}>
                            {percent}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>

        {/* Right Section: Add Transaction & Recent Logs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          
          {/* Action Card */}
          <div className="card" style={{ padding: '1.25rem', display: 'flex', gap: '0.85rem', flexDirection: 'column' }}>
            <button 
              onClick={() => setIsModalOpen(true)} 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '0.8rem', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', borderRadius: '12px' }}
            >
              <Plus size={18} /> Add New Expense
            </button>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.25rem' }}>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>TODAY</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>₹{formatCurrency(summary.todayTotal)}</span>
              </div>
              <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '0.75rem', borderRadius: '10px', border: '1px solid var(--border)', textAlign: 'center' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', textTransform: 'uppercase' }}>THIS WEEK</span>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>₹{formatCurrency(summary.weeklyTotal)}</span>
              </div>
            </div>
          </div>

          {/* Expense Log History List Card */}
          <div className="card" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, marginBottom: '1.25rem', color: 'var(--text-primary)' }}>Expense History</h3>
            {loading ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading expenses...</p>
            ) : expenses.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No expenses entered yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '420px', overflowY: 'auto', paddingRight: '0.25rem' }}>
                {expenses.map((exp) => {
                  const details = getCategoryDetails(exp.category);
                  return (
                    <div key={exp._id} style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center', 
                      padding: '0.75rem', 
                      border: '1px solid var(--border)', 
                      borderRadius: '12px',
                      backgroundColor: 'var(--bg-secondary)'
                    }}>
                      <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <div style={{
                          width: '36px', 
                          height: '36px', 
                          borderRadius: '50%',
                          backgroundColor: `${details.color}15`, 
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          fontSize: '1.1rem'
                        }}>
                          {details.emoji}
                        </div>
                        <div>
                          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                            <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-primary)' }}>{details.name}</span>
                            <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.4rem', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', borderRadius: '4px', fontWeight: 600 }}>
                              {new Date(exp.date + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}
                            </span>
                          </div>
                          {exp.note && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block', marginTop: '0.15rem' }}>{exp.note}</span>}
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{ fontWeight: 800, fontSize: '0.95rem', color: 'var(--danger)' }}>-₹{formatCurrency(exp.amount)}</span>
                        <button 
                          onClick={() => handleDeleteExpense(exp._id)}
                          style={{ 
                            padding: '0.35rem', 
                            border: 'none', 
                            backgroundColor: 'transparent',
                            color: 'var(--danger)', 
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            borderRadius: '6px',
                            transition: 'background-color 0.2s'
                          }}
                          title="Delete expense"
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(255, 59, 48, 0.08)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

      </div>

      <SpendingModal 
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onAddExpense={handleAddExpense}
      />
    </div>
  );
};

export default Money;
