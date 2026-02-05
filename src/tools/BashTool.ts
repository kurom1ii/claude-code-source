/**
 * BashTool - Tool chay lenh shell/bash
 *
 * Cho phep thuc thi cac lenh shell trong terminal.
 * Ho tro timeout, chay background, va mo ta lenh.
 */

import type { ToolDefinition, ToolHandler, ExecutionContext, ToolResult } from './types';

// ============================================================================
// Input/Output Interfaces
// ============================================================================

/**
 * Tham so dau vao cho BashTool
 */
export interface BashToolInput {
  /** Lenh can thuc thi */
  command: string;
  /** Mo ta ngan gon ve lenh nay lam gi */
  description?: string;
  /** Timeout tinh bang milliseconds (toi da 600000ms = 10 phut) */
  timeout?: number;
  /** Chay lenh trong background */
  runInBackground?: boolean;
  /** Tat che do sandbox (nguy hiem!) */
  dangerouslyDisableSandbox?: boolean;
}

/**
 * Ket qua tra ve tu BashTool
 */
export interface BashToolOutput {
  /** Output tu stdout */
  stdout: string;
  /** Output tu stderr */
  stderr: string;
  /** Exit code cua lenh */
  exitCode: number;
  /** Lenh co bi timeout khong */
  timedOut: boolean;
  /** ID cua background process (neu chay background) */
  backgroundProcessId?: string;
}

// ============================================================================
// Constants - Cac hang so
// ============================================================================

/** Timeout mac dinh: 2 phut */
const DEFAULT_TIMEOUT_MS = 120000;

/** Timeout toi da: 10 phut */
const MAX_TIMEOUT_MS = 600000;

/** Gioi han output: 30000 ky tu */
const MAX_OUTPUT_LENGTH = 30000;

/** Cac lenh nguy hiem can canh bao */
const DANGEROUS_COMMANDS = [
  'rm -rf',
  'dd if=',
  'mkfs',
  ':(){:|:&};:',  // Fork bomb
  'chmod -R 777',
  'chmod -R 000',
  '> /dev/sda',
];

/** Cac lenh bi cam trong sandbox mode */
const SANDBOX_BLOCKED_COMMANDS = [
  'sudo',
  'su ',
  'pkill',
  'killall',
  'shutdown',
  'reboot',
  'systemctl',
];

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Dinh nghia cua BashTool
 */
export const bashToolDefinition: ToolDefinition = {
  name: 'Bash',
  description: 'Executes a given bash command with optional timeout',
  category: 'shell',
  requiresConfirmation: true,
  parameters: {
    command: {
      type: 'string',
      description: 'The command to execute',
      required: true,
    },
    description: {
      type: 'string',
      description: 'Clear, concise description of what this command does in active voice',
      required: false,
    },
    timeout: {
      type: 'number',
      description: `Optional timeout in milliseconds (max ${MAX_TIMEOUT_MS})`,
      required: false,
      default: DEFAULT_TIMEOUT_MS,
    },
    run_in_background: {
      type: 'boolean',
      description: 'Set to true to run this command in the background',
      required: false,
      default: false,
    },
    dangerouslyDisableSandbox: {
      type: 'boolean',
      description: 'Override sandbox mode and run commands without sandboxing',
      required: false,
      default: false,
    },
  },
};

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Kiem tra lenh co nguy hiem khong
 * @param command - Lenh can kiem tra
 * @returns Thong bao canh bao neu nguy hiem, undefined neu an toan
 */
export function checkDangerousCommand(command: string): string | undefined {
  const lowerCommand = command.toLowerCase();

  for (const dangerous of DANGEROUS_COMMANDS) {
    if (lowerCommand.includes(dangerous.toLowerCase())) {
      return `WARNING: Command contains potentially dangerous pattern: "${dangerous}"`;
    }
  }

  return undefined;
}

/**
 * Kiem tra lenh co bi block trong sandbox khong
 * @param command - Lenh can kiem tra
 * @param sandboxMode - Co dang o sandbox mode khong
 * @returns true neu lenh bi block
 */
export function isBlockedInSandbox(command: string, sandboxMode: boolean): boolean {
  if (!sandboxMode) return false;

  const lowerCommand = command.toLowerCase();
  return SANDBOX_BLOCKED_COMMANDS.some(blocked =>
    lowerCommand.startsWith(blocked) || lowerCommand.includes(` ${blocked}`)
  );
}

