/**
 * Model Context Protocol (MCP) - Transport Layer
 *
 * Transport layer cung cấp các cách thức giao tiếp khác nhau cho MCP:
 * - Stdio: Giao tiếp qua stdin/stdout với subprocess
 * - SSE: Server-Sent Events qua HTTP
 * - Streamable HTTP: HTTP streaming với session support
 *
 * @see https://modelcontextprotocol.io/docs/concepts/transports
 */

import type {
  McpMessage,
  McpTransport,
  TransportOptions,
  TransportEventHandlers,
  TransportState,
} from './types';
import { JSONRPC_VERSION } from './types';

// ============================================================================
// Base Transport Class - Class cơ sở cho tất cả transports
// ============================================================================

/**
 * Options mặc định cho transport
 */
const DEFAULT_TRANSPORT_OPTIONS: Required<TransportOptions> = {
  timeout: 30_000,      // 30 giây timeout
  maxRetries: 3,        // 3 lần retry
  retryDelay: 1_000,    // 1 giây delay ban đầu
  maxRetryDelay: 30_000, // Max 30 giây delay
};

/**
 * Base class cho tất cả MCP transports
 *
 * Cung cấp các functionality chung:
 * - Event handling
 * - Retry logic với exponential backoff
 * - Timeout management
 */
export abstract class BaseTransport implements McpTransport {
  /** Options đã merged với defaults */
  protected readonly options: Required<TransportOptions>;
  /** Trạng thái hiện tại của transport */
  protected state: TransportState = 'disconnected';
  /** Protocol version để gửi trong headers */
  protected protocolVersion?: string;

  // Event handlers
  onmessage?: (message: McpMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;

  constructor(options: TransportOptions = {}) {
    this.options = {
      ...DEFAULT_TRANSPORT_OPTIONS,
      ...options,
    };
  }

  /**
   * Bắt đầu transport - phải được implement bởi subclass
   */
  abstract start(): Promise<void>;

  /**
   * Đóng transport - phải được implement bởi subclass
   */
  abstract close(): Promise<void>;

  /**
   * Gửi message - phải được implement bởi subclass
   */
  abstract send(message: McpMessage): Promise<void>;

  /**
   * Set protocol version (dùng trong headers)
   */
  setProtocolVersion(version: string): void {
    this.protocolVersion = version;
  }

  /**
   * Lấy trạng thái hiện tại
   */
  getState(): TransportState {
    return this.state;
  }

  /**
   * Tính delay cho retry với exponential backoff
   */
  protected calculateRetryDelay(attempt: number): number {
    const { retryDelay, maxRetryDelay } = this.options;
    // Exponential backoff: delay * 2^attempt
    const delay = retryDelay * Math.pow(2, attempt);
    return Math.min(delay, maxRetryDelay);
  }

  /**
   * Sleep utility
   */
  protected sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Emit message event
   */
  protected emitMessage(message: McpMessage): void {
    this.onmessage?.(message);
  }

  /**
   * Emit close event
   */
  protected emitClose(): void {
    this.state = 'disconnected';
    this.onclose?.();
  }

  /**
   * Emit error event
   */
  protected emitError(error: Error): void {
    this.state = 'error';
    this.onerror?.(error);
  }
}

// ============================================================================
// Stdio Transport - Giao tiếp qua stdin/stdout
// ============================================================================

/**
 * Options cho Stdio transport
 */
export interface StdioTransportOptions extends TransportOptions {
  /** Command để chạy server */
  command: string;
  /** Arguments cho command */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** Working directory */
  cwd?: string;
}

/**
 * Stdio Transport - Giao tiếp với MCP server qua subprocess
 *
 * Đây là transport phổ biến nhất cho local MCP servers.
 * Server được spawn như subprocess và giao tiếp qua stdin/stdout.
 *
 * @example
 * ```typescript
 * const transport = new StdioTransport({
 *   command: 'node',
 *   args: ['./mcp-server.js'],
 * });
 *
 * await transport.start();
 * await transport.send({ jsonrpc: '2.0', method: 'initialize', ... });
 * ```
 */
export class StdioTransport extends BaseTransport {
  private readonly command: string;
  private readonly args: string[];
  private readonly env?: Record<string, string>;
  private readonly cwd?: string;

  /** Child process handle */
  private process?: import('child_process').ChildProcess;
  /** Buffer để accumulate partial messages */
  private inputBuffer = '';

