# Quick Setup Guide

## Step 1: Generate Icons

Before loading the extension, generate the required PNG icons:

1. Open `icons/generate-icons.html` in Chrome
2. Click "Generate & Download All Icons"
3. Save all downloaded PNG files to the `icons/` folder:
   - icon16.png
   - icon32.png
   - icon48.png
   - icon128.png

## Step 2: Load Extension

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle in top right)
3. Click "Load unpacked"
4. Select the `pega-browser-agent` folder
5. The extension should appear in your toolbar

## Step 3: Configure API Key

Open the extension's service worker console:
1. Go to `chrome://extensions/`
2. Find "Pega Co-Pilot"
3. Click "service worker" link
4. In the console, run:

```javascript
chrome.storage.session.set({ 'llm-api-key': 'your-anthropic-api-key-here' });
```

5. Verify: `chrome.storage.session.get('llm-api-key', console.log)`

## Step 4: Test

### Option A: Mock Pega Page

```bash
# If you have Python installed:
python3 -m http.server 8000

# Then open: http://localhost:8000/tests/mock-pega-page.html
```

### Option B: Real Pega Application

Navigate to your Pega Infinity '23+ application. The extension will automatically:
- Detect Pega
- Open the side panel
- Generate case summaries

## Troubleshooting

### "Failed to load extension"
- Ensure all icon files exist in `icons/` folder
- Check manifest.json for syntax errors

### "PII not being masked"
- This is expected if using the mock page with test data
- Real PII patterns (SSN format, email format) will be masked

### "Summary not generating"
- Verify API key is set correctly
- Check service worker console for API errors
- Ensure you have API credits

### "Actions not executing"
- Open browser console on the Pega page
- Check for JavaScript errors
- Verify content script is loaded

## Next Steps

- Review `README.md` for full documentation
- Check `config/default-config.json` for configuration options
- See `shared/message-types.js` for the message protocol
