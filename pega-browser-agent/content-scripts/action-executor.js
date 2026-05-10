/**
 * Action Executor - DOM-Level Action Execution
 *
 * Executes action plans on Pega DOM using native events.
 * Handles React/Angular rendered components correctly.
 */

import { MessageType, ActionType, createMessage } from '../shared/message-types.js';
import { piiMasker } from './pii-masker.js';

/**
 * Execution delay between steps (ms)
 */
const STEP_DELAY = 300;

/**
 * Wait timeout for elements (ms)
 */
const ELEMENT_WAIT_TIMEOUT = 5000;

/**
 * Action Executor class
 */
class ActionExecutor {
  constructor() {
    this.isExecuting = false;
    this.currentPlan = null;
    this.currentStep = 0;
  }

  /**
   * Execute an action plan
   * @param {Object} plan - Action plan from planner
   * @returns {Promise<Object>} - Execution result
   */
  async executePlan(plan) {
    if (this.isExecuting) {
      return {
        success: false,
        error: 'Another execution is in progress',
      };
    }

    this.isExecuting = true;
    this.currentPlan = plan;
    this.currentStep = 0;

    const results = [];

    try {
      for (const step of plan.steps) {
        this.currentStep = step.stepNumber;

        // Wait between steps
        if (this.currentStep > 1) {
          await this.delay(STEP_DELAY);
        }

        // Execute step
        const result = await this.executeStep(step);
        results.push(result);

        // Report result
        this.reportStepResult(step, result.success);

        // Fail fast on error
        if (!result.success) {
          return {
            success: false,
            partialSuccess: this.currentStep > 1,
            completedSteps: this.currentStep - 1,
            failedStep: this.currentStep,
            error: result.error,
            results,
          };
        }
      }

      // All steps completed successfully
      return {
        success: true,
        completedSteps: results.length,
        results,
      };
    } finally {
      this.isExecuting = false;
      this.currentPlan = null;
      this.currentStep = 0;
    }
  }

  /**
   * Execute a single step
   * @param {Object} step - Step to execute
   * @returns {Promise<Object>}
   */
  async executeStep(step) {
    const { action, selector, value, description } = step;

    try {
      switch (action) {
        case ActionType.CLICK:
          return await this.executeClick(selector, description);

        case ActionType.TYPE:
          return await this.executeType(selector, value, description);

        case ActionType.SELECT:
          return await this.executeSelect(selector, value, description);

        case ActionType.CLEAR:
          return await this.executeClear(selector, description);

        case ActionType.NAVIGATE:
          return await this.executeNavigate(value, description);

        case ActionType.WAIT:
          return await this.executeWait(value, description);

        case ActionType.SCROLL:
          return await this.executeScroll(selector, description);

        default:
          return {
            success: false,
            error: `Unknown action type: ${action}`,
          };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Execute click action
   * @param {string} selector
   * @param {string} description
   * @returns {Promise<Object>}
   */
  async executeClick(selector, description) {
    const element = await this.waitForElement(selector);

    if (!element) {
      return {
        success: false,
        error: `Element not found: ${selector}`,
      };
    }

    if (element.disabled) {
      return {
        success: false,
        error: `Element is disabled: ${selector}`,
      };
    }

    // Scroll into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    await this.delay(100);

    // Trigger click with full event chain
    element.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    element.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
    element.click();

    return {
      success: true,
      description,
      selector,
    };
  }

  /**
   * Execute type action
   * @param {string} selector
   * @param {string} value - May be masked token
   * @param {string} description
   * @returns {Promise<Object>}
   */
  async executeType(selector, value, description) {
    const element = await this.waitForElement(selector);

    if (!element) {
      return {
        success: false,
        error: `Element not found: ${selector}`,
      };
    }

    if (element.disabled || element.readOnly) {
      return {
        success: false,
        error: `Element is not editable: ${selector}`,
      };
    }

    // Unmask value if it's a token
    const actualValue = piiMasker.unmask(value);

    // Scroll into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    await this.delay(100);

    // Focus element
    element.focus();

    // Clear existing value
    element.value = '';

    // Use native input value setter for React/Angular compatibility
    const nativeInputSetter = Object.getOwnPropertyDescriptor(
      window.HTMLInputElement.prototype,
      'value'
    )?.set;

    const nativeTextAreaSetter = Object.getOwnPropertyDescriptor(
      window.HTMLTextAreaElement.prototype,
      'value'
    )?.set;

    if (element.tagName === 'TEXTAREA' && nativeTextAreaSetter) {
      nativeTextAreaSetter.call(element, actualValue);
    } else if (nativeInputSetter) {
      nativeInputSetter.call(element, actualValue);
    } else {
      element.value = actualValue;
    }

    // Dispatch events to trigger React/Angular state updates
    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));

    // Blur to trigger validation
    element.blur();

    return {
      success: true,
      description,
      selector,
      // Don't log actual value - use masked version
      value: value.startsWith('{') ? value : '[REDACTED]',
    };
  }

  /**
   * Execute select action (dropdown)
   * @param {string} selector
   * @param {string} value
   * @param {string} description
   * @returns {Promise<Object>}
   */
  async executeSelect(selector, value, description) {
    const element = await this.waitForElement(selector);

    if (!element) {
      return {
        success: false,
        error: `Element not found: ${selector}`,
      };
    }

    if (element.tagName !== 'SELECT') {
      return {
        success: false,
        error: `Element is not a select: ${selector}`,
      };
    }

    // Find option by text or value
    const options = Array.from(element.options);
    const option = options.find(
      (opt) => opt.text === value || opt.value === value
    );

    if (!option) {
      return {
        success: false,
        error: `Option not found: ${value}`,
      };
    }

    // Scroll into view
    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    await this.delay(100);

    // Set value
    element.value = option.value;

    // Dispatch events
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('input', { bubbles: true }));

    return {
      success: true,
      description,
      selector,
      selectedValue: option.value,
    };
  }

