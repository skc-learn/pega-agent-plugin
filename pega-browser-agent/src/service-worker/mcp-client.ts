/**
 * MCP Client - Connect to External MCP Servers
 *
 * Provides client capabilities to connect to external MCP servers
 * and use their tools/resources from within the extension.
 */

import type {
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  MCPServerConfig,
  ServerCapabilities,
  Implementation,
  ToolDefinition,
  ToolCallParams,
  ToolResult,
  ListToolsResult,
  ListResourcesResult,
  ReadResourceParams,
  ReadResourceResult,
  ConnectionState,
  ServerConnection,
  InitializeResult,
  ClientCapabilities,
} from '../shared/mcp-types';
import {
  MCP_VERSION,
  MCPConnectionError,
  MCPError,
} from '../shared/mcp-types';

// ============================================================================
// CLIENT IMPLEMENTATION
// ============================================================================

/**
 * Generate unique request ID
 */
function generateRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * MCP Client for a single server connection
 */
export class MCPServerConnection {
  private config: MCPServerConfig;
  private state: ConnectionState = 'disconnected';
  private capabilities: ServerCapabilities | null = null;
  private serverInfo: Implementation | null = null;
  private requestId = 0;
  private pendingRequests = new Map<string | number, {
    resolve: (response: JsonRpcResponse) => void;
    reject: (error: Error) => void;
    timeout: ReturnType<typeof setTimeout>;
  }>();
  private socket: WebSocket | null = null;
  private lastError: string | null = null;
  private connectedAt: number | null = null;
  private messageQueue: JsonRpcRequest[] = [];

  constructor(config: MCPServerConfig) {
    this.config = config;
  }

  /**
   * Get current connection state
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Get server capabilities (after connection)
   */
  getCapabilities(): ServerCapabilities | null {
    return this.capabilities;
  }

  /**
   * Get server info (after connection)
   */
  getServerInfo(): Implementation | null {
    return this.serverInfo;
  }

  /**
   * Get connection info
   */
  getConnectionInfo(): ServerConnection {
    return {
      name: this.config.name,
      state: this.state,
      lastError: this.lastError ?? undefined,
      capabilities: this.capabilities ?? undefined,
      serverInfo: this.serverInfo ?? undefined,
      connectedAt: this.connectedAt ?? undefined,
    };
  }

  /**
   * Connect to the MCP server
   */
  async connect(): Promise<void> {
    if (this.state === 'connected') {
      return;
    }

    this.state = 'connecting';
    this.lastError = null;

    try {
      if (this.config.transport === 'websocket' && this.config.url) {
        await this.connectWebSocket(this.config.url);
      } else if (this.config.transport === 'http' && this.config.url) {
        // HTTP doesn't maintain connection, just verify server is reachable
        await this.verifyHttpServer(this.config.url);
      } else {
        throw new MCPConnectionError(
          `Unsupported transport: ${this.config.transport}`,
          this.config.name
        );
      }

      // Initialize the connection
      await this.initialize();

      this.state = 'connected';
      this.connectedAt = Date.now();

      // Process queued messages
      this.flushMessageQueue();
    } catch (error) {
      this.state = 'error';
      this.lastError = error instanceof Error ? error.message : String(error);
      throw error;
    }
  }

  /**
   * Disconnect from the server
   */
  async disconnect(): Promise<void> {
    if (this.socket) {
      this.socket.close();
      this.socket = null;
    }

    // Reject all pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new MCPConnectionError('Connection closed', this.config.name));
      this.pendingRequests.delete(id);
    }

