/**
 * Model Context Protocol (MCP) - Tool Registry
 *
 * ToolRegistry quản lý việc đăng ký, tìm kiếm, và validate MCP tools.
 * Nó cung cấp một interface thống nhất để làm việc với tools từ
 * nhiều MCP servers khác nhau.
 *
 * @see https://modelcontextprotocol.io/
 */

import type {
  McpTool,
  ToolInputSchema,
  JsonSchemaProperty,
  CallToolResult,
  ToolResultContent,
} from './types';

// ============================================================================
// Types for Tool Registry
// ============================================================================

/**
 * Tool với metadata về nguồn gốc
 */
export interface RegisteredTool extends McpTool {
  /** Server name mà tool thuộc về */
  serverName: string;
  /** Full qualified name: serverName__toolName */
  qualifiedName: string;
  /** Tool có enabled không */
  enabled: boolean;
  /** Thời điểm đăng ký */
  registeredAt: Date;
  /** Metadata bổ sung */
  metadata?: Record<string, unknown>;
}

/**
 * Filter options khi tìm kiếm tools
 */
export interface ToolFilterOptions {
  /** Lọc theo server name */
  serverName?: string;
  /** Lọc theo pattern trong tên tool */
  namePattern?: string | RegExp;
  /** Lọc theo pattern trong description */
  descriptionPattern?: string | RegExp;
  /** Chỉ lấy tools đang enabled */
  enabledOnly?: boolean;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Có valid không */
  valid: boolean;
  /** Danh sách errors nếu invalid */
  errors: ValidationError[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Path đến property có lỗi */
  path: string;
  /** Mô tả lỗi */
  message: string;
  /** Expected type/value */
  expected?: string;
  /** Actual type/value */
  actual?: string;
}

/**
 * Stats về registry
 */
export interface RegistryStats {
  /** Tổng số tools */
  totalTools: number;
  /** Số tools enabled */
  enabledTools: number;
  /** Số tools disabled */
  disabledTools: number;
  /** Số servers */
  serverCount: number;
  /** Tools theo server */
  toolsByServer: Map<string, number>;
}

// ============================================================================
// Tool Registry Implementation
// ============================================================================

/**
 * Tool Registry - Quản lý và tìm kiếm MCP tools
 *
 * @example
 * ```typescript
 * const registry = new ToolRegistry();
 *
 * // Đăng ký tools từ server
 * registry.registerTools('my-server', tools);
 *
 * // Tìm tool
 * const tool = registry.getTool('my-server', 'get_weather');
 *
 * // Validate arguments
 * const validation = registry.validateArguments(tool, { location: 'Tokyo' });
 *
 * // Tìm kiếm tools
 * const searchResults = registry.searchTools('weather');
 * ```
 */
export class ToolRegistry {
  /** Map: qualifiedName -> RegisteredTool */
  private tools = new Map<string, RegisteredTool>();

  /** Map: serverName -> Set of tool names */
  private serverTools = new Map<string, Set<string>>();

  // ==========================================================================
  // Registration Methods
  // ==========================================================================

  /**
   * Đăng ký tools từ một server
   *
   * @param serverName - Tên server nguồn
   * @param tools - Danh sách tools từ server
   * @param metadata - Metadata bổ sung (optional)
   */
  registerTools(
    serverName: string,
    tools: McpTool[],
    metadata?: Record<string, unknown>
  ): void {
    // Tạo set cho server nếu chưa có
    if (!this.serverTools.has(serverName)) {
      this.serverTools.set(serverName, new Set());
    }

    const serverToolSet = this.serverTools.get(serverName)!;

    for (const tool of tools) {
      const qualifiedName = this.createQualifiedName(serverName, tool.name);

      const registeredTool: RegisteredTool = {
        ...tool,
        serverName,
        qualifiedName,
        enabled: true,
        registeredAt: new Date(),
        metadata,
      };

      this.tools.set(qualifiedName, registeredTool);
      serverToolSet.add(tool.name);
    }
  }

  /**
   * Đăng ký một tool đơn lẻ
   *
   * @param serverName - Tên server nguồn
   * @param tool - Tool definition
   * @param metadata - Metadata bổ sung
   */
  registerTool(
    serverName: string,
    tool: McpTool,
    metadata?: Record<string, unknown>
  ): void {
    this.registerTools(serverName, [tool], metadata);
  }

