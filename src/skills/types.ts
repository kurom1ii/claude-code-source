/**
 * Claude Code - Skills Type Definitions
 *
 * Module nay dinh nghia cac kieu du lieu co ban cho skill system.
 * Skills la cac "slash commands" nhu /commit, /review-pr, /help.
 *
 * Skill cho phep nguoi dung thuc thi cac tac vu pho bien
 * thong qua cac lenh don gian bat dau bang dau "/"
 */

// ============================================================================
// Skill Source Types - Nguon goc cua skill
// ============================================================================

/**
 * Nguon goc cua skill
 * - 'built-in': Skill duoc tich hop san trong Claude Code
 * - 'user': Skill do nguoi dung tao trong ~/.claude/skills/
 * - 'project': Skill nam trong thu muc project (.claude/skills/)
 * - 'plugin': Skill tu cac plugin ben ngoai
 */
export type SkillSource = 'built-in' | 'user' | 'project' | 'plugin';

/**
 * Loai skill dua tren cach render
 * - 'local-jsx': Skill render JSX component (React-based UI)
 * - 'prompt': Skill tra ve prompt text cho LLM
 * - 'action': Skill thuc thi mot hanh dong cu the
 */
export type SkillType = 'local-jsx' | 'prompt' | 'action';

// ============================================================================
// Skill Definition - Dinh nghia skill
// ============================================================================

/**
 * Metadata cua skill (tu frontmatter trong file .md)
 */
export interface SkillFrontmatter {
  /** Mo ta ngan gon ve skill */
  description?: string;
  /** Goi y ve argument (hien thi trong help) */
  'argument-hint'?: string;
  /** Model cu the de su dung (vd: claude-3-opus) */
  model?: string;
  /** Danh sach tools duoc phep su dung */
  'allowed-tools'?: string;
  /** Tags de phan loai skill */
  tags?: string[];
}

/**
 * Thong tin file nguon cua skill
 */
export interface SkillFileInfo {
  /** Duong dan day du toi file skill */
  filePath: string;
  /** Thu muc goc chua skill */
  baseDir: string;
  /** Frontmatter da parse */
  frontmatter: SkillFrontmatter;
  /** Noi dung markdown */
  content: string;
}

/**
 * Ket qua tra ve khi goi skill
 */
export interface SkillCallResult {
  /** Skill chay thanh cong hay khong */
  success: boolean;
  /** Ket qua tra ve (text, JSX, hoac data) */
  result?: unknown;
  /** Thong bao loi neu that bai */
  error?: string;
  /** Thoi gian thuc thi (ms) */
  executionTime?: number;
}

/**
 * Ham callback khi skill hoan thanh
 */
export type SkillDoneCallback = (
  result: string | undefined,
  options?: {
    /** Cach hien thi ket qua */
    display?: 'user' | 'system' | 'skip';
  }
) => void;

/**
 * Context khi thuc thi skill
 */
export interface SkillExecutionContext {
  /** Thu muc lam viec hien tai */
  workingDirectory: string;
  /** Session ID hien tai */
  sessionId?: string;
  /** Co dang o che do plan khong */
  isPlanMode?: boolean;
  /** Cac bien moi truong */
  environment?: Record<string, string>;
}

/**
 * Dinh nghia day du cua mot skill
 */
export interface SkillDefinition {
  /** Loai skill (local-jsx, prompt, action) */
  type: SkillType;
  /** Ten noi bo cua skill (vd: 'commit', 'review-pr') */
  name: string;
  /** Mo ta chuc nang cua skill */
  description: string;
  /** Goi y ve cach su dung argument */
  argumentHint?: string;
  /** Kiem tra skill co duoc bat hay khong */
  isEnabled: () => boolean;
  /** Skill co bi an khoi danh sach khong */
  isHidden: boolean;
  /** Nguon goc cua skill */
  source?: SkillSource;
  /** Plugin name neu skill tu plugin */
  pluginName?: string;
  /** Duong dan toi plugin */
  pluginPath?: string;

  /**
   * Ham goi skill voi arguments
   * @param done - Callback khi hoan thanh
   * @param resume - Ham de resume conversation (neu can)
   * @param args - Arguments tu nguoi dung
   * @returns Ket qua (co the la JSX, string, hoac null)
   */
  call: (
    done: SkillDoneCallback,
    resume: SkillResumeFunction | undefined,
    args?: string
  ) => Promise<unknown> | unknown;

  /**
   * Lay ten hien thi cho nguoi dung
   * @returns Ten skill hien thi (vd: 'commit', 'review-pr')
   */
  userFacingName: () => string;
}

/**
 * Ham de resume conversation tu skill
 */
export type SkillResumeFunction = (
  sessionId: string,
  conversation: unknown,
  source: 'slash_command_picker' | 'slash_command_session_id' | 'slash_command_title'
) => Promise<void>;

// ============================================================================
// Skill Handler Interface - Interface cho handler xu ly skill
// ============================================================================

/**
 * Handler xu ly skill cu the
 * Moi skill can implement interface nay
 */
export interface SkillHandler {
  /** Dinh nghia cua skill */
  definition: SkillDefinition;

