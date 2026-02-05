/**
 * Claude Code - Skill Parser
 *
 * Module parse skill invocations tu user input.
 * Nhan dien cac slash commands va trich xuat thong tin.
 *
 * Vi du input: "/commit fix typo in readme"
 * Se parse thanh: { skillName: "commit", args: "fix typo in readme" }
 */

import type {
  ParsedSkillInvocation,
  SkillDefinition,
  SkillSuggestion,
} from './types';
import { getAllSkills, getSkill } from './SkillRegistry';

// ============================================================================
// Constants - Hang so
// ============================================================================

/**
 * Regex pattern de nhan dien skill invocation
 * Match: /skill-name [optional args]
 * - Bat dau bang "/"
 * - Ten skill: chu cai, so, dau gach ngang, dau hai cham
 * - Arguments: phan con lai sau khoang trang
 */
const SKILL_PATTERN = /^\/([a-zA-Z0-9_:-]+)(?:\s+(.*))?$/;

/**
 * Regex de nhan dien skill o bat ky vi tri nao trong text
 */
const SKILL_ANYWHERE_PATTERN = /\/([a-zA-Z0-9_:-]+)(?:\s+([^\n]*))?/g;

/**
 * Nguong tuong dong toi thieu cho fuzzy match
 */
const MIN_SIMILARITY_THRESHOLD = 0.3;

/**
 * So luong goi y toi da
 */
const MAX_SUGGESTIONS = 5;

// ============================================================================
// Main Parser Functions - Cac ham parse chinh
// ============================================================================

/**
 * Parse skill invocation tu user input
 *
 * @param input - Chuoi input tu nguoi dung
 * @returns Ket qua parse hoac null neu khong phai skill invocation
 *
 * @example
 * parseSkillInvocation("/commit fix bug")
 * // => { skillName: "commit", args: "fix bug", startIndex: 0, endIndex: 15, rawMatch: "/commit fix bug" }
 *
 * parseSkillInvocation("hello world")
 * // => null
 */
export function parseSkillInvocation(input: string): ParsedSkillInvocation | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // Kiem tra co bat dau bang "/" khong
  if (!trimmed.startsWith('/')) {
    return null;
  }

  const match = trimmed.match(SKILL_PATTERN);
  if (!match) {
    return null;
  }

  const [rawMatch, skillName, args] = match;

  return {
    skillName: skillName.toLowerCase(),
    args: args?.trim() || undefined,
    startIndex: 0,
    endIndex: rawMatch.length,
    rawMatch,
  };
}

/**
 * Parse tat ca skill invocations trong mot doan text
 * Huu ich khi can tim tat ca skills trong message dai
 *
 * @param text - Doan text can parse
 * @returns Mang cac ket qua parse
 *
 * @example
 * parseAllSkillInvocations("First /commit then /review-pr 123")
 * // => [{ skillName: "commit", ... }, { skillName: "review-pr", args: "123", ... }]
 */
export function parseAllSkillInvocations(text: string): ParsedSkillInvocation[] {
  if (!text || typeof text !== 'string') {
    return [];
  }

  const results: ParsedSkillInvocation[] = [];
  let match: RegExpExecArray | null;

  // Reset regex state
  SKILL_ANYWHERE_PATTERN.lastIndex = 0;

  while ((match = SKILL_ANYWHERE_PATTERN.exec(text)) !== null) {
    const [rawMatch, skillName, args] = match;

    results.push({
      skillName: skillName.toLowerCase(),
      args: args?.trim() || undefined,
      startIndex: match.index,
      endIndex: match.index + rawMatch.length,
      rawMatch,
    });
  }

  return results;
}

/**
 * Kiem tra xem input co phai skill invocation khong
 *
 * @param input - Input can kiem tra
 * @returns true neu la skill invocation
 */
export function isSkillInvocation(input: string): boolean {
  return parseSkillInvocation(input) !== null;
}

/**
 * Kiem tra skill invocation co hop le khong (skill ton tai)
 *
 * @param input - Input can kiem tra
 * @returns true neu la skill invocation hop le
 */
export function isValidSkillInvocation(input: string): boolean {
  const parsed = parseSkillInvocation(input);
  if (!parsed) return false;

  return getSkill(parsed.skillName) !== undefined;
}

