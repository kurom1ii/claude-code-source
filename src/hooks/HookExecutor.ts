/**
 * Claude Code - Hook Executor
 *
 * Thực thi hooks khi được trigger:
 * - Command hooks: Chạy shell commands
 * - Prompt hooks: Gửi prompt tới LLM
 * - Agent hooks: Dùng agent để verify
 * - Callback hooks: Gọi callback functions
 * - Function hooks: Gọi functions (cho Stop hooks)
 */

import { spawn, ChildProcess } from 'child_process';
import type {
  HookInput,
  HookEventType,
  ExtendedHookDefinition,
  HookExecutionResult,
  HookResponse,
  HookBlockingError,
  MatchedHook,
  CommandHook,
  PromptHook,
  AgentHook,
  CallbackHookDefinition,
  FunctionHookDefinition,
  HookContext,
  AsyncHookResponse,
  SyncHookResponse,
  HookOutcome,
} from './types';
import { isAsyncResponse, isCommandHook, isPromptHook, isAgentHook, isCallbackHook, isFunctionHook } from './types';
import { formatEventName, shouldLogEvent } from './events';

// ============================================================================
// Constants - Hằng số
// ============================================================================

/** Default timeout cho hook execution (10 phút) */
const DEFAULT_HOOK_TIMEOUT_MS = 600_000;

/** Exit code để indicate blocking error */
const BLOCKING_EXIT_CODE = 2;

// ============================================================================
// Execution Result Interface
// ============================================================================

/**
 * Kết quả chạy command
 */
interface CommandExecutionResult {
  /** stdout output */
  stdout: string;
  /** stderr output */
  stderr: string;
  /** Combined output (stdout + stderr) */
  output: string;
  /** Exit status code */
  status: number;
  /** True nếu bị abort */
  aborted?: boolean;
  /** True nếu chạy background */
  backgrounded?: boolean;
}

// ============================================================================
// Command Executor - Chạy shell commands
// ============================================================================

/**
 * Execute một shell command
 */
async function executeCommand(
  command: string,
  input: string,
  options: {
    signal?: AbortSignal;
    timeoutMs?: number;
    env?: Record<string, string>;
    cwd?: string;
    pluginRoot?: string;
    skillRoot?: string;
  } = {}
): Promise<CommandExecutionResult> {
  const {
    signal,
    timeoutMs = DEFAULT_HOOK_TIMEOUT_MS,
    env = {},
    cwd = process.cwd(),
    pluginRoot,
    skillRoot,
  } = options;

  // Replace placeholder variables trong command
  let processedCommand = command;
  if (pluginRoot) {
    processedCommand = processedCommand.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginRoot);
  }

  // Setup environment
  const processEnv: Record<string, string> = {
    ...process.env as Record<string, string>,
    ...env,
    CLAUDE_PROJECT_DIR: cwd,
  };

  if (pluginRoot) {
    processEnv.CLAUDE_PLUGIN_ROOT = pluginRoot;
  }
  if (skillRoot) {
    processEnv.CLAUDE_SKILL_ROOT = skillRoot;
  }

  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let output = '';
    let aborted = false;

    // Spawn child process với shell
    const child = spawn(processedCommand, [], {
      shell: true,
      cwd,
      env: processEnv,
      windowsHide: true,
    });

    // Setup timeout
    const timeoutId = setTimeout(() => {
      child.kill('SIGTERM');
      aborted = true;
    }, timeoutMs);

    // Handle abort signal
    const onAbort = () => {
      child.kill('SIGTERM');
      aborted = true;
    };

    if (signal) {
      signal.addEventListener('abort', onAbort);
    }

    // Collect stdout
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (data: string) => {
      stdout += data;
      output += data;
    });

    // Collect stderr
    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (data: string) => {
      stderr += data;
      output += data;
    });

    // Write input to stdin
    child.stdin.write(input, 'utf8');
    child.stdin.end();

    // Handle stdin errors
    child.stdin.on('error', (error: NodeJS.ErrnoException) => {
      if (error.code === 'EPIPE') {
        // Hook đóng stdin sớm - không phải lỗi nghiêm trọng
        stderr += 'Hook command closed stdin before input was fully written (EPIPE)\n';
      }
    });

    // Handle process exit
    child.on('close', (code: number | null) => {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }

      resolve({
        stdout,
        stderr,
        output,
        status: code ?? 1,
        aborted,
      });
    });

    // Handle spawn errors
    child.on('error', (error: Error) => {
      clearTimeout(timeoutId);
      if (signal) {
        signal.removeEventListener('abort', onAbort);
      }

      resolve({
        stdout: '',
        stderr: `Failed to execute command: ${error.message}`,
        output: `Failed to execute command: ${error.message}`,
        status: 1,
      });
    });
  });
}

