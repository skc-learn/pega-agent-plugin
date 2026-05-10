/**
 * DOM Observer - SPA Navigation Detection for Pega Constellation
 *
 * Watches for DOM mutations and URL changes to detect:
 * - Case navigation (caseId changes)
 * - Page/section changes
 * - Form updates
 */

import { createMessage, MessageType } from '../shared/message-types.js';
import { domParser } from './dom-parser.js';

/**
 * Observer configuration
 */
const OBSERVER_CONFIG = {
  childList: true,
  subtree: true,
  attributes: true,
  attributeFilter: ['class', 'data-case-id', 'data-stage'],
  characterData: false,
};

/**
 * Debounce delay for mutations (ms)
 */
const DEBOUNCE_DELAY = 300;

/**
 * Minimum time between snapshots (ms)
 */
const MIN_SNAPSHOT_INTERVAL = 500;

/**
 * DOM Observer class
 */
class DOMObserver {
  constructor() {
    this.observer = null;
    this.mutationTimeout = null;
    this.lastSnapshotTime = 0;
    this.currentUrl = window.location.href;
    this.currentCaseId = null;
    this.isObserving = false;
  }

  /**
   * Start observing DOM and URL changes
   */
  start() {
    if (this.isObserving) {
      return;
    }

    // Initial parse
    const initialContext = domParser.parse(true);
    this.currentCaseId = initialContext.caseContext?.caseId;

    // Set up MutationObserver
    this.observer = new MutationObserver((mutations) => {
      this.handleMutations(mutations);
    });

    // Find root element to observe
    const rootElement = this.findRootElement();
    if (rootElement) {
      this.observer.observe(rootElement, OBSERVER_CONFIG);
    } else {
      // Fall back to body
      this.observer.observe(document.body, OBSERVER_CONFIG);
    }

    // Set up URL change listeners
    this.setupUrlListeners();

    this.isObserving = true;
  }

  /**
   * Stop observing
   */
  stop() {
    if (this.observer) {
      this.observer.disconnect();
      this.observer = null;
    }

    this.removeUrlListeners();
    this.isObserving = false;
  }

  /**
   * Find the Pega root element to observe
   * @returns {HTMLElement}
   */
  findRootElement() {
    // Constellation root
    const constellationRoot = document.querySelector('#pega-ui-root, [data-pega-app]');
    if (constellationRoot) {
      return constellationRoot;
    }

    // Classic UI root
    const classicRoot = document.querySelector('.pega-ui-form, .harness-body');
    if (classicRoot) {
      return classicRoot;
    }

    return document.body;
  }

  /**
   * Handle batch of mutations with debouncing
   * @param {MutationRecord[]} mutations
   */
  handleMutations(mutations) {
    // Clear pending timeout
    if (this.mutationTimeout) {
      clearTimeout(this.mutationTimeout);
    }

    // Check if any mutation is significant
    const isSignificant = mutations.some((mutation) => this.isSignificantMutation(mutation));

    if (!isSignificant) {
      return;
    }

    // Debounce the mutation handling
    this.mutationTimeout = setTimeout(() => {
      this.processMutations(mutations);
    }, DEBOUNCE_DELAY);
  }

  /**
   * Check if mutation is significant enough to trigger re-parse
   * @param {MutationRecord} mutation
   * @returns {boolean}
   */
  isSignificantMutation(mutation) {
    // Ignore style-only changes
    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
      const target = mutation.target;
      // Check if class change indicates visibility or active state change
      const classChanges = ['active', 'visible', 'hidden', 'disabled', 'loading'];
      const hasRelevantChange = classChanges.some((cls) =>
        target.classList.contains(cls) || mutation.oldValue?.includes(cls)
      );
      return hasRelevantChange;
    }

    // Ignore small text changes
    if (mutation.type === 'characterData') {
      return false;
    }

    // Check for case ID changes
    if (mutation.type === 'attributes' && mutation.attributeName === 'data-case-id') {
      return true;
    }

    // Check for added/removed nodes that are significant
    if (mutation.type === 'childList') {
      // Check added nodes
      for (const node of mutation.addedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          // Check if it's a significant element type
          if (this.isSignificantElement(node)) {
            return true;
          }
        }
      }

