import express from 'express';
import Holiday from '../models/Holiday.js';
import { protect } from '../middleware/auth.js';
import { logger } from '../utils/logger.js';

const router = express.Router();

// @desc    Get all holidays for the user
// @route   GET /api/holiday
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const holidays = await Holiday.find({ userId: req.user._id }).sort({ date: 1 });
    res.json(holidays);
  } catch (error) {
    logger.error(`Error fetching holidays: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Create or update a holiday
// @route   POST /api/holiday
// @access  Private
router.post('/', protect, async (req, res) => {
  const { date, name, type } = req.body;
  const userId = req.user._id;

  if (!date || !name) {
    return res.status(400).json({ message: 'Date and name are required' });
  }

  try {
    let holiday = await Holiday.findOne({ userId, date });
    if (holiday) {
      holiday.name = name;
      holiday.type = type || holiday.type;
      await holiday.save();
      logger.success(`MQTT/API: Updated holiday on ${date} to "${name}"`);
    } else {
      holiday = await Holiday.create({
        userId,
        date,
        name,
        type: type || 'Public'
      });
      logger.success(`MQTT/API: Logged new holiday on ${date}: "${name}"`);
    }
    res.status(201).json(holiday);
  } catch (error) {
    logger.error(`Error saving holiday: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

// @desc    Delete a holiday
// @route   DELETE /api/holiday/:id
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const holiday = await Holiday.findOne({ _id: req.params.id, userId: req.user._id });
    if (!holiday) {
      return res.status(404).json({ message: 'Holiday not found' });
    }
    await holiday.deleteOne();
    logger.success(`Deleted holiday ID: ${req.params.id}`);
    res.json({ message: 'Holiday removed' });
  } catch (error) {
    logger.error(`Error deleting holiday: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
});

export default router;
