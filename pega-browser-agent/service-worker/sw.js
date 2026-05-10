/**
 * Service Worker - Central Message Router & Orchestrator
 *
 * Handles all inter-component communication and orchestrates:
 * - DOM snapshots from content scripts
 * - Commands from side panel
 * - Plan generation and execution
 * - Summary generation
 */

import { MessageType, IntentType, OutcomeType } from '../shared/message-types.js';
import { auditLogger } from '../shared/audit-logger.js';
import { sessionStore } from './session-store.js';
import { llmAdapter } from './llm-adapter.js';
import { plannerEngine } from './planner.js';

/**
 * Service Worker class
 */
class ServiceWorker {
  constructor() {
    this.isInitialized = false;
    this.messageHandlers = new Map();
    this.setupMessageHandlers();
  }

  /**
   * Initialize service worker
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    // Initialize session store
    await sessionStore.initialize();

    // Initialize audit logger
    auditLogger.initialize({
      sessionId: sessionStore.sessionId,
    });

    // Initialize planner
    await plannerEngine.initialize();

    this.isInitialized = true;
    console.log('Pega Agent: Service worker initialized');
  }

  /**
   * Setup message handlers
   */
  setupMessageHandlers() {
    // Content script messages
    this.messageHandlers.set(MessageType.PEGA_DETECTED, this.handlePegaDetected.bind(this));
    this.messageHandlers.set(MessageType.DOM_SNAPSHOT, this.handleDomSnapshot.bind(this));
    this.messageHandlers.set(MessageType.USER_NAVIGATION, this.handleUserNavigation.bind(this));
    this.messageHandlers.set(MessageType.ACTION_RESULT, this.handleActionResult.bind(this));

    // Side panel messages
    this.messageHandlers.set(MessageType.USER_COMMAND, this.handleUserCommand.bind(this));
    this.messageHandlers.set(MessageType.USER_CONFIRM, this.handleUserConfirm.bind(this));
    this.messageHandlers.set(MessageType.USER_CANCEL, this.handleUserCancel.bind(this));
    this.messageHandlers.set(MessageType.FEEDBACK, this.handleFeedback.bind(this));
    this.messageHandlers.set(MessageType.PANEL_READY, this.handlePanelReady.bind(this));
  }

  /**
   * Handle incoming message
   * @param {Object} message
   * @param {Object} sender
   * @param {Function} sendResponse
   */
  async handleMessage(message, sender, sendResponse) {
    // Ensure initialized
    await this.initialize();

    const { type, payload, metadata } = message;

    console.log('Pega Agent: Received message', type, metadata);

    const handler = this.messageHandlers.get(type);

    if (handler) {
      try {
        const result = await handler(payload, sender, metadata);
        sendResponse({ success: true, result });
      } catch (error) {
        console.error('Pega Agent: Handler error', error);
        sendResponse({ success: false, error: error.message });
      }
    } else {
      console.warn('Pega Agent: Unknown message type', type);
      sendResponse({ success: false, error: 'Unknown message type' });
    }

    // Return true to indicate async response
    return true;
  }

  /**
   * Handle Pega detection
   * @param {Object} payload
   * @param {Object} sender
   */
  async handlePegaDetected(payload, sender) {
    const tabId = sender.tab?.id;

    // Store Pega state
    await sessionStore.setPegaState({
      isDetected: payload.isDetected,
      confidence: payload.confidence,
      framework: payload.framework,
      version: payload.version,
      applicationName: payload.applicationName,
      url: payload.url,
      tabId,
    });

    // Log detection
    auditLogger.log('PEGA_DETECTED', {
      planSummary: `Pega ${payload.framework} detected on ${payload.url}`,
      outcome: OutcomeType.SUCCESS,
      metadata: {
        confidence: payload.confidence,
        version: payload.version,
      },
    });

    // Open side panel for the tab
    if (tabId && payload.isDetected) {
      try {
        await chrome.sidePanel.open({ tabId });
      } catch (error) {
        console.warn('Pega Agent: Could not open side panel', error);
      }
    }

    return { detected: payload.isDetected };
  }

