/**
 * Model Context Protocol (MCP) - Client Implementation
 *
 * MCPClient là class chính để connect và tương tác với MCP servers.
 * Nó xử lý:
 * - Khởi tạo kết nối (initialize handshake)
 * - Gọi tools
 * - Đọc resources
 * - Lấy prompts
 * - Quản lý subscriptions
 *
 * @see https://modelcontextprotocol.io/
 */

import type {
  McpMessage,
  McpTransport,
  JsonRpcRequest,
  JsonRpcResponse,
  JsonRpcNotification,
  JsonRpcError,
  JsonRpcErrorCode,
  ClientCapabilities,
  ServerCapabilities,
  ImplementationInfo,
  InitializeRequest,
  InitializeResult,
  McpTool,
  ListToolsResult,
  CallToolRequest,
  CallToolResult,
  McpResource,
  ListResourcesResult,
  ResourceTemplate,
  ListResourceTemplatesResult,
  ResourceContent,
  ReadResourceResult,
  McpPrompt,
  ListPromptsResult,
  GetPromptResult,
  PromptMessage,
  LogLevel,
  Root,
  ListRootsResult,
  ProgressToken,
} from './types';
import { JSONRPC_VERSION, MCP_PROTOCOL_VERSION, createRequestId } from './types';

// ============================================================================
// Types for MCP Client
// ============================================================================

/**
 * Options để khởi tạo MCPClient
 */
export interface McpClientOptions {
  /** Thông tin về client implementation */
  clientInfo: ImplementationInfo;
  /** Capabilities mà client hỗ trợ */
  capabilities?: ClientCapabilities;
  /** Timeout cho requests (ms) */
  requestTimeout?: number;
}

/**
 * Pending request đang chờ response
 */
interface PendingRequest {
  /** Resolve promise với result */
  resolve: (result: unknown) => void;
  /** Reject promise với error */
  reject: (error: Error) => void;
  /** Timeout handle */
  timeout: NodeJS.Timeout;
  /** Tên method (để debug) */
  method: string;
}

/**
 * Event types cho MCPClient
 */
export interface McpClientEvents {
  /** Server gửi log message */
  log: (level: LogLevel, logger: string | undefined, data: unknown) => void;
  /** Danh sách tools đã thay đổi */
  toolsChanged: () => void;
  /** Danh sách resources đã thay đổi */
  resourcesChanged: () => void;
  /** Resource được cập nhật */
  resourceUpdated: (uri: string) => void;
  /** Danh sách prompts đã thay đổi */
  promptsChanged: () => void;
  /** Progress update */
  progress: (token: ProgressToken, progress: number, total?: number) => void;
  /** Connection closed */
  closed: () => void;
  /** Error occurred */
  error: (error: Error) => void;
}

/**
 * Callback type cho events
 */
type EventCallback<K extends keyof McpClientEvents> = McpClientEvents[K];

// ============================================================================
// MCP Client Errors
// ============================================================================

/**
 * Error khi MCP request fails
 */
export class McpError extends Error {
  constructor(
    message: string,
    public readonly code?: JsonRpcErrorCode,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'McpError';
  }

  /**
   * Tạo McpError từ JsonRpcError
   */
  static fromJsonRpcError(error: JsonRpcError): McpError {
    return new McpError(error.message, error.code, error.data);
  }
}

/**
 * Error khi request timeout
 */
export class McpTimeoutError extends McpError {
  constructor(method: string, timeout: number) {
    super(`Request "${method}" timed out after ${timeout}ms`);
    this.name = 'McpTimeoutError';
  }
}

/**
 * Error khi client chưa được khởi tạo
 */
export class McpNotInitializedError extends McpError {
  constructor() {
    super('MCP client not initialized. Call connect() first.');
    this.name = 'McpNotInitializedError';
  }
}

// ============================================================================
// MCP Client Implementation
// ============================================================================

/**
 * Default request timeout (ms)
 */
const DEFAULT_REQUEST_TIMEOUT = 30_000;

