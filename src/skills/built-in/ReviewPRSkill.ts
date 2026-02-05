/**
 * Claude Code - Review PR Skill
 *
 * Skill /review-pr giup review pull requests tren GitHub.
 * Phan tich code changes, tim loi va dua ra goi y cai thien.
 *
 * Usage: /review-pr [pr-number]
 * - Neu co pr-number: Review PR cu the
 * - Neu khong co: Liet ke cac PR dang mo
 */

import type {
  SkillDefinition,
  SkillDoneCallback,
  SkillResumeFunction,
  SkillHandler,
  SkillCallResult,
  SkillExecutionContext,
  PromptMessage,
} from '../types';

// ============================================================================
// Constants - Hang so
// ============================================================================

/**
 * Ten skill
 */
const SKILL_NAME = 'review-pr';

/**
 * Ten alias
 */
const SKILL_ALIAS = 'review';

/**
 * Plugin name mac dinh (neu co)
 */
const PLUGIN_NAME = 'code-review';

/**
 * Cac loai comment review
 */
const REVIEW_COMMENT_TYPES = [
  'suggestion',   // Goi y cai thien
  'issue',        // Van de can sua
  'question',     // Cau hoi can lam ro
  'praise',       // Khen ngoi code tot
  'nitpick',      // Chi tiet nho
] as const;

/**
 * Muc do nghiem trong
 */
const SEVERITY_LEVELS = [
  'critical',     // Phai sua truoc khi merge
  'major',        // Nen sua
  'minor',        // Co the sua sau
  'info',         // Thong tin tham khao
] as const;

// ============================================================================
// Skill Definition - Dinh nghia skill
// ============================================================================

/**
 * Dinh nghia cho review-pr skill
 */
export const reviewPRSkillDefinition: SkillDefinition = {
  type: 'prompt',
  name: SKILL_NAME,
  description: 'Review a pull request',
  argumentHint: '[pr-number or URL]',
  isEnabled: () => true,
  isHidden: false,
  source: 'built-in',
  pluginName: PLUGIN_NAME,

  async call(
    done: SkillDoneCallback,
    _resume: SkillResumeFunction | undefined,
    args?: string
  ): Promise<unknown> {
    // Track usage
    // trackUsage('review');

    done(undefined, { display: 'skip' });
    return null;
  },

  userFacingName(): string {
    return SKILL_ALIAS; // Hien thi la "review" thay vi "review-pr"
  },
};

// ============================================================================
// Prompt Generation - Tao prompt cho LLM
// ============================================================================

/**
 * Tao prompt de review PR
 *
 * @param args - Arguments tu user (PR number hoac URL)
 * @returns Mang prompt messages
 */
export async function getReviewPRPrompt(args?: string): Promise<PromptMessage[]> {
  const prIdentifier = args?.trim() || '';

  const promptText = `
You are an expert code reviewer. Follow these steps:

1. **If no PR number is provided:**
   - Run \`gh pr list\` to show open PRs
   - Ask user which PR they want to review

2. **If a PR number/URL is provided:**
   - Run \`gh pr view ${prIdentifier || '<number>'}\` to get PR details
   - Run \`gh pr diff ${prIdentifier || '<number>'}\` to get the diff
   - Run \`gh pr checks ${prIdentifier || '<number>'}\` to see CI status

3. **Analyze the changes and provide a thorough code review:**

## Review Structure

### Overview
- What does this PR do?
- What problem does it solve?

### Code Quality Analysis
- Code style and conventions
- Logic correctness
- Error handling
- Edge cases

### Security Review
- Input validation
- Authentication/Authorization
- Data exposure risks
- SQL injection, XSS, etc.

### Performance Considerations
- Time complexity
- Memory usage
- Database queries
- Network calls

### Test Coverage
- Are there tests for new code?
- Do tests cover edge cases?
- Are tests meaningful?

### Suggestions
- Specific improvements with code examples
- Alternative approaches if applicable

## Review Guidelines

- Be constructive and respectful
- Focus on the code, not the person
- Provide actionable feedback
- Highlight good practices too
- Use severity levels: ${SEVERITY_LEVELS.join(', ')}

${prIdentifier ? `**PR to review:** ${prIdentifier}` : '**No PR specified - list open PRs first**'}
`;

  return [
    {
      type: 'text',
      text: promptText,
    },
  ];
}

// ============================================================================
// Skill Handler Implementation
// ============================================================================

/**
 * Handler xu ly review-pr skill
 */
