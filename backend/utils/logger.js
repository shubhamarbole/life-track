const colors = {
  reset: "\x1b[0m",
  info: "\x1b[36m",    // Cyan
  success: "\x1b[32m", // Green
  warn: "\x1b[33m",    // Yellow
  error: "\x1b[31m"    // Red
};

const getTimestamp = () => {
  return new Date().toISOString();
};

export const logger = {
  info: (msg, ...args) => {
    console.log(`${colors.info}[INFO] [${getTimestamp()}] ${msg}${colors.reset}`, ...args);
  },
  success: (msg, ...args) => {
    console.log(`${colors.success}[SUCCESS] [${getTimestamp()}] ${msg}${colors.reset}`, ...args);
  },
  warn: (msg, ...args) => {
    console.warn(`${colors.warn}[WARN] [${getTimestamp()}] ${msg}${colors.reset}`, ...args);
  },
  error: (msg, ...args) => {
    console.error(`${colors.error}[ERROR] [${getTimestamp()}] ${msg}${colors.reset}`, ...args);
  }
};
