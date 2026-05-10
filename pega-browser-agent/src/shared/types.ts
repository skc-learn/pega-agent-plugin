/**
 * Core TypeScript Types - Pega Case Management Browser Agent
 *
 * All TypeScript interfaces and type definitions.
 * No `any` types permitted. Strict mode enforced.
 */

// ============================================================================
// ENUMS
// ============================================================================

export enum MessageType {
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

export type UIFramework = 'constellation' | 'classic' | 'cosmos' | 'unknown';

export type PiiCategory = 'NAME' | 'SSN' | 'DOB' | 'EMAIL' | 'PHONE' | 'ACCOUNT' | 'ADDRESS' | 'INCOME' | null;

export type FieldType = 'text' | 'number' | 'date' | 'dropdown' | 'checkbox' | 'textarea' | 'radio' | 'unknown';

export type ActionType =
  | 'submit'
  | 'save'
  | 'next'
  | 'cancel'
  | 'escalate'
  | 'assign'
  | 'review'
  | 'reopen'
  | 'hold'
  | 'delete'
  | 'generic';

export type PlanActionType =
  // Basic Actions (Existing)
  | 'CLICK'
  | 'TYPE'
  | 'SELECT'
  | 'CLEAR'
  | 'NAVIGATE'
  | 'WAIT'
  | 'SCROLL'
  // Smart Waiting (NEW)
  | 'WAIT_FOR_ELEMENT'
  | 'WAIT_FOR_VISIBLE'
  | 'WAIT_FOR_ENABLED'
  | 'WAIT_FOR_HIDDEN'
  | 'WAIT_FOR_TEXT'
  // Advanced Interactions (NEW)
  | 'HOVER'
  | 'DOUBLE_CLICK'
  | 'RIGHT_CLICK'
  | 'PRESS_KEY'
  | 'DRAG_DROP'
  // Validation (NEW)
  | 'ASSERT_VISIBLE'
  | 'ASSERT_ENABLED'
  | 'ASSERT_TEXT'
  | 'ASSERT_VALUE';

export type IntentType =
  | 'SUMMARIZE_CASE'
  | 'UPDATE_FIELD'
  | 'SUBMIT_CASE'
  | 'SAVE_CASE'
  | 'NEXT_STEP'
  | 'OPEN_CASE'
  | 'SHOW_QUEUE'
  | 'ESCALATE'
  | 'CREATE_CASE'
  | 'SEARCH'
  | 'EXPLAIN'
  | 'AMBIGUOUS'
  | 'UNKNOWN';

export type OutcomeType = 'success' | 'partial' | 'failed' | 'cancelled' | 'complete';

// ============================================================================
// INTERFACES
// ============================================================================

export interface PegaDetectionResult {
  isPega: boolean;
  confidence: number;
  uiFramework: UIFramework;
  version: string;
  appName?: string;
}

export interface CaseContext {
  caseId: string | null;
  caseClass: string | null;
  caseType: string | null;
  status: string | null;
  urgency: string | null;
  assignedTo: string | null;
  slaDeadline: string | null;
  stageName: string | null;
  domain: string | null;
}

export interface ParsedField {
  testId: string | null;
  label: string | null;
  value: string | null;
  piiCategory: PiiCategory;
  piiToken: string | null;
  fieldType: FieldType;
  isEditable: boolean;
  isRequired: boolean;
  selector: string;
  semantic: string | null;
  pegaPropertyType: string | null;
}

export interface ParsedAction {
  label: string;
  testId: string | null;
  selector: string;
  actionType: ActionType;
  isDisabled: boolean;
  requiresConfirmation: boolean;
  isFlowAction: boolean;
  isLocalAction: boolean;
  isBulkAction: boolean;
}

export interface DOMSnapshot {
  timestamp: number;
  url: string;
  triggerSummary: boolean;
  caseContext: CaseContext;
  fields: ParsedField[];
  actions: ParsedAction[];
  pageTitle: string;
  breadcrumbs: string[];
}

export interface SessionContext {
  sessionId: string;
  tabId: number;
  userId: string | null;
  userRole: string | null;
  pegaDetection: PegaDetectionResult | null;
  currentSnapshot: DOMSnapshot | null;
  navigationHistory: string[];
  initiatedAt: number;
}

export interface IntentClassification {
  intent: IntentType;
  confidence: number;
  requiresLLM: boolean;
}

export interface PlanStep {
  stepNumber: number;
  action: PlanActionType;
  selector: string;
  value?: string;
  description: string;
  isReversible: boolean;
}

export interface ActionPlan {
  planId: string;
  intent: IntentType;
  summary: string;
  requiresConfirmation: boolean;
  steps: PlanStep[];
  expectedOutcome: string;
  createdAt: number;
}

export interface CaseSummary {
  caseId: string;
  caseType: string;
  situation: string;
  history: string;
  currentState: string;
  riskSignals: string[];
  recommendedNextAction: string | null;
  generatedAt: number;
  confidence: number;
  model: string;
}

export interface AuditEntry {
  entryId: string;
  timestamp: string;
  sessionId: string;
  userId: string | null;
  caseId: string | null;
  eventType: string;
  intent: IntentType | null;
  planSummary: string | null;
  stepCount: number | null;
  outcome: OutcomeType | null;
  errorMessage: string | null;
}

export interface LLMResponse {
  content: string;
  model: string;
  tokensUsed: number;
  latencyMs: number;
  provider?: LLMProvider;
}

export interface StepResult {
  stepNumber: number;
  action: PlanActionType;
  success: boolean;
  errorMessage?: string;
  executionTimeMs: number;
  retryCount?: number;
  screenshot?: string; // Base64 screenshot on failure
}

export interface ExecutionResult {
  status: 'complete' | 'partial' | 'failed';
  results: StepResult[];
  totalExecutionTimeMs: number;
  screenshot?: string; // Base64 screenshot on failure
}

// ============================================================================
// AUTOMATION INTERFACES (NEW)
// ============================================================================

/**
 * Condition types for smart waiting and assertions
 */
export type WaitConditionType = 'exists' | 'visible' | 'enabled' | 'hidden' | 'text' | 'value';

/**
 * Configuration for smart wait operations
 */
export interface WaitCondition {
  type: WaitConditionType;
  selector: string;
  expectedValue?: string;
  timeoutMs?: number;
  pollingIntervalMs?: number;
}

/**
 * Retry configuration for action execution
 */
export interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  screenshotOnFailure: boolean;
}