// ============================================================================
// Response Parser - Parse hook output
// ============================================================================

/**
 * Parse JSON output từ hook
 */
function parseHookOutput(stdout: string): {
  json?: HookResponse;
  plainText?: string;
  validationError?: string;
} {
  const trimmed = stdout.trim();

  // Try parse as JSON
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const parsed = JSON.parse(trimmed);
      return { json: parsed };
    } catch (error) {
      return {
        validationError: `Invalid JSON output: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // Plain text output
  return { plainText: trimmed };
}

/**
 * Process hook response thành execution result
 */
function processHookResponse(
  response: HookResponse,
  hook: ExtendedHookDefinition,
  eventType: HookEventType,
  hookName: string,
  stdout?: string,
  stderr?: string,
  exitCode?: number
): Partial<HookExecutionResult> {
  const result: Partial<HookExecutionResult> = {};

  // Check if async response
  if (isAsyncResponse(response)) {
    return { outcome: 'success' };
  }

  const syncResponse = response as SyncHookResponse;

  // Handle continue = false
  if (syncResponse.continue === false) {
    result.preventContinuation = true;
    if (syncResponse.stopReason) {
      result.stopReason = syncResponse.stopReason;
    }
  }

  // Handle decision
  if (syncResponse.decision) {
    switch (syncResponse.decision) {
      case 'approve':
        result.permissionBehavior = 'allow';
        break;
      case 'block':
        result.permissionBehavior = 'deny';
        result.blockingError = {
          blockingError: syncResponse.reason || 'Blocked by hook',
          command: isCommandHook(hook) ? hook.command : 'prompt',
        };
        break;
    }
  }

  // Handle systemMessage
  if (syncResponse.systemMessage) {
    result.systemMessage = syncResponse.systemMessage;
  }

  // Handle hookSpecificOutput
  if (syncResponse.hookSpecificOutput) {
    const specificOutput = syncResponse.hookSpecificOutput;

    switch (specificOutput.hookEventName) {
      case 'PreToolUse':
        if (specificOutput.permissionDecision) {
          switch (specificOutput.permissionDecision) {
            case 'allow':
              result.permissionBehavior = 'allow';
              break;
            case 'deny':
              result.permissionBehavior = 'deny';
              result.blockingError = {
                blockingError:
                  specificOutput.permissionDecisionReason ||
                  syncResponse.reason ||
                  'Blocked by hook',
                command: isCommandHook(hook) ? hook.command : 'prompt',
              };
              break;
            case 'ask':
              result.permissionBehavior = 'ask';
              break;
          }
        }
        result.hookPermissionDecisionReason = specificOutput.permissionDecisionReason;
        if (specificOutput.updatedInput) {
          result.updatedInput = specificOutput.updatedInput;
        }
        result.additionalContext = specificOutput.additionalContext;
        break;

      case 'PostToolUse':
        result.additionalContext = specificOutput.additionalContext;
        if (specificOutput.updatedMCPToolOutput !== undefined) {
          result.updatedMCPToolOutput = specificOutput.updatedMCPToolOutput;
        }
        break;

      case 'PermissionRequest':
        if (specificOutput.decision) {
          result.permissionRequestResult = specificOutput.decision;
          result.permissionBehavior =
            specificOutput.decision.behavior === 'allow' ? 'allow' : 'deny';
          if (
            specificOutput.decision.behavior === 'allow' &&
            specificOutput.decision.updatedInput
          ) {
            result.updatedInput = specificOutput.decision.updatedInput;
          }
        }
        break;

      case 'UserPromptSubmit':
      case 'SessionStart':
      case 'Setup':
      case 'SubagentStart':
      case 'PostToolUseFailure':
      case 'Notification':
        result.additionalContext = specificOutput.additionalContext;
        break;
    }
  }

  return result;
}

// ============================================================================
// Hook Executor Class
// ============================================================================

/**
 * HookExecutor - Thực thi hooks
 */
export class HookExecutor {
  /** Default timeout (ms) */
  private defaultTimeoutMs: number;

  constructor(options: { defaultTimeoutMs?: number } = {}) {
    this.defaultTimeoutMs = options.defaultTimeoutMs || DEFAULT_HOOK_TIMEOUT_MS;
  }

  // ==========================================================================
  // Main Execution Methods
  // ==========================================================================

  /**
   * Execute một hook
   */
  async execute(
    matched: MatchedHook,
    input: HookInput,
    options: {
      toolUseId?: string;
      signal?: AbortSignal;
      timeoutMs?: number;
      context?: HookContext;
      messages?: unknown[];
      forceSyncExecution?: boolean;
    } = {}
  ): Promise<HookExecutionResult> {
    const { hook, pluginRoot, skillRoot } = matched;
    const {
      toolUseId,
      signal,
      timeoutMs = this.defaultTimeoutMs,
      context,
      messages,
      forceSyncExecution,
    } = options;

    const eventType = input.hook_event_name;
    const hookName = formatEventName(eventType);

    // Route to appropriate executor based on hook type
    if (isCommandHook(hook)) {
      return this.executeCommandHook(hook, input, {
        hookName,
        eventType,
        toolUseId,
        signal,
        timeoutMs,
        pluginRoot,
        skillRoot,
        forceSyncExecution,
      });
    }

    if (isPromptHook(hook)) {
      return this.executePromptHook(hook, input, {
        hookName,
        eventType,
        toolUseId,
        signal,
        timeoutMs,
        context,
        messages,
      });
    }

    if (isAgentHook(hook)) {
      return this.executeAgentHook(hook, input, {
        hookName,
        eventType,
        toolUseId,
        signal,
        timeoutMs,
        context,
        messages,
      });
    }

    if (isCallbackHook(hook)) {
      return this.executeCallbackHook(hook, input, {
        hookName,
        eventType,
        toolUseId,
        signal,
        timeoutMs,
        context,
      });
    }

    if (isFunctionHook(hook)) {
      return this.executeFunctionHook(hook, {
        hookName,
        eventType,
        toolUseId,
        signal,
        timeoutMs,
        messages,
      });
    }

    return {
      outcome: 'non_blocking_error',
      hook,
      message: `Unknown hook type: ${(hook as any).type}`,
    };
  }

  // ==========================================================================
  // Command Hook Execution
  // ==========================================================================

  /**
   * Execute command hook
   */
  private async executeCommandHook(
    hook: CommandHook,
    input: HookInput,
    options: {
      hookName: string;
      eventType: HookEventType;
      toolUseId?: string;
      signal?: AbortSignal;
      timeoutMs?: number;
      pluginRoot?: string;
      skillRoot?: string;
      forceSyncExecution?: boolean;
    }
  ): Promise<HookExecutionResult> {
    const {
      hookName,
      eventType,
      toolUseId,
      signal,
      pluginRoot,
      skillRoot,
      forceSyncExecution,
    } = options;

    // Calculate timeout
    const timeoutMs = hook.timeout ? hook.timeout * 1000 : (options.timeoutMs || this.defaultTimeoutMs);

    // Serialize input to JSON
    let inputJson: string;
    try {
      inputJson = JSON.stringify(input);
    } catch (error) {
      return {
        outcome: 'non_blocking_error',
        hook,
        message: `Failed to serialize hook input: ${error instanceof Error ? error.message : String(error)}`,
      };
    }

    // Check abort signal
    if (signal?.aborted) {
      return {
        outcome: 'cancelled',
        hook,
      };
    }

    // Execute command
    const result = await executeCommand(hook.command, inputJson, {
      signal,
      timeoutMs,
      cwd: input.cwd,
      pluginRoot,
      skillRoot,
    });

    // Handle aborted
    if (result.aborted) {
      return {
        outcome: 'cancelled',
        hook,
        message: 'Hook cancelled',
      };
    }

    // Parse output
    const { json, plainText, validationError } = parseHookOutput(result.stdout);

    // Handle validation error
    if (validationError) {
      return {
        outcome: 'non_blocking_error',
        hook,
        message: `JSON validation failed: ${validationError}`,
      };
    }

    // Handle JSON response
    if (json) {
      // Check async response
      if (isAsyncResponse(json) && !forceSyncExecution) {
        // Async hooks run in background
        return {
          outcome: 'success',
          hook,
        };
      }

      const processed = processHookResponse(json, hook, eventType, hookName, result.stdout, result.stderr, result.status);

      // Success with JSON response
      if (result.status === 0) {
        return {
          outcome: 'success',
          hook,
          ...processed,
        };
      }

      return {
        outcome: processed.blockingError ? 'blocking' : 'non_blocking_error',
        hook,
        ...processed,
      };
    }

    // Handle plain text response
    if (result.status === 0) {
      return {
        outcome: 'success',
        hook,
        message: plainText || 'Success',
      };
    }

    // Handle blocking exit code
    if (result.status === BLOCKING_EXIT_CODE) {
      return {
        outcome: 'blocking',
        hook,
        blockingError: {
          blockingError: `[${hook.command}]: ${result.stderr || 'No stderr output'}`,
          command: hook.command,
        },
      };
    }

    // Non-blocking error
    return {
      outcome: 'non_blocking_error',
      hook,
      message: `Failed with status ${result.status}: ${result.stderr || 'No stderr output'}`,
    };
  }

  // ==========================================================================
  // Prompt Hook Execution
  // ==========================================================================

  /**
   * Execute prompt hook
   * Note: Thực tế cần LLM integration
   */
  private async executePromptHook(
    hook: PromptHook,
    input: HookInput,
    options: {
      hookName: string;
      eventType: HookEventType;
      toolUseId?: string;
      signal?: AbortSignal;
      timeoutMs?: number;
      context?: HookContext;
      messages?: unknown[];
    }
  ): Promise<HookExecutionResult> {
    const { context, messages, signal } = options;

    if (!context) {
      return {
        outcome: 'non_blocking_error',
        hook,
        message: 'Context required for prompt hooks',
      };
    }

    // Check abort signal
    if (signal?.aborted) {
      return {
        outcome: 'cancelled',
        hook,
      };
    }

    // Replace $ARGUMENTS placeholder in prompt
    const inputJson = JSON.stringify(input);
    const processedPrompt = hook.prompt.replace(/\$ARGUMENTS/g, inputJson);

    // TODO: Implement actual LLM call
    // Đây là placeholder - cần integrate với LLM API
    console.log(`[Prompt Hook] Would evaluate: ${processedPrompt.substring(0, 100)}...`);

    return {
      outcome: 'success',
      hook,
      message: 'Prompt hook executed (placeholder)',
    };
  }

  // ==========================================================================
  // Agent Hook Execution
  // ==========================================================================

  /**
   * Execute agent hook
   * Note: Thực tế cần agent integration
   */
  private async executeAgentHook(
    hook: AgentHook,
    input: HookInput,
    options: {
      hookName: string;
      eventType: HookEventType;
      toolUseId?: string;
      signal?: AbortSignal;
      timeoutMs?: number;
      context?: HookContext;
      messages?: unknown[];
    }
  ): Promise<HookExecutionResult> {
    const { context, messages, signal } = options;

    if (!context || !messages) {
      return {
        outcome: 'non_blocking_error',
        hook,
        message: 'Context and messages required for agent hooks',
      };
    }

    // Check abort signal
    if (signal?.aborted) {
      return {
        outcome: 'cancelled',
        hook,
      };
    }

    // Get prompt string
    const promptFn = hook.prompt as (args: unknown[]) => string;
    const promptString = typeof hook.prompt === 'function' ? promptFn([]) : String(hook.prompt);

    // TODO: Implement actual agent execution
    // Đây là placeholder - cần integrate với agent system
    console.log(`[Agent Hook] Would verify: ${promptString.substring(0, 100)}...`);

    return {
      outcome: 'success',
      hook,
      message: 'Agent hook executed (placeholder)',
    };
  }

  // ==========================================================================
  // Callback Hook Execution
  // ==========================================================================

  /**
   * Execute callback hook
   */
  private async executeCallbackHook(
    hook: CallbackHookDefinition,
    input: HookInput,
    options: {
      hookName: string;
      eventType: HookEventType;
      toolUseId?: string;
      signal?: AbortSignal;
      timeoutMs?: number;
      context?: HookContext;
    }
  ): Promise<HookExecutionResult> {
    const { hookName, eventType, toolUseId = '', signal, context } = options;
    const timeoutMs = hook.timeout ? hook.timeout * 1000 : (options.timeoutMs || this.defaultTimeoutMs);

    // Create abort controller with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Link parent signal if provided
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    try {
      // Check if already aborted
      if (controller.signal.aborted) {
        return {
          outcome: 'cancelled',
          hook,
        };
      }

      // Create hook context for callback
      const hookContext = context
        ? {
            getAppState: context.getAppState,
            setAppState: context.setAppState,
          }
        : undefined;

      // Execute callback
      const hookId = `callback_${Date.now()}`;
      const hookIndex = 0;
      const response = await hook.callback(input, hookId, controller.signal, hookIndex, hookContext);

      clearTimeout(timeoutId);

      // Handle async response
      if (isAsyncResponse(response)) {
        return {
          outcome: 'success',
          hook,
        };
      }

      // Process sync response
      const processed = processHookResponse(response, hook, eventType, hookName);

      return {
        outcome: 'success',
        hook,
        ...processed,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && (error.message.includes('cancelled') || error.name === 'AbortError')) {
        return {
          outcome: 'cancelled',
          hook,
        };
      }

      return {
        outcome: 'non_blocking_error',
        hook,
        message: `Callback hook error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  // ==========================================================================
  // Function Hook Execution
  // ==========================================================================

  /**
   * Execute function hook (cho Stop hooks)
   */
  private async executeFunctionHook(
    hook: FunctionHookDefinition,
    options: {
      hookName: string;
      eventType: HookEventType;
      toolUseId?: string;
      signal?: AbortSignal;
      timeoutMs?: number;
      messages?: unknown[];
    }
  ): Promise<HookExecutionResult> {
    const { signal, messages } = options;
    const timeoutMs = hook.timeout || (options.timeoutMs || this.defaultTimeoutMs);

    if (!messages) {
      return {
        outcome: 'non_blocking_error',
        hook,
        message: 'Messages required for function hooks',
      };
    }

    // Create abort controller with timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // Link parent signal if provided
    if (signal) {
      signal.addEventListener('abort', () => controller.abort());
    }

    try {
      // Check if already aborted
      if (controller.signal.aborted) {
        return {
          outcome: 'cancelled',
          hook,
        };
      }

      // Execute function
      const result = await hook.callback(messages, controller.signal);

      clearTimeout(timeoutId);

      // Function returns true if should continue, false if should block
      if (result) {
        return {
          outcome: 'success',
          hook,
        };
      }

      return {
        outcome: 'blocking',
        hook,
        blockingError: {
          blockingError: hook.errorMessage,
          command: 'function',
        },
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && (error.message.includes('cancelled') || error.name === 'AbortError')) {
        return {
          outcome: 'cancelled',
          hook,
        };
      }

      return {
        outcome: 'non_blocking_error',
        hook,
        message: `Function hook error: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}

// ============================================================================
// Singleton Instance
// ============================================================================

let globalExecutor: HookExecutor | null = null;

/**
 * Get hoặc create global HookExecutor instance
 */
export function getHookExecutor(): HookExecutor {
  if (!globalExecutor) {
    globalExecutor = new HookExecutor();
  }
  return globalExecutor;
}

/**
 * Reset global HookExecutor
 */
export function resetHookExecutor(): void {
  globalExecutor = null;
}

// ============================================================================
// Convenience Functions - Functions tiện ích
// ============================================================================

/**
 * Execute hooks cho một event
 * Đây là high-level function kết hợp HookManager và HookExecutor
 */
export async function executeHooks(
  matchedHooks: MatchedHook[],
  input: HookInput,
  options: {
    toolUseId?: string;
    signal?: AbortSignal;
    timeoutMs?: number;
    context?: HookContext;
    messages?: unknown[];
    forceSyncExecution?: boolean;
    onProgress?: (result: HookExecutionResult) => void;
  } = {}
): Promise<HookExecutionResult[]> {
  const executor = getHookExecutor();
  const results: HookExecutionResult[] = [];

  for (const matched of matchedHooks) {
    const result = await executor.execute(matched, input, options);
    results.push(result);

    // Call progress callback if provided
    if (options.onProgress) {
      options.onProgress(result);
    }

    // Stop execution if blocking error
    if (result.outcome === 'blocking') {
      break;
    }
  }

  return results;
}

/**
 * Kiểm tra kết quả có blocking error không
 */
export function hasBlockingError(results: HookExecutionResult[]): boolean {
  return results.some((r) => r.outcome === 'blocking');
}

/**
 * Get blocking error từ results
 */
export function getBlockingError(results: HookExecutionResult[]): HookBlockingError | undefined {
  const blocking = results.find((r) => r.outcome === 'blocking');
  return blocking?.blockingError;
}

/**
 * Aggregate additional contexts từ results
 */
export function aggregateAdditionalContexts(results: HookExecutionResult[]): string[] {
  return results
    .filter((r) => r.additionalContext)
    .map((r) => r.additionalContext!);
}
