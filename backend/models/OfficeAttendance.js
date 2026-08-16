import mongoose from 'mongoose';

const officeAttendanceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  date: {
    type: String, // format YYYY-MM-DD
    required: true,
  },
  arrivalTime: {
    type: Date,
    required: true,
  },
  departureTime: {
    type: Date,
  },
  officeDuration: {
    type: Number, // in milliseconds
    default: 0,
  },
  workSummary: {
    type: String,
    default: '',
  },
}, {
  timestamps: true
});

// A user can check-in strictly once per day
officeAttendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

const OfficeAttendance = mongoose.model('OfficeAttendance', officeAttendanceSchema);
export default OfficeAttendance;
