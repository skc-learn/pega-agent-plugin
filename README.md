# Pega Agent Plugin

> Intelligent co-pilot browser extension for Pega Infinity case workers

[![Release](https://img.shields.io/github/v/release/skc-learn/pega-agent-plugin)](https://github.com/skc-learn/pega-agent-plugin/releases)
[![License](https://img.shields.io/badge/license-Enterprise-red)](LICENSE)

## Overview

The Pega Agent Plugin is an enterprise-grade, privacy-first, AI-powered browser extension designed to enhance productivity for Pega Infinity '23+ case workers. It provides intelligent assistance through natural language commands while maintaining strict security and compliance standards.

## Features

### 🧠 Pega-Aware Intelligence
- **Automatic Detection**: Recognizes Pega applications by domain, UI patterns, and DOM structure
- **Framework Support**: Works with Constellation (React), Cosmos (Angular), and Classic UI
- **Domain Knowledge**: Built-in expertise for Financial Lending, Insurance Claims, Healthcare, and Service Management
- **Case Context**: Extracts case ID, type, status, stage, assignee, and urgency automatically

### 🔒 Privacy & Security First
- **8 PII Categories**: NAME, SSN, DOB, EMAIL, PHONE, ACCOUNT, ADDRESS, INCOME
- **Field-Level Masking**: Tokenizes sensitive data before any external transmission
- **Session Isolation**: Automatic cleanup of tokens when session ends
- **Audit Trail**: Complete logging with masked tokens only
- **Zero Pega Auth**: Never accesses Pega authentication tokens

### 💬 Natural Language Commands
11 supported intents for hands-free case management:

**Local (No LLM Required)**:
- `Summarize this case` - Generate 4-part case summary
- `Submit/Complete` - Submit case (requires confirmation)
- `Save` - Persist changes
- `Next` - Proceed to next step
- `My queue` - Show assigned cases

**AI-Powered**:
- `Update the status to [value]` - Field updates
- `Escalate to supervisor` - Transfer case
- `Create a new case` - Start new case
- `Open case ABC-123` - Navigate to case
- `Find cases with...` - Search
- `Explain why...` - Get explanations

### 📊 Case Summarization
Auto-generated 4-part summaries when cases open:
1. **Situation**: What the case is about
2. **History**: Key events and timeline
3. **Current State**: Present status and data
4. **Risk Signals**: SLA risks, blockers, recommendations

### 🎯 Action Planning & Execution
- **14 Action Types**: CLICK, TYPE, SELECT, WAIT_FOR_ELEMENT, VERIFY_VISIBLE, and more
- **Smart Waiting**: WAIT_FOR_VISIBLE, WAIT_FOR_ENABLED instead of fixed delays
- **Confirmation**: Review and approve actions before execution
- **Self-Healing**: Automatic retries with alternative selectors

### 👁️ Visual Understanding
- **Screenshot Capture**: Visual analysis of current page state
- **Element Detection**: Find elements by visual appearance
- **Validation**: Visual diffing to confirm action results

### 🔄 Workflow Automation
- **Multi-Step Workflows**: Complex automation sequences
- **Conditional Logic**: If/then/else branching
- **State Management**: Persistent state across steps
- **Pause/Resume**: Control workflow execution

### 🔌 MCP Server
Full Model Context Protocol server for external integrations:
- **Tools**: parse_dom, execute_action, generate_summary, capture_screenshot, create_workflow
- **Resources**: case_context, dom_snapshot, case_summary, audit_log
- **Protocol**: JSON-RPC 2.0 compliant

### 🤖 Multi-LLM Support
- **Anthropic Claude** (default)
- **Azure OpenAI**
- **OpenAI**
- **Local LLM** via custom endpoint

### ⚙️ Enterprise Configuration
- **Role-Based Access**: caseWorker, supervisor, readOnly roles
- **PII Policies**: Configure which categories to mask
- **Domain Restrictions**: Allowlist specific Pega domains
- **Custom Heuristics**: Extend Pega knowledge

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/skc-learn/pega-agent-plugin.git
cd pega-agent-plugin/pega-browser-agent

# Install dependencies
npm install

# Build the extension
npm run build
```

### Load in Chrome

1. Open `chrome://extensions/`
2. Enable **Developer mode** (top right)
3. Click **Load unpacked**
4. Select the `pega-browser-agent` folder

### Configure API Key

Open the extension settings or run in browser console:

```javascript
chrome.storage.session.set({ 'llm-api-key': 'your-api-key' });
```

### Usage

1. Navigate to any Pega Infinity application
2. Click the extension icon or press `Ctrl+Shift+P`
3. Use natural language commands in the side panel

## Project Structure

```
pega-agent-plugin/
├── pega-browser-agent/          # Main extension code
│   ├── src/
│   │   ├── content-scripts/     # DOM interaction
│   │   ├── service-worker/      # Background processing
│   │   ├── side-panel/          # UI panel
│   │   ├── shared/              # Common utilities
│   │   └── config/              # Configuration
│   ├── tests/                   # Unit tests
│   ├── public/                  # HTML/CSS assets
│   └── manifest.json            # Extension manifest
└── README.md                    # This file
```

## Development

```bash
# Development mode with watch
npm run dev

# Run tests
npm test

# Type checking
npm run type-check

# Linting
npm run lint

# Build for production
npm run build

# Package for distribution
npm run package
```

## Configuration

Edit `config/default-config.json`:

```json
{
  "security": {
    "piiMaskingEnabled": true,
    "piiCategoriesToMask": ["NAME", "SSN", "DOB", "EMAIL", "PHONE", "ACCOUNT", "ADDRESS"]
  },
  "llm": {
    "provider": "anthropic",
    "model": "claude-sonnet-4-20250514",
    "maxTokens": 1500,
    "temperature": 0.1
  },
  "roleRestrictions": {
    "caseWorker": ["SUMMARIZE_CASE", "UPDATE_FIELD", "NEXT_STEP", "SAVE_CASE"],
    "supervisor": ["*"],
    "readOnly": ["SUMMARIZE_CASE", "SHOW_QUEUE", "EXPLAIN"]
  }
}
```

## Roadmap

This is **Rung 1** of a 5-rung integration ladder:

1. ✅ **Rung 1** (Now): Browser extension with DOM parsing and LLM intelligence
2. 🔄 **Rung 2**: Direct Pega API integration replacing DOM parsing
3. ⏳ **Rung 3**: CDH and Prediction Studio integration
4. ⏳ **Rung 4**: Constellation-native component
5. ⏳ **Rung 5**: Platform Rules and Data Fabric integration

## Contributing

This is an enterprise project. For contributions:

1. Fork the repository
2. Create a feature branch
3. Make your changes with tests
4. Ensure all tests pass
5. Submit a pull request

## License

Enterprise License - Contact your Pega account representative for licensing details.

## Support

- **Issues**: https://github.com/skc-learn/pega-agent-plugin/issues
- **Documentation**: See `pega-browser-agent/README.md` for detailed docs
- **Enterprise Support**: Contact your Pega CoE team

---

**Built with ❤️ for the Pega Community**
