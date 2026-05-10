/**
 * Session Store - Chrome Storage Session Manager
 *
 * Manages session state using chrome.storage.session (MV3).
 * No sensitive data stored - use memory for tokens.
 */

/**
 * Session Store class
 */
class SessionStore {
  constructor() {
    this.sessionKey = 'pega-agent-session';
    this.configKey = 'pega-agent-config';
    this.cache = new Map();
    this.isInitialized = false;
  }

  /**
   * Initialize session store
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    // Load existing session data
    try {
      const data = await this.getSession();
      if (data) {
        this.cache.set('session', data);
      }
    } catch (error) {
      console.error('SessionStore: Initialize error', error);
    }

    this.isInitialized = true;
  }

  /**
   * Get session data
   * @returns {Promise<Object|null>}
   */
  async getSession() {
    try {
      const result = await chrome.storage.session.get(this.sessionKey);
      return result[this.sessionKey] || null;
    } catch (error) {
      console.error('SessionStore: Get session error', error);
      return this.cache.get('session') || null;
    }
  }

  /**
   * Set session data
   * @param {Object} data - Session data
   */
  async setSession(data) {
    try {
      await chrome.storage.session.set({
        [this.sessionKey]: {
          ...data,
          updatedAt: Date.now(),
        },
      });
      this.cache.set('session', data);
    } catch (error) {
      console.error('SessionStore: Set session error', error);
      this.cache.set('session', data);
    }
  }

  /**
   * Update session data (merge)
   * @param {Object} updates - Fields to update
   */
  async updateSession(updates) {
    const current = await this.getSession();
    await this.setSession({
      ...current,
      ...updates,
    });
  }

  /**
   * Clear session data
   */
  async clearSession() {
    try {
      await chrome.storage.session.remove(this.sessionKey);
      this.cache.delete('session');
    } catch (error) {
      console.error('SessionStore: Clear session error', error);
      this.cache.delete('session');
    }
  }

  /**
   * Get current case context
   * @returns {Promise<Object|null>}
   */
  async getCaseContext() {
    const session = await this.getSession();
    return session?.caseContext || null;
  }

  /**
   * Set current case context
   * @param {Object} context - Case context
   */
  async setCaseContext(context) {
    await this.updateSession({ caseContext: context });
  }

  /**
   * Get current DOM snapshot
   * @returns {Promise<Object|null>}
   */
  async getDomSnapshot() {
    const session = await this.getSession();
    return session?.domSnapshot || null;
  }

  /**
   * Set current DOM snapshot
   * @param {Object} snapshot - DOM snapshot
   */
  async setDomSnapshot(snapshot) {
    await this.updateSession({ domSnapshot: snapshot });
  }

  /**
   * Get current pending plan
   * @returns {Promise<Object|null>}
   */
  async getPendingPlan() {
    const session = await this.getSession();
    return session?.pendingPlan || null;
  }

  /**
   * Set pending plan
   * @param {Object} plan - Action plan
   */
  async setPendingPlan(plan) {
    await this.updateSession({ pendingPlan: plan });
  }

  /**
   * Clear pending plan
   */
  async clearPendingPlan() {
    await this.updateSession({ pendingPlan: null });
  }

  /**
   * Get current summary
   * @returns {Promise<Object|null>}
   */
  async getSummary() {
    const session = await this.getSession();
    return session?.summary || null;
  }

  /**
   * Set current summary
   * @param {Object} summary - Case summary
   */
  async setSummary(summary) {
    await this.updateSession({ summary });
  }

  /**
   * Get conversation history
   * @returns {Promise<Array>}
   */
  async getConversationHistory() {
    const session = await this.getSession();
    return session?.conversationHistory || [];
  }

  /**
   * Add to conversation history
   * @param {Object} message - Message to add
   */
  async addToConversationHistory(message) {
    const history = await this.getConversationHistory();
    history.push({
      ...message,
      timestamp: Date.now(),
    });

    // Keep last 50 messages
    const trimmed = history.slice(-50);
    await this.updateSession({ conversationHistory: trimmed });
  }

  /**
   * Clear conversation history
   */
  async clearConversationHistory() {
    await this.updateSession({ conversationHistory: [] });
  }

  /**
   * Get configuration
   * @returns {Promise<Object>}
   */
  async getConfig() {
    try {
      const result = await chrome.storage.session.get(this.configKey);
      return result[this.configKey] || this.getDefaultConfig();
    } catch (error) {
      console.error('SessionStore: Get config error', error);
      return this.getDefaultConfig();
    }
  }

  /**
   * Set configuration
   * @param {Object} config - Configuration
   */
  async setConfig(config) {
    try {
      await chrome.storage.session.set({
        [this.configKey]: config,
      });
      this.cache.set('config', config);
    } catch (error) {
      console.error('SessionStore: Set config error', error);
      this.cache.set('config', config);
    }
  }

  /**
   * Get default configuration
   * @returns {Object}
   */
  getDefaultConfig() {
    return {
      security: {
        piiMaskingEnabled: true,
        piiCategoriesToMask: ['NAME', 'SSN', 'DOB', 'EMAIL', 'PHONE', 'ACCOUNT', 'ADDRESS'],
        localProcessingOnly: false,
        allowedLLMProviders: ['anthropic', 'mistral'],
        auditLoggingEnabled: true,
        requireConfirmationForAllActions: false,
        disabledCapabilities: [],
      },
      llm: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-20250514',
        maxTokens: 1500,
        temperature: 0.1,
      },
      pega: {
        targetDomains: [],
        useDirectAPI: false,
        cdh: { enabled: false },
      },
      roleRestrictions: {
        caseWorker: ['SUMMARIZE_CASE', 'UPDATE_FIELD', 'NEXT_STEP', 'SAVE_CASE', 'SHOW_QUEUE'],
        supervisor: ['*'],
        readOnly: ['SUMMARIZE_CASE', 'SHOW_QUEUE', 'EXPLAIN'],
      },
    };
  }

  /**
   * Get Pega detection state
   * @returns {Promise<Object|null>}
   */
  async getPegaState() {
    const session = await this.getSession();
    return session?.pegaState || null;
  }

  /**
   * Set Pega detection state
   * @param {Object} state - Detection state
   */
  async setPegaState(state) {
    await this.updateSession({ pegaState: state });
  }

  /**
   * Get user role
   * @returns {Promise<string>}
   */
  async getUserRole() {
    const session = await this.getSession();
    return session?.userRole || 'caseWorker';
  }

  /**
   * Set user role
   * @param {string} role - User role
   */
  async setUserRole(role) {
    await this.updateSession({ userRole: role });
  }

  /**
   * Export session data for debugging
   * @returns {Promise<Object>}
   */
  async export() {
    const session = await this.getSession();
    const config = await this.getConfig();

    return {
      session,
      config,
      cacheSize: this.cache.size,
      isInitialized: this.isInitialized,
    };
  }
}

// Export singleton instance
export const sessionStore = new SessionStore();

// Also export class for testing
export { SessionStore };

export default sessionStore;
