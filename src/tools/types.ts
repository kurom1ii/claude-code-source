/**
 * Claude Code Tools - Type Definitions
 * Cac kieu du lieu co ban cho he thong tools
 */

// ============================================================================
// Parameter Types - Kieu du lieu cho tham so tool
// ============================================================================

/**
 * Cac kieu du lieu co ban cho tham so
 */
export type ParameterType = 'string' | 'number' | 'boolean' | 'array' | 'object';

/**
 * Dinh nghia mot tham so cua tool
 */
export interface ToolParameter {
  /** Kieu du lieu cua tham so */
  type: ParameterType;
  /** Mo ta chuc nang cua tham so */
  description: string;
  /** Tham so co bat buoc hay khong */
  required: boolean;
  /** Gia tri mac dinh (neu co) */
  default?: unknown;
  /** Cac gia tri hop le (cho enum) */
  enum?: string[];
}

/**
 * Map cac tham so theo ten
 */
export type ToolParameters = Record<string, ToolParameter>;

// ============================================================================
// Tool Definition - Dinh nghia cau truc tool
// ============================================================================

/**
 * Dinh nghia mot tool trong Claude Code
 */
export interface ToolDefinition {
  /** Ten cua tool (VD: "Read", "Bash", "Grep") */
  name: string;
  /** Mo ta chuc nang cua tool */
  description: string;
  /** Cac tham so cua tool */
  parameters: ToolParameters;
  /** Co can xac nhan truoc khi chay khong */
  requiresConfirmation: boolean;
  /** Danh muc cua tool */
  category?: ToolCategory;
}

/**
 * Cac danh muc tool
 */
export type ToolCategory =
  | 'filesystem'    // Doc/ghi/sua file
  | 'shell'         // Chay lenh shell
  | 'search'        // Tim kiem file/content
  | 'web'           // Fetch URL, search web
  | 'agent'         // Quan ly agents/tasks
  | 'notebook'      // Jupyter notebook
  | 'utility'       // Cac tien ich khac
  | 'user-interaction' // Tuong tac voi user
  | 'planning'      // Plan mode
  | 'task-management' // Quan ly tasks
  | 'swarm';        // Team/swarm operations

// ============================================================================
// Tool Execution - Kieu du lieu khi chay tool
// ============================================================================

/**
 * Input cho viec thuc thi tool
 */
export interface ToolInput {
  /** Ten tool can chay */
  toolName: string;
  /** Cac tham so truyen vao */
  parameters: Record<string, unknown>;
  /** Context hien tai (neu can) */
  context?: ExecutionContext;
}

/**
 * Ket qua tra ve tu tool
 */
export interface ToolResult {
  /** Tool co chay thanh cong khong */
  success: boolean;
  /** Ket qua tra ve (neu thanh cong) */
  output?: unknown;
  /** Thong bao loi (neu that bai) */
  error?: string;
  /** Thoi gian thuc thi (ms) */
  executionTime?: number;
  /** Metadata bo sung */
  metadata?: Record<string, unknown>;
}

/**
 * Context khi thuc thi tool
 */
export interface ExecutionContext {
  /** Thu muc lam viec hien tai */
  workingDirectory: string;
  /** Cac bien moi truong */
  environment: Record<string, string>;
  /** Co phai sandbox mode khong */
  sandboxMode: boolean;
  /** Timeout mac dinh (ms) */
  defaultTimeout: number;
  /** User ID dang chay */
  userId?: string;
  /** Session ID hien tai */
  sessionId?: string;
}

// ============================================================================
// Tool Registry - Quan ly cac tool da dang ky
// ============================================================================

/**
 * Interface cho Tool Registry
 */
export interface IToolRegistry {
  /** Lay tool theo ten */
  getTool(name: string): ToolDefinition | undefined;
  /** Lay tat ca tools */
  getAllTools(): ToolDefinition[];
  /** Lay tools theo danh muc */
  getToolsByCategory(category: ToolCategory): ToolDefinition[];
  /** Lay tools can xac nhan */
  getToolsRequiringConfirmation(): ToolDefinition[];
  /** Loc tools theo allowlist */
  filterByAllowlist(allowedTools: string[] | '*'): ToolDefinition[];
}

// ============================================================================
// Tool Handler - Interface cho viec xu ly tool
// ============================================================================

/**
 * Handler xu ly mot tool cu the
 */
export interface ToolHandler<TInput = unknown, TOutput = unknown> {
  /** Ten tool */
  name: string;
  /** Validate input truoc khi chay */
  validateInput(input: TInput): boolean | string;
  /** Thuc thi tool */
  execute(input: TInput, context: ExecutionContext): Promise<TOutput>;
  /** Dinh nghia cua tool */
  definition: ToolDefinition;
}

/**
 * Factory de tao tool handler
 */
export type ToolHandlerFactory<TInput = unknown, TOutput = unknown> = (
  context: ExecutionContext
) => ToolHandler<TInput, TOutput>;
