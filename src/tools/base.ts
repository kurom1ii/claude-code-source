/**
 * Claude Code - Tools Base
 * Base classes và interfaces cho tool system
 */

import type { ToolDefinition, ToolResult, ToolInputSchema } from '../types';

// ============================================================================
// Base Tool Class
// ============================================================================

/**
 * Abstract base class cho tất cả tools
 */
export abstract class BaseTool {
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly inputSchema: ToolInputSchema;

  /**
   * Execute tool với input
   * @param input - Input parameters
   */
  abstract execute(input: Record<string, unknown>): Promise<ToolResult>;

  /**
   * Lấy tool definition cho API
   */
  getDefinition(): ToolDefinition {
    return {
      name: this.name,
      description: this.description,
      input_schema: this.inputSchema,
    };
  }

  /**
   * Helper để tạo success result
   */
  protected success(output: string): ToolResult {
    return { success: true, output };
  }

  /**
   * Helper để tạo error result
   */
  protected error(error: string): ToolResult {
    return { success: false, error };
  }
}

// ============================================================================
// Tool Registry
// ============================================================================

const toolRegistry = new Map<string, BaseTool>();

/**
 * Đăng ký tool
 */
export function registerTool(tool: BaseTool): void {
  toolRegistry.set(tool.name, tool);
}

/**
 * Lấy tool theo tên
 */
export function getTool(name: string): BaseTool | undefined {
  return toolRegistry.get(name);
}

/**
 * Lấy tất cả tools
 */
export function getAllTools(): BaseTool[] {
  return Array.from(toolRegistry.values());
}

/**
 * Lấy tool definitions cho API
 */
export function getToolDefinitions(): ToolDefinition[] {
  return getAllTools().map((tool) => tool.getDefinition());
}

/**
 * Execute tool theo tên
 */
export async function executeTool(
  name: string,
  input: Record<string, unknown>
): Promise<ToolResult> {
  const tool = getTool(name);
  if (!tool) {
    return { success: false, error: `Tool not found: ${name}` };
  }

  try {
    return await tool.execute(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { success: false, error: message };
  }
}
