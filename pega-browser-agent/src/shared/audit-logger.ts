/**
 * Audit Logger - Immutable Structured Logging
 *
 * Every co-pilot action logged. Never logs raw PII, resolved tokens,
 * auth tokens, cookies, or full DOM snapshots.
 */

import type { IntentType, OutcomeType, AuditEntry, ActionPlan } from './types';
import { generateUUID } from './message-types';

// ============================================================================
// EVENT TYPES
// ============================================================================

export type AuditEventType =
  | 'PEGA_DETECTED'
  | 'CASE_OPENED'
  | 'SUMMARY_GENERATED'
  | 'COMMAND_RECEIVED'
  | 'INTENT_CLASSIFIED'
  | 'PLAN_GENERATED'
  | 'PLAN_CONFIRMED'
  | 'PLAN_CANCELLED'
  | 'PLAN_EXECUTED'
  | 'PLAN_STEP_FAILED'
  | 'FEEDBACK_RECEIVED';

// ============================================================================
// AUDIT LOGGER CLASS
// ============================================================================

interface AuditLoggerConfig {
  sessionId: string;
  userId?: string;
  backendEndpoint?: string;
  maxEntries?: number;
}

class AuditLogger {
  private sessionId: string = '';
  private userId: string | null = null;
  private backendEndpoint: string | null = null;
  private maxEntries: number = 500;
  private entries: AuditEntry[] = [];

  /**
   * Initialize the audit logger
   */
  initialize(config: AuditLoggerConfig): void {
    this.sessionId = config.sessionId;
    this.userId = config.userId ?? null;
    this.backendEndpoint = config.backendEndpoint ?? null;
    this.maxEntries = config.maxEntries ?? 500;
  }

  /**
   * Set user ID for audit entries
   */
  setUserId(userId: string | null): void {
    this.userId = userId;
  }

  /**
   * Create an audit entry
   */
  private createEntry(
    eventType: AuditEventType,
    options: {
      caseId?: string | null;
      intent?: IntentType | null;
      planSummary?: string | null;
      stepCount?: number | null;
      outcome?: OutcomeType | null;
      errorMessage?: string | null;
    } = {}
  ): AuditEntry {
    return {
      entryId: generateUUID(),
      timestamp: new Date().toISOString(),
      sessionId: this.sessionId,
      userId: this.userId,
      caseId: options.caseId ?? null,
      eventType,
      intent: options.intent ?? null,
      planSummary: options.planSummary ?? null,
      stepCount: options.stepCount ?? null,
      outcome: options.outcome ?? null,
      errorMessage: options.errorMessage ?? null,
    };
  }

  /**
   * Log an entry
   */
  private log(entry: AuditEntry): void {
    // Add to local entries (FIFO eviction)
    this.entries.push(entry);
    if (this.entries.length > this.maxEntries) {
      this.entries.shift();
    }

    // Write to chrome.storage.session
    this.writeToStorage(entry);

    // Write to backend if configured
    this.writeToBackend(entry);
  }

  /**
   * Write to chrome.storage.session
   */
  private async writeToStorage(entry: AuditEntry): Promise<void> {
    try {
      const key = `audit:${this.sessionId}`;
      const result = await chrome.storage.session.get(key);
      const entries: AuditEntry[] = result[key] ?? [];

      entries.push(entry);

      // Keep max entries
      while (entries.length > this.maxEntries) {
        entries.shift();
      }

      await chrome.storage.session.set({ [key]: entries });
    } catch {
      // Storage write failure - don't block
      console.warn('Pega Agent: Failed to write audit to storage');
    }
  }

