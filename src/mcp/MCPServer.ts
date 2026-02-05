/**
 * Model Context Protocol (MCP) - Server Implementation
 *
 * MCPServer cho phép tạo MCP server để cung cấp tools, resources, và prompts
 * cho các MCP clients (như Claude).
 *
 * @see https://modelcontextprotocol.io/
 */

import type {
  McpMessage,
  McpTransport,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcErrorCode,
  ClientCapabilities,
  ServerCapabilities,
  ImplementationInfo,
  InitializeResult,
  McpTool,
  ToolInputSchema,
  CallToolResult,
  ToolResultContent,
  McpResource,
  ResourceTemplate,
  ResourceContent,
  McpPrompt,
  PromptArgument,
  GetPromptResult,
  PromptMessage,
  LogLevel,
  ProgressToken,
} from './types';
import { JSONRPC_VERSION, MCP_PROTOCOL_VERSION, JsonRpcErrorCode as ErrorCode } from './types';

// ============================================================================
// Types for MCP Server
// ============================================================================

/**
 * Options để khởi tạo MCPServer
 */
export interface McpServerOptions {
  /** Thông tin về server implementation */
  serverInfo: ImplementationInfo;
  /** Capabilities mà server cung cấp */
  capabilities?: ServerCapabilities;
  /** Instructions cho việc sử dụng server (hiển thị cho LLM) */
  instructions?: string;
}

/**
 * Handler function cho tool call
 */
export type ToolHandler = (
  args: Record<string, unknown>
) => Promise<CallToolResult> | CallToolResult;

/**
 * Tool definition với handler
 */
export interface RegisteredTool {
  /** Định nghĩa tool theo MCP spec */
  definition: McpTool;
  /** Handler function để xử lý tool call */
  handler: ToolHandler;
}

/**
 * Handler function cho resource read
 */
export type ResourceHandler = (uri: string) => Promise<ResourceContent[]> | ResourceContent[];

/**
 * Resource definition với handler
 */
export interface RegisteredResource {
  /** Định nghĩa resource */
  definition: McpResource;
  /** Handler để đọc resource content */
  handler: ResourceHandler;
}

/**
 * Handler function cho prompt
 */
export type PromptHandler = (
  args: Record<string, string>
) => Promise<GetPromptResult> | GetPromptResult;

/**
 * Prompt definition với handler
 */
export interface RegisteredPrompt {
  /** Định nghĩa prompt */
  definition: McpPrompt;
  /** Handler để generate prompt messages */
  handler: PromptHandler;
}

/**
 * Server state
 */
export type ServerState = 'idle' | 'running' | 'error';

// ============================================================================
// MCP Server Implementation
// ============================================================================

/**
 * MCP Server - Tạo server để cung cấp tools, resources, prompts cho MCP clients
 *
 * @example
 * ```typescript
 * const server = new MCPServer({
 *   serverInfo: { name: 'my-server', version: '1.0.0' },
 *   capabilities: {
 *     tools: { listChanged: true },
 *     resources: { subscribe: true },
 *   },
 * });
 *
 * // Đăng ký tool
 * server.registerTool({
 *   name: 'get_weather',
 *   description: 'Get weather for a location',
 *   inputSchema: {
 *     type: 'object',
 *     properties: {
 *       location: { type: 'string', description: 'City name' },
 *     },
 *     required: ['location'],
 *   },
 * }, async (args) => {
 *   const weather = await fetchWeather(args.location);
 *   return {
 *     content: [{ type: 'text', text: JSON.stringify(weather) }],
 *   };
 * });
 *
 * // Start server với transport
 * await server.start(transport);
 * ```
 */
export class MCPServer {
  /** Thông tin về server */
  private readonly serverInfo: ImplementationInfo;
  /** Server capabilities */
  private readonly capabilities: ServerCapabilities;
  /** Instructions cho LLM */
  private readonly instructions?: string;

