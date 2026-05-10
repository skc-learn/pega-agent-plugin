/**
 * Planner - Intent to Action Planning Engine
 *
 * Transforms natural language + Pega context into validated executable plans.
 * Handles locally without LLM for high-confidence, known intents.
 */

import type { IntentType, ActionPlan, DOMSnapshot, PlanStep } from '../shared/types';
import { PlanParseError } from '../shared/types';
import { classifyIntent } from '../shared/intent-classifier';
import { detectCaseDomain, getDomainMetadata } from '../shared/pega-heuristics';
import { generateUUID } from '../shared/message-types';
import { llmAdapter } from './llm-adapter';

// ============================================================================
// CONSTANTS
// ============================================================================

const PLANNER_SYSTEM_PROMPT = `You are a Pega Infinity platform expert with deep knowledge of case management, workflows, and UI automation.

**PEGA DOMAIN EXPERTISE:**

**Case Lifecycle:**
- Cases progress through stages: Intake → Processing → Review → Approval → Resolution
- Each stage has assignments with SLAs (Service Level Agreements)
- Urgency increases automatically when SLAs are at risk
- Common case types: Loans, Claims, Service Requests, Investigations, Onboarding

**Flow Actions vs Local Actions:**
- **Flow Actions** (isFlowAction: true): Advance the case to next stage/process. Trigger server-side processing, case resolution, or stage transitions. Examples: Submit, Complete, Approve, Reject, Next.
- **Local Actions** (isLocalAction: true): Perform UI-only operations without server roundtrip. Examples: Add Note, Print, Refresh, Toggle View.
- **Bulk Actions** (isBulkAction: true): Affect multiple cases simultaneously. Require extra caution and explicit user confirmation.
- When planning flow actions, consider adding WAIT_FOR_* steps after to allow server processing.

**UI Frameworks:**
- Constellation (modern): React-based, uses data-test-id attributes, px-* elements
- Cosmos: Angular-based, traditional Pega patterns
- Classic: Legacy JSP UI

**Common Actions:**
- Submit/Complete: Advances case to next stage (flow action)
- Save: Persists data without stage transition (local action)
- Next: Moves to next assignment in current stage (flow action)
- Reassign: Transfers work to another operator/team (flow action)
- Escalate: Raises urgency, notifies management (flow action)

**Data Patterns:**
- PII is always tokenized: {SSN_1}, {NAME_1}, {INCOME_1}
- Status values: Open, In-Progress, Pending-Review, Resolved, Closed
- Priority: Low, Medium, High, Critical (affects SLA)

**Domain-Specific Context:**
- Financial-Lending: Credit risk, underwriting, income verification, loan terms
- Insurance-Claims: FNOL, investigation, evaluation, reserve management
- Healthcare-Patient: HIPAA compliance, medical records, pre-authorization
- Service-Management: Incident priority, SLA tracking, resolution

**Workflow Intelligence:**
- If a case is "Pending Approval" and all fields complete → recommend Submit
- If SLA is at risk (urgency high) → prioritize completion
- If required fields are empty → prompt for clarification
- If case is stuck in same stage > 3 days → suggest escalation
- For flow actions, add WAIT_FOR_VISIBLE or WAIT_FOR_TEXT to confirm state change

**AVAILABLE ACTION TYPES:**

**Basic Actions:**
- CLICK: Click on buttons, links, checkboxes
- TYPE: Enter text into input fields
- SELECT: Choose option from dropdown
- CLEAR: Clear input field value
- NAVIGATE: Navigate to URL
- WAIT: Fixed time wait (use sparingly)
- SCROLL: Scroll page or element

**Smart Waiting (PREFERRED over WAIT):**
- WAIT_FOR_ELEMENT: Wait until element exists in DOM
- WAIT_FOR_VISIBLE: Wait until element is visible
- WAIT_FOR_ENABLED: Wait until element is enabled (not disabled)
- WAIT_FOR_HIDDEN: Wait until element is hidden/removed
- WAIT_FOR_TEXT: Wait until element contains specific text

**Advanced Interactions:**
- HOVER: Hover over element (to reveal tooltips, dropdowns)
- DOUBLE_CLICK: Double-click on element
- RIGHT_CLICK: Right-click context menu
- PRESS_KEY: Press keyboard key (Enter, Escape, Tab, etc.)
- DRAG_DROP: Drag element to target

**Validation/Assertions:**
- ASSERT_VISIBLE: Verify element is visible
- ASSERT_ENABLED: Verify element is enabled
- ASSERT_TEXT: Verify element text content
- ASSERT_VALUE: Verify form field value

**STRICT RULES:**
1. ONLY use selectors from AVAILABLE FIELDS or AVAILABLE ACTIONS - never invent them
2. Output ONLY valid JSON - no prose, no markdown fences
3. requiresConfirmation: true for: submit, escalate, reassign, close, delete, approve
4. If ambiguous or missing required info: { "error": "AMBIGUOUS", "clarification": "specific question" }
5. PII tokens like {SSN_1} must be used as-is - never resolve or modify them
6. Minimum steps - fewer steps = better user experience
7. For form updates, prefer TYPE over SELECT (more reliable)
8. Use smart waits (WAIT_FOR_*) instead of fixed WAIT when possible
9. Add assertions after critical steps to verify expected state

**Output Schema:**
{
  "planId": "will-be-overwritten",
  "intent": "UPDATE_FIELD|SUBMIT_CASE|SAVE_CASE|NEXT_STEP|REASSIGN|ESCALATE",
  "summary": "Brief description of what this plan accomplishes",
  "requiresConfirmation": boolean,
  "steps": [
    {
      "stepNumber": 1,
      "action": "CLICK|TYPE|SELECT|CLEAR|WAIT|WAIT_FOR_ELEMENT|WAIT_FOR_VISIBLE|WAIT_FOR_ENABLED|WAIT_FOR_HIDDEN|WAIT_FOR_TEXT|HOVER|DOUBLE_CLICK|RIGHT_CLICK|PRESS_KEY|DRAG_DROP|ASSERT_VISIBLE|ASSERT_ENABLED|ASSERT_TEXT|ASSERT_VALUE",
      "selector": "[data-test-id=\"...\"]",
      "value": "optional value for TYPE/SELECT/WAIT_FOR_TEXT/ASSERT_TEXT/ASSERT_VALUE/PRESS_KEY",
      "description": "Human-readable description",
      "isReversible": boolean
    }
  ],
  "expectedOutcome": "What should happen after execution"
}

**EXAMPLES:**

Example 1 - Type in field with smart wait:
{
  "steps": [
    { "stepNumber": 1, "action": "WAIT_FOR_VISIBLE", "selector": "[data-test-id=\"FirstName\"]", "description": "Wait for FirstName field to be visible", "isReversible": true },
    { "stepNumber": 2, "action": "CLEAR", "selector": "[data-test-id=\"FirstName\"]", "description": "Clear FirstName field", "isReversible": true },
    { "stepNumber": 3, "action": "TYPE", "selector": "[data-test-id=\"FirstName\"]", "value": "John", "description": "Type 'John' into FirstName", "isReversible": true }
  ]
}

Example 2 - Submit with assertion:
{
  "steps": [
    { "stepNumber": 1, "action": "ASSERT_ENABLED", "selector": "[data-test-id=\"SubmitButton\"]", "description": "Verify submit button is enabled", "isReversible": true },
    { "stepNumber": 2, "action": "CLICK", "selector": "[data-test-id=\"SubmitButton\"]", "description": "Click Submit button", "isReversible": false },
    { "stepNumber": 3, "action": "WAIT_FOR_TEXT", "selector": "[data-test-id=\"StatusMessage\"]", "value": "Case submitted successfully", "description": "Wait for success message", "isReversible": true }
  ]
}

Example 3 - Hover to reveal dropdown, then click:
{
  "steps": [
    { "stepNumber": 1, "action": "HOVER", "selector": "[data-test-id=\"ActionsMenu\"]", "description": "Hover over Actions menu", "isReversible": true },
    { "stepNumber": 2, "action": "WAIT_FOR_VISIBLE", "selector": "[data-test-id=\"ReassignOption\"]", "description": "Wait for Reassign option to appear", "isReversible": true },
    { "stepNumber": 3, "action": "CLICK", "selector": "[data-test-id=\"ReassignOption\"]", "description": "Click Reassign option", "isReversible": false }
  ]
}

Example 4 - Press key to submit form:
{
  "steps": [
    { "stepNumber": 1, "action": "TYPE", "selector": "[data-test-id=\"Comments\"]", "value": "Approved", "description": "Enter approval comments", "isReversible": true },
    { "stepNumber": 2, "action": "PRESS_KEY", "selector": "[data-test-id=\"Comments\"]", "value": "Enter", "description": "Press Enter to submit", "isReversible": false }
  ]
}

Example 5 - Scroll to element:
{
  "steps": [
    { "stepNumber": 1, "action": "SCROLL", "selector": "[data-test-id=\"BottomSection\"]", "description": "Scroll to bottom section", "isReversible": true },
    { "stepNumber": 2, "action": "WAIT_FOR_VISIBLE", "selector": "[data-test-id=\"AcceptButton\"]", "description": "Wait for Accept button", "isReversible": true },
    { "stepNumber": 3, "action": "CLICK", "selector": "[data-test-id=\"AcceptButton\"]", "description": "Click Accept", "isReversible": false }
  ]
}`;

