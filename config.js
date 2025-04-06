// Configuration settings for Profanity Guard
const CONFIG = {
  // Time between scans in milliseconds (default: 5 seconds)
  SCAN_INTERVAL: 20000,

  // Minimum confidence score for blocking content (0-1)
  MIN_CONFIDENCE: 0.7,

  // Maximum number of activities to keep in history
  MAX_ACTIVITIES: 100,

  // Whether to show notifications for blocked content
  SHOW_NOTIFICATIONS: true,

  // Whether to enable the guard by default
  ENABLE_GUARD_BY_DEFAULT: true,
};

// Make the config object available globally for Chrome extensions
window.CONFIG = CONFIG;