  /**
   * Validate arguments truoc khi chay
   * @param args - Arguments tu nguoi dung
   * @returns true neu hop le, string neu co loi
   */
  validateArgs?: (args: string | undefined) => boolean | string;

  /**
   * Thuc thi skill
   * @param args - Arguments tu nguoi dung
   * @param context - Execution context
   * @returns Ket qua thuc thi
   */
  execute: (
    args: string | undefined,
    context: SkillExecutionContext
  ) => Promise<SkillCallResult>;
}

// ============================================================================
// Skill Registry Interface - Interface cho registry quan ly skills
// ============================================================================

/**
 * Interface cho Skill Registry
 */
export interface ISkillRegistry {
  /** Dang ky mot skill moi */
  register(skill: SkillDefinition): void;

  /** Huy dang ky skill theo ten */
  unregister(name: string): boolean;

  /** Lay skill theo ten */
  get(name: string): SkillDefinition | undefined;

  /** Lay tat ca skills da dang ky */
  getAll(): SkillDefinition[];

  /** Lay skills theo nguon goc */
  getBySource(source: SkillSource): SkillDefinition[];

  /** Lay cac skills duoc bat va khong bi an */
  getVisible(): SkillDefinition[];

  /** Kiem tra skill co ton tai khong */
  has(name: string): boolean;

  /** Xoa tat ca skills */
  clear(): void;
}

// ============================================================================
// Skill Parser Types - Kieu du lieu cho parser
// ============================================================================

/**
 * Ket qua parse skill invocation tu user input
 */
export interface ParsedSkillInvocation {
  /** Ten skill (khong co dau "/") */
  skillName: string;
  /** Arguments truyen vao skill */
  args: string | undefined;
  /** Vi tri bat dau trong input string */
  startIndex: number;
  /** Vi tri ket thuc trong input string */
  endIndex: number;
  /** Chuoi goc da match */
  rawMatch: string;
}

/**
 * Ket qua tim kiem skill tuong tu (fuzzy match)
 */
export interface SkillSuggestion {
  /** Skill duoc goi y */
  skill: SkillDefinition;
  /** Diem tuong dong (0-1) */
  score: number;
}

// ============================================================================
// Skill Usage Tracking - Theo doi viec su dung skill
// ============================================================================

/**
 * Thong tin su dung skill
 */
export interface SkillUsageInfo {
  /** So lan da su dung */
  usageCount: number;
  /** Thoi diem su dung cuoi cung */
  lastUsedAt: number;
}

/**
 * Map theo doi su dung skill
 */
export type SkillUsageMap = Record<string, SkillUsageInfo>;

// ============================================================================
// Skill Hooks - Hook system cho skills
// ============================================================================

/**
 * Cac loai hook event
 */
export type SkillHookEvent =
  | 'before_execute'  // Truoc khi skill chay
  | 'after_execute'   // Sau khi skill chay xong
  | 'on_error';       // Khi skill gap loi

/**
 * Hook function
 */
export type SkillHookFunction = (
  skill: SkillDefinition,
  args: string | undefined,
  result?: SkillCallResult
) => void | Promise<void>;

/**
 * Thong tin hook da dang ky
 */
export interface SkillHook {
  /** Pattern de match skill name */
  matcher: string | RegExp;
  /** Thu muc goc cua skill (de phan biet plugin) */
  skillRoot?: string;
  /** Cac hook functions */
  hooks: Array<{
    hook: SkillHookFunction;
    onHookSuccess?: () => void;
  }>;
}

// ============================================================================
// Prompt-based Skill Types - Kieu cho prompt skills
// ============================================================================

/**
 * Noi dung prompt message
 */
export interface PromptMessage {
  /** Loai noi dung */
  type: 'text' | 'image';
  /** Noi dung text */
  text?: string;
  /** URL hinh anh */
  imageUrl?: string;
}

/**
 * Skill dua tren prompt (tao prompt cho LLM)
 */
export interface PromptSkillDefinition extends SkillDefinition {
  type: 'prompt';
  /** Message de hien thi trong khi loading */
  progressMessage: string;
  /** Ham tao prompt messages */
  getPrompt: (args: string | undefined) => Promise<PromptMessage[]>;
}

// ============================================================================
// Skill Listing Types - Kieu cho viec liet ke skills
// ============================================================================

/**
 * Skill attachment trong message
 */
export interface SkillListingAttachment {
  type: 'skill_listing';
  /** Noi dung formatted cua danh sach skills */
  content: string;
  /** So luong skills */
  skillCount: number;
  /** Co phai lan gui dau tien khong */
  isInitial: boolean;
}

/**
 * Options khi format skill list
 */
export interface SkillListFormatOptions {
  /** Hien thi description khong */
  showDescription?: boolean;
  /** Hien thi argument hint khong */
  showArgumentHint?: boolean;
  /** Nhom theo source khong */
  groupBySource?: boolean;
}

// ============================================================================
// Re-exports for convenience
// ============================================================================

export type {
  SkillSource as Source,
  SkillType as Type,
  SkillDefinition as Definition,
  SkillHandler as Handler,
  SkillCallResult as CallResult,
  SkillExecutionContext as ExecutionContext,
  ParsedSkillInvocation as ParsedInvocation,
};
