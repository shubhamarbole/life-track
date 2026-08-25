import mongoose from 'mongoose';

const holidaySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  date: {
    type: String, // format YYYY-MM-DD
    required: true
  },
  name: {
    type: String,
    required: true
  },
  type: {
    type: String,
    enum: ['Public', 'Personal'],
    default: 'Public'
  }
}, { timestamps: true });

// Ensure a user can only have one holiday record per calendar date
holidaySchema.index({ userId: 1, date: 1 }, { unique: true });

const Holiday = mongoose.model('Holiday', holidaySchema);
export default Holiday;
