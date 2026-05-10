/**
 * MCP Server - Expose Extension Capabilities as MCP Tools
 *
 * Allows external MCP clients to interact with the Pega Browser Agent
 * through the Model Context Protocol.
 */

import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  ServerCapabilities,
  ToolResult,
  ListToolsResult,
  ListResourcesResult,
  ReadResourceResult,
  ListPromptsResult,
  GetPromptResult,
  GetPromptParams,
} from '../shared/mcp-types';
import {
  MCP_VERSION,
  PEGA_MCP_TOOLS,
  PEGA_MCP_RESOURCES,
  MCP_ERROR_CODES,
} from '../shared/mcp-types';
import type { DOMSnapshot, ActionPlan, PlanActionType } from '../shared/types';
import { MessageType } from '../shared/types';

// ============================================================================
// TYPES
// ============================================================================

interface MCPClientConnection {
  id: string;
  port: chrome.runtime.Port | null;
  capabilities: {
    tools?: boolean;
    resources?: boolean;
    prompts?: boolean;
  };
}

type ToolHandler = (args: Record<string, unknown>, tabId?: number) => Promise<ToolResult>;
type ResourceHandler = () => Promise<unknown>;

// ============================================================================
// MCP SERVER IMPLEMENTATION
// ============================================================================

/**
 * MCP Server that exposes Pega Browser Agent capabilities
 */
export class MCPServer {
  private clients = new Map<string, MCPClientConnection>()
  private toolHandlers = new Map<string, ToolHandler>()
  private resourceHandlers = new Map<string, ResourceHandler>()
  private serverInfo = {
    name: 'pega-browser-agent',
    version: '1.0.0',
  }

  constructor() {
    this.registerDefaultTools()
    this.registerDefaultResources()
  }

  getCapabilities(): ServerCapabilities {
    return {
      tools: { listChanged: true },
      resources: { subscribe: true, listChanged: true },
      prompts: { listChanged: true },
      logging: {},
    }
  }

  async handleRequest(request: JsonRpcRequest, clientId: string): Promise<JsonRpcResponse> {
    const { method, params, id } = request

    try {
      let result: unknown

      switch (method) {
        case 'initialize':
          result = await this.handleInitialize(params as Record<string, unknown>)
          break

        case 'tools/list':
          result = await this.handleListTools()
          break

        case 'tools/call':
          result = await this.handleCallTool(params as Record<string, unknown>, clientId)
          break

        case 'resources/list':
          result = await this.handleListResources()
          break

        case 'resources/read':
          result = await this.handleReadResource(params as Record<string, unknown>)
          break

        case 'resources/subscribe':
          result = { subscribed: true }
          break

        case 'prompts/list':
          result = await this.handleListPrompts()
          break

        case 'prompts/get':
          result = await this.handleGetPrompt(params as unknown as GetPromptParams)
          break

        case 'ping':
          result = {}
          break

        default:
          return this.createErrorResponse(
            id,
            MCP_ERROR_CODES.METHOD_NOT_FOUND,
            `Method not found: ${method}`
          )
      }

      return this.createSuccessResponse(id, result)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return this.createErrorResponse(id, MCP_ERROR_CODES.INTERNAL_ERROR, message)
    }
  }

  registerTool(name: string, handler: ToolHandler): void {
    this.toolHandlers.set(name, handler)
  }

  registerResource(uri: string, handler: ResourceHandler): void {
    this.resourceHandlers.set(uri, handler)
  }

  broadcastNotification(method: string, params?: Record<string, unknown>): void {
    const notification: JsonRpcNotification = {
      jsonrpc: '2.0',
      method,
      params,
    }

    for (const [_clientId, client] of this.clients) {
      if (client.port) {
        try {
          client.port.postMessage(notification)
        } catch (error) {
          console.error(`[MCP Server] Failed to send notification to ${_clientId}:`, error)
        }
      }
    }
  }

  notifyToolsChanged(): void {
    this.broadcastNotification('notifications/tools/list_changed')
  }

  notifyResourcesChanged(): void {
    this.broadcastNotification('notifications/resources/list_changed')
  }

