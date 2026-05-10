/**
 * Audit Logger - Complete Activity Record
 *
 * Records all agent actions with masked tokens only.
 * Never logs raw PII values, auth tokens, or passwords.
 */

import { AuditEventType, OutcomeType } from './message-types.js';

/**
 * Audit log entry structure
 */
class AuditEntry {
  constructor(eventType, data = {}) {
    this.timestamp = new Date().toISOString();
    this.sessionId = data.sessionId || this.generateSessionId();
    this.userId = data.userId || null;
    this.caseId = data.caseId || null;
    this.eventType = eventType;
    this.intent = data.intent || null;
    this.planSummary = data.planSummary || null;
    this.stepCount = data.stepCount || null;
    this.outcome = data.outcome || OutcomeType.SUCCESS;
    this.errorMessage = data.errorMessage || null;
    this.metadata = data.metadata || {};
  }

  generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  toJSON() {
    return {
      timestamp: this.timestamp,
      sessionId: this.sessionId,
      userId: this.userId,
      caseId: this.caseId,
      eventType: this.eventType,
      intent: this.intent,
      planSummary: this.planSummary,
      stepCount: this.stepCount,
      outcome: this.outcome,
      errorMessage: this.errorMessage,
      metadata: this.metadata,
    };
  }
}

/**
 * Audit Logger class
 */
class AuditLogger {
  constructor() {
    this.entries = [];
    this.sessionId = null;
    this.userId = null;
    this.maxEntries = 1000; // Prevent unbounded growth
    this.isEnabled = true;
    this.remoteEndpoint = null;
  }

  /**
   * Initialize logger with session context
   * @param {Object} context - Session context
   */
  initialize(context = {}) {
    this.sessionId = context.sessionId || this.generateSessionId();
    this.userId = context.userId || null;
  }

  /**
   * Generate unique session ID
   * @returns {string}
   */
  generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set user ID from Pega session
   * @param {string} userId
   */
  setUserId(userId) {
    this.userId = userId;
  }

  /**
   * Enable or disable logging
   * @param {boolean} enabled
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  /**
   * Set remote endpoint for enterprise logging
   * @param {string} endpoint
   */
  setRemoteEndpoint(endpoint) {
    this.remoteEndpoint = endpoint;
  }

  /**
   * Log an event
   * @param {string} eventType - AuditEventType
   * @param {Object} data - Event data
   */
  log(eventType, data = {}) {
    if (!this.isEnabled) {
      return null;
    }

    // Ensure no raw PII in data
    const sanitizedData = this.sanitizeData(data);

    const entry = new AuditEntry(eventType, {
      sessionId: this.sessionId,
      userId: this.userId,
      ...sanitizedData,
    });

    this.entries.push(entry);

    // Trim old entries if needed
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // Send to remote if configured
    if (this.remoteEndpoint) {
      this.sendToRemote(entry);
    }

    return entry;
  }

