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

    if (attendance) {
      return res.status(400).json({ message: 'Already checked in today', attendance });
    }

    attendance = await OfficeAttendance.create({
      userId: req.user._id,
      date: todayStr,
      arrivalTime: checkinTime,
    });

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

    if (attendance.departureTime) {
      return res.status(400).json({ message: 'Already checked out today', attendance });
    }

    attendance.departureTime = checkoutTime;

    // Calculate duration in ms
    const duration = checkoutTime.getTime() - new Date(attendance.arrivalTime).getTime();
    attendance.officeDuration = duration > 0 ? duration : 0;

    await attendance.save();
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update daily work summary note
// @route   POST /api/attendance/summary
// @access  Private
router.post('/summary', protect, async (req, res) => {
  try {
    const { workSummary, date } = req.body;
    const todayStr = date || new Date().toISOString().split('T')[0];

    let attendance = await OfficeAttendance.findOne({
      userId: req.user._id,
      date: todayStr,
    });

    if (!attendance) {
      attendance = new OfficeAttendance({
        userId: req.user._id,
        date: todayStr,
        arrivalTime: new Date(),
        workSummary: workSummary || '',
      });
    } else {
      attendance.workSummary = workSummary || '';
    }

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
