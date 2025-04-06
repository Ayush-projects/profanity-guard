// Popup script for Profanity Guard

// DOM Elements
const guardToggle = document.getElementById("guard-toggle");
const apiKeyInput = document.getElementById("api-key");
const saveApiKeyBtn = document.getElementById("save-api-key");
const statsCount = document.getElementById("stats-count");
const statsTime = document.getElementById("stats-time");
const activityList = document.getElementById("activity-list");
const tabButtons = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");
const scanIntervalInput = document.getElementById("scan-interval");
const saveSettingsBtn = document.getElementById("save-settings");
const statusDot = document.querySelector(".status-dot");
const statusText = document.querySelector(".status-text");
const takeScreenshotBtn = document.getElementById("take-screenshot");

// Initialize popup
function initializePopup() {
  // Initialize activities array if it doesn't exist
  chrome.storage.sync.get(["activities"], function (items) {
    if (!items.activities) {
      chrome.storage.sync.set({ activities: [] });
    }
  });

  // Load settings
  loadSettings();

  // Load statistics
  loadStatistics();

  // Load activities
  loadActivities();

  // Set up event listeners
  setupEventListeners();
}

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get(
    ["enableGuard", "apiKey", "scanInterval"],
    function (items) {
      // Set guard toggle
      guardToggle.checked = items.enableGuard !== false;

      // Update status indicator
      updateStatusIndicator(guardToggle.checked);

      // Set API key
      if (items.apiKey) {
        apiKeyInput.value = items.apiKey;
      }

      // Set scan interval
      if (items.scanInterval) {
        scanIntervalInput.value = items.scanInterval / 1000; // Convert to seconds
      } else {
        scanIntervalInput.value = CONFIG.SCAN_INTERVAL / 1000;
      }
    }
  );
}

// Update status indicator based on guard state
function updateStatusIndicator(isEnabled) {
  if (isEnabled) {
    statusDot.style.backgroundColor = "var(--success-color)";
    statusText.textContent = "Active";
  } else {
    statusDot.style.backgroundColor = "var(--danger-color)";
    statusText.textContent = "Inactive";
  }
}

// Load statistics from storage
function loadStatistics() {
  chrome.storage.sync.get(["blocksCount", "scanTime"], function (items) {
    // Update block count
    statsCount.textContent = items.blocksCount || 0;

    // Update scan time
    const scanTime = items.scanTime || 0;
    const hours = Math.floor(scanTime / 3600);
    const minutes = Math.floor((scanTime % 3600) / 60);
    const seconds = scanTime % 60;

    statsTime.textContent = `${hours}h ${minutes}m ${seconds}s`;
  });
}

// Load activities from storage
function loadActivities() {
  chrome.storage.sync.get(["activities"], function (items) {
    const activities = items.activities || [];
    activityList.innerHTML = "";

    if (activities.length === 0) {
      activityList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-history"></i>
          <p>No activities yet</p>
        </div>
      `;
      return;
    }

    // Sort activities by timestamp (newest first)
    activities.sort((a, b) => b.timestamp - a.timestamp);

    activities.forEach((activity) => {
      const activityItem = document.createElement("div");
      activityItem.className = `activity-item ${activity.type}`;

      // Format the timestamp
      const date = new Date(activity.timestamp);
      const timeString = date.toLocaleTimeString();
      const dateString = date.toLocaleDateString();

      activityItem.innerHTML = `
        <div class="activity-icon">
          <span>${activity.icon}</span>
        </div>
        <div class="activity-content">
          <div class="activity-title">${activity.title}</div>
          <div class="activity-time">${dateString} ${timeString}</div>
        </div>
      `;
      activityList.appendChild(activityItem);
    });
  });
}

// Set up event listeners
function setupEventListeners() {
  // Guard toggle
  guardToggle.addEventListener("change", function () {
    const enabled = this.checked;

    // Save setting
    chrome.storage.sync.set({ enableGuard: enabled });

    // Update status indicator
    updateStatusIndicator(enabled);

    // Send message to content script
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      if (tabs[0]) {
        chrome.tabs.sendMessage(tabs[0].id, {
          action: "toggleGuard",
          enabled: enabled,
        });
      }
    });

    // Show notification
    showNotification(
      enabled ? "Guard enabled" : "Guard disabled",
      enabled ? "success" : "warning"
    );
  });

  // Save API key
  saveApiKeyBtn.addEventListener("click", function () {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showNotification("Please enter an API key", "error");
      return;
    }

    // Save API key
    chrome.storage.sync.set({ apiKey: apiKey }, function () {
      showNotification("API key saved", "success");
    });
  });

  // Tab buttons
  tabButtons.forEach((button) => {
    button.addEventListener("click", function () {
      const tabId = this.getAttribute("data-tab");

      // Update active tab
      tabButtons.forEach((btn) => btn.classList.remove("active"));
      tabContents.forEach((content) => content.classList.remove("active"));

      this.classList.add("active");
      document.getElementById(tabId).classList.add("active");
    });
  });

  // Save settings
  saveSettingsBtn.addEventListener("click", function () {
    const scanInterval = parseInt(scanIntervalInput.value) * 1000; // Convert to milliseconds

    if (isNaN(scanInterval) || scanInterval < 1000) {
      showNotification("Scan interval must be at least 1 second", "error");
      return;
    }

    // Save settings
    chrome.storage.sync.set({ scanInterval: scanInterval }, function () {
      showNotification("Settings saved", "success");
    });
  });

  // Refresh button
  document
    .getElementById("refresh-stats")
    .addEventListener("click", function () {
      loadStatistics();
      loadActivities();
      showNotification("Statistics refreshed", "success");
    });
}

// Show notification
function showNotification(message, type) {
  const notification = document.createElement("div");
  notification.className = `notification ${type}`;
  notification.innerHTML = `
    <i class="fas fa-${
      type === "success"
        ? "check-circle"
        : type === "error"
        ? "exclamation-circle"
        : "info-circle"
    }"></i>
    <span>${message}</span>
  `;

  document.body.appendChild(notification);

  // Remove notification after 3 seconds
  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "addActivity") {
    // Add activity to storage
    chrome.storage.sync.get(["activities"], function (items) {
      const activities = items.activities || [];

      // Add new activity
      activities.unshift({
        title: request.title,
        icon: request.icon,
        type: request.type,
        timestamp: request.timestamp || Date.now(),
      });

      // Limit number of activities
      if (activities.length > CONFIG.MAX_ACTIVITIES) {
        activities.pop();
      }

      // Save activities
      chrome.storage.sync.set({ activities: activities }, function () {
        // Reload activities if we're on the activity tab
        if (
          document.getElementById("activity-tab").classList.contains("active")
        ) {
          loadActivities();
        }
      });
    });
  }
});

// Initialize popup when DOM is loaded
document.addEventListener("DOMContentLoaded", initializePopup);
