/**
 * Session Store - Chrome Storage Session Manager
 *
 * All session state in chrome.storage.session. Cleared automatically on browser close.
 * No raw PII ever written. All snapshots contain only masked tokens.
 */

import type {
  SessionContext,
  DOMSnapshot,
  ActionPlan,
  CaseSummary,
} from '../shared/types';
import { generateUUID } from '../shared/message-types';

// ============================================================================
// STORAGE KEYS
// ============================================================================

const getStorageKey = (tabId: number, suffix: string): string => {
  return `session:${tabId}:${suffix}`;
};

// ============================================================================
// SESSION STORE CLASS
// ============================================================================

class SessionStore {
  /**
   * Initialize session store
   */
  async initialize(): Promise<void> {
    // Session store ready
  }

  // =========================================================================
  // SESSION CONTEXT
  // =========================================================================

  /**
   * Initialize a new session for a tab
   */
  async initSession(tabId: number, detection: {
    isPega: boolean;
    confidence: number;
    framework: string;
    version: string;
    appName?: string;
  }): Promise<SessionContext> {
    const pegaDetection: SessionContext['pegaDetection'] = {
      isPega: detection.isPega,
      confidence: detection.confidence,
      uiFramework: detection.framework as 'constellation' | 'classic' | 'cosmos' | 'unknown',
      version: detection.version,
      appName: detection.appName,
    };

    const context: SessionContext = {
      sessionId: generateUUID(),
      tabId,
      userId: null,
      userRole: null,
      pegaDetection,
      currentSnapshot: null,
      navigationHistory: [],
      initiatedAt: Date.now(),
    };

    await this.setContext(tabId, context);
    return context;
  }

  /**
   * Get session context
   */
  async getContext(tabId: number): Promise<SessionContext | null> {
    try {
      const key = getStorageKey(tabId, 'context');
      const result = await chrome.storage.session.get(key);
      return result[key] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Set session context
   */
  async setContext(tabId: number, context: SessionContext): Promise<void> {
    const key = getStorageKey(tabId, 'context');
    await chrome.storage.session.set({ [key]: context });
  }

  // =========================================================================
  // DOM SNAPSHOT
  // =========================================================================

  /**
   * Update current DOM snapshot
   */
  async updateSnapshot(tabId: number, snapshot: DOMSnapshot): Promise<void> {
    const key = getStorageKey(tabId, 'snapshot');
    await chrome.storage.session.set({ [key]: snapshot });

    // Also update context's currentSnapshot
    const context = await this.getContext(tabId);
    if (context) {
      context.currentSnapshot = snapshot;
      await this.setContext(tabId, context);
    }
  }

  /**
   * Get current DOM snapshot
   */
  async getSnapshot(tabId: number): Promise<DOMSnapshot | null> {
    try {
      const key = getStorageKey(tabId, 'snapshot');
      const result = await chrome.storage.session.get(key);
      return result[key] ?? null;
    } catch {
      return null;
    }
  }

  // =========================================================================
  // PENDING PLAN
  // =========================================================================

  /**
   * Set pending plan (awaiting user confirmation)
   */
  async setPendingPlan(tabId: number, plan: ActionPlan): Promise<void> {
    const key = getStorageKey(tabId, 'pendingPlan');
    await chrome.storage.session.set({ [key]: plan });
  }

  /**
   * Get pending plan and clear it
   */
  async getPendingPlan(tabId: number): Promise<ActionPlan | null> {
    try {
      const key = getStorageKey(tabId, 'pendingPlan');
      const result = await chrome.storage.session.get(key);
      const plan = result[key] ?? null;

      // Clear after retrieval
      if (plan) {
        await chrome.storage.session.remove(key);
      }

      return plan;
    } catch {
      return null;
    }
  }

  /**
   * Clear pending plan
   */
  async clearPendingPlan(tabId: number): Promise<void> {
    const key = getStorageKey(tabId, 'pendingPlan');
    await chrome.storage.session.remove(key);
  }

  // =========================================================================
  // SUMMARY CACHE
  // =========================================================================

  /**
   * Cache a summary
   */
  async cacheSummary(
    tabId: number,
    caseId: string,
    snapshotHash: string,
    summary: CaseSummary
  ): Promise<void> {
    const key = getStorageKey(tabId, 'summaryCache');
    const result = await chrome.storage.session.get(key);
    const cache: Record<string, CaseSummary> = result[key] ?? {};

    cache[`${caseId}:${snapshotHash}`] = summary;
    await chrome.storage.session.set({ [key]: cache });
  }

  /**
   * Get cached summary
   */
  async getCachedSummary(
    tabId: number,
    caseId: string,
    snapshotHash: string
  ): Promise<CaseSummary | null> {
    try {
      const key = getStorageKey(tabId, 'summaryCache');
      const result = await chrome.storage.session.get(key);
      const cache: Record<string, CaseSummary> = result[key] ?? {};

      return cache[`${caseId}:${snapshotHash}`] ?? null;
    } catch {
      return null;
    }
  }

  /**
   * Invalidate summary cache for a case
   */
  async invalidateSummaryCache(tabId: number, caseId: string): Promise<void> {
    const key = getStorageKey(tabId, 'summaryCache');
    const result = await chrome.storage.session.get(key);
    const cache: Record<string, CaseSummary> = result[key] ?? {};

    // Remove all entries for this case
    for (const cacheKey of Object.keys(cache)) {
      if (cacheKey.startsWith(`${caseId}:`)) {
        delete cache[cacheKey];
      }
    }

    await chrome.storage.session.set({ [key]: cache });
  }

  // =========================================================================
  // USER/ROLE
  // =========================================================================

  /**
   * Set user role
   */
  async setUserRole(tabId: number, role: string): Promise<void> {
    const context = await this.getContext(tabId);
    if (context) {
      context.userRole = role;
      await this.setContext(tabId, context);
    }
  }

  /**
   * Get user role
   */
  async getUserRole(tabId: number): Promise<string | null> {
    const context = await this.getContext(tabId);
    return context?.userRole ?? null;
  }

  // =========================================================================
  // CLEANUP
  // =========================================================================

  /**
   * Clear all session data for a tab
   */
  async clearSession(tabId: number): Promise<void> {
    const keys = [
      getStorageKey(tabId, 'context'),
      getStorageKey(tabId, 'snapshot'),
      getStorageKey(tabId, 'pendingPlan'),
      getStorageKey(tabId, 'summaryCache'),
    ];

    await chrome.storage.session.remove(keys);
  }

  /**
   * Generate a simple hash for snapshot comparison
   */
  generateSnapshotHash(snapshot: DOMSnapshot): string {
    // Simple hash based on key fields
    const hashInput = [
      snapshot.caseContext.caseId,
      snapshot.caseContext.status,
      snapshot.fields.length,
      snapshot.actions.length,
      snapshot.timestamp,
    ].join('|');

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < hashInput.length; i++) {
      const char = hashInput.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }

    return Math.abs(hash).toString(16);
  }
}

// Export singleton instance
export const sessionStore = new SessionStore();

// Also export class for testing
export { SessionStore };