  /**
   * Hủy đăng ký tất cả tools từ một server
   *
   * @param serverName - Tên server
   * @returns Số tools đã hủy
   */
  unregisterServer(serverName: string): number {
    const serverToolSet = this.serverTools.get(serverName);
    if (!serverToolSet) {
      return 0;
    }

    let count = 0;
    for (const toolName of serverToolSet) {
      const qualifiedName = this.createQualifiedName(serverName, toolName);
      if (this.tools.delete(qualifiedName)) {
        count++;
      }
    }

    this.serverTools.delete(serverName);
    return count;
  }

  /**
   * Hủy đăng ký một tool cụ thể
   *
   * @param serverName - Tên server
   * @param toolName - Tên tool
   * @returns True nếu tool đã được xóa
   */
  unregisterTool(serverName: string, toolName: string): boolean {
    const qualifiedName = this.createQualifiedName(serverName, toolName);
    const removed = this.tools.delete(qualifiedName);

    if (removed) {
      const serverToolSet = this.serverTools.get(serverName);
      serverToolSet?.delete(toolName);
    }

    return removed;
  }

  /**
   * Xóa tất cả tools
   */
  clear(): void {
    this.tools.clear();
    this.serverTools.clear();
  }

  // ==========================================================================
  // Lookup Methods
  // ==========================================================================

  /**
   * Lấy tool theo server name và tool name
   *
   * @param serverName - Tên server
   * @param toolName - Tên tool
   * @returns Tool hoặc undefined nếu không tìm thấy
   */
  getTool(serverName: string, toolName: string): RegisteredTool | undefined {
    const qualifiedName = this.createQualifiedName(serverName, toolName);
    return this.tools.get(qualifiedName);
  }

  /**
   * Lấy tool theo qualified name
   *
   * @param qualifiedName - Qualified name (serverName__toolName)
   * @returns Tool hoặc undefined
   */
  getToolByQualifiedName(qualifiedName: string): RegisteredTool | undefined {
    return this.tools.get(qualifiedName);
  }

  /**
   * Kiểm tra tool có tồn tại không
   *
   * @param serverName - Tên server
   * @param toolName - Tên tool
   */
  hasTool(serverName: string, toolName: string): boolean {
    return this.tools.has(this.createQualifiedName(serverName, toolName));
  }

  /**
   * Lấy tất cả tools
   *
   * @param filter - Filter options (optional)
   * @returns Array của tools
   */
  getAllTools(filter?: ToolFilterOptions): RegisteredTool[] {
    let tools = Array.from(this.tools.values());

    if (filter) {
      tools = this.applyFilter(tools, filter);
    }

    return tools;
  }

  /**
   * Lấy tools theo server
   *
   * @param serverName - Tên server
   * @returns Array của tools từ server
   */
  getToolsByServer(serverName: string): RegisteredTool[] {
    return this.getAllTools({ serverName });
  }

  /**
   * Lấy danh sách server names
   */
  getServerNames(): string[] {
    return Array.from(this.serverTools.keys());
  }

  // ==========================================================================
  // Search Methods
  // ==========================================================================

  /**
   * Tìm kiếm tools theo query
   *
   * @param query - Search query
   * @param options - Filter options
   * @returns Array của tools matching query
   */
  searchTools(query: string, options?: ToolFilterOptions): RegisteredTool[] {
    const queryLower = query.toLowerCase();
    let tools = Array.from(this.tools.values());

    // Apply base filter nếu có
    if (options) {
      tools = this.applyFilter(tools, options);
    }

    // Search trong name và description
    return tools.filter((tool) => {
      const nameMatch = tool.name.toLowerCase().includes(queryLower);
      const descMatch = tool.description?.toLowerCase().includes(queryLower);
      return nameMatch || descMatch;
    });
  }

  /**
   * Tìm tools có chứa keyword trong description
   *
   * @param keyword - Keyword cần tìm
   */
  findToolsByKeyword(keyword: string): RegisteredTool[] {
    return this.searchTools(keyword);
  }

