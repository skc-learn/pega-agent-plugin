/**
 * Planner Engine - Intent to Action Plan Generation
 *
 * Generates action plans from user commands using:
 * 1. Local intent classification (fast, no LLM)
 * 2. LLM-powered plan generation when needed
 */

import { IntentType, ActionType } from '../shared/message-types.js';
import { intentClassifier } from '../shared/intent-classifier.js';
import { requiresConfirmation } from '../shared/pega-heuristics.js';
import { llmAdapter } from './llm-adapter.js';
import { sessionStore } from './session-store.js';

/**
 * Planner Engine class
 */
class PlannerEngine {
  constructor() {
    this.isInitialized = false;
  }

  /**
   * Initialize planner
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    // Initialize LLM adapter
    const config = await sessionStore.getConfig();
    const llmConfig = config.llm || {};

    // Note: API key should be set via llmAdapter.setApiKey() or chrome.storage
    await llmAdapter.initialize({ config: llmConfig });

    this.isInitialized = true;
  }

  /**
   * Process a user command and generate a plan
   * @param {string} command - User's natural language command
   * @param {Object} context - Current DOM context
   * @returns {Promise<Object>} - Action plan
   */
  async processCommand(command, context) {
    // Step 1: Classify intent locally
    const classification = intentClassifier.classify(command);

    // Step 2: Check if we can handle locally
    if (!classification.requiresLLM && classification.confidence >= 0.9) {
      return this.handleLocalIntent(classification.intent, context, classification.entities);
    }

    // Step 3: Use LLM for complex intents or low confidence
    if (llmAdapter.isReady()) {
      return this.handleWithLLM(command, context, classification);
    }

    // Fallback: Return classification without plan
    return {
      intent: classification.intent,
      confidence: classification.confidence,
      requiresLLM: true,
      llmNotConfigured: true,
      message: 'LLM not configured. Please set up API credentials.',
    };
  }

  /**
   * Handle intent locally without LLM
   * @param {string} intent - Classified intent
   * @param {Object} context - DOM context
   * @param {Object} entities - Extracted entities
   * @returns {Object} - Action plan
   */
  handleLocalIntent(intent, context, entities) {
    switch (intent) {
      case IntentType.SUMMARIZE_CASE:
        return this.planSummarizeCase(context);

      case IntentType.SUBMIT_CASE:
        return this.planSubmitCase(context);

      case IntentType.SAVE_CASE:
        return this.planSaveCase(context);

      case IntentType.NEXT_STEP:
        return this.planNextStep(context);

      case IntentType.SHOW_QUEUE:
        return this.planShowQueue(context);

      default:
        return {
          intent,
          confidence: 0.5,
          requiresLLM: true,
          message: 'This action requires additional reasoning.',
        };
    }
  }

  /**
   * Plan: Summarize Case
   * @param {Object} context
   * @returns {Object}
   */
  planSummarizeCase(context) {
    return {
      id: `plan-${Date.now()}`,
      intent: IntentType.SUMMARIZE_CASE,
      summary: 'Generate case summary',
      requiresConfirmation: false,
      steps: [],
      expectedOutcome: 'Display case summary in side panel',
      caseId: context.caseContext?.caseId,
      createdAt: Date.now(),
      confirmed: true, // Auto-confirm summaries
    };
  }

  /**
   * Plan: Submit Case
   * @param {Object} context
   * @returns {Object}
   */
  planSubmitCase(context) {
    const submitButton = this.findActionButton(context, 'submit');

    if (!submitButton) {
      return {
        intent: IntentType.SUBMIT_CASE,
        error: 'Submit button not found',
        message: 'Cannot find a submit button on this page.',
      };
    }

    return {
      id: `plan-${Date.now()}`,
      intent: IntentType.SUBMIT_CASE,
      summary: 'Submit the case',
      requiresConfirmation: true, // Always confirm submit
      steps: [
        {
          stepNumber: 1,
          action: ActionType.CLICK,
          selector: submitButton.selector,
          value: null,
          description: `Click "${submitButton.label}" button`,
        },
      ],
      expectedOutcome: 'Case will be submitted and moved to next stage',
      caseId: context.caseContext?.caseId,
      createdAt: Date.now(),
      confirmed: false,
    };
  }

  /**
   * Plan: Save Case
   * @param {Object} context
   * @returns {Object}
   */
  planSaveCase(context) {
    const saveButton = this.findActionButton(context, 'save');

    if (!saveButton) {
      return {
        intent: IntentType.SAVE_CASE,
        error: 'Save button not found',
        message: 'Cannot find a save button on this page.',
      };
    }

    return {
      id: `plan-${Date.now()}`,
      intent: IntentType.SAVE_CASE,
      summary: 'Save case changes',
      requiresConfirmation: false,
      steps: [
        {
          stepNumber: 1,
          action: ActionType.CLICK,
          selector: saveButton.selector,
          value: null,
          description: `Click "${saveButton.label}" button`,
        },
      ],
      expectedOutcome: 'Case changes will be saved',
      caseId: context.caseContext?.caseId,
      createdAt: Date.now(),
      confirmed: true, // Auto-confirm saves
    };
  }

