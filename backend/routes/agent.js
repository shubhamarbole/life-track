import express from 'express';
import Expense from '../models/Expense.js';
import DailyActivity from '../models/DailyActivity.js';
import OfficeAttendance from '../models/OfficeAttendance.js';
import WorkSession from '../models/WorkSession.js';
import AgentActivity from '../models/AgentActivity.js';
import Holiday from '../models/Holiday.js';
import { protect } from '../middleware/auth.js';
import { publishAgentEvent } from '../utils/mqtt.js';

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

// Helper to format UTC Date to user local time string independently of server timezone
const getLocalTimeString = (utcDate, offsetMins) => {
  if (!utcDate) return 'None';
  const dateObj = new Date(utcDate);
  if (isNaN(dateObj.getTime())) return 'None';
  if (offsetMins !== undefined && offsetMins !== null) {
    dateObj.setMinutes(dateObj.getMinutes() - parseInt(offsetMins));
  }
  return dateObj.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'UTC'
  });
};

// Helper to calculate last week (past 7 days) metrics
const getLastWeekMetrics = (todayStr, expenses, activities, attendance, workSessions, holidays) => {
  const baseDate = new Date(todayStr);
  const weekDates = [];
  for (let i = 1; i <= 7; i++) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() - i);
    weekDates.push(d.toISOString().split('T')[0]);
  }
  const startWeek = weekDates[weekDates.length - 1];
  const endWeek = weekDates[0];

  const weekExpenses = expenses.filter(e => weekDates.includes(e.date));
  const totalSpent = weekExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);
  const spentBreakdown = {};
  weekExpenses.forEach(e => {
    spentBreakdown[e.category] = (spentBreakdown[e.category] || 0) + e.amount;
  });

  const weekActivities = activities.filter(a => weekDates.includes(a.date));
  const totalSteps = weekActivities.reduce((sum, a) => sum + (a.steps || 0), 0);
  const totalDist = weekActivities.reduce((sum, a) => sum + (a.walkingDistance || 0), 0);
  const avgSteps = Math.round(totalSteps / 7);

  const weekSessions = workSessions.filter(w => weekDates.includes(w.date));
  const totalWorkMs = weekSessions.reduce((sum, w) => sum + (w.duration || 0), 0);
  const workBreakdown = {};
  weekSessions.forEach(w => {
    workBreakdown[w.category] = (workBreakdown[w.category] || 0) + (w.duration || 0);
  });

  const weekAttendance = attendance.filter(a => weekDates.includes(a.date));
  const officeDays = weekAttendance.filter(a => a.arrivalTime).length;
  const officeDurationMs = weekAttendance.reduce((sum, a) => sum + (a.officeDuration || 0), 0);

  const weekHolidays = holidays.filter(h => weekDates.includes(h.date));

  return {
    startDate: startWeek,
    endDate: endWeek,
    dates: weekDates,
    expenses: { total: totalSpent, count: weekExpenses.length, breakdown: spentBreakdown },
    steps: { total: totalSteps, avgDaily: avgSteps, distanceKm: totalDist },
    work: { totalMs: totalWorkMs, breakdown: workBreakdown },
    office: { daysAttended: officeDays, totalDurationMs: officeDurationMs },
    holidays: weekHolidays.map(h => ({ name: h.name, date: h.date, type: h.type }))
  };
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
    const [expenses, activities, attendance, workSessions, holidays] = await Promise.all([
      Expense.find({ userId, date: { $gte: startDate } }).sort({ date: -1 }),
      DailyActivity.find({ userId, date: { $gte: startDate } }).sort({ date: -1 }),
      OfficeAttendance.find({ userId, date: { $gte: startDate } }).sort({ date: -1 }),
      WorkSession.find({ userId, date: { $gte: startDate } }).sort({ date: -1 }),
      Holiday.find({ userId }).sort({ date: -1 })
    ]);

    const lastWeek = getLastWeekMetrics(todayStr, expenses, activities, attendance, workSessions, holidays);

    const geminiKey = process.env.GEMINI_API_KEY;
    let aiResponse = null;
    let requestFailed = false;
    let rateLimited = false;

    if (geminiKey) {
      try {
        const clientTime = getLocalTimeString(new Date(), timezoneOffset);
        const systemPrompt = `You are 'DayTrack AI', a helpful, personal daily tracking companion.
You analyze the user's daily habits, expenses, office hours, work productivity, and movement step count to provide coaching, answer questions, and perform actions.

Context about the user:
Current Date: ${todayStr}
Current Time: ${clientTime}

Pre-computed Last Week Summary (${lastWeek.startDate} to ${lastWeek.endDate}):
- Total Work Logged: ${formatDuration(lastWeek.work.totalMs)} (Breakdown: ${JSON.stringify(Object.fromEntries(Object.entries(lastWeek.work.breakdown).map(([k, v]) => [k, formatDuration(v)])))})
- Total Steps Walked: ${lastWeek.steps.total.toLocaleString()} steps (Daily average: ~${lastWeek.steps.avgDaily.toLocaleString()} steps/day, ${lastWeek.steps.distanceKm.toFixed(1)} km)
- Total Spending: ₹${lastWeek.expenses.total.toLocaleString()} (Breakdown: ${JSON.stringify(lastWeek.expenses.breakdown)})
- Office Attendance: ${lastWeek.office.daysAttended} day(s) (${(lastWeek.office.totalDurationMs / 3600000).toFixed(1)} hours)
- Holidays: ${JSON.stringify(lastWeek.holidays)}

User Tracking History (Last 30 Days):
- Expenses: ${JSON.stringify(expenses.map(e => ({ amount: e.amount, category: e.category, note: e.note, date: e.date })))}
- Daily Movement & Steps: ${JSON.stringify(activities.map(a => ({ steps: a.steps, distance: a.walkingDistance, date: a.date })))}
- Office Attendance Logs: ${JSON.stringify(attendance.map(att => ({ arrival: getLocalTimeString(att.arrivalTime, timezoneOffset), departure: getLocalTimeString(att.departureTime, timezoneOffset), duration: att.officeDuration, date: att.date })))}
- Work Productivity Sessions: ${JSON.stringify(workSessions.map(w => ({ category: w.category, duration: w.duration, startTime: getLocalTimeString(w.startTime, timezoneOffset), endTime: getLocalTimeString(w.endTime, timezoneOffset), date: w.date })))}
- Holiday Calendar: ${JSON.stringify(holidays.map(h => ({ name: h.name, date: h.date, type: h.type })))}

Your tasks:
1. Provide concise, encouraging, and friendly answers to the user's questions about their logs, history, productivity, or spendings.
2. If the user asks for a summary of last week, past week, or weekly recap, use the Pre-computed Last Week Summary above to deliver an encouraging, structured review of their work hours, fitness steps, money spent in Rupees (₹), and office attendance with wellness insights.
3. If the user requests to record, start, stop, check-in, check-out, or modify any tracking data, you MUST return a structured action object in your JSON response. Do NOT perform any database writes yourself, just supply the action request.
4. Available Actions:
   - CREATE_EXPENSE: { amount: Number (required), category: 'Food' | 'Travel' | 'Shopping' | 'Bills' | 'Other' (required), note: String (optional), date: String (optional, format YYYY-MM-DD, defaults to today: ${todayStr}) }
   - UPDATE_STEPS: { steps: Number (required), date: String (optional, YYYY-MM-DD, defaults to today: ${todayStr}) }
   - CHECK_IN: { time: String (optional, format HH:MM, defaults to now), date: String (optional, YYYY-MM-DD, defaults to today: ${todayStr}) }
   - CHECK_OUT: { time: String (optional, format HH:MM, defaults to now), date: String (optional, YYYY-MM-DD, defaults to today: ${todayStr}) }
   - START_WORK: { category: 'Coding' | 'Learning' | 'Meeting' | 'Other' (required) }
   - STOP_WORK: {}
   - UPDATE_WORK_SUMMARY: { summary: String (required), date: String (optional, YYYY-MM-DD, defaults to today: ${todayStr}) }
   - CREATE_HOLIDAY: { date: String (required, format YYYY-MM-DD), name: String (required), type: 'Public' | 'Personal' (optional) }

5. Response Format:
   You MUST return a JSON object conforming exactly to this schema:
   {
     "reply": "Your conversational response in markdown formatting. If you are triggerring an action, explicitly confirm what action you have prepared.",
     "action": null | {
       "type": "CREATE_EXPENSE" | "UPDATE_STEPS" | "CHECK_IN" | "CHECK_OUT" | "START_WORK" | "STOP_WORK" | "UPDATE_WORK_SUMMARY" | "CREATE_HOLIDAY",
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
          let rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
          if (rawText) {
            rawText = rawText.trim();
            if (rawText.startsWith('```')) {
              rawText = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();
            }
            aiResponse = JSON.parse(rawText);
          }
        } else {
          console.error('Gemini API Error:', geminiData);
          requestFailed = true;
          if (response.status === 429) {
            rateLimited = true;
          }
        }
      } catch (geminiErr) {
        console.error('Gemini sync call error:', geminiErr);
        requestFailed = true;
      }
    }

    // 2. Rule-based Fallback Parser (if Gemini key is missing or call failed)
    if (!aiResponse) {
      let fallbackText = "I am running in local offline mode. To enable smart AI responses, please configure `GEMINI_API_KEY` in the `backend/.env` file. However, I can still parse basic command patterns!";
      if (geminiKey && requestFailed) {
        fallbackText = rateLimited 
          ? "I am currently rate-limited by the Gemini AI quota. Please wait a few seconds and try again." 
          : "I encountered an issue connecting to the Gemini AI service. Please verify your internet connection and try again in a few seconds.";
      }
      aiResponse = {
        reply: fallbackText,
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
      // Parse weekly summary query, e.g. "last week summary", "klast week summary", "past week summary", "weekly summary"
      else if (
        lowerMsg.includes('last week') || 
        lowerMsg.includes('past week') || 
        lowerMsg.includes('previous week') || 
        lowerMsg.includes('klast week') || 
        (lowerMsg.includes('week') && (lowerMsg.includes('summary') || lowerMsg.includes('report') || lowerMsg.includes('how was') || lowerMsg.includes('stats') || lowerMsg.includes('review')))
      ) {
        const lastWeek = getLastWeekMetrics(todayStr, expenses, activities, attendance, workSessions, holidays);
        const workBreakdownStr = Object.entries(lastWeek.work.breakdown)
          .map(([cat, ms]) => `${cat}: ${formatDuration(ms)}`)
          .join(', ');
        const spentBreakdownStr = Object.entries(lastWeek.expenses.breakdown)
          .map(([cat, amt]) => `${cat}: ₹${amt.toLocaleString()}`)
          .join(', ');

        aiResponse.reply = `Rule Agent: Here is your **Last Week Summary** (${lastWeek.startDate} to ${lastWeek.endDate}):\n\n` +
          `• ⏱️ **Total Work Logged**: ${formatDuration(lastWeek.work.totalMs)}${workBreakdownStr ? ` (${workBreakdownStr})` : ''}\n` +
          `• 👟 **Total Steps Walked**: ${lastWeek.steps.total.toLocaleString()} steps (~${lastWeek.steps.avgDaily.toLocaleString()} steps/day, ${lastWeek.steps.distanceKm.toFixed(1)} km)\n` +
          `• 💰 **Total Money Spent**: ₹${lastWeek.expenses.total.toLocaleString()}${spentBreakdownStr ? ` (${spentBreakdownStr})` : ''}\n` +
          `• 🏢 **Office Days Attended**: ${lastWeek.office.daysAttended} day${lastWeek.office.daysAttended !== 1 ? 's' : ''} (${(lastWeek.office.totalDurationMs / 3600000).toFixed(1)} hours)\n` +
          (lastWeek.holidays.length > 0 ? `• 🌴 **Holidays/Events**: ${lastWeek.holidays.map(h => `${h.name} (${h.date})`).join(', ')}\n` : '') +
          `\nKeep up the great tracking and productivity! 🚀`;
      }
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
        else if (type === 'CREATE_HOLIDAY') {
          const { date, name, type: hType } = payload;
          const targetDate = date || todayStr;
          
          let holiday = await Holiday.findOne({ userId, date: targetDate });
          if (holiday) {
            holiday.name = name;
            holiday.type = hType || holiday.type;
            await holiday.save();
            actionDetails = `Updated holiday on ${targetDate} to "${name}"`;
          } else {
            await Holiday.create({
              userId,
              date: targetDate,
              name,
              type: hType || 'Public'
            });
            actionDetails = `Logged new holiday on ${targetDate}: "${name}"`;
          }
          actionExecuted = true;
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

    // Publish agent response/action events to MQTT broker
    publishAgentEvent(userId, actionExecuted ? 'agent_action' : 'agent_reply', actionExecuted ? actionDetails : aiResponse.reply);

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

// @desc    Get AI Daily or Weekly summary and coaching insights
// @route   GET /api/agent/summary
// @access  Private
router.get('/summary', protect, async (req, res) => {
  const { date, timezoneOffset, type } = req.query;
  const userId = req.user._id;
  const todayStr = date || new Date().toISOString().split('T')[0];
  const isWeekly = type === 'weekly';

  try {
    let summaryJson = null;
    let lastWeek = null;
    let workDurationMs = 0;
    let spendingAmt = 0;
    let stepsCount = 0;

    if (isWeekly) {
      const startDate = getStartDate30DaysAgo();
      const [expenses, activities, attendance, workSessions, holidays] = await Promise.all([
        Expense.find({ userId, date: { $gte: startDate } }).sort({ date: -1 }),
        DailyActivity.find({ userId, date: { $gte: startDate } }).sort({ date: -1 }),
        OfficeAttendance.find({ userId, date: { $gte: startDate } }).sort({ date: -1 }),
        WorkSession.find({ userId, date: { $gte: startDate } }).sort({ date: -1 }),
        Holiday.find({ userId }).sort({ date: -1 })
      ]);

      lastWeek = getLastWeekMetrics(todayStr, expenses, activities, attendance, workSessions, holidays);

      const geminiKey = process.env.GEMINI_API_KEY;
      if (geminiKey) {
        try {
          const prompt = `You are a personal AI coach. Analyze the user's tracking metrics for the past week (${lastWeek.startDate} to ${lastWeek.endDate}) and summarize their week.
Metrics:
- Total Work Duration: ${formatDuration(lastWeek.work.totalMs)} (Breakdown: ${JSON.stringify(Object.fromEntries(Object.entries(lastWeek.work.breakdown).map(([k, v]) => [k, formatDuration(v)])))})
- Total Steps Walked: ${lastWeek.steps.total.toLocaleString()} steps (Daily average: ~${lastWeek.steps.avgDaily.toLocaleString()} steps/day, ${lastWeek.steps.distanceKm.toFixed(1)} km)
- Money Spent: ₹${lastWeek.expenses.total.toLocaleString()} (Breakdown: ${JSON.stringify(lastWeek.expenses.breakdown)})
- Office Attendance: ${lastWeek.office.daysAttended} day(s) (${(lastWeek.office.totalDurationMs / 3600000).toFixed(1)} hours)
- Holidays: ${JSON.stringify(lastWeek.holidays)}

Write a comprehensive, encouraging summary (max 3-4 sentences) of their week's activities and achievements. Then suggest 3 concise bullet points of actionable coaching insights or wellness tips.
Return a JSON object conforming exactly to this schema:
{
  "summary": "Your encouraging summary text here.",
  "insights": ["Insight 1", "Insight 2", "Insight 3"]
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
            let rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText) {
              rawText = rawText.trim();
              if (rawText.startsWith('```')) {
                rawText = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();
              }
              summaryJson = JSON.parse(rawText);
            }
          }
        } catch (geminiErr) {
          console.error('Gemini weekly summary call error:', geminiErr);
        }
      }

      if (!summaryJson) {
        summaryJson = {
          summary: `Over the past week (${lastWeek.startDate} to ${lastWeek.endDate}), you logged ${formatDuration(lastWeek.work.totalMs)} of work sessions, walked a total of ${lastWeek.steps.total.toLocaleString()} steps (~${lastWeek.steps.avgDaily.toLocaleString()} steps/day), and spent ₹${lastWeek.expenses.total.toLocaleString()}.`,
          insights: [
            lastWeek.steps.avgDaily < 7000 ? "Aim to boost daily walking habits to hit 8,000 steps consistently." : "Outstanding weekly step consistency! You maintained an active routine.",
            lastWeek.expenses.total > 3500 ? `Weekly spending reached ₹${lastWeek.expenses.total.toLocaleString()}. Review your budget to identify non-essential expenses.` : "Great job keeping spending disciplined this week.",
            `You logged ${formatDuration(lastWeek.work.totalMs)} of focused work. Keep setting clear milestones for each day.`
          ]
        };
      }
    } else {
      // Daily summary
      const [expenses, activity, attendance, workSessions] = await Promise.all([
        Expense.find({ userId, date: todayStr }),
        DailyActivity.findOne({ userId, date: todayStr }),
        OfficeAttendance.findOne({ userId, date: todayStr }),
        WorkSession.find({ userId, date: todayStr })
      ]);

      workDurationMs = workSessions.reduce((acc, curr) => acc + (curr.duration || 0), 0);
      spendingAmt = expenses.reduce((acc, curr) => acc + curr.amount, 0);
      stepsCount = activity?.steps || 0;

      const geminiKey = process.env.GEMINI_API_KEY;

      if (geminiKey) {
        try {
          const prompt = `You are a personal AI coach. Analyze the user's tracking metrics for today (${todayStr}) and summarize their day.
Metrics:
- Steps: ${stepsCount} (distance: ${activity?.walkingDistance || 0} km)
- Office check-in: ${getLocalTimeString(attendance?.arrivalTime, timezoneOffset)}
- Office check-out: ${getLocalTimeString(attendance?.departureTime, timezoneOffset)}
- Office presence duration: ${attendance?.officeDuration ? (attendance.officeDuration / 3600000).toFixed(1) : 0} hours
- Work timers: ${JSON.stringify(workSessions.map(w => ({ category: w.category, duration: w.duration, startTime: getLocalTimeString(w.startTime, timezoneOffset), endTime: getLocalTimeString(w.endTime, timezoneOffset) })))}
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
            let rawText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            if (rawText) {
              rawText = rawText.trim();
              if (rawText.startsWith('```')) {
                rawText = rawText.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/, '').trim();
              }
              summaryJson = JSON.parse(rawText);
            }
          }
        } catch (geminiErr) {
          console.error('Gemini summary call error:', geminiErr);
        }
      }

      if (!summaryJson) {
        const workHoursText = formatDuration(workDurationMs);
        summaryJson = {
          summary: `Today, you logged ${workHoursText} of work sessions, walked ${stepsCount.toLocaleString()} steps, and spent ₹${spendingAmt}. Connect the Gemini API in the environment settings to unlock deep, personalized AI coaching summaries!`,
          insights: [
            stepsCount < 6000 ? "Try to take a quick walk in the evening to hit 8,000 steps." : "Excellent job hitting your steps today! Keep it up.",
            spendingAmt > 500 ? "You spent ₹" + spendingAmt + " today. Review your budget to ensure you are on track." : "Good job keeping expenses low today."
          ]
        };
      }
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