/**
 * Default retry configuration
 */
export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  screenshotOnFailure: true,
};

/**
 * Extended plan step with wait conditions
 */
export interface ExtendedPlanStep extends PlanStep {
  waitCondition?: WaitCondition;
  retryConfig?: RetryConfig;
  continueOnError?: boolean;
}

// ============================================================================
// WORKFLOW CONTROL INTERfaces (NEW)
// ============================================================================

/**
 * Condition for conditional execution
 */
export interface ConditionExpression {
  type: 'element_exists' | 'element_visible' | 'element_enabled' | 'text_contains' | 'value_equals';
  selector: string;
  expectedValue?: string | boolean;
  negate?: boolean;
}

/**
 * Conditional step - execute steps based on condition
 */
export interface ConditionalStep extends PlanStep {
  condition: ConditionExpression;
  thenSteps: PlanStep[];
  elseSteps?: PlanStep[];
}

/**
 * Loop step - repeat steps until exit condition is met
 */
export interface LoopStep extends PlanStep {
  maxIterations: number;
  exitCondition: ConditionExpression;
  steps: PlanStep[];
}

/**
 * Try step with backoff configuration
 */
export interface TryStep extends PlanStep {
  maxRetries: number;
  initialDelayMs: number;
  backoffMultiplier: number;
  screenshotOnFailure: boolean;
}

// ============================================================================
// CONFIG INTERFACES
// ============================================================================

export interface SecurityConfig {
  piiMaskingEnabled: boolean;
  piiCategoriesToMask: string[];
  localProcessingOnly: boolean;
  allowedLLMProviders: string[];
  auditLoggingEnabled: boolean;
  requireConfirmationForAllActions: boolean;
  disabledCapabilities: IntentType[];
}

export type LLMProvider = 'azure-openai' | 'openai' | 'anthropic' | 'local' | 'google' | 'mistral';

export interface LLMConfig {
  provider: LLMProvider;
  endpoint: string;
  model: string;
  apiVersion?: string;
  maxTokens: number;
  temperature: number;
  apiKey?: string;
  enabled?: boolean;
  priority?: number; // For fallback ordering (lower = higher priority)
}

export interface MultiLLMConfig {
  providers: LLMConfig[];
  fallbackEnabled: boolean;
  maxRetries: number;
  timeoutMs: number;
}

export interface CDHConfig {
  enabled: boolean;
  endpoint?: string;
  containerName?: string;
}

export interface PegaConfig {
  targetDomains: string[];
  pegaApiBaseUrl?: string;
  useDirectAPI: boolean;
  cdh?: CDHConfig;
}

export interface EnterpriseConfig {
  version: string;
  security: SecurityConfig;
  llm: LLMConfig; // Primary provider (backward compatible)
  llmMulti?: MultiLLMConfig; // Multi-provider support
  pega: PegaConfig;
  roleRestrictions: Record<string, IntentType[] | ['*']>;
}

// ============================================================================
// MESSAGE INTERFACES
// ============================================================================

export interface Message<T = unknown> {
  type: MessageType;
  payload: T;
  metadata: MessageMetadata;
}

