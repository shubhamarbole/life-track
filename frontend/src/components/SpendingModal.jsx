import React, { useState } from 'react';
import { X, IndianRupee } from 'lucide-react';

const SpendingModal = ({ isOpen, onClose, onAddExpense }) => {
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('Food');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
      setError('Please enter a valid amount.');
      return;
    }
    setError('');
    setIsSubmitting(true);

    try {
      await onAddExpense({
        amount: parseFloat(amount),
        category,
        note,
        date,
      });
      // Clear form & close
      setAmount('');
      setCategory('Food');
      setNote('');
      setDate(new Date().toISOString().split('T')[0]);
      onClose();
    } catch (err) {
      setError(err.message || 'Failed to add expense. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Add Expense</h2>
          <button onClick={onClose} className="btn btn-secondary btn-icon" style={{ width: '2rem', height: '2rem' }}>
            <X size={16} />
          </button>
        </div>

        {error && (
          <div style={{ padding: '0.75rem', backgroundColor: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 'var(--radius-sm)', marginBottom: '1rem', fontSize: '0.9rem', fontWeight: 500 }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Amount (₹)</label>
            <div style={{ position: 'relative' }}>
              <span style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center' }}>
                <IndianRupee size={16} />
              </span>
              <input 
                type="number" 
                className="form-input" 
                placeholder="e.g. 430" 
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                style={{ paddingLeft: '2.5rem' }}
                required
                min="1"
                step="any"
                autoFocus
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Category</label>
            <select 
              className="form-input" 
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              required
            >
              <option value="Food">Food 🍔</option>
              <option value="Travel">Travel 🚗</option>
              <option value="Shopping">Shopping 🛍️</option>
              <option value="Bills">Bills 📄</option>
              <option value="Entertainment">Entertainment 🎬</option>
              <option value="Other">Other ⚙️</option>
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Date</label>
            <input 
              type="date" 
              className="form-input" 
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Note</label>
            <input 
              type="text" 
              className="form-input" 
              placeholder="e.g. Lunch + tea" 
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
            <button type="button" onClick={onClose} className="btn btn-secondary" style={{ flex: 1 }}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : 'Add Expense'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SpendingModal;