  /**
   * Write to backend endpoint
   */
  private async writeToBackend(entry: AuditEntry): Promise<void> {
    if (!this.backendEndpoint) return;

    try {
      // Get auth token if available
      const authToken = await this.getAuthToken();

      await fetch(this.backendEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        },
        body: JSON.stringify(entry),
      });
    } catch {
      // Backend write failure - console error only, never block user action
      console.warn('Pega Agent: Failed to write audit to backend');
    }
  }

  /**
   * Get auth token for backend requests
   */
  private async getAuthToken(): Promise<string | null> {
    // Could be implemented to get token from chrome.storage
    return null;
  }

  // =========================================================================
  // CONVENIENCE LOGGING METHODS
  // =========================================================================

  /**
   * Log Pega detection
   */
  logPegaDetected(caseId: string | null, confidence: number): void {
    const entry = this.createEntry('PEGA_DETECTED', {
      caseId,
      planSummary: `Pega detected with ${Math.round(confidence * 100)}% confidence`,
      outcome: 'success',
    });
    this.log(entry);
  }

  /**
   * Log case opened
   */
  logCaseOpened(caseId: string, caseType: string | null): void {
    const entry = this.createEntry('CASE_OPENED', {
      caseId,
      planSummary: caseType ? `Opened ${caseType} case` : 'Opened case',
      outcome: 'success',
    });
    this.log(entry);
  }

  /**
   * Log summary generation
   */
  logSummaryGeneration(caseId: string | null, success: boolean): void {
    const entry = this.createEntry('SUMMARY_GENERATED', {
      caseId,
      outcome: success ? 'success' : 'failed',
      planSummary: success ? 'Summary generated' : 'Summary generation failed',
    });
    this.log(entry);
  }

  /**
   * Log command received
   */
  logCommandReceived(command: string, caseId: string | null): void {
    const truncated = command.length > 50 ? `${command.substring(0, 50)}...` : command;
    const entry = this.createEntry('COMMAND_RECEIVED', {
      caseId,
      planSummary: `Command: "${truncated}"`,
    });
    this.log(entry);
  }

  /**
   * Log intent classification
   */
  logIntentClassification(
    _command: string,
    intent: IntentType | string,
    confidence: number
  ): void {
    const entry = this.createEntry('INTENT_CLASSIFIED', {
      intent: intent as IntentType,
      planSummary: `Classified as ${intent} (${Math.round(confidence * 100)}% confidence)`,
    });
    this.log(entry);
  }

  /**
   * Log plan generated
   */
  logPlanGenerated(plan: ActionPlan, caseId: string | null): void {
    const entry = this.createEntry('PLAN_GENERATED', {
      caseId,
      intent: plan.intent,
      stepCount: plan.steps.length,
      planSummary: plan.summary,
    });
    this.log(entry);
  }

  /**
   * Log plan confirmed by user
   */
  logPlanConfirmed(plan: ActionPlan, caseId: string | null): void {
    const entry = this.createEntry('PLAN_CONFIRMED', {
      caseId,
      intent: plan.intent,
      stepCount: plan.steps.length,
      planSummary: plan.summary,
    });
    this.log(entry);
  }

  /**
   * Log plan cancelled by user
   */
  logPlanCancellation(plan: ActionPlan | null): void {
    const entry = this.createEntry('PLAN_CANCELLED', {
      intent: plan?.intent ?? null,
      stepCount: plan?.steps.length ?? null,
      planSummary: plan?.summary ?? 'Plan cancelled',
      outcome: 'cancelled',
    });
    this.log(entry);
  }

  /**
   * Log plan execution
   */
  logPlanExecution(
    plan: ActionPlan,
    outcome: OutcomeType,
    caseId: string | null,
    errorMessage?: string
  ): void {
    const entry = this.createEntry('PLAN_EXECUTED', {
      caseId,
      intent: plan?.intent ?? 'UNKNOWN',
      stepCount: plan?.steps?.length ?? 0,
      planSummary: plan?.summary ?? 'No summary',
      outcome,
      errorMessage,
    });
    this.log(entry);
  }

  /**
   * Log action step result
   */
  logActionStep(
    stepNumber: number,
    action: string,
    success: boolean,
    errorMessage?: string
  ): void {
    const entry = this.createEntry(success ? 'PLAN_EXECUTED' : 'PLAN_STEP_FAILED', {
      stepCount: stepNumber,
      planSummary: `Step ${stepNumber}: ${action}`,
      outcome: success ? 'success' : 'failed',
      errorMessage,
    });
    this.log(entry);
  }

  /**
   * Log feedback received
   */
  logFeedback(type: 'positive' | 'negative' | 'neutral', context?: string): void {
    const entry = this.createEntry('FEEDBACK_RECEIVED', {
      planSummary: `Feedback: ${type}${context ? ` - ${context}` : ''}`,
    });
    this.log(entry);
  }

  // =========================================================================
  // UTILITY METHODS
  // =========================================================================

  /**
   * Get all entries for current session
   */
  getEntries(): AuditEntry[] {
    return [...this.entries];
  }

  /**
   * Get entries from storage
   */
  async getEntriesFromStorage(): Promise<AuditEntry[]> {
    try {
      const key = `audit:${this.sessionId}`;
      const result = await chrome.storage.session.get(key);
      return result[key] ?? [];
    } catch {
      return [];
    }
  }

  /**
   * Clear all entries
   */
  clearEntries(): void {
    this.entries = [];
  }
}

// Export singleton instance
export const auditLogger = new AuditLogger();

// Also export class for testing
export { AuditLogger };