  /**
   * Sanitize data to remove PII
   * @param {Object} data
   * @returns {Object}
   */
  sanitizeData(data) {
    const sanitized = { ...data };

    // Fields to never log
    const sensitiveFields = [
      'password',
      'token',
      'auth',
      'secret',
      'credential',
      'apiKey',
      'accessToken',
    ];

    // Remove sensitive fields
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        delete sanitized[field];
      }
    }

    // Check for unmasked PII patterns in strings
    for (const [key, value] of Object.entries(sanitized)) {
      if (typeof value === 'string') {
        // Warn if looks like unmasked PII
        if (this.looksLikePII(value)) {
          console.warn(`AuditLogger: Potential unmasked PII in field "${key}"`);
          sanitized[key] = '[REDACTED]';
        }
      }
    }

    return sanitized;
  }

  /**
   * Check if string looks like unmasked PII
   * @param {string} value
   * @returns {boolean}
   */
  looksLikePII(value) {
    // SSN pattern
    if (/^\d{3}-\d{2}-\d{4}$/.test(value)) return true;

    // Credit card pattern
    if (/^\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}$/.test(value)) return true;

    // Email pattern (if not already masked)
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && !value.includes('{')) return true;

    // Phone number pattern
    if (/^\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}$/.test(value)) return true;

    return false;
  }

  /**
   * Log plan execution
   * @param {Object} plan - Action plan
   * @param {string} outcome - OutcomeType
   * @param {string} errorMessage - Error message if failed
   */
  logPlanExecution(plan, outcome, errorMessage = null) {
    return this.log(AuditEventType.PLAN_EXECUTED, {
      caseId: plan.caseId,
      intent: plan.intent,
      planSummary: plan.summary,
      stepCount: plan.steps?.length || 0,
      outcome,
      errorMessage,
      metadata: {
        planId: plan.id,
        confirmed: plan.confirmed,
      },
    });
  }

  /**
   * Log summary generation
   * @param {string} caseId
   * @param {boolean} success
   */
  logSummaryGeneration(caseId, success) {
    return this.log(AuditEventType.SUMMARY_GENERATED, {
      caseId,
      outcome: success ? OutcomeType.SUCCESS : OutcomeType.FAILED,
    });
  }

  /**
   * Log plan cancellation
   * @param {Object} plan - Cancelled plan
   */
  logPlanCancellation(plan) {
    return this.log(AuditEventType.PLAN_CANCELLED, {
      caseId: plan.caseId,
      intent: plan.intent,
      planSummary: plan.summary,
      outcome: OutcomeType.SUCCESS,
    });
  }

  /**
   * Log intent classification
   * @param {string} command - User command
   * @param {string} intent - Classified intent
   * @param {number} confidence
   */
  logIntentClassification(command, intent, confidence) {
    return this.log(AuditEventType.INTENT_CLASSIFIED, {
      intent,
      planSummary: `Command: "${command.substring(0, 100)}"`,
      outcome: OutcomeType.SUCCESS,
      metadata: {
        confidence,
        commandLength: command.length,
      },
    });
  }

  /**
   * Log action step completion
   * @param {number} stepNumber
   * @param {string} action
   * @param {boolean} success
   */
  logActionStep(stepNumber, action, success) {
    return this.log(AuditEventType.ACTION_STEP_COMPLETED, {
      planSummary: `Step ${stepNumber}: ${action}`,
      outcome: success ? OutcomeType.SUCCESS : OutcomeType.FAILED,
      metadata: {
        stepNumber,
        action,
      },
    });
  }

  /**
   * Log feedback submission
   * @param {string} type - Feedback type (thumbs up/down)
   * @param {string} context - What the feedback was about
   */
  logFeedback(type, context) {
    return this.log(AuditEventType.FEEDBACK_SUBMITTED, {
      planSummary: `Feedback: ${type}`,
      outcome: OutcomeType.SUCCESS,
      metadata: {
        feedbackType: type,
        context,
      },
    });
  }

  /**
   * Send entry to remote endpoint
   * @param {AuditEntry} entry
   */
  async sendToRemote(entry) {
    if (!this.remoteEndpoint) {
      return;
    }

    try {
      const response = await fetch(this.remoteEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(entry.toJSON()),
      });

      if (!response.ok) {
        console.error('AuditLogger: Failed to send to remote', response.status);
      }
    } catch (error) {
      console.error('AuditLogger: Remote logging error', error);
    }
  }

  /**
   * Get all entries
   * @returns {AuditEntry[]}
   */
  getEntries() {
    return this.entries.map((entry) => entry.toJSON());
  }

  /**
   * Get entries by type
   * @param {string} eventType
   * @returns {AuditEntry[]}
   */
  getEntriesByType(eventType) {
    return this.entries
      .filter((entry) => entry.eventType === eventType)
      .map((entry) => entry.toJSON());
  }

  /**
   * Get entries for a case
   * @param {string} caseId
   * @returns {AuditEntry[]}
   */
  getEntriesForCase(caseId) {
    return this.entries
      .filter((entry) => entry.caseId === caseId)
      .map((entry) => entry.toJSON());
  }

  /**
   * Get recent entries
   * @param {number} count
   * @returns {AuditEntry[]}
   */
  getRecentEntries(count = 10) {
    return this.entries
      .slice(-count)
      .map((entry) => entry.toJSON());
  }

  /**
   * Clear all entries
   */
  clear() {
    this.entries = [];
  }

  /**
   * Export log as JSON
   * @returns {string}
   */
  export() {
    return JSON.stringify(this.getEntries(), null, 2);
  }

  /**
   * Get log statistics
   * @returns {Object}
   */
  getStats() {
    const stats = {
      totalEntries: this.entries.length,
      byEventType: {},
      byOutcome: {},
      byIntent: {},
    };

    for (const entry of this.entries) {
      // Count by event type
      stats.byEventType[entry.eventType] = (stats.byEventType[entry.eventType] || 0) + 1;

      // Count by outcome
      stats.byOutcome[entry.outcome] = (stats.byOutcome[entry.outcome] || 0) + 1;

      // Count by intent
      if (entry.intent) {
        stats.byIntent[entry.intent] = (stats.byIntent[entry.intent] || 0) + 1;
      }
    }

    return stats;
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();

// Also export class for testing
export { AuditLogger, AuditEntry };

export default auditLogger;
