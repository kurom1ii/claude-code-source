/**
 * Claude Code - Built-in Skills Index
 *
 * Module export tat ca built-in skills.
 * Cac skill nay duoc tich hop san trong Claude Code.
 */

// ============================================================================
// Skill Imports
// ============================================================================

import CommitSkillModule, {
  commitSkillDefinition,
  commitSkillHandler,
  getCommitPrompt,
  parseCommitType,
  validateCommitMessage,
  formatCommitMessage,
  createGitCommitCommand,
  COMMIT_TYPES,
  CO_AUTHOR,
} from './CommitSkill';

import ReviewPRSkillModule, {
  reviewPRSkillDefinition,
  reviewPRSkillHandler,
  getReviewPRPrompt,
  parsePRIdentifier,
  formatReviewComment,
  createReviewSummary,
  SKILL_NAME as REVIEW_SKILL_NAME,
  SKILL_ALIAS as REVIEW_SKILL_ALIAS,
  REVIEW_COMMENT_TYPES,
  SEVERITY_LEVELS,
} from './ReviewPRSkill';

import HelpSkillModule, {
  helpSkillDefinition,
  helpSkillHandler,
  HELP_TOPICS,
  type HelpTopic,
} from './HelpSkill';

import type { SkillDefinition, SkillHandler } from '../types';

// ============================================================================
// Re-exports - Skill Definitions
// ============================================================================

export {
  // Commit Skill
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
  reviewPRSkillDefinition,
  reviewPRSkillHandler,
  getReviewPRPrompt,
  parsePRIdentifier,
  formatReviewComment,
  createReviewSummary,
  REVIEW_SKILL_NAME,
  REVIEW_SKILL_ALIAS,
  REVIEW_COMMENT_TYPES,
  SEVERITY_LEVELS,

  // Help Skill
  helpSkillDefinition,
  helpSkillHandler,
  HELP_TOPICS,
  type HelpTopic,
};

// ============================================================================
// Skill Modules (grouped exports)
// ============================================================================

export const CommitSkill = CommitSkillModule;
export const ReviewPRSkill = ReviewPRSkillModule;
export const HelpSkill = HelpSkillModule;

// ============================================================================
// Built-in Skills Arrays
// ============================================================================

/**
 * Danh sach tat ca built-in skill definitions
 */
export const BUILTIN_SKILL_DEFINITIONS: SkillDefinition[] = [
  commitSkillDefinition,
  reviewPRSkillDefinition,
  helpSkillDefinition,
];

/**
 * Danh sach tat ca built-in skill handlers
 */
export const BUILTIN_SKILL_HANDLERS: SkillHandler[] = [
  commitSkillHandler,
  reviewPRSkillHandler,
  helpSkillHandler,
];

/**
 * Map tu ten skill -> definition
 */
export const SKILL_DEFINITION_MAP: Record<string, SkillDefinition> = {
  commit: commitSkillDefinition,
  'review-pr': reviewPRSkillDefinition,
  review: reviewPRSkillDefinition, // Alias
  help: helpSkillDefinition,
};

/**
 * Map tu ten skill -> handler
 */
export const SKILL_HANDLER_MAP: Record<string, SkillHandler> = {
  commit: commitSkillHandler,
  'review-pr': reviewPRSkillHandler,
  review: reviewPRSkillHandler, // Alias
  help: helpSkillHandler,
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Lay built-in skill definition theo ten
 * @param name - Ten skill
 * @returns Skill definition hoac undefined
 */
export function getBuiltinSkillDefinition(name: string): SkillDefinition | undefined {
  const normalized = name.toLowerCase().replace(/^\//, '');
  return SKILL_DEFINITION_MAP[normalized];
}

/**
 * Lay built-in skill handler theo ten
 * @param name - Ten skill
 * @returns Skill handler hoac undefined
 */
export function getBuiltinSkillHandler(name: string): SkillHandler | undefined {
  const normalized = name.toLowerCase().replace(/^\//, '');
  return SKILL_HANDLER_MAP[normalized];
}

/**
 * Kiem tra co phai built-in skill khong
 * @param name - Ten skill
 * @returns true neu la built-in skill
 */
export function isBuiltinSkill(name: string): boolean {
  return getBuiltinSkillDefinition(name) !== undefined;
}

/**
 * Lay danh sach ten cac built-in skills
 * @returns Mang ten skills
 */
export function getBuiltinSkillNames(): string[] {
  return BUILTIN_SKILL_DEFINITIONS.map(s => s.userFacingName());
}

// ============================================================================
// Default Export
// ============================================================================

export default {
  // Modules
  CommitSkill,
  ReviewPRSkill,
  HelpSkill,

  // Arrays
  BUILTIN_SKILL_DEFINITIONS,
  BUILTIN_SKILL_HANDLERS,

  // Maps
  SKILL_DEFINITION_MAP,
  SKILL_HANDLER_MAP,

  // Functions
  getBuiltinSkillDefinition,
  getBuiltinSkillHandler,
  isBuiltinSkill,
  getBuiltinSkillNames,
};