export interface MessageMetadata {
  timestamp: number;
  sessionId?: string;
  tabId?: number;
  correlationId?: string;
}

export interface PegaDetectedPayload {
  isDetected: boolean;
  confidence: number;
  framework: UIFramework;
  version: string;
  applicationName?: string;
  url: string;
}

export interface DomSnapshotPayload {
  snapshot: DOMSnapshot;
  triggerSummary: boolean;
}

export interface UserCommandPayload {
  command: string;
  context?: Record<string, unknown>;
}

export interface FeedbackPayload {
  type: 'positive' | 'negative' | 'neutral';
  context?: string;
  caseId?: string;
}

export interface ExecutionPayload {
  plan: ActionPlan;
}

export interface ActionResultPayload {
  planId: string;
  result: ExecutionResult;
}

// ============================================================================
// ERROR TYPES
// ============================================================================

export class PegaAgentError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'PegaAgentError';
  }
}

export class LLMProviderError extends PegaAgentError {
  constructor(message: string, provider: string, cause?: Error) {
    super(message, `LLM_${provider.toUpperCase()}_ERROR`, cause);
    this.name = 'LLMProviderError';
  }
}

export class LLMTimeoutError extends PegaAgentError {
  constructor(message: string = 'LLM request timed out') {
    super(message, 'LLM_TIMEOUT_ERROR');
    this.name = 'LLMTimeoutError';
  }
}

export class LLMInvalidResponseError extends PegaAgentError {
  constructor(message: string = 'Invalid LLM response format') {
    super(message, 'LLM_INVALID_RESPONSE');
    this.name = 'LLMInvalidResponseError';
  }
}

export class PlanParseError extends PegaAgentError {
  constructor(message: string = 'Failed to parse action plan') {
    super(message, 'PLAN_PARSE_ERROR');
    this.name = 'PlanParseError';
  }
}

export class SelectorNotFoundError extends PegaAgentError {
  constructor(selector: string) {
    super(`Selector not found: ${selector}`, 'SELECTOR_NOT_FOUND');
    this.name = 'SelectorNotFoundError';
  }
}

export class PermissionDeniedError extends PegaAgentError {
  constructor(action: string, role: string) {
    super(`Permission denied: ${action} for role ${role}`, 'PERMISSION_DENIED');
    this.name = 'PermissionDeniedError';
  }
}

// ============================================================================
// AUTOMATION ERROR TYPES (NEW)
// ============================================================================

/**
 * Element not found after timeout
 */
export class ElementNotFoundError extends PegaAgentError {
  constructor(
    selector: string,
    public readonly timeoutMs: number
  ) {
    super(
      `Element not found after ${timeoutMs}ms: ${selector}`,
      'ELEMENT_NOT_FOUND'
    );
    this.name = 'ElementNotFoundError';
  }
}

/**
 * Element found but not interactive (not clickable/editable)
 */
export class ElementNotInteractiveError extends PegaAgentError {
  constructor(
    selector: string,
    public readonly reason: 'not_visible' | 'disabled' | 'obscured' | 'not_editable'
  ) {
    super(
      `Element not interactive (${reason}): ${selector}`,
      'ELEMENT_NOT_INTERACTIVE'
    );
    this.name = 'ElementNotInteractiveError';
  }
}

/**
 * Operation timed out
 */
export class AutomationTimeoutError extends PegaAgentError {
  constructor(
    operation: string,
    public readonly timeoutMs: number
  ) {
    super(
      `Operation "${operation}" timed out after ${timeoutMs}ms`,
      'AUTOMATION_TIMEOUT'
    );
    this.name = 'AutomationTimeoutError';
  }
}

/**
 * Assertion/validation failed
 */
export class ValidationError extends PegaAgentError {
  constructor(
    public readonly assertion: string,
    public readonly expected: string,
    public readonly actual: string
  ) {
    super(
      `Assertion failed: ${assertion}. Expected: ${expected}, Actual: ${actual}`,
      'VALIDATION_ERROR'
    );
    this.name = 'ValidationError';
  }
}

// ============================================================================
// AGENTIC TYPES (NEW)
// ============================================================================

/**
 * Screenshot data with metadata
 */
export interface ScreenshotData {
  base64: string;
  timestamp: number;
  viewportWidth: number;
  viewportHeight: number;
  scrollX: number;
  scrollY: number;
  url: string;
}

/**
 * Visual analysis result from multimodal LLM
 */
export interface VisualAnalysis {
  description: string;
  pageType: 'case_view' | 'case_list' | 'dashboard' | 'assignment' | 'error_page' | 'loading' | 'unknown';
  keyElements: VisualElement[];
  issues: VisualIssue[];
  recommendedActions: string[];
  confidence: number;
}

/**
 * Visual element detected on page
 */
