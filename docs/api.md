# Pega Browser Agent - API Documentation

Complete API reference for the Pega Browser Agent extension.

## Table of Contents

- [Type Definitions](#type-definitions)
- [Content Script APIs](#content-script-apis)
- [Service Worker APIs](#service-worker-apis)
- [Message Protocol](#message-protocol)
- [MCP Tools](#mcp-tools)
- [Error Handling](#error-handling)

---

## Type Definitions

### Enums

#### MessageType

Message types for inter-component communication.

```typescript
enum MessageType {
  // Content Script → Service Worker
  DOM_SNAPSHOT = 'DOM_SNAPSHOT',
  PEGA_DETECTED = 'PEGA_DETECTED',
  USER_NAVIGATION = 'USER_NAVIGATION',
  ACTION_RESULT = 'ACTION_RESULT',

  // Side Panel → Service Worker
  USER_COMMAND = 'USER_COMMAND',
  USER_CONFIRM = 'USER_CONFIRM',
  USER_CANCEL = 'USER_CANCEL',
  FEEDBACK = 'FEEDBACK',
  PANEL_READY = 'PANEL_READY',

  // Service Worker → Content Script
  EXECUTE_ACTION = 'EXECUTE_ACTION',
  CAPTURE_DOM = 'CAPTURE_DOM',

  // Service Worker → Side Panel
  SHOW_SUMMARY = 'SHOW_SUMMARY',
  SHOW_PLAN = 'SHOW_PLAN',
  SHOW_RESULT = 'SHOW_RESULT',
  SHOW_RECOMMENDATION = 'SHOW_RECOMMENDATION',
  SHOW_ERROR = 'SHOW_ERROR',
  SHOW_LOADING = 'SHOW_LOADING',
  UPDATE_ACTIVITY = 'UPDATE_ACTIVITY',
  CLEAR_PENDING = 'CLEAR_PENDING',
  CONNECTION_STATUS = 'CONNECTION_STATUS',

  // MCP Messages
  MCP_TEST_CONNECTION = 'MCP_TEST_CONNECTION',
  MCP_LIST_TOOLS = 'MCP_LIST_TOOLS',
  MCP_CALL_TOOL = 'MCP_CALL_TOOL',
  MCP_LIST_SERVERS = 'MCP_LIST_SERVERS',
  MCP_CONNECT_SERVER = 'MCP_CONNECT_SERVER',
  MCP_DISCONNECT_SERVER = 'MCP_DISCONNECT_SERVER',
}
```

#### UIFramework

Pega UI framework detection result.

```typescript
type UIFramework = 'constellation' | 'classic' | 'cosmos' | 'unknown';
```

#### PiiCategory

PII classification categories for field masking.

```typescript
type PiiCategory = 'NAME' | 'SSN' | 'DOB' | 'EMAIL' | 'PHONE' | 'ACCOUNT' | 'ADDRESS' | 'INCOME' | null;
```

#### FieldType

Form field types detected in the DOM.

```typescript
type FieldType = 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'textarea' | 'radio' | 'unknown';
```

#### ActionType

Action button types classified from the DOM.

```typescript
type ActionType = 'submit' | 'save' | 'next' | 'cancel' | 'escalate' | 'assign' | 'review' | 'reopen' | 'hold' | 'delete' | 'generic';
```

#### PlanActionType

Action types available in automation plans.

```typescript
type PlanActionType =
  // Basic Actions
  | 'CLICK' | 'TYPE' | 'SELECT' | 'CLEAR' | 'NAVIGATE' | 'WAIT' | 'SCROLL'
  // Smart Waiting
  | 'WAIT_FOR_ELEMENT' | 'WAIT_FOR_VISIBLE' | 'WAIT_FOR_ENABLED'
  | 'WAIT_FOR_HIDDEN' | 'WAIT_FOR_TEXT'
  // Advanced Interactions
  | 'HOVER' | 'DOUBLE_CLICK' | 'RIGHT_CLICK' | 'PRESS_KEY' | 'DRAG_DROP'
  // Validation
  | 'ASSERT_VISIBLE' | 'ASSERT_ENABLED' | 'ASSERT_TEXT' | 'ASSERT_VALUE';
```

#### IntentType

User intent classification for command processing.

```typescript
type IntentType =
  | 'SUMMARIZE_CASE' | 'UPDATE_FIELD' | 'SUBMIT_CASE' | 'SAVE_CASE'
  | 'NEXT_STEP' | 'OPEN_CASE' | 'SHOW_QUEUE' | 'ESCALATE' | 'CREATE_CASE'
  | 'SEARCH' | 'EXPLAIN' | 'AMBIGUOUS' | 'UNKNOWN';
```

#### OutcomeType

Execution outcome types.

```typescript
type OutcomeType = 'success' | 'partial' | 'failed' | 'cancelled' | 'complete';
```

---

### Core Interfaces

#### ParsedField

Represents a form field extracted from the DOM.

```typescript
interface ParsedField {
  testId: string | null;           // data-test-id attribute value
  label: string | null;            // Field label text
  value: string | null;            // Current field value (may be masked)
  piiCategory: PiiCategory;        // PII classification
  piiToken: string | null;         // Token if value was masked
  fieldType: FieldType;            // Field type
  isEditable: boolean;             // Whether field can be edited
  isRequired: boolean;             // Whether field is required
  selector: string;                // Stable CSS selector
  semantic: string | null;         // Semantic field classification
  pegaPropertyType: string | null; // Pega property type
}
```

**Usage Example:**

```typescript
const field: ParsedField = {
  testId: 'FirstName',
  label: 'First Name',
  value: '{NAME_1}',  // Masked value
  piiCategory: 'NAME',
  piiToken: '{NAME_1}',
  fieldType: 'text',
  isEditable: true,
  isRequired: true,
  selector: '[data-test-id="FirstName"]',
  semantic: 'customer-name',
  pegaPropertyType: 'Text'
};
```

---

#### ParsedAction

Represents an action button extracted from the DOM.

```typescript
interface ParsedAction {
  label: string;                   // Button text
  testId: string | null;           // data-test-id attribute
  selector: string;                // Stable CSS selector
  actionType: ActionType;          // Type of action
  isDisabled: boolean;             // Whether button is disabled
  requiresConfirmation: boolean;   // Whether action needs confirmation
  isFlowAction: boolean;           // Whether it advances case stage
  isLocalAction: boolean;          // Whether it's UI-only
  isBulkAction: boolean;           // Whether it affects multiple cases
}
```

**Usage Example:**

```typescript
const submitAction: ParsedAction = {
  label: 'Submit',
  testId: 'SubmitButton',
  selector: '[data-test-id="SubmitButton"]',
  actionType: 'submit',
  isDisabled: false,
  requiresConfirmation: true,
  isFlowAction: true,   // Advances to next stage
  isLocalAction: false,
  isBulkAction: false
};
```

---

#### CaseContext

Context information about the current Pega case.

```typescript
interface CaseContext {
  caseId: string | null;         // Case ID
  caseClass: string | null;      // Case class (e.g., "FW-LoanApp")
  caseType: string | null;       // Case type
  status: string | null;         // Case status
  urgency: string | null;        // Urgency level
  assignedTo: string | null;     // Assigned user/team
  slaDeadline: string | null;    // SLA deadline
  stageName: string | null;      // Current stage name
  domain: string | null;         // Business domain
}
```

---

#### DOMSnapshot

Complete snapshot of the current Pega UI state.

```typescript
interface DOMSnapshot {
  timestamp: number;              // Snapshot timestamp
  url: string;                    // Current page URL
  triggerSummary: boolean;        // Whether to trigger summary generation
  caseContext: CaseContext;       // Case context
  fields: ParsedField[];          // Extracted fields
  actions: ParsedAction[];        // Extracted actions
  pageTitle: string;              // Page title
  breadcrumbs: string[];          // Breadcrumb navigation
}
```

---

#### ActionPlan

Executable automation plan.

```typescript
interface ActionPlan {
  planId: string;                 // Unique plan identifier
  intent: IntentType;             // User intent
  summary: string;                // Plan summary
  requiresConfirmation: boolean;  // Whether user must confirm
  steps: PlanStep[];              // Execution steps
  expectedOutcome: string;        // Expected result
  createdAt: number;              // Creation timestamp
}
```

---

#### PlanStep

Single step in an action plan.

```typescript
interface PlanStep {
  stepNumber: number;             // Step order
  action: PlanActionType;         // Action to execute
  selector: string;               // Target element selector
  value?: string;                 // Optional value for TYPE/SELECT
  description: string;            // Human-readable description
  isReversible: boolean;          // Whether step can be undone
}
```

**Usage Example:**

```typescript
const step: PlanStep = {
  stepNumber: 1,
  action: 'TYPE',
  selector: '[data-test-id="FirstName"]',
  value: '{NAME_1}',  // Will be resolved to actual value
  description: 'Enter first name',
  isReversible: true
};
```

---

#### CaseSummary

AI-generated case summary.

```typescript
interface CaseSummary {
  caseId: string;                 // Case ID
  caseType: string;               // Case type
  situation: string;              // Current situation
  history: string;                // Case history
  currentState: string;           // Current state description
  riskSignals: string[];          // Identified risk signals
  recommendedNextAction: string | null;  // Suggested action
  generatedAt: number;            // Generation timestamp
  confidence: number;             // Confidence score (0-1)
  model: string;                  // LLM model used
}
```

---

#### ExecutionResult

Result of executing an action plan.

```typescript
interface ExecutionResult {
  status: 'complete' | 'partial' | 'failed';
  results: StepResult[];          // Individual step results
  totalExecutionTimeMs: number;   // Total execution time
  screenshot?: string;            // Base64 screenshot on failure
}
```

---

#### StepResult

Result of executing a single step.

```typescript
interface StepResult {
  stepNumber: number;             // Step number
  action: PlanActionType;         // Action executed
  success: boolean;               // Whether step succeeded
  errorMessage?: string;          // Error message if failed
  executionTimeMs: number;        // Execution time in ms
  retryCount?: number;            // Number of retries
  screenshot?: string;            // Base64 screenshot on failure
}
```

---

#### LLMConfig

Configuration for a single LLM provider.

```typescript
interface LLMConfig {
  provider: LLMProvider;          // Provider name
  endpoint: string;               // API endpoint
  model: string;                  // Model name
  apiVersion?: string;            // API version (for Azure)
  maxTokens: number;              // Max tokens in response
  temperature: number;            // Temperature (0-1)
  apiKey?: string;                // API key
  enabled?: boolean;              // Whether enabled
  priority?: number;              // Fallback priority (lower = higher)
}
```

**Supported Providers:**

```typescript
type LLMProvider = 'azure-openai' | 'openai' | 'anthropic' | 'local' | 'google' | 'mistral';
```

---

### Error Types

#### PegaAgentError

Base error class for all Pega Agent errors.

```typescript
class PegaAgentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  );
}
```

#### LLMProviderError

Error from LLM provider.

```typescript
class LLMProviderError extends PegaAgentError {
  constructor(message: string, provider: string, cause?: Error);
}
```

#### PlanParseError

Error parsing action plan.

```typescript
class PlanParseError extends PegaAgentError {
  constructor(message: string = 'Failed to parse action plan');
}
```

#### ElementNotFoundError

Element not found after timeout.

```typescript
class ElementNotFoundError extends PegaAgentError {
  constructor(
    selector: string,
    public readonly timeoutMs: number
  );
}
```

#### ValidationError

Assertion/validation failed.

```typescript
class ValidationError extends PegaAgentError {
  constructor(
    public readonly assertion: string,
    public readonly expected: string,
    public readonly actual: string
  );
}
```

---

## Content Script APIs

### PIIMasker

Handles PII classification and tokenization. Runs in content script isolated world.

#### Class Methods

##### `configure(categories: string[]): void`

Configure which PII categories to mask.

```typescript
piiMasker.configure(['NAME', 'SSN', 'EMAIL', 'PHONE']);
```

**Parameters:**
- `categories` - Array of category names to mask

---

##### `classify(label: string | null, testId: string | null): PiiCategory`

Classify a field as PII based on label and testId.

```typescript
const category = piiMasker.classify('Social Security Number', 'SSN');
// Returns: 'SSN'
```

**Parameters:**
- `label` - Field label text
- `testId` - data-test-id attribute value

**Returns:** PII category or `null` if not PII

---

##### `mask(value: string | null, category: PiiCategory): string | null`

Mask a value by creating a token.

```typescript
const masked = piiMasker.mask('123-45-6789', 'SSN');
// Returns: '{SSN_1}'
```

**Parameters:**
- `value` - Original value
- `category` - PII category

**Returns:** Token like `{SSN_1}` or original value if not maskable

---

##### `resolve(token: string | null): string | null`

Resolve a token back to original value.

```typescript
const original = piiMasker.resolve('{SSN_1}');
// Returns: '123-45-6789'
```

**Parameters:**
- `token` - Token to resolve

**Returns:** Original value or token if not found

**Note:** Only called in action-executor at execution time

---

##### `maskFields(fields: ParsedField[]): ParsedField[]`

Mask an array of parsed fields.

```typescript
const maskedFields = piiMasker.maskFields(fields);
```

**Parameters:**
- `fields` - Array of fields to mask

**Returns:** Array with masked values

---

##### `clearSession(): void`

Clear all tokens and counters.

```typescript
piiMasker.clearSession();
```

**Called:** On session/tab close

---

##### `getStats(): { totalTokens: number; byCategory: Record<string, number> }`

Get statistics about current masking state.

```typescript
const stats = piiMasker.getStats();
// Returns: { totalTokens: 5, byCategory: { NAME: 2, SSN: 3 } }
```

---

### DOM Parser

Extracts semantic DOM representation of Pega UI.

#### Functions

##### `captureDOM(triggerSummary?: boolean): DOMSnapshot`

Capture a complete DOM snapshot.

```typescript
const snapshot = captureDOM(true);
```

**Parameters:**
- `triggerSummary` - Whether to trigger summary generation (default: `false`)

**Returns:** Complete DOM snapshot

**Example:**

```typescript
const snapshot = captureDOM(true);

console.log('Case ID:', snapshot.caseContext.caseId);
console.log('Fields:', snapshot.fields.length);
console.log('Actions:', snapshot.actions.length);
```

---

### Action Executor

Executes validated action plans against the live DOM.

#### Functions

##### `executePlan(plan: ActionPlan): Promise<ExecutionResult>`

Execute a complete action plan.

```typescript
const result = await executePlan(plan);

if (result.status === 'complete') {
  console.log('All steps succeeded');
} else {
  console.error('Execution failed:', result.results);
}
```

**Parameters:**
- `plan` - Action plan to execute

**Returns:** Execution result with step-by-step outcomes

**Process:**
1. De-tokenize all values in the plan
2. Execute each step sequentially
3. Fail fast on step failure
4. Return execution result

---

##### `validatePlan(plan: ActionPlan): { valid: boolean; errors: string[] }`

Validate a plan before execution.

```typescript
const validation = validatePlan(plan);

if (!validation.valid) {
  console.error('Plan invalid:', validation.errors);
}
```

**Parameters:**
- `plan` - Action plan to validate

**Returns:** Validation result with errors if any

---

##### `canExecute(plan: ActionPlan): boolean`

Quick check if a plan can be executed.

```typescript
if (canExecute(plan)) {
  await executePlan(plan);
}
```

**Parameters:**
- `plan` - Action plan to check

**Returns:** `true` if all selectors exist

---

### Pega Detector

Detects Pega Infinity in the current tab.

#### Functions

##### `detectPega(): PegaDetectionResult | null`

Detect Pega Infinity in the current page.

```typescript
const result = detectPega();

if (result) {
  console.log('Pega detected:', result.uiFramework);
  console.log('Confidence:', result.confidence);
}
```

**Returns:** Detection result or `null` if confidence < 0.10

**Detection Signals:**
1. URL pattern (pegacloud.io, prweb, etc.)
2. `meta[name="pega-application"]` tag
3. Constellation selectors
4. Classic UI selectors
5. Pega-prefixed CSS classes
6. `meta[name="pega-version"]` tag
7. HTML comments with version
8. Pega data attributes
9. Pega scripts/iframes

---

##### `isLikelyPega(): boolean`

Quick check if current page is likely Pega.

```typescript
if (isLikelyPega()) {
  // Run full detection
  const result = detectPega();
}
```

**Returns:** `true` if URL or DOM has Pega indicators

---

## Service Worker APIs

### LLM Adapter

Multi-provider LLM interface with automatic fallback.

#### Methods

##### `configure(config: LLMConfig): void`

Configure single LLM provider.

```typescript
llmAdapter.configure({
  provider: 'anthropic',
  endpoint: 'https://api.anthropic.com',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.7,
  apiKey: 'sk-ant-...'
});
```

---

##### `configureMulti(config: MultiLLMConfig): void`

Configure multiple LLM providers with fallback.

```typescript
llmAdapter.configureMulti({
  providers: [
    {
      provider: 'anthropic',
      endpoint: 'https://api.anthropic.com',
      model: 'claude-sonnet-4-20250514',
      maxTokens: 4096,
      temperature: 0.7,
      apiKey: 'sk-ant-...',
      priority: 1
    },
    {
      provider: 'openai',
      endpoint: 'https://api.openai.com',
      model: 'gpt-4-turbo',
      maxTokens: 4096,
      temperature: 0.7,
      apiKey: 'sk-openai-...',
      priority: 2
    }
  ],
  fallbackEnabled: true,
  maxRetries: 2,
  timeoutMs: 15000
});
```

---

##### `isReady(): boolean`

Check if adapter is ready.

```typescript
if (!llmAdapter.isReady()) {
  console.log('LLM not configured');
}
```

---

##### `complete(systemPrompt: string, userPrompt: string): Promise<LLMResponse>`

Complete a prompt with automatic fallback.

```typescript
const response = await llmAdapter.complete(
  'You are a Pega expert.',
  'Summarize this case.'
);

console.log('Content:', response.content);
console.log('Tokens:', response.tokensUsed);
console.log('Latency:', response.latencyMs);
```

**Returns:** LLM response with content and metadata

---

##### `generateSummary(context: SummaryContext): Promise<{ summary: CaseSummary; tokensUsed: number; latencyMs: number }>`

Generate a case summary with Pega framework context.

```typescript
const result = await llmAdapter.generateSummary({
  caseContext: snapshot.caseContext,
  fields: snapshot.fields,
  actions: snapshot.actions,
  pegaContext: {
    uiFramework: 'constellation',
    version: '8.8',
    appName: 'Customer Service'
  }
});

console.log('Summary:', result.summary);
console.log('Tokens used:', result.tokensUsed);
```

**Parameters:**
- `context.caseContext` - Case context
- `context.fields` - Extracted fields (non-PII only)
- `context.actions` - Available actions
- `context.pegaContext` - Pega environment info

**Returns:** Summary with metadata

---

### Planner

Intent to action planning engine.

#### Functions

##### `plan(command: string, snapshot: DOMSnapshot): Promise<ActionPlan | null>`

Process a command and generate an action plan.

```typescript
const actionPlan = await plan('Update the income to 50000', snapshot);

if (actionPlan) {
  console.log('Plan:', actionPlan.summary);
  console.log('Steps:', actionPlan.steps.length);
}
```

**Process:**
1. Classify intent locally
2. Handle locally without LLM for high-confidence known intents
3. Use LLM for complex intents
4. Return validated action plan

---

##### `checkPermission(intent: IntentType, userRole: string | null, roleRestrictions: Record<string, IntentType[] | ['*']>): boolean`

Check if user has permission for intent.

```typescript
const allowed = checkPermission('ESCALATE', 'caseworker', roleRestrictions);
```

**Returns:** `true` if user role allows the intent

---

##### `validatePlan(plan: ActionPlan, snapshot?: DOMSnapshot): { valid: boolean; errors: string[] }`

Validate a plan against current snapshot.

```typescript
const validation = validatePlan(plan, snapshot);

if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
}
```

**Checks:**
- Required fields present
- All selectors valid
- Values provided for actions that need them
- Plan structure valid

---

### Summary Generator

Case summarization orchestrator.

#### Methods

##### `generate(tabId: number, snapshot: DOMSnapshot, pegaDetection?: PegaDetectionResult | null): Promise<CaseSummary | null>`

Generate a case summary with Pega framework context.

```typescript
const summary = await summaryGenerator.generate(
  tabId,
  snapshot,
  pegaDetection
);

if (summary) {
  console.log('Situation:', summary.situation);
  console.log('History:', summary.history);
  console.log('Recommended:', summary.recommendedNextAction);
}
```

**Features:**
- Caches result by caseId + snapshotHash
- Returns cached version instantly on re-open
- Invalidates cache when action is executed
- Includes domain-specific context
- Shows available actions with SLA awareness

---

##### `invalidateCache(tabId: number, caseId: string): Promise<void>`

Invalidate summary cache for a case.

```typescript
await summaryGenerator.invalidateCache(tabId, caseId);
```

**Called:** After action execution on a case

---

### Workflow Orchestrator

Multi-step automation with self-healing.

#### Functions

##### `executeWorkflow(workflow: Workflow, tabId: number, initialContext: { caseContext: CaseContext | null; snapshot: DOMSnapshot | null }): Promise<WorkflowExecution>`

Execute a workflow on a tab.

```typescript
const execution = await executeWorkflow(workflow, tabId, {
  caseContext: snapshot.caseContext,
  snapshot: snapshot
});

console.log('Status:', execution.status);
console.log('Completed steps:', execution.completedSteps);
```

**Features:**
- Multi-step workflow execution
- Self-healing with retries
- Conditional execution
- Screenshot capture on failure
- State management across steps

---

##### `createFromPlan(plan: ActionPlan, options?: WorkflowOptions): Workflow`

Create a workflow from an action plan.

```typescript
const workflow = createWorkflowFromPlan(plan, {
  name: 'Update Income',
  onError: 'retry',
  maxRetries: 3
});
```

**Parameters:**
- `plan` - Action plan to convert
- `options.name` - Workflow name
- `options.onError` - Error handling strategy
- `options.maxRetries` - Maximum retry attempts

---

##### `createFromDescription(description: string, snapshot: DOMSnapshot): Promise<Workflow | null>`

Create a workflow from natural language description.

```typescript
const workflow = await createWorkflowFromDescription(
  'Update the income field and submit the case',
  snapshot
);
```

---

##### `pauseWorkflow(tabId: number): boolean`

Pause a running workflow.

```typescript
pauseWorkflow(tabId);
```

---

##### `resumeWorkflow(tabId: number): boolean`

Resume a paused workflow.

```typescript
resumeWorkflow(tabId);
```

---

##### `cancelWorkflow(tabId: number): boolean`

Cancel a running workflow.

```typescript
cancelWorkflow(tabId);
```

---

##### `getStatus(tabId: number): WorkflowExecution | null`

Get workflow status.

```typescript
const status = getStatus(tabId);
console.log('Current step:', status?.currentStep);
```

---

### MCP Server

Exposes extension capabilities as MCP tools.

#### Class Methods

##### `getCapabilities(): ServerCapabilities`

Get server capabilities.

```typescript
const capabilities = mcpServer.getCapabilities();
// Returns: { tools: {...}, resources: {...}, prompts: {...} }
```

---

##### `handleRequest(request: JsonRpcRequest, clientId: string): Promise<JsonRpcResponse>`

Handle an MCP request.

```typescript
const response = await mcpServer.handleRequest(request, clientId);
```

**Supported Methods:**
- `initialize` - Initialize MCP connection
- `tools/list` - List available tools
- `tools/call` - Execute a tool
- `resources/list` - List available resources
- `resources/read` - Read a resource
- `prompts/list` - List available prompts
- `prompts/get` - Get a prompt

---

##### `registerTool(name: string, handler: ToolHandler): void`

Register a custom tool.

```typescript
mcpServer.registerTool('my_custom_tool', async (args, tabId) => {
  return {
    content: [{
      type: 'text',
      text: 'Tool executed successfully'
    }]
  };
});
```

---

##### `registerResource(uri: string, handler: ResourceHandler): void`

Register a custom resource.

```typescript
mcpServer.registerResource('myapp://data', async () => {
  return { data: 'my data' };
});
```

---

## Message Protocol

### Message Creation

#### `createMessage<T>(type: MessageType, payload: T, metadata?: Partial<MessageMetadata>): Message<T>`

Create a standard message envelope.

```typescript
const message = createMessage(
  MessageType.USER_COMMAND,
  { command: 'Summarize this case' },
  { sessionId: 'session-123', tabId: 1 }
);
```

**Parameters:**
- `type` - Message type
- `payload` - Message payload
- `metadata` - Optional metadata (timestamp auto-added)

---

### Message Validation

#### `isValidMessage(message: unknown): message is Message`

Validate message structure.

```typescript
if (isValidMessage(rawMessage)) {
  console.log('Valid message:', rawMessage.type);
}
```

---

#### `isMessageType<T extends MessageType>(message: Message, type: T): message is Message & { type: T }`

Type guard for specific message types.

```typescript
if (isMessageType(message, MessageType.DOM_SNAPSHOT)) {
  const snapshot = message.payload as DOMSnapshot;
}
```

---

### Utilities

#### `generateCorrelationId(): string`

Generate unique correlation ID for request/response tracking.

```typescript
const correlationId = generateCorrelationId();
// Returns: '1712345678900-abc123def'
```

---

#### `generateUUID(): string`

Generate a UUID v4.

```typescript
const uuid = generateUUID();
// Returns: '550e8400-e29b-41d4-a716-446655440000'
```

---

## MCP Tools

### Available Tools

#### `pega_get_case_summary`

Get an AI-generated summary of the current Pega case.

**Parameters:**
```typescript
{
  caseId?: string;              // Optional case ID
  includeRiskSignals?: boolean; // Include risk analysis (default: true)
}
```

**Returns:**
```typescript
{
  caseId: string;
  situation: string;
  history: string;
  currentState: string;
  riskSignals: string[];
  recommendedNextAction: string | null;
}
```

---

#### `pega_execute_action_plan`

Execute a sequence of browser automation actions on a Pega case.

**Parameters:**
```typescript
{
  command: string;              // Natural language command
  autoConfirm?: boolean;        // Auto-confirm actions (default: false)
}
```

**Returns:**
```typescript
{
  content: Array<{
    type: 'text' | 'image';
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
}
```

---

#### `pega_get_dom_snapshot`

Get a semantic snapshot of the current Pega UI.

**Parameters:**
```typescript
{
  includePII?: boolean;         // Include PII data (default: false)
}
```

**Returns:**
```typescript
{
  timestamp: number;
  url: string;
  caseContext: CaseContext;
  fields: ParsedField[];
  actions: ParsedAction[];
}
```

---

#### `pega_detect_framework`

Detect if the current page is a Pega application.

**Parameters:** None

**Returns:**
```typescript
{
  isPega: boolean;
  confidence: number;
  uiFramework: UIFramework;
  version: string;
  appName?: string;
}
```

---

#### `pega_update_field`

Update a specific field in the current Pega case.

**Parameters:**
```typescript
{
  fieldLabel: string;           // Label or test ID of field
  value: string;                // New value
}
```

**Returns:** Execution result

---

#### `pega_click_action`

Click an action button in the Pega UI.

**Parameters:**
```typescript
{
  actionLabel: string;          // Label or test ID of button
  waitForResponse?: boolean;    // Wait for completion (default: true)
}
```

**Returns:** Execution result

---

#### `pega_navigate_case`

Navigate to a specific case or work queue.

**Parameters:**
```typescript
{
  target: string;               // Case ID, URL, or queue name
}
```

**Returns:** Navigation result

---

#### `pega_wait_for`

Wait for a specific condition in the Pega UI.

**Parameters:**
```typescript
{
  condition: 'element' | 'visible' | 'enabled' | 'hidden' | 'text';
  selector: string;             // CSS selector or test ID
  expectedValue?: string;       // Expected value (for text condition)
  timeoutMs?: number;           // Max wait time (default: 5000)
}
```

**Returns:** Wait result

---

### MCP Resources

#### `pega://current-case`

The currently open Pega case with all field values and metadata.

**MIME Type:** `application/json`

---

#### `pega://case-history`

History of actions taken on the current case.

**MIME Type:** `application/json`

---

#### `pega://available-actions`

List of actions available for the current case.

**MIME Type:** `application/json`

---

### MCP Prompts

#### `summarize_case`

Generate a comprehensive summary of the current Pega case.

---

#### `suggest_next_action`

Suggest the next best action for the current case.

---

#### `identify_risks`

Identify potential risk signals in the current case.

---

#### `explain_workflow`

Explain the current workflow and available paths.

---

## Error Handling

### Error Hierarchy

```
PegaAgentError (base)
├── LLMProviderError
│   ├── LLMTimeoutError
│   └── LLMInvalidResponseError
├── PlanParseError
├── SelectorNotFoundError
├── PermissionDeniedError
├── ElementNotFoundError
├── ElementNotInteractiveError
├── AutomationTimeoutError
└── ValidationError
```

### Error Handling Best Practices

#### 1. Always check for specific error types

```typescript
try {
  await executePlan(plan);
} catch (error) {
  if (error instanceof ElementNotFoundError) {
    console.log('Element not found after', error.timeoutMs, 'ms');
  } else if (error instanceof ValidationError) {
    console.log('Validation failed:', error.assertion);
  } else if (error instanceof PegaAgentError) {
    console.log('Pega Agent error:', error.code, error.message);
  }
}
```

#### 2. Use error codes for conditional logic

```typescript
try {
  await llmAdapter.complete(systemPrompt, userPrompt);
} catch (error) {
  if (error instanceof LLMProviderError) {
    if (error.code === 'LLM_TIMEOUT_ERROR') {
      // Handle timeout
    } else if (error.code === 'LLM_INVALID_RESPONSE') {
      // Handle invalid response
    }
  }
}
```

#### 3. Inspect error causes

```typescript
try {
  await executePlan(plan);
} catch (error) {
  if (error instanceof PegaAgentError && error.cause) {
    console.log('Root cause:', error.cause);
  }
}
```

#### 4. Validate before execution

```typescript
const validation = validatePlan(plan);
if (!validation.valid) {
  console.error('Plan invalid:', validation.errors);
  return;
}

try {
  await executePlan(plan);
} catch (error) {
  // Handle execution errors
}
```

---

## Security Considerations

### PII Masking

All PII is masked BEFORE data leaves the content script:

1. **Classification:** Fields are classified by label/testId
2. **Tokenization:** Values replaced with tokens like `{SSN_1}`
3. **Storage:** Token map kept in memory ONLY (never persisted)
4. **Resolution:** Tokens resolved ONLY during action execution

```typescript
// Content Script
const field = {
  label: 'Social Security',
  value: '{SSN_1}',  // Masked
  piiToken: '{SSN_1}'
};

// Service Worker (receives masked data)
console.log(field.value);  // '{SSN_1}' - no access to original

// Action Execution (only time original is used)
const original = piiMasker.resolve('{SSN_1}');  // '123-45-6789'
```

### Audit Logging

All actions are logged with:

- Timestamp
- Session ID
- User ID
- Case ID
- Intent type
- Plan summary
- Step count
- Outcome
- Error messages

### Permission System

Role-based access control for intents:

```typescript
const roleRestrictions = {
  'caseworker': ['SUMMARIZE_CASE', 'UPDATE_FIELD', 'SAVE_CASE', 'NEXT_STEP'],
  'manager': ['*'],  // All intents
  'viewer': ['SUMMARIZE_CASE', 'SHOW_QUEUE']
};
```

### Confirmation Requirements

Destructive actions require user confirmation:

- submit
- escalate
- reassign
- close
- delete
- approve

---

## Usage Examples

### Complete Workflow Example

```typescript
// 1. Detect Pega
const detection = detectPega();
if (!detection) {
  console.log('No Pega detected');
  return;
}

// 2. Capture DOM
const snapshot = captureDOM(true);

// 3. Generate summary
const summary = await summaryGenerator.generate(
  tabId,
  snapshot,
  detection
);

// 4. Plan action from user command
const command = 'Update income to 75000 and submit';
const plan = await plan(command, snapshot);

if (plan && plan.requiresConfirmation) {
  // Show plan to user for confirmation
  displayPlan(plan);
}

// 5. Execute plan (after user confirms)
const result = await executePlan(plan);

if (result.status === 'complete') {
  console.log('Plan executed successfully');
} else {
  console.error('Execution failed:', result.results);
}
```

### MCP Integration Example

```typescript
// From external MCP client
const mcpClient = new MCPClient();

// Connect to extension
await mcpClient.connect('pega-browser-agent');

// Get case summary
const summary = await mcpClient.callTool('pega_get_case_summary', {
  caseId: 'W-12345',
  includeRiskSignals: true
});

// Execute action plan
const result = await mcpClient.callTool('pega_execute_action_plan', {
  command: 'Update the status to Approved',
  autoConfirm: false
});

// Get current case as resource
const caseData = await mcpClient.readResource('pega://current-case');
```

---

## API Versioning

This documentation covers API version **1.0.0**.

For version history and migration guides, see [CHANGELOG.md](./CHANGELOG.md).

---

## Support

For issues, questions, or contributions:

- GitHub: [pega-browser-agent](https://github.com/your-org/pega-browser-agent)
- Documentation: [Full Docs](./README.md)
- Issues: [Issue Tracker](https://github.com/your-org/pega-browser-agent/issues)
