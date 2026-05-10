/**
 * Message Types - Typed Inter-Component Communication Protocol
 *
 * All messages between components use this typed protocol.
 * The service worker is the ONLY trust boundary.
 */

export const MessageType = {
  // Content Script → Service Worker
  DOM_SNAPSHOT: 'DOM_SNAPSHOT',
  PEGA_DETECTED: 'PEGA_DETECTED',
  USER_NAVIGATION: 'USER_NAVIGATION',
  ACTION_RESULT: 'ACTION_RESULT',
  SUMMARY_REQUEST: 'SUMMARY_REQUEST',

  // Side Panel → Service Worker
  USER_COMMAND: 'USER_COMMAND',
  USER_CONFIRM: 'USER_CONFIRM',
  USER_CANCEL: 'USER_CANCEL',
  FEEDBACK: 'FEEDBACK',
  PANEL_READY: 'PANEL_READY',

  // Service Worker → Content Script
  EXECUTE_ACTION: 'EXECUTE_ACTION',
  CAPTURE_DOM: 'CAPTURE_DOM',
  GET_PII_MAP: 'GET_PII_MAP',

  // Service Worker → Side Panel
  SHOW_SUMMARY: 'SHOW_SUMMARY',
  SHOW_PLAN: 'SHOW_PLAN',
  SHOW_RESULT: 'SHOW_RESULT',
  SHOW_RECOMMENDATION: 'SHOW_RECOMMENDATION',
  SHOW_ERROR: 'SHOW_ERROR',
  UPDATE_ACTIVITY: 'UPDATE_ACTIVITY',
  CLEAR_PENDING: 'CLEAR_PENDING',
};

/**
 * Intent types for classification
 */
export const IntentType = {
  SUMMARIZE_CASE: 'SUMMARIZE_CASE',
  SUBMIT_CASE: 'SUBMIT_CASE',
  SAVE_CASE: 'SAVE_CASE',
  NEXT_STEP: 'NEXT_STEP',
  SHOW_QUEUE: 'SHOW_QUEUE',
  UPDATE_FIELD: 'UPDATE_FIELD',
  ESCALATE: 'ESCALATE',
  CREATE_CASE: 'CREATE_CASE',
  SEARCH: 'SEARCH',
  EXPLAIN: 'EXPLAIN',
  UNKNOWN: 'UNKNOWN',
  AMBIGUOUS: 'AMBIGUOUS',
};

/**
 * Action types for plan execution
 */
export const ActionType = {
  CLICK: 'CLICK',
  TYPE: 'TYPE',
  SELECT: 'SELECT',
  CLEAR: 'CLEAR',
  NAVIGATE: 'NAVIGATE',
  WAIT: 'WAIT',
  SCROLL: 'SCROLL',
};

/**
 * PII categories for classification
 */
export const PIICategory = {
  NAME: 'NAME',
  SSN: 'SSN',
  DOB: 'DOB',
  EMAIL: 'EMAIL',
  PHONE: 'PHONE',
  ACCOUNT: 'ACCOUNT',
  ADDRESS: 'ADDRESS',
};

/**
 * Pega UI framework types
 */
export const PegaFramework = {
  CONSTELLATION: 'CONSTELLATION',
  CLASSIC: 'CLASSIC',
  UNKNOWN: 'UNKNOWN',
};

/**
 * Audit event types
 */
export const AuditEventType = {
  PLAN_EXECUTED: 'PLAN_EXECUTED',
  SUMMARY_GENERATED: 'SUMMARY_GENERATED',
  PLAN_CANCELLED: 'PLAN_CANCELLED',
  INTENT_CLASSIFIED: 'INTENT_CLASSIFIED',
  PLAN_FAILED: 'PLAN_FAILED',
  ACTION_STEP_COMPLETED: 'ACTION_STEP_COMPLETED',
  ACTION_STEP_FAILED: 'ACTION_STEP_FAILED',
  FEEDBACK_SUBMITTED: 'FEEDBACK_SUBMITTED',
  PEGA_DETECTED: 'PEGA_DETECTED',
  PANEL_OPENED: 'PANEL_OPENED',
};

/**
 * Outcome types
 */
export const OutcomeType = {
  SUCCESS: 'success',
  PARTIAL: 'partial',
  FAILED: 'failed',
};

/**
 * Create a standard message envelope
 */
export function createMessage(type, payload, metadata = {}) {
  return {
    type,
    payload,
    metadata: {
      timestamp: Date.now(),
      ...metadata,
    },
  };
}

/**
 * Validate message structure
 */
export function validateMessage(message) {
  if (!message || typeof message !== 'object') return false;
  if (!message.type || !Object.values(MessageType).includes(message.type)) return false;
  if (!message.payload) return false;
  return true;
}

export default {
  MessageType,
  IntentType,
  ActionType,
  PIICategory,
  PegaFramework,
  AuditEventType,
  OutcomeType,
  createMessage,
  validateMessage,
};
