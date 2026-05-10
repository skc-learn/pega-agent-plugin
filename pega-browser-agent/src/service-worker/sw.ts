/**
 * Service Worker - Central Message Router & Orchestrator
 *
 * Handles all inter-component communication and orchestrates:
 * - DOM snapshots from content scripts
 * - Commands from side panel
 * - Plan generation and execution
 * - Summary generation
 * - Visual understanding
 * - Workflow orchestration with self-healing
 * - Case state management
 */

import {
  MessageType,
  type Message,
  type DOMSnapshot,
  type ActionPlan,
  type ExecutionResult,
  type PegaDetectionResult,
} from '../shared/types';
import { isValidMessage, generateUUID } from '../shared/message-types';
import { auditLogger } from '../shared/audit-logger';
import { sessionStore } from './session-store';
import { llmAdapter } from './llm-adapter';
import { plan, checkPermission, validatePlan } from './planner';
import { classifyIntent } from '../shared/intent-classifier';
import { summaryGenerator } from './summary-generator';
import { DEFAULT_CONFIG } from '../config/default-config';
import type { EnterpriseConfig } from '../shared/types';
import { initializeMCPServer } from './mcp-server';
import { initializeMCPClient, getMCPClient } from './mcp-client';
import type { MCPServerConfig } from '../shared/mcp-types';
import { visualUnderstanding } from './visual-understanding';
import { workflowOrchestrator } from './workflow-orchestrator';
import { caseStateManager } from './case-state-manager';

// ============================================================================
// SERVICE WORKER CLASS
// ============================================================================

class ServiceWorker {
  private initialized: boolean = false;
  private config: EnterpriseConfig = DEFAULT_CONFIG;

  /**
   * Initialize service worker
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Load configuration
    await this.loadConfig();

    // Initialize session store
    await sessionStore.initialize();

    // Initialize audit logger
    auditLogger.initialize({
      sessionId: generateUUID(),
      backendEndpoint: this.config.security.auditLoggingEnabled
        ? undefined // TODO: Configure backend endpoint
        : undefined,
    });

    // Configure LLM adapter (supports both single and multi-provider)
    await this.configureLLMAdapter();

    // Initialize MCP server (exposes extension capabilities)
    await initializeMCPServer();
    console.log('Pega Agent: MCP server initialized');

    // Initialize MCP client (connects to external MCP servers)
    const settings = await chrome.storage.sync.get('llmSettings');
    const mcpServers = (settings.llmSettings as { mcpServers?: MCPServerConfig[] })?.mcpServers || [];
    if (mcpServers.length > 0) {
      await initializeMCPClient(mcpServers.filter(s => s.enabled !== false));
      console.log('Pega Agent: MCP client initialized with', mcpServers.length, 'servers');
    }

    this.initialized = true;
    console.log('Pega Agent: Service worker initialized');
    console.log('Pega Agent: Visual understanding module loaded');
    console.log('Pega Agent: Workflow orchestrator loaded');
    console.log('Pega Agent: Case state manager loaded');
  }

  /**
   * Configure LLM adapter from storage settings
   */
  private async configureLLMAdapter(): Promise<void> {
    try {
      // Load settings from storage
      const llmResult = await chrome.storage.sync.get('llmSettings');
      const savedSettings = llmResult.llmSettings;

      // Handle simplified Anthropic-only format
      if (savedSettings?.apiKey) {
        llmAdapter.configure({
          provider: 'anthropic',
          apiKey: savedSettings.apiKey,
          model: savedSettings.model || 'claude-sonnet-4-20250514',
          endpoint: 'https://api.anthropic.com',
          maxTokens: savedSettings.maxTokens || 1500,
          temperature: savedSettings.temperature ?? 0.1,
        });
        console.log('Pega Agent: Configured Anthropic LLM with model', savedSettings.model || 'claude-sonnet-4-20250514');
        return;
      }

      // Fall back to multi-provider format (legacy support)
      if (savedSettings?.providers?.length > 0) {
        llmAdapter.configureMulti({
          providers: savedSettings.providers,
          fallbackEnabled: savedSettings.fallbackEnabled ?? true,
          maxRetries: 2,
          timeoutMs: 8000,
        });
        console.log('Pega Agent: Configured multi-provider LLM with', savedSettings.providers.length, 'providers');
        return;
      }

      // Fall back to default config
      if (this.config.llm.apiKey) {
        llmAdapter.configure(this.config.llm);
        console.log('Pega Agent: Configured single-provider LLM from default config');
      }
    } catch (error) {
      console.error('Pega Agent: Failed to configure LLM adapter', error);
    }
  }

