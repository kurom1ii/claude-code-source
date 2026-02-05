/**
 * Claude Code - Hook Events
 *
 * Định nghĩa các event types và helpers cho hook system
 * Mỗi event type có cấu trúc input riêng và use case riêng
 */

import type {
  HookEventType,
  HookInput,
  PreToolUseHookInput,
  PostToolUseHookInput,
  PostToolUseFailureHookInput,
  NotificationHookInput,
  UserPromptSubmitHookInput,
  SessionStartHookInput,
  SessionEndHookInput,
  SetupHookInput,
  StopHookInput,
  SubagentStartHookInput,
  SubagentStopHookInput,
  PreCompactHookInput,
  PermissionRequestHookInput,
  BaseHookInput,
  PermissionSuggestion,
} from './types';

// ============================================================================
// Event Descriptions - Mô tả chi tiết từng event
// ============================================================================

/**
 * Mô tả chi tiết cho từng hook event
 */
export const HookEventDescriptions: Record<HookEventType, string> = {
  PreToolUse:
    'Được trigger trước khi một tool được thực thi. ' +
    'Cho phép approve/deny/modify tool input.',

  PostToolUse:
    'Được trigger sau khi tool thực thi thành công. ' +
    'Cho phép process kết quả hoặc thêm context.',

  PostToolUseFailure:
    'Được trigger sau khi tool thực thi thất bại. ' +
    'Cho phép xử lý errors hoặc retry logic.',

  Notification:
    'Được trigger khi có thông báo (toast, alert, etc.). ' +
    'Cho phép custom notification handling.',

  UserPromptSubmit:
    'Được trigger khi user submit một prompt mới. ' +
    'Cho phép validate hoặc modify prompt trước khi xử lý.',

  SessionStart:
    'Được trigger khi session bắt đầu (startup, resume, clear, compact). ' +
    'Cho phép initialize state hoặc thêm context.',

  SessionEnd:
    'Được trigger khi session kết thúc. ' +
    'Cho phép cleanup hoặc persist state.',

  Setup:
    'Được trigger khi khởi tạo hoặc maintenance. ' +
    'Cho phép setup environment hoặc dependencies.',

  Stop:
    'Được trigger khi main agent dừng. ' +
    'Cho phép custom stop logic hoặc cleanup.',

  SubagentStart:
    'Được trigger khi một subagent (Task tool) bắt đầu. ' +
    'Cho phép track subagent state.',

  SubagentStop:
    'Được trigger khi một subagent dừng. ' +
    'Cho phép process subagent results.',

  PreCompact:
    'Được trigger trước khi compact context (giảm kích thước). ' +
    'Cho phép custom compact instructions.',

  PermissionRequest:
    'Được trigger khi cần permission cho một operation. ' +
    'Cho phép auto-approve/deny dựa trên custom logic.',
};

// ============================================================================
// Event Categories - Nhóm events theo mục đích
// ============================================================================

/**
 * Events liên quan đến tool execution
 */
export const ToolEvents: HookEventType[] = [
  'PreToolUse',
  'PostToolUse',
  'PostToolUseFailure',
];

/**
 * Events liên quan đến session lifecycle
 */
export const SessionEvents: HookEventType[] = [
  'SessionStart',
  'SessionEnd',
  'Setup',
];

/**
 * Events liên quan đến agent/subagent
 */
export const AgentEvents: HookEventType[] = [
  'Stop',
  'SubagentStart',
  'SubagentStop',
];

/**
 * Events liên quan đến user interaction
 */
export const UserEvents: HookEventType[] = [
  'UserPromptSubmit',
  'Notification',
  'PermissionRequest',
];

/**
 * Events liên quan đến system operations
 */
export const SystemEvents: HookEventType[] = [
  'PreCompact',
];

// ============================================================================
// Event Input Builders - Helper functions để tạo hook inputs
// ============================================================================

/**
 * Tạo base hook input với thông tin chung
 */
export function createBaseHookInput(
  sessionId: string,
  transcriptPath: string,
  cwd: string,
  permissionMode?: string
): BaseHookInput {
  return {
    session_id: sessionId,
    transcript_path: transcriptPath,
    cwd,
    permission_mode: permissionMode,
  };
}

/**
 * Tạo PreToolUse hook input
 */
export function createPreToolUseInput(
  base: BaseHookInput,
  toolName: string,
  toolInput: unknown,
  toolUseId: string
): PreToolUseHookInput {
  return {
    ...base,
    hook_event_name: 'PreToolUse',
    tool_name: toolName,
    tool_input: toolInput,
    tool_use_id: toolUseId,
  };
}

