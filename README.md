# LifeTrack - Mobile-First Personal Tracking Platform

LifeTrack is a secure, personal tracking application that automates the tracking of daily routines, office check-ins, walking activities, and work sessions while allowing easy manual entry of expenses.

## Features

- 🏠 **Unified Dashboard**: Today's metrics at a glance: office hours, steps, work duration, and budget.
- 📍 **Automatic Geofencing Check-in/out**: Uses the browser's Geolocation API to detect when you enter or exit your configured office location. Includes manual calibration settings.
- 🚶 **Step Sync Architecture**: Ready-to-integrate with sensor events. Simulation panels allow syncing mock telemetry directly.
- 💰 **Spending Logger**: Clean modal for adding expenses, displaying category-wise graphs and daily, weekly, and monthly totals.
- 📅 **Daily History Calendar**: High-level calendar views showing daily expenses and work durations, opening up granular logs for any selected day.
- 📊 **Monthly Reports & Analytics**: Interactive Recharts tracking daily metrics, monthly averages, and a copyable Markdown summaries.
- 🔒 **Privacy Scoped**: Local theme config, clear permission flows, and a **"Delete My Data"** toggle that erases your account and database records completely.
- 📱 **PWA Support**: Responsive, offline-capable layout installable on Android, iOS, or Desktops.

---

## Architecture Overview

LifeTrack runs as a decoupled Web Application with automated frontend geofencing:

```text
                                  +-----------------------+
                                  |   Browser/PWA Client   |
                                  | (React.js, CSS, Vite) |
                                  +-----------+-----------+
                                              |
                              REST API Calls  |  Geolocation Updates
                             (JWT Protected)  |  & Steps Simulator
                                              v
                                  +-----------+-----------+
                                  | Node/Express Backend  |
                                  | (bcrypt, jwt, mongoose)|
                                  +-----------+-----------+
                                              |
                                              v
                                  +-----------+-----------+
                                  |      MongoDB          |
                                  +-----------------------+
```

---

## Setup & Installation

### Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- [MongoDB](https://www.mongodb.com/) running locally (port `27017`) or a MongoDB Atlas URI.

### 1. Clone & Install Dependencies
Run the command below at the root directory. It automatically installs dependencies for both `backend` and `frontend` folders:
```bash
npm install
```

### 2. Configure Environment Variables
Create a `.env` file in the `backend/` folder (or edit the existing one created for you):
```ini
PORT=5000
MONGODB_URI=mongodb://127.0.0.1:27017/lifetrack
JWT_SECRET=super_secret_lifetrack_key_123!
```

### 3. Run Development Servers
To start the Node.js backend and Vite React development server concurrently, run:
```bash
npm run dev
```
- **Frontend** runs on: `http://localhost:3000`
- **Backend** runs on: `http://localhost:5000`

---

## Geofencing & Location Permissions

1. Go to the **Settings** page (`http://localhost:3000/settings`).
2. Click **Detect GPS Location** or enter your office's Latitude and Longitude manually, set a radius (in meters), and click **Save Settings**.
3. Toggle the **Automatic Office Attendance Tracking** switch on the dashboard.
4. When prompted by your browser, grant location permissions.
5. While the app is active in the foreground, it checks your distance. If you are within the radius, you are checked in. Leaving the radius checks you out.

*Note: Background geofencing is restricted by mobile browsers when closed. For background tracking, native Android/iOS shells are required.*

---

## Native Integration vs Browser Support

| Feature | Browser / PWA Capability | Future Native Android/iOS Shell Integration |
| :--- | :--- | :--- |
| **Spending Log** | **Fully Automatic** (Manual Input) | **Fully Automatic** (Will share same REST endpoints) |
| **Work Timers** | **Fully Automatic** (Manual Toggles) | **Fully Automatic** |
| **Geofencing** | **Foreground only** (WatchPosition checks when open) | **Background Service** (OS Geofencing APIs trigger check-in) |
| **Steps & Walking** | **Simulation Console** (Browser cannot access sensors directly) | **Native Sensor API** (Uses OS step counter & sends to `/api/activity/update`) |

### Developer Simulation Console
Since native steps are not readable directly by web browsers, a **Simulation Console** is included in the **Settings** page.
- Test step syncs by entering values (e.g. `8200` steps, `6.4` km) and clicking **Simulate Step Sync**.
- Test geofence transitions by clicking **Simulate Check-in** or **Simulate Check-out**.

---

## PWA Installation

1. Open `http://localhost:3000` in Chrome (on Android/Desktop) or Safari (on iOS).
2. On Android/Chrome, click the **Install App** icon in the address bar or select "Add to Home screen" in the settings menu.
3. On iOS, click the **Share** button and select **Add to Home Screen**.
