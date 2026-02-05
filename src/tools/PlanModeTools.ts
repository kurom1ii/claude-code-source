/**
 * PlanMode Tools
 *
 * Tools để quản lý Plan Mode trong Claude Code:
 * - EnterPlanMode: Chuyển sang plan mode để lên kế hoạch implementation
 * - ExitPlanMode: Thoát plan mode và yêu cầu user approval
 */

import type { ToolDefinition, ToolHandler, ExecutionContext } from './types';

// ============================================================================
// Types - EnterPlanMode
// ============================================================================

/**
 * Input của EnterPlanMode tool (empty object)
 */
export interface EnterPlanModeInput {
  // No parameters required
}

/**
 * Output của EnterPlanMode tool
 */
export interface EnterPlanModeOutput {
  /** Có thành công không */
  success: boolean;
  /** Message mô tả */
  message: string;
  /** Đường dẫn file plan */
  planFilePath?: string;
}

// ============================================================================
// Types - ExitPlanMode
// ============================================================================

/**
 * Prompt permission cho Bash tool
 */
export interface AllowedPrompt {
  /** Tool name */
  tool: 'Bash';
  /** Semantic description của action */
  prompt: string;
}

/**
 * Input của ExitPlanMode tool
 */
export interface ExitPlanModeInput {
  /** Prompt-based permissions cần để implement plan */
  allowedPrompts?: AllowedPrompt[];
  /** Push plan đến remote Claude.ai session */
  pushToRemote?: boolean;
  /** Remote session ID */
  remoteSessionId?: string;
  /** Remote session title */
  remoteSessionTitle?: string;
  /** Remote session URL */
  remoteSessionUrl?: string;
}

/**
 * Output của ExitPlanMode tool
 */
export interface ExitPlanModeOutput {
  /** Có thành công không */
  success: boolean;
  /** Message mô tả */
  message: string;
  /** User đã approve plan chưa */
  approved?: boolean;
  /** Feedback từ user nếu rejected */
  feedback?: string;
}

// ============================================================================
// Tool Definitions
// ============================================================================

/**
 * Definition của EnterPlanMode tool
 */
export const enterPlanModeToolDefinition: ToolDefinition = {
  name: 'EnterPlanMode',
  description: `Use this tool proactively when you're about to start a non-trivial implementation task. Getting user sign-off on your approach before writing code prevents wasted effort and ensures alignment. This tool transitions you into plan mode where you can explore the codebase and design an implementation approach for user approval.

## When to Use This Tool

**Prefer using EnterPlanMode** for implementation tasks unless they're simple. Use it when ANY of these conditions apply:

1. **New Feature Implementation**: Adding meaningful new functionality
   - Example: "Add a logout button" - where should it go? What should happen on click?
   - Example: "Add form validation" - what rules? What error messages?

2. **Multiple Valid Approaches**: The task can be solved in several different ways
   - Example: "Add caching to the API" - could use Redis, in-memory, file-based, etc.
   - Example: "Improve performance" - many optimization strategies possible

3. **Code Modifications**: Changes that affect existing behavior or structure
   - Example: "Update the login flow" - what exactly should change?
   - Example: "Refactor this component" - what's the target architecture?

4. **Architectural Decisions**: The task requires choosing between patterns or technologies
5. **Multi-File Changes**: The task will likely touch more than 2-3 files
6. **Unclear Requirements**: You need to explore before understanding the full scope
7. **User Preferences Matter**: The implementation could reasonably go multiple ways

## When NOT to Use This Tool

Only skip EnterPlanMode for simple tasks:
- Single-line or few-line fixes (typos, obvious bugs, small tweaks)
- Adding a single function with clear requirements
- Tasks where the user has given very specific, detailed instructions
- Pure research/exploration tasks (use the Task tool with explore agent instead)`,
  category: 'planning',
  requiresConfirmation: true,
  parameters: {},
};

/**
 * Definition của ExitPlanMode tool
 */
export const exitPlanModeToolDefinition: ToolDefinition = {
  name: 'ExitPlanMode',
  description: `Use this tool when you are in plan mode and have finished writing your plan to the plan file and are ready for user approval.

## How This Tool Works
- You should have already written your plan to the plan file specified in the plan mode system message
- This tool does NOT take the plan content as a parameter - it will read the plan from the file you wrote
- This tool simply signals that you're done planning and ready for the user to review and approve
- The user will see the contents of your plan file when they review it

## When to Use This Tool
IMPORTANT: Only use this tool when the task requires planning the implementation steps of a task that requires writing code. For research tasks where you're gathering information, searching files, reading files or in general trying to understand the codebase - do NOT use this tool.

## Before Using This Tool
Ensure your plan is complete and unambiguous:
- If you have unresolved questions about requirements or approach, use AskUserQuestion first (in earlier phases)
- Once your plan is finalized, use THIS tool to request approval

**Important:** Do NOT use AskUserQuestion to ask "Is this plan okay?" or "Should I proceed?" - that's exactly what THIS tool does. ExitPlanMode inherently requests user approval of your plan.`,
  category: 'planning',
  requiresConfirmation: false,
  parameters: {
    allowedPrompts: {
      type: 'array',
      description:
        'Prompt-based permissions needed to implement the plan. These describe categories of actions rather than specific commands.',
      required: false,
    },
    pushToRemote: {
      type: 'boolean',
      description: 'Whether to push the plan to a remote Claude.ai session',
      required: false,
    },
    remoteSessionId: {
      type: 'string',
      description: 'The remote session ID if pushed to remote',
      required: false,
    },
    remoteSessionTitle: {
      type: 'string',
      description: 'The remote session title if pushed to remote',
      required: false,
    },
    remoteSessionUrl: {
      type: 'string',
      description: 'The remote session URL if pushed to remote',
      required: false,
    },
  },
};

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate EnterPlanMode input
 */
