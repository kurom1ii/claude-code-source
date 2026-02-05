/**
 * Claude Code - Skill Executor
 *
 * Module thuc thi skills sau khi da parse.
 * Chiu trach nhiem goi skill handlers, quan ly lifecycle,
 * tracking usage va xu ly loi.
 */

import type {
  SkillDefinition,
  SkillCallResult,
  SkillExecutionContext,
  SkillDoneCallback,
  SkillResumeFunction,
  ParsedSkillInvocation,
  SkillHookEvent,
  SkillHookFunction,
  SkillHook,
} from './types';
import {
  getSkill,
  trackSkillUsage,
  getInvokedSkills,
} from './SkillRegistry';
import {
  parseSkillInvocation,
  createNotFoundMessage,
  formatSkillAsXml,
} from './SkillParser';

// ============================================================================
// Constants - Hang so
// ============================================================================

/**
 * Timeout mac dinh cho skill execution (30 giay)
 */
const DEFAULT_EXECUTION_TIMEOUT_MS = 30000;

/**
 * Gioi han thoi gian giu slow operations trong cache
 */
const SLOW_OPERATION_TTL_MS = 5 * 60 * 1000; // 5 phut

// ============================================================================
// Execution State - Trang thai thuc thi
// ============================================================================

/**
 * Luu tru cac hooks da dang ky
 */
const registeredHooks: Map<SkillHookEvent, SkillHook[]> = new Map();

/**
 * Theo doi cac slow operations
 */
interface SlowOperation {
  skillName: string;
  timestamp: number;
  duration: number;
}

const slowOperations: SlowOperation[] = [];

// ============================================================================
// Main Execution Functions - Cac ham thuc thi chinh
// ============================================================================

/**
 * Thuc thi skill tu user input
 *
 * @param input - Input tu nguoi dung (vd: "/commit fix bug")
 * @param context - Execution context
 * @param options - Tuy chon thuc thi
 * @returns Ket qua thuc thi
 *
 * @example
 * const result = await executeSkillFromInput("/commit fix typo", {
 *   workingDirectory: "/path/to/project"
 * });
 */
export async function executeSkillFromInput(
  input: string,
  context: SkillExecutionContext,
  options: ExecuteOptions = {}
): Promise<SkillCallResult> {
  // Parse input
  const parsed = parseSkillInvocation(input);

  if (!parsed) {
    return {
      success: false,
      error: 'Invalid skill invocation format. Use /skill-name [args].',
    };
  }

  // Tim skill
  const skill = getSkill(parsed.skillName);

  if (!skill) {
    return {
      success: false,
      error: createNotFoundMessage(input),
    };
  }

  // Thuc thi
  return executeSkill(skill, parsed.args, context, options);
}

/**
 * Thuc thi skill voi parsed invocation
 *
 * @param invocation - Da parse tu SkillParser
 * @param context - Execution context
 * @param options - Tuy chon thuc thi
 * @returns Ket qua thuc thi
 */
export async function executeSkillFromInvocation(
  invocation: ParsedSkillInvocation,
  context: SkillExecutionContext,
  options: ExecuteOptions = {}
): Promise<SkillCallResult> {
  const skill = getSkill(invocation.skillName);

  if (!skill) {
    return {
      success: false,
      error: createNotFoundMessage(invocation.rawMatch),
    };
  }

  return executeSkill(skill, invocation.args, context, options);
}

/**
 * Options cho viec thuc thi skill
 */
export interface ExecuteOptions {
  /** Timeout tuy chinh (ms) */
  timeout?: number;
  /** Callback khi hoan thanh */
  onDone?: SkillDoneCallback;
  /** Ham de resume conversation */
  resume?: SkillResumeFunction;
  /** Co track usage khong */
  trackUsage?: boolean;
  /** Co chay hooks khong */
  runHooks?: boolean;
}

/**
 * Thuc thi skill truc tiep
 *
 * @param skill - Skill definition
 * @param args - Arguments
 * @param context - Execution context
 * @param options - Tuy chon thuc thi
 * @returns Ket qua thuc thi
 */
