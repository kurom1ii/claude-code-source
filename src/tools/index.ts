/**
 * Claude Code - Built-in Tools
 *
 * Module nay export tat ca cac tools co san trong Claude Code.
 *
 * Cac nhom tools:
 * - File System: Read, Write, Edit, Glob, Grep
 * - Shell: Bash
 * - Web: WebFetch, WebSearch
 * - Agent: Task
 * - Utility: LSP
 */

// ============================================================================
// Type Exports
// ============================================================================

export * from './types';

// Import types for internal use
import type { ToolDefinition, ToolCategory, ExecutionContext, ToolResult } from './types';

// ============================================================================
// Tool Imports
// ============================================================================

// File System Tools
import BashToolModule, {
  bashToolDefinition,
  createBashToolHandler,
  validateBashInput,
  checkDangerousCommand,
  isBlockedInSandbox,
  type BashToolInput,
  type BashToolOutput,
} from './BashTool';

import ReadToolModule, {
  readToolDefinition,
  createReadToolHandler,
  validateReadInput,
  detectFileType,
  parsePageRange,
  formatWithLineNumbers,
  type ReadToolInput,
  type ReadToolOutput,
  type FileType,
} from './ReadTool';

import WriteToolModule, {
  writeToolDefinition,
  createWriteToolHandler,
  validateWriteInput,
  isSensitiveFile,
  isProtectedFile,
  isDocumentationFile,
  writeFileSafely,
  type WriteToolInput,
  type WriteToolOutput,
} from './WriteTool';

import EditToolModule, {
  editToolDefinition,
  createEditToolHandler,
  validateEditInput,
  countOccurrences,
  createSimpleDiff,
  multipleReplacements,
  findAllPositions,
  type EditToolInput,
  type EditToolOutput,
} from './EditTool';

import GlobToolModule, {
  globToolDefinition,
  createGlobToolHandler,
  validateGlobInput,
  globToRegex,
  shouldIgnore,
  multiGlob,
  findByExtension,
  DEFAULT_IGNORE_DIRS,
  type GlobToolInput,
  type GlobToolOutput,
  type MatchedFile,
} from './GlobTool';

import GrepToolModule, {
  grepToolDefinition,
  createGrepToolHandler,
  validateGrepInput,
  createSearchRegex,
  getGlobFromType,
  searchAndReplace,
  TYPE_TO_GLOB,
  type GrepToolInput,
  type GrepToolOutput,
  type GrepOutputMode,
  type GrepMatch,
} from './GrepTool';

// Agent Tools
import TaskToolModule, {
  taskToolDefinition,
  createTaskToolHandler,
  validateTaskInput,
  generateTaskId,
  getRecommendedModel,
  createTaskManager,
  RECOMMENDED_MODELS,
  SUBAGENT_DESCRIPTIONS,
  type TaskToolInput,
  type TaskToolOutput,
  type TaskStatus,
  type SubagentType,
  type TaskManager,
  type TaskInfo,
} from './TaskTool';

// Web Tools
import WebFetchToolModule, {
  webFetchToolDefinition,
  createWebFetchToolHandler,
  validateWebFetchInput,
  checkAuthenticatedDomain,
  upgradeToHttps,
  htmlToMarkdown,
  AUTHENTICATED_DOMAINS,
  type WebFetchToolInput,
  type WebFetchToolOutput,
} from './WebFetchTool';

import WebSearchToolModule, {
  webSearchToolDefinition,
  createWebSearchToolHandler,
  validateWebSearchInput,
  filterResultsByDomain,
  extractDomain,
  formatResultsAsMarkdown,
  generateSources,
  type WebSearchToolInput,
  type WebSearchToolOutput,
  type SearchResult,
} from './WebSearchTool';

// Utility Tools
import LSPToolModule, {
  lspToolDefinition,
  createLSPToolHandler,
  validateLSPInput,
  formatPosition,
  formatRange,
  formatLocation,
  SEVERITY_MAP,
  SYMBOL_KIND_MAP,
  type LSPToolInput,
  type LSPToolOutput,
  type LSPOperation,
  type Position,
  type Range,
  type Location,
  type Diagnostic,
  type HoverInfo,
  type CompletionItem,
  type DocumentSymbol,
} from './LSPTool';

// ============================================================================
// Re-exports - Tool Definitions
// ============================================================================