/**
 * Validate input cho BashTool
 * @param input - Input can validate
 * @returns true neu hop le, string neu co loi
 */
export function validateBashInput(input: BashToolInput): boolean | string {
  // Kiem tra command bat buoc
  if (!input.command || typeof input.command !== 'string') {
    return 'Command is required and must be a string';
  }

  // Kiem tra command khong rong
  if (input.command.trim().length === 0) {
    return 'Command cannot be empty';
  }

  // Kiem tra timeout hop le
  if (input.timeout !== undefined) {
    if (typeof input.timeout !== 'number' || input.timeout <= 0) {
      return 'Timeout must be a positive number';
    }
    if (input.timeout > MAX_TIMEOUT_MS) {
      return `Timeout cannot exceed ${MAX_TIMEOUT_MS}ms (10 minutes)`;
    }
  }

  return true;
}

// ============================================================================
// Tool Handler Implementation
// ============================================================================

/**
 * Tao BashTool handler
 * @param context - Execution context
 * @returns Tool handler instance
 */
export function createBashToolHandler(context: ExecutionContext): ToolHandler<BashToolInput, BashToolOutput> {
  return {
    name: 'Bash',
    definition: bashToolDefinition,

    validateInput(input: BashToolInput): boolean | string {
      const basicValidation = validateBashInput(input);
      if (basicValidation !== true) return basicValidation;

      // Kiem tra sandbox restrictions
      if (isBlockedInSandbox(input.command, context.sandboxMode) && !input.dangerouslyDisableSandbox) {
        return `Command blocked in sandbox mode. Use dangerouslyDisableSandbox to override.`;
      }

      return true;
    },

    async execute(input: BashToolInput, ctx: ExecutionContext): Promise<BashToolOutput> {
      // Import child_process dynamically
      const { spawn, exec } = await import('child_process');
      const { promisify } = await import('util');
      const execPromise = promisify(exec);

      const timeout = Math.min(input.timeout ?? DEFAULT_TIMEOUT_MS, MAX_TIMEOUT_MS);
      const workingDir = ctx.workingDirectory;

      // Kiem tra canh bao lenh nguy hiem
      const dangerWarning = checkDangerousCommand(input.command);

      try {
        if (input.runInBackground) {
          // Chay trong background
          const child = spawn(input.command, [], {
            shell: true,
            cwd: workingDir,
            env: ctx.environment,
            detached: true,
            stdio: 'ignore',
          });

          child.unref();

          return {
            stdout: `Command started in background with PID: ${child.pid}`,
            stderr: dangerWarning ?? '',
            exitCode: 0,
            timedOut: false,
            backgroundProcessId: String(child.pid),
          };
        }

        // Chay binh thuong voi timeout
        const result = await execPromise(input.command, {
          cwd: workingDir,
          env: ctx.environment,
          timeout: timeout,
          maxBuffer: MAX_OUTPUT_LENGTH * 2,
        });

        // Truncate output neu qua dai
        let stdout = result.stdout;
        let stderr = result.stderr;

        if (stdout.length > MAX_OUTPUT_LENGTH) {
          stdout = stdout.substring(0, MAX_OUTPUT_LENGTH) + '\n... (output truncated)';
        }
        if (stderr.length > MAX_OUTPUT_LENGTH) {
          stderr = stderr.substring(0, MAX_OUTPUT_LENGTH) + '\n... (output truncated)';
        }

        return {
          stdout,
          stderr: dangerWarning ? `${dangerWarning}\n${stderr}` : stderr,
          exitCode: 0,
          timedOut: false,
        };

      } catch (error: unknown) {
        const execError = error as {
          code?: number;
          killed?: boolean;
          stdout?: string;
          stderr?: string;
          message?: string;
        };

        // Kiem tra timeout
        if (execError.killed) {
          return {
            stdout: execError.stdout ?? '',
            stderr: `Command timed out after ${timeout}ms`,
            exitCode: 124, // Standard timeout exit code
            timedOut: true,
          };
        }

        return {
          stdout: execError.stdout ?? '',
          stderr: execError.stderr ?? execError.message ?? 'Unknown error',
          exitCode: execError.code ?? 1,
          timedOut: false,
        };
      }
    },
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  definition: bashToolDefinition,
  createHandler: createBashToolHandler,
  validateInput: validateBashInput,
  checkDangerousCommand,
  isBlockedInSandbox,
};
