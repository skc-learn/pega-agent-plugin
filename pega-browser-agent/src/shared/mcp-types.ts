/**
 * MCP (Model Context Protocol) Types
 *
 * Type definitions for MCP protocol integration.
 * Based on MCP specification: https://modelcontextprotocol.io
 */

// ============================================================================
// MCP PROTOCOL VERSION
// ============================================================================

export const MCP_VERSION = '2024-11-05';

// ============================================================================
// JSON-RPC BASE TYPES
// ============================================================================

export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: JsonRpcError;
}

export interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}

export interface JsonRpcNotification {
  jsonrpc: '2.0';
  method: string;
  params?: Record<string, unknown>;
}

// ============================================================================
// MCP CAPABILITIES
// ============================================================================

export interface ClientCapabilities {
  experimental?: Record<string, unknown>;
  roots?: {
    listChanged?: boolean;
  };
  sampling?: Record<string, unknown>;
}

export interface ServerCapabilities {
  experimental?: Record<string, unknown>;
  tools?: {
    listChanged?: boolean;
  };
  resources?: {
    subscribe?: boolean;
    listChanged?: boolean;
  };
  prompts?: {
    listChanged?: boolean;
  };
  logging?: Record<string, unknown>;
}

// ============================================================================
// MCP IMPLEMENTATION INFO
// ============================================================================

export interface Implementation {
  name: string;
  version: string;
}

// ============================================================================
// MCP INITIALIZATION
// ============================================================================

export interface InitializeParams {
  protocolVersion: string;
  capabilities: ClientCapabilities;
  clientInfo: Implementation;
}

export interface InitializeResult {
  protocolVersion: string;
  capabilities: ServerCapabilities;
  serverInfo: Implementation;
  instructions?: string;
}

// ============================================================================
// MCP TOOLS
// ============================================================================

export interface ToolInputSchema {
  type: 'object';
  properties: Record<string, {
    type: string;
    description?: string;
    enum?: string[];
    default?: unknown;
  }>;
  required?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: ToolInputSchema;
}

export interface ToolCallParams {
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolResult {
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image'; data: string; mimeType: string }
    | { type: 'resource'; resource: ResourceContents }
  >;
  isError?: boolean;
}

export interface ListToolsResult {
  tools: ToolDefinition[];
  nextCursor?: string;
}

// ============================================================================
// MCP RESOURCES
// ============================================================================

export interface Resource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export interface ResourceContents {
  uri: string;
  mimeType?: string;
  text?: string;
  blob?: string; // Base64 encoded
}

export interface ListResourcesResult {
  resources: Resource[];
  nextCursor?: string;
}

export interface ReadResourceParams {
  uri: string;
}

export interface ReadResourceResult {
  contents: ResourceContents[];
}

// ============================================================================
// MCP PROMPTS
// ============================================================================

export interface PromptArgument {
  name: string;
  description?: string;
  required?: boolean;
}

export interface PromptDefinition {
  name: string;
  description?: string;
  arguments?: PromptArgument[];
}

export interface PromptMessage {
  role: 'user' | 'assistant';
  content: {
    type: 'text' | 'image' | 'resource';
    text?: string;
    data?: string;
    mimeType?: string;
  };
}

export interface GetPromptParams {
  name: string;
  arguments?: Record<string, string>;
}

export interface GetPromptResult {
  description?: string;
  messages: PromptMessage[];
}

export interface ListPromptsResult {
  prompts: PromptDefinition[];
  nextCursor?: string;
}

// ============================================================================
// MCP LOGGING
// ============================================================================

export type LogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

export interface SetLevelParams {
  level: LogLevel;
}

// ============================================================================
// MCP SERVER CONFIG
// ============================================================================

export interface MCPServerConfig {
  name: string;
  transport: 'stdio' | 'websocket' | 'http';
  command?: string; // For stdio
  args?: string[]; // For stdio
  url?: string; // For websocket/http
  headers?: Record<string, string>; // For http
  env?: Record<string, string>; // For stdio
  enabled?: boolean;
}

export interface MCPClientConfig {
  servers: MCPServerConfig[];
  defaultTimeout?: number;
  maxConcurrentRequests?: number;
}

// ============================================================================
// MCP CONNECTION STATE
// ============================================================================

export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error';

export interface ServerConnection {
  name: string;
  state: ConnectionState;
  lastError?: string;
  capabilities?: ServerCapabilities;
  serverInfo?: Implementation;
  connectedAt?: number;
}

// ============================================================================
// MCP ERRORS
// ============================================================================

export const MCP_ERROR_CODES = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // MCP-specific errors
  SERVER_NOT_INITIALIZED: -32002,
  UNKNOWN_ERROR: -32001,
  REQUEST_TIMEOUT: -32000,
} as const;

export class MCPError extends Error {
  constructor(
    message: string,
    public readonly code: number,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'MCPError';
  }
}

export class MCPConnectionError extends MCPError {
  constructor(message: string, public readonly serverName: string) {
    super(message, MCP_ERROR_CODES.INTERNAL_ERROR, { serverName });
    this.name = 'MCPConnectionError';
  }
}

export class MCPToolError extends MCPError {
  constructor(message: string, public readonly toolName: string, cause?: Error) {
    super(message, MCP_ERROR_CODES.INTERNAL_ERROR, { toolName, cause });
    this.name = 'MCPToolError';
  }
}

// ============================================================================
// PEGA-SPECIFIC MCP TYPES
// ============================================================================

/**
 * MCP Tool: Get Case Summary
 */
