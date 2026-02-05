/**
 * Model Context Protocol (MCP) - Type Definitions
 *
 * MCP là giao thức cho phép Claude tương tác với các external tools và services.
 * File này định nghĩa tất cả các kiểu dữ liệu cần thiết cho giao thức MCP.
 *
 * @see https://modelcontextprotocol.io/
 */

// ============================================================================
// JSON-RPC Types - Cơ sở của MCP protocol
// ============================================================================

/**
 * JSON-RPC version - MCP sử dụng JSON-RPC 2.0
 */
export const JSONRPC_VERSION = '2.0' as const;

/**
 * MCP protocol version hiện tại
 */
export const MCP_PROTOCOL_VERSION = '2024-11-05' as const;

/**
 * Base interface cho tất cả JSON-RPC messages
 */
export interface JsonRpcMessage {
  jsonrpc: typeof JSONRPC_VERSION;
}

/**
 * JSON-RPC Request - Yêu cầu từ client đến server
 */
export interface JsonRpcRequest extends JsonRpcMessage {
  /** ID duy nhất để match request với response */
  id: string | number;
  /** Tên method cần gọi */
  method: string;
  /** Params cho method (optional) */
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC Notification - Message không cần response
 */
export interface JsonRpcNotification extends JsonRpcMessage {
  /** Tên method/event */
  method: string;
  /** Params cho notification (optional) */
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC Response - Kết quả trả về cho request
 */
export interface JsonRpcResponse extends JsonRpcMessage {
  /** ID của request tương ứng */
  id: string | number;
  /** Kết quả thành công (nếu có) */
  result?: unknown;
  /** Error (nếu có) */
  error?: JsonRpcError;
}

/**
 * JSON-RPC Error object
 */
export interface JsonRpcError {
  /** Mã lỗi theo JSON-RPC spec */
  code: JsonRpcErrorCode;
  /** Mô tả lỗi ngắn gọn */
  message: string;
  /** Dữ liệu bổ sung về lỗi (optional) */
  data?: unknown;
}

/**
 * Các mã lỗi JSON-RPC chuẩn
 */
export enum JsonRpcErrorCode {
  /** Parse error - JSON không hợp lệ */
  PARSE_ERROR = -32700,
  /** Invalid request - Request không đúng format */
  INVALID_REQUEST = -32600,
  /** Method not found - Server không hỗ trợ method */
  METHOD_NOT_FOUND = -32601,
  /** Invalid params - Params không hợp lệ */
  INVALID_PARAMS = -32602,
  /** Internal error - Lỗi nội bộ server */
  INTERNAL_ERROR = -32603,
}

/**
 * Union type cho tất cả MCP messages
 */
export type McpMessage = JsonRpcRequest | JsonRpcNotification | JsonRpcResponse;

// ============================================================================
// MCP Initialization Types - Khởi tạo kết nối
// ============================================================================

/**
 * Capabilities mà client hỗ trợ
 */
export interface ClientCapabilities {
  /** Hỗ trợ sampling từ client */
  sampling?: Record<string, never>;
  /** Client hỗ trợ nhận roots */
  roots?: {
    /** Hỗ trợ nhận notification khi roots thay đổi */
    listChanged?: boolean;
  };
  /** Experimental capabilities */
  experimental?: Record<string, unknown>;
}

/**
 * Capabilities mà server cung cấp
 */
export interface ServerCapabilities {
  /** Server có tools */
  tools?: {
    /** Hỗ trợ notification khi tool list thay đổi */
    listChanged?: boolean;
  };
  /** Server có resources */
  resources?: {
    /** Hỗ trợ subscription cho resources */
    subscribe?: boolean;
    /** Hỗ trợ notification khi resource list thay đổi */
    listChanged?: boolean;
  };
  /** Server có prompts */
  prompts?: {
    /** Hỗ trợ notification khi prompt list thay đổi */
    listChanged?: boolean;
  };
  /** Server hỗ trợ logging */
  logging?: Record<string, never>;
  /** Experimental capabilities */
  experimental?: Record<string, unknown>;
}

/**
 * Thông tin về client/server implementation
 */
export interface ImplementationInfo {
  /** Tên của implementation */
  name: string;
  /** Version của implementation */
  version: string;
}

/**
 * Request khởi tạo kết nối từ client
 */
export interface InitializeRequest {
  method: 'initialize';
  params: {
    /** Phiên bản protocol mà client hỗ trợ */
    protocolVersion: string;
    /** Capabilities của client */
    capabilities: ClientCapabilities;
    /** Thông tin về client */
    clientInfo: ImplementationInfo;
  };
}

/**
 * Response khởi tạo từ server
 */
export interface InitializeResult {
  /** Phiên bản protocol mà server đồng ý sử dụng */
  protocolVersion: string;
  /** Capabilities của server */
  capabilities: ServerCapabilities;
  /** Thông tin về server */
  serverInfo: ImplementationInfo;
  /** Instructions cho việc sử dụng server (optional) */
  instructions?: string;
}

/**
 * Notification báo client đã khởi tạo xong
 */
export interface InitializedNotification {
  method: 'notifications/initialized';
}

// ============================================================================
// Tool Types - Định nghĩa và gọi tools
// ============================================================================

/**
 * JSON Schema cho tool input
 */
export interface ToolInputSchema {
  type: 'object';
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  additionalProperties?: boolean;
}

/**
 * Property trong JSON Schema
 */
export interface JsonSchemaProperty {
  type: JsonSchemaType | JsonSchemaType[];
  description?: string;
  enum?: (string | number | boolean)[];
  default?: unknown;
  items?: JsonSchemaProperty;
  properties?: Record<string, JsonSchemaProperty>;
  required?: string[];
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  format?: string;
}

/**
 * Các kiểu dữ liệu JSON Schema hỗ trợ
 */
export type JsonSchemaType = 'string' | 'number' | 'integer' | 'boolean' | 'array' | 'object' | 'null';

/**
 * Định nghĩa một MCP tool
 */
export interface McpTool {
  /** Tên tool - phải unique trong server */
  name: string;
  /** Mô tả chức năng của tool */
  description?: string;
  /** JSON Schema cho input parameters */
  inputSchema: ToolInputSchema;
}

/**
 * Request liệt kê các tools có sẵn
 */
export interface ListToolsRequest {
  method: 'tools/list';
  params?: {
    /** Cursor cho pagination (optional) */
    cursor?: string;
  };
}

/**
 * Response chứa danh sách tools
 */
export interface ListToolsResult {
  /** Danh sách tools */
  tools: McpTool[];
  /** Cursor cho trang tiếp theo (nếu có) */
  nextCursor?: string;
}

/**
 * Request gọi một tool
 */
export interface CallToolRequest {
  method: 'tools/call';
  params: {
    /** Tên tool cần gọi */
    name: string;
    /** Arguments cho tool (theo inputSchema) */
    arguments?: Record<string, unknown>;
  };
}

/**
 * Content block trong tool result
 */
export interface ToolResultContent {
  /** Loại content */
  type: 'text' | 'image' | 'resource';
  /** Text content */
  text?: string;
  /** Image data (base64) */
  data?: string;
  /** MIME type cho image */
  mimeType?: string;
  /** Resource reference */
  resource?: ResourceReference;
}

/**
 * Kết quả của việc gọi tool
 */
export interface CallToolResult {
  /** Nội dung kết quả */
  content: ToolResultContent[];
  /** Tool gặp lỗi trong quá trình thực thi */
  isError?: boolean;
}

/**
 * Notification khi danh sách tools thay đổi
 */
export interface ToolListChangedNotification {
  method: 'notifications/tools/list_changed';
}

// ============================================================================
// Resource Types - Quản lý resources
// ============================================================================

/**
 * Định nghĩa một MCP resource
 */
export interface McpResource {
  /** URI duy nhất để xác định resource */
  uri: string;
  /** Tên hiển thị của resource */
  name: string;
  /** Mô tả resource (optional) */
  description?: string;
  /** MIME type của resource */
  mimeType?: string;
  /** Annotations để LLM hiểu rõ hơn */
  annotations?: ResourceAnnotations;
}

/**
 * Annotations cho resource
 */
export interface ResourceAnnotations {
  /** Resource là audience cho user (tức là user-facing) */
  audience?: ('user' | 'assistant')[];
  /** Mức độ ưu tiên của resource */
  priority?: number;
}

/**
 * Reference tới một resource
 */
export interface ResourceReference {
  /** URI của resource */
  uri: string;
  /** MIME type (optional) */
  mimeType?: string;
  /** Text content (nếu inline) */
  text?: string;
  /** Binary content base64 (nếu inline) */
  blob?: string;
}

/**
 * Resource template - Dynamic resource với URI template
 */
export interface ResourceTemplate {
  /** URI template theo RFC 6570 */
  uriTemplate: string;
  /** Tên của template */
  name: string;
  /** Mô tả template */
  description?: string;
  /** MIME type của resources từ template */
  mimeType?: string;
  /** Annotations */
  annotations?: ResourceAnnotations;
}

/**
 * Request liệt kê resources
 */
export interface ListResourcesRequest {
  method: 'resources/list';
  params?: {
    cursor?: string;
  };
}

/**
 * Response chứa danh sách resources
 */
export interface ListResourcesResult {
  resources: McpResource[];
  nextCursor?: string;
}

/**
 * Request liệt kê resource templates
 */
export interface ListResourceTemplatesRequest {
  method: 'resources/templates/list';
  params?: {
    cursor?: string;
  };
}

/**
 * Response chứa danh sách resource templates
 */
export interface ListResourceTemplatesResult {
  resourceTemplates: ResourceTemplate[];
  nextCursor?: string;
}

/**
 * Request đọc nội dung resource
 */
export interface ReadResourceRequest {
  method: 'resources/read';
  params: {
    /** URI của resource cần đọc */
    uri: string;
  };
}

/**
 * Nội dung của một resource
 */
export interface ResourceContent {
  /** URI của resource */
  uri: string;
  /** MIME type */
  mimeType?: string;
  /** Text content (cho text resources) */
  text?: string;
  /** Binary content base64 (cho binary resources) */
  blob?: string;
}

/**
 * Response chứa nội dung resource
 */
export interface ReadResourceResult {
  contents: ResourceContent[];
}

/**
 * Request subscribe vào resource changes
 */
export interface SubscribeResourceRequest {
  method: 'resources/subscribe';
  params: {
    uri: string;
  };
}

/**
 * Request unsubscribe khỏi resource
 */
export interface UnsubscribeResourceRequest {
  method: 'resources/unsubscribe';
  params: {
    uri: string;
  };
}

/**
 * Notification khi resource được cập nhật
 */
export interface ResourceUpdatedNotification {
  method: 'notifications/resources/updated';
  params: {
    uri: string;
  };
}

/**
 * Notification khi danh sách resources thay đổi
 */
export interface ResourceListChangedNotification {
  method: 'notifications/resources/list_changed';
}

// ============================================================================
// Prompt Types - MCP prompts
// ============================================================================

/**
 * Argument cho prompt
 */
export interface PromptArgument {
  /** Tên argument */
  name: string;
  /** Mô tả argument */
  description?: string;
  /** Argument có bắt buộc không */
  required?: boolean;
}

/**
 * Định nghĩa một MCP prompt
 */
export interface McpPrompt {
  /** Tên prompt - phải unique trong server */
  name: string;
  /** Mô tả prompt */
  description?: string;
  /** Các arguments mà prompt nhận */
  arguments?: PromptArgument[];
}

/**
 * Message trong prompt result
 */
export interface PromptMessage {
  /** Role: user hoặc assistant */
  role: 'user' | 'assistant';
  /** Content của message */
  content: PromptMessageContent;
}

/**
 * Content types trong prompt message
 */
export type PromptMessageContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string }
  | { type: 'resource'; resource: ResourceReference };

/**
 * Request liệt kê prompts
 */
export interface ListPromptsRequest {
  method: 'prompts/list';
  params?: {
    cursor?: string;
  };
}

/**
 * Response chứa danh sách prompts
 */
export interface ListPromptsResult {
  prompts: McpPrompt[];
  nextCursor?: string;
}

/**
 * Request lấy prompt
 */
export interface GetPromptRequest {
  method: 'prompts/get';
  params: {
    name: string;
    arguments?: Record<string, string>;
  };
}

/**
 * Response chứa prompt messages
 */
export interface GetPromptResult {
  /** Mô tả prompt được generate */
  description?: string;
  /** Messages của prompt */
  messages: PromptMessage[];
}

/**
 * Notification khi danh sách prompts thay đổi
 */
export interface PromptListChangedNotification {
  method: 'notifications/prompts/list_changed';
}

// ============================================================================
// Logging Types - MCP logging
// ============================================================================

/**
 * Log levels theo severity
 */
export type LogLevel = 'debug' | 'info' | 'notice' | 'warning' | 'error' | 'critical' | 'alert' | 'emergency';

/**
 * Request set log level
 */
export interface SetLogLevelRequest {
  method: 'logging/setLevel';
  params: {
    level: LogLevel;
  };
}

/**
 * Notification log message từ server
 */
export interface LogMessageNotification {
  method: 'notifications/message';
  params: {
    /** Log level */
    level: LogLevel;
    /** Logger name/source */
    logger?: string;
    /** Log message data */
    data: unknown;
  };
}

// ============================================================================
// Sampling Types - Client-side sampling
// ============================================================================

/**
 * Request sampling từ client (server yêu cầu client tạo completion)
 */
export interface CreateSamplingMessageRequest {
  method: 'sampling/createMessage';
  params: {
    /** Messages để gửi cho LLM */
    messages: SamplingMessage[];
    /** Model preferences */
    modelPreferences?: ModelPreferences;
    /** System prompt */
    systemPrompt?: string;
    /** Include context từ MCP servers */
    includeContext?: 'none' | 'thisServer' | 'allServers';
    /** Temperature */
    temperature?: number;
    /** Max tokens để generate */
    maxTokens: number;
    /** Stop sequences */
    stopSequences?: string[];
    /** Metadata */
    metadata?: Record<string, unknown>;
  };
}

/**
 * Message trong sampling request
 */
export interface SamplingMessage {
  role: 'user' | 'assistant';
  content: SamplingContent;
}

/**
 * Content trong sampling message
 */
export type SamplingContent =
  | { type: 'text'; text: string }
  | { type: 'image'; data: string; mimeType: string };

/**
 * Model preferences cho sampling
 */
export interface ModelPreferences {
  /** Hints về model cần dùng */
  hints?: ModelHint[];
  /** Cost priority (0-1, 0 = không quan tâm cost) */
  costPriority?: number;
  /** Speed priority (0-1, 0 = không quan tâm speed) */
  speedPriority?: number;
  /** Intelligence priority (0-1, 0 = không quan tâm quality) */
  intelligencePriority?: number;
}

/**
 * Hint cho việc chọn model
 */
export interface ModelHint {
  /** Tên model được suggest */
  name?: string;
}

/**
 * Response từ sampling
 */
export interface CreateSamplingMessageResult {
  /** Role của response */
  role: 'user' | 'assistant';
  /** Content response */
  content: SamplingContent;
  /** Model đã được sử dụng */
  model: string;
  /** Stop reason */
  stopReason?: 'endTurn' | 'stopSequence' | 'maxTokens';
}

// ============================================================================
// Roots Types - Client roots
// ============================================================================

/**
 * Root trong client
 */
export interface Root {
  /** URI của root */
  uri: string;
  /** Tên hiển thị */
  name?: string;
}

/**
 * Request liệt kê roots từ client
 */
export interface ListRootsRequest {
  method: 'roots/list';
}

/**
 * Response chứa danh sách roots
 */
export interface ListRootsResult {
  roots: Root[];
}

/**
 * Notification khi roots thay đổi
 */
export interface RootsListChangedNotification {
  method: 'notifications/roots/list_changed';
}

// ============================================================================
// Progress Types - Progress tracking
// ============================================================================

/**
 * Progress token để track long-running operations
 */
export type ProgressToken = string | number;

/**
 * Notification về tiến độ
 */
export interface ProgressNotification {
  method: 'notifications/progress';
  params: {
    /** Token để identify operation */
    progressToken: ProgressToken;
    /** Tiến độ hiện tại (0-1 hoặc giá trị tùy ý) */
    progress: number;
    /** Tổng tiến độ (nếu biết) */
    total?: number;
  };
}

// ============================================================================
// Cancellation Types - Hủy operations
// ============================================================================

/**
 * Notification hủy request đang chạy
 */
export interface CancelledNotification {
  method: 'notifications/cancelled';
  params: {
    /** ID của request cần hủy */
    requestId: string | number;
    /** Lý do hủy (optional) */
    reason?: string;
  };
}

// ============================================================================
// Transport Types - Định nghĩa cho transport layer
// ============================================================================

/**
 * Trạng thái kết nối của transport
 */
export type TransportState = 'disconnected' | 'connecting' | 'connected' | 'error';

/**
 * Options cho transport
 */
export interface TransportOptions {
  /** Timeout cho operations (ms) */
  timeout?: number;
  /** Số lần retry khi kết nối thất bại */
  maxRetries?: number;
  /** Delay giữa các lần retry (ms) */
  retryDelay?: number;
  /** Max delay cho exponential backoff (ms) */
  maxRetryDelay?: number;
}

/**
 * Event handlers cho transport
 */
export interface TransportEventHandlers {
  /** Được gọi khi nhận message */
  onMessage?: (message: McpMessage) => void;
  /** Được gọi khi transport đóng */
  onClose?: () => void;
  /** Được gọi khi có lỗi */
  onError?: (error: Error) => void;
}

/**
 * Interface cơ bản cho MCP transport
 */
export interface McpTransport {
  /** Bắt đầu transport */
  start(): Promise<void>;
  /** Đóng transport */
  close(): Promise<void>;
  /** Gửi message */
  send(message: McpMessage): Promise<void>;
  /** Set protocol version (để gửi trong headers) */
  setProtocolVersion?(version: string): void;
  /** Event handlers */
  onmessage?: (message: McpMessage) => void;
  onclose?: () => void;
  onerror?: (error: Error) => void;
}

// ============================================================================
// Server Configuration Types - Cấu hình MCP server
// ============================================================================

/**
 * Loại transport cho MCP server
 */
export type McpTransportType = 'stdio' | 'sse' | 'streamable-http';

/**
 * Cấu hình cho MCP server
 */
export interface McpServerConfig {
  /** Tên định danh của server */
  name: string;
  /** Loại transport */
  transport: McpTransportType;
  /** Command để chạy server (cho stdio) */
  command?: string;
  /** Arguments cho command (cho stdio) */
  args?: string[];
  /** Environment variables */
  env?: Record<string, string>;
  /** URL endpoint (cho HTTP transports) */
  url?: string;
  /** Timeout (ms) */
  timeout?: number;
  /** Server có được enable không */
  enabled?: boolean;
  /** Scope của server */
  scope?: 'user' | 'project' | 'dynamic';
}

/**
 * Trạng thái của MCP server
 */
export type McpServerState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'needs-auth'
  | 'error';

/**
 * Thông tin về MCP server đang chạy
 */
export interface McpServerInfo {
  /** Config của server */
  config: McpServerConfig;
  /** Trạng thái hiện tại */
  state: McpServerState;
  /** Server capabilities (sau khi connect) */
  capabilities?: ServerCapabilities;
  /** Server info (sau khi connect) */
  serverInfo?: ImplementationInfo;
  /** Error message (nếu có) */
  error?: string;
  /** Số lần reconnect đã thử */
  reconnectAttempt?: number;
  /** Max số lần reconnect */
  maxReconnectAttempts?: number;
}

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Tạo request ID mới
 */
export function createRequestId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Helper type để extract params từ request
 */
export type RequestParams<T> = T extends { params: infer P } ? P : never;

/**
 * Helper type để tạo JsonRpcRequest từ method và params
 */
export type TypedRequest<M extends string, P = undefined> = {
  method: M;
} & (P extends undefined ? { params?: never } : { params: P });
