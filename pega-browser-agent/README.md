# Pega Case Management Browser Agent

An enterprise-grade, privacy-first, AI-powered browser extension for Pega Infinity '23+ case workers.

## Features

- **Pega-Aware Intelligence**: Understands Pega's UI conventions, class patterns, and data semantics
- **PII Protection**: Field-level masking before any data leaves the browser
- **Natural Language Commands**: Interact with Pega using plain English
- **Case Summarization**: Auto-generated 4-part summaries on case open
- **Action Confirmation**: Review and approve actions before execution
- **Complete Audit Trail**: Every action logged with masked tokens only

## Quick Start

### 1. Install the Extension

```bash
# Clone or download the extension
cd pega-browser-agent

# Load in Chrome:
# 1. Open chrome://extensions/
# 2. Enable "Developer mode"
# 3. Click "Load unpacked"
# 4. Select the pega-browser-agent folder
```

### 2. Configure API Key

The extension requires an LLM API key for AI features. Set it via the browser console:

1. Open the extension's service worker console (chrome://extensions/ → Pega Co-Pilot → "service worker")
2. Run:
```javascript
chrome.storage.session.set({ 'llm-api-key': 'your-anthropic-api-key' });
```

Or configure via settings (coming soon).

### 3. Test with Mock Page

```bash
# Open the test page in your browser
open tests/mock-pega-page.html
# Or serve it locally
python3 -m http.server 8000
# Then visit http://localhost:8000/tests/mock-pega-page.html
```

### 4. Use on Real Pega

Navigate to any Pega Infinity '23+ application. The extension will:
- Automatically detect Pega
- Open the side panel
- Generate a case summary when you open a case

## Project Structure

```
pega-browser-agent/
├── manifest.json              # Extension manifest (MV3)
├── service-worker/
│   ├── sw.js                  # Central message router
│   ├── planner.js             # Intent to action plan
│   ├── llm-adapter.js         # BYOM abstraction layer
│   └── session-store.js       # State management
├── content-scripts/
│   ├── pega-detector.js       # Detect Pega application
│   ├── dom-parser.js          # Semantic DOM extraction
│   ├── dom-observer.js        # SPA navigation detection
│   ├── pii-masker.js          # PII classification & tokenization
│   └── action-executor.js     # Execute plans on DOM
├── side-panel/
│   ├── panel.html             # Co-pilot panel UI
│   └── panel.js               # Panel logic
├── shared/
│   ├── message-types.js       # Typed message protocol
│   ├── pega-heuristics.js     # Pega domain knowledge
│   ├── intent-classifier.js   # Local intent classification
│   └── audit-logger.js        # Activity logging
├── config/
│   ├── default-config.json    # Default configuration
│   └── enterprise-config-schema.json
└── tests/
    └── mock-pega-page.html    # Test page for development
```

## Usage

### Natural Language Commands

Type commands in the side panel:

- **"Summarize this case"** - Generate a 4-part case summary
- **"Update the status to Pending Documentation"** - Update a field
- **"Save changes"** - Save the case
- **"Submit the case"** - Submit (requires confirmation)
- **"What's next?"** - Proceed to next step
- **"Escalate to supervisor"** - Transfer the case

### Keyboard Shortcuts

- `Ctrl+Shift+P` - Toggle side panel

## Configuration

### Enterprise Configuration

Edit `config/default-config.json`:

```json
{
  "security": {
    "piiMaskingEnabled": true,
    "piiCategoriesToMask": ["NAME", "SSN", "DOB", "EMAIL", "PHONE", "ACCOUNT", "ADDRESS"],
    "localProcessingOnly": false,
    "allowedLLMProviders": ["anthropic", "mistral"],
    "auditLoggingEnabled": true
  },
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "maxTokens": 1500,
    "temperature": 0.1
  },
  "roleRestrictions": {
    "caseWorker": ["SUMMARIZE_CASE", "UPDATE_FIELD", "NEXT_STEP", "SAVE_CASE", "SHOW_QUEUE"],
    "supervisor": ["*"],
    "readOnly": ["SUMMARIZE_CASE", "SHOW_QUEUE", "EXPLAIN"]
  }
}
```

### LLM Providers

The extension supports multiple LLM providers:

- **Anthropic Claude** (default): `provider: "anthropic"`
- **Azure OpenAI**: `provider: "azure-openai"` with custom endpoint
- **OpenAI**: `provider: "openai"`

## Security

The extension enforces these security requirements:

1. PII masking runs before any external transmission
2. No Pega auth tokens accessed
3. No sensitive data in chrome.storage.local
4. Audit logs use masked tokens only
5. De-tokenization only at execution time, locally
6. Irreversible actions always require confirmation

## Development

### Testing Components

```javascript
// Test PII Masker
const { piiMasker } = await import('./content-scripts/pii-masker.js');
piiMasker.classifyField('First Name', 'Field_FirstName'); // 'NAME'
const masked = piiMasker.mask('John Smith', 'NAME'); // '{NAME_1}'
piiMasker.unmask(masked); // 'John Smith'

// Test Intent Classifier
const { intentClassifier } = await import('./shared/intent-classifier.js');
intentClassifier.classify('Summarize this case');
// { intent: 'SUMMARIZE_CASE', confidence: 0.95, requiresLLM: false }

// Test DOM Parser (run on Pega page)
const { domParser } = await import('./content-scripts/dom-parser.js');
domParser.parse(true);
```

### Debug Mode

Open the service worker console to see all message traffic:

```
chrome://extensions/ → Pega Co-Pilot → "service worker" link
```

## Roadmap

This MVP is **Rung 1** of a 5-rung integration ladder:

1. **Rung 1** (Now): Browser extension with DOM parsing and LLM intelligence
2. **Rung 2**: Direct Pega API integration replacing DOM parsing
3. **Rung 3**: CDH and Prediction Studio integration
4. **Rung 4**: Constellation-native component
5. **Rung 5**: Platform Rules and Data Fabric integration

## Troubleshooting

### Extension not detecting Pega

- Ensure you're on a `*.pegacloud.io` or `*.pega.com` domain
- For local testing, add `*://localhost/*` to matches in manifest.json

### Summary not generating

- Check that API key is set: `chrome.storage.session.get('llm-api-key')`
- Verify API key is valid and has credits

### Actions not executing

- Check service worker console for errors
- Ensure content script is loaded (check page console)

## License

Enterprise license - contact your Pega account representative.

## Support

For issues and feature requests, contact your enterprise Pega CoE team.
