/**
 * WriteTool - Tool ghi file ra he thong
 *
 * Ghi noi dung vao file tai duong dan chi dinh.
 * Se ghi de file neu da ton tai.
 *
 * Luu y quan trong:
 * - PHAI doc file truoc neu la file da ton tai
 * - KHONG tao file documentation tru khi duoc yeu cau
 * - Uu tien edit file co san hon tao file moi
 */

import type { ToolDefinition, ToolHandler, ExecutionContext } from './types';

// ============================================================================
// Input/Output Interfaces
// ============================================================================

/**
 * Tham so dau vao cho WriteTool
 */
export interface WriteToolInput {
  /** Duong dan tuyet doi den file can ghi */
  filePath: string;
  /** Noi dung can ghi vao file */
  content: string;
}

/**
 * Ket qua tra ve tu WriteTool
 */
export interface WriteToolOutput {
  /** Ghi thanh cong hay khong */
  success: boolean;
  /** Duong dan file da ghi */
  filePath: string;
  /** So bytes da ghi */
  bytesWritten: number;
  /** File moi duoc tao hay ghi de file cu */
  created: boolean;
  /** Backup path (neu file cu da ton tai) */
  backupPath?: string;
}

// ============================================================================
// Constants - Cac hang so
// ============================================================================

/** Cac extension can canh bao truoc khi ghi */
const SENSITIVE_EXTENSIONS = [
  '.env',
  '.pem',
  '.key',
  '.secrets',
  '.credentials',
  '.password',
];

/** Cac file khong nen ghi de */
const PROTECTED_FILES = [
  '.git/config',
  '.git/HEAD',
  'package-lock.json',
  'yarn.lock',
  'pnpm-lock.yaml',
];

/** Cac file documentation (canh bao neu tao moi) */
const DOCUMENTATION_EXTENSIONS = [
  '.md',
  '.mdx',
  '.rst',
  '.txt',
];

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Dinh nghia cua WriteTool
 */