export {
  // Bash
  bashToolDefinition,
  createBashToolHandler,
  validateBashInput,
  checkDangerousCommand,
  isBlockedInSandbox,
  type BashToolInput,
  type BashToolOutput,

  // Read
  readToolDefinition,
  createReadToolHandler,
  validateReadInput,
  detectFileType,
  parsePageRange,
  formatWithLineNumbers,
  type ReadToolInput,
  type ReadToolOutput,
  type FileType,

  // Write
  writeToolDefinition,
  createWriteToolHandler,
  validateWriteInput,
  isSensitiveFile,
  isProtectedFile,
  isDocumentationFile,
  writeFileSafely,
  type WriteToolInput,
  type WriteToolOutput,

  // Edit
  editToolDefinition,
  createEditToolHandler,
  validateEditInput,
  countOccurrences,
  createSimpleDiff,
  multipleReplacements,
  findAllPositions,
  type EditToolInput,
  type EditToolOutput,

  // Glob
  globToolDefinition,
  createGlobToolHandler,
  validateGlobInput,
  globToRegex,
  shouldIgnore,
  multiGlob,
  findByExtension,
  DEFAULT_IGNORE_DIRS,
  type GlobToolInput,
  type GlobToolOutput,
  type MatchedFile,

  // Grep
  grepToolDefinition,
  createGrepToolHandler,
  validateGrepInput,
  createSearchRegex,
  getGlobFromType,
  searchAndReplace,
  TYPE_TO_GLOB,
  type GrepToolInput,
  type GrepToolOutput,
  type GrepOutputMode,
  type GrepMatch,

  // Task
  taskToolDefinition,
  createTaskToolHandler,
  validateTaskInput,
  generateTaskId,
  getRecommendedModel,
  createTaskManager,
  RECOMMENDED_MODELS,
  SUBAGENT_DESCRIPTIONS,
  type TaskToolInput,
  type TaskToolOutput,
  type TaskStatus,
  type SubagentType,
  type TaskManager,
  type TaskInfo,

  // WebFetch
  webFetchToolDefinition,
  createWebFetchToolHandler,
  validateWebFetchInput,
  checkAuthenticatedDomain,
  upgradeToHttps,
  htmlToMarkdown,
  AUTHENTICATED_DOMAINS,
  type WebFetchToolInput,
  type WebFetchToolOutput,

  // WebSearch
  webSearchToolDefinition,
  createWebSearchToolHandler,
  validateWebSearchInput,
  filterResultsByDomain,
  extractDomain,
  formatResultsAsMarkdown,
  generateSources,
  type WebSearchToolInput,
  type WebSearchToolOutput,
  type SearchResult,

  // LSP
  lspToolDefinition,
  createLSPToolHandler,
  validateLSPInput,
  formatPosition,
  formatRange,
  formatLocation,
  SEVERITY_MAP,
  SYMBOL_KIND_MAP,
  type LSPToolInput,
  type LSPToolOutput,
  type LSPOperation,
  type Position,
  type Range,
  type Location,
  type Diagnostic,
  type HoverInfo,
  type CompletionItem,
  type DocumentSymbol,
};

// ============================================================================
// Tool Modules (grouped exports)
// ============================================================================

export const BashTool = BashToolModule;
export const ReadTool = ReadToolModule;
export const WriteTool = WriteToolModule;
export const EditTool = EditToolModule;
export const GlobTool = GlobToolModule;
export const GrepTool = GrepToolModule;
export const TaskTool = TaskToolModule;
export const WebFetchTool = WebFetchToolModule;
export const WebSearchTool = WebSearchToolModule;
export const LSPTool = LSPToolModule;

// ============================================================================
// Built-in Tools Registry
// ============================================================================

import type { ToolDefinition, ToolCategory } from './types';

/**
 * Danh sach tat ca tool definitions
 */
export const BUILTIN_TOOLS: ToolDefinition[] = [
  // File System
  readToolDefinition,
  writeToolDefinition,
  editToolDefinition,
  globToolDefinition,
  grepToolDefinition,

  // Shell
  bashToolDefinition,

  // Web
  webFetchToolDefinition,
  webSearchToolDefinition,

  // Agent
  taskToolDefinition,

  // Utility
  lspToolDefinition,
];

/**
 * Lay tool theo ten
 * @param name - Ten tool
 * @returns Tool definition hoac undefined
 */
export function getTool(name: string): ToolDefinition | undefined {
  return BUILTIN_TOOLS.find(t => t.name.toLowerCase() === name.toLowerCase());
}

/**
 * Lay tat ca tools can xac nhan
 * @returns Danh sach tools can confirmation
 */
export function getToolsRequiringConfirmation(): ToolDefinition[] {
  return BUILTIN_TOOLS.filter(t => t.requiresConfirmation);
}

/**
 * Lay tools theo danh muc
 * @param category - Danh muc can loc
 * @returns Danh sach tools trong danh muc
 */
