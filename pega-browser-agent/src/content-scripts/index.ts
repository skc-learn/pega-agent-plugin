/**
 * Content Script Entry Point
 *
 * Bootstraps all modules:
 * - Pega detection
 * - DOM observer
 * - Action executor
 * - Message handling
 */

// VERY EARLY LOG - should always appear if content script loads
console.log('[Pega Agent] ========== CONTENT SCRIPT LOADED ==========');
console.log('[Pega Agent] URL:', window.location.href);
console.log('[Pega Agent] ReadyState:', document.readyState);

import { MessageType } from '../shared/types';
import { createMessage } from '../shared/message-types';
import { detectPega, isLikelyPega } from './pega-detector';
import { initObserver, stopObserver, forceCapture, cleanup } from './dom-observer';
import { executePlan, validatePlan } from './action-executor';
import { piiMasker } from './pii-masker';
import type { ActionPlan } from '../shared/types';

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the content script
 */
async function initialize(): Promise<void> {
  console.log('[Pega Agent] Content script loading on:', window.location.href);

  // Quick check before full detection
  if (!isLikelyPega()) {
    console.log('[Pega Agent] Not a Pega page, exiting');
    return;
  }

  // Full Pega detection
  const detection = detectPega();

  if (!detection) {
    console.warn('[Pega Agent] Detection returned null - confidence too low');
    // Still notify service worker about potential Pega page with low confidence
    try {
      await chrome.runtime.sendMessage(
        createMessage(MessageType.PEGA_DETECTED, {
          isDetected: false,
          confidence: 0,
          framework: 'unknown',
          version: 'unknown',
          appName: undefined,
          url: window.location.href,
          detectionFailed: true,
        })
      );
    } catch (e) {
      console.warn('[Pega Agent] Failed to notify service worker:', e);
    }
    return;
  }

  // Notify service worker of detection
  await chrome.runtime.sendMessage(
    createMessage(MessageType.PEGA_DETECTED, {
      isDetected: detection.isPega,
      confidence: detection.confidence,
      framework: detection.uiFramework,
      version: detection.version,
      appName: detection.appName,
      url: window.location.href,
    })
  );

  // Initialize DOM observer
  initObserver();

  console.log('Pega Agent: Content script initialized', {
    framework: detection.uiFramework,
    version: detection.version,
  });
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

/**
 * Handle messages from service worker
 */
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const { type, payload } = message;

  switch (type) {
    case MessageType.EXECUTE_ACTION:
      handleExecuteAction(payload.plan as ActionPlan, sendResponse);
      return true; // Keep channel open

    case MessageType.CAPTURE_DOM:
      handleCaptureDom(payload.triggerSummary as boolean, sendResponse);
      return true;

    case 'GET_PII_STATS':
      sendResponse(piiMasker.getStats());
      return false;

    default:
      sendResponse({ error: 'Unknown message type' });
      return false;
  }
});

/**
 * Handle plan execution request
 */
async function handleExecuteAction(
  plan: ActionPlan,
  sendResponse: (response?: unknown) => void
): Promise<void> {
  try {
    // Validate plan against current DOM
    const validation = validatePlan(plan);
    if (!validation.valid) {
      sendResponse({
        success: false,
        error: `Validation failed: ${validation.errors.join(', ')}`,
      });
      return;
    }

    // Execute the plan
    const result = await executePlan(plan);

    // Send result to service worker
    await chrome.runtime.sendMessage(
      createMessage(MessageType.ACTION_RESULT, {
        planId: plan.planId,
        result,
      })
    );

    sendResponse({ success: true, result });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Execution failed',
    });
  }
}

/**
 * Handle DOM capture request
 */
function handleCaptureDom(
  triggerSummary: boolean,
  sendResponse: (response?: unknown) => void
): void {
  try {
    forceCapture(triggerSummary);
    sendResponse({ success: true });
  } catch (error) {
    sendResponse({
      success: false,
      error: error instanceof Error ? error.message : 'Capture failed',
    });
  }
}

// ============================================================================
// LIFECYCLE
// ============================================================================

// Initialize on load with error handling
function safeInitialize(): void {
  console.log('[Pega Agent] safeInitialize() called');
  try {
    initialize().catch((err) => {
      console.error('[Pega Agent] Async initialization error:', err);
    });
  } catch (err) {
    console.error('[Pega Agent] Sync initialization error:', err);
  }
}

if (document.readyState === 'loading') {
  console.log('[Pega Agent] Document loading, waiting for DOMContentLoaded');
  document.addEventListener('DOMContentLoaded', safeInitialize);
} else {
  console.log('[Pega Agent] Document already loaded, initializing now');
  safeInitialize();
}

// Cleanup on unload
window.addEventListener('unload', () => {
  stopObserver();
  cleanup();
});

// Listen for PII masker configuration updates
chrome.storage.onChanged.addListener((changes, _areaName) => {
  if (changes.pegaAgentConfig) {
    const newConfig = changes.pegaAgentConfig.newValue;
    if (newConfig?.security?.piiCategoriesToMask) {
      piiMasker.configure(newConfig.security.piiCategoriesToMask);
    }
  }
});