  /**
   * Handle DOM snapshot
   * @param {Object} payload
   * @param {Object} sender
   */
  async handleDomSnapshot(payload, sender) {
    // Store snapshot
    await sessionStore.setDomSnapshot(payload);

    // Update case context
    if (payload.caseContext) {
      await sessionStore.setCaseContext(payload.caseContext);
    }

    // Check if we should generate summary
    if (payload.triggerSummary && payload.caseContext?.caseId) {
      // Generate summary asynchronously
      this.generateAndSendSummary(payload);
    }

    return { received: true };
  }

  /**
   * Generate summary and send to panel
   * @param {Object} context
   */
  async generateAndSendSummary(context) {
    try {
      // Check if LLM is configured
      if (!llmAdapter.isReady()) {
        // Send placeholder summary
        await this.sendToPanel(MessageType.SHOW_SUMMARY, {
          placeholder: true,
          message: 'Configure API key to enable AI summaries',
          caseId: context.caseContext?.caseId,
        });
        return;
      }

      // Generate summary
      const result = await llmAdapter.generateSummary(context);

      // Store summary
      await sessionStore.setSummary(result.summary);

      // Log summary generation
      auditLogger.logSummaryGeneration(context.caseContext?.caseId, true);

      // Send to panel
      await this.sendToPanel(MessageType.SHOW_SUMMARY, {
        ...result.summary,
        caseId: context.caseContext?.caseId,
        tokensUsed: result.tokensUsed,
        latencyMs: result.latencyMs,
      });
    } catch (error) {
      console.error('Pega Agent: Summary generation error', error);

      auditLogger.logSummaryGeneration(context.caseContext?.caseId, false);

      await this.sendToPanel(MessageType.SHOW_ERROR, {
        message: 'Failed to generate case summary',
        details: error.message,
      });
    }
  }

  /**
   * Handle user navigation
   * @param {Object} payload
   * @param {Object} sender
   */
  async handleUserNavigation(payload, sender) {
    // Update session with navigation info
    await sessionStore.updateSession({
      lastNavigation: {
        type: payload.type,
        url: payload.url || sender.tab?.url,
        timestamp: Date.now(),
      },
    });

    return { received: true };
  }

  /**
   * Handle action result from content script
   * @param {Object} payload
   * @param {Object} sender
   */
  async handleActionResult(payload, sender) {
    // Log action result
    auditLogger.logActionStep(
      payload.stepNumber,
      payload.action,
      payload.success
    );

    // Update activity log in panel
    await this.sendToPanel(MessageType.UPDATE_ACTIVITY, {
      type: payload.success ? 'success' : 'error',
      message: payload.description,
      timestamp: Date.now(),
    });

    return { received: true };
  }

  /**
   * Handle user command from panel
   * @param {Object} payload
   * @param {Object} sender
   */
  async handleUserCommand(payload, sender) {
    const { command } = payload;

    // Get current context
    const context = await sessionStore.getDomSnapshot();

    if (!context) {
      return { error: 'No context available. Please navigate to a Pega page.' };
    }

    // Log intent classification
    auditLogger.logIntentClassification(command, 'pending', 0);

    // Process command through planner
    const plan = await plannerEngine.processCommand(command, context);

    // Check permission
    const userRole = await sessionStore.getUserRole();
    const hasPermission = await plannerEngine.checkPermission(plan.intent, userRole);

    if (!hasPermission) {
      return {
        error: 'Permission denied',
        message: `You don't have permission to perform: ${plan.intent}`,
      };
    }

    // Validate plan
    const validation = plannerEngine.validatePlan(plan, context);

    if (!validation.valid) {
      return {
        error: 'Invalid plan',
        message: validation.errors.join('; '),
      };
    }

    // Store pending plan
    await sessionStore.setPendingPlan(plan);

    // Log intent classification result
    auditLogger.logIntentClassification(command, plan.intent, plan.confidence || 1);

    // If requires confirmation, send to panel for approval
    if (plan.requiresConfirmation) {
      await this.sendToPanel(MessageType.SHOW_PLAN, plan);
      return { requiresConfirmation: true, plan };
    }

    // Auto-execute if no confirmation needed
    await this.executePlan(plan);

    return { executing: true, plan };
  }

