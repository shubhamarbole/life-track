import express from 'express';
import DailyActivity from '../models/DailyActivity.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @desc    Get today's daily activity stats
// @route   GET /api/activity/today
// @access  Private
router.get('/today', protect, async (req, res) => {
  try {
    const { date } = req.query; // format YYYY-MM-DD
    const todayStr = date || new Date().toISOString().split('T')[0];

    const activity = await DailyActivity.findOne({
      userId: req.user._id,
      date: todayStr,
    });

    res.json(activity || { steps: 0, walkingDistance: 0, walkingDuration: 0, activityEvents: [] });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update steps, walking distance, duration, or post events
// @route   POST /api/activity/update
// @access  Private
router.post('/update', protect, async (req, res) => {
  try {
    const { steps, walkingDistance, walkingDuration, activityType, timestamp, date } = req.body;
    const todayStr = date || new Date().toISOString().split('T')[0];

    let activity = await DailyActivity.findOne({
      userId: req.user._id,
      date: todayStr,
    });

    if (!activity) {
      activity = new DailyActivity({
        userId: req.user._id,
        date: todayStr,
        steps: steps || 0,
        walkingDistance: walkingDistance || 0,
        walkingDuration: walkingDuration || 0,
        activityEvents: [],
      });
    } else {
      if (steps !== undefined) activity.steps = steps;
      if (walkingDistance !== undefined) activity.walkingDistance = walkingDistance;
      if (walkingDuration !== undefined) activity.walkingDuration = walkingDuration;
    }

    if (activityType) {
      activity.activityEvents.push({
        activityType,
        timestamp: timestamp ? new Date(timestamp) : new Date(),
      });
    }

    await activity.save();
    res.json(activity);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get activity history
// @route   GET /api/activity/history
// @access  Private
router.get('/history', protect, async (req, res) => {
  try {
    const history = await DailyActivity.find({ userId: req.user._id }).sort({ date: -1 });
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