  /**
   * Plan: Next Step
   * @param {Object} context
   * @returns {Object}
   */
  planNextStep(context) {
    const nextButton = this.findActionButton(context, 'next');

    if (!nextButton) {
      return {
        intent: IntentType.NEXT_STEP,
        error: 'Next button not found',
        message: 'Cannot find a next/continue button on this page.',
      };
    }

    return {
      id: `plan-${Date.now()}`,
      intent: IntentType.NEXT_STEP,
      summary: 'Proceed to next step',
      requiresConfirmation: false,
      steps: [
        {
          stepNumber: 1,
          action: ActionType.CLICK,
          selector: nextButton.selector,
          value: null,
          description: `Click "${nextButton.label}" button`,
        },
      ],
      expectedOutcome: 'Will proceed to the next step or stage',
      caseId: context.caseContext?.caseId,
      createdAt: Date.now(),
      confirmed: true,
    };
  }

  /**
   * Plan: Show Queue
   * @param {Object} context
   * @returns {Object}
   */
  planShowQueue(context) {
    // Look for queue link in navigation
    const queueLink = document.querySelector('a[href*="queue"], a[href*="worklist"]');

    if (queueLink) {
      return {
        id: `plan-${Date.now()}`,
        intent: IntentType.SHOW_QUEUE,
        summary: 'Navigate to work queue',
        requiresConfirmation: false,
        steps: [
          {
            stepNumber: 1,
            action: ActionType.NAVIGATE,
            selector: null,
            value: queueLink.href || '/portal/worklist',
            description: 'Navigate to work queue',
          },
        ],
        expectedOutcome: 'Work queue will be displayed',
        caseId: null,
        createdAt: Date.now(),
        confirmed: true,
      };
    }

    return {
      intent: IntentType.SHOW_QUEUE,
      error: 'Queue navigation not found',
      message: 'Cannot find work queue navigation.',
    };
  }

  /**
   * Handle with LLM
   * @param {string} command
   * @param {Object} context
   * @param {Object} classification
   * @returns {Promise<Object>}
   */
  async handleWithLLM(command, context, classification) {
    try {
      const result = await llmAdapter.generatePlan(context, command);

      return {
        ...result.plan,
        confidence: classification.confidence,
        llmGenerated: true,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
      };
    } catch (error) {
      console.error('PlannerEngine: LLM error', error);
      return {
        intent: classification.intent,
        error: error.message,
        message: 'Failed to generate plan. Please try again.',
      };
    }
  }

  /**
   * Find action button by type
   * @param {Object} context
   * @param {string} actionType
   * @returns {Object|null}
   */
  findActionButton(context, actionType) {
    const actions = context.actions || [];
    return actions.find((a) => a.actionType === actionType && !a.disabled);
  }

  /**
   * Find field by label or testId
   * @param {Object} context
   * @param {string} fieldIdentifier
   * @returns {Object|null}
   */
  findField(context, fieldIdentifier) {
    const fields = context.fields || [];
    const lower = fieldIdentifier.toLowerCase();

    return fields.find((f) => {
      const label = (f.label || '').toLowerCase();
      const testId = (f.testId || '').toLowerCase();
      return label.includes(lower) || testId.includes(lower);
    });
  }

  /**
   * Validate a plan before execution
   * @param {Object} plan
   * @param {Object} context
   * @returns {Object} - Validation result
   */
  validatePlan(plan, context) {
    const errors = [];

    if (!plan.steps || plan.steps.length === 0) {
      // Some plans (like SUMMARIZE_CASE) have no steps
      if (plan.intent !== IntentType.SUMMARIZE_CASE) {
        errors.push('Plan has no steps to execute');
      }
    }

    // Validate each step
    for (const step of plan.steps || []) {
      if (!step.selector && step.action !== ActionType.NAVIGATE) {
        errors.push(`Step ${step.stepNumber}: Missing selector`);
      }

      // Check if selector exists in DOM (for TYPE actions)
      if (step.action === ActionType.TYPE && step.selector) {
        const field = this.findFieldBySelector(context, step.selector);
        if (!field) {
          errors.push(`Step ${step.stepNumber}: Selector "${step.selector}" not found`);
        } else if (!field.isEditable) {
          errors.push(`Step ${step.stepNumber}: Field "${field.label}" is not editable`);
        }
      }
    }

    // Check confirmation requirement
    if (requiresConfirmation(plan.intent)) {
      plan.requiresConfirmation = true;
    }

    return {
      valid: errors.length === 0,
      errors,
      plan,
    };
  }

  /**
   * Find field by selector
   * @param {Object} context
   * @param {string} selector
   * @returns {Object|null}
   */
  findFieldBySelector(context, selector) {
    const fields = context.fields || [];
    return fields.find((f) => f.selector === selector);
  }

  /**
   * Check if user has permission for intent
   * @param {string} intent
   * @param {string} userRole
   * @returns {Promise<boolean>}
   */
  async checkPermission(intent, userRole) {
    const config = await sessionStore.getConfig();
    const restrictions = config.roleRestrictions || {};
    const allowedIntents = restrictions[userRole] || [];

    return allowedIntents.includes('*') || allowedIntents.includes(intent);
  }
}

// Export singleton instance
export const plannerEngine = new PlannerEngine();

// Also export class for testing
export { PlannerEngine };

export default plannerEngine;
