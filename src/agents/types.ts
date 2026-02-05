/**
 * Agent Types - Định nghĩa kiểu dữ liệu cho hệ thống agents
 *
 * Module này chứa tất cả các type definitions cần thiết cho:
 * - Agent configuration và identity
 * - Team/Swarm coordination
 * - Inter-agent messaging
 * - Agent lifecycle management
 */

// ============================================================================
// Agent Identity Types - Kiểu nhận dạng agent
// ============================================================================

/**
 * Màu sắc có thể gán cho agent
 * Dùng để phân biệt agents trong terminal/UI
 */
export type AgentColor =
  | 'red'
  | 'blue'
  | 'green'
  | 'yellow'
  | 'purple'
  | 'orange'
  | 'pink'
  | 'cyan';

/**
 * Bảng ánh xạ màu agent sang màu tmux
 */
export const AGENT_COLOR_TO_TMUX: Record<AgentColor, string> = {
  red: 'red',
  blue: 'blue',
  green: 'green',
  yellow: 'yellow',
  purple: 'magenta',
  orange: 'colour208',
  pink: 'colour205',
  cyan: 'cyan',
};

/**
 * Bảng ánh xạ màu agent sang màu UI
 */
export const AGENT_COLOR_TO_UI: Record<AgentColor, string> = {
  red: 'red',
  blue: 'blue',
  green: 'green',
  yellow: 'yellow',
  purple: 'magenta',
  orange: 'warning',
  pink: 'magenta',
  cyan: 'cyan_FOR_SUBAGENTS_ONLY',
};

/**
 * Mảng các màu agent có sẵn
 */
export const AVAILABLE_AGENT_COLORS: AgentColor[] = [
  'red',
  'blue',
  'green',
  'yellow',
  'purple',
  'orange',
  'pink',
  'cyan',
];

/**
 * Nguồn gốc của agent definition
 */
export type AgentSource =
  | 'built-in' // Agent tích hợp sẵn
  | 'plugin' // Agent từ plugin
  | 'userSettings' // Agent từ user settings (~/.claude/)
  | 'projectSettings' // Agent từ project settings (.claude/)
  | 'policySettings' // Agent từ policy settings
  | 'flagSettings' // Agent từ CLI flags
  | 'localSettings'; // Agent từ local settings

/**
 * Loại agent (subagent type)
 */
export type AgentType =
  | 'Plan' // Agent lập kế hoạch
  | 'Explore' // Agent khám phá codebase
  | 'general-purpose' // Agent đa năng
  | string; // Hoặc custom agent type

/**
 * Backend type để chạy agent (tmux hoặc iTerm2)
 */
export type AgentBackendType = 'tmux' | 'iterm2';

/**
 * Thông tin identity của agent
 */
export interface AgentIdentity {
  /** ID duy nhất của agent */
  agentId: string;
  /** Tên hiển thị của agent */
  agentName: string;
  /** Loại agent */
  agentType?: AgentType;
  /** Màu đại diện */
  color?: AgentColor;
  /** Tên team mà agent thuộc về */
  teamName?: string;
}

/**
 * Thông tin context của agent trong team
 */
export interface AgentTeamContext extends AgentIdentity {
  /** ID của parent session (nếu là subagent) */
  parentSessionId?: string;
}

// ============================================================================
// Agent Configuration Types - Kiểu cấu hình agent
// ============================================================================

/**
 * Cấu hình định nghĩa một agent
 */
export interface AgentDefinition {
  /** Loại/tên agent (identifier) */
  agentType: AgentType;
  /** Mô tả agent */
  description?: string;
  /** Nguồn gốc của definition */
  source: AgentSource;
  /** System prompt cho agent */
  systemPrompt?: string;
  /** Model được sử dụng */
  model?: string;
  /** Danh sách tools được phép sử dụng */
  allowedTools?: string[];
  /** Danh sách tools bị cấm */
  disallowedTools?: string[];
  /** Thư mục chứa definition (nếu từ file) */
  baseDir?: string;
  /** Tên file (nếu từ file) */
  filename?: string;
}

