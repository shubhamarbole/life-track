import mongoose from 'mongoose';

const agentActivitySchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
  action: {
    type: String,
    required: true,
  },
  details: {
    type: String,
    required: true,
  }
}, {
  timestamps: true
});

const AgentActivity = mongoose.model('AgentActivity', agentActivitySchema);
export default AgentActivity;