  /**
   * Load configuration from storage
   */
  private async loadConfig(): Promise<void> {
    try {
      const result = await chrome.storage.sync.get('pegaAgentConfig');
      if (result.pegaAgentConfig) {
        this.config = { ...DEFAULT_CONFIG, ...result.pegaAgentConfig };
      }
    } catch {
      // Use default config
    }
  }

  /**
   * Handle incoming message
   */
  async handleMessage(
    message: Message,
    sender: chrome.runtime.MessageSender,
    sendResponse: (response?: unknown) => void
  ): Promise<boolean> {
    await this.initialize();

    if (!isValidMessage(message)) {
      sendResponse({ success: false, error: 'Invalid message format' });
      return false;
    }

    const { type, payload } = message;
    const tabId = sender.tab?.id;

    try {
      switch (type) {
        case MessageType.PEGA_DETECTED:
          await this.handlePegaDetected(payload as PegaDetectionResult, tabId, sendResponse);
          break;

        case MessageType.DOM_SNAPSHOT:
          await this.handleDomSnapshot(payload as { snapshot: DOMSnapshot; triggerSummary: boolean }, tabId, sendResponse);
          break;

        case MessageType.USER_COMMAND:
          await this.handleUserCommand(payload as { command: string; tabId?: number }, tabId, sendResponse);
          break;

        case MessageType.USER_CONFIRM:
          await this.handleUserConfirm(payload as { tabId?: number }, tabId, sendResponse);
          break;

        case MessageType.USER_CANCEL:
          await this.handleUserCancel(payload as { tabId?: number }, tabId, sendResponse);
          break;

        case MessageType.FEEDBACK:
          await this.handleFeedback(payload as { type: string; context?: string }, sendResponse);
          break;

        case MessageType.PANEL_READY:
          await this.handlePanelReady(tabId, sendResponse);
          break;

        case MessageType.ACTION_RESULT:
          await this.handleActionResult(payload as { planId: string; result: ExecutionResult }, tabId, sendResponse);
          break;

        // MCP Message Handlers
        case MessageType.MCP_TEST_CONNECTION:
          await this.handleMCPTestConnection(payload as { serverConfig: MCPServerConfig }, sendResponse);
          break;

        case MessageType.MCP_LIST_TOOLS:
          await this.handleMCPListTools(sendResponse);
          break;

        case MessageType.MCP_CALL_TOOL:
          await this.handleMCPCallTool(payload as { serverName: string; toolName: string; args: Record<string, unknown> }, sendResponse);
          break;

        case MessageType.MCP_LIST_SERVERS:
          await this.handleMCPListServers(sendResponse);
          break;

        case MessageType.MCP_CONNECT_SERVER:
          await this.handleMCPConnectServer(payload as { serverName: string }, sendResponse);
          break;

        case MessageType.MCP_DISCONNECT_SERVER:
          await this.handleMCPDisconnectServer(payload as { serverName: string }, sendResponse);
          break;

        default:
          sendResponse({ success: false, error: `Unknown message type: ${type}` });
      }
    } catch (error) {
      console.error('Pega Agent: Handler error', error);
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    return true; // Keep channel open for async response
  }

  // =========================================================================
  // MESSAGE HANDLERS
  // =========================================================================

  /**
   * Handle Pega detection
   */
  private async handlePegaDetected(
    payload: PegaDetectionResult & { detectionFailed?: boolean; url?: string },
    tabId: number | undefined,
    sendResponse: (response?: unknown) => void
  ): Promise<void> {
    // Handle detection failure case
    if (payload.detectionFailed) {
      console.log('[Pega Agent] Detection failed for URL:', payload.url);

      // Try to open side panel and show error
      if (tabId) {
        try {
          await chrome.sidePanel.open({ tabId });
          // Give panel time to initialize before sending message
          setTimeout(() => {
            try {
              // Send to side panel via runtime message (not tabs.sendMessage)
              // Side panel listens via chrome.runtime.onMessage
              chrome.runtime.sendMessage({
                type: MessageType.SHOW_ERROR,
                payload: {
                  message: 'Pega detection confidence too low',
                  details: 'The page looks like Pega but detection signals were insufficient. Try refreshing the page or check if this is a Pega application.',
                },
              });
            } catch {
              console.warn('[Pega Agent] Could not send detection error to panel');
            }
          }, 500);
        } catch {
          console.warn('[Pega Agent] Could not open side panel');
        }
      }

      sendResponse({ detected: false, reason: 'low_confidence' });
      return;
    }

    if (!tabId || !payload.isPega) {
      sendResponse({ detected: false });
      return;
    }

    console.log('[Pega Agent] Pega detected:', {
      confidence: payload.confidence,
      framework: payload.uiFramework,
      version: payload.version,
      appName: payload.appName,
    });

    // Initialize session
    await sessionStore.initSession(tabId, {
      isPega: payload.isPega,
      confidence: payload.confidence,
      framework: payload.uiFramework,
      version: payload.version,
      appName: payload.appName,
    });

    // Log detection
    auditLogger.logPegaDetected(null, payload.confidence);

    // Open side panel
    try {
      await chrome.sidePanel.open({ tabId });
    } catch {
      console.warn('Pega Agent: Could not open side panel');
    }

    // Notify side panel of connection status (with delay to allow panel to initialize)
    setTimeout(() => {
      console.log('[Pega Agent SW] Sending CONNECTION_STATUS to side panel');
      chrome.runtime.sendMessage({
        type: MessageType.CONNECTION_STATUS,
        payload: {
          connected: true,
          framework: payload.uiFramework,
          version: payload.version,
          appName: payload.appName,
        },
      }).then(() => {
        console.log('[Pega Agent SW] CONNECTION_STATUS sent successfully');
      }).catch((err) => {
        console.warn('[Pega Agent SW] Could not send CONNECTION_STATUS:', err);
      });
    }, 500);

    sendResponse({ detected: true });
  }

  /**
   * Handle DOM snapshot
   */
  private async handleDomSnapshot(
    payload: { snapshot: DOMSnapshot; triggerSummary: boolean },
    tabId: number | undefined,
    sendResponse: (response?: unknown) => void
  ): Promise<void> {
    if (!tabId) {
      sendResponse({ received: false });
      return;
    }

    // Update snapshot in session store
    await sessionStore.updateSnapshot(tabId, payload.snapshot);

    // Update case state for tracking across navigation
    const caseState = caseStateManager.update(tabId, payload.snapshot);
    if (caseState) {
      console.log('[Pega Agent] Case state updated:', {
        caseId: caseState.caseId,
        stage: caseState.stage,
        status: caseState.status,
      });
    }

    // Generate summary if triggered
    if (payload.triggerSummary && payload.snapshot.caseContext.caseId) {
      this.generateAndSendSummary(tabId, payload.snapshot);
    }

    sendResponse({ received: true });
  }

  /**
   * Generate summary and send to panel
   */
  private async generateAndSendSummary(tabId: number, snapshot: DOMSnapshot): Promise<void> {
    try {
      // Get Pega detection context for framework-aware summary
      const sessionContext = await sessionStore.getContext(tabId);
      const pegaDetection = sessionContext?.pegaDetection ?? null;

      // Get case state for enhanced context
      const caseState = caseStateManager.get(tabId);
      const recentChanges = caseStateManager.getRecentChanges(tabId);

      const summary = await summaryGenerator.generate(tabId, snapshot, pegaDetection);

      if (summary) {
        auditLogger.logSummaryGeneration(snapshot.caseContext.caseId, true);

        // Enhance summary with case state information
        if (caseState && recentChanges.length > 0) {
          console.log('[Pega Agent] Summary enhanced with case state:', {
            recentChangeCount: recentChanges.length,
          });
        }

        // Send directly to side panel via runtime message
        // Ignore error if side panel isn't open
        try {
          await chrome.runtime.sendMessage({
            type: MessageType.SHOW_SUMMARY,
            payload: summary,
          });
        } catch {
          // Side panel not open - this is expected, summary is cached for later retrieval
        }
      }
    } catch (error) {
      console.error('Pega Agent: Summary generation error', error);
      auditLogger.logSummaryGeneration(snapshot.caseContext.caseId, false);
    }
  }

  /**
   * Handle user command
   */
  private async handleUserCommand(
    payload: { command: string; tabId?: number },
    senderTabId: number | undefined,
    sendResponse: (response?: unknown) => void
  ): Promise<void> {
    // Use tabId from payload (side panel) or sender (content script)
    const tabId = payload.tabId ?? senderTabId;

    if (!tabId) {
      sendResponse({ error: 'No tab context' });
      return;
    }

    const snapshot = await sessionStore.getSnapshot(tabId);
    if (!snapshot) {
      sendResponse({ error: 'No context available. Please navigate to a Pega page.' });
      return;
    }

    // Log command
    auditLogger.logCommandReceived(payload.command, snapshot.caseContext.caseId);

    try {
      // Generate plan
      const actionPlan = await plan(payload.command, snapshot);

      // Null plan could mean SUMMARIZE_CASE - check classification
      if (!actionPlan) {
        const classification = classifyIntent(payload.command);
        if (classification.intent === 'SUMMARIZE_CASE') {
          // Trigger summary generation
          await this.generateAndSendSummary(tabId, snapshot);
          sendResponse({ plan: null, message: 'Summary generated' });
          return;
        }
        sendResponse({ plan: null, message: 'No action required' });
        return;
      }

      // Check permission
      const userRole = await sessionStore.getUserRole(tabId);
      const hasPermission = checkPermission(
        actionPlan.intent,
        userRole,
        this.config.roleRestrictions
      );

      if (!hasPermission) {
        sendResponse({
          error: 'Permission denied',
          message: `You don't have permission to perform: ${actionPlan.intent}`,
        });
        return;
      }

      // Validate plan
      const validation = validatePlan(actionPlan, snapshot);
      if (!validation.valid) {
        sendResponse({
          error: 'Invalid plan',
          message: validation.errors.join('; '),
        });
        return;
      }

      // Log plan generation
      auditLogger.logPlanGenerated(actionPlan, snapshot.caseContext.caseId);

      // Store pending plan
      await sessionStore.setPendingPlan(tabId, actionPlan);

      // Check if confirmation required
      const requiresConfirmation =
        actionPlan.requiresConfirmation ||
        this.config.security.requireConfirmationForAllActions;

      if (requiresConfirmation) {
        // Send plan to side panel for confirmation via runtime message
        try {
          await chrome.runtime.sendMessage({
            type: MessageType.SHOW_PLAN,
            payload: actionPlan,
          });
        } catch {
          // Side panel might not be open
        }

        sendResponse({ requiresConfirmation: true, plan: actionPlan });
      } else {
        // Execute immediately
        await this.executePlan(tabId, actionPlan);
        sendResponse({ executing: true, plan: actionPlan });
      }
    } catch (error) {
      sendResponse({
        error: error instanceof Error ? error.message : 'Failed to generate plan',
      });
    }
  }

  /**
   * Handle user confirm
   */
  private async handleUserConfirm(
    payload: { tabId?: number },
    senderTabId: number | undefined,
    sendResponse: (response?: unknown) => void
  ): Promise<void> {
    const tabId = payload.tabId ?? senderTabId;

    if (!tabId) {
      sendResponse({ error: 'No tab context' });
      return;
    }

    const pendingPlan = await sessionStore.getPendingPlan(tabId);
    if (!pendingPlan) {
      sendResponse({ error: 'No pending plan to confirm' });
      return;
    }

    // Log confirmation
    auditLogger.logPlanConfirmed(pendingPlan, null);

    // Execute plan
    await this.executePlan(tabId, pendingPlan);

    sendResponse({ executing: true });
  }

  /**
   * Handle user cancel
   */
  private async handleUserCancel(
    payload: { tabId?: number },
    senderTabId: number | undefined,
    sendResponse: (response?: unknown) => void
  ): Promise<void> {
    const tabId = payload.tabId ?? senderTabId;

    if (!tabId) {
      sendResponse({ cancelled: false });
      return;
    }

    const pendingPlan = await sessionStore.getPendingPlan(tabId);

    if (pendingPlan) {
      auditLogger.logPlanCancellation(pendingPlan);
    }

    await sessionStore.clearPendingPlan(tabId);

    // Notify panel via runtime message (not tabs.sendMessage)
    // Side panel listens via chrome.runtime.onMessage
    chrome.runtime.sendMessage({
      type: MessageType.CLEAR_PENDING,
      payload: {},
    });

    sendResponse({ cancelled: true });
  }

  /**
   * Handle feedback
   */
  private async handleFeedback(
    payload: { type: string; context?: string },
    sendResponse: (response?: unknown) => void
  ): Promise<void> {
    auditLogger.logFeedback(
      payload.type as 'positive' | 'negative' | 'neutral',
      payload.context
    );

    sendResponse({ received: true });
  }

  /**
   * Handle panel ready
   */
  private async handlePanelReady(
    tabId: number | undefined,
    sendResponse: (response?: unknown) => void
  ): Promise<void> {
    // If no tabId from sender, get the current active tab
    let effectiveTabId = tabId;
    if (!effectiveTabId) {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      effectiveTabId = activeTab?.id;
    }

    if (!effectiveTabId) {
      sendResponse({});
      return;
    }

    const context = await sessionStore.getContext(effectiveTabId);
    const snapshot = await sessionStore.getSnapshot(effectiveTabId);
    const pendingPlan = await sessionStore.getPendingPlan(effectiveTabId);
    const caseState = caseStateManager.get(effectiveTabId);

    // Send connection status to panel if Pega is detected
    if (context?.pegaDetection?.isPega) {
      chrome.runtime.sendMessage({
        type: MessageType.CONNECTION_STATUS,
        payload: {
          connected: true,
          framework: context.pegaDetection.uiFramework,
          version: context.pegaDetection.version,
          appName: context.pegaDetection.appName,
        },
      }).catch(() => {
        // Panel might not be ready yet
      });
    }

    sendResponse({
      pegaState: context?.pegaDetection,
      caseContext: snapshot?.caseContext,
      snapshot,
      pendingPlan,
      caseState,
    });
  }

  /**
   * Handle action result from content script
   */
  private async handleActionResult(
    payload: { planId: string; result: ExecutionResult },
    tabId: number | undefined,
    sendResponse: (response?: unknown) => void
  ): Promise<void> {
    if (!tabId) {
      sendResponse({ received: false });
      return;
    }

    const snapshot = await sessionStore.getSnapshot(tabId);

    // Log result
    auditLogger.logPlanExecution(
      { planId: payload.planId } as ActionPlan,
      payload.result.status,
      snapshot?.caseContext.caseId ?? null,
      payload.result.status === 'failed'
        ? payload.result.results.find((r) => !r.success)?.errorMessage
        : undefined
    );

    // Invalidate summary cache since case state may have changed
    if (snapshot?.caseContext.caseId) {
      await summaryGenerator.invalidateCache(tabId, snapshot.caseContext.caseId);
    }

    // Capture failure screenshot if needed
    if (payload.result.status === 'failed') {
      const screenshot = await visualUnderstanding.captureFailure(tabId);
      if (screenshot) {
        console.log('[Pega Agent] Failure screenshot captured');
      }
    }

    // Send result to side panel via runtime message (not tabs.sendMessage)
    // Side panel listens via chrome.runtime.onMessage
    chrome.runtime.sendMessage({
      type: MessageType.SHOW_RESULT,
      payload: payload.result,
    });

    sendResponse({ received: true });
  }

  // =========================================================================
  // MCP MESSAGE HANDLERS
  // =========================================================================

  /**
   * Handle MCP test connection request
   */
  private async handleMCPTestConnection(
    payload: { serverConfig: MCPServerConfig },
    sendResponse: (response?: unknown) => void
  ): Promise<void> {
    try {
      const client = getMCPClient();
      client.addServer(payload.serverConfig);
      await client.connect(payload.serverConfig.name);

      const status = client.getStatus().find(s => s.name === payload.serverConfig.name);

      if (status?.state === 'connected') {
        sendResponse({ success: true, serverInfo: status.serverInfo });
      } else {
        sendResponse({ success: false, error: status?.lastError || 'Connection failed' });
      }

      // Clean up test connection
      await client.removeServer(payload.serverConfig.name);
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle MCP list tools request
   */
  private async handleMCPListTools(
    sendResponse: (response?: unknown) => void
  ): Promise<void> {
    try {
      const client = getMCPClient();
      const tools = await client.listAllTools();
      const toolsArray = Array.from(tools.entries()).map(([server, serverTools]) => ({
        server,
        tools: serverTools,
      }));
      sendResponse({ success: true, tools: toolsArray });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle MCP call tool request
   */
  private async handleMCPCallTool(
    payload: { serverName: string; toolName: string; args: Record<string, unknown> },
    sendResponse: (response?: unknown) => void
  ): Promise<void> {
    try {
      const client = getMCPClient();
      const result = await client.callTool(payload.serverName, payload.toolName, payload.args);
      sendResponse({ success: true, result });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle MCP list servers request
   */
  private async handleMCPListServers(
    sendResponse: (response?: unknown) => void
  ): Promise<void> {
    try {
      const client = getMCPClient();
      const servers = client.getStatus();
      sendResponse({ success: true, servers });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle MCP connect server request
   */
  private async handleMCPConnectServer(
    payload: { serverName: string },
    sendResponse: (response?: unknown) => void
  ): Promise<void> {
    try {
      const client = getMCPClient();
      const connection = await client.connect(payload.serverName);
      sendResponse({ success: true, connection });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Handle MCP disconnect server request
   */
  private async handleMCPDisconnectServer(
    payload: { serverName: string },
    sendResponse: (response?: unknown) => void
  ): Promise<void> {
    try {
      const client = getMCPClient();
      const server = client.getServer(payload.serverName);
      if (server) {
        await server.disconnect();
      }
      sendResponse({ success: true });
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }
  }

  /**
   * Execute a plan by sending to content script
   */
  private async executePlan(tabId: number, actionPlan: ActionPlan): Promise<void> {
    console.log('[Pega Agent SW] executePlan: sending plan to tab', tabId, 'plan:', actionPlan.planId, actionPlan.summary);
    
    // Create workflow from plan for enhanced execution with self-healing
    const workflow = workflowOrchestrator.createFromPlan(actionPlan);
    console.log('[Pega Agent SW] Created workflow with self-healing:', workflow.workflowId);
    
    await chrome.tabs.sendMessage(tabId, {
      type: MessageType.EXECUTE_ACTION,
      payload: { plan: actionPlan },
    });
  }
}

// ============================================================================
// INITIALIZATION
// ============================================================================

const serviceWorker = new ServiceWorker();

// Listen for messages
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  serviceWorker.handleMessage(message as Message, sender, sendResponse);
  return true; // Keep channel open for async response
});

// Handle extension install
chrome.runtime.onInstalled.addListener(async (details) => {
  console.log('Pega Agent: Extension installed', details.reason);
  await serviceWorker.initialize();
});

// Handle service worker startup
chrome.runtime.onStartup.addListener(async () => {
  console.log('Pega Agent: Service worker starting');
  await serviceWorker.initialize();
});

// Handle tab removal - clear session
chrome.tabs.onRemoved.addListener(async (tabId) => {
  await sessionStore.clearSession(tabId);
  caseStateManager.clear(tabId);
});

// Configure side panel behavior
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true });

export { ServiceWorker, serviceWorker };
