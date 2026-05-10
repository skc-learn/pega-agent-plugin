/**
 * DOM Observer - Watch Pega SPA Navigation and DOM Re-renders
 *
 * Monitors Pega root for mutations and URL changes.
 * Triggers DOM capture on significant changes.
 */

import { MessageType } from '../shared/types';
import { createMessage } from '../shared/message-types';
import { captureDOM } from './dom-parser';
import { extractCaseIdFromUrl } from '../shared/pega-heuristics';
import { piiMasker } from './pii-masker';

// ============================================================================
// TYPES
// ============================================================================

type CaptureCallback = (snapshot: ReturnType<typeof captureDOM>) => void;

// ============================================================================
// OBSERVER STATE
// ============================================================================

let observer: MutationObserver | null = null;
let lastCaseId: string | null = null;
let lastUrl: string = '';
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let captureCallback: CaptureCallback | null = null;

const DEBOUNCE_MS = 300;

// ============================================================================
// PEGA ROOT DETECTION
// ============================================================================

/**
 * Find Pega root element for observation
 */
function findPegaRoot(): HTMLElement {
  // Try Constellation root first
  const constellationRoot = document.querySelector('#pega-ui-root');
  if (constellationRoot) return constellationRoot as HTMLElement;

  // Try data-pega-app
  const pegaApp = document.querySelector('[data-pega-app]');
  if (pegaApp) return pegaApp as HTMLElement;

  // Fallback to body
  return document.body;
}

// ============================================================================
// URL CHANGE INTERCEPTION
// ============================================================================

/**
 * Intercept history API for client-side navigation
 */
function interceptHistory(): void {
  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  history.pushState = function (...args: Parameters<typeof history.pushState>) {
    originalPushState.apply(history, args);
    handleUrlChange();
  };

  history.replaceState = function (...args: Parameters<typeof history.replaceState>) {
    originalReplaceState.apply(history, args);
    handleUrlChange();
  };

  // Also listen for popstate (back/forward navigation)
  window.addEventListener('popstate', () => {
    handleUrlChange();
  });
}

// ============================================================================
// CHANGE HANDLERS
// ============================================================================

/**
 * Handle URL change detection
 */
function handleUrlChange(): void {
  const currentUrl = window.location.href;
  const currentCaseId = extractCaseIdFromUrl(currentUrl);

  // Check if case ID changed
  if (currentCaseId !== lastCaseId) {
    lastCaseId = currentCaseId;
    // Case ID changed → capture with summary trigger
    debouncedCapture(true);
  } else if (currentUrl !== lastUrl) {
    // URL changed, same case → capture without summary
    lastUrl = currentUrl;
    debouncedCapture(false);
  }
}

/**
 * Handle DOM mutation
 */
function handleMutation(mutations: MutationRecord[]): void {
  // Check for significant mutations
  let hasSignificantChange = false;

  for (const mutation of mutations) {
    // New data-test-id elements added
    if (mutation.type === 'childList') {
      for (const node of mutation.addedNodes) {
        if (node instanceof HTMLElement) {
          if (node.hasAttribute('data-test-id') ||
              node.querySelector('[data-test-id]')) {
            hasSignificantChange = true;
            break;
          }
        }
      }
    }

    // Attribute changes on relevant attributes
    if (mutation.type === 'attributes') {
      const attrName = mutation.attributeName;
      if (attrName === 'data-test-id' ||
          attrName === 'data-case-id' ||
          attrName === 'aria-label' ||
          attrName === 'class') {
        hasSignificantChange = true;
      }
    }

    if (hasSignificantChange) break;
  }

  if (hasSignificantChange) {
    // DOM changed → capture without summary
    debouncedCapture(false);
  }
}

/**
 * Debounced capture to avoid excessive captures during Pega render cycles
 */
function debouncedCapture(triggerSummary: boolean): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }

  debounceTimer = setTimeout(() => {
    performCapture(triggerSummary);
  }, DEBOUNCE_MS);
}

/**
 * Perform the actual DOM capture
 */
function performCapture(triggerSummary: boolean): void {
  try {
    const snapshot = captureDOM(triggerSummary);

    if (captureCallback) {
      captureCallback(snapshot);
    }
  } catch (error) {
    console.error('Pega Agent: DOM capture error', error);
  }
}

// ============================================================================
// MESSAGE SENDING
// ============================================================================

/**
 * Capture and send DOM snapshot to service worker
 */
export function captureAndSend(triggerSummary: boolean): void {
  try {
    const snapshot = captureDOM(triggerSummary);
    const message = createMessage(MessageType.DOM_SNAPSHOT, {
      snapshot,
      triggerSummary,
    });

    chrome.runtime.sendMessage(message);
  } catch (error) {
    console.error('Pega Agent: Failed to send DOM snapshot', error);
  }
}

// ============================================================================
// LIFECYCLE
// ============================================================================

/**
 * Initialize the DOM observer
 */
export function initObserver(callback?: CaptureCallback): void {
  if (observer) {
    console.warn('Pega Agent: Observer already initialized');
    return;
  }

  // Store callback
  if (callback) {
    captureCallback = callback;
  } else {
    // Default to sending to service worker
    captureCallback = (snapshot) => {
      const message = createMessage(MessageType.DOM_SNAPSHOT, {
        snapshot,
        triggerSummary: snapshot.triggerSummary,
      });
      chrome.runtime.sendMessage(message);
    };
  }

  // Find Pega root
  const root = findPegaRoot();

  // Initialize state
  lastUrl = window.location.href;
  lastCaseId = extractCaseIdFromUrl(lastUrl);

  // Create mutation observer
  observer = new MutationObserver(handleMutation);

  // Start observing
  observer.observe(root, {
    childList: true,
    subtree: true,
    attributeFilter: ['data-test-id', 'data-case-id', 'aria-label', 'class'],
  });

  // Intercept history for SPA navigation
  interceptHistory();

  // Initial capture
  performCapture(true);

  console.log('Pega Agent: DOM observer initialized');
}

/**
 * Stop the DOM observer
 */
export function stopObserver(): void {
  if (observer) {
    observer.disconnect();
    observer = null;
  }

  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }

  captureCallback = null;

  console.log('Pega Agent: DOM observer stopped');
}

/**
 * Force a capture
 */
export function forceCapture(triggerSummary: boolean = false): void {
  performCapture(triggerSummary);
}

/**
 * Handle tab/session close - clear PII tokens
 */
export function cleanup(): void {
  stopObserver();
  piiMasker.clearSession();
  lastCaseId = null;
  lastUrl = '';
}
