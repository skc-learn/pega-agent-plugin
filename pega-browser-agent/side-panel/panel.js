/**
 * Side Panel - Co-Pilot Panel UI Logic
 *
 * Handles:
 * - Service worker messaging
 * - Summary display
 * - Action plan confirmation
 * - Activity log
 * - User command input
 */

import { MessageType } from '../shared/message-types.js';

/**
 * Side Panel Controller
 */
class SidePanelController {
  constructor() {
    this.isReady = false;
    this.pegaState = null;
    this.currentSummary = null;
    this.pendingPlan = null;
    this.activityLog = [];
    this.commandHistory = [];
    this.commandHistoryIndex = -1;

    this.init();
  }

  /**
   * Initialize panel
   */
  async init() {
    // Get DOM elements
    this.mainEl = document.getElementById('main');
    this.loadingEl = document.getElementById('loading');
    this.commandInput = document.getElementById('commandInput');
    this.sendBtn = document.getElementById('sendBtn');
    this.settingsBtn = document.getElementById('settingsBtn');

    // Setup event listeners
    this.setupEventListeners();

    // Setup message listener
    this.setupMessageListener();

    // Notify service worker that panel is ready
    await this.notifyReady();

    this.isReady = true;
  }

  /**
   * Setup event listeners
   */
  setupEventListeners() {
    // Send button
    this.sendBtn.addEventListener('click', () => this.handleSendCommand());

    // Command input
    this.commandInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.handleSendCommand();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.navigateHistory(-1);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.navigateHistory(1);
      }
    });

    // Auto-resize textarea
    this.commandInput.addEventListener('input', () => {
      this.commandInput.style.height = 'auto';
      this.commandInput.style.height = Math.min(this.commandInput.scrollHeight, 120) + 'px';
    });

    // Settings button
    this.settingsBtn.addEventListener('click', () => {
      this.showSettings();
    });

    // Example links
    document.querySelectorAll('.example-link').forEach((link) => {
      link.addEventListener('click', () => {
        const command = link.dataset.command;
        this.commandInput.value = command;
        this.commandInput.focus();
      });
    });
  }

  /**
   * Setup message listener
   */
  setupMessageListener() {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
      this.handleMessage(message);
      sendResponse({ received: true });
    });
  }

  /**
   * Notify service worker that panel is ready
   */
  async notifyReady() {
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.PANEL_READY,
        payload: {},
      });

      if (response?.success && response.result) {
        this.pegaState = response.result.pegaState;
        this.currentSummary = response.result.summary;
        this.pendingPlan = response.result.pendingPlan;

        this.render();
      }
    } catch (error) {
      console.error('Panel: Failed to notify ready', error);
      this.showNotDetected();
    }
  }

  /**
   * Handle incoming message
   * @param {Object} message
   */
  handleMessage(message) {
    const { type, payload } = message;

    switch (type) {
      case MessageType.SHOW_SUMMARY:
        this.currentSummary = payload;
        this.renderSummary();
        break;

      case MessageType.SHOW_PLAN:
        this.pendingPlan = payload;
        this.renderPendingPlan();
        break;

      case MessageType.SHOW_RESULT:
        this.showResult(payload);
        break;

      case MessageType.SHOW_ERROR:
        this.showError(payload);
        break;

      case MessageType.UPDATE_ACTIVITY:
        this.addActivity(payload);
        break;

      case MessageType.CLEAR_PENDING:
        this.pendingPlan = null;
        this.render();
        break;

      case MessageType.SHOW_RECOMMENDATION:
        this.showRecommendation(payload);
        break;
    }
  }

  /**
   * Render main panel content
   */
  render() {
    this.loadingEl.style.display = 'none';

    if (!this.pegaState?.isDetected) {
      this.showNotDetected();
      return;
    }

    let html = '';

    // Summary card
    if (this.currentSummary) {
      html += this.renderSummaryCard();
    }

    // Pending plan card
    if (this.pendingPlan) {
      html += this.renderPlanCard();
    }

    // Activity log
    html += this.renderActivityCard();

    this.mainEl.innerHTML = html;

    // Attach event listeners to rendered content
    this.attachCardListeners();
  }

  /**
   * Show not detected state
   */
  showNotDetected() {
    this.loadingEl.style.display = 'none';
    this.mainEl.innerHTML = `
      <div class="not-detected">
        <div class="not-detected-icon">🔍</div>
        <h3>No Pega Application Detected</h3>
        <p style="margin-top: 8px; color: var(--text-secondary);">
          Navigate to a Pega Infinity application to use the Co-Pilot.
        </p>
      </div>
    `;
  }

  /**
   * Render summary card
   */
  renderSummaryCard() {
    const summary = this.currentSummary;

    return `
      <div class="card" id="summaryCard">
        <div class="card-header" data-toggle="summaryContent">
          <span class="card-header-icon">📋</span>
          <span>Case Summary</span>
          <span class="card-header-chevron">▼</span>
        </div>
        <div class="card-content" id="summaryContent">
          ${this.renderSummarySections(summary)}
          <div class="feedback" id="feedbackSection">
            <span style="color: var(--text-secondary); font-size: 12px;">Was this helpful?</span>
            <button class="feedback-btn" data-feedback="positive" title="Thumbs up">👍</button>
            <button class="feedback-btn" data-feedback="negative" title="Thumbs down">👎</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render summary sections
   */
  renderSummarySections(summary) {
    const sections = [];

    if (summary.situation) {
      sections.push(`
        <div class="summary-section">
          <div class="summary-label">Situation</div>
          <div class="summary-text">${this.escapeHtml(summary.situation)}</div>
        </div>
      `);
    }

    if (summary.history) {
      sections.push(`
        <div class="summary-section">
          <div class="summary-label">History</div>
          <div class="summary-text">${this.escapeHtml(summary.history)}</div>
        </div>
      `);
    }

    if (summary.currentState) {
      sections.push(`
        <div class="summary-section">
          <div class="summary-label">Current State</div>
          <div class="summary-text">${this.escapeHtml(summary.currentState)}</div>
        </div>
      `);
    }

    if (summary.riskSignal) {
      const isCritical = summary.riskSignal.toLowerCase().includes('sla') &&
        (summary.riskSignal.toLowerCase().includes('breach') ||
         summary.riskSignal.toLowerCase().includes('critical'));
      sections.push(`
        <div class="summary-section">
          <div class="summary-label">⚠️ Risk Signal</div>
          <div class="summary-text risk-signal ${isCritical ? 'critical' : ''}">
            ${this.escapeHtml(summary.riskSignal)}
          </div>
        </div>
      `);
    }

    if (summary.placeholder) {
      return `
        <div class="summary-section">
          <div class="summary-text" style="color: var(--text-secondary);">
            ${this.escapeHtml(summary.message)}
          </div>
        </div>
      `;
    }

    return sections.join('');
  }

  /**
   * Render pending plan card
   */
  renderPlanCard() {
    const plan = this.pendingPlan;

    return `
      <div class="card action-plan" id="planCard">
        <div class="card-header">
          <span class="card-header-icon">⚡</span>
          <span>Pending Action</span>
        </div>
        <div class="card-content">
          <p style="margin-bottom: 12px;">${this.escapeHtml(plan.summary || plan.expectedOutcome)}</p>
          ${plan.steps?.length ? `
            <ul class="action-plan-steps">
              ${plan.steps.map((step) => `
                <li class="action-plan-step">
                  <span class="step-number">${step.stepNumber}</span>
                  <span class="step-text">${this.escapeHtml(step.description)}</span>
                </li>
              `).join('')}
            </ul>
          ` : ''}
          <div class="action-buttons">
            <button class="btn btn-primary" id="confirmBtn">✓ Confirm</button>
            <button class="btn btn-secondary" id="cancelBtn">✗ Cancel</button>
          </div>
        </div>
      </div>
    `;
  }

  /**
   * Render activity log card
   */
  renderActivityCard() {
    return `
      <div class="card" id="activityCard">
        <div class="card-header" data-toggle="activityContent">
          <span class="card-header-icon">📜</span>
          <span>Activity Log</span>
          <span class="card-header-chevron">▼</span>
        </div>
        <div class="card-content" id="activityContent">
          <ul class="activity-log" id="activityLog">
            ${this.renderActivityItems()}
          </ul>
        </div>
      </div>
    `;
  }

  /**
   * Render activity items
   */
  renderActivityItems() {
    if (this.activityLog.length === 0) {
      return '<li class="activity-item" style="color: var(--text-secondary);">No activity yet</li>';
    }

    return this.activityLog
      .slice(-10)
      .reverse()
      .map((item) => `
        <li class="activity-item">
          <span class="activity-icon ${item.type}">${this.getActivityIcon(item.type)}</span>
          <span>${this.escapeHtml(item.message)}</span>
          <span class="activity-time">${this.formatTime(item.timestamp)}</span>
        </li>
      `)
      .join('');
  }

  /**
   * Attach event listeners to rendered cards
   */
  attachCardListeners() {
    // Card header toggles
    document.querySelectorAll('.card-header[data-toggle]').forEach((header) => {
      header.addEventListener('click', () => {
        const targetId = header.dataset.toggle;
        const target = document.getElementById(targetId);
        if (target) {
          target.classList.toggle('collapsed');
          header.classList.toggle('collapsed');
        }
      });
    });

    // Feedback buttons
    document.querySelectorAll('.feedback-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const feedback = btn.dataset.feedback;
        this.submitFeedback(feedback);

        // Update UI
        document.querySelectorAll('.feedback-btn').forEach((b) => b.classList.remove('selected'));
        btn.classList.add('selected');
      });
    });

    // Confirm button
    const confirmBtn = document.getElementById('confirmBtn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', () => this.confirmPlan());
    }

    // Cancel button
    const cancelBtn = document.getElementById('cancelBtn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => this.cancelPlan());
    }
  }

  /**
   * Handle send command
   */
  async handleSendCommand() {
    const command = this.commandInput.value.trim();

    if (!command) {
      return;
    }

    // Add to history
    this.commandHistory.push(command);
    this.commandHistoryIndex = this.commandHistory.length;

    // Clear input
    this.commandInput.value = '';
    this.commandInput.style.height = 'auto';

    // Add to activity log
    this.addActivity({
      type: 'info',
      message: `Command: "${command}"`,
      timestamp: Date.now(),
    });

    // Send to service worker
    try {
      const response = await chrome.runtime.sendMessage({
        type: MessageType.USER_COMMAND,
        payload: { command },
      });

      if (response?.success) {
        if (response.result?.error) {
          this.showError({ message: response.result.error });
        } else if (response.result?.requiresConfirmation) {
          // Plan will be sent via SHOW_PLAN message
        } else if (response.result?.executing) {
          this.addActivity({
            type: 'info',
            message: 'Executing plan...',
            timestamp: Date.now(),
          });
        }
      } else {
        this.showError({ message: response?.error || 'Failed to process command' });
      }
    } catch (error) {
      this.showError({ message: error.message });
    }
  }

  /**
   * Confirm pending plan
   */
  async confirmPlan() {
    if (!this.pendingPlan) {
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        type: MessageType.USER_CONFIRM,
        payload: {},
      });

      this.addActivity({
        type: 'success',
        message: `Confirmed: ${this.pendingPlan.summary || this.pendingPlan.intent}`,
        timestamp: Date.now(),
      });

      this.pendingPlan = null;
      this.render();
    } catch (error) {
      this.showError({ message: error.message });
    }
  }

  /**
   * Cancel pending plan
   */
  async cancelPlan() {
    try {
      await chrome.runtime.sendMessage({
        type: MessageType.USER_CANCEL,
        payload: {},
      });

      this.addActivity({
        type: 'info',
        message: 'Action cancelled',
        timestamp: Date.now(),
      });

      this.pendingPlan = null;
      this.render();
    } catch (error) {
      this.showError({ message: error.message });
    }
  }

  /**
   * Submit feedback
   */
  async submitFeedback(type) {
    try {
      await chrome.runtime.sendMessage({
        type: MessageType.FEEDBACK,
        payload: {
          type,
          context: 'summary',
        },
      });

      this.addActivity({
        type: 'info',
        message: `Feedback submitted: ${type}`,
        timestamp: Date.now(),
      });
    } catch (error) {
      console.error('Panel: Failed to submit feedback', error);
    }
  }

  /**
   * Add activity to log
   * @param {Object} activity
   */
  addActivity(activity) {
    this.activityLog.push(activity);
    this.renderActivityLog();
  }

  /**
   * Render activity log
   */
  renderActivityLog() {
    const logEl = document.getElementById('activityLog');
    if (logEl) {
      logEl.innerHTML = this.renderActivityItems();
    }
  }

  /**
   * Show error message
   * @param {Object} payload
   */
  showError(payload) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.innerHTML = `
      <strong>Error:</strong> ${this.escapeHtml(payload.message)}
      ${payload.details ? `<br><small>${this.escapeHtml(payload.details)}</small>` : ''}
    `;

    this.mainEl.insertBefore(errorDiv, this.mainEl.firstChild);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }

  /**
   * Show result
   * @param {Object} payload
   */
  showResult(payload) {
    this.addActivity({
      type: payload.success ? 'success' : 'error',
      message: payload.message,
      timestamp: Date.now(),
    });
  }

  /**
   * Show recommendation
   * @param {Object} payload
   */
  showRecommendation(payload) {
    // TODO: Implement recommendation display
    console.log('Panel: Recommendation', payload);
  }

  /**
   * Navigate command history
   * @param {number} direction - -1 for up, 1 for down
   */
  navigateHistory(direction) {
    const newIndex = this.commandHistoryIndex + direction;

    if (newIndex >= 0 && newIndex < this.commandHistory.length) {
      this.commandHistoryIndex = newIndex;
      this.commandInput.value = this.commandHistory[newIndex];
    } else if (newIndex >= this.commandHistory.length) {
      this.commandHistoryIndex = this.commandHistory.length;
      this.commandInput.value = '';
    }
  }

  /**
   * Show settings (placeholder)
   */
  showSettings() {
    // TODO: Implement settings UI
    alert('Settings coming soon!\n\nConfigure API key and preferences.');
  }

  /**
   * Render summary only
   */
  renderSummary() {
    this.render();
  }

  /**
   * Render pending plan only
   */
  renderPendingPlan() {
    this.render();
  }

  /**
   * Get activity icon
   * @param {string} type
   * @returns {string}
   */
  getActivityIcon(type) {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      case 'info':
      default:
        return '•';
    }
  }

  /**
   * Format timestamp
   * @param {number} timestamp
   * @returns {string}
   */
  formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  /**
   * Escape HTML
   * @param {string} str
   * @returns {string}
   */
  escapeHtml(str) {
    if (!str) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }
}

// Initialize panel when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  new SidePanelController();
});

export default SidePanelController;
