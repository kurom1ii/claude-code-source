/**
 * AgentManager - Quản lý vòng đời và trạng thái của agents
 *
 * Module này chịu trách nhiệm:
 * - Spawn và terminate agents
 * - Theo dõi trạng thái agents
 * - Quản lý resources (panes, processes)
 * - Xử lý agent lifecycle events
 */

import {
  AgentIdentity,
  AgentStatus,
  AgentRuntimeInfo,
  AgentSpawnConfig,
  AgentColor,
  AgentBackendType,
  AgentLifecycleEvent,
  AgentLifecycleCallback,
  AVAILABLE_AGENT_COLORS,
  DEFAULT_AGENT_TIMEOUT_MS,
  isTerminalStatus,
  getDefaultModelForAgentType,
} from './types';

// ============================================================================
// Agent Registry - Nơi lưu trữ thông tin agents
// ============================================================================

/**
 * Registry entry cho một agent
 */
interface AgentRegistryEntry {
  /** Thông tin identity */
  identity: AgentIdentity;
  /** Thông tin runtime */
  runtime: AgentRuntimeInfo;
  /** Thời điểm spawn */
  spawnedAt: Date;
  /** Thời điểm bắt đầu */
  startedAt?: Date;
  /** Thời điểm kết thúc */
  endedAt?: Date;
  /** Cấu hình spawn */
  config: AgentSpawnConfig;
  /** Kết quả (nếu có) */
  result?: string;
  /** Lỗi (nếu có) */
  error?: string;
}

/**
 * Bộ đếm màu để phân bổ màu cho agents mới
 */
let colorIndex = 0;

/**
 * Map lưu trữ màu đã gán cho từng agent
 */
const assignedColors = new Map<string, AgentColor>();

// ============================================================================
// AgentManager Class
// ============================================================================

/**
 * Lớp quản lý agents
 */
export class AgentManager {
  /** Map lưu trữ agents theo ID */
  private agents: Map<string, AgentRegistryEntry> = new Map();

  /** Map lưu trữ agents theo tên (trong cùng team) */
  private agentsByName: Map<string, string> = new Map();

  /** Danh sách callbacks cho lifecycle events */
  private lifecycleCallbacks: AgentLifecycleCallback[] = [];

  /** Tên team hiện tại (nếu có) */
  private currentTeamName?: string;

  /**
   * Constructor
   * @param teamName - Tên team (optional)
   */
  constructor(teamName?: string) {
    this.currentTeamName = teamName;
  }

  // ==========================================================================
  // Agent Lifecycle - Vòng đời agent
  // ==========================================================================

