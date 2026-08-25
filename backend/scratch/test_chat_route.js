import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Expense from '../models/Expense.js';
import DailyActivity from '../models/DailyActivity.js';
import OfficeAttendance from '../models/OfficeAttendance.js';
import WorkSession from '../models/WorkSession.js';

dotenv.config({ path: '.env' });

const geminiKey = process.env.GEMINI_API_KEY;
console.log("Gemini Key:", geminiKey ? `${geminiKey.substring(0, 8)}...` : 'None');

async function run() {
  try {
    await mongoose.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lifetrack');
    console.log("DB Connected");

    const user = await User.findOne();
    if (!user) {
      console.error("No user found in database");
      process.exit(1);
    }

    const userId = user._id;
    const message = "Hi, how are you?";
    const todayStr = new Date().toISOString().split('T')[0];

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);

    const [expenses, activities, attendance, workSessions] = await Promise.all([
      Expense.find({ userId, date: { $gte: startDate } }).sort({ date: -1 }),
      DailyActivity.find({ userId, date: { $gte: startDate } }).sort({ date: -1 }),
      OfficeAttendance.find({ userId, date: { $gte: startDate } }).sort({ date: -1 }),
      WorkSession.find({ userId, date: { $gte: startDate } }).sort({ date: -1 })
    ]);

    const clientTime = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const systemPrompt = `You are 'DayTrack AI', a helpful, personal daily tracking companion.
You analyze the user's daily habits, expenses, office hours, work productivity, and movement step count to provide coaching, answer questions, and perform actions.

Context about the user:
Current Date: ${todayStr}
Current Time: ${clientTime}

User Tracking History (Last 30 Days):
- Expenses: ${JSON.stringify(expenses.map(e => ({ amount: e.amount, category: e.category, note: e.note, date: e.date })))}
- Daily Movement & Steps: ${JSON.stringify(activities.map(a => ({ steps: a.steps, distance: a.walkingDistance, date: a.date })))}
- Office Attendance Logs: ${JSON.stringify(attendance.map(att => ({ arrival: att.arrivalTime, departure: att.departureTime, duration: att.officeDuration, date: att.date })))}
- Work Productivity Sessions: ${JSON.stringify(workSessions.map(w => ({ category: w.category, duration: w.duration, startTime: w.startTime, endTime: w.endTime, date: w.date })))}

Your tasks:
1. Provide concise, encouraging, and friendly answers to the user's questions about their logs, history, productivity, or spendings.
2. If the user requests to record, start, stop, check-in, check-out, or modify any tracking data, you MUST return a structured action object in your JSON response. Do NOT perform any database writes yourself, just supply the action request.
3. Available Actions:
   - CREATE_EXPENSE: { amount: Number (required), category: 'Food' | 'Travel' | 'Shopping' | 'Bills' | 'Other' (required), note: String (optional), date: String (optional, format YYYY-MM-DD, defaults to today: ${todayStr}) }
   - UPDATE_STEPS: { steps: Number (required), date: String (optional, YYYY-MM-DD, defaults to today: ${todayStr}) }
   - CHECK_IN: { time: String (optional, format HH:MM, defaults to now), date: String (optional, YYYY-MM-DD, defaults to today: ${todayStr}) }
   - CHECK_OUT: { time: String (optional, format HH:MM, defaults to now), date: String (optional, YYYY-MM-DD, defaults to today: ${todayStr}) }
   - START_WORK: { category: 'Coding' | 'Learning' | 'Meeting' | 'Other' (required) }
   - STOP_WORK: {}
   - UPDATE_WORK_SUMMARY: { summary: String (required), date: String (optional, YYYY-MM-DD, defaults to today: ${todayStr}) }

4. Response Format:
   You MUST return a JSON object conforming exactly to this schema:
   {
     "reply": "Your conversational response in markdown formatting. If you are triggerring an action, explicitly confirm what action you have prepared.",
     "action": null | {
       "type": "CREATE_EXPENSE" | "UPDATE_STEPS" | "CHECK_IN" | "CHECK_OUT" | "START_WORK" | "STOP_WORK" | "UPDATE_WORK_SUMMARY",
       "payload": object
     }
   }
`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          { parts: [{ text: `User message: ${message}` }] }
        ],
        systemInstruction: {
          parts: [{ text: systemPrompt }]
        },
        generationConfig: {
          responseMimeType: 'application/json'
        }
      })
    });

    const status = response.status;
    const data = await response.json();
    console.log("Fetch Status:", status);
    if (response.ok) {
      console.log("Data candidates text:", data.candidates?.[0]?.content?.parts?.[0]?.text);
    } else {
      console.error("Error data:", JSON.stringify(data, null, 2));
    }

  } catch (err) {
    console.error("Run error:", err);
  }
  process.exit(0);
}

run();