export interface VisualElement {
  type: 'button' | 'input' | 'dropdown' | 'table' | 'form' | 'alert' | 'modal' | 'section';
  description: string;
  location: { x: number; y: number; width: number; height: number };
  text?: string;
  isActionable: boolean;
}

/**
 * Visual issue detected on page
 */
export interface VisualIssue {
  severity: 'error' | 'warning' | 'info';
  description: string;
  element?: string;
  suggestedFix?: string;
}

/**
 * Workflow definition for multi-step automation
 */
export interface Workflow {
  workflowId: string;
  name: string;
  description: string;
  trigger: WorkflowTrigger;
  steps: WorkflowStep[];
  onError: 'stop' | 'skip' | 'retry';
  maxRetries: number;
  timeout: number;
  createdAt: number;
}

/**
 * Trigger conditions for workflows
 */
export interface WorkflowTrigger {
  type: 'manual' | 'case_opened' | 'stage_changed' | 'sla_breach' | 'field_changed' | 'scheduled';
  conditions?: WorkflowCondition[];
}

/**
 * Condition for workflow triggers
 */
export interface WorkflowCondition {
  field: string;
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'exists';
  value: string | number;
}

/**
 * Workflow step with conditional execution
 */
export interface WorkflowStep extends PlanStep {
  id: string;
  condition?: ConditionExpression;
  onErrorStep?: string; // Step ID to jump to on error
  timeout?: number;
  screenshot?: boolean; // Capture screenshot after this step
}

/**
 * Workflow execution state
 */
export interface WorkflowExecution {
  executionId: string;
  workflowId: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  currentStep: number;
  completedSteps: string[];
  failedSteps: string[];
  startTime: number;
  endTime?: number;
  error?: string;
  screenshots: ScreenshotData[];
  results: StepResult[];
}

/**
 * Case state for tracking across navigation
 */
export interface CaseState {
  caseId: string;
  caseType: string;
  status: string;
  stage: string;
  lastUpdated: number;
  fields: Record<string, { value: string; lastModified: number }>;
  history: CaseStateChange[];
  pendingActions: string[];
  slaStatus?: {
    goal: string;
    deadline: string;
    isBreached: boolean;
    timeRemaining?: number;
  };
}

/**
 * Case state change event
 */
export interface CaseStateChange {
  timestamp: number;
  changeType: 'stage_change' | 'field_update' | 'status_change' | 'assignment_change';
  description: string;
  previousValue?: string;
  newValue?: string;
  actor?: string;
}

/**
 * Self-healing action
 */
export interface SelfHealingAction {
  type: 'retry' | 'alternative_selector' | 'wait_and_retry' | 'skip' | 'escalate';
  reason: string;
  originalSelector?: string;
  alternativeSelector?: string;
  delayMs?: number;
  maxAttempts?: number;
}

/**
 * Enhanced action plan with self-healing
 */
export interface EnhancedActionPlan extends ActionPlan {
  workflowId?: string;
  selfHealing?: SelfHealingAction[];
  rollbackSteps?: PlanStep[];
  validationPoints?: ValidationPoint[];
}

/**
 * Validation checkpoint during execution
 */
export interface ValidationPoint {
  afterStep: number;
  conditions: ConditionExpression[];
  onFailure: 'stop' | 'warn' | 'continue';
}

/**
 * Agentic context passed to LLM
 */
export interface AgenticContext {
  caseContext: CaseContext;
  fields: ParsedField[];
  actions: ParsedAction[];
  caseState?: CaseState;
  visualContext?: VisualAnalysis;
  recentHistory: string[];
  userIntent: string;
  pegaContext?: {
    uiFramework: string;
    version: string;
    appName?: string;
  };
}

/**
 * Enhanced summary with actionable insights
 */
export interface EnhancedCaseSummary extends CaseSummary {
  // What needs to happen
  immediateActions: ActionableAction[];
  // What could go wrong
  riskAssessment: RiskAssessment;
  // How long it might take
  estimatedResolution?: {
    minMinutes: number;
    maxMinutes: number;
    factors: string[];
  };
  // Who should be involved
  stakeholders?: string[];
  // What data is missing
  missingInformation: string[];
  // Similar cases
  relatedCases?: {
    caseId: string;
    similarity: string;
    outcome: string;
  }[];
}

/**
 * Actionable action for the user
 */
export interface ActionableAction {
  action: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  estimatedTime: string;
  automationAvailable: boolean;
  reason: string;
}

/**
 * Risk assessment for the case
 */
export interface RiskAssessment {
  overallRisk: 'high' | 'medium' | 'low';
  factors: {
    factor: string;
    severity: 'high' | 'medium' | 'low';
    mitigation: string;
  }[];
  slaRisk?: {
    level: 'breached' | 'at_risk' | 'on_track';
    timeToDeadline?: number;
  };
}