export async function executeSkill(
  skill: SkillDefinition,
  args: string | undefined,
  context: SkillExecutionContext,
  options: ExecuteOptions = {}
): Promise<SkillCallResult> {
  const {
    timeout = DEFAULT_EXECUTION_TIMEOUT_MS,
    trackUsage: shouldTrack = true,
    runHooks = true,
  } = options;

  const startTime = Date.now();

  // Kiem tra skill co enabled khong
  if (!skill.isEnabled()) {
    return {
      success: false,
      error: `Skill "/${skill.userFacingName()}" is currently disabled.`,
    };
  }

  // Chay before hooks
  if (runHooks) {
    await runSkillHooks('before_execute', skill, args);
  }

  // Track usage
  if (shouldTrack) {
    trackSkillUsage(skill.name);
  }

  try {
    // Tao promise cho skill execution
    const executionPromise = executeSkillInternal(skill, args, context, options);

    // Chay voi timeout
    const result = await withTimeout(executionPromise, timeout);

    // Tinh thoi gian thuc thi
    const executionTime = Date.now() - startTime;

    // Track slow operations
    if (executionTime > 5000) {
      trackSlowOperation(skill.name, executionTime);
    }

    // Chay after hooks
    if (runHooks) {
      await runSkillHooks('after_execute', skill, args, result);
    }

    return {
      ...result,
      executionTime,
    };

  } catch (error) {
    const executionTime = Date.now() - startTime;
    const errorMessage = error instanceof Error ? error.message : String(error);

    const result: SkillCallResult = {
      success: false,
      error: errorMessage,
      executionTime,
    };

    // Chay error hooks
    if (runHooks) {
      await runSkillHooks('on_error', skill, args, result);
    }

    return result;
  }
}

/**
 * Thuc thi skill noi bo (khong co timeout handling)
 */
