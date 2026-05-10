/**
 * Action Executor - Execute ActionPlan against the live DOM
 *
 * Executes validated plans with PII de-tokenization at execution time only.
 * Uses native input setters to trigger Pega's change detection.
 *
 * Enhanced with Stagehand-inspired smart automation:
 * - Smart waiting for elements
 * - Advanced interactions (hover, double-click, etc.)
 * - Validation/assertion actions
 * - Robust error handling with retries
 */

import type {
  ActionPlan,
  PlanStep,
  StepResult,
  ExecutionResult,
  PlanActionType,
} from '../shared/types';
import {
  ElementNotFoundError,
  ElementNotInteractiveError,
  AutomationTimeoutError,
  ValidationError,
} from '../shared/types';
import { piiMasker } from './pii-masker';

// ============================================================================
// CONSTANTS
// ============================================================================

const STEP_DELAY_MS = 300;

// Smart wait defaults
const DEFAULT_WAIT_TIMEOUT_MS = 5000;
const DEFAULT_POLLING_INTERVAL_MS = 100;

// ============================================================================
// RETRY CONFIGURATION
// ============================================================================

interface RetryConfig {
  maxRetries: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  screenshotOnFailure: boolean;
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  initialDelayMs: 500,
  maxDelayMs: 5000,
  backoffMultiplier: 2,
  screenshotOnFailure: true,
};

interface RetryLog {
  attempt: number;
  maxAttempts: number;
  error: Error | null;
  timestamp: number;
  willRetry: boolean;
}

// ============================================================================
// SCREENSHOT CAPTURE
// ============================================================================

/**
 * Capture screenshot of page or element
 * Note: For full page screenshots in content scripts, we capture viewport.
 * For element-specific screenshots, we highlight the element area.
 * Full screenshots require chrome.tabs.captureVisibleTab which must be called
 * from the background script.
 */