  /**
   * Handle user confirm
   * @param {Object} payload
   * @param {Object} sender
   */
  async handleUserConfirm(payload, sender) {
    const plan = await sessionStore.getPendingPlan();

    if (!plan) {
      return { error: 'No pending plan to confirm' };
    }

    // Mark as confirmed
    plan.confirmed = true;

    // Execute plan
    await this.executePlan(plan);

    // Clear pending plan
    await sessionStore.clearPendingPlan();

    return { executing: true };
  }

  /**
   * Handle user cancel
   * @param {Object} payload
   * @param {Object} sender
   */
  async handleUserCancel(payload, sender) {
    const plan = await sessionStore.getPendingPlan();

    if (plan) {
      // Log cancellation
      auditLogger.logPlanCancellation(plan);
    }

    // Clear pending plan
    await sessionStore.clearPendingPlan();

    // Notify panel
    await this.sendToPanel(MessageType.CLEAR_PENDING, {});

    return { cancelled: true };
  }

  /**
   * Handle feedback
   * @param {Object} payload
   * @param {Object} sender
   */
  async handleFeedback(payload, sender) {
    const { type, context } = payload;

    // Log feedback
    auditLogger.logFeedback(type, context);

    return { received: true };
  }

  /**
   * Handle panel ready
   * @param {Object} payload
   * @param {Object} sender
   */
  async handlePanelReady(payload, sender) {
    // Send current state to panel
    const pegaState = await sessionStore.getPegaState();
    const caseContext = await sessionStore.getCaseContext();
    const summary = await sessionStore.getSummary();
    const pendingPlan = await sessionStore.getPendingPlan();

    return {
      pegaState,
      caseContext,
      summary,
      pendingPlan,
    };
  }

  /**
   * Execute a plan
   * @param {Object} plan
   */
  async executePlan(plan) {
    if (!plan.steps || plan.steps.length === 0) {
      // No steps to execute (e.g., SUMMARIZE_CASE)
      return;
    }

    // Get active tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab) {
      throw new Error('No active tab');
    }

    // Send execution command to content script
    await chrome.tabs.sendMessage(tab.id, {
      type: MessageType.EXECUTE_ACTION,
      payload: {
        plan,
      },
    });

    // Log plan execution start
    auditLogger.logPlanExecution(plan, OutcomeType.SUCCESS, null);
  }

  /**
   * Send message to side panel
   * @param {string} type
   * @param {Object} payload
   */
  async sendToPanel(type, payload) {
    try {
      // Get active tab
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

      if (tab) {
        await chrome.tabs.sendMessage(tab.id, {
          type,
          payload,
        });
      }
    } catch (error) {
      console.warn('Pega Agent: Could not send to panel', error);
    }
  }
}

// Create service worker instance
const serviceWorker = new ServiceWorker();

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  serviceWorker.handleMessage(message, sender, sendResponse);
  return true; // Keep channel open for async response
});

// Handle extension install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Pega Agent: Extension installed', details.reason);
  await serviceWorker.initialize();
});

// Handle service worker startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('Pega Agent: Service worker starting');
  await serviceWorker.initialize();
});

// Handle tab updates (for Pega detection)
chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.url) {
    // Check if this is a Pega URL
    if (tab.url.includes('pegacloud.io') || tab.url.includes('pega.com')) {
      console.log('Pega Agent: Pega URL detected in tab', tabId);
    }
  }
});

// Handle side panel behavior
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

export { ServiceWorker, serviceWorker };