  // ==========================================================================
  // Enable/Disable Methods
  // ==========================================================================

  /**
   * Enable/disable một tool
   *
   * @param serverName - Tên server
   * @param toolName - Tên tool
   * @param enabled - Enabled state
   */
  setToolEnabled(serverName: string, toolName: string, enabled: boolean): boolean {
    const tool = this.getTool(serverName, toolName);
    if (tool) {
      tool.enabled = enabled;
      return true;
    }
    return false;
  }

  /**
   * Enable/disable tất cả tools từ một server
   *
   * @param serverName - Tên server
   * @param enabled - Enabled state
   */
  setServerEnabled(serverName: string, enabled: boolean): number {
    let count = 0;
    for (const tool of this.getToolsByServer(serverName)) {
      tool.enabled = enabled;
      count++;
    }
    return count;
  }

  // ==========================================================================
  // Validation Methods
  // ==========================================================================

  /**
   * Validate arguments cho tool
   *
   * @param tool - Tool definition
   * @param args - Arguments cần validate
   * @returns Validation result
   */
  validateArguments(
    tool: McpTool,
    args: Record<string, unknown>
  ): ValidationResult {
    const errors: ValidationError[] = [];
    const schema = tool.inputSchema;

    // Kiểm tra required properties
    if (schema.required) {
      for (const required of schema.required) {
        if (!(required in args)) {
          errors.push({
            path: required,
            message: `Missing required property: ${required}`,
            expected: 'value',
            actual: 'undefined',
          });
        }
      }
    }

    // Validate từng property
    if (schema.properties) {
      for (const [key, value] of Object.entries(args)) {
        const propSchema = schema.properties[key];

        if (!propSchema) {
          // Property không có trong schema
          if (schema.additionalProperties === false) {
            errors.push({
              path: key,
              message: `Unknown property: ${key}`,
            });
          }
          continue;
        }

        // Validate type
        const typeError = this.validateType(key, value, propSchema);
        if (typeError) {
          errors.push(typeError);
        }
      }
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate type của một value
   */
  private validateType(
    path: string,
    value: unknown,
    schema: JsonSchemaProperty
  ): ValidationError | null {
    const actualType = this.getValueType(value);
    const expectedTypes = Array.isArray(schema.type) ? schema.type : [schema.type];

    // Check if type matches
    const typeMatches = expectedTypes.some((type) => {
      switch (type) {
        case 'string':
          return typeof value === 'string';
        case 'number':
        case 'integer':
          return typeof value === 'number';
        case 'boolean':
          return typeof value === 'boolean';
        case 'array':
          return Array.isArray(value);
        case 'object':
          return typeof value === 'object' && value !== null && !Array.isArray(value);
        case 'null':
          return value === null;
        default:
          return false;
      }
    });

    if (!typeMatches) {
      return {
        path,
        message: `Invalid type for ${path}`,
        expected: expectedTypes.join(' | '),
        actual: actualType,
      };
    }

    // Validate enum nếu có
    if (schema.enum && !schema.enum.includes(value as string | number | boolean)) {
      return {
        path,
        message: `Value must be one of: ${schema.enum.join(', ')}`,
        expected: schema.enum.join(' | '),
        actual: String(value),
      };
    }

    // Validate string constraints
    if (typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        return {
          path,
          message: `String too short (minimum: ${schema.minLength})`,
          expected: `length >= ${schema.minLength}`,
          actual: `length = ${value.length}`,
        };
      }
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        return {
          path,
          message: `String too long (maximum: ${schema.maxLength})`,
          expected: `length <= ${schema.maxLength}`,
          actual: `length = ${value.length}`,
        };
      }
      if (schema.pattern) {
        const regex = new RegExp(schema.pattern);
        if (!regex.test(value)) {
          return {
            path,
            message: `String does not match pattern: ${schema.pattern}`,
            expected: `/${schema.pattern}/`,
            actual: value,
          };
        }
      }
    }

    // Validate number constraints
    if (typeof value === 'number') {
      if (schema.minimum !== undefined && value < schema.minimum) {
        return {
          path,
          message: `Number too small (minimum: ${schema.minimum})`,
          expected: `>= ${schema.minimum}`,
          actual: String(value),
        };
      }
      if (schema.maximum !== undefined && value > schema.maximum) {
        return {
          path,
          message: `Number too large (maximum: ${schema.maximum})`,
          expected: `<= ${schema.maximum}`,
          actual: String(value),
        };
      }
    }

    return null;
  }

