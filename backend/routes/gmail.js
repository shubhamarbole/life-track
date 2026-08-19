import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import JobEmail from '../models/JobEmail.js';
import AgentActivity from '../models/AgentActivity.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Helper to build redirect URI dynamically
const getRedirectUri = (req) => {
  const host = req.get('host');
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  return `${protocol}://${host}/api/gmail/callback`;
};

// Helper to decode base64url standard
const decodeBase64Url = (str) => {
  if (!str) return '';
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
};

// Recursive body parser helper
const getEmailBody = (part) => {
  if (part.mimeType === 'text/plain' && part.body && part.body.data) {
    return decodeBase64Url(part.body.data);
  }
  if (part.mimeType === 'text/html' && part.body && part.body.data) {
    return decodeBase64Url(part.body.data);
  }
  if (part.parts && part.parts.length > 0) {
    for (const subPart of part.parts) {
      const subBody = getEmailBody(subPart);
      if (subBody) return subBody;
    }
  }
  return '';
};

// @desc    Redirect to Google OAuth consent screen for Gmail scope
// @route   GET /api/gmail/login
// @access  Public
router.get('/login', async (req, res) => {
  try {
    const { token } = req.query; // Client passes JWT to persist session through state
    if (!token) {
      return res.status(400).send('Authorization token is required in query parameters.');
    }

    if (!process.env.GOOGLE_CLIENT_ID) {
      return res.status(500).send('Google Client ID is not configured in backend environment.');
    }

    const redirectUri = getRedirectUri(req);
    
    // We request offline access and force consent to guarantee we get a refresh token
    const googleUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + new URLSearchParams({
      response_type: 'code',
      client_id: process.env.GOOGLE_CLIENT_ID,
      redirect_uri: redirectUri,
      scope: 'https://www.googleapis.com/auth/gmail.readonly',
      access_type: 'offline',
      prompt: 'consent',
      state: token
    }).toString();

    res.redirect(googleUrl);
  } catch (error) {
    res.status(500).send(error.message);
  }
});

// @desc    Google OAuth Callback
// @route   GET /api/gmail/callback
// @access  Public
router.get('/callback', async (req, res) => {
  const { code, state } = req.query;
  if (!code || !state) {
    return res.status(400).send('Authentication code and state token are required.');
  }

  // 1. Decode state token to identify the user
  let userId;
  try {
    const decoded = jwt.verify(state, process.env.JWT_SECRET);
    userId = decoded.id;
  } catch (err) {
    return res.status(401).send('Authentication state has expired or is invalid.');
  }

  const redirectUri = getRedirectUri(req);

  try {
    // 2. Exchange Auth Code for Access & Refresh Tokens
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code'
      })
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error_description || 'Token exchange failed');
    }

    // 3. Save tokens to the User
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).send('User not found.');
    }

    user.googleAccessToken = data.access_token;
    if (data.refresh_token) {
      user.googleRefreshToken = data.refresh_token;
    }
    user.googleTokenExpiry = new Date(Date.now() + data.expires_in * 1000);
    user.isGoogleFitConnected = true; // reusing connection boolean
    await user.save();

    await AgentActivity.create({
      userId,
      action: 'gmail_connected',
      details: 'Gmail account connected via OAuth 2.0 successfully.'
    });

    // Redirect the user back to the settings/dashboard page on the client
    res.redirect('/?google=success');
  } catch (error) {
    console.error('Google Gmail callback error:', error);
    res.redirect('/?google=error');
  }
});

