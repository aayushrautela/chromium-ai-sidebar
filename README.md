# Gemini Page Summarizer Chrome Extension

A Chrome sidebar extension that uses the Gemini API to summarize web pages and provide an interactive chat interface with the content.

## Features

- **Page Summarization**: Automatically extracts and summarizes webpage content using Firefox Readability.js
- **Interactive Chat**: Chat with the AI about the page content after summarization
- **Dark/Light Mode**: Automatic theme detection with manual toggle
- **Settings Management**: Configure your Gemini API key and model selection
- **Clean UI**: Modern, responsive interface that adapts to your theme preference

## Installation

1. **Get a Gemini API Key**:
   - Visit [Google AI Studio](https://aistudio.google.com/)
   - Create an account and generate an API key
   - Copy the API key for use in the extension

2. **Load the Extension**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in the top right)
   - Click "Load unpacked" and select this folder
   - The extension will appear in your extensions list

3. **Configure Settings**:
   - Click the extension icon in your toolbar
   - Click the settings (gear) icon in the sidebar
   - Enter your Gemini API key
   - Select your preferred model (default: Gemini 2.5 Flash Lite)
   - Click "Save Settings"

## Usage

1. **Summarize a Page**:
   - Navigate to any webpage you want to summarize
   - Click the extension icon to open the sidebar
   - Click "Summarize Page" to extract and summarize the content
   - The AI will provide a comprehensive summary

2. **Chat with Content**:
   - After summarization, you can ask questions about the page
   - Type your questions in the chat input at the bottom
   - The AI will respond based on the webpage content
   - Click "New Summary" to start over with a different page

## Supported Models

- **Gemini 2.5 Flash Lite** (default, fastest and most efficient)
- **Gemini 2.5 Flash** (balanced speed and capability)
- **Gemini 2.5 Pro** (most capable, latest model)
- **Gemini 1.5 Flash** (legacy, fast)
- **Gemini 1.5 Pro** (legacy, capable)
- **Gemini 1.0 Pro** (legacy)

## Privacy

- Your API key is stored locally in Chrome's sync storage
- Page content is only sent to Google's Gemini API for processing
- No data is collected or stored by the extension itself

## Troubleshooting

- **"API key not provided"**: Make sure you've entered your API key in settings
- **"Failed to extract content"**: Some pages may not be compatible with content extraction
- **Extension not working**: Ensure you have the latest version of Chrome and the extension is enabled

## Development

To modify or extend this extension:

1. Make your changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

## File Structure

```
gem3/
├── manifest.json          # Extension configuration
├── background.js          # Service worker for API calls
├── sidebar.html          # Main UI
├── sidebar.js            # UI logic and chat functionality
├── content.js            # Content extraction script
├── readability.js        # Firefox Readability library
├── styles.css            # Styling with dark/light mode
└── icons/                # Extension icons
```

## License

This project is open source and available under the MIT License.