  /** Transport instance */
  private transport?: McpTransport;
  /** Client capabilities (sau khi initialize) */
  private clientCapabilities?: ClientCapabilities;
  /** Server state */
  private state: ServerState = 'idle';

  /** Registered tools */
  private tools = new Map<string, RegisteredTool>();
  /** Registered resources */
  private resources = new Map<string, RegisteredResource>();
  /** Resource templates */
  private resourceTemplates = new Map<string, ResourceTemplate>();
  /** Registered prompts */
  private prompts = new Map<string, RegisteredPrompt>();

  /** Resource subscriptions */
  private subscriptions = new Map<string, Set<string>>(); // uri -> subscriber IDs

  constructor(options: McpServerOptions) {
    this.serverInfo = options.serverInfo;
    this.capabilities = options.capabilities || {};
    this.instructions = options.instructions;
  }

  // ==========================================================================
  // Server Lifecycle
  // ==========================================================================

  /**
   * Start server với transport
   */
  async start(transport: McpTransport): Promise<void> {
    if (this.state === 'running') {
      throw new Error('Server already running');
    }

    this.transport = transport;

    // Setup message handler
    transport.onmessage = (message) => this.handleMessage(message);
    transport.onclose = () => this.handleClose();
    transport.onerror = (error) => this.handleError(error);

    // Start transport
    await transport.start();
    this.state = 'running';
  }

