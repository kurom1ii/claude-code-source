/**
 * Claude Code - Hooks Module
 *
 * Module exports cho hook system
 * Hooks cho phép users chạy shell commands hoặc LLM prompts
 * khi có events (tool calls, session start, etc.)
 *
 * ## Quick Start
 *
 * ```typescript
 * import { getHookManager, getHookExecutor, executeHooks } from './hooks';
 *
 * // Khởi tạo HookManager với project directory
 * const manager = getHookManager('/path/to/project');
 *
 * // Load tất cả hooks
 * await manager.loadAllHooks();
 *
 * // Get matching hooks cho một event
 * const matchedHooks = await manager.getMatchingHooks(
 *   appState,
 *   agentId,
 *   'PreToolUse',
 *   hookInput
 * );
 *
 * // Execute hooks
 * const results = await executeHooks(matchedHooks, hookInput, {
 *   signal: abortController.signal,
 * });
 * ```
 *
 * ## Hook Events
 *
 * - PreToolUse: Trước khi tool được thực thi
 * - PostToolUse: Sau khi tool thực thi thành công
 * - PostToolUseFailure: Sau khi tool thực thi thất bại
 * - Notification: Khi có thông báo
 * - UserPromptSubmit: Khi user submit prompt
 * - SessionStart: Khi session bắt đầu
 * - SessionEnd: Khi session kết thúc
 * - Setup: Khi khởi tạo hoặc maintenance
 * - Stop: Khi agent dừng
 * - SubagentStart: Khi subagent bắt đầu
 * - SubagentStop: Khi subagent dừng
 * - PreCompact: Trước khi compact context
 * - PermissionRequest: Khi yêu cầu permission
 *
 * ## Hook Types
 *
 * - Command hooks: Chạy shell commands
 * - Prompt hooks: Gửi prompt tới LLM để evaluate
 * - Agent hooks: Dùng agent để verify kết quả
 * - Callback hooks: Internal hooks với callback functions
 * - Function hooks: Internal hooks cho Stop events
 *
 * ## Hook Configuration
 *
 * Hooks được cấu hình trong settings files:
 *
 * ```json
 * {
 *   "hooks": {
 *     "PreToolUse": [
 *       {
 *         "matcher": "Write",
 *         "hooks": [
 *           {
 *             "type": "command",
 *             "command": "echo 'About to write file'"
 *           }
 *         ]
 *       }
 *     ]
 *   }
 * }
 * ```
 */

// ============================================================================
// Types - Re-export tất cả types
// ============================================================================

export type {
  // Hook Event Types
  HookEventType,

  // Hook Definition Types
  CommandHook,
  PromptHook,
  AgentHook,
  HookDefinition,
  CallbackHookDefinition,
  FunctionHookDefinition,
  ExtendedHookDefinition,

  // Hook Config Types
  HookMatcher,
  HookConfig,

  // Hook Input Types
  BaseHookInput,
  PreToolUseHookInput,
  PostToolUseHookInput,
  PostToolUseFailureHookInput,
  NotificationHookInput,
  UserPromptSubmitHookInput,
  SessionStartHookInput,
  SessionEndHookInput,
  SetupHookInput,
  StopHookInput,
  SubagentStartHookInput,
  SubagentStopHookInput,
  PreCompactHookInput,
  PermissionRequestHookInput,
  HookInput,

  // Hook Output Types
  AsyncHookResponse,
  SyncHookResponse,
  HookResponse,
  HookCallbackResponse,
  PermissionDecision,
  PermissionBehavior,
  PermissionSuggestion,
  HookSpecificOutput,
  PreToolUseHookOutput,
  PostToolUseHookOutput,
  PermissionRequestHookOutput,
  GenericHookOutput,

  // Hook Execution Types
  HookContext,
  HookOutcome,
  HookBlockingError,
  HookExecutionResult,
  MatchedHook,

  // Hook Source Types
  HookSource,
} from './types';

// ============================================================================
// Schemas - Re-export Zod schemas
// ============================================================================

export {
  // Constants
  HookEventTypes,

  // Schemas
  CommandHookSchema,
  PromptHookSchema,
  AgentHookSchema,
  HookDefinitionSchema,
  HookMatcherSchema,
  HookEventTypeSchema,
  HookConfigSchema,

  // Type Guards
  isAsyncResponse,
  isSyncResponse,
  isCommandHook,
  isPromptHook,
  isAgentHook,
  isCallbackHook,
  isFunctionHook,

  // Helper Functions
  getHookSourceDescription,
} from './types';

