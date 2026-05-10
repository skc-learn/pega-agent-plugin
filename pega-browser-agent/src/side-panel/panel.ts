/**
 * Side Panel - Chat-Style Interface Controller
 *
 * Modern chat-style UI for end users.
 * Shows conversations with the AI assistant.
 */

import { MessageType } from '../shared/types';
import type {
  CaseSummary,
  ActionPlan,
  ExecutionResult,
  CaseContext,
} from '../shared/types';

// ============================================================================
// PANEL STATE
// ============================================================================

interface PanelState {
  isLoading: boolean;
  summary: CaseSummary | null;
  pendingPlan: ActionPlan | null;
  caseContext: CaseContext | null;
}

const state: PanelState = {
  isLoading: false,
  summary: null,
  pendingPlan: null,
  caseContext: null,
};

// ============================================================================
// DOM ELEMENTS
// ============================================================================

let chatContainer: HTMLElement | null = null;
let welcomeMessage: HTMLElement | null = null;
let messageInput: HTMLTextAreaElement | null = null;
let sendBtn: HTMLButtonElement | null = null;

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize the panel
 */
function initialize(): void {
  // Get DOM elements
  chatContainer = document.getElementById('chat-container');
  welcomeMessage = document.getElementById('welcome-message');
  messageInput = document.getElementById('message-input') as HTMLTextAreaElement;
  sendBtn = document.getElementById('send-btn') as HTMLButtonElement;

  // Setup event listeners
  setupEventListeners();

  // Notify service worker that panel is ready
  chrome.runtime.sendMessage({
    type: MessageType.PANEL_READY,
    payload: {},
  });
}

/**
 * Setup event listeners
 */
function setupEventListeners(): void {
  // Message input - Enter to send, Shift+Enter for newline
  if (messageInput) {
    messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
      }
    });
  }

  // Send button
  sendBtn?.addEventListener('click', sendMessage);

  // Quick action buttons
  document.querySelectorAll('.quick-action').forEach((btn) => {
    btn.addEventListener('click', handleQuickAction);
  });

  // Settings button
  document.getElementById('settings-btn')?.addEventListener('click', () => {
    chrome.runtime.openOptionsPage();
  });

  // Listen for messages from service worker
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    handlePanelMessage(message, sendResponse);
    return false;
  });
}

// ============================================================================
// MESSAGE HANDLING
// ============================================================================

/**
 * Handle messages from service worker
 */
function handlePanelMessage(
  message: { type: MessageType; payload: unknown },
  sendResponse: (response?: unknown) => void
): void {
  console.log('[Pega Agent Panel] Received message:', message.type, message.payload);

  switch (message.type) {
    case MessageType.SHOW_SUMMARY:
      handleShowSummary(message.payload as CaseSummary);
      break;

    case MessageType.SHOW_PLAN:
      handleShowPlan(message.payload as ActionPlan);
      break;

    case MessageType.SHOW_RESULT:
      handleShowResult(message.payload as ExecutionResult);
      break;

    case MessageType.SHOW_ERROR:
      handleShowError(message.payload as { message: string; details?: string });
      break;

    case MessageType.SHOW_LOADING:
      handleShowLoading(message.payload as { message?: string });
      break;

    case MessageType.UPDATE_ACTIVITY:
      handleUpdateActivity(message.payload as { type: string; message: string });
      break;

    case MessageType.CLEAR_PENDING:
      handleClearPending();
      break;

    case MessageType.CONNECTION_STATUS:
      handleConnectionStatus(message.payload as { connected: boolean; framework?: string });
      break;
  }

  sendResponse({ received: true });
}

// ============================================================================
// CHAT MESSAGE RENDERING
// ============================================================================

/**
 * Add a message to the chat
 */
function addMessage(
  role: 'user' | 'assistant',
  content: string | HTMLElement
): void {
  // Hide welcome message on first message
  if (welcomeMessage) {
    welcomeMessage.style.display = 'none';
  }

  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = role === 'user' ? 'U' : 'P';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  if (typeof content === 'string') {
    bubble.innerHTML = content;
  } else {
    bubble.appendChild(content);
  }

  const time = document.createElement('div');
  time.className = 'message-time';
  time.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  contentDiv.appendChild(bubble);
  contentDiv.appendChild(time);
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentDiv);

  chatContainer?.appendChild(messageDiv);
  scrollToBottom();
}

/**
 * Add typing indicator
 */
function addTypingIndicator(): HTMLElement | null {
  if (!chatContainer) return null;

  const messageDiv = document.createElement('div');
  messageDiv.className = 'message assistant';
  messageDiv.id = 'typing-indicator-message';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = 'P';

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';

  const bubble = document.createElement('div');
  bubble.className = 'message-bubble';

  const typing = document.createElement('div');
  typing.className = 'typing-indicator';
  typing.innerHTML = '<span></span><span></span><span></span>';

  bubble.appendChild(typing);
  contentDiv.appendChild(bubble);
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentDiv);

  chatContainer.appendChild(messageDiv);
  scrollToBottom();

  return messageDiv;
}

