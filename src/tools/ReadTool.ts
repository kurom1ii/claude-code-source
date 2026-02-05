/**
 * ReadTool - Tool doc file tu he thong
 *
 * Doc noi dung file voi cac tuy chon:
 * - Doc toan bo hoac mot phan file
 * - Ho tro offset va limit theo dong
 * - Doc PDF voi trang cu the
 * - Doc Jupyter notebooks
 * - Doc file anh (multimodal)
 */

import type { ToolDefinition, ToolHandler, ExecutionContext } from './types';

// ============================================================================
// Input/Output Interfaces
// ============================================================================

/**
 * Tham so dau vao cho ReadTool
 */
export interface ReadToolInput {
  /** Duong dan tuyet doi den file can doc */
  filePath: string;
  /** Dong bat dau doc (1-indexed) */
  offset?: number;
  /** So dong can doc */
  limit?: number;
  /** Khoang trang can doc (chi cho PDF, VD: "1-5", "3", "10-20") */
  pages?: string;
}

/**
 * Ket qua tra ve tu ReadTool
 */
export interface ReadToolOutput {
  /** Noi dung file */
  content: string;
  /** Tong so dong trong file */
  totalLines: number;
  /** Dong bat dau doc */
  startLine: number;
  /** Dong ket thuc doc */
  endLine: number;
  /** Loai file */
  fileType: FileType;
  /** File co bi truncate khong */
  truncated: boolean;
  /** Encoding cua file */
  encoding: string;
}

/**
 * Cac loai file duoc ho tro
 */
export type FileType =
  | 'text'        // File text thuong
  | 'pdf'         // PDF document
  | 'notebook'    // Jupyter notebook (.ipynb)
  | 'image'       // File anh (PNG, JPG, etc.)
  | 'binary';     // File binary khac

// ============================================================================
// Constants - Cac hang so
// ============================================================================

/** So dong mac dinh doc tu dau file */
const DEFAULT_LINE_LIMIT = 2000;

/** Do dai toi da cua mot dong */
const MAX_LINE_LENGTH = 2000;

/** So trang toi da doc PDF moi lan */
const MAX_PDF_PAGES = 20;

/** Cac extension cua file anh */
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.svg'];

/** Cac extension cua file PDF */
const PDF_EXTENSIONS = ['.pdf'];

/** Extension cua Jupyter notebook */
const NOTEBOOK_EXTENSIONS = ['.ipynb'];

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Dinh nghia cua ReadTool
 */
export const readToolDefinition: ToolDefinition = {
  name: 'Read',
  description: 'Reads a file from the local filesystem',
  category: 'filesystem',
  requiresConfirmation: false,
  parameters: {
    file_path: {
      type: 'string',
      description: 'The absolute path to the file to read',
      required: true,
    },
    offset: {
      type: 'number',
      description: 'The line number to start reading from. Only provide if the file is too large to read at once',
      required: false,
    },
    limit: {
      type: 'number',
      description: 'The number of lines to read. Only provide if the file is too large to read at once',
      required: false,
      default: DEFAULT_LINE_LIMIT,
    },
    pages: {
      type: 'string',
      description: 'Page range for PDF files (e.g., "1-5", "3", "10-20"). Only applicable to PDF files. Maximum 20 pages per request.',
      required: false,
    },
  },
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Xac dinh loai file tu extension
 * @param filePath - Duong dan file
 * @returns Loai file
 */
export function detectFileType(filePath: string): FileType {
  const lowerPath = filePath.toLowerCase();

  if (IMAGE_EXTENSIONS.some(ext => lowerPath.endsWith(ext))) {
    return 'image';
  }
  if (PDF_EXTENSIONS.some(ext => lowerPath.endsWith(ext))) {
    return 'pdf';
  }
  if (NOTEBOOK_EXTENSIONS.some(ext => lowerPath.endsWith(ext))) {
    return 'notebook';
  }

  return 'text';
}

/**
 * Parse page range tu string
 * @param pages - Chuoi page range (VD: "1-5", "3", "10-20")
 * @returns Array cac so trang
 */
export function parsePageRange(pages: string): number[] {
  const result: number[] = [];
  const parts = pages.split(',');

  for (const part of parts) {
    const trimmed = part.trim();

    if (trimmed.includes('-')) {
      // Range: "1-5"
      const [start, end] = trimmed.split('-').map(n => parseInt(n.trim(), 10));
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= Math.min(end, start + MAX_PDF_PAGES - 1); i++) {
          result.push(i);
        }
      }
    } else {
      // Single page: "3"
      const page = parseInt(trimmed, 10);
      if (!isNaN(page)) {
        result.push(page);
      }
    }
  }

  // Gioi han so trang
  return result.slice(0, MAX_PDF_PAGES);
}

