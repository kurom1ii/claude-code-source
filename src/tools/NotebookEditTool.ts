/**
 * NotebookEdit Tool
 *
 * Tool để chỉnh sửa Jupyter notebooks (.ipynb files).
 * Hỗ trợ replace, insert, và delete cells.
 */

import type { ToolDefinition, ToolHandler, ExecutionContext } from './types';
import * as fs from 'fs/promises';
import * as path from 'path';

// ============================================================================
// Types
// ============================================================================

/**
 * Loại cell trong notebook
 */
export type CellType = 'code' | 'markdown';

/**
 * Chế độ edit
 */
export type EditMode = 'replace' | 'insert' | 'delete';

/**
 * Input của NotebookEdit tool
 */
export interface NotebookEditInput {
  /** Đường dẫn tuyệt đối đến notebook file */
  notebook_path: string;
  /** Source mới cho cell */
  new_source: string;
  /** ID của cell cần edit (dùng cho insert sẽ insert sau cell này) */
  cell_id?: string;
  /** Loại cell (code hoặc markdown) */
  cell_type?: CellType;
  /** Chế độ edit: replace, insert, delete */
  edit_mode?: EditMode;
}

/**
 * Output của NotebookEdit tool
 */
export interface NotebookEditOutput {
  /** Có thành công không */
  success: boolean;
  /** Message mô tả kết quả */
  message: string;
  /** Cell ID sau khi edit */
  cellId?: string;
  /** Số cells trong notebook */
  totalCells?: number;
}

/**
 * Cấu trúc một cell trong notebook
 */
export interface NotebookCell {
  id?: string;
  cell_type: CellType;
  source: string[];
  metadata: Record<string, unknown>;
  execution_count?: number | null;
  outputs?: unknown[];
}

/**
 * Cấu trúc notebook JSON
 */
export interface NotebookContent {
  cells: NotebookCell[];
  metadata: Record<string, unknown>;
  nbformat: number;
  nbformat_minor: number;
}

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Definition của NotebookEdit tool cho API
 */
export const notebookEditToolDefinition: ToolDefinition = {
  name: 'NotebookEdit',
  description: `Completely replaces the contents of a specific cell in a Jupyter notebook (.ipynb file) with new source. Jupyter notebooks are interactive documents that combine code, text, and visualizations, commonly used for data analysis and scientific computing. The notebook_path parameter must be an absolute path, not a relative path. The cell_number is 0-indexed. Use edit_mode=insert to add a new cell at the index specified by cell_number. Use edit_mode=delete to delete the cell at the index specified by cell_number.`,
  category: 'notebook',
  requiresConfirmation: true,
  parameters: {
    notebook_path: {
      type: 'string',
      description:
        'The absolute path to the Jupyter notebook file to edit (must be absolute, not relative)',
      required: true,
    },
    new_source: {
      type: 'string',
      description: 'The new source for the cell',
      required: true,
    },
    cell_id: {
      type: 'string',
      description:
        'The ID of the cell to edit. When inserting a new cell, the new cell will be inserted after the cell with this ID, or at the beginning if not specified.',
      required: false,
    },
    cell_type: {
      type: 'string',
      description:
        'The type of the cell (code or markdown). If not specified, it defaults to the current cell type. If using edit_mode=insert, this is required.',
      required: false,
      enum: ['code', 'markdown'],
    },
    edit_mode: {
      type: 'string',
      description: 'The type of edit to make (replace, insert, delete). Defaults to replace.',
      required: false,
      enum: ['replace', 'insert', 'delete'],
      default: 'replace',
    },
  },
};

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate input của NotebookEdit tool
 */
