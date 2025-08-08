# Job Info Extractor - Brave/Chrome Extension

A simple browser extension that extracts job position and company information from job listing pages using OpenAI's GPT-4o-mini and sends the data to your local API.

## Features

- 🔍 Extracts clean text content from any web page
- 🤖 Uses OpenAI GPT-4o-mini to identify position name and company name
- 📡 Sends extracted data to your local API endpoint
- 💾 Saves your API key and local endpoint URL for convenience
- 🎯 Works on any website (perfect for job boards like LinkedIn, Indeed, etc.)

## Installation

### Step 1: Clone and Setup
1. **Clone this repository**:
   ```bash
   git clone <your-repo-url>
   cd brave-extension-job-extractor
   ```

2. **Set up environment variables**:
   ```bash
   # Copy the example environment file
   cp env.example .env
   
   # For Node.js server setup (optional)
   npm run setup
   ```
   
3. **Edit the `.env` file** with your actual credentials:
   ```bash
   # Edit .env with your preferred editor
   nano .env
   ```
   
   **Important**: Never commit your `.env` file to version control!

### Step 2: Get an OpenAI API Key
1. Go to [OpenAI Platform](https://platform.openai.com/api-keys)
2. Create a new API key
3. Add it to your `.env` file

### Step 3: Install the Extension

1. **Download/Clone this repository** to your computer

2. **Open Brave/Chrome Extension Management:**
   - In Brave: Go to `brave://extensions/`
   - In Chrome: Go to `chrome://extensions/`

3. **Enable Developer Mode:**
   - Toggle the "Developer mode" switch in the top right

4. **Load the Extension:**
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - The extension should now appear in your extensions list

5. **Pin the Extension:**
   - Click the extensions icon (puzzle piece) in the toolbar
   - Pin the "Job Info Extractor" extension for easy access

## Setup

1. **Click the extension icon** in your browser toolbar
2. **Enter your OpenAI API Key** in the provided field
3. **Set your Local API URL** (default: `http://localhost:3000/api/jobs`)
4. The settings will be automatically saved

## Usage

1. **Navigate to any job listing page** (LinkedIn, Indeed, company careers page, etc.)
2. **Click the extension icon** in your toolbar
3. **Click "Extract Job Info"** button
4. The extension will:
   - Extract the page text content
   - Send it to OpenAI GPT-4o-mini for analysis
   - Extract the position name and company name
   - Send the data to your local API

## Local API Endpoint

Your local API should accept POST requests with the following JSON structure:

```json
{
  "positionName": "Software Engineer",
  "companyName": "Tech Company Inc",
  "link": "https://example.com/job-posting"
}
```

### Example Local Server (Node.js/Express)

```javascript
const express = require('express');
const app = express();

app.use(express.json());

app.post('/api/jobs', (req, res) => {
  const { positionName, companyName, link } = req.body;
  
  console.log('New job extracted:', {
    position: positionName,
    company: companyName,
    url: link
  });
  
  // Save to database, file, etc.
  
  res.json({ success: true, message: 'Job info saved' });
});

app.listen(3000, () => {
  console.log('Local API running on http://localhost:3000');
});
```

## Files Structure

```
brave-extension-job-extractor/
├── manifest.json       # Extension configuration
├── popup.html          # Extension popup UI
├── popup.js            # Main extension logic
├── content.js          # Page content extraction script
├── config.js           # Configuration and default settings
├── example-server.js   # Local API server example
├── package.json        # Node.js dependencies
├── env.example         # Environment variables template
├── .env               # Your actual environment variables (ignored by git)
├── .gitignore         # Git ignore file for security
└── README.md          # This file
```

## Privacy & Security

- **API Keys**: Your OpenAI API key is stored locally in your browser only
- **Environment Variables**: Sensitive data is kept in `.env` file (not committed to git)
- **Data Transmission**: Page content is only sent to OpenAI GPT-4o-mini for analysis
- **No External Storage**: No data is stored or transmitted elsewhere
- **Manual Activation**: The extension only activates when you click it
- **Local Configuration**: All settings are stored locally in your browser

### Security Best Practices Implemented:
- ✅ `.gitignore` excludes sensitive files
- ✅ Environment variables for credentials
- ✅ No hardcoded API keys in source code
- ✅ Example template files provided

## Troubleshooting

### Common Issues:

1. **"Please enter your OpenAI API key" error:**
   - Make sure you've entered a valid OpenAI API key in the extension popup

2. **"Local API error" message:**
   - Ensure your local API server is running
   - Check that the API URL is correct in the extension settings
   - Verify your local server accepts POST requests

3. **"Failed to extract page text" error:**
   - Refresh the page and try again
   - Some pages may block content scripts

4. **Extension not appearing:**
   - Make sure you've enabled "Developer mode" in extension settings
   - Try reloading the extension

## Development

To modify the extension:

1. Make changes to the source files
2. Go to the extensions page
3. Click the reload icon on the "Job Info Extractor" extension
4. Test your changes

## API Costs

OpenAI GPT-4o-mini usage is very affordable:
- Each job extraction uses ~8000 characters of text
- OpenAI pricing is typically $0.0005 per 1K characters
- Cost per extraction: ~$0.004 (less than half a cent)

## License

This project is open source and available under the MIT License. 