/**
 * Cấu hình để spawn một agent mới
 */
export interface AgentSpawnConfig {
  /** Tên cho agent */
  name: string;
  /** Loại agent */
  agentType?: AgentType;
  /** Model sử dụng */
  model?: string;
  /** Prompt khởi tạo */
  initialPrompt?: string;
  /** System prompt */
  systemPrompt?: string;
  /** Thư mục làm việc */
  cwd?: string;
  /** Tên team */
  teamName?: string;
  /** Màu sắc */
  color?: AgentColor;
  /** Backend type */
  backendType?: AgentBackendType;
  /** Yêu cầu plan mode */
  planModeRequired?: boolean;
  /** Timeout (ms) */
  timeout?: number;
}

// ============================================================================
// Agent Status Types - Kiểu trạng thái agent
// ============================================================================

/**
 * Trạng thái hoạt động của agent
 */
export type AgentStatus =
  | 'pending' // Đang chờ khởi động
  | 'running' // Đang chạy
  | 'idle' // Đang rảnh (chờ input)
  | 'completed' // Hoàn thành
  | 'failed' // Thất bại
  | 'cancelled' // Đã hủy
  | 'hidden'; // Đã ẩn (tmux)

/**
 * Kiểm tra trạng thái agent đã kết thúc hay chưa
 */
export function isTerminalStatus(status: AgentStatus): boolean {
  return status === 'completed' || status === 'failed' || status === 'cancelled';
}

/**
 * Thông tin runtime của agent
 */
export interface AgentRuntimeInfo {
  /** ID agent */
  agentId: string;
  /** Tên agent */
  name: string;
  /** Trạng thái hiện tại */
  status: AgentStatus;
  /** Loại agent */
  agentType?: AgentType;
  /** Model đang dùng */
  model?: string;
  /** Màu sắc */
  color?: AgentColor;
  /** ID pane tmux (nếu có) */
  tmuxPaneId?: string;
  /** Thư mục làm việc */
  cwd?: string;
  /** Đường dẫn worktree git */
  worktreePath?: string;
  /** Đang ẩn hay không */
  isHidden?: boolean;
  /** Backend type */
  backendType?: AgentBackendType;
  /** Chế độ hoạt động */
  mode?: string;
  /** Prompt hiện tại */
  prompt?: string;
}

/**
 * Thông tin agent để hiển thị UI
 */
export interface AgentDisplayInfo {
  /** Tên agent */
  name: string;
  /** Màu sắc */
  color?: string;
  /** Đang idle hay không */
  isIdle: boolean;
}

// ============================================================================
// Team/Swarm Types - Kiểu cho team và swarm
// ============================================================================

/**
 * Thông tin thành viên trong team
 */
export interface TeamMember {
  /** Tên thành viên */
  name: string;
  /** ID agent */
  agentId: string;
  /** Loại agent */
  agentType?: AgentType;
  /** Model */
  model?: string;
  /** Prompt */
  prompt?: string;
  /** Màu sắc */
  color?: AgentColor;
  /** ID pane tmux */
  tmuxPaneId?: string;
  /** Thư mục làm việc */
  cwd?: string;
  /** Đường dẫn worktree */
  worktreePath?: string;
  /** Đang active */
  isActive?: boolean;
  /** Backend type */
  backendType?: AgentBackendType;
  /** Chế độ */
  mode?: string;
}

/**
 * Cấu hình team
 */
export interface TeamConfig {
  /** Tên team */
  teamName: string;
  /** Mô tả team */
  description?: string;
  /** ID của team leader */
  leadAgentId?: string;
  /** Danh sách thành viên */
  members: TeamMember[];
  /** Thời điểm tạo */
  createdAt?: string;
  /** Thời điểm cập nhật */
  updatedAt?: string;
}

/**
 * Context của team trong session
 */
export interface TeamContext {
  /** Tên team */
  teamName: string;
  /** Tên agent của mình */
  selfAgentName?: string;
  /** Màu của mình */
  selfAgentColor?: AgentColor;
  /** Map teammates */
  teammates?: Record<string, TeamMember>;
}

