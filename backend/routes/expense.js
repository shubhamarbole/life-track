import express from 'express';
import Expense from '../models/Expense.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Helper to get date boundaries
const getDateStrings = (clientDateStr) => {
  // clientDateStr format: YYYY-MM-DD
  const today = clientDateStr ? new Date(clientDateStr) : new Date();
  
  const formatDate = (date) => {
    return date.toISOString().split('T')[0];
  };

  const todayStr = clientDateStr || formatDate(today);

  // Start of current week (Monday)
  const currentDay = today.getDay();
  const diffToMonday = today.getDate() - currentDay + (currentDay === 0 ? -6 : 1);
  const startOfWeek = new Date(today.setDate(diffToMonday));
  const startOfWeekStr = formatDate(startOfWeek);

  // Start of current month
  const todayForMonth = clientDateStr ? new Date(clientDateStr) : new Date();
  const startOfMonthStr = `${todayForMonth.getFullYear()}-${String(todayForMonth.getMonth() + 1).padStart(2, '0')}-01`;

  return { todayStr, startOfWeekStr, startOfMonthStr };
};

// @desc    Add a new expense
// @route   POST /api/expense/add
// @access  Private
router.post('/add', protect, async (req, res) => {
  try {
    const { amount, category, note, date } = req.body;

    if (!amount || !category) {
      return res.status(400).json({ message: 'Amount and Category are required' });
    }

    const expenseDate = date || new Date().toISOString().split('T')[0];

    const expense = await Expense.create({
      userId: req.user._id,
      date: expenseDate,
      amount: parseFloat(amount),
      category,
      note: note || '',
    });

    res.status(201).json(expense);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get expense summaries (today, weekly, monthly, categories)
// @route   GET /api/expense/summary
// @access  Private
router.get('/summary', protect, async (req, res) => {
  try {
    const { clientDate } = req.query; // Expect YYYY-MM-DD
    const { todayStr, startOfWeekStr, startOfMonthStr } = getDateStrings(clientDate);
    const userId = req.user._id;

    // Fetch all user expenses
    const expenses = await Expense.find({ userId });

    let todayTotal = 0;
    let weeklyTotal = 0;
    let monthlyTotal = 0;
    const categoryTotals = {};

    expenses.forEach((exp) => {
      const expDate = exp.date; // YYYY-MM-DD
      const expAmount = exp.amount;

      // Today
      if (expDate === todayStr) {
        todayTotal += expAmount;
      }

      // Weekly (expDate >= startOfWeekStr && expDate <= todayStr)
      if (expDate >= startOfWeekStr && expDate <= todayStr) {
        weeklyTotal += expAmount;
      }

      // Monthly (expDate >= startOfMonthStr && expDate <= todayStr)
      if (expDate >= startOfMonthStr && expDate <= todayStr) {
        monthlyTotal += expAmount;
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + expAmount;
      }
    });

    res.json({
      todayTotal,
      weeklyTotal,
      monthlyTotal,
      categoryTotals,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get all expenses (history)
// @route   GET /api/expense/history
// @access  Private
router.get('/history', protect, async (req, res) => {
  try {
    const { date } = req.query; // Optional specific date
    const query = { userId: req.user._id };
    if (date) {
      query.date = date;
    }
    const expenses = await Expense.find(query).sort({ createdAt: -1 });
    res.json(expenses);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete an expense
// @route   DELETE /api/expense/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const expense = await Expense.findById(req.params.id);

    if (!expense) {
      return res.status(404).json({ message: 'Expense not found' });
    }

    // Verify ownership
    if (expense.userId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }

    await expense.deleteOne();
    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