async function captureScreenshot(
  selector?: string,
  options: { fullPage?: boolean } = {}
): Promise<string> {
  const canvas = document.createElement('canvas');

  try {
    let target: HTMLElement | null = null;

    if (selector && !options.fullPage) {
      target = document.querySelector<HTMLElement>(selector);
    }

    if (!target && !options.fullPage) {
      throw new Error('Element not found for screenshot');
    }

    // Set canvas dimensions
    const rect = target?.getBoundingClientRect() ?? document.body.getBoundingClientRect();
    canvas.width = options.fullPage ? window.innerWidth : rect.width;
    canvas.height = options.fullPage ? window.innerHeight : rect.height;

    // Draw content
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Note: Direct DOM-to-canvas rendering is not supported for arbitrary elements.
    // This creates a placeholder indicating screenshot location.
    // For actual screenshots, use chrome.tabs.captureVisibleTab from background script.
    if (target) {
      ctx.strokeStyle = '#ff0000';
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, canvas.width - 2, canvas.height - 2);
      ctx.fillStyle = '#333333';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Screenshot: ${selector}`, 10, 20);
    }

    return canvas.toDataURL('image/png');
  } finally {
    canvas.remove();
  }
}

// ============================================================================
// RETRY WITH EXPONENTIAL BACKOFF
// ============================================================================

/**
 * Execute with retry using exponential backoff
 */
async function executeWithRetry<T>(
  operation: () => Promise<T>,
  config: Partial<RetryConfig> = {}
): Promise<T> {
  const mergedConfig = { ...DEFAULT_RETRY_CONFIG, ...config };
  const {
    maxRetries,
    initialDelayMs,
    maxDelayMs,
    backoffMultiplier,
  } = mergedConfig;

  const retryLog: RetryLog[] = [];
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      retryLog.push({
        attempt: attempt + 1,
        maxAttempts: maxRetries,
        error: null,
        timestamp: Date.now(),
        willRetry: false,
      });

      const result = await operation();
      return result;
    } catch (error) {
      const isLastAttempt = attempt === maxRetries - 1;
      lastError = error instanceof Error ? error : new Error(String(error));

      retryLog.push({
        attempt: attempt + 1,
        maxAttempts: maxRetries,
        error: lastError,
        timestamp: Date.now(),
        willRetry: !isLastAttempt,
      });

      if (isLastAttempt) {
        throw lastError;
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        initialDelayMs * Math.pow(backoffMultiplier, attempt),
        maxDelayMs
      );

      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error(`Operation failed after ${maxRetries} attempts`);
}

/**
 * Execute a single step with retry support
 */
async function executeStepWithRetry(
  step: PlanStep,
  config: RetryConfig = DEFAULT_RETRY_CONFIG
): Promise<StepResult> {
  const startTime = performance.now();
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < config.maxRetries; attempt++) {
    try {
      const result = await executeStep(step);
      if (result.success) {
        return result;
      }
      lastError = new Error(result.errorMessage ?? 'Step execution failed');
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
    }

    // Calculate delay with exponential backoff
    const delay = Math.min(
      config.initialDelayMs * Math.pow(config.backoffMultiplier, attempt),
      config.maxDelayMs
    );

    // Wait before next attempt (except on last attempt)
    if (attempt < config.maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // Capture screenshot on final failure if configured
  let screenshot: string | undefined;
  if (config.screenshotOnFailure) {
    try {
      screenshot = await captureScreenshot(step.selector, { fullPage: false });
    } catch {
      // Ignore screenshot capture errors
    }
  }

  return {
    stepNumber: step.stepNumber,
    action: step.action,
    success: false,
    errorMessage: lastError?.message ?? 'Unknown error',
    executionTimeMs: performance.now() - startTime,
    retryCount: config.maxRetries,
    screenshot,
  };
}

// ============================================================================
// ACTION EXECUTORS
// ============================================================================

/**
 * Execute CLICK action
 * Uses focus + click for proper Pega event handling
 */
async function executeClick(element: HTMLElement): Promise<void> {
  element.focus();
  await new Promise((resolve) => setTimeout(resolve, 50));
  element.click();
}

/**
 * Execute TYPE action
 * CRITICAL: Must use native input setter to trigger Pega's React/Angular change detection
 * Standard .value = x does NOT trigger Pega's change detection
 */
async function executeType(element: HTMLInputElement | HTMLTextAreaElement, value: string): Promise<void> {
  // Get native input value setter
  const nativeInputSetter = Object.getOwnPropertyDescriptor(
    window.HTMLInputElement.prototype,
    'value'
  )?.set;

  const nativeTextAreaSetter = Object.getOwnPropertyDescriptor(
    window.HTMLTextAreaElement.prototype,
    'value'
  )?.set;

  const setter = element.tagName === 'TEXTAREA' ? nativeTextAreaSetter : nativeInputSetter;

  if (setter) {
    // Use native setter
    setter.call(element, value);
  } else {
    // Fallback to direct assignment
    element.value = value;
  }

  // Dispatch events for Pega's change detection
  element.dispatchEvent(new Event('input', { bubbles: true }));
  element.dispatchEvent(new Event('change', { bubbles: true }));
  element.blur();
}

/**
 * Execute SELECT action for dropdown
 */
async function executeSelect(element: HTMLSelectElement, value: string): Promise<void> {
  element.value = value;
  element.dispatchEvent(new Event('change', { bubbles: true }));
}

/**
 * Execute CLEAR action
 */
async function executeClear(element: HTMLInputElement | HTMLTextAreaElement): Promise<void> {
  await executeType(element, '');
}

/**
 * Execute NAVIGATE action
 */
async function executeNavigate(url: string): Promise<void> {
  window.location.href = url;
}

/**
 * Execute WAIT action
 */
async function executeWait(durationMs: number): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, durationMs));
}

/**
 * Execute SCROLL action
 */
async function executeScroll(element: HTMLElement): Promise<void> {
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise((resolve) => setTimeout(resolve, 200));
}

// ============================================================================
// SMART WAITING FUNCTIONS (NEW)
// ============================================================================

/**
 * Check if element is visible (not hidden)
 */
function elementIsVisible(element: HTMLElement): boolean {
  const style = window.getComputedStyle(element);
  return (
    style.display !== 'none' &&
    style.visibility !== 'hidden' &&
    element.offsetParent !== null
  );
}

/**
 * Check if element is enabled (not disabled)
 */
function elementIsEnabled(element: HTMLElement): boolean {
  return !(element as HTMLInputElement).disabled;
}

/**
 * Check if element text content matches expected value
 */
function elementTextMatches(element: HTMLElement, expectedValue: string): boolean {
  const text = element.textContent?.trim() ?? '';
  return text.includes(expectedValue);
}

/**
 * Wait for element to exist in DOM
 */
async function waitForElement(
  selector: string,
  timeoutMs: number = DEFAULT_WAIT_TIMEOUT_MS
): Promise<HTMLElement> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element) {
      return element;
    }
    await new Promise((resolve) => setTimeout(resolve, DEFAULT_POLLING_INTERVAL_MS));
  }

  throw new ElementNotFoundError(selector, timeoutMs);
}

/**
 * Wait for element to be visible
 */
async function waitForVisible(
  selector: string,
  timeoutMs: number = DEFAULT_WAIT_TIMEOUT_MS
): Promise<HTMLElement> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element && elementIsVisible(element)) {
      return element;
    }
    await new Promise((resolve) => setTimeout(resolve, DEFAULT_POLLING_INTERVAL_MS));
  }

  throw new ElementNotFoundError(selector, timeoutMs);
}

/**
 * Wait for element to be enabled
 */
async function waitForEnabled(
  selector: string,
  timeoutMs: number = DEFAULT_WAIT_TIMEOUT_MS
): Promise<HTMLElement> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element && elementIsEnabled(element)) {
      return element;
    }
    await new Promise((resolve) => setTimeout(resolve, DEFAULT_POLLING_INTERVAL_MS));
  }

  throw new ElementNotInteractiveError(selector, 'disabled');
}

/**
 * Wait for element to be hidden or removed
 */
async function waitForHidden(
  selector: string,
  timeoutMs: number = DEFAULT_WAIT_TIMEOUT_MS
): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const element = document.querySelector<HTMLElement>(selector);
    if (!element || !elementIsVisible(element)) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, DEFAULT_POLLING_INTERVAL_MS));
  }

  throw new AutomationTimeoutError(`wait for hidden: ${selector}`, timeoutMs);
}

/**
 * Wait for element text to match expected value
 */
async function waitForText(
  selector: string,
  expectedValue: string,
  timeoutMs: number = DEFAULT_WAIT_TIMEOUT_MS
): Promise<HTMLElement> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const element = document.querySelector<HTMLElement>(selector);
    if (element && elementTextMatches(element, expectedValue)) {
      return element;
    }
    await new Promise((resolve) => setTimeout(resolve, DEFAULT_POLLING_INTERVAL_MS));
  }

  throw new AutomationTimeoutError(`wait for text "${expectedValue}" on ${selector}`, timeoutMs);
}

// ============================================================================
// ADVANCED INTERACTION FUNCTIONS (NEW)
// ============================================================================

/**
 * Execute HOVER action - trigger mouseover event
 */
async function executeHover(element: HTMLElement): Promise<void> {
  element.scrollIntoView({ behavior: 'smooth', block: 'center' });
  await new Promise((resolve) => setTimeout(resolve, 100));

  const hoverEvent = new MouseEvent('mouseover', {
    bubbles: true,
    cancelable: true,
    view: window,
  });
  element.dispatchEvent(hoverEvent);

  // Also dispatch mouseenter for good measure
  const enterEvent = new MouseEvent('mouseenter', {
    bubbles: true,
    cancelable: true,
    view: window,
  });
  element.dispatchEvent(enterEvent);
}

/**
 * Execute DOUBLE_CLICK action
 */
async function executeDoubleClick(element: HTMLElement): Promise<void> {
  element.focus();
  await new Promise((resolve) => setTimeout(resolve, 50));
  element.dispatchEvent(new MouseEvent('dblclick', {
    bubbles: true,
    cancelable: true,
    view: window,
  }));
}

/**
 * Execute RIGHT_CLICK action - trigger context menu
 */
async function executeRightClick(element: HTMLElement): Promise<void> {
  element.focus();
  await new Promise((resolve) => setTimeout(resolve, 50));
  element.dispatchEvent(new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    view: window,
    clientX: element.getBoundingClientRect().left + 10,
    clientY: element.getBoundingClientRect().top + 10,
  }));
}

/**
 * Execute PRESS_KEY action - simulate keyboard input
 */
async function executePressKey(key: string): Promise<void> {
  const activeElement = document.activeElement as HTMLElement;
  if (!activeElement) {
    throw new Error('No active element to receive key press');
  }

  // Map common key names to key codes
  const keyMap: Record<string, { key: string; code: string }> = {
    'Enter': { key: 'Enter', code: 'Enter' },
    'Tab': { key: 'Tab', code: 'Tab' },
    'Escape': { key: 'Escape', code: 'Escape' },
    'Backspace': { key: 'Backspace', code: 'Backspace' },
    'Delete': { key: 'Delete', code: 'Delete' },
    'ArrowUp': { key: 'ArrowUp', code: 'ArrowUp' },
    'ArrowDown': { key: 'ArrowDown', code: 'ArrowDown' },
    'ArrowLeft': { key: 'ArrowLeft', code: 'ArrowLeft' },
    'ArrowRight': { key: 'ArrowRight', code: 'ArrowRight' },
    'Space': { key: ' ', code: 'Space' },
  };

  const keyInfo = keyMap[key] ?? { key, code: key };

  // Dispatch keydown event
  activeElement.dispatchEvent(new KeyboardEvent('keydown', {
    key: keyInfo.key,
    code: keyInfo.code,
    bubbles: true,
    cancelable: true,
  }));

  // Dispatch keypress event (for printable characters)
  if (key.length === 1) {
    activeElement.dispatchEvent(new KeyboardEvent('keypress', {
      key: keyInfo.key,
      bubbles: true,
      cancelable: true,
    }));
  }

  // Dispatch keyup event
  activeElement.dispatchEvent(new KeyboardEvent('keyup', {
    key: keyInfo.key,
    code: keyInfo.code,
    bubbles: true,
    cancelable: true,
  }));
}

/**
 * Execute DRAG_DROP action - drag element to target
 */
async function executeDragDrop(
  sourceElement: HTMLElement,
  targetSelector: string
): Promise<void> {
  const targetElement = document.querySelector<HTMLElement>(targetSelector);
  if (!targetElement) {
    throw new Error(`Drag target not found: ${targetSelector}`);
  }

  // Create drag event
  const dragStartEvent = new DragEvent('dragstart', {
    bubbles: true,
    cancelable: true,
    dataTransfer: new DataTransfer(),
  });
  sourceElement.dispatchEvent(dragStartEvent);

  // Simulate drag over target
  const dragOverEvent = new DragEvent('dragover', {
    bubbles: true,
    cancelable: true,
    dataTransfer: dragStartEvent.dataTransfer,
  });
  targetElement.dispatchEvent(dragOverEvent);

  // Drop on target
  const dropEvent = new DragEvent('drop', {
    bubbles: true,
    cancelable: true,
    dataTransfer: dragStartEvent.dataTransfer,
  });
  targetElement.dispatchEvent(dropEvent);

  // End drag
  const dragEndEvent = new DragEvent('dragend', {
    bubbles: true,
    cancelable: true,
    dataTransfer: dragStartEvent.dataTransfer,
  });
  sourceElement.dispatchEvent(dragEndEvent);
}

// ============================================================================
// VALIDATION FUNCTIONS (NEW)
// ============================================================================

/**
 * Execute ASSERT_VISIBLE - verify element is visible
 */
async function executeAssertVisible(selector: string): Promise<void> {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new ValidationError(
      `Element visible: ${selector}`,
      'element exists and is visible',
      'element not found'
    );
  }
  if (!elementIsVisible(element)) {
    throw new ValidationError(
      `Element visible: ${selector}`,
      'element is visible',
      'element is hidden'
    );
  }
}

/**
 * Execute ASSERT_ENABLED - verify element is enabled
 */
async function executeAssertEnabled(selector: string): Promise<void> {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new ValidationError(
      `Element enabled: ${selector}`,
      'element exists and is enabled',
      'element not found'
    );
  }
  if (!elementIsEnabled(element)) {
    throw new ValidationError(
      `Element enabled: ${selector}`,
      'element is enabled',
      'element is disabled'
    );
  }
}

/**
 * Execute ASSERT_TEXT - verify element text content
 */
async function executeAssertText(selector: string, expectedText: string): Promise<void> {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new ValidationError(
      `Element text: ${selector}`,
      expectedText,
      'element not found'
    );
  }
  const actualText = element.textContent?.trim() ?? '';
  if (!actualText.includes(expectedText)) {
    throw new ValidationError(
      `Element text: ${selector}`,
      expectedText,
      actualText
    );
  }
}

/**
 * Execute ASSERT_VALUE - verify element value (for inputs)
 */
async function executeAssertValue(selector: string, expectedValue: string): Promise<void> {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) {
    throw new ValidationError(
      `Element value: ${selector}`,
      expectedValue,
      'element not found'
    );
  }

  let actualValue: string;
  if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
    actualValue = element.value;
  } else if (element instanceof HTMLSelectElement) {
    actualValue = element.value;
  } else {
    throw new ValidationError(
      `Element value: ${selector}`,
      expectedValue,
      'element is not an input/select/textarea'
    );
  }

  if (actualValue !== expectedValue) {
    throw new ValidationError(
      `Element value: ${selector}`,
      expectedValue,
      actualValue
    );
  }
}

// ============================================================================
// ENHANCED SELECTOR RESOLUTION
// ============================================================================

/**
 * Find element with enhanced checks (visibility, interactivity)
 */
async function findElementEnhanced(
  selector: string,
  options: {
    mustBeVisible?: boolean;
    mustBeEnabled?: boolean;
    timeoutMs?: number;
  } = {}
): Promise<HTMLElement> {
  const {
    mustBeVisible = true,
    mustBeEnabled = false,
    timeoutMs = DEFAULT_WAIT_TIMEOUT_MS,
  } = options;

  const startTime = Date.now();
  let lastError: Error | null = null;

  while (Date.now() - startTime < timeoutMs) {
    const element = document.querySelector<HTMLElement>(selector);

    if (element) {
      // Check visibility
      if (mustBeVisible && !elementIsVisible(element)) {
        lastError = new ElementNotInteractiveError(selector, 'not_visible');
        await new Promise((resolve) => setTimeout(resolve, DEFAULT_POLLING_INTERVAL_MS));
        continue;
      }

      // Check enabled state
      if (mustBeEnabled && !elementIsEnabled(element)) {
        lastError = new ElementNotInteractiveError(selector, 'disabled');
        await new Promise((resolve) => setTimeout(resolve, DEFAULT_POLLING_INTERVAL_MS));
        continue;
      }

      // All checks passed
      return element;
    }

    lastError = new ElementNotFoundError(selector, timeoutMs);
    await new Promise((resolve) => setTimeout(resolve, DEFAULT_POLLING_INTERVAL_MS));
  }

  throw lastError ?? new ElementNotFoundError(selector, timeoutMs);
}

// ============================================================================
// STEP EXECUTION
// ============================================================================

/**
 * Execute a single plan step
 * Enhanced with smart waiting, advanced interactions, and validation
 */
async function executeStep(step: PlanStep): Promise<StepResult> {
  const startTime = performance.now();

  // Actions that don't require an element
  const noElementActions: PlanActionType[] = [
    'NAVIGATE',
    'WAIT',
    'WAIT_FOR_ELEMENT',
    'WAIT_FOR_VISIBLE',
    'WAIT_FOR_ENABLED',
    'WAIT_FOR_HIDDEN',
    'WAIT_FOR_TEXT',
    'ASSERT_VISIBLE',
    'ASSERT_ENABLED',
    'ASSERT_TEXT',
    'ASSERT_VALUE',
    'PRESS_KEY',
  ];

  try {
    // Smart element finding based on action type
    let element: HTMLElement | null = null;

    if (!noElementActions.includes(step.action)) {
      element = await findElementEnhanced(step.selector, {
        mustBeVisible: true,
        mustBeEnabled: ['CLICK', 'TYPE', 'SELECT', 'CLEAR', 'HOVER', 'DOUBLE_CLICK', 'RIGHT_CLICK'].includes(step.action),
      });
    }

    // Execute action based on type
    switch (step.action) {
      // === BASIC ACTIONS ===
      case 'CLICK':
        await executeClick(element!);
        break;

      case 'TYPE':
        if (element && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
          await executeType(element, step.value ?? '');
        } else {
          throw new Error(`TYPE action requires input/textarea element, got ${element?.tagName}`);
        }
        break;

      case 'SELECT':
        if (element instanceof HTMLSelectElement) {
          await executeSelect(element, step.value ?? '');
        } else {
          throw new Error(`SELECT action requires select element, got ${element?.tagName}`);
        }
        break;

      case 'CLEAR':
        if (element && (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) {
          await executeClear(element);
        } else {
          throw new Error(`CLEAR action requires input/textarea element, got ${element?.tagName}`);
        }
        break;

      case 'NAVIGATE':
        await executeNavigate(step.value ?? step.selector);
        break;

      case 'WAIT':
        await executeWait(parseInt(step.value ?? '1000', 10));
        break;

      case 'SCROLL':
        if (element) {
          await executeScroll(element);
        }
        break;

      // === SMART WAITING ACTIONS (NEW) ===
      case 'WAIT_FOR_ELEMENT':
        await waitForElement(step.selector, parseInt(step.value ?? '5000', 10));
        break;

      case 'WAIT_FOR_VISIBLE':
        await waitForVisible(step.selector, parseInt(step.value ?? '5000', 10));
        break;

      case 'WAIT_FOR_ENABLED':
        await waitForEnabled(step.selector, parseInt(step.value ?? '5000', 10));
        break;

      case 'WAIT_FOR_HIDDEN':
        await waitForHidden(step.selector, parseInt(step.value ?? '5000', 10));
        break;

      case 'WAIT_FOR_TEXT':
        if (!step.value) {
          throw new Error('WAIT_FOR_TEXT requires a value (expected text)');
        }
        await waitForText(step.selector, step.value, parseInt(step.value ?? '5000', 10));
        break;

      // === ADVANCED INTERACTIONS (NEW) ===
      case 'HOVER':
        if (element) {
          await executeHover(element);
        }
        break;

      case 'DOUBLE_CLICK':
        if (element) {
          await executeDoubleClick(element);
        }
        break;

      case 'RIGHT_CLICK':
        if (element) {
          await executeRightClick(element);
        }
        break;

      case 'PRESS_KEY':
        await executePressKey(step.value ?? 'Enter');
        break;

      case 'DRAG_DROP':
        if (element && step.value) {
          await executeDragDrop(element, step.value);
        } else {
          throw new Error('DRAG_DROP requires both source selector and target selector in value');
        }
        break;

      // === VALIDATION ACTIONS (NEW) ===
      case 'ASSERT_VISIBLE':
        await executeAssertVisible(step.selector);
        break;

      case 'ASSERT_ENABLED':
        await executeAssertEnabled(step.selector);
        break;

      case 'ASSERT_TEXT':
        if (!step.value) {
          throw new Error('ASSERT_TEXT requires a value (expected text)');
        }
        await executeAssertText(step.selector, step.value);
        break;

      case 'ASSERT_VALUE':
        if (!step.value) {
          throw new Error('ASSERT_VALUE requires a value (expected value)');
        }
        await executeAssertValue(step.selector, step.value);
        break;

      default:
        throw new Error(`Unknown action type: ${step.action}`);
    }

    // Wait for Pega to process
    await new Promise((resolve) => setTimeout(resolve, STEP_DELAY_MS));

    return {
      stepNumber: step.stepNumber,
      action: step.action,
      success: true,
      executionTimeMs: performance.now() - startTime,
    };
  } catch (error) {
    return {
      stepNumber: step.stepNumber,
      action: step.action,
      success: false,
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
      executionTimeMs: performance.now() - startTime,
    };
  }
}

// ============================================================================
// PLAN EXECUTION
// ============================================================================

/**
 * Execute a complete action plan
 *
 * 1. De-tokenize plan values (raw values only exist here in content script memory)
 * 2. Execute each step sequentially
 * 3. Fail fast on step failure
 * 4. Return execution result
 */
export async function executePlan(plan: ActionPlan): Promise<ExecutionResult> {
  const startTime = performance.now();
  const results: StepResult[] = [];

  // Step 1: De-tokenize all values in the plan
  // Raw values ONLY exist here in content script memory
  const detokenizedPlan: ActionPlan = {
    ...plan,
    steps: plan.steps.map((step) => ({
      ...step,
      value: step.value ? piiMasker.resolveString(step.value) : step.value,
    })),
  };

  // Step 2: Execute each step sequentially
  for (const step of detokenizedPlan.steps) {
    const result = await executeStep(step);
    results.push(result);

    // Fail fast on step failure
    if (!result.success) {
      return {
        status: 'failed',
        results,
        totalExecutionTimeMs: performance.now() - startTime,
      };
    }
  }

  // Step 3: All steps completed successfully
  return {
    status: 'complete',
    results,
    totalExecutionTimeMs: performance.now() - startTime,
  };
}

/**
 * Validate a plan before execution
 * Checks that all selectors exist in the current DOM
 * Enhanced to skip validation for smart waiting and assertion actions
 */
export function validatePlan(plan: ActionPlan): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Actions that don't require immediate element presence
  const skipValidationActions: PlanActionType[] = [
    'NAVIGATE',
    'WAIT',
    'WAIT_FOR_ELEMENT',
    'WAIT_FOR_VISIBLE',
    'WAIT_FOR_ENABLED',
    'WAIT_FOR_HIDDEN',
    'WAIT_FOR_TEXT',
    'ASSERT_VISIBLE',
    'ASSERT_ENABLED',
    'ASSERT_TEXT',
    'ASSERT_VALUE',
    'PRESS_KEY',
  ];

  for (const step of plan.steps) {
    // Skip validation for actions that handle element finding themselves
    if (skipValidationActions.includes(step.action)) {
      continue;
    }

    const element = document.querySelector(step.selector);
    if (!element) {
      errors.push(`Step ${step.stepNumber}: Selector not found: ${step.selector}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Quick check if a plan can be executed
 */
export function canExecute(plan: ActionPlan): boolean {
  return validatePlan(plan).valid;
}

// Export retry utilities
export { executeStepWithRetry, executeWithRetry, DEFAULT_RETRY_CONFIG };
export type { RetryConfig };
