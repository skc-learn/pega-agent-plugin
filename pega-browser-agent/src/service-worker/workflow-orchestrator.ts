/**
 * Workflow Orchestrator - Multi-step Automation with Self-Healing
 *
 * Provides Playwright/Stagehand-style workflow capabilities:
 * - Multi-step workflow execution
 * - Self-healing with retries and alternative selectors
 * - Conditional execution
 * - State management across steps
 */

import type {
  Workflow,
  WorkflowStep,
  WorkflowExecution,
  StepResult,
  CaseContext,
  DOMSnapshot,
  PlanStep,
  SelfHealingAction,
} from '../shared/types';
import { visualUnderstanding } from './visual-understanding';
import { llmAdapter } from './llm-adapter';

// ============================================================================
// WORKFLOW EXECUTOR
// ============================================================================

interface ActiveWorkflow {
  execution: WorkflowExecution;
  workflow: Workflow;
  tabId: number;
  startTime: number;
}

// Store active workflows by tab ID
const activeWorkflows = new Map<number, ActiveWorkflow>();

/**
 * Execute a workflow on a tab
 */
export async function executeWorkflow(
  workflow: Workflow,
  tabId: number,
  _initialContext: { caseContext: CaseContext | null; snapshot: DOMSnapshot | null }
): Promise<WorkflowExecution> {
  const execution: WorkflowExecution = {
    executionId: `wf-exec-${Date.now()}`,
    workflowId: workflow.workflowId,
    status: 'running',
    currentStep: 0,
    completedSteps: [],
    failedSteps: [],
    startTime: Date.now(),
    screenshots: [],
    results: [],
  };

  activeWorkflows.set(tabId, {
    execution,
    workflow,
    tabId,
    startTime: Date.now(),
  });

  try {
    for (let i = 0; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      if (!step) continue;
      
      execution.currentStep = i;

      // Check if workflow is paused or cancelled
      if (execution.status === 'paused' || execution.status === 'cancelled') {
        break;
      }

      // Check condition if present
      if (step.condition && !await evaluateCondition(step.condition, tabId)) {
        console.log(`[Workflow] Step ${i} condition not met, skipping`);
        continue;
      }

      // Execute step with self-healing
      const result = await executeStepWithHealing(step, tabId, workflow.maxRetries);

      if (result.success) {
        execution.completedSteps.push(step.id);
        execution.results.push(result);
      } else {
        execution.failedSteps.push(step.id);
        execution.results.push(result);

        // Capture failure screenshot
        const screenshot = await visualUnderstanding.captureFailure(tabId);
        if (screenshot) {
          execution.screenshots.push(screenshot);
        }

        // Handle error based on workflow config
        if (workflow.onError === 'stop') {
          execution.status = 'failed';
          execution.error = result.errorMessage ?? 'Step failed';
          break;
        } else if (workflow.onError === 'skip') {
          console.log(`[Workflow] Step ${i} failed, skipping`);
          continue;
        }
        // 'retry' is already handled in executeStepWithHealing
      }

      // Capture screenshot if requested
      if (step.screenshot) {
        const screenshot = await visualUnderstanding.captureScreenshot(tabId);
        if (screenshot) {
          execution.screenshots.push(screenshot);
        }
      }
    }

    if (execution.status === 'running') {
      execution.status = 'completed';
    }
  } catch (error) {
    execution.status = 'failed';
    execution.error = error instanceof Error ? error.message : 'Unknown error';
  } finally {
    execution.endTime = Date.now();
    activeWorkflows.delete(tabId);
  }

  return execution;
}

/**
 * Execute a step with self-healing capabilities
 */
async function executeStepWithHealing(
  step: WorkflowStep,
  tabId: number,
  maxRetries: number
): Promise<StepResult> {
  const startTime = Date.now();
  let lastError: string | undefined;

  // Build self-healing actions
  const healingActions = generateSelfHealingActions(step);

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Try to execute the step
      const result = await executeStepInContentScript(tabId, step);
      
      if (result.success) {
        return result;
      }

      lastError = result.errorMessage;

      // Try self-healing if step failed
      if (attempt < maxRetries - 1 && healingActions.length > 0) {
        const healingResult = await applySelfHealing(tabId, step, healingActions, lastError);
        if (healingResult && healingResult.alternativeSelector) {
          // Retry with healed selector
          const retryResult = await executeStepInContentScript(tabId, {
            ...step,
            selector: healingResult.alternativeSelector,
          });
          if (retryResult.success) {
            return retryResult;
          }
        }
      }

      // Wait before retry
      if (attempt < maxRetries - 1) {
        await sleep(500 * (attempt + 1));
      }
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Unknown error';
    }
  }

  return {
    stepNumber: step.stepNumber,
    action: step.action,
    success: false,
    errorMessage: lastError ?? 'Step failed after all retries',
    executionTimeMs: Date.now() - startTime,
    retryCount: maxRetries,
  };
}

