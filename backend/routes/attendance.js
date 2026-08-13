import express from 'express';
import OfficeAttendance from '../models/OfficeAttendance.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @desc    Get today's office attendance status
// @route   GET /api/attendance/today
// @access  Private
router.get('/today', protect, async (req, res) => {
  try {
    const { date } = req.query; // format YYYY-MM-DD
    const todayStr = date || new Date().toISOString().split('T')[0];

    const attendance = await OfficeAttendance.findOne({
      userId: req.user._id,
      date: todayStr,
    });

    res.json(attendance || null);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Check-in (Arrival at office)
// @route   POST /api/attendance/checkin
// @access  Private
router.post('/checkin', protect, async (req, res) => {
  try {
    const { arrivalTime, date } = req.body;
    const todayStr = date || new Date().toISOString().split('T')[0];
    const checkinTime = arrivalTime ? new Date(arrivalTime) : new Date();

    // Check if check-in already exists
    let attendance = await OfficeAttendance.findOne({
      userId: req.user._id,
      date: todayStr,
    });

    if (!attendance) {
      // First check-in of the day
      attendance = await OfficeAttendance.create({
        userId: req.user._id,
        date: todayStr,
        arrivalTime: checkinTime,
        intervals: [{ checkIn: checkinTime }]
      });
    } else {
      // Check if there is already an active (unclosed) interval
      const activeInterval = attendance.intervals.find(interval => !interval.checkOut);
      if (activeInterval) {
        return res.status(400).json({ message: 'Already checked in', attendance });
      }

      // Add a new checkin interval
      attendance.intervals.push({ checkIn: checkinTime });
      // Reset departureTime since they are currently at the office again
      attendance.departureTime = null;
      await attendance.save();
    }

    res.status(201).json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Check-out (Departure from office)
// @route   POST /api/attendance/checkout
// @access  Private
router.post('/checkout', protect, async (req, res) => {
  try {
    const { departureTime, date } = req.body;
    const todayStr = date || new Date().toISOString().split('T')[0];
    const checkoutTime = departureTime ? new Date(departureTime) : new Date();

    const attendance = await OfficeAttendance.findOne({
      userId: req.user._id,
      date: todayStr,
    });

    if (!attendance) {
      return res.status(404).json({ message: 'No check-in record found for today' });
    }

    // Find the active interval (one without a checkOut time)
    const activeIntervalIndex = attendance.intervals.findIndex(interval => !interval.checkOut);
    if (activeIntervalIndex === -1) {
      return res.status(400).json({ message: 'Already checked out', attendance });
    }

    // Close the active interval
    attendance.intervals[activeIntervalIndex].checkOut = checkoutTime;
    attendance.departureTime = checkoutTime;

    // Recalculate total officeDuration (sum of all completed intervals)
    let totalDuration = 0;
    attendance.intervals.forEach(interval => {
      if (interval.checkIn && interval.checkOut) {
        const diff = new Date(interval.checkOut).getTime() - new Date(interval.checkIn).getTime();
        totalDuration += diff > 0 ? diff : 0;
      }
    });
    attendance.officeDuration = totalDuration;

    await attendance.save();
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get all attendance history
// @route   GET /api/attendance/history
// @access  Private
router.get('/history', protect, async (req, res) => {
  try {
    const history = await OfficeAttendance.find({ userId: req.user._id }).sort({ date: -1 });
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
