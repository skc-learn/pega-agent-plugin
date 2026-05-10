/**
 * Tests for Action Executor - Browser Automation Capabilities
 *
 * Tests the exported functions: executePlan, validatePlan, canExecute
 * and the exported error classes.
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import {
  ElementNotFoundError,
  ElementNotInteractiveError,
  AutomationTimeoutError,
  ValidationError,
} from '../../src/shared/types';

describe('Action Executor - Error Types', () => {
  describe('ElementNotFoundError', () => {
    it('should have correct message and properties', () => {
      const error = new ElementNotFoundError('[data-test-id="test"]', 5000);
      expect(error.message).toContain('Element not found');
      expect(error.message).toContain('5000ms');
      expect(error.code).toBe('ELEMENT_NOT_FOUND');
      expect(error.timeoutMs).toBe(5000);
      expect(error.name).toBe('ElementNotFoundError');
    });

    it('should work with different selectors and timeouts', () => {
      const error = new ElementNotFoundError('button.submit', 3000);
      expect(error.message).toContain('button.submit');
      expect(error.timeoutMs).toBe(3000);
    });
  });

  describe('ElementNotInteractiveError', () => {
    it('should have correct properties for disabled reason', () => {
      const error = new ElementNotInteractiveError('[data-test-id="test"]', 'disabled');
      expect(error.message).toContain('Element not interactive');
      expect(error.message).toContain('disabled');
      expect(error.code).toBe('ELEMENT_NOT_INTERACTIVE');
      expect(error.reason).toBe('disabled');
      expect(error.name).toBe('ElementNotInteractiveError');
    });

    it('should work with different reasons', () => {
      const reasons: Array<'not_visible' | 'disabled' | 'obscured' | 'not_editable'> =
        ['not_visible', 'disabled', 'obscured', 'not_editable'];

      reasons.forEach(reason => {
        const error = new ElementNotInteractiveError('.test-selector', reason);
        expect(error.reason).toBe(reason);
        expect(error.message).toContain(reason);
      });
    });
  });

  describe('AutomationTimeoutError', () => {
    it('should have correct properties', () => {
      const error = new AutomationTimeoutError('wait for element', 5000);
      expect(error.message).toContain('timed out');
      expect(error.message).toContain('wait for element');
      expect(error.message).toContain('5000ms');
      expect(error.code).toBe('AUTOMATION_TIMEOUT');
      expect(error.timeoutMs).toBe(5000);
      expect(error.name).toBe('AutomationTimeoutError');
    });

    it('should work with different operations', () => {
      const operations = ['wait for visible', 'wait for enabled', 'scroll to element'];
      operations.forEach(op => {
        const error = new AutomationTimeoutError(op, 10000);
        expect(error.message).toContain(op);
        expect(error.timeoutMs).toBe(10000);
      });
    });
  });

  describe('ValidationError', () => {
    it('should have correct properties', () => {
      const error = new ValidationError('text check', 'expected value', 'actual value');
      expect(error.message).toContain('Assertion failed');
      expect(error.message).toContain('text check');
      expect(error.message).toContain('expected value');
      expect(error.message).toContain('actual value');
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.assertion).toBe('text check');
      expect(error.expected).toBe('expected value');
      expect(error.actual).toBe('actual value');
      expect(error.name).toBe('ValidationError');
    });

    it('should work with different assertion types', () => {
      const assertions = [
        { assertion: 'visible check', expected: 'visible', actual: 'hidden' },
        { assertion: 'enabled check', expected: 'enabled', actual: 'disabled' },
        { assertion: 'value check', expected: 'Complete', actual: 'In Progress' },
      ];

      assertions.forEach(({ assertion, expected, actual }) => {
        const error = new ValidationError(assertion, expected, actual);
        expect(error.assertion).toBe(assertion);
        expect(error.expected).toBe(expected);
        expect(error.actual).toBe(actual);
      });
    });
  });
});

describe('Action Executor - Plan Validation', () => {
  // Import validatePlan dynamically to test exported function
  let validatePlan: (plan: any) => { valid: boolean; errors: string[] };

  beforeEach(() => {
    // We need to mock DOM for these tests
    document.body.innerHTML = `
      <div>
        <button data-test-id="existing-button">Click Me</button>
        <input data-test-id="existing-input" type="text" />
      </div>
    `;
  });

  it('should validate plan with existing elements', async () => {
    const { validatePlan: vp } = await import('../../src/content-scripts/action-executor');
    const plan = {
      planId: 'test-plan',
      intent: 'UNKNOWN',
      summary: 'Test plan',
      requiresConfirmation: false,
      steps: [
        { stepNumber: 1, action: 'CLICK', selector: '[data-test-id="existing-button"]', description: 'Click button', isReversible: true },
      ],
      expectedOutcome: 'Test outcome',
      createdAt: Date.now(),
    };

    const result = vp(plan);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should report errors for missing elements', async () => {
    const { validatePlan: vp } = await import('../../src/content-scripts/action-executor');
    const plan = {
      planId: 'test-plan',
      intent: 'UNKNOWN',
      summary: 'Test plan',
      requiresConfirmation: false,
      steps: [
        { stepNumber: 1, action: 'CLICK', selector: '[data-test-id="non-existent"]', description: 'Click button', isReversible: true },
      ],
      expectedOutcome: 'Test outcome',
      createdAt: Date.now(),
    };

    const result = vp(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.errors[0]).toContain('Selector not found');
  });

  it('should skip validation for smart waiting actions', async () => {
    const { validatePlan: vp } = await import('../../src/content-scripts/action-executor');
    const plan = {
      planId: 'test-plan',
      intent: 'UNKNOWN',
      summary: 'Test plan',
      requiresConfirmation: false,
      steps: [
        { stepNumber: 1, action: 'WAIT_FOR_ELEMENT', selector: '[data-test-id="non-existent"]', description: 'Wait for element', isReversible: true },
        { stepNumber: 2, action: 'WAIT_FOR_VISIBLE', selector: '[data-test-id="non-existent"]', description: 'Wait for visible', isReversible: true },
        { stepNumber: 3, action: 'WAIT_FOR_ENABLED', selector: '[data-test-id="non-existent"]', description: 'Wait for enabled', isReversible: true },
        { stepNumber: 4, action: 'ASSERT_VISIBLE', selector: '[data-test-id="non-existent"]', description: 'Assert visible', isReversible: true },
      ],
      expectedOutcome: 'Test outcome',
      createdAt: Date.now(),
    };

    const result = vp(plan);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should skip validation for NAVIGATE and WAIT actions', async () => {
    const { validatePlan: vp } = await import('../../src/content-scripts/action-executor');
    const plan = {
      planId: 'test-plan',
      intent: 'UNKNOWN',
      summary: 'Test plan',
      requiresConfirmation: false,
      steps: [
        { stepNumber: 1, action: 'NAVIGATE', selector: 'https://example.com', description: 'Navigate', isReversible: true },
        { stepNumber: 2, action: 'WAIT', selector: '', value: '1000', description: 'Wait', isReversible: true },
      ],
      expectedOutcome: 'Test outcome',
      createdAt: Date.now(),
    };

    const result = vp(plan);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('should validate all new action types that require elements', async () => {
    const { validatePlan: vp } = await import('../../src/content-scripts/action-executor');

    // These actions require elements to exist at validation time
    const plan = {
      planId: 'test-plan',
      intent: 'UNKNOWN',
      summary: 'Test plan',
      requiresConfirmation: false,
      steps: [
        { stepNumber: 1, action: 'HOVER', selector: '[data-test-id="non-existent"]', description: 'Hover', isReversible: true },
        { stepNumber: 2, action: 'DOUBLE_CLICK', selector: '[data-test-id="non-existent"]', description: 'Double click', isReversible: true },
        { stepNumber: 3, action: 'RIGHT_CLICK', selector: '[data-test-id="non-existent"]', description: 'Right click', isReversible: true },
      ],
      expectedOutcome: 'Test outcome',
      createdAt: Date.now(),
    };

    const result = vp(plan);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBe(3);
  });
});

describe('Action Executor - canExecute', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div>
        <button data-test-id="existing-button">Click Me</button>
      </div>
    `;
  });

  it('should return true for valid plan', async () => {
    const { canExecute } = await import('../../src/content-scripts/action-executor');
    const plan = {
      planId: 'test-plan',
      intent: 'UNKNOWN',
      summary: 'Test plan',
      requiresConfirmation: false,
      steps: [
        { stepNumber: 1, action: 'CLICK', selector: '[data-test-id="existing-button"]', description: 'Click button', isReversible: true },
      ],
      expectedOutcome: 'Test outcome',
      createdAt: Date.now(),
    };

    expect(canExecute(plan)).toBe(true);
  });

  it('should return false for invalid plan', async () => {
    const { canExecute } = await import('../../src/content-scripts/action-executor');
    const plan = {
      planId: 'test-plan',
      intent: 'UNKNOWN',
      summary: 'Test plan',
      requiresConfirmation: false,
      steps: [
        { stepNumber: 1, action: 'CLICK', selector: '[data-test-id="non-existent"]', description: 'Click button', isReversible: true },
      ],
      expectedOutcome: 'Test outcome',
      createdAt: Date.now(),
    };

    expect(canExecute(plan)).toBe(false);
  });
});