/**
 * Loại teammate (in-process hoặc local/external)
 */
export type TeammateType = 'in_process_teammate' | 'local_agent';

/**
 * Thông tin teammate trong swarm view
 */
export interface TeammateInfo {
  /** Loại teammate */
  type: TeammateType;
  /** Identity của teammate */
  identity: AgentIdentity;
  /** Đang idle hay không */
  isIdle: boolean;
  /** Hiển thị spinner tree */
  showSpinnerTree?: boolean;
  /** Trạng thái PR (nếu có) */
  prStatus?: string;
}

// ============================================================================
// Message Types - Kiểu tin nhắn giữa agents
// ============================================================================

/**
 * Loại tin nhắn có thể gửi giữa agents
 */
export type AgentMessageType =
  | 'message' // Tin nhắn thông thường
  | 'broadcast' // Gửi cho tất cả
  | 'shutdown_request' // Yêu cầu shutdown
  | 'shutdown_response' // Phản hồi shutdown
  | 'join_request' // Yêu cầu join team
  | 'join_approved' // Chấp nhận join
  | 'join_rejected' // Từ chối join
  | 'plan_approval_request' // Yêu cầu duyệt plan
  | 'plan_approval_response' // Phản hồi duyệt plan
  | 'idle' // Thông báo idle
  | 'mode_change'; // Thay đổi mode

/**
 * Tin nhắn cơ bản giữa agents
 */
export interface AgentMessage {
  /** Người gửi */
  from: string;
  /** Nội dung text */
  text: string;
  /** Timestamp */
  timestamp: string;
  /** Loại tin nhắn */
  type?: AgentMessageType;
}

/**
 * Yêu cầu shutdown
 */
export interface ShutdownRequest {
  type: 'shutdown_request';
  requestId: string;
  from: string;
  reason?: string;
}

/**
 * Phản hồi shutdown
 */
export interface ShutdownResponse {
  type: 'shutdown_response';
  requestId: string;
  from: string;
  approved: boolean;
  reason?: string;
}

/**
 * Yêu cầu join team
 */
export interface JoinRequest {
  type: 'join_request';
  requestId: string;
  proposedName: string;
  capabilities?: string;
}

/**
 * Chấp nhận join team
 */
export interface JoinApproved {
  type: 'join_approved';
  requestId: string;
  teamName: string;
  agentId: string;
  agentName: string;
  color?: AgentColor;
}

/**
 * Từ chối join team
 */
export interface JoinRejected {
  type: 'join_rejected';
  requestId: string;
  reason?: string;
}

/**
 * Yêu cầu duyệt plan
 */
export interface PlanApprovalRequest {
  type: 'plan_approval_request';
  requestId: string;
  from: string;
  planContent: string;
  planFilePath?: string;
}

/**
 * Phản hồi duyệt plan
 */
export interface PlanApprovalResponse {
  type: 'plan_approval_response';
  requestId: string;
  approved: boolean;
  feedback?: string;
}

/**
 * Tin nhắn từ teammate (có thể chứa metadata)
 */
export interface TeammateMessage {
  teammateId: string;
  color?: string;
  summary?: string;
  content: string;
}

// ============================================================================
// Pane/Terminal Types - Kiểu cho terminal panes
// ============================================================================

/**
 * Kết quả tạo pane mới
 */
export interface PaneCreationResult {
  /** ID của pane mới */
  paneId: string;
  /** Có phải teammate đầu tiên không */
  isFirstTeammate: boolean;
}

/**
 * Interface cho terminal backend (tmux/iTerm2)
 */
export interface TerminalBackend {
  /** Loại backend */
  type: AgentBackendType;
  /** Tên hiển thị */
  displayName: string;
  /** Hỗ trợ hide/show pane */
  supportsHideShow: boolean;