// ============================================================================
// Events - Re-export event helpers
// ============================================================================

export {
  // Event Descriptions
  HookEventDescriptions,

  // Event Categories
  ToolEvents,
  SessionEvents,
  AgentEvents,
  UserEvents,
  SystemEvents,

  // Input Builders
  createBaseHookInput,
  createPreToolUseInput,
  createPostToolUseInput,
  createPostToolUseFailureInput,
  createNotificationInput,
  createUserPromptSubmitInput,
  createSessionStartInput,
  createSessionEndInput,
  createSetupInput,
  createStopInput,
  createSubagentStartInput,
  createSubagentStopInput,
  createPreCompactInput,
  createPermissionRequestInput,

  // Event Matchers
  getMatchQueryFromInput,

  // Event Validation
  supportsBlockingResponse,
  supportsUpdatedInput,
  supportsAdditionalContext,
  requiresMessages,
  canRunOutsideREPL,

  // Event Logging
  shouldLogEvent,
  formatEventName,
  getEventShortDescription,
} from './events';

// ============================================================================
// Config - Re-export config functions
// ============================================================================

export {
  // Load Functions
  loadHooksFromSettingsFile,
  loadHooksFromHooksFile,
  loadUserHooks,
  loadProjectHooks,
  loadLocalHooks,
  loadPluginHooks,

  // Merge Functions
  mergeHookConfigs,
  loadAllHooks,

  // Validation
  validateHookConfig,
  isValidEventType,

  // Settings Helpers
  isAllHooksDisabled,
  isManagedHooksOnly,

  // Path Helpers
  getAbsolutePath,
  getUserSettingsPath,
  getProjectSettingsPath,
  getLocalSettingsPath,
  getPluginsDirectory,
  getClaudeConfigDirectory,
  createEnvFilePath,

  // Types
  type PluginHooksResult,
} from './HookConfig';

// ============================================================================
// Manager - Re-export manager classes và functions
// ============================================================================

export {
  // Class
  HookManager,

  // Singleton Functions
  getHookManager,
  resetHookManager,
} from './HookManager';

// ============================================================================
// Executor - Re-export executor classes và functions
// ============================================================================

export {
  // Class
  HookExecutor,

  // Singleton Functions
  getHookExecutor,
  resetHookExecutor,

  // Convenience Functions
  executeHooks,
  hasBlockingError,
  getBlockingError,
  aggregateAdditionalContexts,
} from './HookExecutor';

// ============================================================================
// High-Level API - Convenience functions
// ============================================================================

import { getHookManager, resetHookManager } from './HookManager';
import { getHookExecutor, executeHooks, hasBlockingError, getBlockingError } from './HookExecutor';
import type { HookInput, HookExecutionResult, HookContext } from './types';

/**
 * Khởi tạo hook system với project directory
 */
export async function initializeHooks(projectDir: string): Promise<void> {
  const manager = getHookManager(projectDir);
  await manager.loadAllHooks();
}

/**
 * Cleanup hook system - gọi khi session end
 */
export function cleanupHooks(): void {
  const manager = getHookManager();
  manager.clearAllSessionHooks();
  resetHookManager();
}

/**
 * Execute hooks cho một event - high-level API
 */
export async function triggerHooks(
  projectDir: string,
  agentId: string,
  input: HookInput,
  options: {
    appState?: unknown;
    toolUseId?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
    context?: HookContext;
    messages?: unknown[];
    forceSyncExecution?: boolean;
    onProgress?: (result: HookExecutionResult) => void;
  } = {}
): Promise<{
  results: HookExecutionResult[];
  blocked: boolean;
  blockingError?: string;
  additionalContexts: string[];
}> {
  const { appState, ...executeOptions } = options;

  // Get manager và load hooks
  const manager = getHookManager(projectDir);
  await manager.loadAllHooks();

  // Get matching hooks
  const matchedHooks = await manager.getMatchingHooks(
    appState,
    agentId,
    input.hook_event_name,
    input
  );

  // Không có hooks để chạy
  if (matchedHooks.length === 0) {
    return {
      results: [],
      blocked: false,
      additionalContexts: [],
    };
  }

  // Execute hooks
  const results = await executeHooks(matchedHooks, input, executeOptions);

  // Aggregate results
  const blocked = hasBlockingError(results);
  const blockingError = getBlockingError(results)?.blockingError;
  const additionalContexts = results
    .filter((r) => r.additionalContext)
    .map((r) => r.additionalContext!);

  return {
    results,
    blocked,
    blockingError,
    additionalContexts,
  };
}