// @desc    Disconnect Gmail sync
// @route   POST /api/gmail/disconnect
// @access  Private
router.post('/disconnect', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.googleAccessToken = null;
    user.googleRefreshToken = null;
    user.googleTokenExpiry = null;
    user.isGoogleFitConnected = false;
    await user.save();

    await AgentActivity.create({
      userId: req.user._id,
      action: 'gmail_disconnected',
      details: 'Gmail connection disconnected by user.'
    });

    res.json({ message: 'Gmail disconnected successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Check Connection Status
// @route   GET /api/gmail/status
// @access  Private
router.get('/status', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    res.json({
      connected: !!(user && user.googleRefreshToken)
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Sync recent emails and classify them
// @route   POST /api/gmail/sync
// @access  Private
router.post('/sync', protect, async (req, res) => {
  const userId = req.user._id;

  try {
    // Log sync start
    await AgentActivity.create({
      userId,
      action: 'sync_start',
      details: 'Initiated Gmail check for new job/interview emails.'
    });

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isConnected = user.googleAccessToken && user.googleRefreshToken;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!isConnected) {
      // Simulation / Demo Mode!
      await new Promise(resolve => setTimeout(resolve, 1500)); // Simulate work
      
      const existingMocks = await JobEmail.find({ userId, messageId: { $regex: /^mock_/ } });
      const newMocks = [];

      if (existingMocks.length === 0) {
        // 1. Mock Interview Invite
        const mock1 = await JobEmail.create({
          userId,
          messageId: 'mock_email_1',
          threadId: 'mock_thread_1',
          subject: 'Interview Schedule: Frontend Developer at ABC Technologies',
          from: 'hr@abctechnologies.com',
          snippet: 'Congratulations! You have been shortlisted for the Frontend Developer interview. We invite you for a Meet session...',
          body: 'Dear Shubham, thank you for applying. We are pleased to invite you for an online video interview on 20 August 2026 at 11:00 AM. Please use this Meet link: https://meet.google.com/abc-defg-hij',
          receivedAt: new Date(Date.now() - 3600 * 1000 * 2), // 2h ago
          classification: 'interview_invite',
          extractedDetails: {
            companyName: 'ABC Technologies',
            jobRole: 'Frontend Developer',
            interviewDate: '2026-08-20',
            interviewTime: '11:00 AM',
            interviewType: 'Online',
            locationOrLink: 'https://meet.google.com/abc-defg-hij',
            recruiterName: 'HR Recruiter',
            importantInstructions: 'Please make sure you join from a quiet place with stable internet.'
          }
        });
        newMocks.push(mock1);

        // 2. Mock Rejection
        const mock2 = await JobEmail.create({
          userId,
          messageId: 'mock_email_2',
          threadId: 'mock_thread_2',
          subject: 'Application Status Update - React Developer',
          from: 'careers@innovativesolutions.com',
          snippet: 'Thank you for your interest. Unfortunately, we have decided to move forward with other candidates...',
          body: 'Dear candidate, thank you for taking the time to apply. Unfortunately, we will not be moving forward with your application at this time...',
          receivedAt: new Date(Date.now() - 3600 * 1000 * 24), // 24h ago
          classification: 'rejection',
          extractedDetails: {
            companyName: 'Innovative Solutions',
            jobRole: 'React Developer',
            interviewType: 'unknown'
          }
        });
        newMocks.push(mock2);

        // 3. Mock Recruiter Message
        const mock3 = await JobEmail.create({
          userId,
          messageId: 'mock_email_3',
          threadId: 'mock_thread_3',
          subject: 'Job opening: MERN Stack Developer at CloudScale',
          from: 'julia.recruiter@cloudscale.com',
          snippet: 'Hey! I saw your resume online and wanted to check if you are looking for new opportunities...',
          body: 'Hello, I came across your profile and thought your MERN stack skills are a great match for a Senior React/Node dev role at CloudScale.',
          receivedAt: new Date(Date.now() - 3600 * 1000 * 48), // 48h ago
          classification: 'recruiter_message',
          extractedDetails: {
            companyName: 'CloudScale',
            jobRole: 'MERN Stack Developer',
            recruiterName: 'Julia',
            interviewType: 'unknown'
          }
        });
        newMocks.push(mock3);

        // Add matching activity logs
        await AgentActivity.create({
          userId,
          action: 'email_match',
          details: 'Detected job email: interview invite from ABC Technologies'
        });
        await AgentActivity.create({
          userId,
          action: 'email_match',
          details: 'Detected job email: rejection from Innovative Solutions'
        });
        await AgentActivity.create({
          userId,
          action: 'email_match',
          details: 'Detected job email: recruiter message from CloudScale'
        });
      }

      await AgentActivity.create({
        userId,
        action: 'sync_complete',
        details: 'Sync simulated. Gmail is not connected. Loaded mock demonstration data (3 job emails).'
      });

      return res.json({
        status: 'simulated',
        message: 'Gmail is not connected. Google client keys are required for real connection. Running demo simulation mode.',
        newCount: newMocks.length
      });
    }

    // Real Google OAuth Connection Sync
    let accessToken = user.googleAccessToken;
    const isExpired = !user.googleTokenExpiry || new Date(user.googleTokenExpiry).getTime() - Date.now() < 60000;

    if (isExpired) {
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: process.env.GOOGLE_CLIENT_ID,
          client_secret: process.env.GOOGLE_CLIENT_SECRET,
          refresh_token: user.googleRefreshToken,
          grant_type: 'refresh_token'
        })
      });

      const refreshData = await refreshResponse.json();
      if (!refreshResponse.ok) {
        throw new Error(refreshData.error_description || 'Failed to refresh Google token');
      }

      accessToken = refreshData.access_token;
      user.googleAccessToken = accessToken;
      user.googleTokenExpiry = new Date(Date.now() + refreshData.expires_in * 1000);
      await user.save();
    }

    // Fetch message IDs from last 7 days
    const listResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=15&q=newer_than:7d', {
      headers: { 'Authorization': `Bearer ${accessToken}` }
    });

    const listData = await listResponse.json();
    if (!listResponse.ok) {
      throw new Error(listData.error?.message || 'Failed to fetch Gmail list');
    }

    const messages = listData.messages || [];
    let newCount = 0;

    for (const msg of messages) {
      // Check if message was already processed
      const existing = await JobEmail.findOne({ messageId: msg.id });
      if (existing) continue;

      // Fetch message detail
      const detailResponse = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${msg.id}`, {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      const emailDetail = await detailResponse.json();
      if (!detailResponse.ok) continue;

      // Parse headers
      const headers = emailDetail.payload.headers || [];
      const subject = headers.find(h => h.name.toLowerCase() === 'subject')?.value || '';
      const from = headers.find(h => h.name.toLowerCase() === 'from')?.value || '';
      const dateVal = headers.find(h => h.name.toLowerCase() === 'date')?.value || '';
      const receivedAt = dateVal ? new Date(dateVal) : new Date();

      const snippet = emailDetail.snippet || '';
      const body = getEmailBody(emailDetail.payload) || snippet;

      let classification = 'ignored';
      let extractedDetails = { interviewType: 'unknown' };

      if (geminiKey) {
        try {
          const prompt = `You are "AI YOU", an autonomous job agent. Analyze the following email to determine if it is related to a job application process, recruiters, interviews, shortlistings, or rejections.
Email Details:
From: ${from}
Subject: ${subject}
Snippet: ${snippet}
Body: ${body.substring(0, 3000)}

Return a JSON object conforming exactly to this schema:
{
  "isJobRelated": boolean,
  "classification": "interview_invite" | "interview_schedule" | "recruiter_message" | "application_update" | "rejection" | "shortlisted" | "other_job_related" | "ignored",
  "extractedDetails": {
    "companyName": string,
    "jobRole": string,
    "interviewDate": string, // format YYYY-MM-DD
    "interviewTime": string,
    "interviewType": "Online" | "In-person" | "Phone" | "unknown",
    "locationOrLink": string,
    "recruiterName": string,
    "importantInstructions": string
  }
}
If the email is NOT related to job opportunities, recruiter messages, or application status updates, set "isJobRelated" to false and classification to "ignored".
`;

          const geminiResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: {
                responseMimeType: 'application/json'
              }
            })
          });

          const geminiData = await geminiResponse.json();
          if (geminiResponse.ok) {
            const aiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text;
            const parsed = JSON.parse(aiText);
            if (parsed.isJobRelated) {
              classification = parsed.classification;
              extractedDetails = parsed.extractedDetails || { interviewType: 'unknown' };
            }
          }
        } catch (geminiErr) {
          console.error('Gemini Classification Error:', geminiErr);
          // Regex fallback
          const text = (subject + ' ' + body).toLowerCase();
          if (text.includes('interview') || text.includes('schedule')) {
            classification = 'interview_invite';
          }
        }
      } else {
        // Regex fallback without Gemini key
        const text = (subject + ' ' + body).toLowerCase();
        if (text.includes('interview') || text.includes('schedule')) {
          classification = 'interview_invite';
        } else if (text.includes('reject') || text.includes('unfortunately')) {
          classification = 'rejection';
        } else if (text.includes('offer') || text.includes('shortlist')) {
          classification = 'shortlisted';
        }
      }

      // Save to database
      await JobEmail.create({
        userId,
        messageId: msg.id,
        threadId: msg.threadId || '',
        subject,
        from,
        body,
        snippet,
        receivedAt,
        classification,
        extractedDetails
      });

      if (classification !== 'ignored') {
        newCount++;
        await AgentActivity.create({
          userId,
          action: 'email_match',
          details: `Detected job email: ${classification.replace('_', ' ')} from ${from} for company ${extractedDetails.companyName || 'Unknown'}`
        });
      }
    }

    await AgentActivity.create({
      userId,
      action: 'sync_complete',
      details: `Gmail check complete. Found ${newCount} new job-related emails.`
    });

    res.json({
      status: 'success',
      newCount
    });

  } catch (err) {
    console.error('Gmail sync error:', err);
    await AgentActivity.create({
      userId,
      action: 'sync_error',
      details: `Sync failed: ${err.message}`
    });
    res.status(500).json({ message: err.message });
  }
});

// @desc    Get dashboard notifications
// @route   GET /api/gmail/notifications
// @access  Private
router.get('/notifications', protect, async (req, res) => {
  try {
    const notifications = await JobEmail.find({
      userId: req.user._id,
      classification: { $ne: 'ignored' }
    }).sort({ receivedAt: -1 }).limit(10);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get all detected upcoming interviews
// @route   GET /api/gmail/interviews
// @access  Private
router.get('/interviews', protect, async (req, res) => {
  try {
    const interviews = await JobEmail.find({
      userId: req.user._id,
      classification: { $in: ['interview_invite', 'interview_schedule'] }
    }).sort({ receivedAt: -1 });
    res.json(interviews);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Get recent agent activities
// @route   GET /api/gmail/activities
// @access  Private
router.get('/activities', protect, async (req, res) => {
  try {
    const activities = await AgentActivity.find({
      userId: req.user._id
    }).sort({ timestamp: -1 }).limit(20);
    res.json(activities);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Mark email/notification as read
// @route   POST /api/gmail/read/:id
// @access  Private
router.post('/read/:id', protect, async (req, res) => {
  try {
    const email = await JobEmail.findById(req.params.id);
    if (!email) {
      return res.status(404).json({ message: 'Email record not found' });
    }
    if (email.userId.toString() !== req.user._id.toString()) {
      return res.status(401).json({ message: 'Not authorized' });
    }
    email.status = 'read';
    await email.save();
    res.json({ message: 'Marked as read' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

export default router;