// ============================================================================
// LOCAL PLAN GENERATORS
// ============================================================================

/**
 * Generate plan for SUBMIT_CASE intent
 */
function generateSubmitPlan(snapshot: DOMSnapshot): ActionPlan | null {
  const submitAction = snapshot.actions.find(
    (a) => a.actionType === 'submit' && !a.isDisabled
  );

  if (!submitAction) return null;

  const steps: PlanStep[] = [
    {
      stepNumber: 1,
      action: 'CLICK',
      selector: submitAction.selector,
      description: `Click "${submitAction.label}" button`,
      isReversible: false,
    }
  ];

  // Add wait step for flow actions to allow server processing
  if (submitAction.isFlowAction) {
    steps.push({
      stepNumber: 2,
      action: 'WAIT',
      selector: '',
      value: '2000',
      description: 'Wait for case submission to complete',
      isReversible: true,
    });
  }

  return {
    planId: generateUUID(),
    intent: 'SUBMIT_CASE',
    summary: `Submit case ${snapshot.caseContext.caseId ?? ''}`,
    requiresConfirmation: submitAction.requiresConfirmation,
    steps,
    expectedOutcome: 'Case submitted successfully',
    createdAt: Date.now(),
  };
}

/**
 * Generate plan for SAVE_CASE intent
 */