/**
 * Format noi dung file voi line numbers (giong cat -n)
 * @param content - Noi dung file
 * @param startLine - Dong bat dau
 * @returns Noi dung da format
 */
export function formatWithLineNumbers(content: string, startLine: number = 1): string {
  const lines = content.split('\n');
  const maxLineNum = startLine + lines.length - 1;
  const padding = String(maxLineNum).length;

  return lines
    .map((line, index) => {
      const lineNum = String(startLine + index).padStart(padding, ' ');
      // Truncate dong qua dai
      const truncatedLine = line.length > MAX_LINE_LENGTH
        ? line.substring(0, MAX_LINE_LENGTH) + '...'
        : line;
      return `${lineNum}\t${truncatedLine}`;
    })
    .join('\n');
}

/**
 * Validate input cho ReadTool
 * @param input - Input can validate
 * @returns true neu hop le, string neu co loi
 */
export function validateReadInput(input: ReadToolInput): boolean | string {
  // Kiem tra file_path bat buoc
  if (!input.filePath || typeof input.filePath !== 'string') {
    return 'file_path is required and must be a string';
  }

  // Kiem tra duong dan tuyet doi
  if (!input.filePath.startsWith('/')) {
    return 'file_path must be an absolute path (starting with /)';
  }

  // Kiem tra offset hop le
  if (input.offset !== undefined) {
    if (typeof input.offset !== 'number' || input.offset < 0) {
      return 'offset must be a non-negative number';
    }
  }

  // Kiem tra limit hop le
  if (input.limit !== undefined) {
    if (typeof input.limit !== 'number' || input.limit <= 0) {
      return 'limit must be a positive number';
    }
  }

  // Kiem tra pages cho PDF
  if (input.pages !== undefined) {
    const fileType = detectFileType(input.filePath);
    if (fileType !== 'pdf') {
      return 'pages parameter is only applicable to PDF files';
    }
  }

  return true;
}

// ============================================================================
// Tool Handler Implementation
// ============================================================================

/**
 * Tao ReadTool handler
 * @param context - Execution context
 * @returns Tool handler instance
 */
export function createReadToolHandler(context: ExecutionContext): ToolHandler<ReadToolInput, ReadToolOutput> {
  return {
    name: 'Read',
    definition: readToolDefinition,

    validateInput(input: ReadToolInput): boolean | string {
      return validateReadInput(input);
    },

    async execute(input: ReadToolInput): Promise<ReadToolOutput> {
      const fs = await import('fs/promises');
      const path = await import('path');

      const filePath = input.filePath;
      const fileType = detectFileType(filePath);

      // Kiem tra file ton tai
      try {
        await fs.access(filePath);
      } catch {
        throw new Error(`File not found: ${filePath}`);
      }

      // Xu ly tuy theo loai file
      switch (fileType) {
        case 'image':
          return handleImageFile(filePath, fs);

        case 'pdf':
          return handlePdfFile(filePath, input.pages, fs);

        case 'notebook':
          return handleNotebookFile(filePath, fs);

        case 'text':
        default:
          return handleTextFile(filePath, input.offset, input.limit, fs);
      }
    },
  };
}

/**
 * Doc file text thuong
 */
