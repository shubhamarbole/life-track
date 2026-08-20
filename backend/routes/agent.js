import express from 'express';
import Expense from '../models/Expense.js';
import DailyActivity from '../models/DailyActivity.js';
import OfficeAttendance from '../models/OfficeAttendance.js';
import WorkSession from '../models/WorkSession.js';
import AgentActivity from '../models/AgentActivity.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Helper to get start date for history (30 days ago)
const getStartDate30DaysAgo = () => {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
};

// Helper to format duration in hours/minutes
const formatDuration = (ms) => {
  if (!ms) return '0m';
  const mins = Math.round(ms / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return remMins > 0 ? `${hrs}h ${remMins}m` : `${hrs}h`;
};

// @desc    Process chat message with AI Agent
// @route   POST /api/agent/chat
// @access  Private
router.post('/chat', protect, async (req, res) => {
  const { message, clientDate, timezoneOffset } = req.body;
  const userId = req.user._id;

  if (!message) {
    return res.status(400).json({ message: 'Message is required' });
  }

  const todayStr = clientDate || new Date().toISOString().split('T')[0];
  const startDate = getStartDate30DaysAgo();

  try {
    // 1. Fetch user data context (last 30 days)
    const [expenses, activities, attendance, workSessions] = await Promise.all([
      Expense.find({ userId, date: { $gte: startDate } }).sort({ date: -1 }),
      DailyActivity.find({ userId, date: { $gte: startDate } }).sort({ date: -1 }),
      OfficeAttendance.find({ userId, date: { $gte: startDate } }).sort({ date: -1 }),
      WorkSession.find({ userId, date: { $gte: startDate } }).sort({ date: -1 })
    ]);

    const geminiKey = process.env.GEMINI_API_KEY;
    let aiResponse = null;

    if (geminiKey) {
      try {
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

        const geminiData = await response.json();
        if (response.ok) {
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          aiResponse = JSON.parse(rawText);
        } else {
          console.error('Gemini API Error:', geminiData);
        }
      } catch (geminiErr) {
        console.error('Gemini sync call error:', geminiErr);
      }
    }

    // 2. Rule-based Fallback Parser (if Gemini key is missing or call failed)
    if (!aiResponse) {
      aiResponse = {
        reply: "I am running in local offline mode. To enable smart AI responses, please configure `GEMINI_API_KEY` in the `backend/.env` file. However, I can still parse basic command patterns!",
        action: null
      };

      const lowerMsg = message.toLowerCase();

      // Determine date (default today, check if yesterday is specified)
      let targetDate = todayStr;
      if (lowerMsg.includes('yesterday')) {
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        targetDate = yesterdayDate.toISOString().split('T')[0];
      }

      // 1. Try to parse steps command, e.g. "update steps to 9000 yesterday"
      const stepsMatch = lowerMsg.match(/(?:steps|walked|log\s+steps)\s+(?:to\s+)?(\d+)/i) || lowerMsg.match(/(\d+)\s+steps/i);

      // 3. Try to parse work done/work summary command, e.g. "work done: completed database setup yesterday"
      const workDoneMatch = lowerMsg.match(/(?:work\s+done|work\s+summary|log\s+work)\s*(?::|to)\s*(.*)/i);

      // 2. Try to parse basic expense command, e.g. "spent 500 on Food yesterday"
      const expenseMatch = lowerMsg.match(/(?:spent|log|cost|expense)\s+(?:₹|rs\.?|\$)?(\d+(?:\.\d+)?)\s+(?:on|for)\s+(\w+)(?:\s+for\s+(.*))?/i);

      if (workDoneMatch) {
        const summaryText = workDoneMatch[1].trim();
        let cleanSummary = summaryText.replace(/\byesterday\b/gi, '').trim();
        aiResponse.action = {
          type: 'UPDATE_WORK_SUMMARY',
          payload: { summary: cleanSummary, date: targetDate }
        };
        aiResponse.reply = `Rule Agent: Logging work done note **"${cleanSummary}"** for **${targetDate === todayStr ? 'today' : 'yesterday'}** (${targetDate}).`;
      }
      else if (stepsMatch) {
        const steps = parseInt(stepsMatch[1]);
        aiResponse.action = {
          type: 'UPDATE_STEPS',
          payload: { steps, date: targetDate }
        };
        aiResponse.reply = `Rule Agent: Recording **${steps.toLocaleString()} steps** for **${targetDate === todayStr ? 'today' : 'yesterday'}** (${targetDate}).`;
      }
      else if (expenseMatch) {
        const amount = parseFloat(expenseMatch[1]);
        let category = expenseMatch[2].charAt(0).toUpperCase() + expenseMatch[2].slice(1).toLowerCase();
        if (!['Food', 'Travel', 'Shopping', 'Bills', 'Other'].includes(category)) {
          category = 'Other';
        }
        const note = expenseMatch[3] || '';
        let cleanNote = note.replace(/\byesterday\b/gi, '').trim();
        aiResponse.action = {
          type: 'CREATE_EXPENSE',
          payload: { amount, category, note: cleanNote, date: targetDate }
        };
        aiResponse.reply = `Rule Agent: Recording expense of **₹${amount}** for **${category}** logged for **${targetDate === todayStr ? 'today' : 'yesterday'}** (${targetDate}).`;
      } 
      // Parse check-in, e.g. "check in yesterday at 9:30"
      else if (lowerMsg.includes('check in') || lowerMsg.includes('arrive') || lowerMsg.includes('reached office')) {
        const timeMatch = lowerMsg.match(/(?:at|time)\s+(\d{1,2}):(\d{2})/);
        const timePayload = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : null;
        aiResponse.action = { type: 'CHECK_IN', payload: { date: targetDate, time: timePayload } };
        aiResponse.reply = `Rule Agent: Logging office **Check-in** for **${targetDate === todayStr ? 'today' : 'yesterday'}** (${targetDate})${timePayload ? ` at ${timePayload}` : ''}.`;
      }
      // Parse check-out, e.g. "check out yesterday at 18:30"
      else if (lowerMsg.includes('check out') || lowerMsg.includes('leave office') || lowerMsg.includes('departed')) {
        const timeMatch = lowerMsg.match(/(?:at|time)\s+(\d{1,2}):(\d{2})/);
        const timePayload = timeMatch ? `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}` : null;
        aiResponse.action = { type: 'CHECK_OUT', payload: { date: targetDate, time: timePayload } };
        aiResponse.reply = `Rule Agent: Logging office **Check-out** for **${targetDate === todayStr ? 'today' : 'yesterday'}** (${targetDate})${timePayload ? ` at ${timePayload}` : ''}.`;
      }
      // Parse start work, e.g. "start coding"
      else if (lowerMsg.includes('start coding') || lowerMsg.includes('start work coding')) {
        aiResponse.action = { type: 'START_WORK', payload: { category: 'Coding' } };
        aiResponse.reply = `Rule Agent: Starting a **Coding** work session timer.`;
      } else if (lowerMsg.includes('start learning')) {
        aiResponse.action = { type: 'START_WORK', payload: { category: 'Learning' } };
        aiResponse.reply = `Rule Agent: Starting a **Learning** work session timer.`;
      } else if (lowerMsg.includes('start meeting')) {
        aiResponse.action = { type: 'START_WORK', payload: { category: 'Meeting' } };
        aiResponse.reply = `Rule Agent: Starting a **Meeting** work session timer.`;
      }
      // Parse stop work
      else if (lowerMsg.includes('stop work') || lowerMsg.includes('stop session') || lowerMsg.includes('end session')) {
        aiResponse.action = { type: 'STOP_WORK', payload: {} };
        aiResponse.reply = `Rule Agent: Stopping active work session timer.`;
      }
      // Parse summary query
      else if (lowerMsg.includes('yesterday')) {
        const yesterdayDate = new Date();
        yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yestStr = yesterdayDate.toISOString().split('T')[0];

        const workYest = workSessions.filter(s => s.date === yestStr).reduce((acc, curr) => acc + (curr.duration || 0), 0);
        const stepsYest = activities.find(a => a.date === yestStr)?.steps || 0;
        const spentYest = expenses.filter(e => e.date === yestStr).reduce((acc, curr) => acc + curr.amount, 0);

        aiResponse.reply = `Rule Agent: Here is a summary of your day **yesterday** (${yestStr}):\n- Work sessions: ${formatDuration(workYest)}\n- Steps walked: ${stepsYest.toLocaleString()} steps\n- Money spent: ₹${spentYest}`;
      }
      else if (lowerMsg.includes('summary') || lowerMsg.includes('how was my day') || lowerMsg.includes('today')) {
        aiResponse.reply = `Rule Agent: Here is a quick summary of your day so far:\n- Work logged today: ${formatDuration(workSessions.filter(s => s.date === todayStr).reduce((acc, curr) => acc + (curr.duration || 0), 0))}\n- Steps walked: ${activities.find(a => a.date === todayStr)?.steps || 0}\n- Money spent today: ₹${expenses.filter(e => e.date === todayStr).reduce((acc, curr) => acc + curr.amount, 0)}`;
      }
    }

    // 3. Execute Action in Database if present
    let actionExecuted = false;
    let actionDetails = '';

    if (aiResponse.action) {
      const { type, payload } = aiResponse.action;

      try {
        if (type === 'CREATE_EXPENSE') {
          const { amount, category, note, date } = payload;
          await Expense.create({
            userId,
            amount: parseFloat(amount),
            category: category || 'Other',
            note: note || '',
            date: date || todayStr
          });
          actionExecuted = true;
          actionDetails = `Logged expense of ₹${amount} for ${category}`;
        }
        else if (type === 'UPDATE_STEPS') {
          const { steps, date } = payload;
          const targetDate = date || todayStr;
          const distance = steps * 0.00075;
          const duration = steps * 0.008;

          let activity = await DailyActivity.findOne({ userId, date: targetDate });
          if (!activity) {
            activity = new DailyActivity({
              userId,
              date: targetDate,
              steps,
              walkingDistance: parseFloat(distance.toFixed(2)),
              walkingDuration: Math.round(duration)
            });
          } else {
            activity.steps = steps;
            activity.walkingDistance = parseFloat(distance.toFixed(2));
            activity.walkingDuration = Math.round(duration);
          }
          await activity.save();
          actionExecuted = true;
          actionDetails = `Updated step count to ${steps.toLocaleString()} steps`;
        }
        else if (type === 'CHECK_IN') {
          const targetDate = payload.date || todayStr;
          let checkInTime = new Date();
          if (payload.time) {
            checkInTime = new Date(`${targetDate}T${payload.time}`);
            if (timezoneOffset !== undefined) {
              checkInTime.setMinutes(checkInTime.getMinutes() + parseInt(timezoneOffset));
            }
          } else if (targetDate !== todayStr) {
            const target = new Date(targetDate);
            checkInTime.setFullYear(target.getFullYear(), target.getMonth(), target.getDate());
          }

          let att = await OfficeAttendance.findOne({ userId, date: targetDate });
          if (!att) {
            att = new OfficeAttendance({
              userId,
              date: targetDate,
              arrivalTime: checkInTime
            });
            await att.save();
            actionExecuted = true;
            actionDetails = `Logged office arrival at ${checkInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          } else {
            // Overwrite existing check-in time if specific time is requested
            if (payload.time) {
              att.arrivalTime = checkInTime;
              if (att.departureTime) {
                att.officeDuration = new Date(att.departureTime).getTime() - checkInTime.getTime();
              }
              await att.save();
              actionExecuted = true;
              actionDetails = `Updated office arrival time to ${checkInTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} for ${targetDate}`;
            } else {
              actionDetails = `Already checked in today at ${new Date(att.arrivalTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
            }
          }
        }
        else if (type === 'CHECK_OUT') {
          const targetDate = payload.date || todayStr;
          let checkOutTime = new Date();
          if (payload.time) {
            checkOutTime = new Date(`${targetDate}T${payload.time}`);
            if (timezoneOffset !== undefined) {
              checkOutTime.setMinutes(checkOutTime.getMinutes() + parseInt(timezoneOffset));
            }
          } else if (targetDate !== todayStr) {
            const target = new Date(targetDate);
            checkOutTime.setFullYear(target.getFullYear(), target.getMonth(), target.getDate());
          }

          let att = await OfficeAttendance.findOne({ userId, date: targetDate });
          if (att) {
            att.departureTime = checkOutTime;
            att.officeDuration = checkOutTime.getTime() - new Date(att.arrivalTime).getTime();
            await att.save();
            actionExecuted = true;
            actionDetails = `Logged office departure at ${checkOutTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
          } else {
            actionDetails = `Cannot check out. No active office check-in found for ${targetDate}.`;
          }
        }
        else if (type === 'START_WORK') {
          const { category } = payload;
          // Stop any active session first
          const active = await WorkSession.findOne({ userId, endTime: null });
          if (active) {
            active.endTime = new Date();
            active.duration = active.endTime.getTime() - new Date(active.startTime).getTime();
            await active.save();
          }

          await WorkSession.create({
            userId,
            date: todayStr,
            startTime: new Date(),
            category: category || 'Other'
          });
          actionExecuted = true;
          actionDetails = `Started work session for: ${category}`;
        }
        else if (type === 'STOP_WORK') {
          const active = await WorkSession.findOne({ userId, endTime: null });
          if (active) {
            active.endTime = new Date();
            active.duration = active.endTime.getTime() - new Date(active.startTime).getTime();
            await active.save();
            actionExecuted = true;
            actionDetails = `Stopped work session for: ${active.category} (${formatDuration(active.duration)})`;
          } else {
            actionDetails = `No active work session to stop.`;
          }
        }
        else if (type === 'UPDATE_WORK_SUMMARY') {
          const { summary, date } = payload;
          const targetDate = date || todayStr;
          
          let att = await OfficeAttendance.findOne({ userId, date: targetDate });
          if (!att) {
            att = new OfficeAttendance({
              userId,
              date: targetDate,
              arrivalTime: new Date(),
              workSummary: summary || ''
            });
          } else {
            att.workSummary = summary || '';
          }
          await att.save();
          actionExecuted = true;
          actionDetails = `Updated work summary note to "${summary}" for ${targetDate === todayStr ? 'today' : 'yesterday'} (${targetDate})`;
        }

        // Record agent action log
        if (actionExecuted) {
          await AgentActivity.create({
            userId,
            action: 'agent_action',
            details: `Agent Action: ${actionDetails}`
          });
        }
      } catch (dbErr) {
        console.error('Database action error:', dbErr);
        aiResponse.reply += `\n\n*(Error performing action: ${dbErr.message})*`;
      }
    }

    res.json({
      reply: aiResponse.reply,
      action: aiResponse.action,
      executed: actionExecuted,
      actionDetails: actionDetails
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get AI Daily summary and coaching insights
// @route   GET /api/agent/summary
// @access  Private
router.get('/summary', protect, async (req, res) => {
  const { date } = req.query;
  const userId = req.user._id;
  const todayStr = date || new Date().toISOString().split('T')[0];

  try {
    // Fetch today's data specifically
    const [expenses, activity, attendance, workSessions] = await Promise.all([
      Expense.find({ userId, date: todayStr }),
      DailyActivity.findOne({ userId, date: todayStr }),
      OfficeAttendance.findOne({ userId, date: todayStr }),
      WorkSession.find({ userId, date: todayStr })
    ]);

    const workDurationMs = workSessions.reduce((acc, curr) => acc + (curr.duration || 0), 0);
    const spendingAmt = expenses.reduce((acc, curr) => acc + curr.amount, 0);
    const stepsCount = activity?.steps || 0;

    const geminiKey = process.env.GEMINI_API_KEY;
    let summaryJson = null;

    if (geminiKey) {
      try {
        const prompt = `You are a personal AI coach. Analyze the user's tracking metrics for today (${todayStr}) and summarize their day.
Metrics:
- Steps: ${stepsCount} (distance: ${activity?.walkingDistance || 0} km)
- Office check-in: ${attendance?.arrivalTime ? new Date(attendance.arrivalTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : 'None'}
- Office check-out: ${attendance?.departureTime ? new Date(attendance.departureTime).toLocaleTimeString([], {hour: '2-digit', minute: '2-digit'}) : 'None'}
- Office presence duration: ${attendance?.officeDuration ? (attendance.officeDuration / 3600000).toFixed(1) : 0} hours
- Work timers: ${JSON.stringify(workSessions.map(w => ({ category: w.category, duration: w.duration })))}
- Money spent: ₹${spendingAmt} (Expenses: ${JSON.stringify(expenses.map(e => ({ amount: e.amount, category: e.category, note: e.note })))})

Write a brief (max 3 sentences) summary of their day's activities. Then suggest 2 short bullet points of coaching insights or wellness tips based on these numbers.
Return a JSON object conforming exactly to this schema:
{
  "summary": "Your encouraging summary text here.",
  "insights": ["Insight 1", "Insight 2"]
}
`;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${geminiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json'
            }
          })
        });

        const geminiData = await response.json();
        if (response.ok) {
          const rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          summaryJson = JSON.parse(rawText);
        }
      } catch (geminiErr) {
        console.error('Gemini summary call error:', geminiErr);
      }
    }

    if (!summaryJson) {
      // Fallback response
      const workHoursText = formatDuration(workDurationMs);
      summaryJson = {
        summary: `Today, you logged ${workHoursText} of work sessions, walked ${stepsCount.toLocaleString()} steps, and spent ₹${spendingAmt}. Connect the Gemini API in the environment settings to unlock deep, personalized AI coaching summaries!`,
        insights: [
          stepsCount < 6000 ? "Try to take a quick walk in the evening to hit 8,000 steps." : "Excellent job hitting your steps today! Keep it up.",
          spendingAmt > 500 ? "You spent ₹" + spendingAmt + " today. Review your budget to ensure you are on track." : "Good job keeping expenses low today."
        ]
      };
    }

    res.json(summaryJson);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @route   GET /api/agent/activities
// @desc    Get agent activities logs
// @access  Private
router.get('/activities', protect, async (req, res) => {
  try {
    const logs = await AgentActivity.find({ userId: req.user._id })
      .sort({ timestamp: -1 })
      .limit(50);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