/**
 * Remove typing indicator
 */
function removeTypingIndicator(): void {
  document.getElementById('typing-indicator-message')?.remove();
}

/**
 * Scroll chat to bottom
 */
function scrollToBottom(): void {
  if (chatContainer) {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }
}

// ============================================================================
// CONNECTION STATUS
// ============================================================================

function handleConnectionStatus(payload: { connected: boolean; framework?: string }): void {
  console.log('[Pega Agent Panel] Received CONNECTION_STATUS:', payload);

  const statusDot = document.getElementById('status-dot');
  const statusText = document.getElementById('status-text');

  console.log('[Pega Agent Panel] Status elements:', { statusDot, statusText });

  if (statusDot && statusText) {
    if (payload.connected) {
      statusDot.classList.remove('inactive');
      const frameworkInfo = payload.framework ? ` (${payload.framework})` : '';
      statusText.textContent = `Connected${frameworkInfo}`;
      console.log('[Pega Agent Panel] Updated to Connected');
    } else {
      statusDot.classList.add('inactive');
      statusText.textContent = 'Not connected';
      console.log('[Pega Agent Panel] Updated to Not connected');
    }
  }
}

// ============================================================================
// SUMMARY HANDLING
// ============================================================================

function handleShowSummary(summary: CaseSummary): void {
  state.summary = summary;
  state.isLoading = false;
  removeTypingIndicator();

  // Build summary card HTML
  const summaryCard = document.createElement('div');
  summaryCard.className = 'summary-card';

  let riskHtml = '';
  if (summary.riskSignals && summary.riskSignals.length > 0) {
    riskHtml = `
      <div class="summary-field">
        <div class="summary-field-label">Risk Signals</div>
        <div class="summary-field-value">
          <ul style="margin: 0; padding-left: 16px; color: var(--error);">
            ${summary.riskSignals.map(s => `<li>${escapeHtml(s)}</li>`).join('')}
          </ul>
        </div>
      </div>
    `;
  }

  let recommendationHtml = '';
  if (summary.recommendedNextAction) {
    recommendationHtml = `
      <div class="summary-field">
        <div class="summary-field-label">Recommended Next Step</div>
        <div class="summary-field-value" style="color: var(--primary); font-weight: 500;">
          ${escapeHtml(summary.recommendedNextAction)}
        </div>
      </div>
    `;
  }

  summaryCard.innerHTML = `
    <div class="summary-card-header">
      <h4>Case Summary</h4>
      <span class="risk-badge ${getRiskLevel(summary)}">${getRiskLabel(summary)}</span>
    </div>
    <div class="summary-card-body">
      <div class="summary-field">
        <div class="summary-field-label">Situation</div>
        <div class="summary-field-value">${escapeHtml(summary.situation)}</div>
      </div>
      <div class="summary-field">
        <div class="summary-field-label">History</div>
        <div class="summary-field-value">${escapeHtml(summary.history)}</div>
      </div>
      <div class="summary-field">
        <div class="summary-field-label">Current State</div>
        <div class="summary-field-value">${escapeHtml(summary.currentState)}</div>
      </div>
      ${riskHtml}
      ${recommendationHtml}
    </div>
    <div class="feedback-row">
      <button class="feedback-btn positive" data-type="positive">👍 Helpful</button>
      <button class="feedback-btn negative" data-type="negative">👎 Not helpful</button>
    </div>
  `;

  // Add feedback button listeners
  summaryCard.querySelectorAll('.feedback-btn').forEach((btn) => {
    btn.addEventListener('click', handleFeedbackClick);
  });

  addMessage('assistant', summaryCard);
}

function getRiskLevel(summary: CaseSummary): string {
  if (summary.riskSignals && summary.riskSignals.length >= 3) return 'high';
  if (summary.riskSignals && summary.riskSignals.length >= 1) return 'medium';
  return 'low';
}

function getRiskLabel(summary: CaseSummary): string {
  const level = getRiskLevel(summary);
  if (level === 'high') return 'High Risk';
  if (level === 'medium') return 'Medium Risk';
  return 'Low Risk';
}

// ============================================================================
// PLAN HANDLING
// ============================================================================

