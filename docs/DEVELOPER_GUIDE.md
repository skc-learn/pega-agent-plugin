# Pega Browser Agent - Developer Guide

## Table of Contents

1. [Getting Started](#getting-started)
2. [Development Workflow](#development-workflow)
3. [Project Structure](#project-structure)
4. [Testing](#testing)
5. [Code Style](#code-style)
6. [Common Tasks](#common-tasks)
7. [Troubleshooting](#troubleshooting)
8. [Contributing](#contributing)

---

## Getting Started

### Prerequisites

Before starting development, ensure you have the following installed:

- **Node.js**: Version 18.0.0 or higher
- **npm**: Version 9.0.0 or higher (comes with Node.js)
- **Chrome/Chromium**: For testing the browser extension
- **Git**: For version control

Verify your installations:

```bash
node --version  # Should be v18.0.0 or higher
npm --version   # Should be v9.0.0 or higher
git --version
```

### Installation Steps

1. **Clone the repository** (if not already done):
   ```bash
   git clone <repository-url>
   cd pega-agent
   ```

2. **Navigate to the extension directory**:
   ```bash
   cd pega-browser-agent
   ```

3. **Install dependencies**:
   ```bash
   npm install
   ```

4. **Generate required icons**:
   - Open `icons/generate-icons.html` in Chrome
   - Click "Generate & Download All Icons"
   - Save downloaded PNG files to the `icons/` folder:
     - icon16.png
     - icon32.png
     - icon48.png
     - icon128.png

### Development Setup

1. **Build the extension**:
   ```bash
   npm run build
   ```

2. **Load extension in Chrome**:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the `pega-browser-agent` folder

3. **Configure API key**:
   - Go to `chrome://extensions/`
   - Find "Pega Case Management Agent"
   - Click "service worker" link
   - In the console, run:
     ```javascript
     chrome.storage.session.set({ 'llm-api-key': 'your-api-key-here' });
     ```

4. **Verify installation**:
   - Open any web page
   - Click the extension icon in the toolbar
   - The side panel should open

---

## Development Workflow

### Running in Dev Mode

For development with hot reloading:

```bash
npm run dev
```

This command:
- Runs webpack in development mode
- Enables watch mode for automatic rebuilds
- Generates source maps for debugging
- Outputs unminified code

**Workflow**:
1. Make changes to source files
2. Webpack automatically detects changes and rebuilds
3. In Chrome, go to `chrome://extensions/`
4. Click the refresh icon on the extension card
5. Test your changes

### Building for Production

For production builds:

```bash
npm run build
```

This command:
- Runs webpack in production mode
- Minifies output code
- Optimizes bundle size
- Removes development-only code

**Production build output**:
- Bundled files in `dist/` directory
- Three main bundles: `sw.js`, `content.js`, `panel.js`
- Copy of public assets (HTML, icons, manifest)

### Hot Reload Workflow

While Chrome extensions don't support true hot reloading, you can approximate it:

1. **Terminal 1**: Run dev build with watch
   ```bash
   npm run dev
   ```

2. **Terminal 2**: Create a reload script
   ```bash
   # Create reload-extension.sh
   #!/bin/bash
   while true; do
       inotifywait -r -e modify src/
       # Or for macOS:
       # fswatch -r src/
       echo "Changes detected - Reload extension in Chrome!"
   done
   ```

3. **Manual reload**:
   - Go to `chrome://extensions/`
   - Click refresh button on extension card
   - Or use keyboard shortcut: `Ctrl+R` on extensions page

### Debugging Techniques

#### Service Worker Debugging

1. **Open Service Worker Console**:
   - Go to `chrome://extensions/`
   - Find "Pega Case Management Agent"
   - Click "service worker" link
   - A DevTools window opens

2. **Debug messages**:
   - All message routing happens here
   - Check for `console.log` statements
   - Monitor network requests to LLM APIs

#### Content Script Debugging

1. **Open Page Console**:
   - Navigate to a Pega page (or mock page)
   - Press `F12` or `Ctrl+Shift+I`
   - Check for content script errors

2. **DOM inspection**:
   - Use Elements tab to inspect Pega DOM
   - Verify content script injected correctly
   - Check for DOM observer events

#### Side Panel Debugging

1. **Open Side Panel DevTools**:
   - Open the side panel
   - Right-click within the panel
   - Select "Inspect"
   - DevTools opens for panel context

2. **Panel-specific debugging**:
   - Check for UI rendering issues
   - Verify message passing to/from service worker
   - Monitor user interactions

#### Network Debugging

1. **API requests**:
   - Open Service Worker DevTools
   - Go to Network tab
   - Filter by "XHR" or "Fetch"
   - Check LLM API calls

2. **Extension messaging**:
   - Use Chrome's extension debugging features
   - Monitor message passing between contexts
   - Check for message size limits

---

## Project Structure

### Directory Layout

```
pega-browser-agent/
├── manifest.json              # Extension manifest (MV3)
├── package.json               # Node.js dependencies and scripts
├── webpack.config.cjs         # Webpack build configuration
├── tsconfig.json              # TypeScript compiler configuration
├── jest.config.cjs            # Jest test configuration
├── .eslintrc.json             # ESLint linting rules
│
├── public/                    # Static assets
│   ├── manifest.json          # Extension manifest (source)
│   ├── side-panel.html        # Side panel UI
│   ├── settings.html          # Settings page
│   └── icons/                 # Extension icons
│
├── src/                       # Source code (TypeScript)
│   ├── config/                # Configuration files
│   │   ├── default-config.ts  # Default configuration
│   │   └── enterprise-config.ts
│   │
│   ├── content-scripts/       # Content scripts (run in web page context)
│   │   ├── index.ts           # Content script entry point
│   │   ├── pega-detector.ts   # Pega application detection
│   │   ├── dom-observer.ts    # DOM change observation
│   │   ├── dom-parser.ts      # Pega DOM parsing
│   │   ├── pii-masker.ts      # PII masking and tokenization
│   │   └── action-executor.ts  # Execute actions on DOM
│   │
│   ├── service-worker/        # Service worker (background context)
│   │   ├── sw.ts              # Service worker entry point
│   │   ├── planner.ts         # Intent-to-action planning
│   │   ├── llm-adapter.ts     # LLM provider abstraction
│   │   ├── mcp-server.ts      # MCP server implementation
│   │   ├── mcp-client.ts      # MCP client for external tools
│   │   ├── workflow-orchestrator.ts  # Workflow orchestration
│   │   ├── case-state-manager.ts    # Case state tracking
│   │   ├── session-store.ts    # Session state management
│   │   ├── summary-generator.ts     # Case summarization
│   │   └── visual-understanding.ts   # Visual understanding
│   │
│   ├── side-panel/            # Side panel UI
│   │   ├── panel.ts           # Panel logic and messaging
│   │   └── (other UI files)
│   │
│   └── shared/                # Shared utilities and types
│       ├── types.ts           # TypeScript type definitions
│       ├── message-types.ts   # Message protocol definitions
│       ├── mcp-types.ts       # MCP protocol types
│       ├── intent-classifier.ts # Intent classification
│       ├── pega-heuristics.ts # Pega domain knowledge
│       └── audit-logger.ts    # Audit logging
│
├── tests/                     # Test files
│   ├── setup.ts               # Jest setup file
│   ├── fixtures/              # Test fixtures
│   ├── unit/                  # Unit tests
│   │   ├── pii-masker.test.ts
│   │   └── intent-classifier.test.ts
│   └── mock-pega-page.html    # Mock Pega page for testing
│
├── dist/                      # Build output (generated)
│   ├── sw.js                  # Service worker bundle
│   ├── content.js             # Content script bundle
│   ├── panel.js               # Side panel bundle
│   ├── side-panel.html        # Copied from public/
│   ├── settings.html          # Copied from public/
│   ├── manifest.json          # Copied from public/
│   └── icons/                 # Copied from public/icons/
│
├── coverage/                  # Test coverage reports (generated)
└── node_modules/              # NPM dependencies (generated)
```

### File Organization Conventions

#### Module Organization

- **Entry points**: `index.ts` files for each major context
- **Barrel exports**: Use `index.ts` to export public APIs
- **Shared code**: Place in `src/shared/` for cross-context usage
- **Context-specific**: Place in respective context directories

#### File Naming

- **TypeScript files**: Use `.ts` extension
- **Test files**: Use `.test.ts` suffix
- **Component files**: Use kebab-case: `pii-masker.ts`
- **Type definition files**: Use `.ts` extension (no `.d.ts` needed)

#### Module Dependencies

```
content-scripts/  →  shared/
service-worker/   →  shared/, content-scripts/ (via messaging)
side-panel/       →  shared/, service-worker/ (via messaging)
```

**Dependency Rules**:
- Content scripts cannot depend on service worker code
- Service worker is the only trust boundary
- Shared code must be context-agnostic
- Use message passing for cross-context communication

---

## Testing

### Running Tests

Run all tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm test -- --watch
```

Run tests with coverage:
```bash
npm test -- --coverage
```

Run specific test file:
```bash
npm test -- pii-masker.test.ts
```

### Writing New Tests

#### Unit Tests

Create test files in `tests/unit/`:

```typescript
// tests/unit/my-feature.test.ts
import { myFunction } from '../src/path/to/my-feature';

describe('myFunction', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected');
  });

  it('should handle errors', () => {
    expect(() => myFunction(null)).toThrow();
  });
});
```

#### Test Utilities

Use fixtures from `tests/fixtures/`:

```typescript
import { mockPegaDOM } from '../fixtures/mock-pega-dom';

describe('DOM Parser', () => {
  beforeEach(() => {
    document.body.innerHTML = mockPegaDOM;
  });

  // tests...
});
```

### Test Coverage

View coverage report:
```bash
npm test -- --coverage
open coverage/lcov-report/index.html  # On macOS
```

**Coverage goals**:
- Aim for >80% code coverage
- Focus on critical paths (PII masking, security)
- Test error conditions thoroughly

### Test Fixtures

Located in `tests/fixtures/`:

- `mock-pega-dom.html`: Mock Pega DOM structure
- `sample-config.json`: Sample configuration
- `test-data.ts`: Test data constants

Create new fixtures as needed:
```typescript
// tests/fixtures/my-fixture.ts
export const myTestData = {
  input: '...',
  expected: '...',
};
```

---

## Code Style

### TypeScript Conventions

#### Type Definitions

Always define types for public APIs:

```typescript
// Good
export interface MyOptions {
  enabled: boolean;
  count: number;
}

export function myFunction(options: MyOptions): void {
  // ...
}

// Bad - no types
export function myFunction(options: any): void {
  // ...
}
```

#### Strict Typing

Project uses strict TypeScript settings:
- `noImplicitAny`: No implicit any types
- `strictNullChecks`: Explicit null/undefined handling
- `noUnusedLocals`: No unused variables
- `noImplicitReturns`: All code paths return

```typescript
// Good
function processValue(value: string | null): string {
  if (!value) {
    return 'default';
  }
  return value.toUpperCase();
}

// Bad - violates strictNullChecks
function processValue(value: string | null): string {
  return value.toUpperCase(); // Error: value might be null
}
```

### Naming Patterns

#### Files and Directories

- **Files**: kebab-case (`pii-masker.ts`)
- **Directories**: kebab-case (`content-scripts/`)
- **Test files**: same name with `.test.ts` suffix

#### Code

- **Variables**: camelCase (`const userCount = 0;`)
- **Constants**: UPPER_SNAKE_CASE (`const MAX_RETRIES = 3;`)
- **Classes**: PascalCase (`class PIIFormatter {}`)
- **Interfaces**: PascalCase with `I` prefix discouraged (`interface MessageHandler {}`)
- **Types**: PascalCase (`type MessagePayload = ...`)
- **Functions**: camelCase (`function sendMessage() {}`)
- **Private members**: Prefix with `_` (`private _cache: Map;`)

### File Naming

Follow these patterns:

- **Components**: `component-name.ts`
- **Utilities**: `util-name.ts` or `component-name/util.ts`
- **Types**: `types.ts` or `component-name/types.ts`
- **Constants**: `constants.ts` or `component-name/constants.ts`
- **Tests**: `component-name.test.ts`

### Comment Standards

#### JSDoc Comments

Use JSDoc for public APIs:

```typescript
/**
 * Masks personally identifiable information (PII) in text
 *
 * @param text - The text to mask
 * @param category - The PII category (NAME, SSN, etc.)
 * @returns Masked text with tokens
 * @throws {Error} If category is invalid
 *
 * @example
 * ```typescript
 * const masked = maskPII('John Smith', 'NAME');
 * // Returns: '{NAME_1}'
 * ```
 */
export function maskPII(text: string, category: PIICategory): string {
  // ...
}
```

#### Inline Comments

Use inline comments sparingly - prefer self-documenting code:

```typescript
// Good - self-documenting
const isValidUser = user.age >= 18 && user.isActive;

// Bad - redundant comment
// Check if user is valid
const isValid = user.age >= 18 && user.isActive;

// Good - explains why
// Using setTimeout to avoid blocking the main thread
setTimeout(() => processLargeData(), 0);

// Bad - states the obvious
// Set timeout to 0
setTimeout(() => processLargeData(), 0);
```

#### TODO Comments

Mark TODO comments with owner and context:

```typescript
// TODO(skc): Implement caching for performance (tracked in issue #123)
function fetchConfig() {
  // ...
}
```

---

## Common Tasks

### Adding a New Content Script

1. **Create the script file**:
   ```typescript
   // src/content-scripts/my-script.ts
   console.log('My content script loaded');
   ```

2. **Register in content script entry point**:
   ```typescript
   // src/content-scripts/index.ts
   import './my-script'; // Auto-executes
   ```

3. **Add to manifest** (if separate injection needed):
   ```json
   {
     "content_scripts": [
       {
         "matches": ["<all_urls>"],
         "js": ["dist/content.js"],
         "run_at": "document_idle"
       }
     ]
   }
   ```

4. **Rebuild and reload**:
   ```bash
   npm run build
   # Reload extension in Chrome
   ```

### Adding a New Message Type

1. **Define message type**:
   ```typescript
   // src/shared/types.ts
   export enum MessageType {
     // ... existing types
     MY_NEW_MESSAGE = 'MY_NEW_MESSAGE',
   }
   ```

2. **Define payload type**:
   ```typescript
   // src/shared/types.ts
   export interface MyNewMessagePayload {
     data: string;
     timestamp: number;
   }
   ```

3. **Create message helper** (optional):
   ```typescript
   // src/shared/message-types.ts
   export function createMyNewMessage(data: string): Message<MyNewMessagePayload> {
     return createMessage(MessageType.MY_NEW_MESSAGE, {
       data,
       timestamp: Date.now(),
     });
   }
   ```

4. **Handle message in service worker**:
   ```typescript
   // src/service-worker/sw.ts
   chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
     if (message.type === MessageType.MY_NEW_MESSAGE) {
       handleMyNewMessage(message.payload);
     }
   });
   ```

5. **Send from content script or panel**:
   ```typescript
   chrome.runtime.sendMessage(createMyNewMessage('hello'));
   ```

### Adding a New MCP Tool

1. **Define tool schema**:
   ```typescript
   // src/service-worker/mcp-server.ts
   const myNewTool: MCPTool = {
     name: 'my_new_tool',
     description: 'Does something useful',
     inputSchema: {
       type: 'object',
       properties: {
         param1: { type: 'string', description: 'First parameter' },
       },
       required: ['param1'],
     },
   };
   ```

2. **Register tool**:
   ```typescript
   // In MCP server initialization
   server.registerTool(myNewTool);
   ```

3. **Implement tool handler**:
   ```typescript
   async function handleMyNewTool(params: any): Promise<MCPToolResult> {
     try {
       const result = await doSomething(params.param1);
       return {
         content: [{
           type: 'text',
           text: JSON.stringify(result),
         }],
       };
     } catch (error) {
       return {
         content: [{
           type: 'text',
           text: `Error: ${error.message}`,
         }],
         isError: true,
       };
     }
   }
   ```

4. **Test the tool**:
   ```typescript
   // Via MCP client or direct call
   const result = await server.callTool('my_new_tool', { param1: 'test' });
   ```

### Modifying PII Categories

1. **Add new category**:
   ```typescript
   // src/content-scripts/pii-masker.ts
   export type PIICategory =
     | 'NAME' | 'SSN' | 'DOB' | 'EMAIL' | 'PHONE'
     | 'ACCOUNT' | 'ADDRESS' | 'INCOME'
     | 'MY_NEW_CATEGORY'; // Add here

   export const PII_PATTERNS: Record<PIICategory, RegExp[]> = {
     // ... existing patterns
     MY_NEW_CATEGORY: [
       /pattern-for-my-category/gi,
     ],
   };
   ```

2. **Update configuration**:
   ```typescript
   // src/config/default-config.ts
   piiCategoriesToMask: [
     'NAME', 'SSN', 'DOB', 'EMAIL', 'PHONE', 'ACCOUNT', 'ADDRESS', 'INCOME',
     'MY_NEW_CATEGORY', // Add to default list
   ],
   ```

3. **Add tests**:
   ```typescript
   // tests/unit/pii-masker.test.ts
   describe('MY_NEW_CATEGORY masking', () => {
     it('should mask my new category', () => {
       const result = maskPII('test data', 'MY_NEW_CATEGORY');
       expect(result).toMatch(/\{MY_NEW_CATEGORY_\d+\}/);
     });
   });
   ```

### Adding LLM Provider Support

1. **Define provider interface**:
   ```typescript
   // src/service-worker/llm-adapter.ts
   interface LLMProvider {
     name: string;
     completions(params: CompletionParams): Promise<CompletionResult>;
     stream?(params: CompletionParams): AsyncIterator<CompletionChunk>;
   }
   ```

2. **Implement provider**:
   ```typescript
   class MyNewProvider implements LLMProvider {
     name = 'my-provider';

     async completions(params: CompletionParams): Promise<CompletionResult> {
       const response = await fetch('https://api.myprovider.com/v1/completions', {
         method: 'POST',
         headers: {
           'Content-Type': 'application/json',
           'Authorization': `Bearer ${params.apiKey}`,
         },
         body: JSON.stringify({
           model: params.model,
           messages: params.messages,
           max_tokens: params.maxTokens,
           temperature: params.temperature,
         }),
       });

       const data = await response.json();
       return {
         content: data.choices[0].message.content,
         usage: data.usage,
       };
     }
   }
   ```

3. **Register provider**:
   ```typescript
   // In LLM adapter initialization
   const providers = {
     'anthropic': new AnthropicProvider(),
     'openai': new OpenAIProvider(),
     'my-provider': new MyNewProvider(), // Add here
   };
   ```

4. **Update configuration**:
   ```typescript
   // src/config/default-config.ts
   allowedLLMProviders: [
     'azure-openai', 'openai', 'anthropic', 'mistral',
     'my-provider', // Add here
   ],
   ```

---

## Troubleshooting

### Common Issues and Solutions

#### Extension Not Loading

**Symptoms**: "Failed to load extension" error in Chrome

**Solutions**:
1. Check all icon files exist in `icons/` folder
2. Verify `manifest.json` has valid JSON syntax
3. Ensure `dist/` directory exists and is built
4. Check for missing required permissions in manifest

#### Content Script Not Injecting

**Symptoms**: Content script code not running on page

**Solutions**:
1. Check browser console for JavaScript errors
2. Verify content script is in manifest
3. Ensure URL pattern matches current page
4. Rebuild extension: `npm run build`
5. Reload extension in Chrome

#### Service Worker Not Starting

**Symptoms**: No service worker, or it immediately stops

**Solutions**:
1. Check for syntax errors in service worker code
2. Verify `manifest.json` has correct service worker configuration
3. Open service worker console to see error messages
4. Check for infinite loops or unhandled promises

#### PII Not Being Masked

**Symptoms**: Sensitive data visible in logs or API calls

**Solutions**:
1. Verify PII masking is enabled in configuration
2. Check that PII categories are correctly configured
3. Ensure PII patterns match your data format
4. Review masking logic in `pii-masker.ts`
5. Check that masking runs before API calls

#### API Calls Failing

**Symptoms**: LLM API calls return errors

**Solutions**:
1. Verify API key is set: `chrome.storage.session.get('llm-api-key')`
2. Check API key is valid and has credits
3. Ensure network requests are allowed in manifest
4. Review service worker console for API errors
5. Check CORS configuration for API endpoints

#### Messages Not Passing Between Contexts

**Symptoms**: Message sending fails silently

**Solutions**:
1. Verify message type is registered in `MessageType` enum
2. Check message structure matches expected format
3. Ensure listeners are registered before messages sent
4. Use `chrome.runtime.lastError` to check for errors
5. Enable message logging for debugging

### Debug Console Locations

#### Service Worker Console
- **Access**: `chrome://extensions/` → Find extension → "service worker" link
- **Use for**: Background tasks, API calls, message routing, state management

#### Content Script Console
- **Access**: F12 or Ctrl+Shift+I on any web page
- **Use for**: DOM manipulation, Pega detection, action execution, PII masking

#### Side Panel Console
- **Access**: Right-click in side panel → "Inspect"
- **Use for**: UI rendering, user interactions, panel-specific logic

### Log Interpretation

#### Message Logs

```javascript
// Good message flow
[SW] Received message: { type: 'SUMMARIZE_CASE', payload: {...} }
[SW] Processing SUMMARIZE_CASE
[SW] Sending to LLM: {...}
[SW] Received LLM response
[SW] Sending result to panel

// Bad message flow
[SW] Error: Invalid message type 'UNKNOWN_TYPE'
// → Message type not registered
```

#### PII Masking Logs

```javascript
// Good masking
[PII] Masking NAME: 'John Smith' → '{NAME_1}'
[PII] Stored mapping: {NAME_1} → 'John Smith'

// Bad masking
[PII] Warning: No pattern match for '123-45-6789'
// → SSN pattern not matching
```

#### API Logs

```javascript
// Good API call
[LLM] Request: POST https://api.anthropic.com/v1/messages
[LLM] Response: 200 OK (1500 tokens)
[LLM] Cost: $0.003

// Bad API call
[LLM] Error: 401 Unauthorized
// → Invalid API key
[LLM] Error: 429 Too Many Requests
// → Rate limit exceeded
```

---

## Contributing

### Pull Request Process

1. **Create a feature branch**:
   ```bash
   git checkout -b feature/my-feature
   ```

2. **Make your changes**:
   - Follow code style guidelines
   - Add tests for new functionality
   - Update documentation as needed

3. **Test your changes**:
   ```bash
   npm run lint        # Check code style
   npm run type-check  # Check TypeScript types
   npm test            # Run all tests
   npm run build       # Ensure build succeeds
   ```

4. **Commit your changes**:
   ```bash
   git add .
   git commit -m "feat: add my new feature"
   ```

5. **Push and create PR**:
   ```bash
   git push origin feature/my-feature
   # Create PR on GitHub
   ```

### Code Review Checklist

Before submitting a PR, verify:

- [ ] All tests pass (`npm test`)
- [ ] Code is formatted consistently (`npm run lint`)
- [ ] TypeScript compiles without errors (`npm run type-check`)
- [ ] Build succeeds (`npm run build`)
- [ ] New features have tests
- [ ] Documentation is updated
- [ ] No console errors in any context
- [ ] PII masking works correctly
- [ ] Security considerations addressed
- [ ] Performance impact is minimal
- [ ] No breaking changes (or documented if present)

### Release Process

1. **Update version**:
   ```bash
   # Update version in package.json
   npm version patch  # or minor or major
   ```

2. **Update CHANGELOG**:
   ```markdown
   ## Version 1.1.0 (2026-05-10)
   
   ### Added
   - New feature X
   
   ### Fixed
   - Bug Y fix
   
   ### Changed
   - Modified Z behavior
   ```

3. **Create release build**:
   ```bash
   npm run build
   npm run package  # Creates pega-agent.zip
   ```

4. **Tag and push**:
   ```bash
   git tag -a v1.1.0 -m "Release v1.1.0"
   git push origin v1.1.0
   ```

5. **Create GitHub release**:
   - Go to GitHub releases
   - Create new release
   - Upload `pega-agent.zip`
   - Publish release

### Development Best Practices

1. **Small, focused commits**: One logical change per commit
2. **Descriptive commit messages**: Use conventional commits format
3. **Test-driven development**: Write tests first when possible
4. **Code reviews**: Get reviews for all changes
5. **Documentation**: Keep docs in sync with code
6. **Security first**: Consider security implications of changes
7. **Performance**: Monitor bundle size and runtime performance
8. **Accessibility**: Ensure UI is accessible to all users

### Getting Help

- **Documentation**: Check existing docs in `/docs`
- **Issues**: Search GitHub issues for similar problems
- **Team**: Contact enterprise Pega CoE team
- **Code review**: Request review from team members
- **Pair programming**: Use VS Code Live Share for collaboration

---

## Additional Resources

- **Chrome Extension Docs**: https://developer.chrome.com/docs/extensions/
- **TypeScript Docs**: https://www.typescriptlang.org/docs/
- **Webpack Docs**: https://webpack.js.org/concepts/
- **Jest Docs**: https://jestjs.io/docs/getting-started
- **Pega Platform**: https://www.pega.com/products/platform

---

**Last Updated**: 2026-05-10  
**Maintained By**: Enterprise Pega CoE  
**License**: Enterprise - See your Pega account representative