    this.state = 'disconnected';
    this.capabilities = null;
    this.serverInfo = null;
    this.connectedAt = null;
  }

  /**
   * Send a request and wait for response
   */
  async request<T = unknown>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (this.state !== 'connected') {
      // Queue message if connecting
      if (this.state === 'connecting') {
        return new Promise((resolve, reject) => {
          const request: JsonRpcRequest = {
            jsonrpc: '2.0',
            id: generateRequestId(),
            method,
            params,
          };
          this.messageQueue.push(request);
          // Store callbacks for later
          this.pendingRequests.set(request.id, {
            resolve: (resp) => resolve(resp.result as T),
            reject,
            timeout: setTimeout(() => {
              reject(new MCPConnectionError('Request timeout', this.config.name));
            }, 30000),
          });
        });
      }
      throw new MCPConnectionError('Not connected', this.config.name);
    }

    const id = ++this.requestId;
    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new MCPConnectionError(`Request timeout: ${method}`, this.config.name));
      }, 30000);

      this.pendingRequests.set(id, {
        resolve: (response: JsonRpcResponse) => {
          if (response.error) {
            reject(new MCPError(
              response.error.message,
              response.error.code,
              response.error.data
            ));
          } else {
            resolve(response.result as T);
          }
        },
        reject,
        timeout,
      });

      this.sendRaw(request);
    });
  }

  /**
   * List available tools
   */
  async listTools(): Promise<ListToolsResult> {
    return this.request<ListToolsResult>('tools/list');
  }

  /**
   * Call a tool
   */
  async callTool(params: ToolCallParams): Promise<ToolResult> {
    return this.request<ToolResult>('tools/call', params as unknown as Record<string, unknown>);
  }

  /**
   * List available resources
   */
  async listResources(): Promise<ListResourcesResult> {
    return this.request<ListResourcesResult>('resources/list');
  }

  /**
   * Read a resource
   */
  async readResource(params: ReadResourceParams): Promise<ReadResourceResult> {
    return this.request<ReadResourceResult>('resources/read', params as unknown as Record<string, unknown>);
  }

  // ============================================================================
  // PRIVATE METHODS
  // ============================================================================

  private async connectWebSocket(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.socket = new WebSocket(url);

        this.socket.onopen = () => {
          resolve();
        };

        this.socket.onmessage = (event) => {
          this.handleMessage(event.data);
        };

        this.socket.onerror = () => {
          this.lastError = 'WebSocket error';
          reject(new MCPConnectionError('WebSocket connection failed', this.config.name));
        };

        this.socket.onclose = () => {
          this.state = 'disconnected';
          this.socket = null;
        };
      } catch (error) {
        reject(new MCPConnectionError(
          `Failed to create WebSocket: ${error}`,
          this.config.name
        ));
      }
    });
  }

  private async verifyHttpServer(url: string): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 0,
          method: 'ping',
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      throw new MCPConnectionError(
        `HTTP server verification failed: ${error}`,
        this.config.name
      );
    }
  }

  private async initialize(): Promise<void> {
    const clientCapabilities: ClientCapabilities = {
      roots: { listChanged: true },
    };

    const result = await this.sendRequestDirect<InitializeResult>({
      jsonrpc: '2.0',
      id: generateRequestId(),
      method: 'initialize',
      params: {
        protocolVersion: MCP_VERSION,
        capabilities: clientCapabilities,
        clientInfo: {
          name: 'pega-browser-agent',
          version: '1.0.0',
        },
      },
    });

    this.capabilities = result.capabilities;
    this.serverInfo = result.serverInfo;
  }

  private sendRequestDirect<T>(request: JsonRpcRequest): Promise<T> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(request.id);
        reject(new MCPConnectionError('Initialization timeout', this.config.name));
      }, 10000);

      this.pendingRequests.set(request.id, {
        resolve: (response: JsonRpcResponse) => {
          if (response.error) {
            reject(new MCPError(
              response.error.message,
              response.error.code,
              response.error.data
            ));
          } else {
            resolve(response.result as T);
          }
        },
        reject,
        timeout,
      });

      this.sendRaw(request);
    });
  }

  private sendRaw(message: JsonRpcRequest | JsonRpcNotification): void {
    const data = JSON.stringify(message);

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(data);
    } else if (this.config.transport === 'http' && this.config.url) {
      // HTTP transport - send via fetch
      this.sendHttp(this.config.url, data);
    }
  }

  private async sendHttp(url: string, data: string): Promise<void> {
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.config.headers,
        },
        body: data,
      });

      const responseData = await response.json();
      this.handleMessage(JSON.stringify(responseData));
    } catch (error) {
      console.error('[MCP] HTTP send error:', error);
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as JsonRpcResponse | JsonRpcNotification;

      if ('id' in message) {
        // Response to a request
        const pending = this.pendingRequests.get(message.id);
        if (pending) {
          clearTimeout(pending.timeout);
          pending.resolve(message as JsonRpcResponse);
          this.pendingRequests.delete(message.id);
        }
      } else {
        // Notification
        this.handleNotification(message as JsonRpcNotification);
      }
    } catch (error) {
      console.error('[MCP] Failed to parse message:', error);
    }
  }

  private handleNotification(notification: JsonRpcNotification): void {
    // Handle various notifications
    switch (notification.method) {
      case 'notifications/tools/list_changed':
        // Tools list changed - could emit event
        console.log('[MCP] Tools list changed');
        break;
      case 'notifications/resources/list_changed':
        // Resources list changed
        console.log('[MCP] Resources list changed');
        break;
      case 'notifications/resources/updated':
        // Resource updated
        console.log('[MCP] Resource updated:', notification.params);
        break;
      case 'notifications/message':
        // Logging message
        console.log('[MCP] Server message:', notification.params);
        break;
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0) {
      const request = this.messageQueue.shift();
      if (request) {
        this.sendRaw(request);
      }
    }
  }
}

