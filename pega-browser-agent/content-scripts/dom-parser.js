/**
 * DOM Parser - Semantic DOM Extraction for Pega Pages
 *
 * Extracts structured context from Pega pages including:
 * - Case context (ID, class, type, status, etc.)
 * - Form fields with semantic metadata
 * - Action buttons
 * - Stage information
 */

import { createMessage, MessageType } from '../shared/message-types.js';
import {
  PEGA_DATA_ATTRIBUTES,
  PEGA_TEST_ID_PREFIXES,
  extractCaseIdFromUrl,
  inferFieldLabel,
  classifyActionButton,
  detectCaseDomain,
} from '../shared/pega-heuristics.js';
import { piiMasker } from './pii-masker.js';

/**
 * Field type mapping from input types
 */
const FIELD_TYPE_MAP = {
  text: 'text',
  email: 'text',
  password: 'text',
  tel: 'text',
  url: 'text',
  number: 'number',
  date: 'date',
  'datetime-local': 'datetime',
  time: 'time',
  checkbox: 'checkbox',
  radio: 'radio',
  select: 'dropdown',
  textarea: 'textarea',
  file: 'file',
};

/**
 * DOM Parser class
 */
class DOMParser {
  constructor() {
    this.lastSnapshot = null;
    this.lastCaseId = null;
  }

  /**
   * Parse current Pega page and extract structured context
   * @param {boolean} triggerSummary - Whether to trigger summarization
   * @returns {Object} - Structured page context
   */
  parse(triggerSummary = false) {
    const url = window.location.href;
    const caseId = this.extractCaseId();

    // Detect if case changed
    const caseChanged = caseId && caseId !== this.lastCaseId;
    if (caseChanged) {
      this.lastCaseId = caseId;
    }

    const context = {
      timestamp: Date.now(),
      url,
      caseContext: this.extractCaseContext(caseId),
      fields: this.extractFields(),
      actions: this.extractActions(),
      stage: this.extractStage(),
      triggerSummary: triggerSummary || caseChanged,
      caseChanged,
    };

    this.lastSnapshot = context;

    // Send snapshot to service worker
    this.sendSnapshot(context);

    return context;
  }

  /**
   * Extract case ID from DOM or URL
   * @returns {string|null}
   */
  extractCaseId() {
    // Try data-case-id attribute first
    const caseIdElement = document.querySelector(`[${PEGA_DATA_ATTRIBUTES.caseId}]`);
    if (caseIdElement) {
      return caseIdElement.getAttribute(PEGA_DATA_ATTRIBUTES.caseId);
    }

    // Try URL pattern
    return extractCaseIdFromUrl(window.location.href);
  }