/**
 * Tạo PostToolUse hook input
 */
export function createPostToolUseInput(
  base: BaseHookInput,
  toolName: string,
  toolInput: unknown,
  toolResponse: unknown,
  toolUseId: string
): PostToolUseHookInput {
  return {
    ...base,
    hook_event_name: 'PostToolUse',
    tool_name: toolName,
    tool_input: toolInput,
    tool_response: toolResponse,
    tool_use_id: toolUseId,
  };
}

/**
 * Tạo PostToolUseFailure hook input
 */
export function createPostToolUseFailureInput(
  base: BaseHookInput,
  toolName: string,
  toolInput: unknown,
  toolUseId: string,
  error: string,
  isInterrupt?: boolean
): PostToolUseFailureHookInput {
  return {
    ...base,
    hook_event_name: 'PostToolUseFailure',
    tool_name: toolName,
    tool_input: toolInput,
    tool_use_id: toolUseId,
    error,
    is_interrupt: isInterrupt,
  };
}

/**
 * Tạo Notification hook input
 */
export function createNotificationInput(
  base: BaseHookInput,
  message: string,
  notificationType: string,
  title?: string
): NotificationHookInput {
  return {
    ...base,
    hook_event_name: 'Notification',
    message,
    title,
    notification_type: notificationType,
  };
}

/**
 * Tạo UserPromptSubmit hook input
 */
export function createUserPromptSubmitInput(
  base: BaseHookInput,
  prompt: string
): UserPromptSubmitHookInput {
  return {
    ...base,
    hook_event_name: 'UserPromptSubmit',
    prompt,
  };
}

/**
 * Tạo SessionStart hook input
 */
export function createSessionStartInput(
  base: BaseHookInput,
  source: 'startup' | 'resume' | 'clear' | 'compact',
  agentType?: string,
  model?: string
): SessionStartHookInput {
  return {
    ...base,
    hook_event_name: 'SessionStart',
    source,
    agent_type: agentType,
    model,
  };
}

/**
 * Tạo SessionEnd hook input
 */
export function createSessionEndInput(
  base: BaseHookInput,
  reason: 'clear' | 'logout' | 'prompt_input_exit' | 'other' | 'bypass_permissions_disabled'
): SessionEndHookInput {
  return {
    ...base,
    hook_event_name: 'SessionEnd',
    reason,
  };
}

/**
 * Tạo Setup hook input
 */
export function createSetupInput(
  base: BaseHookInput,
  trigger: 'init' | 'maintenance'
): SetupHookInput {
  return {
    ...base,
    hook_event_name: 'Setup',
    trigger,
  };
}

/**
 * Tạo Stop hook input
 */
export function createStopInput(
  base: BaseHookInput,
  stopHookActive: boolean
): StopHookInput {
  return {
    ...base,
    hook_event_name: 'Stop',
    stop_hook_active: stopHookActive,
  };
}

/**
 * Tạo SubagentStart hook input
 */
export function createSubagentStartInput(
  base: BaseHookInput,
  agentId: string,
  agentType: string
): SubagentStartHookInput {
  return {
    ...base,
    hook_event_name: 'SubagentStart',
    agent_id: agentId,
    agent_type: agentType,
  };
}

/**
 * Tạo SubagentStop hook input
 */
export function createSubagentStopInput(
  base: BaseHookInput,
  stopHookActive: boolean,
  agentId: string,
  agentTranscriptPath: string,
  agentType: string
): SubagentStopHookInput {
  return {
    ...base,
    hook_event_name: 'SubagentStop',
    stop_hook_active: stopHookActive,
    agent_id: agentId,
    agent_transcript_path: agentTranscriptPath,
    agent_type: agentType,
  };
}

/**
 * Tạo PreCompact hook input
 */
export function createPreCompactInput(
  base: BaseHookInput,
  trigger: 'manual' | 'auto',
  customInstructions: string | null
): PreCompactHookInput {
  return {
    ...base,
    hook_event_name: 'PreCompact',
    trigger,
    custom_instructions: customInstructions,
  };
}

/**
 * Tạo PermissionRequest hook input
 */
export function createPermissionRequestInput(
  base: BaseHookInput,
  toolName: string,
  toolInput: unknown,
  permissionSuggestions?: PermissionSuggestion[]
): PermissionRequestHookInput {
  return {
    ...base,
    hook_event_name: 'PermissionRequest',
    tool_name: toolName,
    tool_input: toolInput,
    permission_suggestions: permissionSuggestions,
  };
}