// ============================================================================
// MCP CLIENT MANAGER
// ============================================================================

/**
 * Manages connections to multiple MCP servers
 */
export class MCPClientManager {
  private connections = new Map<string, MCPServerConnection>();
  private _config: { defaultTimeout: number };

  constructor() {
    this._config = { defaultTimeout: 30000 };
  }

  /**
   * Get the default timeout for operations
   */
  get defaultTimeout(): number {
    return this._config.defaultTimeout;
  }

  /**
   * Add a server configuration
   */
  addServer(config: MCPServerConfig): void {
    if (this.connections.has(config.name)) {
      throw new Error(`Server already exists: ${config.name}`);
    }
    this.connections.set(config.name, new MCPServerConnection(config));
  }

  /**
   * Remove a server
   */
  async removeServer(name: string): Promise<void> {
    const connection = this.connections.get(name);
    if (connection) {
      await connection.disconnect();
      this.connections.delete(name);
    }
  }

  /**
   * Connect to a specific server
   */
  async connect(name: string): Promise<ServerConnection> {
    const connection = this.connections.get(name);
    if (!connection) {
      throw new Error(`Server not found: ${name}`);
    }

    await connection.connect();
    return connection.getConnectionInfo();
  }

  /**
   * Connect to all servers
   */
  async connectAll(): Promise<ServerConnection[]> {
    const results: ServerConnection[] = [];

    for (const [name, connection] of this.connections) {
      try {
        await connection.connect();
      } catch (error) {
        console.error(`[MCP] Failed to connect to ${name}:`, error);
      }
      results.push(connection.getConnectionInfo());
    }

    return results;
  }

  /**
   * Disconnect from all servers
   */
  async disconnectAll(): Promise<void> {
    const promises = Array.from(this.connections.values()).map(c => c.disconnect());
    await Promise.all(promises);
  }

  /**
   * Get connection status for all servers
   */
  getStatus(): ServerConnection[] {
    return Array.from(this.connections.values()).map(c => c.getConnectionInfo());
  }

  /**
   * Get a connected server by name
   */
  getServer(name: string): MCPServerConnection | undefined {
    return this.connections.get(name);
  }

  /**
   * Call a tool on a specific server
   */
  async callTool(serverName: string, toolName: string, args: Record<string, unknown>): Promise<ToolResult> {
    const connection = this.connections.get(serverName);
    if (!connection) {
      throw new Error(`Server not found: ${serverName}`);
    }

    if (connection.getState() !== 'connected') {
      await connection.connect();
    }

    return connection.callTool({ name: toolName, arguments: args });
  }

  /**
   * List all tools from all connected servers
   */
  async listAllTools(): Promise<Map<string, ToolDefinition[]>> {
    const result = new Map<string, ToolDefinition[]>();

    for (const [name, connection] of this.connections) {
      if (connection.getState() === 'connected') {
        try {
          const tools = await connection.listTools();
          result.set(name, tools.tools);
        } catch (error) {
          console.error(`[MCP] Failed to list tools from ${name}:`, error);
        }
      }
    }

    return result;
  }

  /**
   * Find a tool across all servers
   */
  async findTool(toolName: string): Promise<{ serverName: string; tool: ToolDefinition } | null> {
    const allTools = await this.listAllTools();

    for (const [serverName, tools] of allTools) {
      const tool = tools.find(t => t.name === toolName);
      if (tool) {
        return { serverName, tool };
      }
    }

    return null;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let clientManager: MCPClientManager | null = null;

/**
 * Get the global MCP client manager
 */
export function getMCPClient(): MCPClientManager {
  if (!clientManager) {
    clientManager = new MCPClientManager();
  }
  return clientManager;
}

/**
 * Initialize MCP client with server configurations
 */
export async function initializeMCPClient(servers: MCPServerConfig[]): Promise<MCPClientManager> {
  const manager = getMCPClient();

  for (const server of servers) {
    if (server.enabled !== false) {
      manager.addServer(server);
    }
  }

  return manager;
}
