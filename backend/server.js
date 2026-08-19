import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDB from './config/db.js';

// Import Routes
import authRoutes from './routes/auth.js';
import expenseRoutes from './routes/expense.js';
import attendanceRoutes from './routes/attendance.js';
import activityRoutes from './routes/activity.js';
import workRoutes from './routes/work.js';
import googleFitRoutes from './routes/googleFit.js';
import gmailRoutes from './routes/gmail.js';
import agentRoutes from './routes/agent.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env') });

console.log("Loaded GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? `Yes (${process.env.GEMINI_API_KEY.substring(0, 5)}...)` : 'No');

// Connect to Database
connectDB();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/expense', expenseRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/activity', activityRoutes);
app.use('/api/work', workRoutes);
app.use('/api/auth/google', googleFitRoutes);
app.use('/api/gmail', gmailRoutes);
app.use('/api/agent', agentRoutes);

// Serve frontend static build files in production
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../frontend/dist')));

  // Let React Router handle route routing inside index.html for unknown page routes
  app.get('*', (req, res) => {
    // If the request is for a file or asset, return 404 instead of serving HTML
    if (req.path.includes('.') || req.path.startsWith('/assets/')) {
      return res.status(404).send('Asset not found');
    }
    res.sendFile(path.resolve(__dirname, '../frontend', 'dist', 'index.html'));
  });
} else {
  // Base route in development
  app.get('/', (req, res) => {
    res.send('LifeTrack API is running...');
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;
  res.status(statusCode);
  res.json({
    message: err.message,
    stack: process.env.NODE_ENV === 'production' ? null : err.stack,
  });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running in development mode on port ${PORT}`);
});
