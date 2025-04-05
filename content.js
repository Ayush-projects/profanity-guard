// Content script for Profanity Guard

let isEnabled = true;
let lastScanTime = 0; // Initialize to 0 to ensure first scan runs immediately

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

  // Create a more professional message without showing the specific content
  message.innerHTML = `
    <div class="block-icon">
      <i class="fas fa-shield-alt"></i>
    </div>
    <h2>Content Blocked</h2>
    <p>We've detected content that may be inappropriate or harmful.</p>
    <p>This content has been blocked to ensure a safe browsing experience.</p>
    <p class="block-timestamp">Blocked at: ${new Date().toLocaleTimeString()}</p>
  `;

  overlay.appendChild(message);
  document.body.appendChild(overlay);

  // Prevent scrolling
  document.body.style.overflow = "hidden";

  // Add a danger icon in the center of the overlay
  const dangerIcon = document.createElement("div");
  dangerIcon.className = "danger-icon";
  dangerIcon.innerHTML = '<i class="fas fa-exclamation-triangle"></i>';
  overlay.appendChild(dangerIcon);
}

// Capture screenshot of the current page
async function captureScreenshot() {
  try {
    console.log("Profanity Guard: Capturing screenshot...");

    // Use chrome.tabs.captureVisibleTab to take a screenshot
    return new Promise((resolve) => {
      try {
        chrome.runtime.sendMessage(
          { action: "captureVisibleTab" },
          (response) => {
            // Check if the extension context is still valid
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

// Analyze screenshot using Gemini API
async function analyzeScreenshot(screenshotDataUrl) {
  try {
    console.log("Profanity Guard: Analyzing screenshot with Gemini...");

    const { apiKey } = await chrome.storage.sync.get(["apiKey"]);
    if (!apiKey) {
      console.error("Profanity Guard: No API key found");
      return null;
    }

    // Send the screenshot to the background script for analysis
    return new Promise((resolve) => {
      chrome.runtime.sendMessage(
        {
          action: "captureVisibleTab",
          analyze: true,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "Profanity Guard: Error analyzing screenshot:",
              chrome.runtime.lastError.message
            );
            resolve(null);
            return;
          }

          if (response && response.analysis) {
            console.log("Profanity Guard: Screenshot analyzed successfully");

            // Extract the JSON response from Gemini's text
            try {
              // Find the text part in the response
              const textPart =
                response.analysis.candidates[0].content.parts.find(
                  (part) => part.text
                );

              if (textPart && textPart.text) {
                // Try to parse the text as JSON
                const jsonMatch = textPart.text.match(/\{.*\}/s);
                if (jsonMatch) {
                  const jsonStr = jsonMatch[0];
                  const result = JSON.parse(jsonStr);
                  resolve(result);
                  return;
                }
              }

              // If we couldn't parse JSON, create a default response
              resolve({
                isInappropriate: false,
                confidence: 0.5,
                reason: "Could not parse analysis result",
              });
            } catch (error) {
              console.error(
                "Profanity Guard: Error parsing analysis result:",
                error
              );
              resolve({
                isInappropriate: false,
                confidence: 0.5,
                reason: "Error parsing analysis result",
              });
            }
          } else if (response && response.error) {
            console.error(
              "Profanity Guard: Error from background script:",
              response.error
            );
            resolve(null);
          } else {
            console.error("Profanity Guard: Failed to analyze screenshot");
            resolve(null);
          }
        }
      );
    });
  } catch (error) {
    console.error("Profanity Guard: Error analyzing screenshot:", error);
    return null;
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

    chrome.storage.sync.set({ blocksCount: newCount }, function () {
      console.log("Profanity Guard: Block count updated successfully");
    });
  });
}

// Start content guard
function startContentGuard(scanInterval) {
  console.log("Profanity Guard: Starting content guard...");

  setInterval(async () => {
    if (!isEnabled) {
      console.log("Profanity Guard: Guard is disabled, skipping scan");
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
      console.error(
        "Profanity Guard: Failed to capture screenshot, skipping analysis"
      );
      return;
    }

    // Analyze screenshot
    const analysis = await analyzeScreenshot(screenshot);
    if (!analysis) {
      console.error("Profanity Guard: Failed to analyze screenshot");
      return;
    }

    // Only block if confidence is above threshold
    if (
      analysis.isInappropriate &&
      analysis.confidence >= CONFIG.MIN_CONFIDENCE
    ) {
      // Update block count first
      updateBlockCount();

      // Add activity log
      chrome.runtime.sendMessage({
        action: "addActivity",
        title: "Inappropriate content detected",
        icon: "ban",
        type: "warning",
      });

      // Show block overlay
      showBlockOverlay(analysis.reason || "Inappropriate content detected");
    } else {
      chrome.runtime.sendMessage({
        action: "addActivity",
        title: "Content scan completed",
        icon: "check-circle",
        type: "success",
      });
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
initializeGuard();