// ============================================================================
// Skill Name Utilities - Tien ich xu ly ten skill
// ============================================================================

/**
 * Tach plugin prefix tu ten skill
 *
 * @param name - Ten skill (co the co prefix)
 * @returns Object chua pluginName va skillName
 *
 * @example
 * splitSkillName("git-workflow:commit")
 * // => { pluginName: "git-workflow", skillName: "commit" }
 *
 * splitSkillName("commit")
 * // => { pluginName: undefined, skillName: "commit" }
 */
export function splitSkillName(name: string): {
  pluginName: string | undefined;
  skillName: string;
} {
  const colonIndex = name.lastIndexOf(':');

  if (colonIndex === -1) {
    return {
      pluginName: undefined,
      skillName: name,
    };
  }

  return {
    pluginName: name.substring(0, colonIndex),
    skillName: name.substring(colonIndex + 1),
  };
}

/**
 * Tao ten day du cua skill (voi plugin prefix)
 *
 * @param pluginName - Ten plugin (optional)
 * @param skillName - Ten skill
 * @returns Ten day du
 */
export function buildSkillName(
  pluginName: string | undefined,
  skillName: string
): string {
  if (pluginName) {
    return `${pluginName}:${skillName}`;
  }
  return skillName;
}

/**
 * Lay ten hien thi cua skill (co dau "/" o truoc)
 *
 * @param skillName - Ten skill
 * @returns Ten hien thi
 */
export function getDisplayName(skillName: string): string {
  return skillName.startsWith('/') ? skillName : `/${skillName}`;
}

// ============================================================================
// Fuzzy Matching - Tim kiem tuong tu
// ============================================================================

/**
 * Tinh diem tuong dong giua 2 chuoi (Levenshtein-based)
 *
 * @param a - Chuoi thu nhat
 * @param b - Chuoi thu hai
 * @returns Diem tuong dong (0-1, 1 la giong hoan toan)
 */
export function calculateSimilarity(a: string, b: string): number {
  if (!a || !b) return 0;

  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();

  if (aLower === bLower) return 1;

  // Neu a la prefix cua b hoac nguoc lai, diem cao
  if (bLower.startsWith(aLower)) return 0.9;
  if (aLower.startsWith(bLower)) return 0.8;

  // Tinh Levenshtein distance
  const distance = levenshteinDistance(aLower, bLower);
  const maxLen = Math.max(aLower.length, bLower.length);

  // Convert distance thanh similarity score
  return Math.max(0, 1 - distance / maxLen);
}

/**
 * Tinh Levenshtein distance giua 2 chuoi
 *
 * @param a - Chuoi thu nhat
 * @param b - Chuoi thu hai
 * @returns Khoang cach edit
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Khoi tao matrix
  for (let i = 0; i <= a.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= b.length; j++) {
    matrix[0]![j] = j;
  }

  // Dien matrix
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i]![j] = Math.min(
        matrix[i - 1]![j]! + 1,      // deletion
        matrix[i]![j - 1]! + 1,      // insertion
        matrix[i - 1]![j - 1]! + cost // substitution
      );
    }
  }

  return matrix[a.length]![b.length]!;
}

/**
 * Tim cac skills tuong tu voi input (goi y khi go sai)
 *
 * @param input - Ten skill nguoi dung da nhap
 * @param options - Tuy chon tim kiem
 * @returns Mang cac goi y sap xep theo do tuong dong
 *
 * @example
 * suggestSimilarSkills("comit")
 * // => [{ skill: commitSkill, score: 0.85 }]
 */
export function suggestSimilarSkills(
  input: string,
  options: {
    maxSuggestions?: number;
    threshold?: number;
    includeHidden?: boolean;
  } = {}
): SkillSuggestion[] {
  const {
    maxSuggestions = MAX_SUGGESTIONS,
    threshold = MIN_SIMILARITY_THRESHOLD,
    includeHidden = false,
  } = options;

  if (!input || typeof input !== 'string') {
    return [];
  }

  const normalizedInput = input.toLowerCase().replace(/^\//, '');
  const allSkills = getAllSkills();

  const suggestions: SkillSuggestion[] = [];

  for (const skill of allSkills) {
    // Bo qua skills an neu khong yeu cau
    if (!includeHidden && skill.isHidden) {
      continue;
    }

    // Bo qua skills bi tat
    if (!skill.isEnabled()) {
      continue;
    }

    // Tinh diem tuong dong voi ten skill
    const skillName = skill.userFacingName().toLowerCase();
    const score = calculateSimilarity(normalizedInput, skillName);

    // Cung tinh voi aliases neu co (trong description)
    // TODO: Ho tro aliases trong tuong lai

    if (score >= threshold) {
      suggestions.push({ skill, score });
    }
  }

  // Sap xep theo score giam dan va gioi han so luong
  return suggestions
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSuggestions);
}

