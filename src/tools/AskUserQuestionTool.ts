/**
 * AskUserQuestion Tool
 *
 * Tool để hỏi user câu hỏi khi cần làm rõ thông tin,
 * xác nhận lựa chọn, hoặc thu thập preferences.
 *
 * Features:
 * - Hỗ trợ 1-4 câu hỏi trong một lần gọi
 * - Mỗi câu hỏi có 2-4 options
 * - Support multiSelect cho nhiều lựa chọn
 * - User luôn có thể chọn "Other" để nhập custom input
 */

import type { ToolDefinition, ToolHandler, ExecutionContext, ToolResult } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Option cho một câu hỏi
 */
export interface QuestionOption {
  /** Label hiển thị cho user */
  label: string;
  /** Mô tả chi tiết về option này */
  description: string;
}

/**
 * Một câu hỏi trong tool input
 */
export interface Question {
  /** Câu hỏi đầy đủ để hỏi user */
  question: string;
  /** Header ngắn hiển thị như chip/tag (max 12 chars) */
  header: string;
  /** Các options để chọn (2-4 options) */
  options: QuestionOption[];
  /** Cho phép chọn nhiều options */
  multiSelect: boolean;
}

/**
 * Metadata tùy chọn cho tracking
 */
export interface QuestionMetadata {
  /** Nguồn của câu hỏi (vd: "remember" cho /remember command) */
  source?: string;
}

/**
 * Input của AskUserQuestion tool
 */
export interface AskUserQuestionInput {
  /** Danh sách câu hỏi (1-4 câu) */
  questions: Question[];
  /** Metadata tùy chọn */
  metadata?: QuestionMetadata;
  /** Câu trả lời đã thu thập (internal use) */
  answers?: Record<string, string>;
}

/**
 * Output của AskUserQuestion tool
 */
export interface AskUserQuestionOutput {
  /** Câu trả lời của user theo format: questionIndex -> answer */
  answers: Record<string, string>;
  /** Có user chọn "Other" và nhập custom không */
  hasCustomInput: boolean;
}

// ============================================================================
// Constants
// ============================================================================

/** Số câu hỏi tối thiểu */
export const MIN_QUESTIONS = 1;

/** Số câu hỏi tối đa */
export const MAX_QUESTIONS = 4;

/** Số options tối thiểu mỗi câu hỏi */
export const MIN_OPTIONS = 2;

/** Số options tối đa mỗi câu hỏi */
export const MAX_OPTIONS = 4;

/** Độ dài tối đa của header */
export const MAX_HEADER_LENGTH = 12;

// ============================================================================
// Tool Definition
// ============================================================================

/**
 * Definition của AskUserQuestion tool cho API
 */
export const askUserQuestionToolDefinition: ToolDefinition = {
  name: 'AskUserQuestion',
  description: `Use this tool when you need to ask the user questions during execution. This allows you to:
1. Gather user preferences or requirements
2. Clarify ambiguous instructions
3. Get decisions on implementation choices as you work
4. Offer choices to the user about what direction to take.

Usage notes:
- Users will always be able to select "Other" to provide custom text input
- Use multiSelect: true to allow multiple answers to be selected for a question
- If you recommend a specific option, make that the first option in the list and add "(Recommended)" at the end of the label

Plan mode note: In plan mode, use this tool to clarify requirements or choose between approaches BEFORE finalizing your plan. Do NOT use this tool to ask "Is my plan ready?" or "Should I proceed?" - use ExitPlanMode for plan approval.`,
  category: 'user-interaction',
  requiresConfirmation: false,
  parameters: {
    questions: {
      type: 'array',
      description: 'Questions to ask the user (1-4 questions)',
      required: true,
    },
    metadata: {
      type: 'object',
      description: 'Optional metadata for tracking and analytics purposes. Not displayed to user.',
      required: false,
    },
    answers: {
      type: 'object',
      description: 'User answers collected by the permission component (internal use)',
      required: false,
    },
  },
};

// ============================================================================
// Validation
// ============================================================================

/**
 * Validate input của AskUserQuestion tool
 * @param input - Input cần validate
 * @returns true nếu valid, error message nếu invalid
 */