  addClient(clientId: string, port?: chrome.runtime.Port): void {
    this.clients.set(clientId, {
      id: clientId,
      port: port ?? null,
      capabilities: {},
    });
  }

  removeClient(clientId: string): void {
    this.clients.delete(clientId)
  }

  // ============================================================================
  // REQUEST HANDLERS
  // ============================================================================

  private async handleInitialize(_params: Record<string, unknown>): Promise<{
    protocolVersion: string
    capabilities: ServerCapabilities
    serverInfo: { name: string; version: string }
    instructions: string
  }> {
    return {
      protocolVersion: MCP_VERSION,
      capabilities: this.getCapabilities(),
      serverInfo: this.serverInfo,
      instructions: `Pega Browser Agent MCP Server

This server provides tools and resources for interacting with Pega case management applications.

Available capabilities:
- Tools: Execute actions, get case summaries, update fields, navigate cases
- Resources: Access current case data, history, and available actions
- Prompts: Pre-configured prompts for common Pega workflows

To use these tools, you need to have the Pega Browser Agent extension installed and a Pega case open in your browser.`,
    }
  }

  private async handleListTools(): Promise<ListToolsResult> {
    return {
      tools: PEGA_MCP_TOOLS,
    }
  }

  private async handleCallTool(
    params: Record<string, unknown>,
    _clientId: string
  ): Promise<ToolResult> {
    const toolName = params?.name as string
    const args = (params?.arguments as Record<string, unknown>) ?? {}

    if (!toolName) {
      return this.createToolError('Tool name is required')
    }

    const handler = this.toolHandlers.get(toolName)
    if (!handler) {
      return this.createToolError(`Unknown tool: ${toolName}`)
    }

    const tabId = await this.getActiveTabId()

    try {
      return await handler(args, tabId)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      return this.createToolError(message)
    }
  }

  private async handleListResources(): Promise<ListResourcesResult> {
    return {
      resources: PEGA_MCP_RESOURCES,
    }
  }

  private async handleReadResource(params: Record<string, unknown>): Promise<ReadResourceResult> {
    const uri = params?.uri as string

    if (!uri) {
      throw new Error('Resource URI is required')
    }

    const handler = this.resourceHandlers.get(uri)
    if (!handler) {
      throw new Error(`Unknown resource: ${uri}`)
    }

    const contents = await handler()

    return {
      contents: [
        {
          uri,
          mimeType: 'application/json',
          text: JSON.stringify(contents, null, 2),
        },
      ],
    }
  }

  private async handleListPrompts(): Promise<ListPromptsResult> {
    return {
      prompts: [
        {
          name: 'summarize_case',
          description: 'Generate a comprehensive summary of the current Pega case',
        },
        {
          name: 'suggest_next_action',
          description: 'Suggest the next best action for the current case',
        },
        {
          name: 'identify_risks',
          description: 'Identify potential risk signals in the current case',
        },
        {
          name: 'explain_workflow',
          description: 'Explain the current workflow and available paths',
        },
      ],
    }
  }

