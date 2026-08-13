import mongoose from 'mongoose';

const activityEventSchema = new mongoose.Schema({
  activityType: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

const dailyActivitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: String, // format YYYY-MM-DD
    required: true,
  },
  steps: {
    type: Number,
    default: 0,
  },
  walkingDistance: {
    type: Number,
    default: 0.0, // in km
  },
  walkingDuration: {
    type: Number,
    default: 0, // in minutes
  },
  activityEvents: [activityEventSchema],
}, {
  timestamps: true
});

// Ensure a single record per user per day
dailyActivitySchema.index({ userId: 1, date: 1 }, { unique: true });

const DailyActivity = mongoose.model('DailyActivity', dailyActivitySchema);
export default DailyActivity;