export function validateAskUserQuestionInput(
  input: unknown
): boolean | string {
  if (!input || typeof input !== 'object') {
    return 'Input must be an object';
  }

  const inp = input as Record<string, unknown>;

  // Validate questions array
  if (!Array.isArray(inp.questions)) {
    return 'questions must be an array';
  }

  if (inp.questions.length < MIN_QUESTIONS) {
    return `Must provide at least ${MIN_QUESTIONS} question`;
  }

  if (inp.questions.length > MAX_QUESTIONS) {
    return `Maximum ${MAX_QUESTIONS} questions allowed`;
  }

  // Validate each question
  for (let i = 0; i < inp.questions.length; i++) {
    const q = inp.questions[i] as Record<string, unknown>;

    if (!q || typeof q !== 'object') {
      return `Question ${i + 1} must be an object`;
    }

    if (typeof q.question !== 'string' || q.question.trim() === '') {
      return `Question ${i + 1}: question text is required`;
    }

    if (typeof q.header !== 'string' || q.header.trim() === '') {
      return `Question ${i + 1}: header is required`;
    }

    if (q.header.length > MAX_HEADER_LENGTH) {
      return `Question ${i + 1}: header must be ${MAX_HEADER_LENGTH} chars or less`;
    }

    if (!Array.isArray(q.options)) {
      return `Question ${i + 1}: options must be an array`;
    }

    if (q.options.length < MIN_OPTIONS) {
      return `Question ${i + 1}: must have at least ${MIN_OPTIONS} options`;
    }

    if (q.options.length > MAX_OPTIONS) {
      return `Question ${i + 1}: maximum ${MAX_OPTIONS} options allowed`;
    }

    // Validate each option
    for (let j = 0; j < q.options.length; j++) {
      const opt = q.options[j] as Record<string, unknown>;

      if (!opt || typeof opt !== 'object') {
        return `Question ${i + 1}, Option ${j + 1}: must be an object`;
      }

      if (typeof opt.label !== 'string' || opt.label.trim() === '') {
        return `Question ${i + 1}, Option ${j + 1}: label is required`;
      }

      if (typeof opt.description !== 'string') {
        return `Question ${i + 1}, Option ${j + 1}: description is required`;
      }
    }

    if (typeof q.multiSelect !== 'boolean') {
      return `Question ${i + 1}: multiSelect must be a boolean`;
    }
  }

  return true;
}

// ============================================================================
// Handler
// ============================================================================

/**
 * Tạo handler cho AskUserQuestion tool
 * @param context - Execution context
 * @returns Tool handler
 */
export function createAskUserQuestionToolHandler(
  context: ExecutionContext
): ToolHandler<AskUserQuestionInput, AskUserQuestionOutput> {
  return {
    name: 'AskUserQuestion',
    definition: askUserQuestionToolDefinition,

    validateInput(input: unknown): boolean | string {
      return validateAskUserQuestionInput(input);
    },

    async execute(
      input: AskUserQuestionInput,
      ctx: ExecutionContext
    ): Promise<AskUserQuestionOutput> {
      // Trong môi trường thực, tool này sẽ:
      // 1. Render UI component cho user chọn
      // 2. Đợi user response
      // 3. Return answers

      // Nếu đã có answers (từ UI component)
      if (input.answers && Object.keys(input.answers).length > 0) {
        return {
          answers: input.answers,
          hasCustomInput: Object.values(input.answers).some(
            (answer) => answer === '__custom__' || answer.startsWith('custom:')
          ),
        };
      }

      // Mock response cho testing
      const answers: Record<string, string> = {};

      for (let i = 0; i < input.questions.length; i++) {
        const q = input.questions[i];
        // Default chọn option đầu tiên
        answers[q.question] = q.options[0]?.label || '';
      }

      return {
        answers,
        hasCustomInput: false,
      };
    },
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Tạo question object helper
 * @param question - Câu hỏi
 * @param header - Header ngắn
 * @param options - Các options
 * @param multiSelect - Cho phép chọn nhiều
 * @returns Question object
 */
export function createQuestion(
  question: string,
  header: string,
  options: Array<{ label: string; description: string }>,
  multiSelect = false
): Question {
  return {
    question,
    header: header.slice(0, MAX_HEADER_LENGTH),
    options,
    multiSelect,
  };
}

/**
 * Tạo option object helper
 * @param label - Label hiển thị
 * @param description - Mô tả
 * @returns QuestionOption object
 */
export function createOption(label: string, description: string): QuestionOption {
  return { label, description };
}

/**
 * Kiểm tra xem answer có phải custom input không
 * @param answer - Answer string
 * @returns true nếu là custom input
 */
export function isCustomAnswer(answer: string): boolean {
  return answer === '__custom__' || answer.startsWith('custom:');
}

/**
 * Extract custom value từ answer
 * @param answer - Answer string
 * @returns Custom value hoặc original answer
 */
export function extractCustomValue(answer: string): string {
  if (answer.startsWith('custom:')) {
    return answer.slice(7);
  }
  return answer;
}

// ============================================================================
// Module Export
// ============================================================================

export default {
  definition: askUserQuestionToolDefinition,
  createHandler: createAskUserQuestionToolHandler,
  validate: validateAskUserQuestionInput,
  createQuestion,
  createOption,
  isCustomAnswer,
  extractCustomValue,
  MIN_QUESTIONS,
  MAX_QUESTIONS,
  MIN_OPTIONS,
  MAX_OPTIONS,
  MAX_HEADER_LENGTH,
};