/**
 * Generate self-healing actions for a step
 */
function generateSelfHealingActions(step: WorkflowStep): SelfHealingAction[] {
  const actions: SelfHealingAction[] = [];

  // Generate alternative selectors based on step metadata
  if (step.selector) {
    // Try data-testid variations
    const testIdMatch = step.selector.match(/\[data-testid="([^"]+)"\]/);
    if (testIdMatch && testIdMatch[1]) {
      actions.push({
        type: 'alternative_selector',
        reason: 'Try alternative selector with aria-label',
        originalSelector: step.selector,
        alternativeSelector: `[aria-label*="${testIdMatch[1]}"]`,
      });
    }

    // Try text-based selector
    if (step.description) {
      actions.push({
        type: 'alternative_selector',
        reason: 'Try text-based selector',
        originalSelector: step.selector,
        alternativeSelector: `text=${step.description}`,
      });
    }
  }

  // Add wait and retry action
  actions.push({
    type: 'wait_and_retry',
    reason: 'Element may not be ready yet',
    delayMs: 1000,
    maxAttempts: 3,
  });

  return actions;
}

/**
 * Apply a self-healing action
 */
async function applySelfHealing(
  _tabId: number,
  step: WorkflowStep,
  actions: SelfHealingAction[],
  errorMessage: string | undefined
): Promise<SelfHealingAction | null> {
  // Use LLM to analyze the error and suggest healing
  const prompt = `A step in a Pega workflow failed. Analyze the error and suggest the best healing action.

Step: ${step.action} - ${step.description}
Original Selector: ${step.selector}
Error: ${errorMessage ?? 'Unknown error'}

Available healing actions:
${actions.map((a, i) => `${i + 1}. ${a.type}: ${a.reason}`).join('\n')}

Which action should we try? Reply with just the action number or "skip" if none will help.`;

  try {
    const response = await llmAdapter.complete(
      'You are a Pega automation expert helping with self-healing. Reply with just the action number or "skip".',
      prompt
    );

    const choice = response.content.trim();
    if (choice === 'skip') {
      return null;
    }

    const actionIndex = parseInt(choice) - 1;
    if (actionIndex >= 0 && actionIndex < actions.length) {
      return actions[actionIndex] ?? null;
    }
  } catch (error) {
    console.error('[Workflow] Self-healing analysis failed:', error);
  }

  // Default to first action if LLM fails
  return actions[0] ?? null;
}

/**
 * Execute a step in the content script
 */
async function executeStepInContentScript(
  tabId: number,
  step: PlanStep
): Promise<StepResult> {
  const startTime = Date.now();

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'EXECUTE_STEP',
      payload: { step },
    });

    return {
      stepNumber: step.stepNumber,
      action: step.action,
      success: response?.success ?? false,
      errorMessage: response?.error,
      executionTimeMs: Date.now() - startTime,
    };
  } catch (error) {
    return {
      stepNumber: step.stepNumber,
      action: step.action,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Failed to execute step',
      executionTimeMs: Date.now() - startTime,
    };
  }
}

/**
 * Evaluate a condition for conditional execution
 */
async function evaluateCondition(
  condition: WorkflowStep['condition'],
  tabId: number
): Promise<boolean> {
  if (!condition) return true;

  try {
    const response = await chrome.tabs.sendMessage(tabId, {
      type: 'EVALUATE_CONDITION',
      payload: { condition },
    });

    return response?.result ?? false;
  } catch {
    return false;
  }
}

// ============================================================================
// WORKFLOW CREATION
// ============================================================================

/**
 * Create a workflow from an action plan
 */
