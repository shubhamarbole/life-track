import mongoose from 'mongoose';
import OfficeAttendance from '../models/OfficeAttendance.js';
import User from '../models/User.js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/lifetrack';

async function run() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log("Connected to Database");

    const user = await User.findOne();
    if (!user) {
      console.log("No user found");
      process.exit(0);
    }

    const date = '2026-08-18';
    const record = await OfficeAttendance.findOne({ userId: user._id, date });
    
    console.log("DATABASE RECORD FOR 2026-08-18:");
    console.log(JSON.stringify(record, null, 2));
    
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

run();
