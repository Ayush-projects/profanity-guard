// Screenshot functionality for Profanity Guard

// Function to capture the current tab and show it in a new tab
async function captureAndShowScreenshot() {
  try {
    // Send message to background script to capture the tab
    chrome.runtime.sendMessage({ action: "captureVisibleTab" }, (response) => {
      if (chrome.runtime.lastError) {
        return;
      }

      if (response && response.dataUrl) {
        // Create a new tab with the screenshot
        const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
        const html = `
            <!DOCTYPE html>
            <html>
            <head>
              <title>Screenshot - ${timestamp}</title>
              <style>
                body {
                  margin: 0;
                  padding: 20px;
                  background-color: #f5f5f5;
                  font-family: Arial, sans-serif;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                }
                .container {
                  max-width: 1200px;
                  width: 100%;
                }
                .header {
                  margin-bottom: 20px;
                  text-align: center;
                }
                .screenshot {
                  max-width: 100%;
                  border: 1px solid #ddd;
                  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                  border-radius: 4px;
                }
                .info {
                  margin-top: 20px;
                  padding: 15px;
                  background-color: #fff;
                  border-radius: 4px;
                  box-shadow: 0 2px 4px rgba(0,0,0,0.05);
                }
                .timestamp {
                  color: #666;
                  font-size: 14px;
                }
                .url {
                  word-break: break-all;
                  margin-top: 10px;
                  font-size: 14px;
                }
              </style>
            </head>
            <body>
              <div class="container">
                <div class="header">
                  <h1>Screenshot</h1>
                  <p class="timestamp">Captured on: ${new Date().toLocaleString()}</p>
                  <p class="url">URL: ${window.location.href}</p>
                </div>
                <img class="screenshot" src="${
                  response.dataUrl
                }" alt="Screenshot" />
                <div class="info">
                  <p>This screenshot was captured by the Profanity Guard extension.</p>
                </div>
              </div>
            </body>
            </html>
          `;

        // Create a blob from the HTML
        const blob = new Blob([html], { type: "text/html" });
        const url = URL.createObjectURL(blob);

        // Open the new tab
        window.open(url, "_blank");
      } else if (response && response.error) {
        console.error(
          "Profanity Guard: Error from background script:",
          response.error
        );
      } else {
        console.error("Profanity Guard: Failed to capture screenshot");
      }
    });
  } catch (error) {
    console.error("Profanity Guard: Error capturing screenshot:", error);
  }
}

// Add a button to the page to trigger the screenshot
function addScreenshotButton() {
  // Check if the button already exists
  if (document.getElementById("profanity-guard-screenshot-btn")) {
    return;
  }

  // Create the button
  const button = document.createElement("button");
  button.id = "profanity-guard-screenshot-btn";
  button.innerHTML = '<i class="fas fa-camera"></i> Take Screenshot';
  button.title = "Capture and view screenshot";

  // Add styles
  button.style.position = "fixed";
  button.style.bottom = "20px";
  button.style.right = "20px";
  button.style.zIndex = "9999";
  button.style.padding = "10px 15px";
  button.style.backgroundColor = "#2563EB";
  button.style.color = "white";
  button.style.border = "none";
  button.style.borderRadius = "4px";
  button.style.cursor = "pointer";
  button.style.fontFamily = "Arial, sans-serif";
  button.style.fontSize = "14px";
  button.style.display = "flex";
  button.style.alignItems = "center";
  button.style.gap = "8px";
  button.style.boxShadow = "0 2px 5px rgba(0,0,0,0.2)";

  // Add hover effect
  button.onmouseover = function () {
    this.style.backgroundColor = "#1D4ED8";
  };
  button.onmouseout = function () {
    this.style.backgroundColor = "#2563EB";
  };

  // Add click event
  button.onclick = captureAndShowScreenshot;

  // Add to the page
  document.body.appendChild(button);
}

// Initialize the screenshot functionality
function initializeScreenshotFeature() {
  // Add the screenshot button to the page
  addScreenshotButton();

  // Listen for messages from the popup
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === "takeScreenshot") {
      captureAndShowScreenshot();
      sendResponse({ success: true });
    }
  });
}

// Initialize when the script loads

initializeScreenshotFeature();