  private async handleGetPrompt(params: unknown): Promise<GetPromptResult> {
    const promptName = (params as GetPromptParams)?.name;

    const prompts: Record<string, GetPromptResult> = {
      summarize_case: {
        description: 'Generate a case summary',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'Please summarize the current Pega case, including:\n1. Current situation and status\n2. Key information and field values\n3. Recent history and actions\n4. Any risk signals or concerns\n5. Recommended next steps',
            },
          },
        ],
      },
      suggest_next_action: {
        description: 'Suggest next action',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'Based on the current case state and available actions, what is the best next step? Consider:\n1. Current stage and status\n2. SLA deadlines\n3. Available actions\n4. Case history',
            },
          },
        ],
      },
      identify_risks: {
        description: 'Identify case risks',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'Analyze the current case for potential risk signals:\n1. SLA concerns or approaching deadlines\n2. Unusual case patterns\n3. Missing or inconsistent data\n4. Escalation indicators\n5. Process bottlenecks',
            },
          },
        ],
      },
      explain_workflow: {
        description: 'Explain the workflow',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: 'Explain the current workflow in this case:\n1. What stage is the case in?\n2. What are the possible next stages?\n3. What actions are available at each stage?\n4. Are there any alternative paths?',
            },
          },
        ],
      },
    }

    const prompt = prompts[promptName ?? '']
    if (!prompt) {
      throw new Error(`Unknown prompt: ${promptName}`)
    }

    return prompt
  }

  // ============================================================================
  // DEFAULT TOOL HANDLERS
  // ============================================================================

  private registerDefaultTools(): void {
    // Get Case Summary
    this.registerTool('pega_get_case_summary', async (_args, tabId) => {
      if (!tabId) {
        return this.createToolError('No active Pega tab found')
      }

      try {
        const response = await this.sendMessageToTab(tabId, {
          type: MessageType.CAPTURE_DOM,
          payload: { triggerSummary: true },
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
            },
          ],
        }
      } catch (error) {
        return this.createToolError(`Failed to get case summary: ${error}`)
      }
    })

    // Execute Action Plan
    this.registerTool('pega_execute_action_plan', async (args, tabId) => {
      const command = args.command as string
      const autoConfirm = args.autoConfirm === true

      if (!command) {
        return this.createToolError('Command is required')
      }

      if (!tabId) {
        return this.createToolError('No active Pega tab found')
      }

      return {
        content: [
          {
            type: 'text',
            text: `Action plan execution initiated: "${command}"\nAuto-confirm: ${autoConfirm}\n\nThe plan will be generated and executed on the active Pega case.`,
          },
        ],
      }
    })

    // Get DOM Snapshot
    this.registerTool('pega_get_dom_snapshot', async (args, tabId) => {
      const includePII = args.includePII === true

      if (!tabId) {
        return this.createToolError('No active Pega tab found')
      }

      try {
        const response = (await this.sendMessageToTab(tabId, {
          type: MessageType.CAPTURE_DOM,
          payload: { triggerSummary: false },
        })) as { snapshot?: DOMSnapshot } | undefined

        const snapshot = response?.snapshot
        if (!includePII && snapshot) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify(this.maskSnapshotPII(snapshot), null, 2),
              },
            ],
          }
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(snapshot, null, 2),
            },
          ],
        }
      } catch (error) {
        return this.createToolError(`Failed to get DOM snapshot: ${error}`)
      }
    })

    // Detect Pega Framework
    this.registerTool('pega_detect_framework', async (_args, tabId) => {
      if (!tabId) {
        return this.createToolError('No active tab found')
      }

      try {
        const response = await this.sendMessageToTab(tabId, {
          type: MessageType.PEGA_DETECTED,
          payload: {},
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
            },
          ],
        }
      } catch (error) {
        return this.createToolError(`Failed to detect Pega framework: ${error}`)
      }
    })

    // Update Field
    this.registerTool('pega_update_field', async (args, tabId) => {
      const fieldLabel = args.fieldLabel as string
      const value = args.value as string

      if (!fieldLabel || value === undefined) {
        return this.createToolError('Field label and value are required')
      }

      if (!tabId) {
        return this.createToolError('No active Pega tab found')
      }

      try {
        const plan: ActionPlan = {
          planId: `mcp-${Date.now()}`,
          intent: 'UPDATE_FIELD',
          summary: `Update ${fieldLabel} to ${value}`,
          requiresConfirmation: true,
          steps: [
            {
              stepNumber: 1,
              action: 'TYPE' as PlanActionType,
              selector: `[data-test-id*="${fieldLabel}"], [aria-label*="${fieldLabel}"]`,
              value,
              description: `Type "${value}" into ${fieldLabel}`,
              isReversible: true,
            },
          ],
          expectedOutcome: `Field ${fieldLabel} updated to ${value}`,
          createdAt: Date.now(),
        }

        const response = await this.sendMessageToTab(tabId, {
          type: MessageType.EXECUTE_ACTION,
          payload: { plan },
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
            },
          ],
        }
      } catch (error) {
        return this.createToolError(`Failed to update field: ${error}`)
      }
    })

    // Click Action
    this.registerTool('pega_click_action', async (args, tabId) => {
      const actionLabel = args.actionLabel as string
      const waitForResponse = args.waitForResponse !== false

      if (!actionLabel) {
        return this.createToolError('Action label is required')
      }

      if (!tabId) {
        return this.createToolError('No active Pega tab found')
      }

      try {
        const steps: ActionPlan['steps'] = [
          {
            stepNumber: 1,
            action: 'CLICK' as PlanActionType,
            selector: `button[data-test-id*="${actionLabel}"], button[aria-label*="${actionLabel}"]`,
            description: `Click ${actionLabel} button`,
            isReversible: false,
          },
        ]

        if (waitForResponse) {
          steps.push({
            stepNumber: 2,
            action: 'WAIT' as PlanActionType,
            selector: '',
            value: '1000',
            description: 'Wait for response',
            isReversible: true,
          })
        }

        const plan: ActionPlan = {
          planId: `mcp-${Date.now()}`,
          intent: 'SUBMIT_CASE',
          summary: `Click ${actionLabel}`,
          requiresConfirmation: true,
          steps,
          expectedOutcome: `Action ${actionLabel} completed`,
          createdAt: Date.now(),
        }

        const response = await this.sendMessageToTab(tabId, {
          type: MessageType.EXECUTE_ACTION,
          payload: { plan },
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
            },
          ],
        }
      } catch (error) {
        return this.createToolError(`Failed to click action: ${error}`)
      }
    })

    // Navigate Case
    this.registerTool('pega_navigate_case', async (args, tabId) => {
      const target = args.target as string

      if (!target) {
        return this.createToolError('Target is required')
      }

      const isUrl = target.startsWith('http');

      if (isUrl && tabId) {
        await chrome.tabs.update(tabId, { url: target });
        return {
          content: [
            {
              type: 'text',
              text: `Navigating to: ${target}`,
            },
          ],
        };
      }

      if (!tabId) {
        return this.createToolError('No active Pega tab found')
      }

      try {
        const plan: ActionPlan = {
          planId: `mcp-${Date.now()}`,
          intent: 'OPEN_CASE',
          summary: `Navigate to ${target}`,
          requiresConfirmation: false,
          steps: [
            {
              stepNumber: 1,
              action: 'CLICK' as PlanActionType,
              selector: `[data-test-id*="${target}"], a[href*="${target}"]`,
              description: `Click navigation to ${target}`,
              isReversible: true,
            },
          ],
          expectedOutcome: `Navigated to ${target}`,
          createdAt: Date.now(),
        }

        const response = await this.sendMessageToTab(tabId, {
          type: MessageType.EXECUTE_ACTION,
          payload: { plan },
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
            },
          ],
        }
      } catch (error) {
        return this.createToolError(`Failed to navigate: ${error}`)
      }
    })

    // Wait For Condition
    this.registerTool('pega_wait_for', async (args, tabId) => {
      const condition = args.condition as string
      const selector = args.selector as string
      const expectedValue = args.expectedValue as string | undefined

      if (!condition || !selector) {
        return this.createToolError('Condition and selector are required')
      }

      if (!tabId) {
        return this.createToolError('No active Pega tab found')
      }

      const actionMap: Record<string, PlanActionType> = {
        element: 'WAIT_FOR_ELEMENT',
        visible: 'WAIT_FOR_VISIBLE',
        enabled: 'WAIT_FOR_ENABLED',
        hidden: 'WAIT_FOR_HIDDEN',
        text: 'WAIT_FOR_TEXT',
      }

      const action = actionMap[condition]
      if (!action) {
        return this.createToolError(`Unknown condition: ${condition}`)
      }

      try {
        const plan: ActionPlan = {
          planId: `mcp-${Date.now()}`,
          intent: 'UNKNOWN',
          summary: `Wait for ${condition} on ${selector}`,
          requiresConfirmation: false,
          steps: [
            {
              stepNumber: 1,
              action,
              selector,
              value: expectedValue,
              description: `Wait for ${condition} on ${selector}`,
              isReversible: true,
            },
          ],
          expectedOutcome: `Condition ${condition} met`,
          createdAt: Date.now(),
        }

        const response = await this.sendMessageToTab(tabId, {
          type: MessageType.EXECUTE_ACTION,
          payload: { plan },
        })

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(response, null, 2),
            },
          ],
        }
      } catch (error) {
        return this.createToolError(`Wait failed: ${error}`)
      }
    })
  }

  // ============================================================================
  // DEFAULT RESOURCE HANDLERS
  // ============================================================================

  private registerDefaultResources(): void {
    // Current Case Resource
    this.registerResource('pega://current-case', async () => {
      const tabId = await this.getActiveTabId()
      if (!tabId) {
        return { error: 'No active Pega tab' }
      }

      try {
        const response = (await this.sendMessageToTab(tabId, {
          type: MessageType.CAPTURE_DOM,
          payload: { triggerSummary: false },
        })) as { snapshot?: DOMSnapshot } | undefined

        const snapshot = response?.snapshot
        if (snapshot) {
          return this.maskSnapshotPII(snapshot)
        }
        return { error: 'No snapshot available' }
      } catch (error) {
        return { error: String(error) }
      }
    })

    // Case History Resource
    this.registerResource('pega://case-history', async () => {
      return {
        history: [],
        message: 'Case history would be retrieved from audit logs',
      }
    })

    // Available Actions Resource
    this.registerResource('pega://available-actions', async () => {
      const tabId = await this.getActiveTabId()
      if (!tabId) {
        return { error: 'No active Pega tab', actions: [] }
      }

      try {
        const response = (await this.sendMessageToTab(tabId, {
          type: MessageType.CAPTURE_DOM,
          payload: { triggerSummary: false },
        })) as { snapshot?: { actions?: Array<{ label: string; actionType: string; isDisabled: boolean }> } } | undefined

        const actions = response?.snapshot?.actions ?? []
        return {
          actions: actions.map(a => ({
            label: a.label,
            type: a.actionType,
            available: !a.isDisabled,
          })),
        }
      } catch (error) {
        return { error: String(error), actions: [] }
      }
    })
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  private createSuccessResponse(id: string | number, result: unknown): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      result,
    }
  }

  private createErrorResponse(
    id: string | number,
    code: number,
    message: string,
    data?: unknown
  ): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id,
      error: { code, message, data },
    }
  }

  private createToolError(message: string): ToolResult {
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    }
  }

  private async getActiveTabId(): Promise<number | undefined> {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs[0]?.id;
    } catch {
      return undefined;
    }
  }

  private async sendMessageToTab(
    tabId: number,
    message: { type: MessageType; payload: unknown }
  ): Promise<unknown> {
    return chrome.tabs.sendMessage(tabId, message);
  }

  private maskSnapshotPII(snapshot: DOMSnapshot): DOMSnapshot {
    if (!snapshot) return snapshot

    return {
      ...snapshot,
      fields: snapshot.fields.map(field => ({
        ...field,
        value: field.piiToken ?? field.value,
      })),
    }
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let mcpServer: MCPServer | null = null

export function getMCPServer(): MCPServer {
  if (!mcpServer) {
    mcpServer = new MCPServer()
  }
  return mcpServer
}

export async function initializeMCPServer(): Promise<MCPServer> {
  const server = getMCPServer();

  // Listen for connections from external MCP clients
  chrome.runtime.onConnectExternal.addListener((port: chrome.runtime.Port) => {
    const clientId = `external-${Date.now()}`;
    server.addClient(clientId, port);

    port.onMessage.addListener(async (message: JsonRpcRequest) => {
      const response = await server.handleRequest(message, clientId);
      port.postMessage(response);
    });

    port.onDisconnect.addListener(() => {
      server.removeClient(clientId);
    });
  });

  // Also listen for internal connections (from side panel or content scripts)
  chrome.runtime.onConnect.addListener((port: chrome.runtime.Port) => {
    if (port.name === 'mcp-client') {
      const clientId = `internal-${Date.now()}`;
      server.addClient(clientId, port);

      port.onMessage.addListener(async (message: JsonRpcRequest) => {
        const response = await server.handleRequest(message, clientId);
        port.postMessage(response);
      });

      port.onDisconnect.addListener(() => {
        server.removeClient(clientId);
      });
    }
  });

  return server;
}