  constructor(options: StdioTransportOptions) {
    super(options);
    this.command = options.command;
    this.args = options.args || [];
    this.env = options.env;
    this.cwd = options.cwd;
  }

  /**
   * Start stdio transport - spawn subprocess
   */
  async start(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    this.state = 'connecting';

    try {
      // Import child_process dynamically (Node.js only)
      const { spawn } = await import('child_process');

      // Spawn server process
      this.process = spawn(this.command, this.args, {
        env: {
          ...process.env,
          ...this.env,
        },
        cwd: this.cwd,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      // Handle stdout - nhận messages từ server
      this.process.stdout?.on('data', (data: Buffer) => {
        this.handleData(data.toString('utf-8'));
      });

      // Handle stderr - log ra console
      this.process.stderr?.on('data', (data: Buffer) => {
        console.error(`[MCP Server ${this.command}] ${data.toString('utf-8')}`);
      });

      // Handle process exit
      this.process.on('exit', (code, signal) => {
        if (code !== 0 && code !== null) {
          this.emitError(new Error(`MCP server exited with code ${code}`));
        } else if (signal) {
          this.emitError(new Error(`MCP server killed by signal ${signal}`));
        }
        this.emitClose();
      });

      // Handle spawn errors
      this.process.on('error', (error) => {
        this.emitError(error);
        this.emitClose();
      });

      this.state = 'connected';
    } catch (error) {
      this.state = 'error';
      throw error;
    }
  }

  /**
   * Close stdio transport - kill subprocess
   */
  async close(): Promise<void> {
    if (this.process) {
      this.process.kill('SIGTERM');
      this.process = undefined;
    }
    this.inputBuffer = '';
    this.emitClose();
  }

  /**
   * Gửi message đến server qua stdin
   */
  async send(message: McpMessage): Promise<void> {
    if (!this.process?.stdin) {
      throw new Error('Transport not connected');
    }

    // Serialize message thành JSON và gửi với newline delimiter
    const data = JSON.stringify(message) + '\n';

    return new Promise((resolve, reject) => {
      this.process!.stdin!.write(data, 'utf-8', (error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Xử lý dữ liệu nhận được từ stdout
   * Messages được phân tách bằng newline
   */
  private handleData(data: string): void {
    this.inputBuffer += data;

    // Tìm và xử lý từng message (phân tách bằng newline)
    let newlineIndex: number;
    while ((newlineIndex = this.inputBuffer.indexOf('\n')) !== -1) {
      const line = this.inputBuffer.substring(0, newlineIndex);
      this.inputBuffer = this.inputBuffer.substring(newlineIndex + 1);

      if (line.trim()) {
        try {
          const message = JSON.parse(line) as McpMessage;
          this.emitMessage(message);
        } catch (error) {
          // Log parse errors nhưng không emit error
          console.error('Failed to parse MCP message:', error, 'Line:', line);
        }
      }
    }
  }
}

// ============================================================================
// SSE Transport - Server-Sent Events
// ============================================================================

/**
 * Options cho SSE transport
 */
export interface SseTransportOptions extends TransportOptions {
  /** URL của MCP server */
  url: string;
  /** Authorization token (optional) */
  authToken?: string;
  /** Additional headers */
  headers?: Record<string, string>;
}

/**
 * SSE Transport - Giao tiếp qua Server-Sent Events
 *
 * Dùng cho remote MCP servers qua HTTP.
 * Server gửi events qua SSE, client gửi requests qua POST.
 *
 * @example
 * ```typescript
 * const transport = new SseTransport({
 *   url: 'https://mcp-server.example.com',
 *   authToken: 'your-token',
 * });
 *
 * await transport.start();
 * ```
 */
export class SseTransport extends BaseTransport {
  private readonly url: URL;
  private readonly authToken?: string;
  private readonly customHeaders: Record<string, string>;

  /** EventSource instance */
  private eventSource?: EventSource;
  /** Endpoint URL để POST messages */
  private endpoint?: URL;
  /** Abort controller cho requests */
  private abortController?: AbortController;

  constructor(options: SseTransportOptions) {
    super(options);
    this.url = new URL(options.url);
    this.authToken = options.authToken;
    this.customHeaders = options.headers || {};
  }

  /**
   * Start SSE transport - connect đến server
   */
  async start(): Promise<void> {
    if (this.state === 'connected' || this.state === 'connecting') {
      return;
    }

    this.state = 'connecting';
    this.abortController = new AbortController();

    return new Promise((resolve, reject) => {
      // Tạo EventSource connection
      // Note: EventSource không hỗ trợ custom headers natively,
      // nên cần dùng polyfill hoặc fetch-based implementation
      this.eventSource = new EventSource(this.url.href);

      this.eventSource.onerror = (event) => {
        const error = new Error('SSE connection error');
        if (this.state === 'connecting') {
          reject(error);
        } else {
          this.emitError(error);
        }
      };

      this.eventSource.onopen = () => {
        this.state = 'connected';
        resolve();
      };

      // Listen cho 'endpoint' event để biết URL POST messages
      this.eventSource.addEventListener('endpoint', (event: MessageEvent) => {
        try {
          this.endpoint = new URL(event.data, this.url);
          // Kiểm tra origin phải match
          if (this.endpoint.origin !== this.url.origin) {
            throw new Error(`Endpoint origin mismatch: ${this.endpoint.origin}`);
          }
        } catch (error) {
          this.emitError(error instanceof Error ? error : new Error(String(error)));
          this.close();
        }
      });

      // Listen cho messages từ server
      this.eventSource.onmessage = (event: MessageEvent) => {
        try {
          const message = JSON.parse(event.data) as McpMessage;
          this.emitMessage(message);
        } catch (error) {
          console.error('Failed to parse SSE message:', error);
        }
      };
    });
  }

  /**
   * Close SSE transport
   */
  async close(): Promise<void> {
    this.abortController?.abort();
    this.eventSource?.close();
    this.eventSource = undefined;
    this.endpoint = undefined;
    this.emitClose();
  }

  /**
   * Gửi message đến server qua HTTP POST
   */
  async send(message: McpMessage): Promise<void> {
    if (!this.endpoint) {
      throw new Error('No endpoint available - transport not fully connected');
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...this.customHeaders,
    };

    // Thêm auth header nếu có token
    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    // Thêm protocol version header nếu có
    if (this.protocolVersion) {
      headers['mcp-protocol-version'] = this.protocolVersion;
    }

    const response = await fetch(this.endpoint.href, {
      method: 'POST',
      headers,
      body: JSON.stringify(message),
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => null);
      throw new Error(`SSE POST failed (HTTP ${response.status}): ${errorText}`);
    }
  }

  /**
   * Lấy common headers cho requests
   */
  private getCommonHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      ...this.customHeaders,
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    if (this.protocolVersion) {
      headers['mcp-protocol-version'] = this.protocolVersion;
    }

    return headers;
  }
}

// ============================================================================
// Streamable HTTP Transport - HTTP Streaming với Sessions
// ============================================================================

/**
 * Options cho reconnection
 */
export interface ReconnectionOptions {
  /** Delay ban đầu giữa các lần reconnect (ms) */
  initialReconnectionDelay: number;
  /** Max delay (ms) */
  maxReconnectionDelay: number;
  /** Growth factor cho delay */
  reconnectionDelayGrowFactor: number;
  /** Max số lần retry */
  maxRetries: number;
}

/**
 * Default reconnection options
 */
const DEFAULT_RECONNECTION_OPTIONS: ReconnectionOptions = {
  initialReconnectionDelay: 1_000,
  maxReconnectionDelay: 30_000,
  reconnectionDelayGrowFactor: 1.5,
  maxRetries: 2,
};

/**
 * Options cho Streamable HTTP transport
 */
export interface StreamableHttpTransportOptions extends TransportOptions {
  /** URL của MCP server */
  url: string;
  /** Authorization token (optional) */
  authToken?: string;
  /** Additional headers */
  headers?: Record<string, string>;
  /** Session ID để resume (optional) */
  sessionId?: string;
  /** Reconnection options */
  reconnectionOptions?: Partial<ReconnectionOptions>;
}

/**
 * Send options cho Streamable HTTP
 */
export interface StreamableHttpSendOptions {
  /** Token để resume stream */
  resumptionToken?: string;
  /** Callback khi nhận resumption token mới */
  onresumptiontoken?: (token: string) => void;
}

/**
 * Streamable HTTP Transport - HTTP streaming với session support
 *
 * Đây là transport hiện đại nhất cho MCP, hỗ trợ:
 * - Bi-directional streaming
 * - Session persistence
 * - Automatic reconnection
 * - SSE fallback
 *
 * @example
 * ```typescript
 * const transport = new StreamableHttpTransport({
 *   url: 'https://mcp-server.example.com/mcp',
 *   authToken: 'your-token',
 * });
 *
 * await transport.start();
 * await transport.send(initializeRequest);
 * ```
 */
export class StreamableHttpTransport extends BaseTransport {
  private readonly url: URL;
  private readonly authToken?: string;
  private readonly customHeaders: Record<string, string>;
  private readonly reconnectionOptions: ReconnectionOptions;

  /** Session ID từ server */
  private sessionId?: string;
  /** Abort controller */
  private abortController?: AbortController;
  /** Reconnection timeout ID */
  private reconnectionTimeout?: NodeJS.Timeout;
  /** Server-suggested retry delay (ms) */
  private serverRetryMs?: number;

  constructor(options: StreamableHttpTransportOptions) {
    super(options);
    this.url = new URL(options.url);
    this.authToken = options.authToken;
    this.customHeaders = options.headers || {};
    this.sessionId = options.sessionId;
    this.reconnectionOptions = {
      ...DEFAULT_RECONNECTION_OPTIONS,
      ...options.reconnectionOptions,
    };
  }

  /**
   * Start transport - tạo abort controller
   */
  async start(): Promise<void> {
    if (this.abortController) {
      throw new Error('StreamableHttpTransport already started');
    }
    this.abortController = new AbortController();
    this.state = 'connected';
  }

  /**
   * Close transport
   */
  async close(): Promise<void> {
    // Clear reconnection timeout nếu có
    if (this.reconnectionTimeout) {
      clearTimeout(this.reconnectionTimeout);
      this.reconnectionTimeout = undefined;
    }

    this.abortController?.abort();
    this.abortController = undefined;
    this.emitClose();
  }

  /**
   * Gửi message và xử lý response
   */
  async send(message: McpMessage, options?: StreamableHttpSendOptions): Promise<void> {
    const headers = await this.buildHeaders();
    headers['Content-Type'] = 'application/json';
    headers['Accept'] = 'application/json, text/event-stream';

    const response = await fetch(this.url.href, {
      method: 'POST',
      headers,
      body: JSON.stringify(message),
      signal: this.abortController?.signal,
    });

    // Lưu session ID từ response header
    const sessionId = response.headers.get('mcp-session-id');
    if (sessionId) {
      this.sessionId = sessionId;
    }

    if (!response.ok) {
      const errorText = await response.text().catch(() => null);
      throw new Error(`Streamable HTTP error (${response.status}): ${errorText}`);
    }

    // 202 Accepted - message được queue, không có response ngay
    if (response.status === 202) {
      return;
    }

    // Xử lý response dựa trên content type
    const contentType = response.headers.get('content-type');

    if (contentType?.includes('text/event-stream')) {
      // SSE stream response
      await this.handleSseStream(response.body, options);
    } else if (contentType?.includes('application/json')) {
      // JSON response
      const data = await response.json();
      const messages = Array.isArray(data) ? data : [data];
      for (const msg of messages) {
        this.emitMessage(msg as McpMessage);
      }
    }
  }

  /**
   * Terminate session với server
   */
  async terminateSession(): Promise<void> {
    if (!this.sessionId) {
      return;
    }

    const headers = await this.buildHeaders();

    const response = await fetch(this.url.href, {
      method: 'DELETE',
      headers,
      signal: this.abortController?.signal,
    });

    if (!response.ok && response.status !== 405) {
      throw new Error(`Failed to terminate session: ${response.statusText}`);
    }

    this.sessionId = undefined;
  }

  /**
   * Resume stream từ token
   */
  async resumeStream(
    token: string,
    options?: { onresumptiontoken?: (token: string) => void }
  ): Promise<void> {
    await this.startSseStream({
      resumptionToken: token,
      onresumptiontoken: options?.onresumptiontoken,
    });
  }

  /**
   * Lấy session ID hiện tại
   */
  getSessionId(): string | undefined {
    return this.sessionId;
  }

  /**
   * Build headers cho requests
   */
  private async buildHeaders(): Promise<Record<string, string>> {
    const headers: Record<string, string> = {
      ...this.customHeaders,
    };

    if (this.authToken) {
      headers['Authorization'] = `Bearer ${this.authToken}`;
    }

    if (this.sessionId) {
      headers['mcp-session-id'] = this.sessionId;
    }

    if (this.protocolVersion) {
      headers['mcp-protocol-version'] = this.protocolVersion;
    }

    return headers;
  }

  /**
   * Start SSE stream để nhận messages từ server
   */
  private async startSseStream(options?: StreamableHttpSendOptions): Promise<void> {
    const headers = await this.buildHeaders();
    headers['Accept'] = 'text/event-stream';

    if (options?.resumptionToken) {
      headers['last-event-id'] = options.resumptionToken;
    }

    const response = await fetch(this.url.href, {
      method: 'GET',
      headers,
      signal: this.abortController?.signal,
    });

    if (!response.ok) {
      if (response.status === 405) {
        // Server không hỗ trợ GET - không phải lỗi
        return;
      }
      throw new Error(`Failed to open SSE stream: ${response.statusText}`);
    }

    await this.handleSseStream(response.body, options);
  }

  /**
   * Xử lý SSE stream
   */
  private async handleSseStream(
    body: ReadableStream<Uint8Array> | null,
    options?: StreamableHttpSendOptions
  ): Promise<void> {
    if (!body) {
      return;
    }

    const reader = body.pipeThrough(new TextDecoderStream()).getReader();
    let buffer = '';
    let currentEventId: string | undefined;

    try {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += value;

        // Parse SSE events
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        let eventData: string | undefined;

        for (const line of lines) {
          if (line.startsWith('id:')) {
            currentEventId = line.slice(3).trim();
            options?.onresumptiontoken?.(currentEventId);
          } else if (line.startsWith('data:')) {
            eventData = line.slice(5).trim();
          } else if (line.startsWith('retry:')) {
            this.serverRetryMs = parseInt(line.slice(6).trim(), 10);
          } else if (line === '' && eventData) {
            // End of event
            try {
              const message = JSON.parse(eventData) as McpMessage;
              this.emitMessage(message);
            } catch (error) {
              console.error('Failed to parse SSE message:', error);
            }
            eventData = undefined;
          }
        }
      }
    } catch (error) {
      this.emitError(error instanceof Error ? error : new Error(String(error)));
    }
  }

  /**
   * Tính delay cho reconnection
   */
  private getNextReconnectionDelay(attempt: number): number {
    if (this.serverRetryMs !== undefined) {
      return this.serverRetryMs;
    }

    const { initialReconnectionDelay, reconnectionDelayGrowFactor, maxReconnectionDelay } =
      this.reconnectionOptions;

    return Math.min(
      initialReconnectionDelay * Math.pow(reconnectionDelayGrowFactor, attempt),
      maxReconnectionDelay
    );
  }

  /**
   * Schedule reconnection
   */
  private scheduleReconnection(options?: StreamableHttpSendOptions, attempt = 0): void {
    const { maxRetries } = this.reconnectionOptions;

    if (attempt >= maxRetries) {
      this.emitError(new Error(`Maximum reconnection attempts (${maxRetries}) exceeded`));
      return;
    }

    const delay = this.getNextReconnectionDelay(attempt);

    this.reconnectionTimeout = setTimeout(() => {
      this.startSseStream(options).catch((error) => {
        this.emitError(error);
        this.scheduleReconnection(options, attempt + 1);
      });
    }, delay);
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Tạo transport từ config
 */
export function createTransport(
  type: 'stdio',
  options: StdioTransportOptions
): StdioTransport;
export function createTransport(
  type: 'sse',
  options: SseTransportOptions
): SseTransport;
export function createTransport(
  type: 'streamable-http',
  options: StreamableHttpTransportOptions
): StreamableHttpTransport;
export function createTransport(
  type: 'stdio' | 'sse' | 'streamable-http',
  options: StdioTransportOptions | SseTransportOptions | StreamableHttpTransportOptions
): McpTransport {
  switch (type) {
    case 'stdio':
      return new StdioTransport(options as StdioTransportOptions);
    case 'sse':
      return new SseTransport(options as SseTransportOptions);
    case 'streamable-http':
      return new StreamableHttpTransport(options as StreamableHttpTransportOptions);
    default:
      throw new Error(`Unknown transport type: ${type}`);
  }
}
