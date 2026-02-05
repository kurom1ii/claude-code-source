/**
 * Claude Code - Commit Skill
 *
 * Skill /commit giup nguoi dung tao git commits.
 * Tu dong phan tich thay doi va tao commit message phu hop.
 *
 * Usage: /commit [message]
 * - Neu co message: Dung message do
 * - Neu khong co: Tu dong generate commit message
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
const SKILL_NAME = 'commit';

/**
 * Tac gia cho co-authored-by
 */
const CO_AUTHOR = 'Co-Authored-By: Claude <noreply@anthropic.com>';

/**
 * Cac loai commit pho bien
 */
const COMMIT_TYPES = [
  'feat',     // Tinh nang moi
  'fix',      // Sua loi
  'docs',     // Thay doi documentation
  'style',    // Format, khong anh huong logic
  'refactor', // Refactor code
  'test',     // Them hoac sua tests
  'chore',    // Cong viec bao tri
  'perf',     // Cai thien performance
  'ci',       // Thay doi CI/CD
  'build',    // Thay doi build system
] as const;

// ============================================================================
// Skill Definition - Dinh nghia skill
// ============================================================================

/**
 * Dinh nghia cho commit skill
 */
export const commitSkillDefinition: SkillDefinition = {
  type: 'prompt',
  name: SKILL_NAME,
  description: 'Generate a git commit for staged changes',
  argumentHint: '[optional commit message]',
  isEnabled: () => true,
  isHidden: false,
  source: 'built-in',

  async call(
    done: SkillDoneCallback,
    _resume: SkillResumeFunction | undefined,
    args?: string
  ): Promise<unknown> {
    // Track usage (thuc te se duoc SkillExecutor xu ly)
    // trackUsage('commit');

    // Neu co message tu user, su dung truc tiep
    if (args && args.trim()) {
      done(undefined, { display: 'skip' });
      return null;
    }

    // Neu khong co args, hien thi loading va de LLM generate
    done(undefined, { display: 'skip' });
    return null;
  },

  userFacingName(): string {
    return SKILL_NAME;
  },
};

// ============================================================================
// Prompt Generation - Tao prompt cho LLM
// ============================================================================

/**
 * Tao prompt de generate commit message
 *
 * @param args - Arguments tu user (commit message hint)
 * @returns Mang prompt messages
 */
export async function getCommitPrompt(args?: string): Promise<PromptMessage[]> {
  const userMessage = args?.trim() || '';

  const promptText = `
You are helping create a git commit. Follow these steps:

1. First, run \`git status\` to see all untracked files (IMPORTANT: Never use the -uall flag)
2. Run \`git diff --staged\` to see staged changes
3. Run \`git diff\` to see unstaged changes
4. Run \`git log --oneline -5\` to see recent commit message style

Based on the changes, create a commit:

**If changes are already staged:**
- Analyze the staged changes
- Create a commit message following conventional commits format
- The message should be concise (1-2 sentences) focusing on "why" not "what"

**If no changes are staged:**
- Show the user what files can be staged
- Ask which files they want to commit

**Commit message format:**
\`\`\`
<type>: <short description>

<optional longer description>

${CO_AUTHOR}
\`\`\`

**Types:** ${COMMIT_TYPES.join(', ')}

${userMessage ? `**User hint:** ${userMessage}` : ''}

**Important:**
- NEVER commit files that may contain secrets (.env, credentials, etc.)
- NEVER use git add -A or git add . (stage specific files)
- ALWAYS use HEREDOC for commit message to preserve formatting
- After committing, run git status to verify success
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
 * Handler xu ly commit skill
 */
export const commitSkillHandler: SkillHandler = {
  definition: commitSkillDefinition,

  /**
   * Validate arguments
   */
  validateArgs(args: string | undefined): boolean | string {
    // Commit message co the rong (se generate tu dong)
    // hoac la string bat ky
    if (args !== undefined && typeof args !== 'string') {
      return 'Commit message must be a string';
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
      const prompts = await getCommitPrompt(args);

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
 * Parse commit type tu message
 *
 * @param message - Commit message
 * @returns Commit type hoac undefined
 */
export function parseCommitType(
  message: string
): typeof COMMIT_TYPES[number] | undefined {
  const match = message.match(/^(\w+):/);
  if (!match) return undefined;

  const type = match[1]!.toLowerCase();
  return COMMIT_TYPES.find(t => t === type);
}

/**
 * Validate commit message format
 *
 * @param message - Message can validate
 * @returns true neu hop le, string loi neu khong
 */
export function validateCommitMessage(message: string): boolean | string {
  if (!message || message.trim().length === 0) {
    return 'Commit message cannot be empty';
  }

  if (message.length > 500) {
    return 'Commit message is too long (max 500 characters for first line)';
  }

  // Kiem tra co type prefix khong (optional warning)
  const hasType = COMMIT_TYPES.some(type =>
    message.toLowerCase().startsWith(`${type}:`)
  );

  if (!hasType) {
    // Khong bat buoc nhung nen co
    console.warn('Consider using conventional commit format: type: message');
  }

  return true;
}

/**
 * Format commit message voi co-author
 *
 * @param message - Commit message goc
 * @param includeCoAuthor - Co them co-author khong
 * @returns Formatted message
 */
export function formatCommitMessage(
  message: string,
  includeCoAuthor: boolean = true
): string {
  const trimmed = message.trim();

  if (!includeCoAuthor) {
    return trimmed;
  }

  // Kiem tra da co co-author chua
  if (trimmed.includes('Co-Authored-By:')) {
    return trimmed;
  }

  return `${trimmed}\n\n${CO_AUTHOR}`;
}

/**
 * Tao HEREDOC command cho git commit
 *
 * @param message - Commit message
 * @returns Git command string
 */
export function createGitCommitCommand(message: string): string {
  // Su dung HEREDOC de dam bao message duoc format dung
  return `git commit -m "$(cat <<'EOF'
${message}
EOF
)"`;
}

// ============================================================================
// Exports
// ============================================================================

export { COMMIT_TYPES, CO_AUTHOR };

export default {
  definition: commitSkillDefinition,
  handler: commitSkillHandler,
  getPrompt: getCommitPrompt,
  parseCommitType,
  validateCommitMessage,
  formatCommitMessage,
  createGitCommitCommand,
};
