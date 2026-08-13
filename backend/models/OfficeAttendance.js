import mongoose from 'mongoose';

const attendanceIntervalSchema = new mongoose.Schema({
  checkIn: {
    type: Date,
    required: true,
  },
  checkOut: {
    type: Date,
  }
});

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
    type: Date, // First check-in time of the day
  },
  departureTime: {
    type: Date, // Last check-out time of the day
  },
  officeDuration: {
    type: Number, // Sum of completed intervals (in milliseconds)
    default: 0,
  },
  intervals: [attendanceIntervalSchema]
}, {
  timestamps: true
});

// A user has one consolidated attendance document per day containing all intervals
officeAttendanceSchema.index({ userId: 1, date: 1 }, { unique: true });

const OfficeAttendance = mongoose.model('OfficeAttendance', officeAttendanceSchema);
export default OfficeAttendance;
