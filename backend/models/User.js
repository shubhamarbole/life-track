import mongoose from 'mongoose';

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true,
  },
  passwordHash: {
    type: String,
    required: true,
  },
  officeLocation: {
    lat: { type: Number, default: 0.0 },
    lng: { type: Number, default: 0.0 }
  },
  officeRadius: {
    type: Number,
    default: 100, // in meters
  },
  expectedWorkingHours: {
    type: Number,
    default: 8, // in hours
  },
  googleAccessToken: {
    type: String,
  },
  googleRefreshToken: {
    type: String,
  },
  googleTokenExpiry: {
    type: Date,
  },
  isGoogleFitConnected: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

const User = mongoose.model('User', userSchema);
export default User;
