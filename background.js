// Background script for Profanity Guard

// Initialize Gemini API client
let geminiClient = null;

// Set default settings on installation
chrome.runtime.onInstalled.addListener(function (details) {
  if (details.reason === "install") {
    chrome.storage.sync.set({
      enableGuard: true,
      enableNotifications: true,
      enableAutoBlock: true,
    });
  }
});

// Initialize the API client with the stored API key and ensure guard is active
chrome.storage.sync.get(["apiKey", "enableGuard"], function (items) {
  // Initialize API client if key exists
  if (items.apiKey) {
    initializeGeminiClient(items.apiKey);
  }

  // Ensure guard is active by default if not explicitly disabled
  if (items.enableGuard === undefined) {
    chrome.storage.sync.set({ enableGuard: true });
  }
});

// Initialize Gemini client
function initializeGeminiClient(apiKey) {
  geminiClient = {
    apiKey: apiKey,
    endpoint:
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
  };
}

// Clean up old activities (older than 24 hours)
function cleanOldActivities() {
  chrome.storage.sync.get(["activities"], function (items) {
    if (!items.activities || items.activities.length === 0) return;

    const now = new Date().getTime();
    const oneDayAgo = now - 24 * 60 * 60 * 1000; // 24 hours in milliseconds

    // Filter out activities older than 24 hours
    const filteredActivities = items.activities.filter(
      (activity) => activity.timestamp > oneDayAgo
    );

    // If we removed any activities, update storage
    if (filteredActivities.length !== items.activities.length) {
      chrome.storage.sync.set({ activities: filteredActivities });
    }
  });
}

// Set up periodic cleanup of old activities (every 6 hours)
setInterval(cleanOldActivities, 6 * 60 * 60 * 1000);

// Run cleanup on extension startup
cleanOldActivities();

// Function to analyze image with Gemini
async function analyzeImageWithGemini(imageDataUrl, apiKey) {
  try {
    // Convert data URL to base64
    const base64Data = imageDataUrl.split(",")[1];

    // Now generate content using the base64 data directly
    const response = await fetch(`${geminiClient.endpoint}?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: 'Analyze this image for inappropriate content that would be harmful for a 13-year-old kid. Look for bad words, sexual content, violence, or any other inappropriate material. Return a JSON object with: { "isInappropriate": boolean, "reason": string (only if isInappropriate is true), "confidence": number (0-1) }',
              },
              {
                inline_data: {
                  mime_type: "image/jpeg",
                  data: base64Data,
                },
              },
            ],
          },
        ],
      }),
    });

    const result = await response.json();
    return result;
  } catch (error) {
    console.error("Error analyzing image with Gemini:", error);
    throw error;
  }
}

// Listen for messages from content script
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "analyzeContent") {
    // We're not processing text anymore, so just return a success response
    sendResponse({ success: true });
    return true;
  }
  if (request.action === "captureVisibleTab") {
    // Capture the visible tab
    chrome.tabs.captureVisibleTab(
      null,
      { format: "jpeg", quality: 80 },
      async (dataUrl) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Profanity Guard: Error capturing tab:",
            chrome.runtime.lastError.message
          );
          sendResponse({ error: chrome.runtime.lastError.message });
          return;
        }

        // If we have an API key and analyze is true, analyze the image with Gemini
        if (geminiClient && geminiClient.apiKey && request.analyze) {
          try {
            const analysisResult = await analyzeImageWithGemini(
              dataUrl,
              geminiClient.apiKey
            );
            sendResponse({
              dataUrl: dataUrl,
              analysis: analysisResult,
            });
          } catch (error) {
            console.error("Profanity Guard: Error analyzing image:", error);
            sendResponse({
              dataUrl: dataUrl,
              error: error.message,
            });
          }
        } else {
          // Just return the image data if no API key or analyze is false
          sendResponse({ dataUrl: dataUrl });
        }
      }
    );
    return true; // Required for async response
  }

  // Handle addActivity message from content script
  if (request.action === "addActivity") {
    console.log("Profanity Guard: Adding activity:", request);

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
      if (activities.length > 100) {
        // Use a reasonable limit
        activities.pop();
      }

      // Save activities
      chrome.storage.sync.set({ activities: activities }, function () {
        console.log("Profanity Guard: Activity saved successfully");

        // Notify any open popups to refresh their activity list
        chrome.runtime.sendMessage({ action: "refreshActivities" });
      });
    });

    return true;
  }
});

// Listen for API key updates
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === "sync" && changes.apiKey) {
    initializeGeminiClient(changes.apiKey.newValue);
  }
});

// Initialize extension
chrome.runtime.onInstalled.addListener(() => {
  console.log("Profanity Guard: Extension installed");

  // Set default values
  chrome.storage.sync.get(
    ["enableGuard", "apiKey", "blocksCount", "scanTime", "activities"],
    function (items) {
      const defaults = {
        enableGuard: true, // Enable guard by default
        blocksCount: 0,
        scanTime: 0,
        activities: [], // Initialize empty activities array
      };

      // Only set values that don't exist yet
      Object.keys(defaults).forEach((key) => {
        if (items[key] === undefined) {
          chrome.storage.sync.set({ [key]: defaults[key] });
        }
      });
    }
  );
});
