import mongoose from 'mongoose';

const workSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: String, // format YYYY-MM-DD
    required: true,
  },
  startTime: {
    type: Date,
    required: true,
  },
  endTime: {
    type: Date,
  },
  category: {
    type: String,
    enum: ['Coding', 'Learning', 'Meeting', 'Other'],
    default: 'Other',
  },
  duration: {
    type: Number, // in milliseconds
    default: 0,
  },
}, {
  timestamps: true
});

const WorkSession = mongoose.model('WorkSession', workSessionSchema);
export default WorkSession;