  /**
   * Execute clear action
   * @param {string} selector
   * @param {string} description
   * @returns {Promise<Object>}
   */
  async executeClear(selector, description) {
    const element = await this.waitForElement(selector);

    if (!element) {
      return {
        success: false,
        error: `Element not found: ${selector}`,
      };
    }

    element.focus();
    element.value = '';

    element.dispatchEvent(new Event('input', { bubbles: true }));
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.blur();

    return {
      success: true,
      description,
      selector,
    };
  }

  /**
   * Execute navigate action
   * @param {string} url
   * @param {string} description
   * @returns {Promise<Object>}
   */
  async executeNavigate(url, description) {
    if (!url) {
      return {
        success: false,
        error: 'No URL provided for navigation',
      };
    }

    // Use Pega's navigation if available
    if (window.pega && window.pega.ui && window.pega.ui.Doc) {
      try {
        window.pega.ui.Doc.openUrl(url);
        return {
          success: true,
          description,
          url,
        };
      } catch (e) {
        // Fall through to regular navigation
      }
    }

    // Standard navigation
    window.location.href = url;

    return {
      success: true,
      description,
      url,
    };
  }

  /**
   * Execute wait action
   * @param {string|number} value - Wait time in ms or element selector
   * @param {string} description
   * @returns {Promise<Object>}
   */
  async executeWait(value, description) {
    // If value is a number, wait that many ms
    if (!isNaN(value)) {
      const ms = parseInt(value, 10);
      await this.delay(ms);
      return {
        success: true,
        description,
        waitedMs: ms,
      };
    }

    // Otherwise, wait for element
    const element = await this.waitForElement(value, ELEMENT_WAIT_TIMEOUT);

    if (!element) {
      return {
        success: false,
        error: `Element not found within timeout: ${value}`,
      };
    }

    return {
      success: true,
      description,
      selector: value,
    };
  }

  /**
   * Execute scroll action
   * @param {string} selector
   * @param {string} description
   * @returns {Promise<Object>}
   */
  async executeScroll(selector, description) {
    const element = selector
      ? await this.waitForElement(selector)
      : document.body;

    if (!element) {
      return {
        success: false,
        error: `Element not found: ${selector}`,
      };
    }

    element.scrollIntoView({ behavior: 'smooth', block: 'center' });

    return {
      success: true,
      description,
      selector,
    };
  }

  /**
   * Wait for element to appear
   * @param {string} selector
   * @param {number} timeout
   * @returns {Promise<HTMLElement|null>}
   */
  async waitForElement(selector, timeout = ELEMENT_WAIT_TIMEOUT) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const element = document.querySelector(selector);

      if (element) {
        return element;
      }

      await this.delay(100);
    }

    return null;
  }

  /**
   * Report step result to service worker
   * @param {Object} step
   * @param {boolean} success
   */
  reportStepResult(step, success) {
    const message = createMessage(MessageType.ACTION_RESULT, {
      stepNumber: step.stepNumber,
      action: step.action,
      description: step.description,
      success,
      timestamp: Date.now(),
    });

    chrome.runtime.sendMessage(message);
  }

  /**
   * Delay helper
   * @param {number} ms
   * @returns {Promise}
   */
  delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Cancel current execution
   */
  cancel() {
    if (this.isExecuting) {
      this.isExecuting = false;
      // Execution will stop at next step check
    }
  }

  /**
   * Get current execution state
   * @returns {Object}
   */
  getState() {
    return {
      isExecuting: this.isExecuting,
      currentPlan: this.currentPlan?.id,
      currentStep: this.currentStep,
    };
  }
}

// Export singleton instance
export const actionExecutor = new ActionExecutor();

// Also export class for testing
export { ActionExecutor };

// Listen for execution messages from service worker
if (typeof chrome !== 'undefined' && chrome.runtime) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === MessageType.EXECUTE_ACTION) {
      const { plan } = message.payload;

      actionExecutor
        .executePlan(plan)
        .then((result) => {
          sendResponse({ success: true, result });
        })
        .catch((error) => {
          sendResponse({ success: false, error: error.message });
        });

      return true; // Keep channel open for async response
    }
  });
}

export default actionExecutor;