// ============================================================================
// Autocomplete Support - Ho tro autocomplete
// ============================================================================

/**
 * Lay danh sach cac skill names cho autocomplete
 *
 * @param prefix - Prefix de loc (optional)
 * @returns Mang ten skills
 */
export function getSkillNamesForAutocomplete(prefix?: string): string[] {
  const allSkills = getAllSkills();

  const names = allSkills
    .filter(skill => skill.isEnabled() && !skill.isHidden)
    .map(skill => skill.userFacingName());

  if (!prefix) {
    return names.sort();
  }

  const normalizedPrefix = prefix.toLowerCase().replace(/^\//, '');

  return names
    .filter(name => name.toLowerCase().startsWith(normalizedPrefix))
    .sort();
}

/**
 * Tao text goi y khi skill khong tim thay
 *
 * @param input - Input nguoi dung da nhap
 * @returns Thong bao goi y
 */
export function createNotFoundMessage(input: string): string {
  const parsed = parseSkillInvocation(input);
  if (!parsed) {
    return 'Invalid skill invocation format. Use /skill-name [args].';
  }

  const suggestions = suggestSimilarSkills(parsed.skillName);

  if (suggestions.length === 0) {
    return `Skill "/${parsed.skillName}" not found. Use /help to see available skills.`;
  }

  const suggestionNames = suggestions
    .map(s => `/${s.skill.userFacingName()}`)
    .join(', ');

  return `Skill "/${parsed.skillName}" not found. Did you mean: ${suggestionNames}?`;
}

// ============================================================================
// Format Functions - Cac ham format output
// ============================================================================

/**
 * Format skill invocation thanh text hien thi
 * Dung de render trong UI hoac logs
 *
 * @param invocation - Parsed invocation
 * @returns Formatted string
 */
export function formatSkillInvocation(invocation: ParsedSkillInvocation): string {
  if (invocation.args) {
    return `/${invocation.skillName} ${invocation.args}`;
  }
  return `/${invocation.skillName}`;
}

/**
 * Tao XML tags cho skill invocation
 * Dung khi gui ve LLM
 *
 * @param skill - Skill definition
 * @param args - Arguments
 * @returns XML formatted string
 */
export function formatSkillAsXml(skill: SkillDefinition, args?: string): string {
  const lines: string[] = [
    `<command-name>${skill.userFacingName()}</command-name>`,
    `<skill-name>/${skill.userFacingName()}</skill-name>`,
  ];

  if (args) {
    lines.push(`<command-args>${args}</command-args>`);
  }

  return lines.join('\n');
}

/**
 * Tao loading indicator cho skill
 *
 * @param skillName - Ten skill
 * @param status - Trang thai ('loading' | 'executing' | 'done')
 * @returns Formatted string
 */
export function formatSkillLoading(
  skillName: string,
  status: 'loading' | 'executing' | 'done' = 'loading'
): string {
  return [
    `<command-name>${skillName}</command-name>`,
    `<skill-name>/${skillName}</skill-name>`,
    '<skill-format>true</skill-format>',
  ].join('\n');
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Main parsing
  parseSkillInvocation,
  parseAllSkillInvocations,
  isSkillInvocation,
  isValidSkillInvocation,

  // Name utilities
  splitSkillName,
  buildSkillName,
  getDisplayName,

  // Fuzzy matching
  calculateSimilarity,
  suggestSimilarSkills,

  // Autocomplete
  getSkillNamesForAutocomplete,
  createNotFoundMessage,

  // Formatting
  formatSkillInvocation,
  formatSkillAsXml,
  formatSkillLoading,
};