  /**
   * Tạo unique agent ID
   * @returns Agent ID mới
   */
  private generateAgentId(): string {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).substring(2, 8);
    return `agent-${timestamp}-${random}`;
  }

  /**
   * Lấy màu cho agent mới
   * Nếu agent đã có màu trước đó, trả về màu cũ
   * Nếu không, phân bổ màu mới theo round-robin
   * @param agentName - Tên agent
   * @returns Màu được gán
   */
  getColorForAgent(agentName: string): AgentColor {
    // Kiểm tra xem đã gán màu chưa
    const existingColor = assignedColors.get(agentName);
    if (existingColor) {
      return existingColor;
    }

    // Phân bổ màu mới
    const color = AVAILABLE_AGENT_COLORS[colorIndex % AVAILABLE_AGENT_COLORS.length];
    assignedColors.set(agentName, color);
    colorIndex++;

    return color;
  }

  /**
   * Reset bộ đếm màu và map màu đã gán
   * Gọi khi cleanup team
   */
  resetColorAssignments(): void {
    assignedColors.clear();
    colorIndex = 0;
  }

  /**
   * Spawn một agent mới
   * @param config - Cấu hình spawn
   * @returns Thông tin agent đã spawn
   */
  async spawnAgent(config: AgentSpawnConfig): Promise<AgentRuntimeInfo> {
    // Validate config
    if (!config.name || config.name.trim().length === 0) {
      throw new Error('Agent name is required');
    }

    // Kiểm tra trùng tên
    const nameKey = this.getNameKey(config.name);
    if (this.agentsByName.has(nameKey)) {
      throw new Error(`Agent with name '${config.name}' already exists`);
    }

    // Tạo ID mới
    const agentId = this.generateAgentId();

    // Lấy màu
    const color = config.color || this.getColorForAgent(config.name);

    // Lấy model
    const model = config.model || getDefaultModelForAgentType(config.agentType || 'general-purpose');

    // Tạo identity
    const identity: AgentIdentity = {
      agentId,
      agentName: config.name,
      agentType: config.agentType,
      color,
      teamName: config.teamName || this.currentTeamName,
    };

    // Tạo runtime info
    const runtime: AgentRuntimeInfo = {
      agentId,
      name: config.name,
      status: 'pending',
      agentType: config.agentType,
      model,
      color,
      cwd: config.cwd,
      backendType: config.backendType,
    };

    // Tạo registry entry
    const entry: AgentRegistryEntry = {
      identity,
      runtime,
      spawnedAt: new Date(),
      config,
    };

    // Lưu vào registry
    this.agents.set(agentId, entry);
    this.agentsByName.set(nameKey, agentId);

    // Emit lifecycle event
    this.emitLifecycleEvent('spawned', agentId, { config });

    return runtime;
  }

  /**
   * Bắt đầu chạy agent
   * @param agentId - ID agent
   */
  async startAgent(agentId: string): Promise<void> {
    const entry = this.agents.get(agentId);
    if (!entry) {
      throw new Error(`Agent not found: ${agentId}`);
    }

    if (entry.runtime.status !== 'pending') {
      throw new Error(`Cannot start agent in status: ${entry.runtime.status}`);
    }

    entry.runtime.status = 'running';
    entry.startedAt = new Date();

    this.emitLifecycleEvent('started', agentId);
  }

  /**
   * Chuyển agent sang trạng thái idle
   * @param agentId - ID agent
   */
  setAgentIdle(agentId: string): void {
    const entry = this.agents.get(agentId);
    if (!entry) return;

    if (entry.runtime.status === 'running') {
      entry.runtime.status = 'idle';
      this.emitLifecycleEvent('idle', agentId);
    }
  }

  /**
   * Resume agent từ trạng thái idle
   * @param agentId - ID agent
   */
  resumeAgent(agentId: string): void {
    const entry = this.agents.get(agentId);
    if (!entry) return;

    if (entry.runtime.status === 'idle') {
      entry.runtime.status = 'running';
      this.emitLifecycleEvent('resumed', agentId);
    }
  }

  /**
   * Đánh dấu agent hoàn thành
   * @param agentId - ID agent
   * @param result - Kết quả (optional)
   */
  completeAgent(agentId: string, result?: string): void {
    const entry = this.agents.get(agentId);
    if (!entry) return;

    if (!isTerminalStatus(entry.runtime.status)) {
      entry.runtime.status = 'completed';
      entry.endedAt = new Date();
      entry.result = result;
      this.emitLifecycleEvent('completed', agentId, { result });
    }
  }

  /**
   * Đánh dấu agent thất bại
   * @param agentId - ID agent
   * @param error - Thông tin lỗi
   */
  failAgent(agentId: string, error: string): void {
    const entry = this.agents.get(agentId);
    if (!entry) return;

    if (!isTerminalStatus(entry.runtime.status)) {
      entry.runtime.status = 'failed';
      entry.endedAt = new Date();
      entry.error = error;
      this.emitLifecycleEvent('failed', agentId, { error });
    }
  }

  /**
   * Shutdown agent
   * @param agentId - ID agent
   * @param reason - Lý do (optional)
   */
  async shutdownAgent(agentId: string, reason?: string): Promise<void> {
    const entry = this.agents.get(agentId);
    if (!entry) return;

    if (!isTerminalStatus(entry.runtime.status)) {
      entry.runtime.status = 'cancelled';
      entry.endedAt = new Date();
      this.emitLifecycleEvent('shutdown', agentId, { reason });
    }
  }

  // ==========================================================================
  // Agent Query - Truy vấn thông tin agent
  // ==========================================================================

  /**
   * Lấy thông tin agent theo ID
   * @param agentId - ID agent
   * @returns Thông tin runtime hoặc undefined
   */
  getAgent(agentId: string): AgentRuntimeInfo | undefined {
    return this.agents.get(agentId)?.runtime;
  }

  /**
   * Lấy thông tin agent theo tên
   * @param name - Tên agent
   * @returns Thông tin runtime hoặc undefined
   */
  getAgentByName(name: string): AgentRuntimeInfo | undefined {
    const nameKey = this.getNameKey(name);
    const agentId = this.agentsByName.get(nameKey);
    if (!agentId) return undefined;
    return this.agents.get(agentId)?.runtime;
  }

  /**
   * Lấy identity của agent
   * @param agentId - ID agent
   * @returns Identity hoặc undefined
   */
  getAgentIdentity(agentId: string): AgentIdentity | undefined {
    return this.agents.get(agentId)?.identity;
  }

  /**
   * Lấy danh sách tất cả agents
   * @returns Mảng runtime info
   */
  getAllAgents(): AgentRuntimeInfo[] {
    return Array.from(this.agents.values()).map(entry => entry.runtime);
  }

  /**
   * Lấy danh sách agents đang chạy (running hoặc idle)
   * @returns Mảng runtime info
   */
  getActiveAgents(): AgentRuntimeInfo[] {
    return this.getAllAgents().filter(
      agent => agent.status === 'running' || agent.status === 'idle'
    );
  }

  /**
   * Lấy danh sách agents đang idle
   * @returns Mảng runtime info
   */
  getIdleAgents(): AgentRuntimeInfo[] {
    return this.getAllAgents().filter(agent => agent.status === 'idle');
  }

  /**
   * Kiểm tra agent có tồn tại không
   * @param agentId - ID agent
   * @returns true nếu tồn tại
   */
  hasAgent(agentId: string): boolean {
    return this.agents.has(agentId);
  }

  /**
   * Kiểm tra agent name có tồn tại không
   * @param name - Tên agent
   * @returns true nếu tồn tại
   */
  hasAgentByName(name: string): boolean {
    return this.agentsByName.has(this.getNameKey(name));
  }

  /**
   * Đếm số agents
   * @returns Số lượng agents
   */
  getAgentCount(): number {
    return this.agents.size;
  }

  /**
   * Đếm số agents đang active
   * @returns Số lượng agents active
   */
  getActiveAgentCount(): number {
    return this.getActiveAgents().length;
  }

  // ==========================================================================
  // Agent Update - Cập nhật thông tin agent
  // ==========================================================================

  /**
   * Cập nhật pane ID cho agent
   * @param agentId - ID agent
   * @param paneId - ID pane tmux
   */
  updateAgentPaneId(agentId: string, paneId: string): void {
    const entry = this.agents.get(agentId);
    if (entry) {
      entry.runtime.tmuxPaneId = paneId;
    }
  }

  /**
   * Cập nhật backend type cho agent
   * @param agentId - ID agent
   * @param backendType - Loại backend
   */
  updateAgentBackendType(agentId: string, backendType: AgentBackendType): void {
    const entry = this.agents.get(agentId);
    if (entry) {
      entry.runtime.backendType = backendType;
    }
  }

  /**
   * Cập nhật trạng thái ẩn/hiện của agent
   * @param agentId - ID agent
   * @param isHidden - Đang ẩn hay không
   */
  updateAgentHiddenState(agentId: string, isHidden: boolean): void {
    const entry = this.agents.get(agentId);
    if (entry) {
      entry.runtime.isHidden = isHidden;
    }
  }

  /**
   * Cập nhật working directory cho agent
   * @param agentId - ID agent
   * @param cwd - Đường dẫn thư mục
   */
  updateAgentCwd(agentId: string, cwd: string): void {
    const entry = this.agents.get(agentId);
    if (entry) {
      entry.runtime.cwd = cwd;
    }
  }

  /**
   * Cập nhật worktree path cho agent
   * @param agentId - ID agent
   * @param worktreePath - Đường dẫn worktree
   */
  updateAgentWorktreePath(agentId: string, worktreePath: string): void {
    const entry = this.agents.get(agentId);
    if (entry) {
      entry.runtime.worktreePath = worktreePath;
    }
  }

  // ==========================================================================
  // Lifecycle Callbacks - Quản lý callbacks
  // ==========================================================================

  /**
   * Đăng ký callback cho lifecycle events
   * @param callback - Hàm callback
   * @returns Hàm để hủy đăng ký
   */
  onLifecycleEvent(callback: AgentLifecycleCallback): () => void {
    this.lifecycleCallbacks.push(callback);
    return () => {
      const index = this.lifecycleCallbacks.indexOf(callback);
      if (index > -1) {
        this.lifecycleCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Emit lifecycle event
   * @param event - Loại event
   * @param agentId - ID agent
   * @param data - Dữ liệu bổ sung
   */
  private emitLifecycleEvent(
    event: AgentLifecycleEvent,
    agentId: string,
    data?: unknown
  ): void {
    for (const callback of this.lifecycleCallbacks) {
      try {
        callback(event, agentId, data);
      } catch (error) {
        console.error(`Error in lifecycle callback for event '${event}':`, error);
      }
    }
  }

  // ==========================================================================
  // Cleanup - Dọn dẹp
  // ==========================================================================

  /**
   * Xóa agent khỏi registry
   * @param agentId - ID agent cần xóa
   */
  removeAgent(agentId: string): void {
    const entry = this.agents.get(agentId);
    if (entry) {
      const nameKey = this.getNameKey(entry.identity.agentName);
      this.agentsByName.delete(nameKey);
      this.agents.delete(agentId);
    }
  }

  /**
   * Xóa tất cả agents đã kết thúc
   */
  pruneTerminatedAgents(): void {
    const entriesToRemove: string[] = [];
    this.agents.forEach((entry, agentId) => {
      if (isTerminalStatus(entry.runtime.status)) {
        entriesToRemove.push(agentId);
      }
    });
    entriesToRemove.forEach((agentId) => this.removeAgent(agentId));
  }

  /**
   * Xóa tất cả agents
   */
  clearAllAgents(): void {
    this.agents.clear();
    this.agentsByName.clear();
    this.resetColorAssignments();
  }

  // ==========================================================================
  // Helper Methods - Phương thức hỗ trợ
  // ==========================================================================

  /**
   * Tạo key cho map theo tên
   * Key bao gồm team name để tránh xung đột giữa các team
   */
  private getNameKey(name: string): string {
    if (this.currentTeamName) {
      return `${this.currentTeamName}:${name}`;
    }
    return name;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Tạo instance mới của AgentManager
 * @param teamName - Tên team (optional)
 * @returns AgentManager instance
 */
export function createAgentManager(teamName?: string): AgentManager {
  return new AgentManager(teamName);
}

// ============================================================================
// Singleton Instance
// ============================================================================

/** Global agent manager instance */
let globalAgentManager: AgentManager | null = null;

/**
 * Lấy global agent manager instance
 * Tạo mới nếu chưa tồn tại
 * @returns AgentManager instance
 */
export function getGlobalAgentManager(): AgentManager {
  if (!globalAgentManager) {
    globalAgentManager = new AgentManager();
  }
  return globalAgentManager;
}

/**
 * Reset global agent manager
 * Dùng cho testing hoặc cleanup
 */
export function resetGlobalAgentManager(): void {
  if (globalAgentManager) {
    globalAgentManager.clearAllAgents();
  }
  globalAgentManager = null;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  AgentManager,
  createAgentManager,
  getGlobalAgentManager,
  resetGlobalAgentManager,
};
