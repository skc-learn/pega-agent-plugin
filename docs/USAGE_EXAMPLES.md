# Usage Examples - Pega Browser Agent

Practical examples and workflows for the Pega Case Management Browser Agent.

## Table of Contents

1. [Natural Language Commands](#natural-language-commands)
2. [Configuration Examples](#configuration-examples)
3. [Workflow Examples](#workflow-examples)
4. [MCP Integration](#mcp-integration)
5. [Common Use Cases](#common-use-cases)
6. [Troubleshooting Examples](#troubleshooting-examples)

---

## Natural Language Commands

### Supported Intents Overview

The agent supports 11 primary intents across three categories:

| Intent | Category | LLM Required | Confidence |
|--------|----------|--------------|------------|
| SUMMARIZE_CASE | Information | No | 95% |
| SHOW_QUEUE | Information | No | 90% |
| EXPLAIN | Information | Yes | 80% |
| SAVE_CASE | Action | No | 90% |
| NEXT_STEP | Action | No | 90% |
| SUBMIT_CASE | Action | No | 90% |
| UPDATE_FIELD | Action | Yes | 80% |
| ESCALATE | Action | Yes | 85% |
| CREATE_CASE | Navigation | Yes | 85% |
| OPEN_CASE | Navigation | Yes | 85% |
| SEARCH | Navigation | Yes | 80% |

### 1. SUMMARIZE_CASE

Generate comprehensive 4-part case summaries.

#### Example Commands

```bash
# Direct commands
"Summarize this case"
"Give me a summary"
"What's this case about?"
"Brief me on this case"
"Catch me up"

# Context-aware
"Summarize the loan application case"
"What's the status of this insurance claim?"
```

#### Before/After

**Before**: Manually reading through 15+ fields, history tab, and notes to understand case context (3-5 minutes).

**After**: Instant summary with:
- Current situation and status
- Key field values and data points
- Recent history and actions taken
- Risk signals and concerns
- Recommended next actions

#### Expected Output

```json
{
  "caseId": "LOAN-2024-001234",
  "caseType": "Mortgage Application",
  "situation": "Customer applying for $450,000 conventional mortgage for property at 123 Oak Street. Application submitted 3 days ago, currently in underwriting review stage.",
  "history": "Application received → Document verification complete → Income verification complete → Currently in underwriting review",
  "currentState": "Stage: Underwriting Review | Status: Pending-Documentation | Urgency: Medium | AssignedTo: Sarah Chen",
  "riskSignals": [
    "Debt-to-income ratio at 43% (near threshold)",
    "Missing employment verification for secondary income",
    "Property appraisal not yet received"
  ],
  "recommendedNextAction": "Request employment verification and follow up on appraisal status"
}
```

#### Notes

- Runs locally without LLM for speed
- Automatically triggered on case open
- PII is masked before any external processing
- Confidence: 95%

---

### 2. SHOW_QUEUE

Display your work queue and case list.

#### Example Commands

```bash
# Direct commands
"My queue"
"Show my queue"
"What's in my queue?"
"My cases"
"Show my work"
```

#### Before/After

**Before**: Navigate to work queue, wait for page load, scan through list (30-60 seconds).

**After**: Instant display of:
- Your assigned cases
- Case priorities and SLA status
- Case types and brief descriptions
- Quick navigation to any case

#### Expected Output

```
Your Work Queue (12 cases):

1. LOAN-2024-001234 - Mortgage Application - High Priority - SLA breached
2. CLAIM-2024-005678 - Auto Insurance Claim - Medium Priority - Due in 2 hours
3. SRV-2024-009012 - Service Request - Low Priority - Due tomorrow
4. LOAN-2024-001235 - Home Equity Line - High Priority - SLA at risk
...
```

#### Notes

- Local intent (no LLM required)
- Shows cases across all work baskets
- Quick navigation to any case
- Confidence: 90%

---

### 3. EXPLAIN

Get explanations about case logic, workflows, or field relationships.

#### Example Commands

```bash
# Explanations
"Why is this case escalated?"
"Explain the underwriting process"
"Tell me about the approval workflow"
"Why is the SLA breached?"
"Explain the risk assessment"
```

#### Before/After

**Before**: Search documentation, ask colleagues, or navigate through multiple screens (5-10 minutes).

**After**: Contextual explanation based on current case state and Pega domain knowledge.

#### Expected Output

```json
{
  "explanation": "This case is automatically escalated because: 1) Debt-to-income ratio exceeds 42% threshold, 2) Loan amount exceeds $400,000 (high-value threshold), 3) Customer is self-employed (requires additional verification). These conditions trigger the 'High-Risk Loan' escalation rule per RB_UnderwritingEscalation policy.",
  "relatedFields": ["DebtToIncomeRatio", "LoanAmount", "EmploymentStatus"],
  "nextSteps": ["Verify additional income documentation", "Review property appraisal", "Make underwriting decision"]
}
```

#### Notes

- Requires LLM for complex reasoning
- Uses Pega domain knowledge
- Context-aware explanations
- Confidence: 80%

---

### 4. SAVE_CASE

Save the current case state.

#### Example Commands

```bash
# Direct commands
"Save"
"Save changes"
"Save and continue"
```

#### Before/After

**Before**: Locate and click Save button, wait for confirmation (5-10 seconds).

**After**: Instant save with visual confirmation.

#### Expected Outcome

- Case data persisted
- Confirmation message displayed
- Case remains open for continued work
- Audit log updated

#### Notes

- Local intent (no LLM)
- Confidence: 90%
- No confirmation required (safe action)

---

### 5. NEXT_STEP

Proceed to the next step in the case lifecycle.

#### Example Commands

```bash
# Direct commands
"Next"
"Next step"
"Continue"
"Proceed"
"Move forward"
```

#### Before/After

**Before**: Identify next action, locate button, click, wait for navigation (10-15 seconds).

**After**: Intelligent progression based on case context.

#### Expected Outcome

- Advances case to next stage
- Updates case status
- Navigates to next assignment
- Shows confirmation

#### Notes

- Local intent
- Confidence: 90%
- Understands Pega flow patterns

---

### 6. SUBMIT_CASE

Submit the current case for processing.

#### Example Commands

```bash
# Direct commands
"Submit"
"Submit this case"
"Complete this case"
"Finish case"
"Close case"
```

#### Before/After

**Before**: Review all fields, click Submit, wait for confirmation (15-30 seconds).

**After**: Validated submission with confirmation.

#### Expected Outcome

- Case validation performed
- Submission executed
- Confirmation displayed
- Case navigated to next assignment
- Audit log updated

#### Notes

- Local intent
- **Requires confirmation** (irreversible action)
- Confidence: 90%
- Performs validation before submission

---

### 7. UPDATE_FIELD

Update case field values.

#### Example Commands

```bash
# Status updates
"Update the status to Pending-Documentation"
"Set status to Approved"
"Change status to Rejected"

# Priority updates
"Update priority to High"
"Set priority to Critical"
"Change priority to Medium"

# Field updates
"Update the amount to 50000"
"Set the decision to Approved"
"Fill in the notes with 'Customer called, requesting extension'"
"Enter 'Review complete' in the status field"
"Put 'Approved' in the decision field"

# Conditional updates
"Update status to Approved if all documents are verified"
"Set priority to High if SLA is breached"
```

#### Before/After

**Before**: Locate field, click into it, clear existing value, type new value, press Enter, wait for save (20-30 seconds).

**After**: Intelligent field update with validation.

#### Expected Outcome

```json
{
  "plan": {
    "summary": "Update status to Pending-Documentation",
    "steps": [
      {
        "stepNumber": 1,
        "action": "CLICK",
        "selector": "[data-test-id='Status']",
        "description": "Click Status field"
      },
      {
        "stepNumber": 2,
        "action": "TYPE",
        "selector": "[data-test-id='Status'] input",
        "value": "Pending-Documentation",
        "description": "Type 'Pending-Documentation'"
      },
      {
        "stepNumber": 3,
        "action": "SAVE_CASE",
        "description": "Save changes"
      }
    ]
  },
  "requiresConfirmation": true
}
```

#### Notes

- Requires LLM for field identification
- Smart field matching using labels, test IDs, semantic context
- **Requires confirmation** by default
- Confidence: 80%

---

### 8. ESCALATE

Transfer or assign case to another user/work queue.

#### Example Commands

```bash
# Escalation
"Escalate to supervisor"
"Escalate this to underwriting manager"
"Transfer to senior underwriter"

# Assignment
"Assign to John Smith"
"Route to work queue 'High-Priority-Loans'"
"Assign to team lead"
```

#### Before/After

**Before**: Navigate to assignment, search for user/work queue, select, click Assign (30-45 seconds).

**After**: Smart escalation with context preservation.

#### Expected Outcome

```json
{
  "plan": {
    "summary": "Escalate to supervisor",
    "steps": [
      {
        "stepNumber": 1,
        "action": "CLICK",
        "selector": "[data-test-id='Actions-Escalate']",
        "description": "Click Escalate action"
      },
      {
        "stepNumber": 2,
        "action": "SELECT",
        "selector": "[data-test-id='AssignTo']",
        "value": "Supervisor",
        "description": "Select Supervisor from dropdown"
      },
      {
        "stepNumber": 3,
        "action": "TYPE",
        "selector": "[data-test-id='EscalationNotes']",
        "value": "High DTI ratio, missing documentation, please review",
        "description": "Add escalation notes"
      },
      {
        "stepNumber": 4,
        "action": "CLICK",
        "selector": "[data-test-id='ConfirmEscalate']",
        "description": "Confirm escalation"
      }
    ]
  },
  "requiresConfirmation": true
}
```

#### Notes

- Requires LLM
- Understands organizational hierarchy
- Preserves case context
- **Requires confirmation**
- Confidence: 85%

---

### 9. CREATE_CASE

Create a new case instance.

#### Example Commands

```bash
# Direct creation
"Create a new case"
"Open a new loan application"
"Start a new insurance claim"
"Create a service request"

# Contextual creation
"Create a new mortgage application for John Smith"
"Open a new auto claim for policy POL-123456"
```

#### Before/After

**Before**: Navigate to case type, click Create, fill initial fields, wait for creation (45-60 seconds).

**After**: Intelligent case creation with pre-populated data.

#### Expected Outcome

```json
{
  "plan": {
    "summary": "Create new mortgage application",
    "steps": [
      {
        "stepNumber": 1,
        "action": "NAVIGATE",
        "selector": "a[href*='LoanApplication']",
        "description": "Navigate to Loan Application work object"
      },
      {
        "stepNumber": 2,
        "action": "CLICK",
        "selector": "[data-test-id='Create']",
        "description": "Click Create button"
      },
      {
        "stepNumber": 3,
        "action": "TYPE",
        "selector": "[data-test-id='CustomerName']",
        "value": "John Smith",
        "description": "Enter customer name"
      }
    ]
  },
  "requiresConfirmation": true
}
```

#### Notes

- Requires LLM
- Understands case types and hierarchies
- **Requires confirmation**
- Confidence: 85%

---

### 10. OPEN_CASE

Navigate to a specific case.

#### Example Commands

```bash
# By case ID
"Open case LOAN-2024-001234"
"Go to case CLAIM-2024-005678"
"Find case SRV-2024-009012"

# By context
"Open the most recent loan application"
"Go to the high-priority claim"
```

#### Before/After

**Before**: Search for case, open from list, wait for load (20-30 seconds).

**After**: Direct navigation with automatic summary generation.

#### Expected Outcome

```json
{
  "plan": {
    "summary": "Open case LOAN-2024-001234",
    "steps": [
      {
        "stepNumber": 1,
        "action": "NAVIGATE",
        "selector": "input[placeholder='Search cases']",
        "value": "LOAN-2024-001234",
        "description": "Search for case"
      },
      {
        "stepNumber": 2,
        "action": "CLICK",
        "selector": "a[href*='LOAN-2024-001234']",
        "description": "Click case result"
      }
    ]
  },
  "requiresConfirmation": false
}
```

#### Notes

- Requires LLM for case identification
- Auto-generates summary on open
- Confidence: 85%

---

### 11. SEARCH

Search for cases matching criteria.

#### Example Commands

```bash
# Field-based search
"Find cases with status 'Pending-Documentation'"
"Search for high-priority loan applications"
"Look up cases assigned to John Smith"
"Show me cases with breached SLA"

# Complex searches
"Find mortgage applications over $400,000"
"Search for claims submitted this week"
"Find cases with missing documentation"
```

#### Before/After

**Before**: Navigate to search, build filters, run search, review results (45-60 seconds).

**After**: Natural language search with intelligent filtering.

#### Expected Outcome

```json
{
  "plan": {
    "summary": "Search for high-priority loan applications",
    "steps": [
      {
        "stepNumber": 1,
        "action": "NAVIGATE",
        "selector": "a[href*='CaseSearch']",
        "description": "Navigate to case search"
      },
      {
        "stepNumber": 2,
        "action": "TYPE",
        "selector": "[data-test-id='CaseType']",
        "value": "Loan Application",
        "description": "Select case type"
      },
      {
        "stepNumber": 3,
        "action": "SELECT",
        "selector": "[data-test-id='Priority']",
        "value": "High",
        "description": "Select High priority"
      },
      {
        "stepNumber": 4,
        "action": "CLICK",
        "selector": "[data-test-id='Search']",
        "description": "Run search"
      }
    ]
  },
  "requiresConfirmation": false
}
```

#### Notes

- Requires LLM
- Translates natural language to search filters
- Confidence: 80%

---

## Configuration Examples

### Default Configuration

Edit `config/default-config.ts`:

```typescript
export const DEFAULT_CONFIG: EnterpriseConfig = {
  version: '1.0',

  security: {
    piiMaskingEnabled: true,
    piiCategoriesToMask: ['NAME', 'SSN', 'DOB', 'EMAIL', 'PHONE', 'ACCOUNT', 'ADDRESS', 'INCOME'],
    localProcessingOnly: false,
    allowedLLMProviders: ['azure-openai', 'openai', 'anthropic', 'mistral'],
    auditLoggingEnabled: true,
    requireConfirmationForAllActions: false,
    disabledCapabilities: [],
  },

  llm: {
    provider: 'anthropic',
    endpoint: 'https://api.anthropic.com',
    model: 'claude-sonnet-4-20250514',
    maxTokens: 1500,
    temperature: 0.1,
    apiKey: undefined,
  },

  pega: {
    targetDomains: [], // Empty = detect any Pega app via DOM signals
    useDirectAPI: false, // Rung 1 — DOM automation only
    cdh: {
      enabled: false,
    },
  },

  roleRestrictions: {
    caseWorker: [
      'SUMMARIZE_CASE',
      'UPDATE_FIELD',
      'SAVE_CASE',
      'NEXT_STEP',
      'SHOW_QUEUE',
      'SEARCH',
      'EXPLAIN',
    ],
    supervisor: ['*'],
    readOnly: ['SUMMARIZE_CASE', 'SHOW_QUEUE', 'EXPLAIN'],
  },
};
```

---

### Role-Based Access Control

Configure permissions by user role:

```typescript
roleRestrictions: {
  // Entry-level case workers - limited actions
  caseWorker: [
    'SUMMARIZE_CASE',    // Can view summaries
    'SHOW_QUEUE',        // Can view their queue
    'EXPLAIN',           // Can get explanations
    'SAVE_CASE',         // Can save cases
  ],

  // Senior case workers - more actions
  seniorCaseWorker: [
    'SUMMARIZE_CASE',
    'SHOW_QUEUE',
    'EXPLAIN',
    'SAVE_CASE',
    'UPDATE_FIELD',      // Can update fields
    'NEXT_STEP',         // Can advance cases
    'SEARCH',            // Can search cases
  ],

  // Supervisors - full access except create
  supervisor: [
    'SUMMARIZE_CASE',
    'SHOW_QUEUE',
    'EXPLAIN',
    'SAVE_CASE',
    'UPDATE_FIELD',
    'NEXT_STEP',
    'SEARCH',
    'SUBMIT_CASE',       // Can submit cases
    'ESCALATE',          // Can escalate cases
  ],

  // Managers - all access
  manager: ['*'],

  // Read-only auditors - view only
  auditor: [
    'SUMMARIZE_CASE',
    'SHOW_QUEUE',
    'EXPLAIN',
  ],
}
```

#### Example Usage Scenario

**Problem**: New case workers should not be able to submit or escalate cases until they complete training.

**Solution**:

```typescript
roleRestrictions: {
  trainee: [
    'SUMMARIZE_CASE',
    'SHOW_QUEUE',
    'EXPLAIN',
  ],
  // After training, update role to 'caseWorker' with additional permissions
}
```

---

### LLM Provider Configuration

#### Single Provider (Anthropic Claude)

```typescript
llm: {
  provider: 'anthropic',
  endpoint: 'https://api.anthropic.com',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 1500,
  temperature: 0.1,
  apiKey: 'your-api-key-here',
}
```

#### Azure OpenAI

```typescript
llm: {
  provider: 'azure-openai',
  endpoint: 'https://your-resource.openai.azure.com/',
  model: 'gpt-4',
  apiVersion: '2024-02-15-preview',
  maxTokens: 1500,
  temperature: 0.1,
  apiKey: 'your-azure-api-key',
}
```

#### Multi-Provider with Fallback

```typescript
llmMulti: {
  providers: [
    {
      provider: 'anthropic',
      endpoint: 'https://api.anthropic.com',
      model: 'claude-sonnet-4-20250514',
      maxTokens: 1500,
      temperature: 0.1,
      apiKey: 'your-anthropic-key',
      priority: 1, // Try first
    },
    {
      provider: 'azure-openai',
      endpoint: 'https://your-resource.openai.azure.com/',
      model: 'gpt-4',
      apiVersion: '2024-02-15-preview',
      maxTokens: 1500,
      temperature: 0.1,
      apiKey: 'your-azure-key',
      priority: 2, // Fallback
    },
  ],
  fallbackEnabled: true,
  maxRetries: 2,
  timeoutMs: 30000,
}
```

#### Local LLM (Ollama)

```typescript
llm: {
  provider: 'local',
  endpoint: 'http://localhost:11434',
  model: 'llama2',
  maxTokens: 1500,
  temperature: 0.1,
}
```

---

### PII Category Customization

Configure which PII categories to mask:

```typescript
security: {
  piiMaskingEnabled: true,
  piiCategoriesToMask: [
    'NAME',      // Full names
    'SSN',       // Social Security Numbers
    'DOB',       // Dates of Birth
    'EMAIL',     // Email addresses
    'PHONE',     // Phone numbers
    'ACCOUNT',   // Account numbers
    'ADDRESS',   // Street addresses
    'INCOME',    // Income/financial data
    // Custom categories can be added
    'CREDIT_CARD', // Credit card numbers
    'DRIVERS_LICENSE', // Driver's license numbers
    'PASSPORT',   // Passport numbers
  ],
}
```

#### Example: Financial Services Use Case

**Problem**: Mortgage applications require strict PII masking for compliance.

**Solution**:

```typescript
security: {
  piiMaskingEnabled: true,
  piiCategoriesToMask: [
    'NAME',      // Borrower names
    'SSN',       // SSNs
    'DOB',       // Birth dates
    'INCOME',    // Income, assets
    'ACCOUNT',   // Bank account numbers
    'ADDRESS',   // Property addresses
  ],
  localProcessingOnly: false, // Allow LLM with masking
  allowedLLMProviders: ['azure-openai'], // Only Azure (enterprise)
}
```

---

### Domain Restrictions

Restrict agent to specific Pega applications:

```typescript
pega: {
  // Only work on these domains
  targetDomains: [
    'https://mortgage-app.pegacloud.io',
    'https://loans-portal.pega.com',
    'https://underwriting.pegacloud.io',
  ],
  useDirectAPI: false,
}
```

#### Example: Single Application Deployment

**Problem**: Deploy agent only for the Mortgage Application system.

**Solution**:

```typescript
pega: {
  targetDomains: [
    'https://mortgage-app.pegacloud.io',
  ],
  useDirectAPI: false,
}
```

**Result**: Agent only activates on the mortgage application domain.

---

### Security-First Configuration

Maximum security configuration:

```typescript
security: {
  piiMaskingEnabled: true,
  piiCategoriesToMask: ['NAME', 'SSN', 'DOB', 'EMAIL', 'PHONE', 'ACCOUNT', 'ADDRESS', 'INCOME'],
  localProcessingOnly: true, // NO external LLM calls
  allowedLLMProviders: [], // Empty = no LLM access
  auditLoggingEnabled: true,
  requireConfirmationForAllActions: true, // Confirm EVERY action
  disabledCapabilities: [
    'SUBMIT_CASE', // Disable irreversible actions
    'DELETE_CASE',
  ],
},
```

**Use Case**: Highly sensitive environments (healthcare, government).

---

## Workflow Examples

### Multi-Step Automation

#### Example: Loan Application Intake Workflow

**Problem**: New loan applications require 8-10 repetitive steps.

**Solution**: Create a workflow that automates intake.

```typescript
const loanIntakeWorkflow: Workflow = {
  workflowId: 'loan-intake-v1',
  name: 'Loan Application Intake',
  description: 'Automated intake for new loan applications',
  trigger: {
    type: 'manual',
  },
  steps: [
    {
      id: 'step-1',
      stepNumber: 1,
      action: 'CLICK',
      selector: '[data-test-id="CreateCase"]',
      description: 'Click Create Case',
      isReversible: false,
    },
    {
      id: 'step-2',
      stepNumber: 2,
      action: 'WAIT_FOR_VISIBLE',
      selector: '[data-test-id="CaseType"]',
      description: 'Wait for case type dropdown',
      isReversible: true,
    },
    {
      id: 'step-3',
      stepNumber: 3,
      action: 'SELECT',
      selector: '[data-test-id="CaseType"]',
      value: 'Mortgage Application',
      description: 'Select Mortgage Application',
      isReversible: true,
    },
    {
      id: 'step-4',
      stepNumber: 4,
      action: 'TYPE',
      selector: '[data-test-id="CustomerName"]',
      value: '${customerName}', // Variable
      description: 'Enter customer name',
      isReversible: true,
    },
    {
      id: 'step-5',
      stepNumber: 5,
      action: 'TYPE',
      selector: '[data-test-id="LoanAmount"]',
      value: '${loanAmount}', // Variable
      description: 'Enter loan amount',
      isReversible: true,
    },
    {
      id: 'step-6',
      stepNumber: 6,
      action: 'CLICK',
      selector: '[data-test-id="Submit"]',
      description: 'Submit application',
      isReversible: false,
    },
    {
      id: 'step-7',
      stepNumber: 7,
      action: 'WAIT_FOR_TEXT',
      selector: '[data-test-id="CaseStatus"]',
      value: 'Intake-Complete',
      description: 'Wait for confirmation',
      isReversible: true,
    },
  ],
  onError: 'retry',
  maxRetries: 3,
  timeout: 60000,
  createdAt: Date.now(),
};
```

**Usage**:

```bash
# Via command
"Create loan application for John Smith for $450,000"

# Via workflow
workflowOrchestrator.execute(loanIntakeWorkflow, tabId, {
  caseContext: null,
  snapshot: null,
});
```

---

### Conditional Workflows

#### Example: Risk-Based Escalation

**Problem**: High-risk applications should auto-escalate, low-risk should proceed normally.

**Solution**: Use conditional steps.

```typescript
const riskBasedWorkflow: Workflow = {
  workflowId: 'risk-based-escalation',
  name: 'Risk-Based Escalation',
  description: 'Escalate high-risk cases, process low-risk normally',
  trigger: {
    type: 'manual',
  },
  steps: [
    {
      id: 'step-1',
      stepNumber: 1,
      action: 'TYPE',
      selector: '[data-test-id="DebtToIncomeRatio"]',
      value: '${dtiRatio}',
      description: 'Enter DTI ratio',
      isReversible: true,
      condition: {
        type: 'element_exists',
        selector: '[data-test-id="DebtToIncomeRatio"]',
      },
    },
    // Conditional: If DTI > 42%, escalate
    {
      id: 'step-2-escalate',
      stepNumber: 2,
      action: 'CLICK',
      selector: '[data-test-id="Escalate"]',
      description: 'Escalate high-risk case',
      isReversible: false,
      condition: {
        type: 'value_equals',
        selector: '[data-test-id="RiskLevel"]',
        expectedValue: 'High',
      },
    },
    // Conditional: If DTI <= 42%, proceed
    {
      id: 'step-2-proceed',
      stepNumber: 2,
      action: 'CLICK',
      selector: '[data-test-id="NextStep"]',
      description: 'Proceed with normal processing',
      isReversible: false,
      condition: {
        type: 'value_equals',
        selector: '[data-test-id="RiskLevel"]',
        expectedValue: 'Low',
      },
    },
  ],
  onError: 'stop',
  maxRetries: 1,
  timeout: 30000,
  createdAt: Date.now(),
};
```

---

### Error Handling Patterns

#### Example: Retry with Alternative Selectors

**Problem**: Pega UI changes between versions, selectors may fail.

**Solution**: Self-healing with alternative selectors.

```typescript
const robustWorkflow: Workflow = {
  workflowId: 'robust-submission',
  name: 'Robust Case Submission',
  description: 'Submit with self-healing',
  trigger: { type: 'manual' },
  steps: [
    {
      id: 'step-1',
      stepNumber: 1,
      action: 'CLICK',
      selector: '[data-test-id="Submit"]', // Primary selector
      description: 'Click Submit',
      isReversible: false,
      // Self-healing actions (auto-generated)
      // Alternative: button[aria-label="Submit"]
      // Alternative: text=Submit
      // Alternative: .btn-primary
    },
  ],
  onError: 'retry', // Retry on failure
  maxRetries: 3, // Try up to 3 times
  timeout: 30000,
  createdAt: Date.now(),
};
```

**What happens on failure**:

1. First attempt: Try `[data-test-id="Submit"]`
2. Fails → Try alternative: `button[aria-label="Submit"]`
3. Fails → Try alternative: `text=Submit`
4. Fails → Try alternative: `.btn-primary`
5. All fail → Capture screenshot, log error, stop workflow

---

### Loop Workflow

#### Example: Batch Update Multiple Cases

**Problem**: Update priority on all cases in a list.

**Solution**: Loop through cases.

```typescript
const batchUpdateWorkflow: Workflow = {
  workflowId: 'batch-priority-update',
  name: 'Batch Priority Update',
  description: 'Update priority for all cases in queue',
  trigger: { type: 'manual' },
  steps: [
    {
      id: 'step-1',
      stepNumber: 1,
      action: 'CLICK',
      selector: '[data-test-id="FirstCase"]',
      description: 'Open first case',
      isReversible: true,
    },
    {
      id: 'step-2',
      stepNumber: 2,
      action: 'TYPE',
      selector: '[data-test-id="Priority"]',
      value: 'High',
      description: 'Set priority to High',
      isReversible: true,
    },
    {
      id: 'step-3',
      stepNumber: 3,
      action: 'CLICK',
      selector: '[data-test-id="Save"]',
      description: 'Save case',
      isReversible: true,
    },
    {
      id: 'step-4',
      stepNumber: 4,
      action: 'CLICK',
      selector: '[data-test-id="NextCase"]',
      description: 'Navigate to next case',
      isReversible: true,
      // Loop condition
      condition: {
        type: 'element_exists',
        selector: '[data-test-id="NextCase"]',
      },
    },
  ],
  onError: 'skip', // Skip failed cases, continue with next
  maxRetries: 1,
  maxIterations: 50, // Process up to 50 cases
  exitCondition: {
    type: 'element_exists',
    selector: '[data-test-id="NextCase"]',
    negate: true, // Exit when NextCase button doesn't exist
  },
  timeout: 300000, // 5 minutes
  createdAt: Date.now(),
};
```

---

## MCP Integration

### Connecting External MCP Clients

The agent exposes its capabilities via the Model Context Protocol (MCP), allowing external AI assistants to interact with Pega.

#### Example: Python MCP Client

```python
import json
import websocket

# Connect to the extension
ws = websocket.WebSocket()
ws.connect("ws://localhost:端口号/mcp")  # Extension's MCP server

# Initialize connection
init_request = {
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
        "protocolVersion": "2024-11-05",
        "capabilities": {},
        "clientInfo": {
            "name": "my-ai-assistant",
            "version": "1.0.0"
        }
    }
}

ws.send(json.dumps(init_request))
response = json.loads(ws.recv())
print(response)

# List available tools
list_tools_request = {
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list"
}

ws.send(json.dumps(list_tools_request))
tools_response = json.loads(ws.recv())
print("Available tools:", tools_response["result"]["tools"])
```

#### Example: JavaScript MCP Client

```javascript
// Connect to extension's MCP server
const port = chrome.runtime.connect('your-extension-id', { name: 'mcp-client' });

// Initialize
port.postMessage({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: {
      name: 'my-assistant',
      version: '1.0.0',
    },
  },
});

// Listen for responses
port.onMessage.addListener((response) => {
  console.log('MCP Response:', response);
});

// Call a tool
port.postMessage({
  jsonrpc: '2.0',
  id: 2,
  method: 'tools/call',
  params: {
    name: 'pega_get_case_summary',
    arguments: {
      includePII: false,
    },
  },
});
```

---

### Calling MCP Tools

#### Tool 1: Get Case Summary

```javascript
// Request
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "pega_get_case_summary",
    "arguments": {}
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
        "text": "{\"caseId\":\"LOAN-2024-001234\",\"caseType\":\"Mortgage Application\",\"situation\":\"...\",\"history\":\"...\",\"currentState\":\"...\",\"riskSignals\":[...],\"recommendedNextAction\":\"...\"}"
      }
    ]
  }
}
```

#### Tool 2: Update Field

```javascript
// Request
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/call",
  "params": {
    "name": "pega_update_field",
    "arguments": {
      "fieldLabel": "Status",
      "value": "Approved"
    }
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Field Status updated to Approved"
      }
    ]
  }
}
```

#### Tool 3: Execute Action Plan

```javascript
// Request
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "pega_execute_action_plan",
    "arguments": {
      "command": "Submit the case",
      "autoConfirm": false
    }
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [
      {
        "type": "text",
        "text": "Action plan execution initiated: \"Submit the case\"\nAuto-confirm: false\n\nThe plan will be generated and executed on the active Pega case."
      }
    ]
  }
}
```

---

### Reading MCP Resources

#### Resource 1: Current Case

```javascript
// Request
{
  "jsonrpc": "2.0",
  "id": 4,
  "method": "resources/read",
  "params": {
    "uri": "pega://current-case"
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 4,
  "result": {
    "contents": [
      {
        "uri": "pega://current-case",
        "mimeType": "application/json",
        "text": "{\"caseId\":\"LOAN-2024-001234\",\"caseType\":\"Mortgage Application\",\"fields\":[...],\"actions\":[...]}"
      }
    ]
  }
}
```

#### Resource 2: Available Actions

```javascript
// Request
{
  "jsonrpc": "2.0",
  "id": 5,
  "method": "resources/read",
  "params": {
    "uri": "pega://available-actions"
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 5,
  "result": {
    "contents": [
      {
        "uri": "pega://available-actions",
        "mimeType": "application/json",
        "text": "{\"actions\":[{\"label\":\"Submit\",\"type\":\"submit\",\"available\":true},{\"label\":\"Save\",\"type\":\"save\",\"available\":true}]}"
      }
    ]
  }
}
```

---

### MCP Prompts

Pre-configured prompts for common workflows:

```javascript
// List prompts
{
  "jsonrpc": "2.0",
  "id": 6,
  "method": "prompts/list"
}

// Get specific prompt
{
  "jsonrpc": "2.0",
  "id": 7,
  "method": "prompts/get",
  "params": {
    "name": "summarize_case"
  }
}

// Response
{
  "jsonrpc": "2.0",
  "id": 7,
  "result": {
    "description": "Generate a case summary",
    "messages": [
      {
        "role": "user",
        "content": {
          "type": "text",
          "text": "Please summarize the current Pega case, including:\n1. Current situation and status\n2. Key information and field values\n3. Recent history and actions\n4. Any risk signals or concerns\n5. Recommended next steps"
        }
      }
    ]
  }
}
```

---

## Common Use Cases

### Use Case 1: Case Summarization Workflow

**Scenario**: Loan officer opens 30+ cases per day, needs quick context.

**Problem**: Each case takes 3-5 minutes to review manually.

**Solution**: Auto-generate summaries on case open.

#### Workflow

```typescript
// Auto-trigger on case open
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CASE_OPENED') {
    // Auto-generate summary
    workflowOrchestrator.execute({
      workflowId: 'auto-summary',
      name: 'Auto-Generate Summary',
      description: 'Generate summary when case opens',
      trigger: { type: 'case_opened' },
      steps: [
        {
          id: 'step-1',
          stepNumber: 1,
          action: 'CAPTURE_DOM',
          description: 'Capture case data',
        },
        {
          id: 'step-2',
          stepNumber: 2,
          action: 'GENERATE_SUMMARY',
          description: 'Generate AI summary',
        },
        {
          id: 'step-3',
          stepNumber: 3,
          action: 'DISPLAY_SUMMARY',
          description: 'Show in side panel',
        },
      ],
      onError: 'skip',
      maxRetries: 1,
      timeout: 10000,
      createdAt: Date.now(),
    }, sender.tab.id, { caseContext: null, snapshot: null });
  }
});
```

#### Result

- **Before**: 3-5 minutes per case to understand context
- **After**: 5 seconds for comprehensive summary
- **Time saved**: 2.5-4.5 minutes per case × 30 cases = 75-135 minutes/day

---

### Use Case 2: Batch Field Updates

**Scenario**: Manager needs to update priority on 50 cases after policy change.

**Problem**: Manual update takes 2-3 minutes per case = 100-150 minutes total.

**Solution**: Batch update workflow.

#### Natural Language Command

```bash
"Update priority to High for all cases with status 'Pending-Documentation' and assigned to 'John Smith'"
```

#### Generated Workflow

```typescript
const batchUpdateWorkflow: Workflow = {
  workflowId: 'batch-priority-update-' + Date.now(),
  name: 'Batch Priority Update',
  description: 'Update priority for filtered cases',
  trigger: { type: 'manual' },
  steps: [
    {
      id: 'step-1',
      stepNumber: 1,
      action: 'NAVIGATE',
      selector: 'a[href*="CaseSearch"]',
      description: 'Go to case search',
    },
    {
      id: 'step-2',
      stepNumber: 2,
      action: 'SELECT',
      selector: '[data-test-id="Status"]',
      value: 'Pending-Documentation',
      description: 'Set status filter',
    },
    {
      id: 'step-3',
      stepNumber: 3,
      action: 'SELECT',
      selector: '[data-test-id="AssignedTo"]',
      value: 'John Smith',
      description: 'Set assignment filter',
    },
    {
      id: 'step-4',
      stepNumber: 4,
      action: 'CLICK',
      selector: '[data-test-id="Search"]',
      description: 'Run search',
    },
    // Loop through results
    {
      id: 'step-5',
      stepNumber: 5,
      action: 'CLICK',
      selector: '[data-test-id="FirstResult"]',
      description: 'Open first case',
    },
    {
      id: 'step-6',
      stepNumber: 6,
      action: 'TYPE',
      selector: '[data-test-id="Priority"]',
      value: 'High',
      description: 'Update priority',
    },
    {
      id: 'step-7',
      stepNumber: 7,
      action: 'CLICK',
      selector: '[data-test-id="Save"]',
      description: 'Save case',
    },
    {
      id: 'step-8',
      stepNumber: 8,
      action: 'CLICK',
      selector: '[data-test-id="NextCase"]',
      description: 'Go to next case',
      maxIterations: 50,
      exitCondition: {
        type: 'element_exists',
        selector: '[data-test-id="NextCase"]',
        negate: true,
      },
    },
  ],
  onError: 'skip',
  maxRetries: 1,
  timeout: 300000,
  createdAt: Date.now(),
};
```

#### Result

- **Before**: 100-150 minutes for 50 cases
- **After**: 5-10 minutes for batch update
- **Time saved**: 90-145 minutes

---

### Use Case 3: Case Triage Automation

**Scenario**: Intake team receives 100+ applications per day, needs to prioritize.

**Problem**: Manual triage takes 5-10 minutes per application.

**Solution**: Auto-assign priority based on risk signals.

#### Natural Language Command

```bash
"Triage all new loan applications: set priority to High if loan amount > $400,000 or DTI > 42%, otherwise set to Medium"
```

#### Generated Workflow

```typescript
const triageWorkflow: Workflow = {
  workflowId: 'auto-triage',
  name: 'Auto-Triage Applications',
  description: 'Prioritize based on risk factors',
  trigger: { type: 'case_opened' },
  steps: [
    {
      id: 'step-1',
      stepNumber: 1,
      action: 'ASSERT_VALUE',
      selector: '[data-test-id="LoanAmount"]',
      value: '400000',
      description: 'Check if loan > $400k',
    },
    // If loan > $400k, set High priority
    {
      id: 'step-2-high',
      stepNumber: 2,
      action: 'TYPE',
      selector: '[data-test-id="Priority"]',
      value: 'High',
      description: 'Set High priority',
      condition: {
        type: 'value_equals',
        selector: '[data-test-id="LoanAmount_GT_400k"]',
        expectedValue: 'true',
      },
    },
    // Otherwise check DTI
    {
      id: 'step-3-check-dti',
      stepNumber: 3,
      action: 'ASSERT_VALUE',
      selector: '[data-test-id="DTI_GT_42"]',
      value: 'true',
      description: 'Check if DTI > 42%',
    },
    {
      id: 'step-4-high-dti',
      stepNumber: 4,
      action: 'TYPE',
      selector: '[data-test-id="Priority"]',
      value: 'High',
      description: 'Set High priority for high DTI',
      condition: {
        type: 'value_equals',
        selector: '[data-test-id="DTI_GT_42"]',
        expectedValue: 'true',
      },
    },
    // Otherwise set Medium
    {
      id: 'step-5-medium',
      stepNumber: 5,
      action: 'TYPE',
      selector: '[data-test-id="Priority"]',
      value: 'Medium',
      description: 'Set Medium priority',
      condition: {
        type: 'value_equals',
        selector: '[data-test-id="LoanAmount_GT_400k"]',
        expectedValue: 'false',
        negate: true,
      },
    },
  ],
  onError: 'skip',
  maxRetries: 1,
  timeout: 30000,
  createdAt: Date.now(),
};
```

#### Result

- **Before**: 5-10 minutes per application × 100 = 500-1000 minutes/day
- **After**: 30 seconds per application (auto)
- **Time saved**: 450-950 minutes/day (7.5-16 hours)

---

### Use Case 4: SLA Monitoring

**Scenario**: Operations team needs to monitor cases approaching SLA deadline.

**Problem**: Manual checking requires opening each case.

**Solution**: Automated SLA monitoring with alerts.

#### Natural Language Command

```bash
"Show me all cases with breached SLA or deadline within 2 hours"
```

#### Workflow

```typescript
const slaMonitoringWorkflow: Workflow = {
  workflowId: 'sla-monitoring',
  name: 'SLA Monitoring',
  description: 'Monitor SLA deadlines',
  trigger: { type: 'scheduled' }, // Run every 15 minutes
  steps: [
    {
      id: 'step-1',
      stepNumber: 1,
      action: 'NAVIGATE',
      selector: 'a[href*="CaseSearch"]',
      description: 'Go to case search',
    },
    {
      id: 'step-2',
      stepNumber: 2,
      action: 'SELECT',
      selector: '[data-test-id="SLAStatus"]',
      value: 'Breached',
      description: 'Filter breached SLA',
    },
    {
      id: 'step-3',
      stepNumber: 3,
      action: 'CLICK',
      selector: '[data-test-id="Search"]',
      description: 'Run search',
    },
    {
      id: 'step-4',
      stepNumber: 4,
      action: 'CAPTURE_LIST',
      description: 'Capture breached cases',
    },
    {
      id: 'step-5',
      stepNumber: 5,
      action: 'NOTIFY',
      description: 'Send alert to operations team',
    },
  ],
  onError: 'skip',
  maxRetries: 3,
  timeout: 60000,
  createdAt: Date.now(),
};
```

#### Result

- **Before**: Manual checking every 30 minutes = 60-90 minutes/day
- **After**: Automated alerts, immediate notification
- **Time saved**: 60-90 minutes/day
- **SLA improvement**: Faster response to breaches

---

### Use Case 5: Escalation Workflows

**Scenario**: Complex cases require manager approval.

**Problem**: Manual escalation process takes 5-10 minutes.

**Solution**: One-click escalation with context.

#### Natural Language Command

```bash
"Escalate to manager with notes: 'High DTI ratio, missing income documentation, property appraisal pending'"
```

#### Workflow

```typescript
const escalationWorkflow: Workflow = {
  workflowId: 'auto-escalation',
  name: 'Smart Escalation',
  description: 'Escalate with full context',
  trigger: { type: 'manual' },
  steps: [
    {
      id: 'step-1',
      stepNumber: 1,
      action: 'CLICK',
      selector: '[data-test-id="Actions-Escalate"]',
      description: 'Click Escalate',
    },
    {
      id: 'step-2',
      stepNumber: 2,
      action: 'SELECT',
      selector: '[data-test-id="AssignTo"]',
      value: 'Manager',
      description: 'Select Manager',
    },
    {
      id: 'step-3',
      stepNumber: 3,
      action: 'CAPTURE_CONTEXT',
      description: 'Capture case context',
    },
    {
      id: 'step-4',
      stepNumber: 4,
      action: 'TYPE',
      selector: '[data-test-id="EscalationNotes"]',
      value: 'High DTI ratio, missing income documentation, property appraisal pending\n\nCase Context:\n- Case ID: ${caseId}\n- Stage: ${stage}\n- Status: ${status}\n- Assigned To: ${assignedTo}',
      description: 'Add escalation notes with context',
    },
    {
      id: 'step-5',
      stepNumber: 5,
      action: 'ATTACH_SUMMARY',
      description: 'Attach case summary',
    },
    {
      id: 'step-6',
      stepNumber: 6,
      action: 'CLICK',
      selector: '[data-test-id="ConfirmEscalate"]',
      description: 'Confirm escalation',
    },
  ],
  onError: 'stop',
  maxRetries: 1,
  timeout: 30000,
  createdAt: Date.now(),
};
```

#### Result

- **Before**: 5-10 minutes per escalation
- **After**: 30 seconds
- **Time saved**: 4.5-9.5 minutes per escalation
- **Quality**: Includes full context, better decisions

---

## Troubleshooting Examples

### Problem 1: Action Fails - Element Not Found

**Scenario**: "Update status to Approved" fails with "Element not found".

#### Diagnosis

```javascript
// Check service worker console
chrome.runtime.onMessage.addListener((message) => {
  if (message.type === 'ACTION_RESULT') {
    console.log('Action result:', message.payload.result);
  }
});

// Output:
// {
//   status: 'failed',
//   results: [{
//     stepNumber: 1,
//     action: 'TYPE',
//     success: false,
//     errorMessage: 'Element not found: [data-test-id="Status"]',
//     executionTimeMs: 50
//   }]
// }
```

#### Solution 1: Check Selector

```javascript
// Open Pega page console
document.querySelectorAll('[data-test-id="Status"]');
// Output: []

// Try finding by label
document.querySelectorAll('label');
// Find label containing "Status"

// Get input's selector
const statusInput = document.querySelector('label:contains("Status") + input');
console.log(statusInput.getAttribute('data-test-id'));
// Output: "Field_Status" (different from expected)
```

#### Solution 2: Use Alternative Selector

```typescript
// Update workflow with alternative selector
const workflow: Workflow = {
  // ... other steps
  steps: [
    {
      id: 'step-1',
      stepNumber: 1,
      action: 'TYPE',
      // Try multiple selectors (self-healing)
      selector: '[data-test-id="Field_Status"], [aria-label="Status"], input[name="Status"]',
      value: 'Approved',
      description: 'Update status',
    },
  ],
};
```

#### Solution 3: Wait for Element

```typescript
// Add wait step before action
steps: [
  {
    id: 'step-1-wait',
    stepNumber: 1,
    action: 'WAIT_FOR_VISIBLE',
    selector: '[data-test-id="Field_Status"]',
    timeoutMs: 5000,
    description: 'Wait for status field',
  },
  {
    id: 'step-2-type',
    stepNumber: 2,
    action: 'TYPE',
    selector: '[data-test-id="Field_Status"]',
    value: 'Approved',
    description: 'Update status',
  },
]
```

---

### Problem 2: Pega Not Detected

**Scenario**: Extension doesn't activate on Pega page.

#### Diagnosis

```javascript
// Check Pega detection
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, {
    type: 'PEGA_DETECTED',
    payload: {}
  }, (response) => {
    console.log('Pega detection:', response);
  });
});

// Output:
// {
//   isDetected: false,
//   confidence: 0,
//   framework: 'unknown'
// }
```

#### Solution 1: Check Domain

```javascript
// Check current URL
console.log(window.location.href);
// Output: "https://my-pega-app.com/prweb/PRWebLDAP1"

// Update config to include domain
pega: {
  targetDomains: [
    'https://my-pega-app.com',
  ],
}
```

#### Solution 2: Check Detection Signals

```javascript
// Check for Pega DOM signals
console.log(document.querySelector('.pega-standalone-html'));
console.log(document.querySelector('[data-pega-gadgetname]'));
console.log(document.querySelector('script[src*="pega"]'));

// If none found, Pega version may not be supported
// Or using custom skin that removes signals
```

#### Solution 3: Manual Activation

```javascript
// Force activate (for testing)
chrome.storage.session.set({ 'force-activate': true });
// Then reload page
```

---

### Problem 3: LLM Timeout

**Scenario**: "Summarize this case" times out after 30 seconds.

#### Diagnosis

```javascript
// Check LLM adapter logs
console.log('[LLM] Request started:', Date.now());
// ... 30 seconds later
console.log('[LLM] Request timed out');
```

#### Solution 1: Increase Timeout

```typescript
llm: {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 1500,
  timeoutMs: 60000, // Increase from 30s to 60s
}
```

#### Solution 2: Reduce Token Count

```typescript
llm: {
  provider: 'anthropic',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 1000, // Reduce from 1500
  temperature: 0.1,
}
```

#### Solution 3: Use Faster Model

```typescript
llm: {
  provider: 'anthropic',
  model: 'claude-haiku-4-20250514', // Faster than Sonnet
  maxTokens: 1500,
  temperature: 0.1,
}
```

#### Solution 4: Enable Fallback

```typescript
llmMulti: {
  providers: [
    {
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514',
      priority: 1,
    },
    {
      provider: 'azure-openai',
      model: 'gpt-35-turbo', // Faster
      priority: 2,
    },
  ],
  fallbackEnabled: true,
  maxRetries: 2,
  timeoutMs: 30000,
}
```

---

### Problem 4: PII Not Masking

**Scenario**: Sensitive data appears in logs/LLM calls.

#### Diagnosis

```javascript
// Check if PII masking enabled
chrome.storage.local.get('securityConfig', (result) => {
  console.log('PII masking:', result.securityConfig.piiMaskingEnabled);
  console.log('PII categories:', result.securityConfig.piiCategoriesToMask);
});

// Check field classification
chrome.tabs.query({ active: true }, (tabs) => {
  chrome.tabs.sendMessage(tabs[0].id, {
    type: 'CHECK_PII',
    payload: { fieldLabel: 'SSN' }
  }, (response) => {
    console.log('PII category:', response.category);
    console.log('PII token:', response.token);
  });
});
```

#### Solution 1: Enable PII Masking

```typescript
security: {
  piiMaskingEnabled: true, // Ensure this is true
  piiCategoriesToMask: ['SSN', 'NAME', 'DOB', 'ACCOUNT'],
}
```

#### Solution 2: Add Custom PII Category

```typescript
// In pii-masker.ts
export function classifyField(label: string, testId: string): PiiCategory {
  // Add custom classification
  if (label.includes('Passport') || testId.includes('Passport')) {
    return 'PASSPORT';
  }
  // ... existing logic
}

// Update config
security: {
  piiCategoriesToMask: [
    'NAME', 'SSN', 'DOB', 'EMAIL', 'PHONE', 'ACCOUNT', 'ADDRESS', 'INCOME',
    'PASSPORT', // Add custom category
  ],
}
```

#### Solution 3: Verify Masking

```javascript
// Test masking
const { piiMasker } = await import('./content-scripts/pii-masker.js');

// Classify field
const category = piiMasker.classifyField('Social Security Number', 'Field_SSN');
console.log('Category:', category); // 'SSN'

// Mask value
const masked = piiMasker.mask('123-45-6789', 'SSN');
console.log('Masked:', masked); // '{SSN_1}'

// Unmask (local only)
const unmasked = piiMasker.unmask('{SSN_1}');
console.log('Unmasked:', unmasked); // '123-45-6789'
```

---

### Problem 5: Workflow Not Executing

**Scenario**: Workflow execution fails immediately.

#### Diagnosis

```javascript
// Check workflow status
const status = workflowOrchestrator.getStatus(tabId);
console.log('Workflow status:', status);

// Output:
// {
//   executionId: 'wf-exec-123',
//   status: 'failed',
//   error: 'No active Pega tab found',
//   currentStep: 0
// }
```

#### Solution 1: Check Active Tab

```javascript
// Ensure Pega tab is active
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  console.log('Active tab:', tabs[0].url);
  // Should be a Pega URL
});
```

#### Solution 2: Manually Set Tab

```javascript
// Get all tabs
chrome.tabs.query({}, (tabs) => {
  const pegaTab = tabs.find(tab => tab.url.includes('pega'));
  if (pegaTab) {
    // Use this tab ID for workflow execution
    const tabId = pegaTab.id;
    workflowOrchestrator.execute(workflow, tabId, context);
  }
});
```

#### Solution 3: Check Workflow Steps

```javascript
// Validate workflow before execution
function validateWorkflow(workflow) {
  for (const step of workflow.steps) {
    if (!step.action) {
      console.error(`Step ${step.id} missing action`);
      return false;
    }
    if (!step.selector) {
      console.error(`Step ${step.id} missing selector`);
      return false;
    }
    if (!step.description) {
      console.warn(`Step ${step.id} missing description`);
    }
  }
  return true;
}

// Validate before executing
if (validateWorkflow(workflow)) {
  workflowOrchestrator.execute(workflow, tabId, context);
}
```

---

### Problem 6: MCP Connection Refused

**Scenario**: External MCP client can't connect to extension.

#### Diagnosis

```javascript
// Check if extension is listening
// In extension background console
console.log('MCP server initialized:', mcpServer !== null);

// Check clients
console.log('Connected clients:', mcpServer.clients.size);
```

#### Solution 1: Ensure Extension ID is Correct

```python
# Use correct extension ID
port = chrome.runtime.connect('abcdefghijklmnopabcdefgh', { name: 'mcp-client' })
# Find extension ID at chrome://extensions/
```

#### Solution 2: Check Permissions

```json
// manifest.json
{
  "permissions": [
    "runtime",
    "tabs",
    "storage"
  ],
  "externally_connectable": {
    "matches": ["<all_urls>"]
  }
}
```

#### Solution 3: Test Connection

```python
# Test simple connection
import json
ws = websocket.WebSocket()

try:
    ws.connect("ws://localhost:端口/mcp")
    print("Connected!")
    ws.send(json.dumps({
        "jsonrpc": "2.0",
        "id": 1,
        "method": "ping"
    }))
    response = json.loads(ws.recv())
    print("Pong:", response)
except Exception as e:
    print("Connection failed:", e)
```

---

## Summary

This documentation provides comprehensive examples for:

1. **All 11 natural language intents** with before/after scenarios
2. **Configuration patterns** for security, LLM providers, PII masking, and role-based access
3. **Workflow automation** including multi-step, conditional, and error-handling patterns
4. **MCP integration** with code examples for connecting external clients
5. **Real-world use cases** demonstrating time savings and efficiency gains
6. **Troubleshooting guides** for common issues with diagnostic steps and solutions

Each example includes:
- Problem statement
- Solution code/commands
- Expected outcome
- Notes and caveats

Use these examples as templates for your own Pega automation workflows.
