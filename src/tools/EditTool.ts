/**
 * EditTool - Tool chinh sua file bang string replacement
 *
 * Thuc hien thay the chinh xac chuoi ky tu trong file.
 *
 * Dac diem:
 * - Thay the exact string (khong phai regex)
 * - Ho tro replace_all de thay tat ca occurrences
 * - PHAI doc file truoc khi edit
 * - old_string PHAI unique trong file (tru khi dung replace_all)
 */

import type { ToolDefinition, ToolHandler, ExecutionContext } from './types';

// ============================================================================
// Input/Output Interfaces
// ============================================================================

/**
 * Tham so dau vao cho EditTool
 */
export interface EditToolInput {
  /** Duong dan tuyet doi den file can sua */
  filePath: string;
  /** Chuoi can thay the */
  oldString: string;
  /** Chuoi thay the moi */
  newString: string;
  /** Thay the tat ca occurrences (mac dinh: false) */
  replaceAll?: boolean;
}

/**
 * Ket qua tra ve tu EditTool
 */
export interface EditToolOutput {
  /** Edit thanh cong hay khong */
  success: boolean;
  /** Duong dan file da sua */
  filePath: string;
  /** So lan thay the */
  replacementCount: number;
  /** Noi dung file sau khi sua (preview) */
  preview?: string;
  /** Diff giu noi dung cu va moi */
  diff?: string;
}

// ============================================================================
// Constants - Cac hang so
// ============================================================================

/** So ky tu toi da cho preview */
const MAX_PREVIEW_LENGTH = 500;

/** So dong context cho diff */
const DIFF_CONTEXT_LINES = 3;

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Dinh nghia cua EditTool
 */