async function executeSkillInternal(
  skill: SkillDefinition,
  args: string | undefined,
  _context: SkillExecutionContext,
  options: ExecuteOptions
): Promise<SkillCallResult> {
  return new Promise((resolve, _reject) => {
    // Tao done callback
    const done: SkillDoneCallback = (result, displayOptions) => {
      // Goi callback tuy chinh neu co
      if (options.onDone) {
        options.onDone(result, displayOptions);
      }

      resolve({
        success: true,
        result: result,
      });
    };

    // Goi skill
    try {
      const callResult = skill.call(done, options.resume, args);

      // Neu tra ve Promise, doi ket qua
      if (callResult instanceof Promise) {
        callResult
          .then(result => {
            // Neu skill tra ve ket qua truc tiep (vd: JSX component)
            // thi done callback da duoc goi trong skill
            if (result !== undefined && result !== null) {
              // Khong lam gi, done se duoc goi
            }
          })
          .catch(error => {
            resolve({
              success: false,
              error: error instanceof Error ? error.message : String(error),
            });
          });
      }
    } catch (error) {
      resolve({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  });
}

// ============================================================================
// Hook System - He thong hooks
// ============================================================================

/**
 * Dang ky hook cho skill events
 *
 * @param event - Loai event
 * @param matcher - Pattern de match skill name (string hoac regex)
 * @param hook - Hook function
 * @param options - Tuy chon
 */
export function registerSkillHook(
  event: SkillHookEvent,
  matcher: string | RegExp,
  hook: SkillHookFunction,
  options: {
    skillRoot?: string;
    onSuccess?: () => void;
  } = {}
): () => void {
  const hookEntry: SkillHook = {
    matcher,
    skillRoot: options.skillRoot,
    hooks: [{
      hook,
      onHookSuccess: options.onSuccess,
    }],
  };

  // Lay hoac tao mang hooks cho event
  const hooks = registeredHooks.get(event) ?? [];
  hooks.push(hookEntry);
  registeredHooks.set(event, hooks);

  // Tra ve unsubscribe function
  return () => {
    const currentHooks = registeredHooks.get(event);
    if (currentHooks) {
      const index = currentHooks.indexOf(hookEntry);
      if (index !== -1) {
        currentHooks.splice(index, 1);
      }
    }
  };
}

/**
 * Chay hooks cho mot event
 */
async function runSkillHooks(
  event: SkillHookEvent,
  skill: SkillDefinition,
  args: string | undefined,
  result?: SkillCallResult
): Promise<void> {
  const hooks = registeredHooks.get(event);
  if (!hooks || hooks.length === 0) return;

  const skillName = skill.name.toLowerCase();

  for (const hookEntry of hooks) {
    // Kiem tra matcher
    const matches = typeof hookEntry.matcher === 'string'
      ? skillName === hookEntry.matcher.toLowerCase() || hookEntry.matcher === '*'
      : hookEntry.matcher.test(skillName);

    if (!matches) continue;

    // Chay tat ca hooks trong entry
    for (const { hook, onHookSuccess } of hookEntry.hooks) {
      try {
        await hook(skill, args, result);
        if (onHookSuccess) {
          onHookSuccess();
        }
      } catch (error) {
        // Log loi nhung khong throw de khong anh huong skill execution
        console.error(`Hook error for ${event}:`, error);
      }
    }
  }
}

/**
 * Clear tat ca hooks
 */
export function clearAllHooks(): void {
  registeredHooks.clear();
}

/**
 * Lay hooks cho mot event
 */
export function getHooksForEvent(event: SkillHookEvent): SkillHook[] {
  return registeredHooks.get(event) ?? [];
}

// ============================================================================
// Slow Operation Tracking - Theo doi cac operation cham
// ============================================================================

/**
 * Ghi nhan slow operation
 */
function trackSlowOperation(skillName: string, duration: number): void {
  slowOperations.push({
    skillName,
    timestamp: Date.now(),
    duration,
  });
}

/**
 * Lay danh sach slow operations gan day
 */
export function getSlowOperations(): SlowOperation[] {
  const now = Date.now();

  // Loc bo cac operations cu
  const filtered = slowOperations.filter(
    op => now - op.timestamp < SLOW_OPERATION_TTL_MS
  );

  // Cap nhat mang
  slowOperations.length = 0;
  slowOperations.push(...filtered);

  return [...filtered];
}

// ============================================================================
// Utility Functions - Cac ham tien ich
// ============================================================================

/**
 * Chay promise voi timeout
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    promise
      .then(result => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch(error => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

/**
 * Tao ket qua thanh cong don gian
 */
export function createSuccessResult(result?: unknown): SkillCallResult {
  return {
    success: true,
    result,
  };
}

/**
 * Tao ket qua loi don gian
 */
export function createErrorResult(error: string): SkillCallResult {
  return {
    success: false,
    error,
  };
}

/**
 * Kiem tra xem co skill nao dang chay khong
 * Dua tren invoked skills trong session
 */
export function hasRunningSkills(): boolean {
  // Logic nay can duoc implement dua tren trang thai thuc te
  // Hien tai tra ve false
  return false;
}

/**
 * Lay context execution mac dinh
 */
export function getDefaultContext(): SkillExecutionContext {
  return {
    workingDirectory: process.cwd(),
    environment: process.env as Record<string, string>,
  };
}

// ============================================================================
// Batch Execution - Thuc thi nhieu skills
// ============================================================================

/**
 * Thuc thi nhieu skills tuan tu
 *
 * @param invocations - Mang cac invocations
 * @param context - Execution context
 * @returns Mang ket qua
 */
export async function executeSkillsSequential(
  invocations: ParsedSkillInvocation[],
  context: SkillExecutionContext
): Promise<SkillCallResult[]> {
  const results: SkillCallResult[] = [];

  for (const invocation of invocations) {
    const result = await executeSkillFromInvocation(invocation, context);
    results.push(result);

    // Dung lai neu gap loi
    if (!result.success) {
      break;
    }
  }

  return results;
}

/**
 * Thuc thi nhieu skills song song
 *
 * @param invocations - Mang cac invocations
 * @param context - Execution context
 * @returns Mang ket qua
 */
export async function executeSkillsParallel(
  invocations: ParsedSkillInvocation[],
  context: SkillExecutionContext
): Promise<SkillCallResult[]> {
  const promises = invocations.map(inv =>
    executeSkillFromInvocation(inv, context)
  );

  return Promise.all(promises);
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Main execution
  executeSkillFromInput,
  executeSkillFromInvocation,
  executeSkill,

  // Hooks
  registerSkillHook,
  clearAllHooks,
  getHooksForEvent,

  // Utilities
  createSuccessResult,
  createErrorResult,
  hasRunningSkills,
  getDefaultContext,
  getSlowOperations,

  // Batch execution
  executeSkillsSequential,
  executeSkillsParallel,
};