function handleShowPlan(plan: ActionPlan): void {
  state.pendingPlan = plan;
  removeTypingIndicator();

  // Build action card HTML
  const actionCard = document.createElement('div');
  actionCard.className = 'action-card';
  actionCard.id = 'pending-action-card';

  actionCard.innerHTML = `
    <h4>${escapeHtml(plan.summary)}</h4>
    <p>I can help you with this action. Here's what I'll do:</p>
    <div class="action-steps">
      <ol>
        ${plan.steps.map(step => `
          <li>
            <strong>${step.action}</strong>
            <br><span style="color: var(--text-secondary);">${escapeHtml(step.description)}</span>
          </li>
        `).join('')}
      </ol>
    </div>
    <p style="font-size: 12px; color: var(--text-secondary);">
      <strong>Expected result:</strong> ${escapeHtml(plan.expectedOutcome)}
    </p>
    <div class="action-buttons">
      <button class="btn btn-primary" id="confirm-action-btn">Yes, do it</button>
      <button class="btn btn-secondary" id="cancel-action-btn">No, cancel</button>
    </div>
  `;

  addMessage('assistant', actionCard);

  // Add button listeners
  document.getElementById('confirm-action-btn')?.addEventListener('click', handleConfirmClick);
  document.getElementById('cancel-action-btn')?.addEventListener('click', handleCancelClick);
}

async function handleConfirmClick(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Update the action card to show it's executing
  const actionCard = document.getElementById('pending-action-card');
  if (actionCard) {
    actionCard.innerHTML = `
      <h4>Executing...</h4>
      <p>I'm performing the action now. Please wait.</p>
    `;
  }

  chrome.runtime.sendMessage({
    type: MessageType.USER_CONFIRM,
    payload: { tabId: tab?.id },
  });
}

async function handleCancelClick(): Promise<void> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Update the action card to show it was cancelled
  const actionCard = document.getElementById('pending-action-card');
  if (actionCard) {
    actionCard.innerHTML = `
      <h4>Cancelled</h4>
      <p>No changes were made. Let me know if you need something else.</p>
    `;
  }

  chrome.runtime.sendMessage({
    type: MessageType.USER_CANCEL,
    payload: { tabId: tab?.id },
  });

  state.pendingPlan = null;
}

function handleClearPending(): void {
  const actionCard = document.getElementById('pending-action-card');
  if (actionCard) {
    actionCard.remove();
  }
  state.pendingPlan = null;
}

// ============================================================================
// RESULT HANDLING
// ============================================================================

function handleShowResult(result: ExecutionResult): void {
  state.isLoading = false;

  const actionCard = document.getElementById('pending-action-card');
  if (actionCard) {
    if (result.status === 'complete') {
      actionCard.innerHTML = `
        <h4 style="color: var(--success);">Done!</h4>
        <p>The action completed successfully.</p>
      `;
    } else {
      const errorMsg = result.results.find(r => !r.success)?.errorMessage ?? 'Unknown error';
      actionCard.innerHTML = `
        <h4 style="color: var(--error);">Something went wrong</h4>
        <p>${escapeHtml(errorMsg)}</p>
        <p style="font-size: 12px; color: var(--text-secondary);">You can try again or ask me to help troubleshoot.</p>
      `;
    }
  }

  state.pendingPlan = null;
}

function handleShowError(payload: { message: string; details?: string }): void {
  state.isLoading = false;
  removeTypingIndicator();

  const errorHtml = `
    <div class="error-message">
      <strong>Oops!</strong> ${escapeHtml(payload.message)}
      ${payload.details ? `<br><small>${escapeHtml(payload.details)}</small>` : ''}
    </div>
  `;
  addMessage('assistant', errorHtml);
}

function handleShowLoading(_payload: { message?: string }): void {
  state.isLoading = true;
  addTypingIndicator();
}

function handleUpdateActivity(payload: { type: string; message: string }): void {
  // For now, we'll just log this. In the future, we could show a subtle toast.
  console.log(`[Activity] ${payload.type}: ${payload.message}`);
}

// ============================================================================
// USER INPUT
// ============================================================================

async function sendMessage(): Promise<void> {
  if (!messageInput) return;

  const message = messageInput.value.trim();
  if (!message) return;

  // Add user message to chat
  addMessage('user', escapeHtml(message));

  // Clear input
  messageInput.value = '';

  // Get active tab
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

  // Show typing indicator
  addTypingIndicator();

  // Send to service worker
  chrome.runtime.sendMessage({
    type: MessageType.USER_COMMAND,
    payload: { command: message, tabId: tab?.id },
  });
}

function handleQuickAction(event: Event): void {
  const btn = event.target as HTMLElement;
  const command = btn.dataset.command || btn.textContent;

  if (command && messageInput) {
    messageInput.value = command;
    sendMessage();
  }
}

// ============================================================================
// FEEDBACK
// ============================================================================

function handleFeedbackClick(event: Event): void {
  const btn = event.target as HTMLElement;
  const type = btn.dataset.type as 'positive' | 'negative';

  if (!type) return;

  chrome.runtime.sendMessage({
    type: MessageType.FEEDBACK,
    payload: {
      type,
      context: state.summary?.caseId,
    },
  });

  // Update button to show feedback was recorded
  btn.textContent = type === 'positive' ? '👍 Thanks!' : '👎 Got it';
  (btn as HTMLButtonElement).disabled = true;
}

// ============================================================================
// UTILITIES
// ============================================================================

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// INIT
// ============================================================================

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initialize);
} else {
  initialize();
}
