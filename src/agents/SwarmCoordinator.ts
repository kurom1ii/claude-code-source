/**
 * SwarmCoordinator - Điều phối team và swarm agents
 *
 * Module này chịu trách nhiệm:
 * - Quản lý team configuration
 * - Điều phối việc spawn/terminate teammates
 * - Quản lý team membership (join/leave)
 * - Theo dõi trạng thái team
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import {
  TeamConfig,
  TeamMember,
  TeamContext,
  AgentColor,
  AgentBackendType,
  AgentIdentity,
  AVAILABLE_AGENT_COLORS,
  SWARM_SESSION_NAME,
} from './types';
import { AgentManager, createAgentManager } from './AgentManager';

// ============================================================================
// Constants - Hằng số
// ============================================================================

/** Tên thư mục chứa team configs */
const TEAMS_DIR = 'teams';

/** Tên file config của team */
const TEAM_CONFIG_FILE = 'config.json';

/** Tên thư mục tasks */
const TASKS_DIR = 'tasks';

/** Thư mục gốc của Claude */
const CLAUDE_DIR = '.claude';

// ============================================================================
// Path Utilities - Các hàm xử lý đường dẫn
// ============================================================================

/**
 * Lấy đường dẫn thư mục Claude home
 * @returns Đường dẫn ~/.claude
 */
function getClaudeHomeDir(): string {
  const home = process.env.HOME || process.env.USERPROFILE || '';
  return join(home, CLAUDE_DIR);
}

/**
 * Lấy đường dẫn thư mục teams
 * @returns Đường dẫn ~/.claude/teams
 */
function getTeamsDir(): string {
  return join(getClaudeHomeDir(), TEAMS_DIR);
}

/**
 * Lấy đường dẫn thư mục của một team cụ thể
 * @param teamName - Tên team
 * @returns Đường dẫn ~/.claude/teams/{teamName}
 */
function getTeamDir(teamName: string): string {
  return join(getTeamsDir(), teamName);
}

/**
 * Lấy đường dẫn file config của team
 * @param teamName - Tên team
 * @returns Đường dẫn ~/.claude/teams/{teamName}/config.json
 */
function getTeamConfigPath(teamName: string): string {
  return join(getTeamDir(teamName), TEAM_CONFIG_FILE);
}

/**
 * Lấy đường dẫn thư mục tasks
 * @returns Đường dẫn ~/.claude/tasks
 */
function getTasksDir(): string {
  return join(getClaudeHomeDir(), TASKS_DIR);
}

/**
 * Lấy đường dẫn thư mục tasks của team
 * @param teamName - Tên team
 * @returns Đường dẫn ~/.claude/tasks/{teamName}
 */
function getTeamTasksDir(teamName: string): string {
  return join(getTasksDir(), teamName);
}

// ============================================================================
// SwarmCoordinator Class
// ============================================================================

/**
 * Lớp điều phối team/swarm
 */
export class SwarmCoordinator {
  /** Agent manager để quản lý agents */
  private agentManager: AgentManager;

  /** Team config hiện tại */
  private teamConfig: TeamConfig | null = null;

  /** Map các panes đang ẩn */
  private hiddenPanes: Map<string, boolean> = new Map();

  /** Bộ đếm màu */
  private colorIndex = 0;

  /**
   * Constructor
   */
  constructor() {
    this.agentManager = createAgentManager();
  }

  // ==========================================================================
  // Team Management - Quản lý team
  // ==========================================================================

