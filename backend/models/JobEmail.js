import mongoose from 'mongoose';

const jobEmailSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  messageId: {
    type: String,
    required: true,
    unique: true,
  },
  threadId: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    default: '',
  },
  from: {
    type: String,
    default: '',
  },
  body: {
    type: String,
    default: '',
  },
  snippet: {
    type: String,
    default: '',
  },
  receivedAt: {
    type: Date,
    required: true,
  },
  classification: {
    type: String,
    enum: [
      'interview_invite',
      'interview_schedule',
      'recruiter_message',
      'application_update',
      'rejection',
      'shortlisted',
      'other_job_related',
      'ignored'
    ],
    default: 'ignored',
  },
  extractedDetails: {
    companyName: { type: String, default: '' },
    jobRole: { type: String, default: '' },
    interviewDate: { type: String, default: '' }, // YYYY-MM-DD
    interviewTime: { type: String, default: '' },
    interviewType: { type: String, enum: ['Online', 'In-person', 'Phone', 'unknown'], default: 'unknown' },
    locationOrLink: { type: String, default: '' },
    recruiterName: { type: String, default: '' },
    importantInstructions: { type: String, default: '' },
  },
  notified: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['unread', 'read'],
    default: 'unread',
  }
}, {
  timestamps: true
});

const JobEmail = mongoose.model('JobEmail', jobEmailSchema);
export default JobEmail;