export function getToolsByCategory(category: ToolCategory): ToolDefinition[] {
  return BUILTIN_TOOLS.filter(t => t.category === category);
}

/**
 * Loc tools theo allowlist
 * @param tools - Danh sach tools can loc
 * @param allowedTools - Cac tool duoc phep ('*' = tat ca)
 * @returns Danh sach tools da loc
 */
export function filterToolsByAllowlist(
  tools: ToolDefinition[],
  allowedTools: string[] | '*'
): ToolDefinition[] {
  if (allowedTools === '*') {
    return tools;
  }

  const allowedSet = new Set(allowedTools.map(t => t.toLowerCase()));
  return tools.filter(tool => allowedSet.has(tool.name.toLowerCase()));
}

/**
 * Tao map tu ten tool -> handler factory
 */
export const TOOL_HANDLER_FACTORIES = {
  Bash: createBashToolHandler,
  Read: createReadToolHandler,
  Write: createWriteToolHandler,
  Edit: createEditToolHandler,
  Glob: createGlobToolHandler,
  Grep: createGrepToolHandler,
  Task: createTaskToolHandler,
  WebFetch: createWebFetchToolHandler,
  WebSearch: createWebSearchToolHandler,
  LSP: createLSPToolHandler,
} as const;

/**
 * Tao map tu ten tool -> validator
 */
export const TOOL_VALIDATORS = {
  Bash: validateBashInput,
  Read: validateReadInput,
  Write: validateWriteInput,
  Edit: validateEditInput,
  Glob: validateGlobInput,
  Grep: validateGrepInput,
  Task: validateTaskInput,
  WebFetch: validateWebFetchInput,
  WebSearch: validateWebSearchInput,
  LSP: validateLSPInput,
} as const;

// ============================================================================
// Default Export
// ============================================================================

// ============================================================================
// Execution Functions
// ============================================================================

/**
 * Lay tool definitions cho API request
 * @returns Array cua tool definitions theo format API
 */
export function getToolDefinitions(): Array<{
  name: string;
  description: string;
  input_schema: {
    type: 'object';
    properties: Record<string, unknown>;
    required: string[];
  };
}> {
  return BUILTIN_TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: {
      type: 'object' as const,
      properties: Object.fromEntries(
        Object.entries(tool.parameters).map(([key, param]) => [
          key,
          {
            type: param.type,
            description: param.description,
            ...(param.enum ? { enum: param.enum } : {}),
            ...(param.default !== undefined ? { default: param.default } : {}),
          },
        ])
      ),
      required: Object.entries(tool.parameters)
        .filter(([_, param]) => param.required)
        .map(([key]) => key),
    },
  }));
}

/**
 * Thuc thi mot tool voi input cho truoc
 * @param toolName - Ten tool can chay
 * @param input - Input parameters
 * @param context - Execution context (optional)
 * @returns Tool result
 */
export async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
  context?: ExecutionContext
): Promise<ToolResult> {
  const startTime = Date.now();

  // Default context
  const ctx: ExecutionContext = context ?? {
    workingDirectory: process.cwd(),
    environment: process.env as Record<string, string>,
    sandboxMode: false,
    defaultTimeout: 120000,
  };

  // Tim tool handler factory
  const factoryName = toolName as keyof typeof TOOL_HANDLER_FACTORIES;
  const factory = TOOL_HANDLER_FACTORIES[factoryName];

  if (!factory) {
    return {
      success: false,
      error: `Unknown tool: ${toolName}`,
      executionTime: Date.now() - startTime,
    };
  }

  // Tao handler va validate
  const handler = factory(ctx);
  const validationResult = handler.validateInput(input);

  if (typeof validationResult === 'string') {
    return {
      success: false,
      error: validationResult,
      executionTime: Date.now() - startTime,
    };
  }

  // Thuc thi
  try {
    const output = await handler.execute(input, ctx);
    return {
      success: true,
      output,
      executionTime: Date.now() - startTime,
    };
  } catch (error) {
    const err = error as Error;
    return {
      success: false,
      error: err.message,
      executionTime: Date.now() - startTime,
    };
  }
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Tools
  BashTool,
  ReadTool,
  WriteTool,
  EditTool,
  GlobTool,
  GrepTool,
  TaskTool,
  WebFetchTool,
  WebSearchTool,
  LSPTool,

  // Registry
  BUILTIN_TOOLS,
  getTool,
  getToolsRequiringConfirmation,
  getToolsByCategory,
  filterToolsByAllowlist,

  // Factories & Validators
  TOOL_HANDLER_FACTORIES,
  TOOL_VALIDATORS,

  // Execution
  getToolDefinitions,
  executeTool,
};