async function handleTextFile(
  filePath: string,
  offset?: number,
  limit?: number,
  fs?: typeof import('fs/promises')
): Promise<ReadToolOutput> {
  const fsModule = fs ?? await import('fs/promises');

  // Doc toan bo file
  const content = await fsModule.readFile(filePath, 'utf-8');
  const allLines = content.split('\n');
  const totalLines = allLines.length;

  // Tinh toan range can doc
  const startLine = Math.max(1, offset ?? 1);
  const lineLimit = limit ?? DEFAULT_LINE_LIMIT;
  const endLine = Math.min(startLine + lineLimit - 1, totalLines);

  // Lay cac dong can doc
  const selectedLines = allLines.slice(startLine - 1, endLine);
  const selectedContent = selectedLines.join('\n');

  // Format voi line numbers
  const formattedContent = formatWithLineNumbers(selectedContent, startLine);

  return {
    content: formattedContent,
    totalLines,
    startLine,
    endLine,
    fileType: 'text',
    truncated: endLine < totalLines,
    encoding: 'utf-8',
  };
}

/**
 * Doc file anh (tra ve base64 hoac thong bao)
 */
async function handleImageFile(
  filePath: string,
  fs?: typeof import('fs/promises')
): Promise<ReadToolOutput> {
  const fsModule = fs ?? await import('fs/promises');

  // Doc file binary
  const buffer = await fsModule.readFile(filePath);
  const base64 = buffer.toString('base64');

  // Xac dinh mime type
  const ext = filePath.toLowerCase().split('.').pop();
  const mimeTypes: Record<string, string> = {
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    webp: 'image/webp',
    bmp: 'image/bmp',
    svg: 'image/svg+xml',
  };

  const mimeType = mimeTypes[ext ?? ''] ?? 'application/octet-stream';

  return {
    content: `[Image file: ${filePath}]\nMIME type: ${mimeType}\nSize: ${buffer.length} bytes\nBase64: data:${mimeType};base64,${base64.substring(0, 100)}...`,
    totalLines: 1,
    startLine: 1,
    endLine: 1,
    fileType: 'image',
    truncated: false,
    encoding: 'base64',
  };
}

/**
 * Doc file PDF (can thu vien ho tro)
 */
async function handlePdfFile(
  filePath: string,
  pages?: string,
  fs?: typeof import('fs/promises')
): Promise<ReadToolOutput> {
  // PDF reading can thu vien nhu pdf-parse
  // Day la placeholder implementation

  const pageRange = pages ? parsePageRange(pages) : [1, 2, 3, 4, 5];

  return {
    content: `[PDF file: ${filePath}]\nPages requested: ${pageRange.join(', ')}\nNote: PDF parsing requires pdf-parse library`,
    totalLines: 1,
    startLine: 1,
    endLine: 1,
    fileType: 'pdf',
    truncated: false,
    encoding: 'utf-8',
  };
}

/**
 * Doc Jupyter notebook (.ipynb)
 */
async function handleNotebookFile(
  filePath: string,
  fs?: typeof import('fs/promises')
): Promise<ReadToolOutput> {
  const fsModule = fs ?? await import('fs/promises');

  // Doc va parse JSON
  const content = await fsModule.readFile(filePath, 'utf-8');
  const notebook = JSON.parse(content) as {
    cells: Array<{
      cell_type: string;
      source: string[];
      outputs?: Array<{ text?: string[]; data?: Record<string, string[]> }>;
    }>;
  };

  // Format cac cells
  const formattedCells = notebook.cells.map((cell, index) => {
    const cellType = cell.cell_type;
    const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
    const outputs = cell.outputs?.map(out => {
      if (out.text) return out.text.join('');
      if (out.data?.['text/plain']) return out.data['text/plain'].join('');
      return '[output]';
    }).join('\n') ?? '';

    return `--- Cell ${index + 1} [${cellType}] ---\n${source}${outputs ? `\n[Output]\n${outputs}` : ''}`;
  });

  const formattedContent = formattedCells.join('\n\n');

  return {
    content: formattedContent,
    totalLines: formattedContent.split('\n').length,
    startLine: 1,
    endLine: formattedContent.split('\n').length,
    fileType: 'notebook',
    truncated: false,
    encoding: 'utf-8',
  };
}

// ============================================================================
// Exports
// ============================================================================

export default {
  definition: readToolDefinition,
  createHandler: createReadToolHandler,
  validateInput: validateReadInput,
  detectFileType,
  parsePageRange,
  formatWithLineNumbers,
};