export function validateEnterPlanModeInput(
  input: unknown
): boolean | string {
  // EnterPlanMode doesn't require any parameters
  if (input !== undefined && input !== null && typeof input !== 'object') {
    return 'Input must be an object or empty';
  }
  return true;
}

/**
 * Validate ExitPlanMode input
 */
export function validateExitPlanModeInput(
  input: unknown
): boolean | string {
  if (input === undefined || input === null) {
    return true; // All parameters are optional
  }

  if (typeof input !== 'object') {
    return 'Input must be an object';
  }

  const inp = input as Record<string, unknown>;

  // Validate allowedPrompts if provided
  if (inp.allowedPrompts !== undefined) {
    if (!Array.isArray(inp.allowedPrompts)) {
      return 'allowedPrompts must be an array';
    }

    for (let i = 0; i < inp.allowedPrompts.length; i++) {
      const prompt = inp.allowedPrompts[i] as Record<string, unknown>;
      if (prompt.tool !== 'Bash') {
        return `allowedPrompts[${i}].tool must be "Bash"`;
      }
      if (typeof prompt.prompt !== 'string') {
        return `allowedPrompts[${i}].prompt must be a string`;
      }
    }
  }

  // Validate boolean fields
  if (inp.pushToRemote !== undefined && typeof inp.pushToRemote !== 'boolean') {
    return 'pushToRemote must be a boolean';
  }

  // Validate string fields
  const stringFields = ['remoteSessionId', 'remoteSessionTitle', 'remoteSessionUrl'];
  for (const field of stringFields) {
    if (inp[field] !== undefined && typeof inp[field] !== 'string') {
      return `${field} must be a string`;
    }
  }

  return true;
}

// ============================================================================
// Handlers
// ============================================================================

/**
 * Tạo handler cho EnterPlanMode tool
 */
export function createEnterPlanModeToolHandler(
  context: ExecutionContext
): ToolHandler<EnterPlanModeInput, EnterPlanModeOutput> {
  return {
    name: 'EnterPlanMode',
    definition: enterPlanModeToolDefinition,

    validateInput(input: unknown): boolean | string {
      return validateEnterPlanModeInput(input);
    },

    async execute(
      input: EnterPlanModeInput,
      ctx: ExecutionContext
    ): Promise<EnterPlanModeOutput> {
      // Trong môi trường thực, sẽ:
      // 1. Chuyển session sang plan mode
      // 2. Tạo plan file nếu chưa có
      // 3. Set readonly flag cho các tools khác

      const planFilePath = `${ctx.workingDirectory}/PLAN.md`;

      return {
        success: true,
        message: 'Entered plan mode. Write your plan to the plan file.',
        planFilePath,
      };
    },
  };
}

/**
 * Tạo handler cho ExitPlanMode tool
 */
export function createExitPlanModeToolHandler(
  context: ExecutionContext
): ToolHandler<ExitPlanModeInput, ExitPlanModeOutput> {
  return {
    name: 'ExitPlanMode',
    definition: exitPlanModeToolDefinition,

    validateInput(input: unknown): boolean | string {
      return validateExitPlanModeInput(input);
    },

    async execute(
      input: ExitPlanModeInput,
      ctx: ExecutionContext
    ): Promise<ExitPlanModeOutput> {
      // Trong môi trường thực, sẽ:
      // 1. Đọc plan file
      // 2. Hiển thị cho user review
      // 3. Đợi user approve/reject
      // 4. Return kết quả

      return {
        success: true,
        message: 'Plan submitted for approval. Waiting for user response.',
        approved: undefined, // Will be set after user interaction
      };
    },
  };
}

// ============================================================================
// Module Export
// ============================================================================

export const EnterPlanModeTool = {
  definition: enterPlanModeToolDefinition,
  createHandler: createEnterPlanModeToolHandler,
  validate: validateEnterPlanModeInput,
};

export const ExitPlanModeTool = {
  definition: exitPlanModeToolDefinition,
  createHandler: createExitPlanModeToolHandler,
  validate: validateExitPlanModeInput,
};

export default {
  EnterPlanMode: EnterPlanModeTool,
  ExitPlanMode: ExitPlanModeTool,
};