export const GET_CASE_SUMMARY_TOOL: ToolDefinition = {
  name: 'pega_get_case_summary',
  description: 'Get an AI-generated summary of the current Pega case including situation, history, and recommendations',
  inputSchema: {
    type: 'object',
    properties: {
      caseId: {
        type: 'string',
        description: 'Optional case ID. If not provided, uses the current case in the browser.',
      },
      includeRiskSignals: {
        type: 'boolean',
        description: 'Whether to include risk signal analysis',
        default: true,
      },
    },
  },
};

/**
 * MCP Tool: Execute Action Plan
 */
export const EXECUTE_PLAN_TOOL: ToolDefinition = {
  name: 'pega_execute_action_plan',
  description: 'Execute a sequence of browser automation actions on a Pega case',
  inputSchema: {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        description: 'Natural language command describing what to do (e.g., "Update the income field to 50000 and submit")',
      },
      autoConfirm: {
        type: 'boolean',
        description: 'Automatically confirm actions without user approval',
        default: false,
      },
    },
    required: ['command'],
  },
};

/**
 * MCP Tool: Get DOM Snapshot
 */
export const GET_DOM_SNAPSHOT_TOOL: ToolDefinition = {
  name: 'pega_get_dom_snapshot',
  description: 'Get a semantic snapshot of the current Pega UI including fields, actions, and case context',
  inputSchema: {
    type: 'object',
    properties: {
      includePII: {
        type: 'boolean',
        description: 'Whether to include PII data (will be masked by default)',
        default: false,
      },
    },
  },
};

/**
 * MCP Tool: Detect Pega Framework
 */
export const DETECT_PEGA_TOOL: ToolDefinition = {
  name: 'pega_detect_framework',
  description: 'Detect if the current page is a Pega application and identify the UI framework',
  inputSchema: {
    type: 'object',
    properties: {},
  },
};

/**
 * MCP Tool: Update Field
 */
export const UPDATE_FIELD_TOOL: ToolDefinition = {
  name: 'pega_update_field',
  description: 'Update a specific field in the current Pega case',
  inputSchema: {
    type: 'object',
    properties: {
      fieldLabel: {
        type: 'string',
        description: 'Label or test ID of the field to update',
      },
      value: {
        type: 'string',
        description: 'New value for the field',
      },
    },
    required: ['fieldLabel', 'value'],
  },
};

/**
 * MCP Tool: Click Action Button
 */
export const CLICK_ACTION_TOOL: ToolDefinition = {
  name: 'pega_click_action',
  description: 'Click an action button in the Pega UI',
  inputSchema: {
    type: 'object',
    properties: {
      actionLabel: {
        type: 'string',
        description: 'Label or test ID of the action button to click',
      },
      waitForResponse: {
        type: 'boolean',
        description: 'Wait for the action to complete',
        default: true,
      },
    },
    required: ['actionLabel'],
  },
};

/**
 * MCP Tool: Navigate Case
 */
export const NAVIGATE_CASE_TOOL: ToolDefinition = {
  name: 'pega_navigate_case',
  description: 'Navigate to a specific case or work queue in Pega',
  inputSchema: {
    type: 'object',
    properties: {
      target: {
        type: 'string',
        description: 'Case ID, URL, or queue name to navigate to',
      },
    },
    required: ['target'],
  },
};

/**
 * MCP Tool: Wait for Condition
 */
export const WAIT_FOR_TOOL: ToolDefinition = {
  name: 'pega_wait_for',
  description: 'Wait for a specific condition in the Pega UI',
  inputSchema: {
    type: 'object',
    properties: {
      condition: {
        type: 'string',
        enum: ['element', 'visible', 'enabled', 'hidden', 'text'],
        description: 'Type of condition to wait for',
      },
      selector: {
        type: 'string',
        description: 'CSS selector or test ID of the element',
      },
      expectedValue: {
        type: 'string',
        description: 'Expected value (for text condition)',
      },
      timeoutMs: {
        type: 'number',
        description: 'Maximum time to wait in milliseconds',
        default: 5000,
      },
    },
    required: ['condition', 'selector'],
  },
};

/**
 * All Pega MCP Tools
 */
export const PEGA_MCP_TOOLS: ToolDefinition[] = [
  GET_CASE_SUMMARY_TOOL,
  EXECUTE_PLAN_TOOL,
  GET_DOM_SNAPSHOT_TOOL,
  DETECT_PEGA_TOOL,
  UPDATE_FIELD_TOOL,
  CLICK_ACTION_TOOL,
  NAVIGATE_CASE_TOOL,
  WAIT_FOR_TOOL,
];

/**
 * MCP Resource: Current Case
 */
export const CURRENT_CASE_RESOURCE: Resource = {
  uri: 'pega://current-case',
  name: 'Current Pega Case',
  description: 'The currently open Pega case with all field values and metadata',
  mimeType: 'application/json',
};

/**
 * MCP Resource: Case History
 */
export const CASE_HISTORY_RESOURCE: Resource = {
  uri: 'pega://case-history',
  name: 'Case History',
  description: 'History of actions taken on the current case',
  mimeType: 'application/json',
};

/**
 * MCP Resource: Available Actions
 */
export const AVAILABLE_ACTIONS_RESOURCE: Resource = {
  uri: 'pega://available-actions',
  name: 'Available Actions',
  description: 'List of actions available for the current case',
  mimeType: 'application/json',
};

/**
 * All Pega MCP Resources
 */
export const PEGA_MCP_RESOURCES: Resource[] = [
  CURRENT_CASE_RESOURCE,
  CASE_HISTORY_RESOURCE,
  AVAILABLE_ACTIONS_RESOURCE,
];