// ============================================================================
// Event Matchers - Xác định query match cho từng event
// ============================================================================

/**
 * Lấy match query từ hook input
 * Query này được dùng để filter hooks theo matcher pattern
 */
export function getMatchQueryFromInput(input: HookInput): string | undefined {
  switch (input.hook_event_name) {
    // Tool events - match theo tool name
    case 'PreToolUse':
    case 'PostToolUse':
    case 'PostToolUseFailure':
    case 'PermissionRequest':
      return input.tool_name;

    // Session events - match theo source/trigger
    case 'SessionStart':
      return input.source;
    case 'Setup':
      return input.trigger;
    case 'PreCompact':
      return input.trigger;

    // Notification - match theo type
    case 'Notification':
      return input.notification_type;

    // Session end - match theo reason
    case 'SessionEnd':
      return input.reason;

    // Agent events - match theo agent type
    case 'SubagentStart':
    case 'SubagentStop':
      return input.agent_type;

    // User prompt và Stop không có specific match query
    case 'UserPromptSubmit':
    case 'Stop':
    default:
      return undefined;
  }
}

// ============================================================================
// Event Validation - Kiểm tra tính hợp lệ của events
// ============================================================================

/**
 * Kiểm tra event có hỗ trợ blocking response không
 * Một số events có thể block operation (PreToolUse, PermissionRequest)
 */
export function supportsBlockingResponse(eventType: HookEventType): boolean {
  return ['PreToolUse', 'PermissionRequest', 'UserPromptSubmit'].includes(eventType);
}

/**
 * Kiểm tra event có hỗ trợ updatedInput không
 * Một số events cho phép modify input trước khi thực thi
 */
export function supportsUpdatedInput(eventType: HookEventType): boolean {
  return ['PreToolUse', 'PermissionRequest'].includes(eventType);
}

/**
 * Kiểm tra event có hỗ trợ additionalContext không
 * Hầu hết events đều hỗ trợ việc thêm context vào conversation
 */
export function supportsAdditionalContext(eventType: HookEventType): boolean {
  return [
    'PreToolUse',
    'PostToolUse',
    'PostToolUseFailure',
    'UserPromptSubmit',
    'SessionStart',
    'Setup',
    'SubagentStart',
    'Notification',
  ].includes(eventType);
}

/**
 * Kiểm tra event có cần messages không
 * Một số hooks cần access tới conversation messages
 */
export function requiresMessages(eventType: HookEventType): boolean {
  return ['Stop', 'SubagentStop'].includes(eventType);
}

/**
 * Kiểm tra event có chạy được ngoài REPL không
 * Một số events (như Stop hooks) chỉ chạy trong REPL context
 */
export function canRunOutsideREPL(eventType: HookEventType): boolean {
  // Stop hooks cần REPL context
  return !['Stop', 'SubagentStop'].includes(eventType);
}

// ============================================================================
// Event Logging - Helper functions cho logging
// ============================================================================

/**
 * Events không cần log chi tiết (quá nhiều hoặc sensitive)
 */
const QUIET_EVENTS: HookEventType[] = ['SessionStart', 'Setup'];

/**
 * Kiểm tra event có nên log chi tiết không
 */
export function shouldLogEvent(eventType: HookEventType): boolean {
  return !QUIET_EVENTS.includes(eventType);
}

/**
 * Format event name cho display
 */
export function formatEventName(eventType: HookEventType, matchQuery?: string): string {
  if (matchQuery) {
    return `${eventType}:${matchQuery}`;
  }
  return eventType;
}

/**
 * Lấy mô tả ngắn cho event
 */
export function getEventShortDescription(eventType: HookEventType): string {
  const descriptions: Record<HookEventType, string> = {
    PreToolUse: 'Before tool execution',
    PostToolUse: 'After successful tool execution',
    PostToolUseFailure: 'After failed tool execution',
    Notification: 'On notification',
    UserPromptSubmit: 'On user prompt',
    SessionStart: 'On session start',
    SessionEnd: 'On session end',
    Setup: 'On setup/init',
    Stop: 'On agent stop',
    SubagentStart: 'On subagent start',
    SubagentStop: 'On subagent stop',
    PreCompact: 'Before context compact',
    PermissionRequest: 'On permission request',
  };
  return descriptions[eventType];
}
