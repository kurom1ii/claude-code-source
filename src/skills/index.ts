/**
 * Claude Code - Skills Module
 *
 * Module cung cap he thong skills (slash commands) cho Claude Code.
 * Skills cho phep nguoi dung thuc thi cac tac vu pho bien
 * thong qua cac lenh don gian bat dau bang dau "/"
 *
 * Cac thanh phan chinh:
 * - types.ts: Cac kieu du lieu co ban
 * - SkillRegistry.ts: Quan ly dang ky va tim kiem skills
 * - SkillParser.ts: Parse skill invocations tu user input
 * - SkillExecutor.ts: Thuc thi skills
 * - built-in/: Cac skills duoc tich hop san
 *
 * Usage:
 * ```typescript
 * import {
 *   registerSkill,
 *   executeSkillFromInput,
 *   parseSkillInvocation,
 * } from './skills';
 *
 * // Dang ky built-in skills
 * registerBuiltinSkills();
 *
 * // Parse va thuc thi
 * const result = await executeSkillFromInput('/commit fix bug', context);
 * ```
 */

// ============================================================================
// Type Exports
// ============================================================================

export * from './types';

// Re-export types for convenience
export type {
  SkillDefinition,
  SkillHandler,
  SkillSource,
  SkillType,
  SkillCallResult,
  SkillExecutionContext,
  SkillDoneCallback,
  SkillResumeFunction,
  ParsedSkillInvocation,
  SkillSuggestion,
  SkillUsageInfo,
  SkillHookEvent,
  SkillHook,
  PromptMessage,
  PromptSkillDefinition,
  SkillListingAttachment,
  SkillListFormatOptions,
} from './types';

// ============================================================================
// Registry Exports
// ============================================================================

import skillRegistry, {
  SkillRegistry,
  registerSkill,
  registerSkills,
  unregisterSkill,
  getSkill,
  getAllSkills,
  getVisibleSkills,
  getSkillsBySource,
  hasSkill,
  trackSkillUsage,
  getInvokedSkills,
  clearInvokedSkills,
  resetRegistry,
} from './SkillRegistry';

export {
  SkillRegistry,
  registerSkill,
  registerSkills,
  unregisterSkill,
  getSkill,
  getAllSkills,
  getVisibleSkills,
  getSkillsBySource,
  hasSkill,
  trackSkillUsage,
  getInvokedSkills,
  clearInvokedSkills,
  resetRegistry,
};

// ============================================================================
// Parser Exports
// ============================================================================

import skillParser, {
  parseSkillInvocation,
  parseAllSkillInvocations,
  isSkillInvocation,
  isValidSkillInvocation,
  splitSkillName,
  buildSkillName,
  getDisplayName,
  calculateSimilarity,
  suggestSimilarSkills,
  getSkillNamesForAutocomplete,
  createNotFoundMessage,
  formatSkillInvocation,
  formatSkillAsXml,
  formatSkillLoading,
} from './SkillParser';

export {
  parseSkillInvocation,
  parseAllSkillInvocations,
  isSkillInvocation,
  isValidSkillInvocation,
  splitSkillName,
  buildSkillName,
  getDisplayName,
  calculateSimilarity,
  suggestSimilarSkills,
  getSkillNamesForAutocomplete,
  createNotFoundMessage,
  formatSkillInvocation,
  formatSkillAsXml,
  formatSkillLoading,
};

// ============================================================================
// Executor Exports
// ============================================================================

import skillExecutor, {
  executeSkillFromInput,
  executeSkillFromInvocation,
  executeSkill,
  registerSkillHook,
  clearAllHooks,
  getHooksForEvent,
  createSuccessResult,
  createErrorResult,
  hasRunningSkills,
  getDefaultContext,
  getSlowOperations,
  executeSkillsSequential,
  executeSkillsParallel,
  type ExecuteOptions,
} from './SkillExecutor';

export {
  executeSkillFromInput,
  executeSkillFromInvocation,
  executeSkill,
  registerSkillHook,
  clearAllHooks,
  getHooksForEvent,
  createSuccessResult,
  createErrorResult,
  hasRunningSkills,
  getDefaultContext,
  getSlowOperations,
  executeSkillsSequential,
  executeSkillsParallel,
  type ExecuteOptions,
};

// ============================================================================
// Built-in Skills Exports
// ============================================================================

import builtinSkills, {
  // Commit Skill
  CommitSkill,
  commitSkillDefinition,
  commitSkillHandler,
  getCommitPrompt,
  parseCommitType,
  validateCommitMessage,
  formatCommitMessage,
  createGitCommitCommand,
  COMMIT_TYPES,
  CO_AUTHOR,

  // Review PR Skill
  ReviewPRSkill,
  reviewPRSkillDefinition,
  reviewPRSkillHandler,
  getReviewPRPrompt,
  parsePRIdentifier,
  formatReviewComment,
  createReviewSummary,
  REVIEW_COMMENT_TYPES,
  SEVERITY_LEVELS,

  // Help Skill
  HelpSkill,
  helpSkillDefinition,
  helpSkillHandler,
  HELP_TOPICS,

  // Arrays
  BUILTIN_SKILL_DEFINITIONS,
  BUILTIN_SKILL_HANDLERS,

  // Functions
  getBuiltinSkillDefinition,
  getBuiltinSkillHandler,
  isBuiltinSkill,
  getBuiltinSkillNames,
} from './built-in';