/**
 * MCP Client - Client để connect và tương tác với MCP servers
 *
 * @example
 * ```typescript
 * import { MCPClient } from './MCPClient';
 * import { StdioTransport } from './Transport';
 *
 * // Tạo transport
 * const transport = new StdioTransport({
 *   command: 'node',
 *   args: ['./my-mcp-server.js'],
 * });
 *
 * // Tạo client
 * const client = new MCPClient({
 *   clientInfo: { name: 'my-client', version: '1.0.0' },
 *   capabilities: { roots: { listChanged: true } },
 * });
 *
 * // Connect đến server
 * await client.connect(transport);
 *
 * // Liệt kê tools
 * const tools = await client.listTools();
 * console.log('Available tools:', tools);
 *
 * // Gọi tool
 * const result = await client.callTool('my-tool', { arg1: 'value1' });
 * console.log('Tool result:', result);
 *
 * // Đóng kết nối
 * await client.disconnect();
 * ```
 */
export class MCPClient {
  /** Thông tin về client */
  private readonly clientInfo: ImplementationInfo;
  /** Client capabilities */
  private readonly capabilities: ClientCapabilities;
  /** Request timeout (ms) */
  private readonly requestTimeout: number;

  /** Transport instance */
  private transport?: McpTransport;
  /** Server capabilities (sau khi initialize) */
  private serverCapabilities?: ServerCapabilities;
  /** Server info (sau khi initialize) */
  private serverInfo?: ImplementationInfo;
  /** Đã initialize thành công chưa */
  private initialized = false;

  /** Pending requests đang chờ response */
  private pendingRequests = new Map<string | number, PendingRequest>();
  /** Request ID counter */
  private nextRequestId = 1;

  /** Event listeners */
  private eventListeners = new Map<keyof McpClientEvents, Set<EventCallback<any>>>();

  constructor(options: McpClientOptions) {
    this.clientInfo = options.clientInfo;
    this.capabilities = options.capabilities || {};
    this.requestTimeout = options.requestTimeout ?? DEFAULT_REQUEST_TIMEOUT;
  }

  // ==========================================================================
  // Connection Management
  // ==========================================================================

  /**
   * Connect đến MCP server và thực hiện initialize handshake
   *
   * @param transport - Transport instance để giao tiếp với server
   * @returns Server capabilities và info
   */
  async connect(transport: McpTransport): Promise<InitializeResult> {
    if (this.initialized) {
      throw new Error('Client already connected');
    }

    this.transport = transport;

    // Setup message handler
    transport.onmessage = (message) => this.handleMessage(message);
    transport.onclose = () => this.handleClose();
    transport.onerror = (error) => this.handleError(error);

    // Start transport
    await transport.start();

    // Thực hiện initialize handshake
    const result = await this.initialize();

    // Gửi initialized notification
    await this.sendNotification('notifications/initialized', {});

    this.initialized = true;

    return result;
  }