export const reviewPRSkillHandler: SkillHandler = {
  definition: reviewPRSkillDefinition,

  /**
   * Validate arguments
   */
  validateArgs(args: string | undefined): boolean | string {
    if (!args) {
      // Khong co args la ok - se list PRs
      return true;
    }

    // Neu co args, kiem tra format
    const trimmed = args.trim();

    // Chap nhan: so, URL GitHub, hoac owner/repo#number
    const isValidNumber = /^\d+$/.test(trimmed);
    const isValidUrl = trimmed.includes('github.com') && trimmed.includes('/pull/');
    const isValidRef = /^[\w-]+\/[\w-]+#\d+$/.test(trimmed);

    if (!isValidNumber && !isValidUrl && !isValidRef) {
      return 'Invalid PR identifier. Use: number, GitHub URL, or owner/repo#number';
    }

    return true;
  },

  /**
   * Thuc thi skill
   */
  async execute(
    args: string | undefined,
    context: SkillExecutionContext
  ): Promise<SkillCallResult> {
    try {
      // Tao prompt
      const prompts = await getReviewPRPrompt(args);

      return {
        success: true,
        result: {
          type: 'prompt',
          messages: prompts,
          workingDirectory: context.workingDirectory,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  },
};

// ============================================================================
// Utility Functions - Cac ham tien ich
// ============================================================================

/**
 * Parse PR identifier tu input
 *
 * @param input - Input tu user
 * @returns Parsed PR info
 */
export function parsePRIdentifier(input: string): {
  number?: number;
  owner?: string;
  repo?: string;
  url?: string;
} | null {
  const trimmed = input.trim();

  // So thuan tuy: "123"
  if (/^\d+$/.test(trimmed)) {
    return { number: parseInt(trimmed, 10) };
  }

  // GitHub URL: "https://github.com/owner/repo/pull/123"
  const urlMatch = trimmed.match(
    /github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/
  );
  if (urlMatch) {
    return {
      owner: urlMatch[1],
      repo: urlMatch[2],
      number: parseInt(urlMatch[3]!, 10),
      url: trimmed,
    };
  }

  // Reference: "owner/repo#123"
  const refMatch = trimmed.match(/^([\w-]+)\/([\w-]+)#(\d+)$/);
  if (refMatch) {
    return {
      owner: refMatch[1],
      repo: refMatch[2],
      number: parseInt(refMatch[3]!, 10),
    };
  }

  return null;
}

/**
 * Tao review comment format
 *
 * @param comment - Noi dung comment
 * @param options - Options
 * @returns Formatted comment
 */
export function formatReviewComment(
  comment: string,
  options: {
    type?: typeof REVIEW_COMMENT_TYPES[number];
    severity?: typeof SEVERITY_LEVELS[number];
    file?: string;
    line?: number;
  } = {}
): string {
  const { type = 'suggestion', severity = 'info', file, line } = options;

  const typeEmoji: Record<string, string> = {
    suggestion: '💡',
    issue: '⚠️',
    question: '❓',
    praise: '👍',
    nitpick: '🔍',
  };

  const severityLabel: Record<string, string> = {
    critical: '[CRITICAL]',
    major: '[MAJOR]',
    minor: '[MINOR]',
    info: '',
  };

  let formatted = `${typeEmoji[type]} ${severityLabel[severity]} ${comment}`;

  if (file) {
    formatted = `**${file}${line ? `:${line}` : ''}**\n${formatted}`;
  }

  return formatted;
}

/**
 * Tao summary cho review
 *
 * @param stats - Thong ke review
 * @returns Summary string
 */
export function createReviewSummary(stats: {
  critical: number;
  major: number;
  minor: number;
  suggestions: number;
  praises: number;
}): string {
  const { critical, major, minor, suggestions, praises } = stats;

  const issues = critical + major + minor;
  const total = issues + suggestions + praises;

  let verdict: string;
  if (critical > 0) {
    verdict = '❌ Changes requested - Critical issues must be fixed';
  } else if (major > 0) {
    verdict = '⚠️ Changes requested - Major issues should be addressed';
  } else if (minor > 0 || suggestions > 0) {
    verdict = '✅ Approved with suggestions';
  } else {
    verdict = '✅ Approved - LGTM!';
  }

  return `
## Review Summary

${verdict}

| Category | Count |
|----------|-------|
| Critical | ${critical} |
| Major | ${major} |
| Minor | ${minor} |
| Suggestions | ${suggestions} |
| Praises | ${praises} |
| **Total** | **${total}** |
`;
}

// ============================================================================
// Exports
// ============================================================================

export {
  SKILL_NAME,
  SKILL_ALIAS,
  REVIEW_COMMENT_TYPES,
  SEVERITY_LEVELS,
};

export default {
  definition: reviewPRSkillDefinition,
  handler: reviewPRSkillHandler,
  getPrompt: getReviewPRPrompt,
  parsePRIdentifier,
  formatReviewComment,
  createReviewSummary,
};