  /** Kiểm tra backend có sẵn không */
  isAvailable(): Promise<boolean>;
  /** Kiểm tra đang chạy trong backend này không */
  isRunningInside(): Promise<boolean>;
  /** Tạo pane mới cho teammate */
  createTeammatePaneInSwarmView(
    name: string,
    color: AgentColor
  ): Promise<PaneCreationResult>;
  /** Gửi command vào pane */
  sendCommandToPane(
    paneId: string,
    command: string,
    useLeaderSocket?: boolean
  ): Promise<void>;
  /** Đặt màu border cho pane */
  setPaneBorderColor(
    paneId: string,
    color: AgentColor,
    useLeaderSocket?: boolean
  ): Promise<void>;
  /** Đặt title cho pane */
  setPaneTitle(
    paneId: string,
    title: string,
    color: AgentColor,
    useLeaderSocket?: boolean
  ): Promise<void>;
  /** Bật border status cho pane */
  enablePaneBorderStatus(
    windowTarget?: string,
    useLeaderSocket?: boolean
  ): Promise<void>;
  /** Cân bằng lại các panes */
  rebalancePanes(windowTarget: string, withLeader: boolean): Promise<void>;
  /** Đóng pane */
  killPane(paneId: string, useLeaderSocket?: boolean): Promise<boolean>;
  /** Ẩn pane */
  hidePane(paneId: string, useLeaderSocket?: boolean): Promise<boolean>;
  /** Hiện pane */
  showPane(
    paneId: string,
    targetWindow: string,
    useLeaderSocket?: boolean
  ): Promise<boolean>;
}

// ============================================================================
// Event Types - Kiểu sự kiện
// ============================================================================

/**
 * Sự kiện trong lifecycle của agent
 */
export type AgentLifecycleEvent =
  | 'spawned' // Agent được tạo
  | 'started' // Agent bắt đầu chạy
  | 'idle' // Agent chuyển sang idle
  | 'resumed' // Agent tiếp tục từ idle
  | 'completed' // Agent hoàn thành
  | 'failed' // Agent thất bại
  | 'shutdown'; // Agent shutdown

/**
 * Callback cho lifecycle events
 */
export type AgentLifecycleCallback = (
  event: AgentLifecycleEvent,
  agentId: string,
  data?: unknown
) => void;

// ============================================================================
// Constants - Hằng số
// ============================================================================

/** Tên session tmux mặc định cho swarm */
export const SWARM_SESSION_NAME = 'claude-swarm';

/** Tên window mặc định cho swarm view */
export const SWARM_WINDOW_NAME = 'swarm-view';

/** Tên session ẩn panes */
export const HIDDEN_PANES_SESSION = 'claude-hidden';

/** Timeout mặc định cho agent (5 phút) */
export const DEFAULT_AGENT_TIMEOUT_MS = 300000;

/** Timeout tối đa cho agent (30 phút) */
export const MAX_AGENT_TIMEOUT_MS = 1800000;

/** Delay giữa các lần rebalance panes */
export const PANE_REBALANCE_DELAY_MS = 200;

/** Model mặc định theo loại agent */
export const DEFAULT_MODELS_BY_TYPE: Record<AgentType, string> = {
  Plan: 'claude-opus-4-5-20251101',
  Explore: 'claude-sonnet-4-5-20250929',
  'general-purpose': 'claude-sonnet-4-5-20250929',
};

/**
 * Lấy model mặc định cho loại agent
 */
export function getDefaultModelForAgentType(agentType: AgentType): string {
  return (
    DEFAULT_MODELS_BY_TYPE[agentType] ||
    DEFAULT_MODELS_BY_TYPE['general-purpose']
  );
}

// ============================================================================
// Export all
// ============================================================================

export default {
  AGENT_COLOR_TO_TMUX,
  AGENT_COLOR_TO_UI,
  AVAILABLE_AGENT_COLORS,
  SWARM_SESSION_NAME,
  SWARM_WINDOW_NAME,
  HIDDEN_PANES_SESSION,
  DEFAULT_AGENT_TIMEOUT_MS,
  MAX_AGENT_TIMEOUT_MS,
  PANE_REBALANCE_DELAY_MS,
  DEFAULT_MODELS_BY_TYPE,
  isTerminalStatus,
  getDefaultModelForAgentType,
};