  /**
   * Disconnect khỏi MCP server
   */
  async disconnect(): Promise<void> {
    if (this.transport) {
      await this.transport.close();
      this.transport = undefined;
    }

    // Cancel tất cả pending requests
    for (const [id, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Client disconnected'));
    }
    this.pendingRequests.clear();

    this.initialized = false;
    this.serverCapabilities = undefined;
    this.serverInfo = undefined;
  }

  /**
   * Kiểm tra client đã được khởi tạo chưa
   */
  isConnected(): boolean {
    return this.initialized;
  }

  /**
   * Lấy server capabilities
   */
  getServerCapabilities(): ServerCapabilities | undefined {
    return this.serverCapabilities;
  }

  /**
   * Lấy server info
   */
  getServerInfo(): ImplementationInfo | undefined {
    return this.serverInfo;
  }

  // ==========================================================================
  // Tool Methods
  // ==========================================================================

  /**
   * Liệt kê tất cả tools có sẵn từ server
   *
   * @param cursor - Cursor cho pagination (optional)
   * @returns Danh sách tools và cursor cho trang tiếp theo
   */
  async listTools(cursor?: string): Promise<ListToolsResult> {
    this.ensureInitialized();
    return this.sendRequest<ListToolsResult>('tools/list', cursor ? { cursor } : undefined);
  }

  /**
   * Lấy tất cả tools (auto-pagination)
   *
   * @returns Danh sách tất cả tools
   */
  async getAllTools(): Promise<McpTool[]> {
    const allTools: McpTool[] = [];
    let cursor: string | undefined;

    do {
      const result = await this.listTools(cursor);
      allTools.push(...result.tools);
      cursor = result.nextCursor;
    } while (cursor);

    return allTools;
  }

  /**
   * Gọi một tool
   *
   * @param name - Tên tool cần gọi
   * @param args - Arguments cho tool
   * @returns Kết quả từ tool
   */
  async callTool(name: string, args?: Record<string, unknown>): Promise<CallToolResult> {
    this.ensureInitialized();
    return this.sendRequest<CallToolResult>('tools/call', {
      name,
      arguments: args,
    });
  }

  // ==========================================================================
  // Resource Methods
  // ==========================================================================

  /**
   * Liệt kê resources có sẵn
   *
   * @param cursor - Cursor cho pagination
   * @returns Danh sách resources
   */
  async listResources(cursor?: string): Promise<ListResourcesResult> {
    this.ensureInitialized();
    return this.sendRequest<ListResourcesResult>(
      'resources/list',
      cursor ? { cursor } : undefined
    );
  }

  /**
   * Lấy tất cả resources (auto-pagination)
   */
  async getAllResources(): Promise<McpResource[]> {
    const allResources: McpResource[] = [];
    let cursor: string | undefined;

    do {
      const result = await this.listResources(cursor);
      allResources.push(...result.resources);
      cursor = result.nextCursor;
    } while (cursor);

    return allResources;
  }

  /**
   * Liệt kê resource templates
   *
   * @param cursor - Cursor cho pagination
   * @returns Danh sách resource templates
   */
  async listResourceTemplates(cursor?: string): Promise<ListResourceTemplatesResult> {
    this.ensureInitialized();
    return this.sendRequest<ListResourceTemplatesResult>(
      'resources/templates/list',
      cursor ? { cursor } : undefined
    );
  }

  /**
   * Đọc nội dung của một resource
   *
   * @param uri - URI của resource
   * @returns Nội dung resource
   */
  async readResource(uri: string): Promise<ResourceContent[]> {
    this.ensureInitialized();
    const result = await this.sendRequest<ReadResourceResult>('resources/read', { uri });
    return result.contents;
  }

  /**
   * Subscribe vào resource để nhận updates
   *
   * @param uri - URI của resource
   */
  async subscribeResource(uri: string): Promise<void> {
    this.ensureInitialized();
    await this.sendRequest<void>('resources/subscribe', { uri });
  }

  /**
   * Unsubscribe khỏi resource
   *
   * @param uri - URI của resource
   */
  async unsubscribeResource(uri: string): Promise<void> {
    this.ensureInitialized();
    await this.sendRequest<void>('resources/unsubscribe', { uri });
  }

  // ==========================================================================
  // Prompt Methods
  // ==========================================================================

  /**
   * Liệt kê prompts có sẵn
   *
   * @param cursor - Cursor cho pagination
   * @returns Danh sách prompts
   */
  async listPrompts(cursor?: string): Promise<ListPromptsResult> {
    this.ensureInitialized();
    return this.sendRequest<ListPromptsResult>('prompts/list', cursor ? { cursor } : undefined);
  }

  /**
   * Lấy tất cả prompts (auto-pagination)
   */
  async getAllPrompts(): Promise<McpPrompt[]> {
    const allPrompts: McpPrompt[] = [];
    let cursor: string | undefined;

    do {
      const result = await this.listPrompts(cursor);
      allPrompts.push(...result.prompts);
      cursor = result.nextCursor;
    } while (cursor);

    return allPrompts;
  }

  /**
   * Lấy prompt với arguments
   *
   * @param name - Tên prompt
   * @param args - Arguments cho prompt
   * @returns Prompt messages
   */
  async getPrompt(name: string, args?: Record<string, string>): Promise<GetPromptResult> {
    this.ensureInitialized();
    return this.sendRequest<GetPromptResult>('prompts/get', {
      name,
      arguments: args,
    });
  }

  // ==========================================================================
  // Logging Methods
  // ==========================================================================

  /**
   * Set log level của server
   *
   * @param level - Log level mới
   */
  async setLogLevel(level: LogLevel): Promise<void> {
    this.ensureInitialized();
    await this.sendRequest<void>('logging/setLevel', { level });
  }

  // ==========================================================================
  // Roots Methods (Server requests này từ client)
  // ==========================================================================

  /**
   * Cung cấp roots cho server
   * Đây là response cho request từ server
   *
   * @param requestId - ID của request từ server
   * @param roots - Danh sách roots
   */
  async provideRoots(requestId: string | number, roots: Root[]): Promise<void> {
    await this.sendResponse(requestId, { roots });
  }

  // ==========================================================================
  // Event Handling
  // ==========================================================================

  /**
   * Đăng ký event listener
   *
   * @param event - Tên event
   * @param callback - Callback function
   */
  on<K extends keyof McpClientEvents>(event: K, callback: EventCallback<K>): void {
    if (!this.eventListeners.has(event)) {
      this.eventListeners.set(event, new Set());
    }
    this.eventListeners.get(event)!.add(callback);
  }

  /**
   * Hủy đăng ký event listener
   *
   * @param event - Tên event
   * @param callback - Callback function
   */
  off<K extends keyof McpClientEvents>(event: K, callback: EventCallback<K>): void {
    this.eventListeners.get(event)?.delete(callback);
  }

  /**
   * Emit event đến tất cả listeners
   */
  private emit<K extends keyof McpClientEvents>(
    event: K,
    ...args: Parameters<McpClientEvents[K]>
  ): void {
    const listeners = this.eventListeners.get(event);
    if (listeners) {
      for (const callback of listeners) {
        try {
          (callback as (...args: unknown[]) => void)(...args);
        } catch (error) {
          console.error(`Error in event listener for "${event}":`, error);
        }
      }
    }
  }

  // ==========================================================================
  // Private Methods - Message Handling
  // ==========================================================================

  /**
   * Xử lý message nhận được từ transport
   */
  private handleMessage(message: McpMessage): void {
    // Kiểm tra nếu là response (có id và không có method)
    if ('id' in message && !('method' in message)) {
      this.handleResponse(message as JsonRpcResponse);
      return;
    }

    // Kiểm tra nếu là notification (có method nhưng không có id)
    if ('method' in message && !('id' in message)) {
      this.handleNotification(message as JsonRpcNotification);
      return;
    }

    // Kiểm tra nếu là request từ server (có cả id và method)
    if ('id' in message && 'method' in message) {
      this.handleServerRequest(message as JsonRpcRequest);
      return;
    }
  }

  /**
   * Xử lý response từ server
   */
  private handleResponse(response: JsonRpcResponse): void {
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      console.warn(`Received response for unknown request: ${response.id}`);
      return;
    }

    // Clear timeout và remove từ pending
    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.id);

