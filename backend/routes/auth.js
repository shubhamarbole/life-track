import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import Expense from '../models/Expense.js';
import DailyActivity from '../models/DailyActivity.js';
import OfficeAttendance from '../models/OfficeAttendance.js';
import WorkSession from '../models/WorkSession.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET || 'super_secret_lifetrack_key_123!', {
    expiresIn: '30d',
  });
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Please enter all fields' });
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const user = await User.create({
      name,
      email,
      passwordHash,
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        email: user.email,
        token: generateToken(user._id),
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Authenticate user
// @route   POST /api/auth/login
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid email or password' });
    }

    res.json({
      _id: user._id,
      name: user.name,
      email: user.email,
      token: generateToken(user._id),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get user profile
// @route   GET /api/auth/me
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    res.json(req.user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Update office settings / geofence
// @route   PUT /api/auth/settings
// @access  Private
router.put('/settings', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);

    if (user) {
      user.officeLocation = req.body.officeLocation || user.officeLocation;
      user.officeRadius = req.body.officeRadius !== undefined ? req.body.officeRadius : user.officeRadius;
      user.expectedWorkingHours = req.body.expectedWorkingHours !== undefined ? req.body.expectedWorkingHours : user.expectedWorkingHours;

      const updatedUser = await user.save();
      res.json({
        _id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        officeLocation: updatedUser.officeLocation,
        officeRadius: updatedUser.officeRadius,
        expectedWorkingHours: updatedUser.expectedWorkingHours,
      });
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete user account and all associated data
// @route   DELETE /api/auth/delete-data
// @access  Private
router.delete('/delete-data', protect, async (req, res) => {
  try {
    const userId = req.user._id;

    // Delete all records of user
    await Expense.deleteMany({ userId });
    await DailyActivity.deleteMany({ userId });
    await OfficeAttendance.deleteMany({ userId });
    await WorkSession.deleteMany({ userId });
    await User.findByIdAndDelete(userId);

    res.json({ message: 'User account and all tracking data successfully deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
