/**
 * Case State Manager - Track Case State Across Navigation
 *
 * Provides persistent case state tracking:
 * - State management across page navigation
 * - Change detection and history
 * - SLA monitoring
 * - Field change tracking
 */

import type {
  CaseState,
  CaseStateChange,
  DOMSnapshot,
} from '../shared/types';

// ============================================================================
// CASE STATE STORAGE
// ============================================================================

// In-memory store for active cases by tab ID
const caseStates = new Map<number, CaseState>();

// Tab to case ID mapping
const tabCaseMap = new Map<number, string>();

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/**
 * Initialize or update case state from snapshot
 */
export function updateCaseState(tabId: number, snapshot: DOMSnapshot): CaseState | null {
  const caseId = snapshot.caseContext.caseId;
  
  if (!caseId) {
    // No case ID - clear any existing state
    caseStates.delete(tabId);
    tabCaseMap.delete(tabId);
    return null;
  }

  const previousState = caseStates.get(tabId);
  const now = Date.now();

  // Build field map
  const fields: Record<string, { value: string; lastModified: number }> = {};
  for (const field of snapshot.fields) {
    if (field.label && field.value) {
      const fieldName = field.label.toLowerCase().replace(/\s+/g, '_');
      fields[fieldName] = {
        value: field.value,
        lastModified: previousState?.fields[fieldName]?.lastModified ?? now,
      };
    }
  }

  // Detect changes from previous state
  const history: CaseStateChange[] = previousState?.history ?? [];

  if (previousState) {
    // Check for stage change
    if (previousState.stage !== snapshot.caseContext.stageName) {
      history.push({
        timestamp: now,
        changeType: 'stage_change',
        description: `Stage changed from "${previousState.stage}" to "${snapshot.caseContext.stageName}"`,
        previousValue: previousState.stage,
        newValue: snapshot.caseContext.stageName ?? undefined,
      });
    }

    // Check for status change
    if (previousState.status !== snapshot.caseContext.status) {
      history.push({
        timestamp: now,
        changeType: 'status_change',
        description: `Status changed from "${previousState.status}" to "${snapshot.caseContext.status}"`,
        previousValue: previousState.status,
        newValue: snapshot.caseContext.status ?? undefined,
      });
    }

    // Check for field changes
    for (const [fieldName, fieldData] of Object.entries(fields)) {
      const previousField = previousState.fields[fieldName];
      if (previousField && previousField.value !== fieldData.value) {
        fieldData.lastModified = now;
        history.push({
          timestamp: now,
          changeType: 'field_update',
          description: `Field "${fieldName}" changed`,
          previousValue: previousField.value,
          newValue: fieldData.value,
        });
      }
    }
  }

  // Build new state
  const newState: CaseState = {
    caseId,
    caseType: snapshot.caseContext.caseType ?? 'Unknown',
    status: snapshot.caseContext.status ?? 'Unknown',
    stage: snapshot.caseContext.stageName ?? 'Unknown',
    lastUpdated: now,
    fields,
    history,
    pendingActions: extractPendingActions(snapshot),
  };

  // Try to parse SLA info if available
  if (snapshot.caseContext.slaDeadline) {
    newState.slaStatus = parseSLAInfo(snapshot.caseContext.slaDeadline);
  }

  caseStates.set(tabId, newState);
  tabCaseMap.set(tabId, caseId);

  console.log('[CaseState] Updated state for case:', caseId, {
    status: newState.status,
    stage: newState.stage,
    fieldCount: Object.keys(fields).length,
    historyCount: history.length,
  });

  return newState;
}

/**
 * Get case state for a tab
 */
export function getCaseState(tabId: number): CaseState | null {
  return caseStates.get(tabId) ?? null;
}

/**
 * Get case state by case ID
 */
export function getCaseStateById(caseId: string): CaseState | null {
  for (const state of caseStates.values()) {
    if (state.caseId === caseId) {
      return state;
    }
  }
  return null;
}

/**
 * Clear case state for a tab
 */
export function clearCaseState(tabId: number): void {
  caseStates.delete(tabId);
  tabCaseMap.delete(tabId);
}

// ============================================================================
// CHANGE DETECTION
// ============================================================================

/**
 * Get recent changes for a case
 */
export function getRecentChanges(tabId: number, sinceTimestamp?: number): CaseStateChange[] {
  const state = caseStates.get(tabId);
  if (!state) return [];

  const cutoff = sinceTimestamp ?? Date.now() - 3600000; // Default: last hour
  return state.history.filter(change => change.timestamp >= cutoff);
}