export function createWorkflowFromPlan(
  plan: { planId: string; intent: string; summary: string; steps: PlanStep[]; expectedOutcome: string },
  options: {
    name?: string;
    onError?: 'stop' | 'skip' | 'retry';
    maxRetries?: number;
  } = {}
): Workflow {
  const workflowSteps: WorkflowStep[] = plan.steps.map((step, index) => ({
    ...step,
    id: `step-${index}`,
    stepNumber: step.stepNumber,
    timeout: 10000,
    screenshot: false,
  }));

  return {
    workflowId: `wf-${plan.planId}`,
    name: options.name ?? plan.summary,
    description: plan.summary,
    trigger: { type: 'manual' },
    steps: workflowSteps,
    onError: options.onError ?? 'retry',
    maxRetries: options.maxRetries ?? 3,
    timeout: 60000,
    createdAt: Date.now(),
  };
}

/**
 * Create a workflow from natural language description
 */
export async function createWorkflowFromDescription(
  description: string,
  snapshot: DOMSnapshot
): Promise<Workflow | null> {
  const prompt = `Create a Pega workflow from this description: "${description}"

Available page elements:
${snapshot.fields.map(f => `- ${f.label}: ${f.fieldType} (${f.selector})`).join('\n')}
${snapshot.actions.map(a => `- ${a.label}: ${a.actionType} (${a.selector})`).join('\n')}

Reply with JSON matching this schema:
{
  "name": "Workflow name",
  "description": "What this workflow does",
  "steps": [
    {
      "action": "CLICK|TYPE|SELECT|WAIT|SCROLL",
      "selector": "CSS selector",
      "value": "optional value for TYPE/SELECT",
      "description": "What this step does"
    }
  ],
  "onError": "stop|skip|retry",
  "maxRetries": 3
}`;

  try {
    const response = await llmAdapter.complete(
      'You are a Pega workflow expert. Create efficient, robust workflows.',
      prompt
    );

    const parsed = JSON.parse(response.content) as {
      name: string;
      description: string;
      steps: Array<{
        action: string;
        selector: string;
        value?: string;
        description: string;
      }>;
      onError: 'stop' | 'skip' | 'retry';
      maxRetries: number;
    };

    const workflowSteps: WorkflowStep[] = parsed.steps.map((step, index) => ({
      id: `step-${index}`,
      stepNumber: index + 1,
      action: step.action as WorkflowStep['action'],
      selector: step.selector,
      value: step.value,
      description: step.description,
      isReversible: false,
      timeout: 10000,
      screenshot: false,
    }));

    return {
      workflowId: `wf-${Date.now()}`,
      name: parsed.name,
      description: parsed.description,
      trigger: { type: 'manual' },
      steps: workflowSteps,
      onError: parsed.onError,
      maxRetries: parsed.maxRetries,
      timeout: 60000,
      createdAt: Date.now(),
    };
  } catch (error) {
    console.error('[Workflow] Failed to create workflow:', error);
    return null;
  }
}

// ============================================================================
// WORKFLOW CONTROL
// ============================================================================

/**
 * Pause a running workflow
 */
export function pauseWorkflow(tabId: number): boolean {
  const active = activeWorkflows.get(tabId);
  if (active && active.execution.status === 'running') {
    active.execution.status = 'paused';
    return true;
  }
  return false;
}

/**
 * Resume a paused workflow
 */
export function resumeWorkflow(tabId: number): boolean {
  const active = activeWorkflows.get(tabId);
  if (active && active.execution.status === 'paused') {
    active.execution.status = 'running';
    return true;
  }
  return false;
}

/**
 * Cancel a running workflow
 */
export function cancelWorkflow(tabId: number): boolean {
  const active = activeWorkflows.get(tabId);
  if (active && (active.execution.status === 'running' || active.execution.status === 'paused')) {
    active.execution.status = 'cancelled';
    return true;
  }
  return false;
}

/**
 * Get workflow status
 */
export function getWorkflowStatus(tabId: number): WorkflowExecution | null {
  return activeWorkflows.get(tabId)?.execution ?? null;
}

// ============================================================================
// UTILITIES
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ============================================================================
// EXPORT
// ============================================================================

export const workflowOrchestrator = {
  execute: executeWorkflow,
  createFromPlan: createWorkflowFromPlan,
  createFromDescription: createWorkflowFromDescription,
  pause: pauseWorkflow,
  resume: resumeWorkflow,
  cancel: cancelWorkflow,
  getStatus: getWorkflowStatus,
};

console.log('[Workflow] Orchestrator module loaded');