function generateSavePlan(snapshot: DOMSnapshot): ActionPlan | null {
  const saveAction = snapshot.actions.find(
    (a) => a.actionType === 'save' && !a.isDisabled
  );

  if (!saveAction) return null;

  return {
    planId: generateUUID(),
    intent: 'SAVE_CASE',
    summary: 'Save current changes',
    requiresConfirmation: saveAction.requiresConfirmation,
    steps: [
      {
        stepNumber: 1,
        action: 'CLICK',
        selector: saveAction.selector,
        description: `Click "${saveAction.label}" button`,
        isReversible: true,
      }
    ],
    expectedOutcome: 'Changes saved successfully',
    createdAt: Date.now(),
  };
}

/**
 * Generate plan for NEXT_STEP intent
 */
function generateNextPlan(snapshot: DOMSnapshot): ActionPlan | null {
  const nextAction = snapshot.actions.find(
    (a) => a.actionType === 'next' && !a.isDisabled
  );

  if (!nextAction) return null;

  const steps: PlanStep[] = [
    {
      stepNumber: 1,
      action: 'CLICK',
      selector: nextAction.selector,
      description: `Click "${nextAction.label}" button`,
      isReversible: false,
    }
  ];

  // Add wait step for flow actions
  if (nextAction.isFlowAction) {
    steps.push({
      stepNumber: 2,
      action: 'WAIT',
      selector: '',
      value: '1500',
      description: 'Wait for stage transition to complete',
      isReversible: true,
    });
  }

  return {
    planId: generateUUID(),
    intent: 'NEXT_STEP',
    summary: 'Proceed to next step',
    requiresConfirmation: nextAction.requiresConfirmation,
    steps,
    expectedOutcome: 'Advanced to next step',
    createdAt: Date.now(),
  };
}

