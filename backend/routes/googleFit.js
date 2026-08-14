import express from 'express';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch'; // Standard node fetch library
import User from '../models/User.js';
import DailyActivity from '../models/DailyActivity.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Helper to build redirect URI dynamically (works locally and in production behind proxies)
const getRedirectUri = (req) => {
  const host = req.get('host');
  const protocol = req.headers['x-forwarded-proto'] || req.protocol;
  return `${protocol}://${host}/api/auth/google/callback`;
};

// @desc    Redirect to Google OAuth consent screen
// @route   GET /api/auth/google/login
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
      scope: 'https://www.googleapis.com/auth/fitness.activity.read',
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
// @route   GET /api/auth/google/callback
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
    user.isGoogleFitConnected = true;
    await user.save();

    // Redirect the user back to the settings page on the client
    res.redirect('/settings?google=success');
  } catch (error) {
    console.error('Google Fit callback error:', error);
    res.redirect('/settings?google=error');
  }
});

// @desc    Disconnect Google Fit sync
// @route   POST /api/auth/google/disconnect
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

    res.json({ message: 'Google Fit disconnected successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// @desc    Synchronize today's steps from Google Fit cloud
// @route   POST /api/activity/google-sync
// @access  Private
router.post('/google-sync', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || !user.isGoogleFitConnected || !user.googleRefreshToken) {
      return res.status(400).json({ message: 'Google Fit is not connected for this account' });
    }

    // 1. Refresh Access Token if expired or close to expiry (within 1 minute)
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
        throw new Error(refreshData.error_description || 'Failed to refresh Google API token');
      }

      accessToken = refreshData.access_token;
      user.googleAccessToken = accessToken;
      user.googleTokenExpiry = new Date(Date.now() + refreshData.expires_in * 1000);
      await user.save();
    }

    // 2. Fetch steps taken today (local timezone dates converted to UTC milliseconds)
    const { date } = req.body; // format YYYY-MM-DD
    const todayStr = date || new Date().toISOString().split('T')[0];

    // Build local day boundaries
    const startTime = new Date(todayStr + 'T00:00:00').getTime();
    const endTime = new Date(todayStr + 'T23:59:59.999').getTime();

    const aggregateResponse = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        aggregateBy: [{
          dataTypeName: 'com.google.step_count.delta',
          dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps'
        }],
        bucketByTime: { durationMillis: 86400000 },
        startTimeMillis: startTime,
        endTimeMillis: endTime
      })
    });

    const fitData = await aggregateResponse.json();
    if (!aggregateResponse.ok) {
      throw new Error(fitData.error?.message || 'Failed to retrieve steps aggregation data from Google Fit');
    }

    // 3. Parse daily steps from the aggregate response
    let steps = 0;
    if (fitData.bucket && fitData.bucket.length > 0) {
      fitData.bucket.forEach(b => {
        if (b.dataset && b.dataset.length > 0) {
          b.dataset.forEach(ds => {
            if (ds.point && ds.point.length > 0) {
              ds.point.forEach(p => {
                if (p.value && p.value.length > 0) {
                  steps += p.value[0].intVal || 0;
                }
              });
            }
          });
        }
      });
    }

    // 4. Update the DailyActivity collection with the new values
    const distance = steps * 0.00075; // Approx 0.75m per step
    const duration = steps * 0.008;    // Approx 0.5s per step in minutes

    let activity = await DailyActivity.findOne({
      userId: user._id,
      date: todayStr
    });

    if (!activity) {
      activity = new DailyActivity({
        userId: user._id,
        date: todayStr,
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
    res.json(activity);
  } catch (error) {
    console.error('Google Fit steps synchronization error:', error);
    res.status(500).json({ message: error.message });
  }
});

export default router;