/**
 * Get field change history
 */
export function getFieldHistory(tabId: number, fieldName: string): CaseStateChange[] {
  const state = caseStates.get(tabId);
  if (!state) return [];

  const normalizedName = fieldName.toLowerCase().replace(/\s+/g, '_');
  return state.history.filter(
    change => change.changeType === 'field_update' &&
    change.description.toLowerCase().includes(normalizedName)
  );
}

/**
 * Check if a field has changed recently
 */
export function hasFieldChangedRecently(tabId: number, fieldName: string, withinMs: number = 60000): boolean {
  const state = caseStates.get(tabId);
  if (!state) return false;

  const normalizedName = fieldName.toLowerCase().replace(/\s+/g, '_');
  const cutoff = Date.now() - withinMs;

  return state.history.some(
    change => change.changeType === 'field_update' &&
    change.description.toLowerCase().includes(normalizedName) &&
    change.timestamp >= cutoff
  );
}

// ============================================================================
// SLA MONITORING
// ============================================================================

/**
 * Parse SLA information from deadline string
 */
function parseSLAInfo(slaDeadline: string): CaseState['slaStatus'] {
  try {
    // Try to parse as ISO date or relative time
    const deadline = new Date(slaDeadline);
    if (isNaN(deadline.getTime())) {
      // Not a valid date - might be relative like "2 hours"
      return {
        goal: slaDeadline,
        deadline: slaDeadline,
        isBreached: false,
      };
    }

    const now = Date.now();
    const deadlineMs = deadline.getTime();
    const timeRemaining = deadlineMs - now;

    return {
      goal: slaDeadline,
      deadline: slaDeadline,
      isBreached: timeRemaining < 0,
      timeRemaining: Math.max(0, timeRemaining),
    };
  } catch {
    return {
      goal: slaDeadline,
      deadline: slaDeadline,
      isBreached: false,
    };
  }
}

/**
 * Check SLA status
 */
export function checkSLAStatus(tabId: number): {
  isBreached: boolean;
  isAtRisk: boolean;
  timeRemaining?: number;
} | null {
  const state = caseStates.get(tabId);
  if (!state?.slaStatus) return null;

  const { isBreached, timeRemaining } = state.slaStatus;

  return {
    isBreached: isBreached ?? false,
    isAtRisk: !isBreached && (timeRemaining ?? Infinity) < 3600000, // Less than 1 hour
    timeRemaining,
  };
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extract pending actions from snapshot
 */
function extractPendingActions(snapshot: DOMSnapshot): string[] {
  const actions: string[] = [];

  for (const action of snapshot.actions) {
    if (!action.isDisabled) {
      actions.push(action.label);
    }
  }

  return actions;
}

/**
 * Generate a summary of case state changes
 */
export function generateChangeSummary(tabId: number): string {
  const state = caseStates.get(tabId);
  if (!state) return 'No case state available';

  const recentChanges = getRecentChanges(tabId, Date.now() - 3600000);
  if (recentChanges.length === 0) {
    return 'No recent changes';
  }

  const summary: string[] = [];
  
  // Group changes by type
  const stageChanges = recentChanges.filter(c => c.changeType === 'stage_change');
  const statusChanges = recentChanges.filter(c => c.changeType === 'status_change');
  const fieldChanges = recentChanges.filter(c => c.changeType === 'field_update');

  if (stageChanges.length > 0) {
    const latest = stageChanges[stageChanges.length - 1];
    if (latest) {
      summary.push(`Stage: ${latest.previousValue ?? ''} → ${latest.newValue ?? ''}`);
    }
  }

  if (statusChanges.length > 0) {
    const latest = statusChanges[statusChanges.length - 1];
    if (latest) {
      summary.push(`Status: ${latest.previousValue ?? ''} → ${latest.newValue ?? ''}`);
    }
  }

  if (fieldChanges.length > 0) {
    summary.push(`${fieldChanges.length} field updates`);
  }

  return summary.join(', ');
}

// ============================================================================
// EXPORT
// ============================================================================

export const caseStateManager = {
  update: updateCaseState,
  get: getCaseState,
  getById: getCaseStateById,
  clear: clearCaseState,
  getRecentChanges,
  getFieldHistory,
  hasFieldChangedRecently,
  checkSLAStatus,
  generateChangeSummary,
};

console.log('[CaseState] Manager module loaded');
