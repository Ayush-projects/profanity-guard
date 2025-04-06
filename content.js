// Content script for Profanity Guard
// No import statement needed, using global GeminiWebSocket class

let isEnabled = true;
let lastScanTime = 0; // Initialize to 0 to ensure first scan runs immediately
let geminiWs = null;

// Initialize the content guard
function initializeGuard() {
  chrome.storage.sync.get(
    ["enableGuard", "apiKey", "scanInterval"],
    function (items) {
      isEnabled = items.enableGuard !== false;
      const scanInterval = items.scanInterval || CONFIG.SCAN_INTERVAL;

      if (isEnabled && items.apiKey) {
        console.log(
          "Profanity Guard: Initializing with scan interval:",
          scanInterval,
          "ms"
        );
        console.log(
          "Profanity Guard: Last scan time:",
          lastScanTime,
          "(0 means no scans yet)"
        );

        // Initialize WebSocket connection
        if (!geminiWs) {
          geminiWs = new window.GeminiWebSocket(items.apiKey);
          geminiWs.connect();
        }

        startContentGuard(scanInterval);
      }
    }
  );
}

// Create and show the block overlay
function showBlockOverlay(reason) {
  const overlay = document.createElement("div");
  overlay.className = "profanity-block-overlay";

  const message = document.createElement("div");
  message.className = "block-message";

  message.innerHTML = `
    <div class="block-icon">
      <i class="fas fa-shield-alt"></i>
    </div>
    <h2>Content Blocked</h2>
    <p>We've detected content that may be inappropriate or harmful.</p>
    <p>${
      reason
        ? `Reason: ${reason}`
        : "This content has been blocked to ensure a safe browsing experience."
    }</p>
    <p class="block-timestamp">Blocked at: ${new Date().toLocaleTimeString()}</p>
  `;

  overlay.appendChild(message);
  document.body.appendChild(overlay);
  document.body.style.overflow = "hidden";

  const dangerIcon = document.createElement("div");
  dangerIcon.className = "danger-icon";
  dangerIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
  overlay.appendChild(dangerIcon);
}

// Capture screenshot of the current page
async function captureScreenshot() {
  try {
    console.log("Profanity Guard: Capturing screenshot...");

    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { action: "captureVisibleTab" },
          (response) => {
            if (chrome.runtime.lastError) {
              console.error(
                "Profanity Guard: Error capturing screenshot:",
                chrome.runtime.lastError.message
              );
              resolve(null);
              return;
            }

            if (response && response.dataUrl) {
              console.log("Profanity Guard: Screenshot captured successfully");
              resolve(response.dataUrl);
            } else if (response && response.error) {
              console.error(
                "Profanity Guard: Error from background script:",
                response.error
              );
              resolve(null);
            } else {
              console.error("Profanity Guard: Failed to capture screenshot");
              resolve(null);
            }
          }
        );
      } catch (error) {
        console.error("Profanity Guard: Extension context error:", error);
        resolve(null);
      }
    });
  } catch (error) {
    console.error("Profanity Guard: Error capturing screenshot:", error);
    return null;
  }
}

// Analyze screenshot using WebSocket
async function analyzeScreenshot(screenshotDataUrl) {
  try {
    console.log("Profanity Guard: Analyzing screenshot with WebSocket...");

    // Convert data URL to File object
    const response = await fetch(screenshotDataUrl);
    const blob = await response.blob();
    const file = new File([blob], "screenshot.jpg", { type: "image/jpeg" });

    const analysis = await geminiWs.analyzeImage(file);
    console.log("Profanity Guard: Screenshot analyzed successfully");

    // Extract the analysis result from the response
    const analysisText = analysis.candidates[0].content.parts[0].text;
    let result;
    try {
      result = JSON.parse(analysisText);
    } catch (e) {
      console.error("Profanity Guard: Error parsing analysis result:", e);
      return {
        isInappropriate: false,
        confidence: 0.5,
        reason: "Error parsing analysis result",
      };
    }

    console.log("Profanity Guard: Analysis result:", result);
    return result;
  } catch (error) {
    console.error("Profanity Guard: Error analyzing screenshot:", error);
    return {
      isInappropriate: false,
      confidence: 0.5,
      reason: "Error analyzing content",
    };
  }
}