  /**
   * Tạo team mới
   * @param teamName - Tên team
   * @param description - Mô tả (optional)
   * @param leadAgentId - ID của leader (optional)
   * @returns Team config đã tạo
   */
  async createTeam(
    teamName: string,
    description?: string,
    leadAgentId?: string
  ): Promise<TeamConfig> {
    // Validate tên team
    if (!teamName || teamName.trim().length === 0) {
      throw new Error('Team name is required');
    }

    // Kiểm tra team đã tồn tại chưa
    const configPath = getTeamConfigPath(teamName);
    if (existsSync(configPath)) {
      throw new Error(`Team '${teamName}' already exists`);
    }

    // Tạo thư mục team
    const teamDir = getTeamDir(teamName);
    mkdirSync(teamDir, { recursive: true });

    // Tạo thư mục tasks
    const tasksDir = getTeamTasksDir(teamName);
    mkdirSync(tasksDir, { recursive: true });

    // Tạo config
    const config: TeamConfig = {
      teamName,
      description,
      leadAgentId,
      members: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // Nếu có leader, thêm vào members
    if (leadAgentId) {
      config.members.push({
        name: 'team-lead',
        agentId: leadAgentId,
        agentType: 'team-lead',
        isActive: true,
      });
    }

    // Lưu config
    this.saveTeamConfig(teamName, config);
    this.teamConfig = config;

    // Cập nhật agent manager
    this.agentManager = createAgentManager(teamName);

    return config;
  }

  /**
   * Load team config từ file
   * @param teamName - Tên team
   * @returns Team config hoặc null nếu không tồn tại
   */
  loadTeamConfig(teamName: string): TeamConfig | null {
    const configPath = getTeamConfigPath(teamName);
    if (!existsSync(configPath)) {
      return null;
    }

    try {
      const content = readFileSync(configPath, 'utf-8');
      const config = JSON.parse(content) as TeamConfig;
      this.teamConfig = config;
      this.agentManager = createAgentManager(teamName);
      return config;
    } catch (error) {
      console.error(`Failed to load team config for '${teamName}':`, error);
      return null;
    }
  }

  /**
   * Lưu team config ra file
   * @param teamName - Tên team
   * @param config - Config cần lưu
   */
  saveTeamConfig(teamName: string, config: TeamConfig): void {
    const configPath = getTeamConfigPath(teamName);
    const teamDir = dirname(configPath);

    // Đảm bảo thư mục tồn tại
    if (!existsSync(teamDir)) {
      mkdirSync(teamDir, { recursive: true });
    }

    // Cập nhật timestamp
    config.updatedAt = new Date().toISOString();

    // Lưu file
    writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  /**
   * Lấy team config hiện tại
   * @returns Team config hoặc null
   */
  getCurrentTeamConfig(): TeamConfig | null {
    return this.teamConfig;
  }

  /**
   * Kiểm tra team có tồn tại không
   * @param teamName - Tên team
   * @returns true nếu tồn tại
   */
  teamExists(teamName: string): boolean {
    return existsSync(getTeamConfigPath(teamName));
  }

  /**
   * Xóa team và cleanup resources
   * @param teamName - Tên team cần xóa
   */
  async cleanupTeam(teamName: string): Promise<void> {
    // Kiểm tra không còn members active
    const config = this.loadTeamConfig(teamName);
    if (config) {
      const activeMembers = config.members.filter(
        m => m.isActive !== false && m.name !== 'team-lead'
      );
      if (activeMembers.length > 0) {
        throw new Error(
          `Cannot cleanup team '${teamName}': still has ${activeMembers.length} active members`
        );
      }
    }

    // Xóa thư mục team
    const teamDir = getTeamDir(teamName);
    if (existsSync(teamDir)) {
      // Xóa files trong thư mục
      const configPath = getTeamConfigPath(teamName);
      if (existsSync(configPath)) {
        unlinkSync(configPath);
      }
      // TODO: Xóa thư mục rỗng
    }

    // Xóa thư mục tasks
    const tasksDir = getTeamTasksDir(teamName);
    if (existsSync(tasksDir)) {
      // TODO: Xóa files và thư mục tasks
    }

    // Clear local state
    if (this.teamConfig?.teamName === teamName) {
      this.teamConfig = null;
      this.agentManager.clearAllAgents();
    }
  }

  // ==========================================================================
  // Member Management - Quản lý thành viên
  // ==========================================================================

  /**
   * Thêm member vào team
   * @param member - Thông tin member
   * @returns Member đã được thêm (với color được gán)
   */
  addMember(member: Omit<TeamMember, 'color'> & { color?: AgentColor }): TeamMember {
    if (!this.teamConfig) {
      throw new Error('No team loaded');
    }

    // Kiểm tra trùng tên
    if (this.teamConfig.members.some(m => m.name === member.name)) {
      throw new Error(`Member '${member.name}' already exists in team`);
    }

    // Gán màu nếu chưa có
    const color = member.color || this.assignColor();

    // Tạo member với color
    const newMember: TeamMember = {
      ...member,
      color,
      isActive: true,
    };

    // Thêm vào danh sách
    this.teamConfig.members.push(newMember);

    // Lưu config
    this.saveTeamConfig(this.teamConfig.teamName, this.teamConfig);

    return newMember;
  }

  /**
   * Xóa member khỏi team
   * @param memberName - Tên member
   * @returns true nếu xóa thành công
   */
  removeMember(memberName: string): boolean {
    if (!this.teamConfig) {
      return false;
    }

    const index = this.teamConfig.members.findIndex(m => m.name === memberName);
    if (index === -1) {
      return false;
    }

    // Không cho xóa team-lead
    if (memberName === 'team-lead') {
      throw new Error('Cannot remove team-lead');
    }

    // Xóa khỏi danh sách
    this.teamConfig.members.splice(index, 1);

    // Lưu config
    this.saveTeamConfig(this.teamConfig.teamName, this.teamConfig);

    return true;
  }

  /**
   * Cập nhật thông tin member
   * @param memberName - Tên member cần cập nhật
   * @param updates - Các trường cần cập nhật
   * @returns Member đã cập nhật hoặc null
   */
  updateMember(
    memberName: string,
    updates: Partial<Omit<TeamMember, 'name' | 'agentId'>>
  ): TeamMember | null {
    if (!this.teamConfig) {
      return null;
    }

    const member = this.teamConfig.members.find(m => m.name === memberName);
    if (!member) {
      return null;
    }

    // Cập nhật các trường
    Object.assign(member, updates);

    // Lưu config
    this.saveTeamConfig(this.teamConfig.teamName, this.teamConfig);

    return member;
  }

  /**
   * Lấy thông tin member theo tên
   * @param memberName - Tên member
   * @returns Member hoặc undefined
   */
  getMember(memberName: string): TeamMember | undefined {
    return this.teamConfig?.members.find(m => m.name === memberName);
  }

  /**
   * Lấy danh sách tất cả members
   * @returns Mảng members
   */
  getAllMembers(): TeamMember[] {
    return this.teamConfig?.members || [];
  }

  /**
   * Lấy danh sách members active (không bao gồm team-lead)
   * @returns Mảng members active
   */
  getActiveMembers(): TeamMember[] {
    if (!this.teamConfig) return [];

    return this.teamConfig.members.filter(
      m => m.isActive !== false && m.name !== 'team-lead'
    );
  }

  /**
   * Lấy danh sách teammates (không bao gồm team-lead)
   * @returns Mảng teammates
   */
  getTeammates(): TeamMember[] {
    if (!this.teamConfig) return [];

    return this.teamConfig.members.filter(m => m.name !== 'team-lead');
  }

  /**
   * Đánh dấu member là inactive
   * @param memberName - Tên member
   */
  deactivateMember(memberName: string): void {
    this.updateMember(memberName, { isActive: false });
  }

  /**
   * Đánh dấu member là active
   * @param memberName - Tên member
   */
  activateMember(memberName: string): void {
    this.updateMember(memberName, { isActive: true });
  }

  // ==========================================================================
  // Color Assignment - Phân bổ màu
  // ==========================================================================

  /**
   * Phân bổ màu cho member mới
   * Sử dụng round-robin để đảm bảo màu phân bố đều
   * @returns Màu được chọn
   */
  private assignColor(): AgentColor {
    // Lấy các màu đã được sử dụng
    const usedColors = new Set(
      this.teamConfig?.members
        .filter(m => m.color)
        .map(m => m.color as AgentColor) || []
    );

    // Tìm màu chưa dùng
    for (const color of AVAILABLE_AGENT_COLORS) {
      if (!usedColors.has(color)) {
        return color;
      }
    }

    // Nếu tất cả màu đã dùng, sử dụng round-robin
    const color = AVAILABLE_AGENT_COLORS[this.colorIndex % AVAILABLE_AGENT_COLORS.length];
    this.colorIndex++;
    return color;
  }

  /**
   * Reset bộ đếm màu
   */
  resetColorIndex(): void {
    this.colorIndex = 0;
  }

  // ==========================================================================
  // Pane Management - Quản lý panes
  // ==========================================================================

  /**
   * Lưu trạng thái ẩn của pane
   * @param paneId - ID pane
   * @param isHidden - Đang ẩn hay không
   */
  setPaneHiddenState(paneId: string, isHidden: boolean): void {
    if (isHidden) {
      this.hiddenPanes.set(paneId, true);
    } else {
      this.hiddenPanes.delete(paneId);
    }
  }

  /**
   * Kiểm tra pane có đang ẩn không
   * @param paneId - ID pane
   * @returns true nếu đang ẩn
   */
  isPaneHidden(paneId: string): boolean {
    return this.hiddenPanes.get(paneId) || false;
  }

  /**
   * Lấy danh sách panes đang ẩn
   * @returns Mảng pane IDs
   */
  getHiddenPanes(): string[] {
    return Array.from(this.hiddenPanes.keys());
  }

  /**
   * Cập nhật pane ID cho member
   * @param memberName - Tên member
   * @param paneId - ID pane mới
   */
  updateMemberPaneId(memberName: string, paneId: string): void {
    this.updateMember(memberName, { tmuxPaneId: paneId });
  }

  // ==========================================================================
  // Team Context - Context cho agents
  // ==========================================================================

  /**
   * Tạo team context cho agent
   * @param selfName - Tên của agent hiện tại
   * @returns TeamContext
   */
  createTeamContext(selfName: string): TeamContext | null {
    if (!this.teamConfig) return null;

    const selfMember = this.getMember(selfName);

    // Tạo map teammates
    const teammates: Record<string, TeamMember> = {};
    for (const member of this.teamConfig.members) {
      if (member.name !== selfName) {
        teammates[member.name] = member;
      }
    }

    return {
      teamName: this.teamConfig.teamName,
      selfAgentName: selfName,
      selfAgentColor: selfMember?.color,
      teammates,
    };
  }

  /**
   * Lấy agent manager
   * @returns AgentManager instance
   */
  getAgentManager(): AgentManager {
    return this.agentManager;
  }

  // ==========================================================================
  // Discovery - Khám phá teams
  // ==========================================================================

  /**
   * Liệt kê tất cả teams có sẵn
   * @returns Danh sách team configs
   */
  static discoverTeams(): TeamConfig[] {
    const teamsDir = getTeamsDir();
    if (!existsSync(teamsDir)) {
      return [];
    }

    const teams: TeamConfig[] = [];

    try {
      const { readdirSync } = require('fs');
      const entries = readdirSync(teamsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const configPath = join(teamsDir, entry.name, TEAM_CONFIG_FILE);
          if (existsSync(configPath)) {
            try {
              const content = readFileSync(configPath, 'utf-8');
              const config = JSON.parse(content) as TeamConfig;
              teams.push(config);
            } catch {
              // Bỏ qua file config lỗi
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to discover teams:', error);
    }

    return teams;
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Tạo instance SwarmCoordinator mới
 * @returns SwarmCoordinator instance
 */
export function createSwarmCoordinator(): SwarmCoordinator {
  return new SwarmCoordinator();
}

// ============================================================================
// Singleton Instance
// ============================================================================

/** Global swarm coordinator instance */
let globalSwarmCoordinator: SwarmCoordinator | null = null;

/**
 * Lấy global swarm coordinator instance
 * @returns SwarmCoordinator instance
 */
export function getGlobalSwarmCoordinator(): SwarmCoordinator {
  if (!globalSwarmCoordinator) {
    globalSwarmCoordinator = new SwarmCoordinator();
  }
  return globalSwarmCoordinator;
}

/**
 * Reset global swarm coordinator
 */
export function resetGlobalSwarmCoordinator(): void {
  globalSwarmCoordinator = null;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  SwarmCoordinator,
  createSwarmCoordinator,
  getGlobalSwarmCoordinator,
  resetGlobalSwarmCoordinator,
  getTeamsDir,
  getTeamDir,
  getTeamConfigPath,
  getTeamTasksDir,
};