  /**
   * Extract case context information
   * @param {string} caseId - Case ID
   * @returns {Object}
   */
  extractCaseContext(caseId) {
    const context = {
      caseId,
      caseClass: null,
      caseType: null,
      status: null,
      urgency: null,
      assignedTo: null,
      slaDeadline: null,
      domain: null,
    };

    if (!caseId) return context;

    // Extract case class from test ID prefix or URL
    context.caseClass = this.inferCaseClass();

    // Extract case type
    const caseTypeElement = document.querySelector(
      `[${PEGA_DATA_ATTRIBUTES.testId}*="${PEGA_TEST_ID_PREFIXES.caseType}"]`
    );
    if (caseTypeElement) {
      context.caseType = caseTypeElement.textContent.trim();
    }

    // Extract status
    const statusElement = document.querySelector(
      `[${PEGA_DATA_ATTRIBUTES.testId}*="${PEGA_TEST_ID_PREFIXES.status}"], [${PEGA_DATA_ATTRIBUTES.caseStatus}]`
    );
    if (statusElement) {
      context.status = statusElement.textContent.trim() ||
        statusElement.getAttribute(PEGA_DATA_ATTRIBUTES.caseStatus);
    }

    // Extract urgency
    const urgencyElement = document.querySelector(
      `[${PEGA_DATA_ATTRIBUTES.testId}*="Urgency"], [${PEGA_DATA_ATTRIBUTES.testId}*="urgency"]`
    );
    if (urgencyElement) {
      const urgencyText = urgencyElement.textContent.trim();
      const urgencyMatch = urgencyText.match(/(\d+)/);
      if (urgencyMatch) {
        context.urgency = parseInt(urgencyMatch[1], 10);
      }
    }

    // Extract assigned to
    const assignedToElement = document.querySelector(
      `[${PEGA_DATA_ATTRIBUTES.testId}*="AssignedTo"], [${PEGA_DATA_ATTRIBUTES.testId}*="assigned"]`
    );
    if (assignedToElement) {
      context.assignedTo = assignedToElement.textContent.trim();
    }

    // Extract SLA deadline
    const slaElement = document.querySelector(
      `[${PEGA_DATA_ATTRIBUTES.testId}*="SLA"], [${PEGA_DATA_ATTRIBUTES.testId}*="Deadline"], [${PEGA_DATA_ATTRIBUTES.testId}*="TargetDate"]`
    );
    if (slaElement) {
      context.slaDeadline = slaElement.textContent.trim();
    }

    // Detect domain
    context.domain = detectCaseDomain(context.caseClass || context.caseType);

    return context;
  }

  /**
   * Infer case class from URL or test IDs
   * @returns {string|null}
   */
  inferCaseClass() {
    // Try URL
    const url = window.location.href;
    const caseMatch = url.match(/\/case\/([A-Za-z]+)-/);
    if (caseMatch) {
      return caseMatch[1];
    }

    // Try test ID patterns
    const testIdElements = document.querySelectorAll(`[${PEGA_DATA_ATTRIBUTES.testId}]`);
    for (const element of testIdElements) {
      const testId = element.getAttribute(PEGA_DATA_ATTRIBUTES.testId);
      const prefixMatch = testId.match(/^(CaseType|Case)_([A-Za-z]+)/);
      if (prefixMatch) {
        return prefixMatch[2];
      }
    }

    return null;
  }

  /**
   * Extract all form fields with semantic metadata
   * @returns {Array}
   */
  extractFields() {
    const fields = [];

    // Find all input, select, and textarea elements
    const inputs = document.querySelectorAll(
      `input:not([type="hidden"]):not([type="submit"]):not([type="button"]), select, textarea`
    );

    for (const input of inputs) {
      const field = this.extractField(input);
      if (field) {
        fields.push(field);
      }
    }

    // Apply PII masking
    return piiMasker.maskFields(fields);
  }

  /**
   * Extract single field metadata
   * @param {HTMLElement} element
   * @returns {Object|null}
   */
  extractField(element) {
    // Skip disabled/hidden elements
    if (element.disabled || element.type === 'hidden') {
      return null;
    }

    const testId = element.getAttribute(PEGA_DATA_ATTRIBUTES.testId) || '';
    const label = inferFieldLabel(element, testId);
    const fieldType = FIELD_TYPE_MAP[element.type] || element.tagName.toLowerCase();
    const value = this.getFieldValue(element);
    const isEditable = !element.disabled && !element.readOnly;

    // Build reliable selector
    const selector = this.buildSelector(element, testId);

    return {
      testId,
      label,
      value,
      piiCategory: null, // Will be filled by piiMasker
      fieldType,
      isEditable,
      selector,
      id: element.id || null,
      name: element.name || null,
    };
  }

  /**
   * Get field value based on type
   * @param {HTMLElement} element
   * @returns {string}
   */
  getFieldValue(element) {
    if (element.tagName === 'SELECT') {
      return element.options[element.selectedIndex]?.text || element.value;
    }
    if (element.type === 'checkbox' || element.type === 'radio') {
      return element.checked ? 'checked' : 'unchecked';
    }
    return element.value || '';
  }

