class GeminiWebSocket {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.ws = null;
    this.isConnected = false;
    this.retryCount = 0;
    this.maxRetries = 5;
    this.retryDelay = 1000; // 1 second
    this.messageQueue = [];
    this.responseBuffer = "";
    this.onMessageCallback = null;
    this.history = [];
    this.setupComplete = false;
    this.model = "models/gemini-2.0-flash-exp";
    this.pendingAnalysis = null;
  }

  connect() {
    const wsUrl = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${this.apiKey}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      this.isConnected = true;
      this.retryCount = 0;
      this.sendSetupMessage();
      this.processMessageQueue();

      // If there was a pending analysis, retry it
      if (this.pendingAnalysis) {
        this.analyzeImage(this.pendingAnalysis)
          .then((response) => {
            if (this.onMessageCallback) {
              this.onMessageCallback(response);
            }
          })
          .catch((error) => {});
        this.pendingAnalysis = null;
      }
    };

    this.ws.onclose = (event) => {
      this.isConnected = false;
      this.setupComplete = false;
      this.handleDisconnect();
    };

    this.ws.onerror = (error) => {};

    this.ws.onmessage = async (event) => {
      let rawData = event.data;
      if (rawData instanceof Blob) {
        rawData = await rawData.text();
      }

      let data;
      try {
        data = JSON.parse(rawData);
      } catch (err) {
        return;
      }

      // Handle setup completion
      if (data.setupComplete !== undefined) {
        this.setupComplete = true;

        return;
      }

      if (data.serverContent) {
        const content = data.serverContent;

        // Handle incremental updates for model responses
        if (content.modelTurn && content.modelTurn.parts) {
          content.modelTurn.parts.forEach((part) => {
            if (part.text) {
              this.responseBuffer += part.text;
            }
          });
        }

        // When the server signals that the turn is complete
        if (content.turnComplete) {
          if (this.onMessageCallback) {
            const formattedResponse = this.formatAnalysisResponse(
              this.responseBuffer
            );
            this.onMessageCallback(formattedResponse);
            this.onMessageCallback = null;
          }
          this.responseBuffer = "";
        }

        // Handle interruptions
        if (content.interrupted) {
          if (this.onMessageCallback) {
            const formattedResponse = this.formatAnalysisResponse(
              JSON.stringify({
                isInappropriate: false,
                confidence: 0,
                reason: "Analysis interrupted",
              })
            );
            this.onMessageCallback(formattedResponse);
            this.onMessageCallback = null;
          }
          this.responseBuffer = "";
        }
      }
    };
  }

  handleDisconnect() {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;

      setTimeout(() => this.connect(), this.retryDelay * this.retryCount);
    } else {
      if (this.onMessageCallback) {
        const errorResponse = this.formatAnalysisResponse(
          JSON.stringify({
            isInappropriate: false,
            confidence: 0,
            reason: "Connection failed after multiple retries",
          })
        );
        this.onMessageCallback(errorResponse);
        this.onMessageCallback = null;
      }
    }
  }

  sendSetupMessage() {
    const setupMessage = {
      setup: {
        model: this.model,
        generationConfig: {
          temperature: 0.7,
          topP: 0.95,
          maxOutputTokens: 1024,
          candidateCount: 1,
          responseModalities: ["TEXT"],
        },
        systemInstruction: {
          parts: [
            {
              text: 'You are a content moderation assistant. Your task is to analyze content for age-appropriate material. Focus on identifying content that may not be suitable for young viewers. Return responses in JSON format with: { "isInappropriate": boolean, "reason": string (only if isInappropriate is true), "confidence": number (0-1) }',
            },
          ],
        },
      },
    };

    this.sendMessage(setupMessage);
  }

  async analyzeImage(imageFile) {
    return new Promise((resolve, reject) => {
      if (!this.isConnected || !this.setupComplete) {
        this.pendingAnalysis = imageFile;
        this.connect();
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64Image = reader.result;

        // Create message object for Gemini
        const message = {
          clientContent: {
            turns: [
              {
                role: "user",
                parts: [
                  {
                    text: 'Please analyze this image for age-appropriate content. Return a JSON object with: { "isInappropriate": boolean, "reason": string (only if isInappropriate is true), "confidence": number (0-1) }',
                  },
                  {
                    inline_data: {
                      mime_type: imageFile.type || "image/jpeg",
                      data: base64Image.split(",")[1],
                    },
                  },
                ],
              },
            ],
            turnComplete: true,
          },
        };

        this.onMessageCallback = (response) => {
          resolve(response);
        };

        this.sendMessage(message);
      };
      reader.onerror = (error) => {
        reject(error);
      };
      reader.readAsDataURL(imageFile);
    });
  }

  formatAnalysisResponse(response) {
    // Clean up the response by removing markdown formatting
    const cleanResponse = response.replace(/```json\n?|\n?```/g, "").trim();

    // Try to extract JSON from the response text
    const jsonMatch = cleanResponse.match(/\{[^{}]*\}/);
    let analysisResult;

    if (jsonMatch) {
      try {
        analysisResult = JSON.parse(jsonMatch[0]);
      } catch (e) {
        analysisResult = {
          isInappropriate: false,
          confidence: 0.5,
          reason: "Error parsing analysis result",
        };
      }
    } else {
      // If no JSON found, create a default response
      analysisResult = {
        isInappropriate: false,
        confidence: 0.5,
        reason: "Could not parse analysis result",
      };
    }

    // Format to match REST API structure
    return {
      candidates: [
        {
          content: {
            parts: [
              {
                text: JSON.stringify(analysisResult),
              },
            ],
          },
        },
      ],
    };
  }

  sendTextMessage(text) {
    // Add to history
    this.history.push({ role: "user", parts: [{ text: text }] });

    const message = {
      clientContent: {
        turns: this.history,
        turnComplete: true,
      },
    };

    this.sendMessage(message);
  }

  sendMessage(message) {
    if (!this.isConnected) {
      this.messageQueue.push(message);
      return;
    }

    try {
      this.ws.send(JSON.stringify(message));
    } catch (error) {
      this.messageQueue.push(message);
      this.handleDisconnect();
    }
  }

  processMessageQueue() {
    while (this.messageQueue.length > 0) {
      const message = this.messageQueue.shift();
      this.sendMessage(message);
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}

// Make the class available globally for Chrome extensions
window.GeminiWebSocket = GeminiWebSocket;
