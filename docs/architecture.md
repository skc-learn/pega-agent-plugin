# Pega Browser Agent - Architecture Documentation

## Table of Contents

1. [System Architecture](#system-architecture)
2. [Core Components](#core-components)
3. [Message Passing Protocol](#message-passing-protocol)
4. [Security Architecture](#security-architecture)
5. [State Management](#state-management)
6. [MCP Server](#mcp-server)
7. [Technology Choices](#technology-choices)

---

## System Architecture

### High-Level Component Diagram

```mermaid
graph TB
    subgraph "Browser Extension"
        SW[Service Worker]
        SP[Side Panel]
        CS[Content Scripts]
        
        subgraph "Content Script Modules"
            PD[Pega Detector]
            DO[DOM Observer]
            DP[DOM Parser]
            PM[PII Masker]
            AE[Action Executor]
        end
        
        subgraph "Service Worker Modules"
            PL[Planner]
            LA[LLM Adapter]
            SG[Summary Generator]
            SS[Session Store]
            AL[Audit Logger]
            MS[MCP Server]
            MC[MCP Client]
            WO[Workflow Orchestrator]
            CS2[Case State Manager]
            VU[Visual Understanding]
        end
    end
    
    subgraph "External Systems"
        LLM[LLM Providers]
        MCP[MCP Servers]
        Pega[Pega Infinity Application]
    end
    
    SP <-->|User Commands| SW
    CS <-->|DOM Snapshots| SW
    CS <-->|Action Execution| Pega
    SW <-->|API Calls| LLM
    SW <-->|MCP Protocol| MCP
    
    CS -->|Detection| PD
    CS -->|Observation| DO
    CS -->|Parsing| DP
    CS -->|PII Masking| PM
    CS -->|Execution| AE
    
    SW -->|Planning| PL
    SW -->|LLM Calls| LA
    SW -->|Summarization| SG
    SW -->|State| SS
    SW -->|Audit| AL
    SW -->|MCP Server| MS
    SW -->|MCP Client| MC
    SW -->|Workflows| WO
    SW -->|Case State| CS2
    SW -->|Vision| VU
    
    style SW fill:#e1f5ff
    style SP fill:#fff4e1
    style CS fill:#e8f5e9
    style Pega fill:#fce4ec
```

### Extension Architecture (Manifest V3)

The extension follows Chrome's Manifest V3 architecture:

```mermaid
graph LR
    subgraph "Extension Contexts"
        BG[Background Context<br/>Service Worker]
        CS[Content Script Context<br/>Isolated World]
        SP[Side Panel Context<br/>UI Frame]
    end
    
    subgraph "Web Page Context"
        Page[Pega Infinity Page]
    end
    
    BG <-->|chrome.runtime.sendMessage| CS
    BG <-->|chrome.runtime.sendMessage| SP
    CS <-->|DOM Access| Page
    
    style BG fill:#ffebee
    style CS fill:#e8f5e9
    style SP fill:#fff3e0
    style Page fill:#f3e5f5
```

**Key Isolation Characteristics:**

- **Service Worker**: Single background instance, no DOM access, persistent state
- **Content Scripts**: Isolated JavaScript world per tab, full DOM access
- **Side Panel**: UI context for user interaction, no direct DOM access to page
- **Trust Boundaries**: Service worker is the ONLY trusted component for external communication

### Component Interaction Patterns

```mermaid
sequenceDiagram
    participant User as User
    participant Panel as Side Panel
    participant SW as Service Worker
    participant CS as Content Scripts
    participant LLM as LLM Provider
    participant Pega as Pega App
    
    User->>Panel: Enter command
    Panel->>SW: USER_COMMAND message
    SW->>CS: CAPTURE_DOM request
    CS->>Pega: Read DOM
    Pega-->>CS: DOM data
    CS->>CS: PII Masking
    CS->>SW: DOM_SNAPSHOT message
    SW->>SW: Intent Classification
    SW->>LLM: Generate plan
    LLM-->>SW: ActionPlan
    SW->>Panel: SHOW_PLAN confirmation
    Panel->>SW: USER_CONFIRM
    SW->>CS: EXECUTE_ACTION
    CS->>Pega: Execute actions
    Pega-->>CS: Results
    CS->>SW: ACTION_RESULT
    SW->>Panel: SHOW_RESULT
```

### Data Flow Between Components

```mermaid
graph TD
    A[Pega Infinity DOM] -->|Raw HTML| B[Content Scripts]
    B -->|PII Classification| C[PII Masker]
    C -->|Tokenized Data| D[DOM Parser]
    D -->|DOMSnapshot| E[Service Worker]
    
    E -->|Context| F[Planner]
    E -->|Case Data| G[Summary Generator]
    
    F -->|Plan Request| H[LLM Adapter]
    H -->|API Call| I[LLM Providers]
    I -->|Response| H
    H -->|ActionPlan| F
    
    F -->|Validated Plan| J[Session Store]
    J -->|Pending Plan| K[Side Panel]
    
    K -->|User Confirmation| E
    E -->|Execution Request| B
    B -->|Execute Actions| A
    
    style A fill:#fce4ec
    style C fill:#fff9c4
    style E fill:#e1f5ff
    style I fill:#e8f5e9
```

---

## Core Components

### Service Worker (sw.ts)

**Purpose**: Central message router and orchestrator for all extension components.

**Responsibilities:**
- Initialize and configure all subsystems (LLM, MCP, session store, audit logger)
- Handle all inter-component message routing
- Orchestrate plan generation and execution
- Manage Pega detection lifecycle
- Coordinate summary generation
- Handle MCP server and client connections

**Key Methods:**
```typescript
class ServiceWorker {
  async initialize(): Promise<void>
  async handleMessage(message: Message, sender: chrome.runtime.MessageSender): Promise<boolean>
  private async handleUserCommand(payload: UserCommandPayload): Promise<void>
  private async handleDomSnapshot(payload: DomSnapshotPayload): Promise<void>
  private async handleActionResult(payload: ActionResultPayload): Promise<void>
  private async executePlan(tabId: number, actionPlan: ActionPlan): Promise<void>
}
```

**Lifecycle Management:**
```mermaid
stateDiagram-v2
    [*] --> Installed: chrome.runtime.onInstalled
    Installed --> Initializing: Service Worker starts
    Initializing --> LoadingConfig: Read configuration
    LoadingConfig --> InitializingLLM: Configure LLM adapter
    InitializingLLM --> InitializingMCP: Setup MCP server/client
    InitializingMCP --> Ready: All systems initialized
    Ready --> Running: Processing messages
    Running --> Ready: Idle waiting
    Running --> Terminated: Browser shutdown/extension reload
```

### Planner (planner.ts)

**Purpose**: Transform natural language commands + Pega context into executable action plans.

**Design Philosophy:**
- **Local First**: Handle high-confidence intents without LLM (SUBMIT, SAVE, NEXT)
- **LLM Fallback**: Use LLM for complex or ambiguous intents
- **Domain-Aware**: Inject Pega-specific patterns and domain knowledge

**Intent Classification Flow:**
```mermaid
graph TD
    A[User Command] --> B[Intent Classifier]
    B --> C{Known Intent?}
    C -->|Yes, Confidence ≥85%| D[Local Plan Generator]
    C -->|No or Low Confidence| E[LLM Plan Generator]
    
    D --> F{Plan Valid?}
    F -->|Yes| G[Return Plan]
    F -->|No| E
    
    E --> H{LLM Available?}
    H -->|Yes| I[Call LLM with Context]
    H -->|No| J[Return Error Plan]
    
    I --> K[Parse Response]
    K --> L{Valid Plan?}
    L -->|Yes| G
    L -->|No| M[Return Parse Error]
    
    style B fill:#e8f5e9
    style D fill:#fff9c4
    style E fill:#ffe0b2
    style I fill:#e1f5ff
```

**Plan Generation Examples:**

1. **Local Plan** (SUBMIT_CASE):
```json
{
  "planId": "uuid",
  "intent": "SUBMIT_CASE",
  "summary": "Submit case LOAN-123",
  "requiresConfirmation": true,
  "steps": [
    {
      "stepNumber": 1,
      "action": "CLICK",
      "selector": "[data-test-id=\"SubmitButton\"]",
      "description": "Click Submit button",
      "isReversible": false
    },
    {
      "stepNumber": 2,
      "action": "WAIT",
      "selector": "",
      "value": "2000",
      "description": "Wait for case submission to complete",
      "isReversible": true
    }
  ],
  "expectedOutcome": "Case submitted successfully"
}
```

2. **LLM Plan** (complex update):
```json
{
  "planId": "uuid",
  "intent": "UPDATE_FIELD",
  "summary": "Update applicant income to $75000",
  "requiresConfirmation": false,
  "steps": [
    {
      "stepNumber": 1,
      "action": "WAIT_FOR_VISIBLE",
      "selector": "[data-test-id=\"Income\"]",
      "description": "Wait for Income field to be visible",
      "isReversible": true
    },
    {
      "stepNumber": 2,
      "action": "CLEAR",
      "selector": "[data-test-id=\"Income\"]",
      "description": "Clear Income field",
      "isReversible": true
    },
    {
      "stepNumber": 3,
      "action": "TYPE",
      "selector": "[data-test-id=\"Income\"]",
      "value": "75000",
      "description": "Type '75000' into Income",
      "isReversible": true
    }
  ],
  "expectedOutcome": "Income field updated"
}
```

### LLM Adapter (llm-adapter.ts)

**Purpose**: Multi-provider LLM interface with automatic fallback.

**Supported Providers:**
- Azure OpenAI
- OpenAI
- Anthropic (Claude)
- Google (Gemini)
- Mistral
- Local endpoints

**Fallback Architecture:**
```mermaid
graph TD
    A[Complete Request] --> B{Provider 1 Available?}
    B -->|Yes| C[Try Provider 1]
    B -->|No| D{Provider 2 Available?}
    C -->|Success| E[Return Result]
    C -->|Failure| F[Log Error]
    F --> D
    D -->|Yes| G[Try Provider 2]
    D -->|No| H{More Providers?}
    G -->|Success| E
    G -->|Failure| H
    H -->|Yes| D
    H -->|No| I[All Providers Failed]
    
    style C fill:#e8f5e9
    style G fill:#fff9c4
    style I fill:#ffebee
```

**Configuration Example:**
```typescript
const multiConfig: MultiLLMConfig = {
  providers: [
    {
      provider: 'anthropic',
      apiKey: 'sk-ant-...',
      model: 'claude-sonnet-4-20250514',
      endpoint: 'https://api.anthropic.com',
      maxTokens: 1500,
      temperature: 0.1,
      priority: 1,  // Try first
      enabled: true
    },
    {
      provider: 'azure-openai',
      apiKey: 'azure-key',
      model: 'gpt-4',
      endpoint: 'https://openai.azure.com',
      apiVersion: '2024-02-15-preview',
      maxTokens: 1500,
      temperature: 0.1,
      priority: 2,  // Fallback
      enabled: true
    }
  ],
  fallbackEnabled: true,
  maxRetries: 2,
  timeoutMs: 8000
};
```

### Content Scripts

#### Pega Detector (pega-detector.ts)

**Purpose**: Detect Pega Infinity applications with confidence scoring.

**Detection Signals:**
```mermaid
graph TD
    A[Page Loaded] --> B{URL Pattern Match?}
    B -->|Yes| C[Signal 1: URL ✓]
    B -->|No| D[Signal 1: URL ✗]
    
    C --> E{Meta Pega Application?}
    D --> E
    E -->|Yes| F[Signal 2: Meta ✓]
    E -->|No| G[Signal 2: Meta ✗]
    
    F --> H{Constellation Selectors?}
    G --> H
    H -->|Yes| I[Signal 3: Constellation ✓]
    H -->|No| J{Classic UI Selectors?}
    J -->|Yes| K[Signal 4: Classic ✓]
    J -->|No| L[Signal 4: Classic ✗]
    
    I --> M{Pega CSS Classes?}
    K --> M
    L --> M
    M -->|Yes| N[Signal 5: CSS ✓]
    M -->|No| O[Signal 5: CSS ✗]
    
    N --> P{Meta Pega Version?}
    O --> P
    P -->|Yes| Q[Signal 6: Version ✓]
    P -->|No| R[Signal 6: Version ✗]
    
    Q --> S[Calculate Confidence]
    R --> S
    S --> T{Confidence ≥10%?}
    T -->|Yes| U[Pega Detected!]
    T -->|No| V[Not Pega]
    
    style U fill:#e8f5e9
    style V fill:#ffebee
```

**Confidence Calculation:**
```
confidence = (fired_signals / total_signals)
min_confidence = 0.10 (10%)  # Lowered for URL-only detection
```

#### DOM Parser (dom-parser.ts)

**Purpose**: Extract semantic DOM representation with PII masking.

**Extraction Pipeline:**
```mermaid
graph TD
    A[Raw DOM] --> B[Extract Case Context]
    A --> C[Extract Fields]
    A --> D[Extract Actions]
    A --> E[Extract Page Metadata]
    
    C --> F{Has data-test-id?}
    F -->|Yes| G[Use Test ID Selector]
    F -->|No| H[Use aria-label/name/id]
    
    G --> I[Build Stable Selector]
    H --> I
    
    I --> J{Classify PII?}
    J -->|Yes| K[PII Masker.mask]
    J -->|No| L[Keep Value]
    
    K --> M[Token like {NAME_1}]
    L --> N[Original Value]
    
    M --> O[ParsedField]
    N --> O
    
    O --> P[DOMSnapshot]
    
    style K fill:#fff9c4
    style O fill:#e1f5ff
```

**Selector Priority:**
1. `data-test-id` (most stable)
2. `aria-label` with tag
3. Stable `id` (non-auto-generated)
4. `name` attribute
5. Semantic path (no positional selectors)

#### PII Masker (pii-masker.ts)

**Purpose**: Classify and tokenize PII before external transmission.

**PII Classification:**
```mermaid
graph TD
    A[Field Label/Test ID] --> B[Match PII Patterns]
    
    B --> C{Category Match?}
    C -->|NAME| D[Token: {NAME_1}]
    C -->|SSN| E[Token: {SSN_1}]
    C -->|DOB| F[Token: {DOB_1}]
    C -->|EMAIL| G[Token: {EMAIL_1}]
    C -->|PHONE| H[Token: {PHONE_1}]
    C -->|ACCOUNT| I[Token: {ACCOUNT_1}]
    C -->|ADDRESS| J[Token: {ADDRESS_1}]
    C -->|INCOME| K[Token: {INCOME_1}]
    C -->|None| L[Keep Original]
    
    D --> M[Store in Memory Map]
    E --> M
    F --> M
    G --> M
    H --> M
    I --> M
    J --> M
    K --> M
    L --> N[No Storage]
    
    M --> O[Return Token]
    N --> O
    
    style D fill:#ffebee
    style E fill:#ffebee
    style F fill:#ffebee
    style G fill:#ffebee
    style H fill:#fff9c4
    style I fill:#fff9c4
    style J fill:#fff9c4
    style K fill:#fff9c4
    style L fill:#e8f5e9
```

**Critical Security Properties:**
- ✅ Raw values NEVER transmitted externally
- ✅ Token map NEVER persisted (memory only)
- ✅ Tokens resolved ONLY in content script at execution time
- ✅ Map cleared on session/tab close

**Token Resolution:**
```typescript
// At execution time in content script:
const originalValue = piiMasker.resolve("{NAME_1}");  // "John Doe"
```

#### Action Executor (action-executor.ts)

**Purpose**: Execute validated action plans with PII de-tokenization.

**Enhanced Automation Features:**
```mermaid
graph TD
    A[ActionPlan] --> B[De-tokenize Values]
    B --> C[For Each Step]
    
    C --> D{Action Type?}
    D -->|Basic| E[CLICK/TYPE/SELECT]
    D -->|Smart Wait| F[WAIT_FOR_*]
    D -->|Advanced| G[HOVER/DRAG_DROP]
    D -->|Validation| H[ASSERT_*]
    
    E --> I[Execute with Retry]
    F --> J[Wait with Polling]
    G --> I
    H --> K[Validate Assertion]
    
    I --> L{Success?}
    J --> L
    K --> L
    
    L -->|Yes| M[Next Step]
    L -->|No| N[Capture Screenshot]
    
    N --> O{Retries Left?}
    O -->|Yes| P[Wait with Backoff]
    P --> I
    O -->|No| Q[Fail Step]
    
    M --> R{More Steps?}
    R -->|Yes| C
    R -->|No| S[Return Result]
    
    Q --> S
    
    style B fill:#fff9c4
    style F fill:#e1f5ff
    style H fill:#e8f5e9
    style N fill:#ffebee
```

**Retry Configuration:**
```typescript
const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  screenshotOnFailure: true
};
```

### Side Panel (panel.ts)

**Purpose**: Chat-style UI for user interaction.

**UI States:**
```mermaid
stateDiagram-v2
    [*] --> Initializing: Panel loads
    Initializing --> Disconnected: No Pega detected
    Initializing --> Connected: Pega detected
    
    Connected --> Idle: Waiting for input
    Idle --> Typing: User enters command
    Typing --> Processing: Send command
    Processing --> Thinking: Show typing indicator
    Thinking --> ShowSummary: Summary ready
    Thinking --> ShowPlan: Plan requires confirmation
    Thinking --> ShowResult: Execution complete
    Thinking --> Error: Error occurred
    
    ShowPlan --> AwaitingConfirmation: User reviews
    AwaitingConfirmation --> Executing: User confirms
    AwaitingConfirmation --> Cancelled: User cancels
    Executing --> ShowResult
    
    ShowSummary --> Idle
    ShowResult --> Idle
    Error --> Idle
    Cancelled --> Idle
```

**Message Rendering:**
```mermaid
graph TD
    A[Incoming Message] --> B{Message Type?}
    B -->|SHOW_SUMMARY| C[Render Summary Card]
    B -->|SHOW_PLAN| D[Render Action Card]
    B -->|SHOW_RESULT| E[Render Result]
    B -->|SHOW_ERROR| F[Render Error]
    B -->|CONNECTION_STATUS| G[Update Status Bar]
    
    C --> H[Add to Chat Container]
    D --> H
    E --> H
    F --> H
    G --> I[Update Status Dot]
    
    H --> J[Scroll to Bottom]
    I --> J
    
    style C fill:#e8f5e9
    style D fill:#fff9c4
    style E fill:#e1f5ff
    style F fill:#ffebee
```

### Shared Utilities

#### Types (types.ts)

**Purpose**: Centralized TypeScript type definitions.

**Key Type Categories:**
- **Enums**: MessageType, UIFramework, PiiCategory, FieldType, ActionType, IntentType, OutcomeType
- **DOM Interfaces**: ParsedField, ParsedAction, CaseContext, DOMSnapshot
- **Plan Interfaces**: PlanStep, ActionPlan, ExecutionResult, StepResult
- **Session Interfaces**: SessionContext, CaseSummary, AuditEntry
- **Config Interfaces**: LLMConfig, SecurityConfig, PegaConfig, EnterpriseConfig
- **Error Classes**: PegaAgentError, LLMProviderError, PlanParseError, etc.

#### Message Types (message-types.ts)

**Purpose**: Type-safe message creation and validation.

**Message Envelope:**
```typescript
interface Message<T = unknown> {
  type: MessageType;        // Message type discriminator
  payload: T;               // Typed payload
  metadata: MessageMetadata; // Timestamp, sessionId, correlationId
}
```

**Message Creation:**
```typescript
const message = createMessage(MessageType.USER_COMMAND, {
  command: "Submit the case",
  tabId: 12345
}, {
  correlationId: generateCorrelationId()
});
```

---

## Message Passing Protocol

### Message Types and Routing

```mermaid
graph LR
    subgraph "Content Script → Service Worker"
        A1[DOM_SNAPSHOT]
        A2[PEGA_DETECTED]
        A3[USER_NAVIGATION]
        A4[ACTION_RESULT]
    end
    
    subgraph "Side Panel → Service Worker"
        B1[USER_COMMAND]
        B2[USER_CONFIRM]
        B3[USER_CANCEL]
        B4[FEEDBACK]
        B5[PANEL_READY]
    end
    
    subgraph "Service Worker → Content Script"
        C1[EXECUTE_ACTION]
        C2[CAPTURE_DOM]
    end
    
    subgraph "Service Worker → Side Panel"
        D1[SHOW_SUMMARY]
        D2[SHOW_PLAN]
        D3[SHOW_RESULT]
        D4[SHOW_ERROR]
        D5[SHOW_LOADING]
        D6[UPDATE_ACTIVITY]
        D7[CLEAR_PENDING]
        D8[CONNECTION_STATUS]
    end
    
    subgraph "MCP Messages"
        E1[MCP_TEST_CONNECTION]
        E2[MCP_LIST_TOOLS]
        E3[MCP_CALL_TOOL]
        E4[MCP_LIST_SERVERS]
        E5[MCP_CONNECT_SERVER]
        E6[MCP_DISCONNECT_SERVER]
    end
    
    A1 --> SW[Service Worker]
    A2 --> SW
    A3 --> SW
    A4 --> SW
    
    B1 --> SW
    B2 --> SW
    B3 --> SW
    B4 --> SW
    B5 --> SW
    
    SW --> C1
    SW --> C2
    
    SW --> D1
    SW --> D2
    SW --> D3
    SW --> D4
    SW --> D5
    SW --> D6
    SW --> D7
    SW --> D8
    
    E1 --> SW
    E2 --> SW
    E3 --> SW
    E4 --> SW
    E5 --> SW
    E6 --> SW
    
    style SW fill:#e1f5ff
```

### Request/Response Patterns

**Async Request Pattern:**
```mermaid
sequenceDiagram
    participant C as Content Script
    participant S as Service Worker
    participant L as LLM Provider
    
    C->>S: chrome.runtime.sendMessage(request)
    Note over S: Return true to keep channel open
    S->>S: Process request asynchronously
    S->>L: Fetch API call
    L-->>S: Response
    S->>S: Process response
    S->>C: sendResponse(response)
    Note over C: Response received via callback
```

**Message Validation:**
```typescript
function isValidMessage(message: unknown): message is Message {
  if (!message || typeof message !== 'object') return false;
  const msg = message as Partial<Message>;
  if (!msg.type || !Object.values(MessageType).includes(msg.type)) {
    return false;
  }
  if (msg.payload === undefined) {
    return false;
  }
  return true;
}
```

### Correlation ID Tracking

**Purpose**: Match requests with responses across async operations.

**Implementation:**
```typescript
// Generate unique correlation ID
const correlationId = `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;

// Attach to request metadata
const message = createMessage(MessageType.USER_COMMAND, payload, {
  correlationId
});

// Track pending requests
const pendingRequests = new Map<string, PendingRequest>();
pendingRequests.set(correlationId, {
  timestamp: Date.now(),
  tabId: sender.tab?.id
});

// Cleanup on response
pendingRequests.delete(correlationId);
```

---

## Security Architecture

### Trust Boundaries

```mermaid
graph TD
    subgraph "Trusted Zone"
        SW[Service Worker]
        LLM[LLM Adapter]
    end
    
    subgraph "Semi-Trusted Zone"
        CS[Content Scripts]
        SP[Side Panel]
    end
    
    subgraph "Untrusted Zone"
        Page[Pega Infinity Page]
        External[External LLM APIs]
    end
    
    CS <-->|Tokenized Data| SW
    CS <-->|DOM Access| Page
    SW <-->|Encrypted API Calls| External
    SP <-->|User Commands| SW
    
    CS -.->|Raw PII| SW
    SW -.->|Raw PII| External
    
    style SW fill:#e8f5e9
    style LLM fill:#e8f5e9
    style CS fill:#fff9c4
    style SP fill:#fff9c4
    style Page fill:#ffebee
    style External fill:#ffebee
```

**Trust Rules:**
1. **Service Worker**: ONLY component that can call external APIs
2. **Content Scripts**: Can read DOM but MUST mask PII before sending
3. **Side Panel**: UI only, no direct DOM access
4. **External APIs**: Never receive raw PII

### PII Masking Flow

```mermaid
sequenceDiagram
    participant DOM as Pega DOM
    participant CS as Content Script
    participant PM as PII Masker
    participant SW as Service Worker
    participant LLM as LLM Provider
    
    DOM->>CS: Raw field value<br/>"John Doe"
    CS->>PM: classify("FirstName", "Field_FirstName")
    PM-->>CS: { piiCategory: "NAME", ... }
    CS->>PM: mask("John Doe", "NAME")
    PM->>PM: Check category enabled
    PM->>PM: Generate token "{NAME_1}"
    PM->>PM: Store "John Doe" in memory map
    PM-->>CS: "{NAME_1}"
    CS->>SW: DOM_SNAPSHOT with "{NAME_1}"
    SW->>LLM: API call with "{NAME_1}"
    LLM-->>SW: ActionPlan with "{NAME_1}"
    SW->>CS: EXECUTE_ACTION with "{NAME_1}"
    CS->>PM: resolve("{NAME_1}")
    PM-->>CS: "John Doe"
    CS->>DOM: Type "John Doe" into field
    
    Note over PM: Memory map cleared on tab close
```

**PII Categories:**
- **NAME**: First name, last name, full name
- **SSN**: Social security number, tax ID, national ID
- **DOB**: Date of birth, birth date
- **EMAIL**: Email addresses
- **PHONE**: Phone numbers, mobile, fax
- **ACCOUNT**: Account numbers, card numbers, policy numbers
- **ADDRESS**: Street addresses, city, state, zip
- **INCOME**: Salary, wages, financial amounts

**Configuration:**
```typescript
const securityConfig: SecurityConfig = {
  piiMaskingEnabled: true,
  piiCategoriesToMask: ['NAME', 'SSN', 'DOB', 'EMAIL', 'PHONE', 'ACCOUNT', 'ADDRESS', 'INCOME'],
  localProcessingOnly: false,
  allowedLLMProviders: ['anthropic', 'azure-openai'],
  auditLoggingEnabled: true,
  requireConfirmationForAllActions: false,
  disabledCapabilities: []
};
```

### Tokenization Strategy

**Token Format:** `{CATEGORY_NUMBER}`

**Examples:**
- `{NAME_1}` → "John Doe"
- `{SSN_1}` → "123-45-6789"
- `{EMAIL_1}` → "john.doe@example.com"
- `{ACCOUNT_1}` → "CC-4111-1111-1111-1111"

**Deduplication:**
```typescript
// Same value gets same token
mask("John Doe", "NAME")  // → "{NAME_1}"
mask("John Doe", "NAME")  // → "{NAME_1}" (deduplicated)

// Different values get different tokens
mask("Jane Smith", "NAME")  // → "{NAME_2}"
```

**Memory Map Structure:**
```typescript
Map<string, Map<string, string>> {
  "NAME": Map {
    "{NAME_1}": "John Doe",
    "{NAME_2}": "Jane Smith"
  },
  "SSN": Map {
    "{SSN_1}": "123-45-6789"
  }
}
```

**Security Guarantees:**
- ✅ Memory map NEVER persisted to disk
- ✅ Tokens ONLY resolved in content script
- ✅ Map cleared on `unload` event
- ✅ Map cleared on configuration change
- ✅ No API to retrieve raw values from memory

---

## State Management

### Session Store Architecture

```mermaid
graph TD
    subgraph "Chrome Storage"
        SS[chrome.storage.session]
    end
    
    subgraph "Session Store API"
        A[initSession]
        B[getContext]
        C[updateSnapshot]
        D[getSnapshot]
        E[setPendingPlan]
        F[getPendingPlan]
        G[cacheSummary]
        H[getCachedSummary]
        I[invalidateSummaryCache]
        J[clearSession]
    end
    
    subgraph "Stored Data"
        S1[SessionContext]
        S2[DOMSnapshot]
        S3[ActionPlan]
        S4[CaseSummary Cache]
    end
    
    A --> S1
    B --> S1
    C --> S2
    D --> S2
    E --> S3
    F --> S3
    G --> S4
    H --> S4
    I --> S4
    J --> SS
    
    S1 --> SS
    S2 --> SS
    S3 --> SS
    S4 --> SS
    
    style SS fill:#e1f5ff
    style S1 fill:#e8f5e9
    style S2 fill:#fff9c4
    style S3 fill:#ffe0b2
    style S4 fill:#f3e5f5
```

**Storage Keys:**
```typescript
// Per-tab namespacing
const keys = {
  context: `session:${tabId}:context`,
  snapshot: `session:${tabId}:snapshot`,
  pendingPlan: `session:${tabId}:pendingPlan`,
  summaryCache: `session:${tabId}:summaryCache`
};
```

**Lifecycle:**
```mermaid
stateDiagram-v2
    [*] --> Created: Tab opens
    Created --> Initializing: Pega detected
    Initializing --> Active: Session initialized
    Active --> Active: State updates
    Active --> Destroyed: Tab closed
    Destroyed --> [*]
    
    note right of Active
        chrome.storage.session
        cleared on browser close
    end note
```

### Cache Invalidation

**Summary Cache Strategy:**
```mermaid
graph TD
    A[Summary Request] --> B{Cache Hit?}
    B -->|Yes| C{Timestamp Valid?}
    B -->|No| D[Generate New]
    C -->|Yes| E[Return Cached]
    C -->|No| F[Invalidate Cache]
    F --> D
    D --> G[Store in Cache]
    G --> H[Return Summary]
    
    E --> I[Return Cached]
    H --> J[Invalidate on Actions]
    J --> K[Clear Cache Entry]
    
    style E fill:#e8f5e9
    style I fill:#e8f5e9
    style K fill:#ffebee
```

**Invalidation Triggers:**
1. Action execution completes
2. DOM snapshot changes significantly
3. Manual cache clear request
4. Configuration change

**Cache Key Format:**
```typescript
`${caseId}:${snapshotHash}`
```

### Cross-Tab Isolation

```mermaid
graph LR
    subgraph "Tab 1"
        T1S[Session 1]
        T1D[Data 1]
    end
    
    subgraph "Tab 2"
        T2S[Session 2]
        T2D[Data 2]
    end
    
    subgraph "Shared Storage"
        SS[chrome.storage.session]
    end
    
    T1S <-->|Key: session:1:*| SS
    T2S <-->|Key: session:2:*| SS
    
    T1D -.->|No Access| T2D
    T2D -.->|No Access| T1D
    
    style T1S fill:#e8f5e9
    style T2S fill:#fff9c4
    style SS fill:#e1f5ff
```

**Isolation Guarantees:**
- ✅ Each tab has unique `tabId`
- ✅ All storage keys namespaced by `tabId`
- ✅ No cross-tab data leakage
- ✅ Tab cleanup on `chrome.tabs.onRemoved`

---

## MCP Server

### Protocol Implementation

**Model Context Protocol (MCP)** - Standard for AI tool integration.

```mermaid
graph TD
    subgraph "MCP Server"
        S[Server]
        T[Tools]
        R[Resources]
        P[Prompts]
    end
    
    subgraph "MCP Clients"
        C1[Claude Desktop]
        C2[Cursor IDE]
        C3[Custom Client]
    end
    
    subgraph "Pega Extension"
        E[Service Worker]
        CS[Content Scripts]
    end
    
    C1 <-->|JSON-RPC 2.0| S
    C2 <-->|JSON-RPC 2.0| S
    C3 <-->|JSON-RPC 2.0| S
    
    S <-->|Tool Calls| E
    S <-->|Resource Access| E
    S <-->|Prompt Templates| E
    
    E <-->|DOM Commands| CS
    
    style S fill:#e1f5ff
    style E fill:#fff9c4
    style CS fill:#e8f5e9
```

**JSON-RPC Message Format:**
```typescript
// Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pega_get_case_summary",
    "arguments": {
      "includePII": false
    }
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "{...summary data...}"
      }
    ]
  }
}
```

### Tool and Resource Handlers

**Available Tools:**
```mermaid
graph TD
    A[MCP Tools] --> B[pega_get_case_summary]
    A --> C[pega_execute_action_plan]
    A --> D[pega_get_dom_snapshot]
    A --> E[pega_detect_framework]
    A --> F[pega_update_field]
    A --> G[pega_click_action]
    A --> H[pega_navigate_case]
    A --> I[pega_wait_for]
    
    B --> J[Generate Summary]
    C --> K[Execute Actions]
    D --> L[Capture DOM]
    E --> M[Detect Pega]
    F --> N[Update Field]
    G --> O[Click Button]
    H --> P[Navigate]
    I --> Q[Wait Condition]
    
    style A fill:#e1f5ff
    style J fill:#e8f5e9
    style K fill:#fff9c4
```

**Available Resources:**
```mermaid
graph LR
    A[MCP Resources] --> B[pega://current-case]
    A --> C[pega://case-history]
    A --> D[pega://available-actions]
    
    B --> E[Current Case Data]
    C --> F[Audit Log]
    D --> G[Action Buttons]
    
    style A fill:#e1f5ff
    style E fill:#e8f5e9
    style F fill:#fff9c4
    style G fill:#ffe0b2
```

### Client Connection Management

**Connection Lifecycle:**
```mermaid
stateDiagram-v2
    [*] --> Listening: chrome.runtime.onConnectExternal
    Listening --> Connected: Client connects
    Connected --> Initialized: initialize handshake
    Initialized --> Ready: Capabilities exchanged
    
    Ready --> Ready: Processing requests
    
    Ready --> Disconnected: Client disconnects
    Disconnected --> [*]
    
    note right of Ready
        Registered handlers:
        - tools/list
        - tools/call
        - resources/list
        - resources/read
        - prompts/list
        - prompts/get
    end note
```

**Multi-Client Support:**
```typescript
class MCPServer {
  private clients = new Map<string, MCPClientConnection>()
  
  addClient(clientId: string, port?: chrome.runtime.Port): void {
    this.clients.set(clientId, {
      id: clientId,
      port: port ?? null,
      capabilities: {}
    });
  }
  
  removeClient(clientId: string): void {
    this.clients.delete(clientId)
  }
  
  broadcastNotification(method: string, params?: Record<string, unknown>): void {
    for (const [_clientId, client] of this.clients) {
      if (client.port) {
        client.port.postMessage({ jsonrpc: '2.0', method, params });
      }
    }
  }
}
```

---

## Technology Choices

### Why TypeScript

**Type Safety:**
```typescript
// Catch errors at compile time
interface ActionPlan {
  planId: string;
  intent: IntentType;
  steps: PlanStep[];
  // ... more fields
}

// Type-safe message passing
function handleMessage(message: Message<UserCommandPayload>) {
  // payload is properly typed
  const command = message.payload.command;  // string
}
```

**Benefits:**
- ✅ Eliminates entire classes of runtime errors
- ✅ Excellent IDE support (autocomplete, refactoring)
- ✅ Self-documenting code
- ✅ Easier maintenance for large codebases

**No `any` Types Rule:**
```typescript
// ❌ Bad
function processData(data: any) { ... }

// ✅ Good
function processData(data: DOMSnapshot) { ... }
```

### Why Manifest V3

**Security Improvements over V2:**
```mermaid
graph TD
    subgraph "Manifest V2"
        V2B[Background Pages]
        V2R[Remote Code]
        V2P[Persistent State]
    end
    
    subgraph "Manifest V3"
        V3S[Service Workers]
        V3A[Content Security Policy]
        V3E[Action Handlers]
    end
    
    V2B -.->|Deprecated| V3S
    V2R -.->|Blocked| V3A
    V2P -.->|Ephemeral| V3E
    
    style V3S fill:#e8f5e9
    style V3A fill:#e8f5e9
    style V3E fill:#e8f5e9
```

**Key Features:**
- **Service Workers**: Event-driven, non-persistent background scripts
- **CSP Level 3**: Stricter content security policies
- **Action Handlers**: Declarative user action handling
- **Host Permissions**: Granular permission model

**Migration Benefits:**
- ✅ Better performance (no persistent background page)
- ✅ Enhanced security (CSP restrictions)
- ✅ Future-proof (Chrome requirement)
- ✅ Cross-browser compatibility

### LLM Provider Abstraction

**Provider Interface:**
```typescript
interface ProviderConfig {
  url: (config: LLMConfig) => string;
  headers: (config: LLMConfig) => Record<string, string>;
  body: (config: LLMConfig, systemPrompt: string, userPrompt: string) => unknown;
  parseResponse: (data: unknown) => { content: string; tokensUsed: number };
}
```

**Supported Providers:**
```mermaid
graph TD
    A[LLM Adapter] --> B[Anthropic Claude]
    A --> C[Azure OpenAI]
    A --> D[OpenAI GPT]
    A --> E[Google Gemini]
    A --> F[Mistral]
    A --> G[Local Endpoints]
    
    B --> H[Provider Config]
    C --> H
    D --> H
    E --> H
    F --> H
    G --> H
    
    H --> I[Unified Interface]
    
    style A fill:#e1f5ff
    style I fill:#e8f5e9
```

**Benefits:**
- ✅ **Vendor Independence**: Switch providers without code changes
- ✅ **Automatic Fallback**: Try backup providers on failure
- ✅ **Cost Optimization**: Route requests by priority/cost
- ✅ **Hybrid Deployment**: Mix cloud and local models
- ✅ **Compliance**: Meet data residency requirements

**Configuration Example:**
```typescript
// Multi-provider with fallback
const config: MultiLLMConfig = {
  providers: [
    {
      provider: 'anthropic',
      priority: 1,  // Try first
      enabled: true
    },
    {
      provider: 'azure-openai',
      priority: 2,  // Fallback
      enabled: true
    }
  ],
  fallbackEnabled: true,
  maxRetries: 2
};
```

---

## Appendix

### Mermaid Diagram Syntax Reference

**Quick Reference:**
- `graph TD`: Top-down diagram
- `graph LR`: Left-right diagram
- `sequenceDiagram`: Sequence diagram
- `stateDiagram-v2`: State diagram
- `subgraph`: Group related nodes
- `style`: Apply colors/styles

### Type Definitions

**Core Types Location:** `/src/shared/types.ts`

**Message Types Location:** `/src/shared/message-types.ts`

**MCP Types Location:** `/src/shared/mcp-types.ts`

### Configuration Files

**Manifest:** `/manifest.json` - Extension configuration

**Package:** `/package.json` - Dependencies and scripts

**TypeScript:** `/tsconfig.json` - Compiler configuration

**Webpack:** `/webpack.config.js` - Build configuration

---

## Related Documentation

- [Developer Guide](/docs/developer-guide.md)
- [API Documentation](/docs/api.md)
- [Security Documentation](/docs/security.md)
- [Migration Guide](/docs/migration.md)

---

*Last Updated: 2026-05-10*
*Version: 1.0.0*
