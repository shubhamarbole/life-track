import express from 'express';
import WorkSession from '../models/WorkSession.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @desc    Get today's work sessions
// @route   GET /api/work/today
// @access  Private
router.get('/today', protect, async (req, res) => {
  try {
    const { date } = req.query; // format YYYY-MM-DD
    const todayStr = date || new Date().toISOString().split('T')[0];

    const sessions = await WorkSession.find({
      userId: req.user._id,
      date: todayStr,
    }).sort({ startTime: 1 });

    res.json(sessions);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Start a work session (automatically stops any currently active session)
// @route   POST /api/work/start
// @access  Private
router.post('/start', protect, async (req, res) => {
  try {
    const { category, startTime, date } = req.body;
    const todayStr = date || new Date().toISOString().split('T')[0];
    const sessionStart = startTime ? new Date(startTime) : new Date();

    // Check if there is already an active session (endTime is null)
    const activeSession = await WorkSession.findOne({
      userId: req.user._id,
      endTime: null,
    });

    if (activeSession) {
      // Stop the active session
      activeSession.endTime = sessionStart;
      const duration = sessionStart.getTime() - new Date(activeSession.startTime).getTime();
      activeSession.duration = duration > 0 ? duration : 0;
      await activeSession.save();
    }

    // Create the new session
    const newSession = await WorkSession.create({
      userId: req.user._id,
      date: todayStr,
      startTime: sessionStart,
      category: category || 'Other',
    });

    res.status(201).json(newSession);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Stop currently active work session
// @route   POST /api/work/stop
// @access  Private
router.post('/stop', protect, async (req, res) => {
  try {
    const { endTime } = req.body;
    const sessionEnd = endTime ? new Date(endTime) : new Date();

    const activeSession = await WorkSession.findOne({
      userId: req.user._id,
      endTime: null,
    });

    if (!activeSession) {
      return res.status(404).json({ message: 'No active work session found' });
    }

    activeSession.endTime = sessionEnd;
    const duration = sessionEnd.getTime() - new Date(activeSession.startTime).getTime();
    activeSession.duration = duration > 0 ? duration : 0;

    await activeSession.save();
    res.json(activeSession);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get all work sessions (history)
// @route   GET /api/work/history
// @access  Private
router.get('/history', protect, async (req, res) => {
  try {
    const history = await WorkSession.find({ userId: req.user._id }).sort({ startTime: -1 });
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