// ============================================================================
// LLM PLAN GENERATION
// ============================================================================

/**
 * Generate plan using LLM for complex intents
 */
async function generateLLMPlan(
  command: string,
  snapshot: DOMSnapshot
): Promise<ActionPlan> {
  // Format fields for prompt
  const fieldsText = snapshot.fields
    .map(
      (f) =>
        `${f.label ?? 'Unknown'} | ${f.selector} | ${f.fieldType} | ${f.value ?? 'empty'}`
    )
    .join('\n');

  // Format actions for prompt with new flags
  const actionsText = snapshot.actions
    .map(
      (a) => {
        const flags = [];
        if (a.isFlowAction) flags.push('flow');
        if (a.isLocalAction) flags.push('local');
        if (a.isBulkAction) flags.push('bulk');
        if (a.requiresConfirmation) flags.push('confirm');
        const flagStr = flags.length > 0 ? `[${flags.join(',')}]` : '';
        return `${a.label} | ${a.selector} | ${a.actionType} | ${a.isDisabled ? 'disabled' : 'enabled'} ${flagStr}`;
      }
    )
    .join('\n');

  // Get domain metadata for context
  const domain = snapshot.caseContext.caseClass
    ? detectCaseDomain(snapshot.caseContext.caseClass)
    : null;
  const domainMetadata = domain ? getDomainMetadata(domain) : null;

  // Build domain context section
  let domainContext = '';
  if (domain && domainMetadata) {
    domainContext = `
DOMAIN CONTEXT (${domain}):
- Industry: ${domainMetadata.industry} - ${domainMetadata.subIndustry}
- Typical Stages: ${domainMetadata.typicalStages.join(' → ')}
- Common Actors: ${domainMetadata.commonActors.join(', ')}
- Risk Factors: ${domainMetadata.riskFactors.join(', ')}
`;
  }

  const userPrompt = `CASE: ${snapshot.caseContext.caseType ?? 'Unknown'}
    ID: ${snapshot.caseContext.caseId ?? 'N/A'}
    Status: ${snapshot.caseContext.status ?? 'Unknown'}
    Stage: ${snapshot.caseContext.stageName ?? 'Unknown'}
    SLA: ${snapshot.caseContext.slaDeadline ?? 'N/A'}
${domainContext}
AVAILABLE FIELDS (label | selector | type | current_value):
${fieldsText || 'No fields available'}

AVAILABLE ACTIONS (label | selector | type | state [flags]):
Flags: flow=stage transition, local=UI only, bulk=multi-case, confirm=needs confirmation
${actionsText || 'No actions available'}

USER COMMAND: "${command}"

Return ActionPlan JSON.`;

  const response = await llmAdapter.complete(PLANNER_SYSTEM_PROMPT, userPrompt);

  // Parse and validate response
  let plan: ActionPlan;
  try {
    let content = response.content.trim();
    // Remove markdown code fences if present
    if (content.startsWith('```')) {
      content = content.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
    }
    plan = JSON.parse(content) as ActionPlan;
  } catch {
    throw new PlanParseError('Failed to parse LLM response as JSON');
  }

  // Check for ambiguous response
  if ('error' in plan && (plan as Record<string, unknown>).error === 'AMBIGUOUS') {
    const ambiguous = (plan as Record<string, unknown>).clarification as string;
    throw new PlanParseError(ambiguous);
  }

  return plan;
}