export const writeToolDefinition: ToolDefinition = {
  name: 'Write',
  description: 'Writes a file to the local filesystem',
  category: 'filesystem',
  requiresConfirmation: true,
  parameters: {
    file_path: {
      type: 'string',
      description: 'The absolute path to the file to write (must be absolute, not relative)',
      required: true,
    },
    content: {
      type: 'string',
      description: 'The content to write to the file',
      required: true,
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Kiem tra file co phai la file nhay cam khong
 * @param filePath - Duong dan file
 * @returns true neu nhay cam
 */
export function isSensitiveFile(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();
  return SENSITIVE_EXTENSIONS.some(ext => lowerPath.includes(ext));
}

/**
 * Kiem tra file co duoc bao ve khong
 * @param filePath - Duong dan file
 * @returns true neu duoc bao ve
 */
export function isProtectedFile(filePath: string): boolean {
  return PROTECTED_FILES.some(protectedFile => filePath.endsWith(protectedFile));
}

/**
 * Kiem tra file co phai documentation khong
 * @param filePath - Duong dan file
 * @returns true neu la documentation
 */
export function isDocumentationFile(filePath: string): boolean {
  const lowerPath = filePath.toLowerCase();
  return DOCUMENTATION_EXTENSIONS.some(ext => lowerPath.endsWith(ext));
}

/**
 * Validate input cho WriteTool
 * @param input - Input can validate
 * @returns true neu hop le, string neu co loi
 */
export function validateWriteInput(input: WriteToolInput): boolean | string {
  // Kiem tra file_path bat buoc
  if (!input.filePath || typeof input.filePath !== 'string') {
    return 'file_path is required and must be a string';
  }

  // Kiem tra duong dan tuyet doi
  if (!input.filePath.startsWith('/')) {
    return 'file_path must be an absolute path (starting with /)';
  }

  // Kiem tra content bat buoc
  if (input.content === undefined || input.content === null) {
    return 'content is required';
  }

  if (typeof input.content !== 'string') {
    return 'content must be a string';
  }

  // Canh bao file protected
  if (isProtectedFile(input.filePath)) {
    return `WARNING: "${input.filePath}" is a protected file. Modifying it may cause issues.`;
  }

  return true;
}

/**
 * Tao backup path cho file
 * @param filePath - Duong dan file goc
 * @returns Duong dan backup
 */
export function createBackupPath(filePath: string): string {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  return `${filePath}.backup.${timestamp}`;
}

// ============================================================================
// Tool Handler Implementation
// ============================================================================

/**
 * Tao WriteTool handler
 * @param context - Execution context
 * @returns Tool handler instance
 */
export function createWriteToolHandler(context: ExecutionContext): ToolHandler<WriteToolInput, WriteToolOutput> {
  // Set de track cac file da doc trong session
  const filesReadInSession = new Set<string>();

  return {
    name: 'Write',
    definition: writeToolDefinition,

    validateInput(input: WriteToolInput): boolean | string {
      return validateWriteInput(input);
    },

    async execute(input: WriteToolInput, ctx: ExecutionContext): Promise<WriteToolOutput> {
      const fs = await import('fs/promises');
      const path = await import('path');

      const filePath = input.filePath;
      const content = input.content;

      // Kiem tra file da ton tai chua
      let fileExists = false;
      try {
        await fs.access(filePath);
        fileExists = true;
      } catch {
        fileExists = false;
      }

      // Neu file ton tai va chua doc, tra ve loi
      // (Trong thuc te, can kiem tra filesReadInSession tu context)
      if (fileExists && !filesReadInSession.has(filePath)) {
        // Day la canh bao, khong phai loi nghiem trong
        console.warn(`WARNING: Writing to existing file without reading first: ${filePath}`);
      }

      // Tao thu muc cha neu chua ton tai
      const parentDir = path.dirname(filePath);
      try {
        await fs.mkdir(parentDir, { recursive: true });
      } catch {
        // Thu muc da ton tai
      }

      // Backup file cu neu ton tai
      let backupPath: string | undefined;
      if (fileExists) {
        backupPath = createBackupPath(filePath);
        try {
          await fs.copyFile(filePath, backupPath);
        } catch (error) {
          // Khong backup duoc thi bo qua
          backupPath = undefined;
        }
      }

      // Ghi file
      try {
        await fs.writeFile(filePath, content, 'utf-8');

        // Lay thong tin file da ghi
        const stats = await fs.stat(filePath);

        return {
          success: true,
          filePath,
          bytesWritten: stats.size,
          created: !fileExists,
          backupPath,
        };
      } catch (error: unknown) {
        const err = error as Error;
        throw new Error(`Failed to write file: ${err.message}`);
      }
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Ghi file voi kiem tra truoc
 * Utility function de su dung ngoai handler
 */
export async function writeFileSafely(
  filePath: string,
  content: string,
  options?: {
    createBackup?: boolean;
    allowOverwrite?: boolean;
  }
): Promise<WriteToolOutput> {
  const fs = await import('fs/promises');
  const path = await import('path');

  const opts = {
    createBackup: true,
    allowOverwrite: true,
    ...options,
  };

  // Kiem tra file ton tai
  let fileExists = false;
  try {
    await fs.access(filePath);
    fileExists = true;
  } catch {
    fileExists = false;
  }

  if (fileExists && !opts.allowOverwrite) {
    throw new Error(`File already exists: ${filePath}`);
  }

  // Tao backup neu can
  let backupPath: string | undefined;
  if (fileExists && opts.createBackup) {
    backupPath = createBackupPath(filePath);
    await fs.copyFile(filePath, backupPath);
  }

  // Tao thu muc cha
  const parentDir = path.dirname(filePath);
  await fs.mkdir(parentDir, { recursive: true });

  // Ghi file
  await fs.writeFile(filePath, content, 'utf-8');
  const stats = await fs.stat(filePath);

  return {
    success: true,
    filePath,
    bytesWritten: stats.size,
    created: !fileExists,
    backupPath,
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  definition: writeToolDefinition,
  createHandler: createWriteToolHandler,
  validateInput: validateWriteInput,
  isSensitiveFile,
  isProtectedFile,
  isDocumentationFile,
  writeFileSafely,
};