// Update block count in storage
function updateBlockCount() {
  chrome.storage.sync.get(["blocksCount"], function (items) {
    const currentCount = items.blocksCount || 0;
    const newCount = currentCount + 1;

    console.log(
      "Profanity Guard: Updating block count from",
      currentCount,
      "to",
      newCount
    );

    // Update block count
    chrome.storage.sync.set({ blocksCount: newCount }, function () {
      console.log("Profanity Guard: Block count updated successfully");
    });

    // Log activity with timestamp
    chrome.runtime.sendMessage({
      action: "addActivity",
      title: "Content Blocked",
      icon: "🛡️",
      type: "block",
      timestamp: Date.now(),
    });
  });
}

// Check if content is already blocked
function isContentBlocked() {
  return document.querySelector(".profanity-block-overlay") !== null;
}

// Disconnect WebSocket if content is blocked
function handleBlockedContent() {
  if (isContentBlocked()) {
    console.log("Profanity Guard: Content blocked, disconnecting WebSocket");
    if (geminiWs) {
      geminiWs.disconnect();
      geminiWs = null;
    }
    // Clear the interval since we don't need to scan anymore
    if (window.contentGuardInterval) {
      clearInterval(window.contentGuardInterval);
      window.contentGuardInterval = null;
    }
  }
}

// Start content guard
function startContentGuard(scanInterval) {
  console.log("Profanity Guard: Starting content guard...");

  // Clear any existing interval
  if (window.contentGuardInterval) {
    clearInterval(window.contentGuardInterval);
  }

  // Create new interval
  window.contentGuardInterval = setInterval(async () => {
    // Skip if guard is disabled
    if (!isEnabled) {
      console.log("Profanity Guard: Guard is disabled, skipping scan");
      return;
    }

    // Skip if content is already blocked
    if (isContentBlocked()) {
      console.log("Profanity Guard: Content already blocked, skipping scan");
      handleBlockedContent();
      return;
    }

    const now = Date.now();
    const timeSinceLastScan = now - lastScanTime;
    console.log(
      "Profanity Guard: Time since last scan:",
      timeSinceLastScan,
      "ms"
    );

    if (timeSinceLastScan < scanInterval) {
      console.log(
        "Profanity Guard: Skipping scan, too soon since last scan. Need to wait",
        scanInterval - timeSinceLastScan,
        "ms more"
      );
      return;
    }

    lastScanTime = now;
    console.log(
      "Profanity Guard: Starting new scan at timestamp:",
      lastScanTime
    );

    // Capture screenshot
    const screenshot = await captureScreenshot();
    if (!screenshot) {
      console.error("Profanity Guard: Failed to capture screenshot");
      return;
    }

    // Analyze screenshot
    const analysis = await analyzeScreenshot(screenshot);
    if (!analysis) {
      console.error("Profanity Guard: Failed to analyze screenshot");
      return;
    }

    console.log("Profanity Guard: Analysis result:", analysis);

    // Check if content is inappropriate
    if (
      analysis.isInappropriate &&
      analysis.confidence >= CONFIG.MIN_CONFIDENCE
    ) {
      console.log(
        "Profanity Guard: Inappropriate content detected:",
        analysis.reason
      );
      showBlockOverlay(analysis.reason);
      updateBlockCount();
      handleBlockedContent();
    }
  }, scanInterval);
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "toggleGuard") {
    isEnabled = request.enabled;
    console.log("Profanity Guard: Guard toggled to", isEnabled);

    if (isEnabled) {
      initializeGuard();
    } else {
      console.log("Profanity Guard: Guard is now disabled");
      // Clear any existing block overlays
      const existingOverlay = document.querySelector(
        ".profanity-block-overlay"
      );
      if (existingOverlay) {
        existingOverlay.remove();
      }
    }
  }
});

// Initialize when the script loads
console.log("Profanity Guard: Content script loaded");

// Cleanup function
function cleanup() {
  if (geminiWs) {
    geminiWs.disconnect();
    geminiWs = null;
  }
}

// Add cleanup on extension unload
window.addEventListener("unload", cleanup);

// Initialize the guard
initializeGuard();
