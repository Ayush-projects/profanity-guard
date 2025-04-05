# Profanity Guard


<img width="765" alt="image" src="https://github.com/user-attachments/assets/45f4bda0-6ff6-4c4e-b7b8-214c63d333ee" />


A powerful Chrome extension that protects users from inappropriate content using advanced AI technology. Profanity Guard analyzes both text and images in real-time to detect and block inappropriate content, making the internet safer for everyone.


<img width="420" alt="image" src="https://github.com/user-attachments/assets/adc6ed68-cbcd-4588-bbcb-b95b1e2b2040" />


<img width="462" alt="image" src="https://github.com/user-attachments/assets/81aebbf7-84e6-41ae-9360-312dc5151895" />

<img width="452" alt="image" src="https://github.com/user-attachments/assets/a66001b9-aa49-4697-aedd-c4612637e0d8" />



## Features

### Real-time Content Protection

- Text Analysis: Instantly analyzes webpage text for inappropriate content
- Image Analysis: Uses Google's Gemini AI to detect inappropriate images
- Screenshot Analysis: Takes screenshots of pages to analyze visual content
- Smart Blocking: Automatically blocks pages with inappropriate content

### User-Friendly Interface

- Clean Dashboard: Beautiful card-based UI showing protection statistics
- Activity Log: Tracks all blocked content and protection events
- Easy Settings: Simple toggle controls for all features
- Visual Feedback: Clear notifications when content is blocked

### Privacy & Security

- Local Processing: Text analysis happens in your browser
- Secure API: Uses Google's Gemini API with your own API key
- No Data Storage: Screenshots are analyzed and immediately discarded
- Transparent: Clear logging of all protection actions

## Installation

1. Clone this repository:

   ```bash
   git clone https://github.com/yourusername/profanity-guard.git
   ```

2. Open Chrome and navigate to `chrome://extensions/`

3. Enable "Developer mode" in the top right corner

4. Click "Load unpacked" and select the `profanity-guard` directory

5. The Profanity Guard icon should appear in your Chrome toolbar

## Configuration

### Setting Up the API Key

1. Get a Google Cloud API key:

   - Go to [Google AI Studio]([https://console.cloud.google.com](https://aistudio.google.com/))
   - Create a new project or select an existing one
   - Enable the Gemini API
   - Create credentials (API key)
   - Copy your API key

2. Configure the extension:
   - Click the Profanity Guard icon in your toolbar
   - Go to the Settings tab
   - Paste your API key in the "API Key" field
   - Click "Save Settings"

### Extension Settings

- Enable Guard: Toggle the main protection feature
- Enable Notifications: Show alerts when content is blocked
- Enable Auto-Block: Automatically block inappropriate pages
- API Key: Your Google Cloud API key for image analysis

## Usage

### Basic Protection

1. Click the Profanity Guard icon to see the dashboard
2. The guard is enabled by default
3. Browse normally - the extension will protect you automatically

### Taking Screenshots

1. Click the camera icon in the dashboard
2. The extension will capture and analyze the current page
3. Results will show in the activity log

### Viewing Statistics

- Content Blocked: Number of inappropriate items detected
- Scan Time: Total time spent analyzing content
- Activity Log: Detailed history of all protection events

## Technical Details

### Architecture

- Background Script: Handles API communication and image analysis
- Content Script: Analyzes webpage text and captures screenshots
- Popup UI: Provides user interface and settings management

### APIs Used

- Google Gemini API: For advanced image analysis
- Chrome Extension APIs: For browser integration
- Web APIs: For text analysis and screenshot capture

### Storage

- Chrome Sync Storage: Stores settings and activity log
- No Image Storage: Screenshots are analyzed and discarded
- 24-hour Activity Retention: Automatically cleans old logs

## Development

### Project Structure

```
profanity-guard/
├── manifest.json
├── background.js
├── content.js
├── popup.html
├── popup.js
├── styles.css
└── README.md
```

### Building from Source

1. Install dependencies:

   ```bash
   npm install
   ```

2. Build the extension:

   ```bash
   npm run build
   ```

3. Load the built extension in Chrome

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Google Gemini AI for image analysis capabilities
- Chrome Extensions team for the platform
- All contributors and users of Profanity Guard

## Support

For support, please:

1. Check the [Issues](https://github.com/yourusername/profanity-guard/issues) page
2. Create a new issue if needed
3. Include detailed information about your problem

## Updates

Check the [Releases](https://github.com/yourusername/profanity-guard/releases) page for the latest updates and version history.