  /**
   * Build reliable CSS selector for element
   * @param {HTMLElement} element
   * @param {string} testId
   * @returns {string}
   */
  buildSelector(element, testId) {
    // Prefer data-test-id
    if (testId) {
      return `[${PEGA_DATA_ATTRIBUTES.testId}="${testId}"]`;
    }

    // Try ID
    if (element.id) {
      return `#${element.id}`;
    }

    // Try name attribute
    if (element.name) {
      const type = element.type || element.tagName.toLowerCase();
      return `${element.tagName.toLowerCase()}[name="${element.name}"][type="${type}"]`;
    }

    // Fall back to nth-child
    const parent = element.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (child) => child.tagName === element.tagName
      );
      const index = siblings.indexOf(element) + 1;
      return `${element.tagName.toLowerCase()}:nth-child(${index})`;
    }

    return element.tagName.toLowerCase();
  }

  /**
   * Extract all action buttons
   * @returns {Array}
   */
  extractActions() {
    const actions = [];

    // Find all buttons and actionable elements
    const buttons = document.querySelectorAll(
      'button, [role="button"], input[type="submit"], input[type="button"], a[role="button"]'
    );

    for (const button of buttons) {
      const action = this.extractAction(button);
      if (action) {
        actions.push(action);
      }
    }

    return actions;
  }

  /**
   * Extract single action button metadata
   * @param {HTMLElement} element
   * @returns {Object|null}
   */
  extractAction(element) {
    // Skip hidden/disabled buttons
    if (element.hidden || (element.disabled && element.tagName !== 'A')) {
      return null;
    }

    const testId = element.getAttribute(PEGA_DATA_ATTRIBUTES.testId) || '';
    const label = element.getAttribute('aria-label') ||
      element.textContent.trim() ||
      element.value ||
      '';
    const actionType = classifyActionButton(label);
    const selector = this.buildSelector(element, testId);

    return {
      label,
      testId,
      selector,
      actionType,
      disabled: element.disabled || false,
    };
  }

  /**
   * Extract stage information
   * @returns {Object}
   */
  extractStage() {
    const stage = {
      current: null,
      stages: [],
      stageType: null,
    };

    // Find stage indicators
    const stageElements = document.querySelectorAll(
      `[${PEGA_DATA_ATTRIBUTES.testId}*="${PEGA_TEST_ID_PREFIXES.stage}"], [class*="stage"], [role="tab"]`
    );

    for (const element of stageElements) {
      const stageName = element.textContent.trim();
      if (stageName) {
        stage.stages.push(stageName);

        // Check if this is the current/active stage
        const isActive = element.classList.contains('active') ||
          element.classList.contains('current') ||
          element.getAttribute('aria-selected') === 'true' ||
          element.hasAttribute('data-active');

        if (isActive) {
          stage.current = stageName;
        }
      }
    }

    // If no active stage found, try to infer from breadcrumbs
    if (!stage.current && stage.stages.length > 0) {
      const breadcrumb = document.querySelector('[class*="breadcrumb"]');
      if (breadcrumb) {
        const items = breadcrumb.querySelectorAll('li, span, a');
        if (items.length > 0) {
          stage.current = items[items.length - 1].textContent.trim();
        }
      }
    }

    return stage;
  }

  /**
   * Send snapshot to service worker
   * @param {Object} context
   */
  sendSnapshot(context) {
    const message = createMessage(MessageType.DOM_SNAPSHOT, context);
    chrome.runtime.sendMessage(message);
  }

  /**
   * Get last parsed snapshot
   * @returns {Object|null}
   */
  getLastSnapshot() {
    return this.lastSnapshot;
  }

  /**
   * Force re-parse
   * @param {boolean} triggerSummary
   * @returns {Object}
   */
  reparse(triggerSummary = false) {
    return this.parse(triggerSummary);
  }
}

// Export singleton instance
export const domParser = new DOMParser();

// Also export class for testing
export { DOMParser };

export default domParser;