  /**
   * Lấy type string của value
   */
  private getValueType(value: unknown): string {
    if (value === null) return 'null';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  }

  // ==========================================================================
  // Stats Methods
  // ==========================================================================

  /**
   * Lấy statistics về registry
   */
  getStats(): RegistryStats {
    const toolsByServer = new Map<string, number>();
    let enabledTools = 0;
    let disabledTools = 0;

    for (const tool of this.tools.values()) {
      // Count by server
      const count = toolsByServer.get(tool.serverName) || 0;
      toolsByServer.set(tool.serverName, count + 1);

      // Count enabled/disabled
      if (tool.enabled) {
        enabledTools++;
      } else {
        disabledTools++;
      }
    }

    return {
      totalTools: this.tools.size,
      enabledTools,
      disabledTools,
      serverCount: this.serverTools.size,
      toolsByServer,
    };
  }

  // ==========================================================================
  // Export Methods
  // ==========================================================================

  /**
   * Export tools theo format cho Claude tool_use
   *
   * @param filter - Filter options
   * @returns Array của tools trong format Claude API
   */
  exportForClaude(filter?: ToolFilterOptions): Array<{
    name: string;
    description: string;
    input_schema: ToolInputSchema;
  }> {
    const tools = this.getAllTools({
      ...filter,
      enabledOnly: true, // Chỉ export enabled tools
    });

    return tools.map((tool) => ({
      name: tool.qualifiedName, // Dùng qualified name để tránh trùng
      description: tool.description || '',
      input_schema: tool.inputSchema,
    }));
  }

  /**
   * Export thành JSON
   */
  toJSON(): object {
    return {
      tools: Array.from(this.tools.values()).map((tool) => ({
        serverName: tool.serverName,
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
        enabled: tool.enabled,
        registeredAt: tool.registeredAt.toISOString(),
        metadata: tool.metadata,
      })),
    };
  }

  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================

  /**
   * Tạo qualified name từ server name và tool name
   */
  private createQualifiedName(serverName: string, toolName: string): string {
    // Dùng format mcp__serverName__toolName để match với convention của Claude
    return `mcp__${serverName}__${toolName}`;
  }

  /**
   * Apply filter lên danh sách tools
   */
  private applyFilter(tools: RegisteredTool[], filter: ToolFilterOptions): RegisteredTool[] {
    return tools.filter((tool) => {
      // Filter by server name
      if (filter.serverName && tool.serverName !== filter.serverName) {
        return false;
      }

      // Filter by enabled state
      if (filter.enabledOnly && !tool.enabled) {
        return false;
      }

      // Filter by name pattern
      if (filter.namePattern) {
        const pattern =
          filter.namePattern instanceof RegExp
            ? filter.namePattern
            : new RegExp(filter.namePattern, 'i');
        if (!pattern.test(tool.name)) {
          return false;
        }
      }

      // Filter by description pattern
      if (filter.descriptionPattern) {
        const pattern =
          filter.descriptionPattern instanceof RegExp
            ? filter.descriptionPattern
            : new RegExp(filter.descriptionPattern, 'i');
        if (!tool.description || !pattern.test(tool.description)) {
          return false;
        }
      }

      return true;
    });
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Tạo ToolRegistry instance mới
 */
export function createToolRegistry(): ToolRegistry {
  return new ToolRegistry();
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse qualified name thành server name và tool name
 */
export function parseQualifiedName(qualifiedName: string): {
  serverName: string;
  toolName: string;
} | null {
  // Format: mcp__serverName__toolName
  const match = qualifiedName.match(/^mcp__([^_]+)__(.+)$/);
  if (!match) {
    return null;
  }
  return {
    serverName: match[1],
    toolName: match[2],
  };
}

/**
 * Kiểm tra có phải qualified name của MCP tool không
 */
export function isMcpToolName(name: string): boolean {
  return name.startsWith('mcp__');
}