    // Resolve hoặc reject promise
    if (response.error) {
      pending.reject(McpError.fromJsonRpcError(response.error));
    } else {
      pending.resolve(response.result);
    }
  }

  /**
   * Xử lý notification từ server
   */
  private handleNotification(notification: JsonRpcNotification): void {
    const { method, params } = notification;

    switch (method) {
      case 'notifications/message':
        // Log message từ server
        const { level, logger, data } = params as { level: LogLevel; logger?: string; data: unknown };
        this.emit('log', level, logger, data);
        break;

      case 'notifications/tools/list_changed':
        this.emit('toolsChanged');
        break;

      case 'notifications/resources/list_changed':
        this.emit('resourcesChanged');
        break;

      case 'notifications/resources/updated':
        const { uri } = params as { uri: string };
        this.emit('resourceUpdated', uri);
        break;

      case 'notifications/prompts/list_changed':
        this.emit('promptsChanged');
        break;

      case 'notifications/progress':
        const { progressToken, progress, total } = params as {
          progressToken: ProgressToken;
          progress: number;
          total?: number;
        };
        this.emit('progress', progressToken, progress, total);
        break;

      default:
        console.warn(`Unknown notification method: ${method}`);
    }
  }

  /**
   * Xử lý request từ server (ví dụ: roots/list, sampling/createMessage)
   */
  private handleServerRequest(request: JsonRpcRequest): void {
    const { id, method, params } = request;

    switch (method) {
      case 'roots/list':
        // Server muốn biết roots của client
        // Emit event để application có thể respond
        // Default: trả về empty list
        this.sendResponse(id, { roots: [] });
        break;

      case 'sampling/createMessage':
        // Server muốn client tạo LLM completion
        // Đây là advanced feature, cần được implement bởi application
        this.sendErrorResponse(id, {
          code: -32601, // Method not found
          message: 'Sampling not supported by this client',
        });
        break;

      default:
        this.sendErrorResponse(id, {
          code: -32601,
          message: `Unknown method: ${method}`,
        });
    }
  }

  /**
   * Handle transport close
   */
  private handleClose(): void {
    this.initialized = false;
    this.emit('closed');
  }

  /**
   * Handle transport error
   */
  private handleError(error: Error): void {
    this.emit('error', error);
  }

  // ==========================================================================
  // Private Methods - Request/Response
  // ==========================================================================

  /**
   * Thực hiện initialize handshake với server
   */
  private async initialize(): Promise<InitializeResult> {
    const result = await this.sendRequest<InitializeResult>('initialize', {
      protocolVersion: MCP_PROTOCOL_VERSION,
      capabilities: this.capabilities,
      clientInfo: this.clientInfo,
    });

    // Lưu server info
    this.serverCapabilities = result.capabilities;
    this.serverInfo = result.serverInfo;

    // Set protocol version cho transport
    this.transport?.setProtocolVersion?.(result.protocolVersion);

    return result;
  }

  /**
   * Gửi JSON-RPC request và chờ response
   */
  private async sendRequest<T>(method: string, params?: Record<string, unknown>): Promise<T> {
    if (!this.transport) {
      throw new McpNotInitializedError();
    }

    const id = this.nextRequestId++;

    const request: JsonRpcRequest = {
      jsonrpc: JSONRPC_VERSION,
      id,
      method,
      params,
    };

    return new Promise<T>((resolve, reject) => {
      // Setup timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new McpTimeoutError(method, this.requestTimeout));
      }, this.requestTimeout);

      // Track pending request
      this.pendingRequests.set(id, {
        resolve: resolve as (result: unknown) => void,
        reject,
        timeout,
        method,
      });

      // Gửi request
      this.transport!.send(request).catch((error) => {
        clearTimeout(timeout);
        this.pendingRequests.delete(id);
        reject(error);
      });
    });
  }

  /**
   * Gửi JSON-RPC notification (không cần response)
   */
  private async sendNotification(method: string, params?: Record<string, unknown>): Promise<void> {
    if (!this.transport) {
      throw new McpNotInitializedError();
    }

    const notification: JsonRpcNotification = {
      jsonrpc: JSONRPC_VERSION,
      method,
      params,
    };

    await this.transport.send(notification);
  }

  /**
   * Gửi response cho request từ server
   */
  private async sendResponse(id: string | number, result: unknown): Promise<void> {
    if (!this.transport) {
      return;
    }

    const response: JsonRpcResponse = {
      jsonrpc: JSONRPC_VERSION,
      id,
      result,
    };

    await this.transport.send(response);
  }

  /**
   * Gửi error response cho request từ server
   */
  private async sendErrorResponse(
    id: string | number,
    error: { code: number; message: string; data?: unknown }
  ): Promise<void> {
    if (!this.transport) {
      return;
    }

    const response: JsonRpcResponse = {
      jsonrpc: JSONRPC_VERSION,
      id,
      error: {
        code: error.code as JsonRpcErrorCode,
        message: error.message,
        data: error.data,
      },
    };

    await this.transport.send(response);
  }

  /**
   * Đảm bảo client đã được khởi tạo
   */
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new McpNotInitializedError();
    }
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Tạo MCP client với default options
 */
export function createMcpClient(options: McpClientOptions): MCPClient {
  return new MCPClient(options);
}