export const editToolDefinition: ToolDefinition = {
  name: 'Edit',
  description: 'Performs exact string replacements in files',
  category: 'filesystem',
  requiresConfirmation: true,
  parameters: {
    file_path: {
      type: 'string',
      description: 'The absolute path to the file to modify',
      required: true,
    },
    old_string: {
      type: 'string',
      description: 'The text to replace',
      required: true,
    },
    new_string: {
      type: 'string',
      description: 'The text to replace it with (must be different from old_string)',
      required: true,
    },
    replace_all: {
      type: 'boolean',
      description: 'Replace all occurrences (default false)',
      required: false,
      default: false,
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Dem so lan xuat hien cua chuoi trong noi dung
 * @param content - Noi dung file
 * @param searchString - Chuoi can tim
 * @returns So lan xuat hien
 */
export function countOccurrences(content: string, searchString: string): number {
  if (!searchString) return 0;

  let count = 0;
  let position = 0;

  while ((position = content.indexOf(searchString, position)) !== -1) {
    count++;
    position += searchString.length;
  }

  return count;
}

/**
 * Tao diff don gian giua noi dung cu va moi
 * @param oldContent - Noi dung cu
 * @param newContent - Noi dung moi
 * @param contextLines - So dong context
 * @returns Diff string
 */
export function createSimpleDiff(
  oldContent: string,
  newContent: string,
  contextLines: number = DIFF_CONTEXT_LINES
): string {
  const oldLines = oldContent.split('\n');
  const newLines = newContent.split('\n');

  const diff: string[] = [];
  let oldIndex = 0;
  let newIndex = 0;

  while (oldIndex < oldLines.length || newIndex < newLines.length) {
    if (oldIndex >= oldLines.length) {
      // Chi con dong moi
      diff.push(`+ ${newLines[newIndex]}`);
      newIndex++;
    } else if (newIndex >= newLines.length) {
      // Chi con dong cu
      diff.push(`- ${oldLines[oldIndex]}`);
      oldIndex++;
    } else if (oldLines[oldIndex] === newLines[newIndex]) {
      // Dong giong nhau
      diff.push(`  ${oldLines[oldIndex]}`);
      oldIndex++;
      newIndex++;
    } else {
      // Dong khac nhau
      diff.push(`- ${oldLines[oldIndex]}`);
      diff.push(`+ ${newLines[newIndex]}`);
      oldIndex++;
      newIndex++;
    }
  }

  // Loc chi lay cac thay doi va context
  const filteredDiff: string[] = [];
  const changeIndices = new Set<number>();

  // Tim cac dong thay doi
  diff.forEach((line, index) => {
    if (line.startsWith('+') || line.startsWith('-')) {
      // Them context truoc va sau
      for (let i = Math.max(0, index - contextLines); i <= Math.min(diff.length - 1, index + contextLines); i++) {
        changeIndices.add(i);
      }
    }
  });

  // Lay cac dong can hien thi
  let lastIndex = -1;
  changeIndices.forEach(index => {
    if (lastIndex !== -1 && index > lastIndex + 1) {
      filteredDiff.push('...');
    }
    filteredDiff.push(diff[index]);
    lastIndex = index;
  });

  return filteredDiff.join('\n');
}

/**
 * Validate input cho EditTool
 * @param input - Input can validate
 * @returns true neu hop le, string neu co loi
 */
export function validateEditInput(input: EditToolInput): boolean | string {
  // Kiem tra file_path bat buoc
  if (!input.filePath || typeof input.filePath !== 'string') {
    return 'file_path is required and must be a string';
  }

  // Kiem tra duong dan tuyet doi
  if (!input.filePath.startsWith('/')) {
    return 'file_path must be an absolute path (starting with /)';
  }

  // Kiem tra old_string bat buoc
  if (input.oldString === undefined || input.oldString === null) {
    return 'old_string is required';
  }

  // Kiem tra new_string bat buoc
  if (input.newString === undefined || input.newString === null) {
    return 'new_string is required';
  }

  // Kiem tra old_string va new_string khac nhau
  if (input.oldString === input.newString) {
    return 'old_string and new_string must be different';
  }

  // Kiem tra old_string khong rong
  if (input.oldString.length === 0) {
    return 'old_string cannot be empty';
  }

  return true;
}

// ============================================================================
// Tool Handler Implementation
// ============================================================================

/**
 * Tao EditTool handler
 * @param context - Execution context
 * @returns Tool handler instance
 */
export function createEditToolHandler(context: ExecutionContext): ToolHandler<EditToolInput, EditToolOutput> {
  return {
    name: 'Edit',
    definition: editToolDefinition,

    validateInput(input: EditToolInput): boolean | string {
      return validateEditInput(input);
    },

    async execute(input: EditToolInput, ctx: ExecutionContext): Promise<EditToolOutput> {
      const fs = await import('fs/promises');

      const { filePath, oldString, newString, replaceAll = false } = input;

      // Doc noi dung file hien tai
      let content: string;
      try {
        content = await fs.readFile(filePath, 'utf-8');
      } catch (error: unknown) {
        const err = error as Error;
        throw new Error(`Failed to read file: ${err.message}`);
      }

      // Dem so lan xuat hien
      const occurrences = countOccurrences(content, oldString);

      if (occurrences === 0) {
        throw new Error(`old_string not found in file: "${oldString.substring(0, 50)}${oldString.length > 50 ? '...' : ''}"`);
      }

      // Kiem tra unique neu khong dung replace_all
      if (!replaceAll && occurrences > 1) {
        throw new Error(
          `old_string is not unique in the file (found ${occurrences} times). ` +
          `Either provide a larger string with more context to make it unique, ` +
          `or use replace_all to change every instance.`
        );
      }

      // Thuc hien thay the
      let newContent: string;
      let replacementCount: number;

      if (replaceAll) {
        // Thay the tat ca
        newContent = content.split(oldString).join(newString);
        replacementCount = occurrences;
      } else {
        // Thay the lan dau tien
        newContent = content.replace(oldString, newString);
        replacementCount = 1;
      }

      // Ghi file
      try {
        await fs.writeFile(filePath, newContent, 'utf-8');
      } catch (error: unknown) {
        const err = error as Error;
        throw new Error(`Failed to write file: ${err.message}`);
      }

      // Tao diff
      const diff = createSimpleDiff(content, newContent);

      // Tao preview
      const previewStart = Math.max(0, newContent.indexOf(newString) - 100);
      const previewEnd = Math.min(newContent.length, newContent.indexOf(newString) + newString.length + 100);
      const preview = newContent.substring(previewStart, previewEnd);

      return {
        success: true,
        filePath,
        replacementCount,
        preview: preview.length > MAX_PREVIEW_LENGTH
          ? preview.substring(0, MAX_PREVIEW_LENGTH) + '...'
          : preview,
        diff,
      };
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Thay the nhieu chuoi trong file
 * @param filePath - Duong dan file
 * @param replacements - Map cac chuoi can thay the
 */
export async function multipleReplacements(
  filePath: string,
  replacements: Map<string, string>
): Promise<EditToolOutput> {
  const fs = await import('fs/promises');

  let content = await fs.readFile(filePath, 'utf-8');
  let totalReplacements = 0;

  for (const [oldStr, newStr] of replacements) {
    const count = countOccurrences(content, oldStr);
    if (count > 0) {
      content = content.split(oldStr).join(newStr);
      totalReplacements += count;
    }
  }

  await fs.writeFile(filePath, content, 'utf-8');

  return {
    success: true,
    filePath,
    replacementCount: totalReplacements,
  };
}

/**
 * Tim tat ca vi tri xuat hien cua chuoi
 * @param content - Noi dung file
 * @param searchString - Chuoi can tim
 * @returns Array cac vi tri (index)
 */
export function findAllPositions(content: string, searchString: string): number[] {
  const positions: number[] = [];
  let position = 0;

  while ((position = content.indexOf(searchString, position)) !== -1) {
    positions.push(position);
    position += searchString.length;
  }

  return positions;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  definition: editToolDefinition,
  createHandler: createEditToolHandler,
  validateInput: validateEditInput,
  countOccurrences,
  createSimpleDiff,
  multipleReplacements,
  findAllPositions,
};