      // Check removed nodes
      for (const node of mutation.removedNodes) {
        if (node.nodeType === Node.ELEMENT_NODE) {
          if (this.isSignificantElement(node)) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Check if element is significant for re-parsing
   * @param {HTMLElement} element
   * @returns {boolean}
   */
  isSignificantElement(element) {
    const significantSelectors = [
      'form',
      '[data-test-id]',
      '[data-case-id]',
      '.case-content',
      '.stage',
      'button',
      'input',
      'select',
      'textarea',
    ];

    for (const selector of significantSelectors) {
      if (element.matches && element.matches(selector)) {
        return true;
      }
      if (element.querySelector && element.querySelector(selector)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Process mutations after debounce
   * @param {MutationRecord[]} mutations
   */
  processMutations(mutations) {
    const now = Date.now();

    // Rate limit snapshots
    if (now - this.lastSnapshotTime < MIN_SNAPSHOT_INTERVAL) {
      return;
    }

    this.lastSnapshotTime = now;

    // Check if case changed
    const newCaseId = this.detectCaseChange();

    // Parse DOM
    const context = domParser.parse(newCaseId !== null);

    // Update current case ID
    if (context.caseContext?.caseId) {
      this.currentCaseId = context.caseContext.caseId;
    }
  }

  /**
   * Detect if case ID has changed
   * @returns {string|null} - New case ID if changed, null otherwise
   */
  detectCaseChange() {
    const newCaseId = domParser.extractCaseId();

    if (newCaseId && newCaseId !== this.currentCaseId) {
      // Case changed
      this.sendNavigationMessage('case-change', {
        from: this.currentCaseId,
        to: newCaseId,
      });
      return newCaseId;
    }

    return null;
  }

  /**
   * Set up URL change listeners for SPA navigation
   */
  setupUrlListeners() {
    // Intercept history methods
    this.originalPushState = history.pushState;
    this.originalReplaceState = history.replaceState;

    const self = this;

    history.pushState = function (...args) {
      self.originalPushState.apply(this, args);
      self.handleUrlChange('pushState');
    };

    history.replaceState = function (...args) {
      self.originalReplaceState.apply(this, args);
      self.handleUrlChange('replaceState');
    };

    // Listen for popstate (back/forward)
    this.popstateHandler = () => this.handleUrlChange('popstate');
    window.addEventListener('popstate', this.popstateHandler);

    // Listen for hashchange
    this.hashchangeHandler = () => this.handleUrlChange('hashchange');
    window.addEventListener('hashchange', this.hashchangeHandler);
  }

  /**
   * Remove URL change listeners
   */
  removeUrlListeners() {
    if (this.originalPushState) {
      history.pushState = this.originalPushState;
    }
    if (this.originalReplaceState) {
      history.replaceState = this.originalReplaceState;
    }
    if (this.popstateHandler) {
      window.removeEventListener('popstate', this.popstateHandler);
    }
    if (this.hashchangeHandler) {
      window.removeEventListener('hashchange', this.hashchangeHandler);
    }
  }

  /**
   * Handle URL change
   * @param {string} source - Source of URL change
   */
  handleUrlChange(source) {
    const newUrl = window.location.href;

    if (newUrl !== this.currentUrl) {
      this.currentUrl = newUrl;

      this.sendNavigationMessage('url-change', {
        url: newUrl,
        source,
      });

      // Wait for DOM to update, then re-parse
      setTimeout(() => {
        const newCaseId = domParser.extractCaseId();
        const caseChanged = newCaseId && newCaseId !== this.currentCaseId;

        domParser.parse(caseChanged);

        if (caseChanged) {
          this.currentCaseId = newCaseId;
        }
      }, DEBOUNCE_DELAY);
    }
  }

  /**
   * Send navigation message to service worker
   * @param {string} navigationType
   * @param {Object} details
   */
  sendNavigationMessage(navigationType, details) {
    const message = createMessage(MessageType.USER_NAVIGATION, {
      type: navigationType,
      ...details,
      timestamp: Date.now(),
    });

    chrome.runtime.sendMessage(message);
  }

  /**
   * Force immediate re-parse
   */
  forceReparse() {
    this.lastSnapshotTime = 0; // Reset rate limit
    domParser.parse(true);
  }

  /**
   * Get observer state
   * @returns {Object}
   */
  getState() {
    return {
      isObserving: this.isObserving,
      currentUrl: this.currentUrl,
      currentCaseId: this.currentCaseId,
      lastSnapshotTime: this.lastSnapshotTime,
    };
  }
}

// Export singleton instance
export const domObserver = new DOMObserver();

// Also export class for testing
export { DOMObserver };

// Auto-start when DOM is ready
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      domObserver.start();
    });
  } else {
    domObserver.start();
  }
}

export default domObserver;