export {
  // Modules
  CommitSkill,
  ReviewPRSkill,
  HelpSkill,

  // Commit
  commitSkillDefinition,
  commitSkillHandler,
  getCommitPrompt,
  parseCommitType,
  validateCommitMessage,
  formatCommitMessage,
  createGitCommitCommand,
  COMMIT_TYPES,
  CO_AUTHOR,

  // Review PR
  reviewPRSkillDefinition,
  reviewPRSkillHandler,
  getReviewPRPrompt,
  parsePRIdentifier,
  formatReviewComment,
  createReviewSummary,
  REVIEW_COMMENT_TYPES,
  SEVERITY_LEVELS,

  // Help
  helpSkillDefinition,
  helpSkillHandler,
  HELP_TOPICS,

  // Arrays
  BUILTIN_SKILL_DEFINITIONS,
  BUILTIN_SKILL_HANDLERS,

  // Functions
  getBuiltinSkillDefinition,
  getBuiltinSkillHandler,
  isBuiltinSkill,
  getBuiltinSkillNames,
};

// ============================================================================
// Initialization Functions
// ============================================================================

/**
 * Dang ky tat ca built-in skills voi registry
 * Goi ham nay khi khoi dong ung dung
 */
export function registerBuiltinSkills(): void {
  registerSkills(BUILTIN_SKILL_DEFINITIONS);
}

/**
 * Reset toan bo skill system
 * Dung cho testing hoac khi can reset state
 */
export function resetSkillSystem(): void {
  resetRegistry();
  clearAllHooks();
  clearInvokedSkills();
}

/**
 * Khoi tao skill system voi cac options
 */
export interface SkillSystemOptions {
  /** Co dang ky built-in skills khong */
  registerBuiltin?: boolean;
  /** Cac skill tuy chinh can dang ky them */
  customSkills?: import('./types').SkillDefinition[];
}

/**
 * Khoi tao skill system
 * @param options - Options
 */
export function initializeSkillSystem(options: SkillSystemOptions = {}): void {
  const { registerBuiltin = true, customSkills = [] } = options;

  // Reset truoc
  resetSkillSystem();

  // Dang ky built-in skills
  if (registerBuiltin) {
    registerBuiltinSkills();
  }

  // Dang ky custom skills
  if (customSkills.length > 0) {
    registerSkills(customSkills);
  }
}

// ============================================================================
// Convenience Functions
// ============================================================================

/**
 * Thuc thi skill nhanh tu input string
 * Combine parse + execute trong mot ham
 *
 * @param input - User input (vd: "/commit fix bug")
 * @param workingDirectory - Thu muc lam viec (optional)
 * @returns Ket qua thuc thi
 */
export async function runSkill(
  input: string,
  workingDirectory?: string
): Promise<import('./types').SkillCallResult> {
  const context = workingDirectory
    ? { ...getDefaultContext(), workingDirectory }
    : getDefaultContext();

  return executeSkillFromInput(input, context);
}

/**
 * Lay skill suggestions cho autocomplete
 * @param partial - Phan da go (vd: "com" -> ["commit"])
 * @returns Danh sach ten skills phu hop
 */
export function getSkillSuggestions(partial: string): string[] {
  return getSkillNamesForAutocomplete(partial);
}

/**
 * Kiem tra va tra ve thong bao loi neu skill khong ton tai
 * @param input - User input
 * @returns null neu hop le, string loi neu khong
 */
export function validateSkillInput(input: string): string | null {
  if (!isSkillInvocation(input)) {
    return null; // Khong phai skill invocation, khong can validate
  }

  if (!isValidSkillInvocation(input)) {
    return createNotFoundMessage(input);
  }

  return null;
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Registry
  registry: skillRegistry,
  registerSkill,
  registerSkills,
  unregisterSkill,
  getSkill,
  getAllSkills,
  getVisibleSkills,

  // Parser
  parser: skillParser,
  parseSkillInvocation,
  isSkillInvocation,
  suggestSimilarSkills,

  // Executor
  executor: skillExecutor,
  executeSkillFromInput,
  executeSkill,
  registerSkillHook,

  // Built-in skills
  builtinSkills,
  BUILTIN_SKILL_DEFINITIONS,

  // Initialization
  registerBuiltinSkills,
  initializeSkillSystem,
  resetSkillSystem,

  // Convenience
  runSkill,
  getSkillSuggestions,
  validateSkillInput,
};
