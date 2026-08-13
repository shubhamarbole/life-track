import React, { useState, useEffect } from 'react';
import { Plus, Wallet, TrendingUp, Calendar, Trash2, Tag, FileText } from 'lucide-react';
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
    fetchMoneyData(); // Refresh history and totals
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

  // Helper for category colors
  const getCategoryColor = (cat) => {
    switch (cat) {
      case 'Food': return 'var(--warning)';
      case 'Travel': return 'var(--success)';
      case 'Shopping': return 'var(--danger)';
      case 'Bills': return '#a855f7';
      case 'Entertainment': return '#06b6d4';
      default: return 'var(--text-secondary)';
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Metrics Summary widgets */}
      <div className="dashboard-grid">
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>TODAY'S BUDGET</span>
            <Wallet size={16} style={{ color: 'var(--primary)' }} />
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>₹{summary.todayTotal}</h3>
        </div>
        
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>THIS WEEK</span>
            <TrendingUp size={16} style={{ color: 'var(--success)' }} />
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>₹{summary.weeklyTotal}</h3>
        </div>

        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>THIS MONTH</span>
            <Calendar size={16} style={{ color: 'var(--danger)' }} />
          </div>
          <h3 style={{ fontSize: '1.5rem', fontWeight: 700 }}>₹{summary.monthlyTotal}</h3>
        </div>

        <div className="card" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
          <button onClick={() => setIsModalOpen(true)} className="btn btn-primary" style={{ width: '100%', height: '100%', fontSize: '1rem' }}>
            <Plus size={18} /> Add New Expense
          </button>
        </div>
      </div>

      {/* Main Expenses List & Categories Grid */}
      <div className="analytics-grid">
        {/* Category Totals List */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Monthly Categories Summary</h3>
          {Object.keys(summary.categoryTotals).length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No expenses recorded this month.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {Object.entries(summary.categoryTotals).map(([cat, val]) => {
                const percent = summary.monthlyTotal > 0 ? Math.round((val / summary.monthlyTotal) * 100) : 0;
                const color = getCategoryColor(cat);
                return (
                  <div key={cat} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem 1rem', backgroundColor: 'var(--bg-tertiary)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ width: '12px', height: '12px', borderRadius: '50%', backgroundColor: color }}></span>
                      <span style={{ fontWeight: 600, fontSize: '0.9rem' }}>{cat}</span>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ fontWeight: 700, fontSize: '0.95rem', display: 'block' }}>₹{val}</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{percent}% of total</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Recent Transactions List */}
        <div className="card">
          <h3 style={{ fontSize: '1.1rem', fontWeight: 700, marginBottom: '1.25rem' }}>Expense Log History</h3>
          {loading ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Loading expenses...</p>
          ) : expenses.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontStyle: 'italic', fontSize: '0.9rem' }}>No expenses entered yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '400px', overflowY: 'auto', paddingRight: '0.25rem' }}>
              {expenses.map((exp) => (
                <div key={exp._id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', transition: 'var(--transition)' }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '50%',
                      backgroundColor: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: getCategoryColor(exp.category)
                    }}>
                      <Tag size={16} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{exp.category}</span>
                        <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', backgroundColor: 'var(--bg-tertiary)', color: 'var(--text-secondary)', borderRadius: '4px' }}>
                          {new Date(exp.date + 'T00:00:00').toLocaleDateString([], { month: 'short', day: 'numeric' })}
                        </span>
                      </div>
                      {exp.note && <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{exp.note}</span>}
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--danger)' }}>-₹{exp.amount}</span>
                    <button 
                      onClick={() => handleDeleteExpense(exp._id)}
                      className="btn btn-secondary" 
                      style={{ padding: '0.3rem', minHeight: 0, height: 'auto', border: 'none', color: 'var(--danger)', cursor: 'pointer' }}
                      title="Delete expense"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