  /**
   * Stop server
   */
  async stop(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = undefined;
    }
    this.state = 'idle';
  }

  /**
   * Kiểm tra server đang chạy
   */
  isRunning(): boolean {
    return this.state === 'running';
  }

  // ==========================================================================
  // Tool Registration
  // ==========================================================================

  /**
   * Đăng ký tool mới
   *
   * @param definition - Định nghĩa tool theo MCP spec
   * @param handler - Handler function xử lý tool call
   */
  registerTool(definition: McpTool, handler: ToolHandler): void {
    this.tools.set(definition.name, { definition, handler });
    // Notify clients về tool list change
    this.notifyToolsChanged();
  }

  /**
   * Hủy đăng ký tool
   *
   * @param name - Tên tool
   */
  unregisterTool(name: string): boolean {
    const removed = this.tools.delete(name);
    if (removed) {
      this.notifyToolsChanged();
    }
    return removed;
  }

  /**
   * Helper: Đăng ký tool với simplified API
   */
  tool(
    name: string,
    description: string,
    schema: Omit<ToolInputSchema, 'type'>,
    handler: ToolHandler
  ): void {
    this.registerTool(
      {
        name,
        description,
        inputSchema: { type: 'object', ...schema },
      },
      handler
    );
  }

  // ==========================================================================
  // Resource Registration
  // ==========================================================================

  /**
   * Đăng ký resource mới
   *
   * @param definition - Định nghĩa resource
   * @param handler - Handler để đọc content
   */
  registerResource(definition: McpResource, handler: ResourceHandler): void {
    this.resources.set(definition.uri, { definition, handler });
    this.notifyResourcesChanged();
  }

  /**
   * Hủy đăng ký resource
   *
   * @param uri - URI của resource
   */
  unregisterResource(uri: string): boolean {
    const removed = this.resources.delete(uri);
    if (removed) {
      this.notifyResourcesChanged();
    }
    return removed;
  }

  /**
   * Đăng ký resource template
   *
   * @param template - Resource template definition
   */
  registerResourceTemplate(template: ResourceTemplate): void {
    this.resourceTemplates.set(template.uriTemplate, template);
    this.notifyResourcesChanged();
  }

  /**
   * Helper: Đăng ký resource với simplified API
   */
  resource(
    uri: string,
    name: string,
    handler: ResourceHandler,
    options?: { description?: string; mimeType?: string }
  ): void {
    this.registerResource(
      {
        uri,
        name,
        description: options?.description,
        mimeType: options?.mimeType,
      },
      handler
    );
  }

  /**
   * Notify clients rằng một resource đã được update
   *
   * @param uri - URI của resource đã update
   */
  notifyResourceUpdated(uri: string): void {
    if (this.capabilities.resources?.subscribe) {
      this.sendNotification('notifications/resources/updated', { uri });
    }
  }

  // ==========================================================================
  // Prompt Registration
  // ==========================================================================

  /**
   * Đăng ký prompt mới
   *
   * @param definition - Định nghĩa prompt
   * @param handler - Handler để generate prompt messages
   */
  registerPrompt(definition: McpPrompt, handler: PromptHandler): void {
    this.prompts.set(definition.name, { definition, handler });
    this.notifyPromptsChanged();
  }

  /**
   * Hủy đăng ký prompt
   *
   * @param name - Tên prompt
   */
  unregisterPrompt(name: string): boolean {
    const removed = this.prompts.delete(name);
    if (removed) {
      this.notifyPromptsChanged();
    }
    return removed;
  }

  /**
   * Helper: Đăng ký prompt với simplified API
   */
  prompt(
    name: string,
    description: string,
    args: PromptArgument[],
    handler: PromptHandler
  ): void {
    this.registerPrompt(
      {
        name,
        description,
        arguments: args,
      },
      handler
    );
  }

  // ==========================================================================
  // Logging & Progress
  // ==========================================================================

  /**
   * Gửi log message đến client
   *
   * @param level - Log level
   * @param data - Log data
   * @param logger - Logger name (optional)
   */
  log(level: LogLevel, data: unknown, logger?: string): void {
    if (this.capabilities.logging) {
      this.sendNotification('notifications/message', {
        level,
        logger,
        data,
      });
    }
  }

  /**
   * Gửi progress update đến client
   *
   * @param token - Progress token
   * @param progress - Current progress (0-1 hoặc giá trị tùy ý)
   * @param total - Total progress (optional)
   */
  progress(token: ProgressToken, progress: number, total?: number): void {
    this.sendNotification('notifications/progress', {
      progressToken: token,
      progress,
      total,
    });
  }

  // ==========================================================================
  // Private Methods - Message Handling
  // ==========================================================================

  /**
   * Xử lý message nhận được từ client
   */
  private handleMessage(message: McpMessage): void {
    // Chỉ xử lý requests (có id và method)
    if ('id' in message && 'method' in message) {
      this.handleRequest(message as JsonRpcRequest);
    }
  }

  /**
   * Xử lý request từ client
   */
  private async handleRequest(request: JsonRpcRequest): Promise<void> {
    const { id, method, params } = request;

    try {
      let result: unknown;

      switch (method) {
        case 'initialize':
          result = this.handleInitialize(params as {
            protocolVersion: string;
            capabilities: ClientCapabilities;
            clientInfo: ImplementationInfo;
          });
          break;

        case 'tools/list':
          result = this.handleListTools(params as { cursor?: string } | undefined);
          break;

        case 'tools/call':
          result = await this.handleCallTool(params as {
            name: string;
            arguments?: Record<string, unknown>;
          });
          break;

        case 'resources/list':
          result = this.handleListResources(params as { cursor?: string } | undefined);
          break;

        case 'resources/templates/list':
          result = this.handleListResourceTemplates(params as { cursor?: string } | undefined);
          break;

        case 'resources/read':
          result = await this.handleReadResource(params as { uri: string });
          break;

        case 'resources/subscribe':
          result = this.handleSubscribeResource(params as { uri: string });
          break;

        case 'resources/unsubscribe':
          result = this.handleUnsubscribeResource(params as { uri: string });
          break;

        case 'prompts/list':
          result = this.handleListPrompts(params as { cursor?: string } | undefined);
          break;

        case 'prompts/get':
          result = await this.handleGetPrompt(params as {
            name: string;
            arguments?: Record<string, string>;
          });
          break;

        case 'logging/setLevel':
          result = this.handleSetLogLevel(params as { level: LogLevel });
          break;

        default:
          this.sendErrorResponse(id, {
            code: ErrorCode.METHOD_NOT_FOUND,
            message: `Method not found: ${method}`,
          });
          return;
      }

      this.sendResponse(id, result);
    } catch (error) {
      this.sendErrorResponse(id, {
        code: ErrorCode.INTERNAL_ERROR,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  /**
   * Handle initialize request
   */
  private handleInitialize(params: {
    protocolVersion: string;
    capabilities: ClientCapabilities;
    clientInfo: ImplementationInfo;
  }): InitializeResult {
    this.clientCapabilities = params.capabilities;

    // Set protocol version trên transport nếu có
    this.transport?.setProtocolVersion?.(MCP_PROTOCOL_VERSION);

    return {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: this.capabilities,
      serverInfo: this.serverInfo,
      instructions: this.instructions,
    };
  }

  /**
   * Handle tools/list request
   */
  private handleListTools(params?: { cursor?: string }): {
    tools: McpTool[];
    nextCursor?: string;
  } {
    // Simple implementation - không có pagination
    const tools = Array.from(this.tools.values()).map((t) => t.definition);
    return { tools };
  }

  /**
   * Handle tools/call request
   */
  private async handleCallTool(params: {
    name: string;
    arguments?: Record<string, unknown>;
  }): Promise<CallToolResult> {
    const tool = this.tools.get(params.name);
    if (!tool) {
      throw new Error(`Tool not found: ${params.name}`);
    }

    try {
      return await tool.handler(params.arguments || {});
    } catch (error) {
      // Trả về error result thay vì throw
      return {
        content: [
          {
            type: 'text',
            text: `Error: ${error instanceof Error ? error.message : String(error)}`,
          },
        ],
        isError: true,
      };
    }
  }

  /**
   * Handle resources/list request
   */
  private handleListResources(params?: { cursor?: string }): {
    resources: McpResource[];
    nextCursor?: string;
  } {
    const resources = Array.from(this.resources.values()).map((r) => r.definition);
    return { resources };
  }

  /**
   * Handle resources/templates/list request
   */
  private handleListResourceTemplates(params?: { cursor?: string }): {
    resourceTemplates: ResourceTemplate[];
    nextCursor?: string;
  } {
    const resourceTemplates = Array.from(this.resourceTemplates.values());
    return { resourceTemplates };
  }

  /**
   * Handle resources/read request
   */
  private async handleReadResource(params: { uri: string }): Promise<{
    contents: ResourceContent[];
  }> {
    const resource = this.resources.get(params.uri);
    if (!resource) {
      throw new Error(`Resource not found: ${params.uri}`);
    }

    const contents = await resource.handler(params.uri);
    return { contents };
  }

  /**
   * Handle resources/subscribe request
   */
  private handleSubscribeResource(params: { uri: string }): void {
    if (!this.capabilities.resources?.subscribe) {
      throw new Error('Subscriptions not supported');
    }

    // Implement subscription logic
    // Đây là simplified - trong thực tế cần track subscriber ID
    if (!this.subscriptions.has(params.uri)) {
      this.subscriptions.set(params.uri, new Set());
    }
  }

  /**
   * Handle resources/unsubscribe request
   */
  private handleUnsubscribeResource(params: { uri: string }): void {
    this.subscriptions.delete(params.uri);
  }

  /**
   * Handle prompts/list request
   */
  private handleListPrompts(params?: { cursor?: string }): {
    prompts: McpPrompt[];
    nextCursor?: string;
  } {
    const prompts = Array.from(this.prompts.values()).map((p) => p.definition);
    return { prompts };
  }

  /**
   * Handle prompts/get request
   */
  private async handleGetPrompt(params: {
    name: string;
    arguments?: Record<string, string>;
  }): Promise<GetPromptResult> {
    const prompt = this.prompts.get(params.name);
    if (!prompt) {
      throw new Error(`Prompt not found: ${params.name}`);
    }

    return prompt.handler(params.arguments || {});
  }

  /**
   * Handle logging/setLevel request
   */
  private handleSetLogLevel(params: { level: LogLevel }): void {
    // Có thể implement log level filtering ở đây
    // Hiện tại chỉ accept request
  }

  /**
   * Handle transport close
   */
  private handleClose(): void {
    this.state = 'idle';
  }

  /**
   * Handle transport error
   */
  private handleError(error: Error): void {
    console.error('MCP Server transport error:', error);
    this.state = 'error';
  }

  // ==========================================================================
  // Private Methods - Send Messages
  // ==========================================================================

  /**
   * Gửi response cho request
   */
  private sendResponse(id: string | number, result: unknown): void {
    if (!this.transport) return;

    const response: JsonRpcResponse = {
      jsonrpc: JSONRPC_VERSION,
      id,
      result,
    };

    this.transport.send(response).catch((error) => {
      console.error('Failed to send response:', error);
    });
  }

  /**
   * Gửi error response
   */
  private sendErrorResponse(
    id: string | number,
    error: { code: JsonRpcErrorCode; message: string; data?: unknown }
  ): void {
    if (!this.transport) return;

    const response: JsonRpcResponse = {
      jsonrpc: JSONRPC_VERSION,
      id,
      error,
    };

    this.transport.send(response).catch((err) => {
      console.error('Failed to send error response:', err);
    });
  }

  /**
   * Gửi notification đến client
   */
  private sendNotification(method: string, params?: Record<string, unknown>): void {
    if (!this.transport) return;

    const notification: JsonRpcNotification = {
      jsonrpc: JSONRPC_VERSION,
      method,
      params,
    };

    this.transport.send(notification).catch((error) => {
      console.error('Failed to send notification:', error);
    });
  }

  /**
   * Notify clients khi tool list thay đổi
   */
  private notifyToolsChanged(): void {
    if (this.capabilities.tools?.listChanged && this.state === 'running') {
      this.sendNotification('notifications/tools/list_changed');
    }
  }

  /**
   * Notify clients khi resource list thay đổi
   */
  private notifyResourcesChanged(): void {
    if (this.capabilities.resources?.listChanged && this.state === 'running') {
      this.sendNotification('notifications/resources/list_changed');
    }
  }

  /**
   * Notify clients khi prompt list thay đổi
   */
  private notifyPromptsChanged(): void {
    if (this.capabilities.prompts?.listChanged && this.state === 'running') {
      this.sendNotification('notifications/prompts/list_changed');
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Tạo MCP server
 */
export function createMcpServer(options: McpServerOptions): MCPServer {
  return new MCPServer(options);
}

// ============================================================================
// Helper Functions cho Tool Results
// ============================================================================

/**
 * Tạo text tool result
 */
export function textResult(text: string, isError = false): CallToolResult {
  return {
    content: [{ type: 'text', text }],
    isError,
  };
}

/**
 * Tạo JSON tool result
 */
export function jsonResult(data: unknown, isError = false): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    isError,
  };
}

/**
 * Tạo image tool result
 */
export function imageResult(
  data: string,
  mimeType: string,
  isError = false
): CallToolResult {
  return {
    content: [{ type: 'image', data, mimeType }],
    isError,
  };
}

/**
 * Tạo error tool result
 */
export function errorResult(error: string | Error): CallToolResult {
  return {
    content: [
      {
        type: 'text',
        text: error instanceof Error ? error.message : error,
      },
    ],
    isError: true,
  };
}

// ============================================================================
// Helper Functions cho Prompt Results
// ============================================================================

/**
 * Tạo user message cho prompt
 */
export function userMessage(text: string): PromptMessage {
  return {
    role: 'user',
    content: { type: 'text', text },
  };
}

/**
 * Tạo assistant message cho prompt
 */
export function assistantMessage(text: string): PromptMessage {
  return {
    role: 'assistant',
    content: { type: 'text', text },
  };
}