export function validateNotebookEditInput(
  input: unknown
): boolean | string {
  if (!input || typeof input !== 'object') {
    return 'Input must be an object';
  }

  const inp = input as Record<string, unknown>;

  if (typeof inp.notebook_path !== 'string' || inp.notebook_path.trim() === '') {
    return 'notebook_path is required and must be a string';
  }

  if (!path.isAbsolute(inp.notebook_path)) {
    return 'notebook_path must be an absolute path';
  }

  if (!inp.notebook_path.endsWith('.ipynb')) {
    return 'notebook_path must be a .ipynb file';
  }

  if (typeof inp.new_source !== 'string') {
    return 'new_source is required and must be a string';
  }

  if (inp.cell_type !== undefined && !['code', 'markdown'].includes(inp.cell_type as string)) {
    return 'cell_type must be "code" or "markdown"';
  }

  if (
    inp.edit_mode !== undefined &&
    !['replace', 'insert', 'delete'].includes(inp.edit_mode as string)
  ) {
    return 'edit_mode must be "replace", "insert", or "delete"';
  }

  // Insert mode requires cell_type
  if (inp.edit_mode === 'insert' && !inp.cell_type) {
    return 'cell_type is required when using edit_mode=insert';
  }

  return true;
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Parse notebook file
 */
async function parseNotebook(filePath: string): Promise<NotebookContent> {
  const content = await fs.readFile(filePath, 'utf-8');
  return JSON.parse(content) as NotebookContent;
}

/**
 * Write notebook file
 */
async function writeNotebook(filePath: string, notebook: NotebookContent): Promise<void> {
  const content = JSON.stringify(notebook, null, 2);
  await fs.writeFile(filePath, content, 'utf-8');
}

/**
 * Generate unique cell ID
 */
function generateCellId(): string {
  return Math.random().toString(36).substring(2, 10);
}

/**
 * Convert source string to array of lines
 */
function sourceToLines(source: string): string[] {
  const lines = source.split('\n');
  // Add newline to all lines except the last
  return lines.map((line, i) => (i < lines.length - 1 ? line + '\n' : line));
}

/**
 * Find cell index by ID
 */
function findCellIndex(cells: NotebookCell[], cellId: string): number {
  return cells.findIndex((cell) => cell.id === cellId);
}

// ============================================================================
// Handler
// ============================================================================

/**
 * Tạo handler cho NotebookEdit tool
 */
export function createNotebookEditToolHandler(
  context: ExecutionContext
): ToolHandler<NotebookEditInput, NotebookEditOutput> {
  return {
    name: 'NotebookEdit',
    definition: notebookEditToolDefinition,

    validateInput(input: unknown): boolean | string {
      return validateNotebookEditInput(input);
    },

    async execute(
      input: NotebookEditInput,
      ctx: ExecutionContext
    ): Promise<NotebookEditOutput> {
      const { notebook_path, new_source, cell_id, cell_type, edit_mode = 'replace' } = input;

      try {
        // Kiểm tra file tồn tại
        await fs.access(notebook_path);

        // Parse notebook
        const notebook = await parseNotebook(notebook_path);

        switch (edit_mode) {
          case 'replace': {
            if (!cell_id) {
              return {
                success: false,
                message: 'cell_id is required for replace mode',
              };
            }

            const index = findCellIndex(notebook.cells, cell_id);
            if (index === -1) {
              return {
                success: false,
                message: `Cell with ID "${cell_id}" not found`,
              };
            }

            // Replace cell content
            notebook.cells[index].source = sourceToLines(new_source);
            if (cell_type) {
              notebook.cells[index].cell_type = cell_type;
            }

            await writeNotebook(notebook_path, notebook);

            return {
              success: true,
              message: `Replaced cell ${cell_id}`,
              cellId: cell_id,
              totalCells: notebook.cells.length,
            };
          }

          case 'insert': {
            const newId = generateCellId();
            const newCell: NotebookCell = {
              id: newId,
              cell_type: cell_type || 'code',
              source: sourceToLines(new_source),
              metadata: {},
              ...(cell_type === 'code' ? { execution_count: null, outputs: [] } : {}),
            };

            if (cell_id) {
              const index = findCellIndex(notebook.cells, cell_id);
              if (index === -1) {
                return {
                  success: false,
                  message: `Cell with ID "${cell_id}" not found`,
                };
              }
              // Insert after the specified cell
              notebook.cells.splice(index + 1, 0, newCell);
            } else {
              // Insert at the beginning
              notebook.cells.unshift(newCell);
            }

            await writeNotebook(notebook_path, notebook);

            return {
              success: true,
              message: cell_id
                ? `Inserted new cell after ${cell_id}`
                : 'Inserted new cell at beginning',
              cellId: newId,
              totalCells: notebook.cells.length,
            };
          }

          case 'delete': {
            if (!cell_id) {
              return {
                success: false,
                message: 'cell_id is required for delete mode',
              };
            }

            const index = findCellIndex(notebook.cells, cell_id);
            if (index === -1) {
              return {
                success: false,
                message: `Cell with ID "${cell_id}" not found`,
              };
            }

            notebook.cells.splice(index, 1);
            await writeNotebook(notebook_path, notebook);

            return {
              success: true,
              message: `Deleted cell ${cell_id}`,
              totalCells: notebook.cells.length,
            };
          }

          default:
            return {
              success: false,
              message: `Unknown edit_mode: ${edit_mode}`,
            };
        }
      } catch (error) {
        const err = error as Error;
        return {
          success: false,
          message: err.message,
        };
      }
    },
  };
}

// ============================================================================
// Module Export
// ============================================================================

export default {
  definition: notebookEditToolDefinition,
  createHandler: createNotebookEditToolHandler,
  validate: validateNotebookEditInput,
  parseNotebook,
  writeNotebook,
  generateCellId,
  sourceToLines,
  findCellIndex,
};