// ============================================================================
// MAIN PLAN FUNCTION
// ============================================================================

/**
 * Process a command and generate an action plan
 */
export async function plan(
  command: string,
  snapshot: DOMSnapshot
): Promise<ActionPlan | null> {
  // Step 1: Classify intent locally
  const classification = classifyIntent(command);

  // Step 2: Handle locally without LLM for high-confidence known intents
  if (!classification.requiresLLM && classification.confidence >= 0.85) {
    switch (classification.intent) {
      case 'SUMMARIZE_CASE':
        // No plan needed - handled separately
        return null;

      case 'SUBMIT_CASE': {
        const localPlan = generateSubmitPlan(snapshot);
        if (localPlan) return localPlan;
        break;
      }

      case 'SAVE_CASE': {
        const localPlan = generateSavePlan(snapshot);
        if (localPlan) return localPlan;
        break;
      }

      case 'NEXT_STEP': {
        const localPlan = generateNextPlan(snapshot);
        if (localPlan) return localPlan;
        break;
      }
    }
  }

  // Step 3: Use LLM for complex intents
  if (!llmAdapter.isReady()) {
    return {
      planId: generateUUID(),
      intent: 'UNKNOWN',
      summary: 'Configure API key to enable this feature',
      requiresConfirmation: false,
      steps: [],
      expectedOutcome: 'Configure an API key in settings',
      createdAt: Date.now(),
    };
  }

  return generateLLMPlan(command, snapshot);
}

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Check if user has permission for intent
 */
export function checkPermission(
  intent: IntentType,
  userRole: string | null,
  roleRestrictions: Record<string, readonly IntentType[] | readonly ['*']>
): boolean {
  if (!userRole) return true; // No role = no restrictions

  const allowed = roleRestrictions[userRole];
  if (!allowed) return false; // Unknown role = denied

  if (allowed[0] === '*') return true; // Wildcard = all allowed

  return (allowed as readonly IntentType[]).includes(intent);
}

/**
 * Validate a plan against current snapshot
 */
export function validatePlan(
  plan: ActionPlan,
  _snapshot?: DOMSnapshot
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  // Check for required fields
  if (!plan.planId) {
    errors.push('Missing planId');
  }

  if (!plan.intent) {
    errors.push('Missing intent');
  }

  if (!plan.steps || plan.steps.length === 0) {
    // Some intents may have no steps (e.g., SUMMARIZE_CASE)
    if (plan.intent !== 'SUMMARIZE_CASE') {
      errors.push('Missing or empty steps array');
    }
  }

  // Validate each step
  for (const step of plan.steps) {
    // Actions that don't require selectors
    const actionsWithoutSelectors = [
      'NAVIGATE',
      'WAIT',
      'PRESS_KEY'  // Can work on document level or specific element
    ];

    if (!step.selector && !actionsWithoutSelectors.includes(step.action)) {
      errors.push(`Step ${step.stepNumber}: Missing selector for action ${step.action}`);
    }

    if (!step.action) {
      errors.push(`Step ${step.stepNumber}: Missing action type`);
    }

    // Validate value is present for actions that require it
    const actionsRequiringValue = [
      'TYPE',
      'SELECT',
      'WAIT_FOR_TEXT',
      'ASSERT_TEXT',
      'ASSERT_VALUE',
      'PRESS_KEY',
      'NAVIGATE'
    ];

    if (actionsRequiringValue.includes(step.action) && !step.value) {
      errors.push(`Step ${step.stepNumber}: Missing value for action ${step.action}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

// Export for testing
export { generateSubmitPlan, generateSavePlan, generateNextPlan };
