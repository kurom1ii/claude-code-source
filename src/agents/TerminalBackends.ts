/**
 * TerminalBackends - Các implementations cho terminal backends
 *
 * Module này cung cấp implementations cho:
 * - TmuxBackend: Quản lý panes qua tmux
 * - ITermBackend: Quản lý panes qua iTerm2
 * - Backend detection và selection
 */

import { spawn, ChildProcess, SpawnOptionsWithoutStdio } from 'child_process';
import {
  AgentColor,
  AgentBackendType,
  TerminalBackend,
  PaneCreationResult,
  AGENT_COLOR_TO_TMUX,
  SWARM_SESSION_NAME,
  SWARM_WINDOW_NAME,
  HIDDEN_PANES_SESSION,
  PANE_REBALANCE_DELAY_MS,
} from './types';

// ============================================================================
// Constants - Hằng số
// ============================================================================

/** Tên binary tmux */
const TMUX_BINARY = 'tmux';

/** Tên binary it2 (iTerm2 CLI) */
const ITERM_BINARY = 'it2';

// ============================================================================
// Command Execution - Thực thi commands
// ============================================================================

/**
 * Kết quả của command execution
 */
interface CommandResult {
  /** Exit code */
  code: number;
  /** Standard output */
  stdout: string;
  /** Standard error */
  stderr: string;
}

/**
 * Thực thi command và trả về kết quả
 * @param command - Tên command
 * @param args - Arguments
 * @param options - Spawn options
 * @returns Promise<CommandResult>
 */
async function executeCommand(
  command: string,
  args: string[],
  options?: SpawnOptionsWithoutStdio
): Promise<CommandResult> {
  return new Promise((resolve) => {
    const proc = spawn(command, args, {
      ...options,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (data) => {
      stdout += data.toString();
    });

    proc.stderr?.on('data', (data) => {
      stderr += data.toString();
    });

    proc.on('close', (code) => {
      resolve({
        code: code ?? 1,
        stdout,
        stderr,
      });
    });

    proc.on('error', (error) => {
      resolve({
        code: 1,
        stdout: '',
        stderr: error.message,
      });
    });
  });
}

/**
 * Thực thi tmux command
 * @param args - Arguments cho tmux
 * @returns Promise<CommandResult>
 */
async function executeTmux(args: string[]): Promise<CommandResult> {
  return executeCommand(TMUX_BINARY, args);
}

/**
 * Thực thi tmux command với custom socket
 * @param socket - Socket path
 * @param args - Arguments cho tmux
 * @returns Promise<CommandResult>
 */
async function executeTmuxWithSocket(socket: string, args: string[]): Promise<CommandResult> {
  return executeCommand(TMUX_BINARY, ['-L', socket, ...args]);
}

/**
 * Thực thi iTerm2 command
 * @param args - Arguments cho it2
 * @returns Promise<CommandResult>
 */
async function executeITerm(args: string[]): Promise<CommandResult> {
  return executeCommand(ITERM_BINARY, args);
}

// ============================================================================
// Environment Detection - Phát hiện môi trường
// ============================================================================

/**
 * Kiểm tra có đang chạy trong tmux không
 * @returns true nếu trong tmux
 */
export function isInsideTmux(): boolean {
  return !!process.env.TMUX;
}

/**
 * Kiểm tra có đang chạy trong iTerm2 không
 * @returns true nếu trong iTerm2
 */
export function isInsideITerm2(): boolean {
  const termProgram = process.env.TERM_PROGRAM;
  return termProgram === 'iTerm.app';
}

/**
 * Kiểm tra tmux có sẵn không
 * @returns Promise<boolean>
 */
export async function isTmuxAvailable(): Promise<boolean> {
  const result = await executeCommand('which', [TMUX_BINARY]);
  return result.code === 0;
}

/**
 * Kiểm tra iTerm2 CLI có sẵn không
 * @returns Promise<boolean>
 */
export async function isITermAvailable(): Promise<boolean> {
  const result = await executeCommand('which', [ITERM_BINARY]);
  return result.code === 0;
}

/**
 * Lấy socket path của leader tmux session
 * @returns Socket path
 */
export function getLeaderTmuxSocket(): string {
  // Có thể customize socket name dựa trên session
  return 'claude-leader';
}

/**
 * Lấy pane ID hiện tại từ environment
 * @returns Pane ID hoặc null
 */
export function getCurrentPaneIdFromEnv(): string | null {
  return process.env.TMUX_PANE || null;
}

// ============================================================================
// Tmux Backend Implementation
// ============================================================================

/**
 * Backend implementation cho tmux
 */
export class TmuxBackend implements TerminalBackend {
  readonly type: AgentBackendType = 'tmux';
  readonly displayName = 'tmux';
  readonly supportsHideShow = true;

  /** Cache window target */
  private cachedWindowTarget: string | null = null;

  /** Đánh dấu đã tạo pane đầu tiên chưa */
  private hasFirstPane = false;

  /** Lock để tránh race condition khi tạo panes */
  private paneLock: Promise<void> = Promise.resolve();

  /**
   * Kiểm tra tmux có sẵn không
   */
  async isAvailable(): Promise<boolean> {
    return isTmuxAvailable();
  }

  /**
   * Kiểm tra có đang chạy trong tmux không
   */
  async isRunningInside(): Promise<boolean> {
    return isInsideTmux();
  }

  /**
   * Tạo pane mới cho teammate trong swarm view
   */
  async createTeammatePaneInSwarmView(
    name: string,
    color: AgentColor
  ): Promise<PaneCreationResult> {
    // Sử dụng lock để tránh race condition
    await this.paneLock;

    let resolve: () => void;
    this.paneLock = new Promise((r) => (resolve = r));

    try {
      const isInside = await this.isRunningInside();
      if (isInside) {
        return await this.createTeammatePaneWithLeader(name, color);
      } else {
        return await this.createTeammatePaneExternal(name, color);
      }
    } finally {
      resolve!();
    }
  }

  /**
   * Tạo pane khi chạy từ trong tmux (có leader)
   */
  private async createTeammatePaneWithLeader(
    name: string,
    color: AgentColor
  ): Promise<PaneCreationResult> {
    const currentPaneId = await this.getCurrentPaneId();
    const windowTarget = await this.getCurrentWindowTarget();

    if (!currentPaneId || !windowTarget) {
      throw new Error('Could not determine current tmux pane/window');
    }

    const paneCount = await this.getCurrentWindowPaneCount(windowTarget);
    if (paneCount === null) {
      throw new Error('Could not determine pane count for current window');
    }

    const isFirstTeammate = paneCount === 1;
    let result: CommandResult;

    if (isFirstTeammate) {
      // Teammate đầu tiên: split horizontal với 70% cho teammates
      result = await executeTmux([
        'split-window',
        '-t',
        currentPaneId,
        '-h',
        '-p',
        '70',
        '-P',
        '-F',
        '#{pane_id}',
      ]);
    } else {
      // Các teammates sau: tìm pane phù hợp để split
      const panes = await this.listPanesInWindow(windowTarget);
      const teammatePanes = panes.slice(1); // Bỏ qua leader pane
      const count = teammatePanes.length;
      const isVertical = count % 2 === 1;
      const targetIndex = Math.floor((count - 1) / 2);
      const targetPane = teammatePanes[targetIndex] || teammatePanes[teammatePanes.length - 1];

      result = await executeTmux([
        'split-window',
        '-t',
        targetPane,
        isVertical ? '-v' : '-h',
        '-P',
        '-F',
        '#{pane_id}',
      ]);
    }

    if (result.code !== 0) {
      throw new Error(`Failed to create teammate pane: ${result.stderr}`);
    }

    const paneId = result.stdout.trim();

    // Thiết lập style cho pane
    await this.setPaneBorderColor(paneId, color);
    await this.setPaneTitle(paneId, name, color);
    await this.rebalancePanesWithLeader(windowTarget);

    // Delay nhỏ để tmux cập nhật
    await this.delay(PANE_REBALANCE_DELAY_MS);

    return {
      paneId,
      isFirstTeammate,
    };
  }

  /**
   * Tạo pane khi chạy từ ngoài tmux (external)
   */
  private async createTeammatePaneExternal(
    name: string,
    color: AgentColor
  ): Promise<PaneCreationResult> {
    const socket = getLeaderTmuxSocket();
    const { windowTarget, paneId: initialPaneId } = await this.createExternalSwarmSession(socket);

    const paneCount = await this.getCurrentWindowPaneCount(windowTarget, true);
    if (paneCount === null) {
      throw new Error('Could not determine pane count for swarm window');
    }

    const isFirstTeammate = !this.hasFirstPane && paneCount === 1;
    let paneId: string;

    if (isFirstTeammate) {
      // Sử dụng pane ban đầu cho teammate đầu tiên
      paneId = initialPaneId;
      this.hasFirstPane = true;
      await this.enablePaneBorderStatus(windowTarget, true);
    } else {
      // Tạo pane mới
      const panes = await this.listPanesInWindow(windowTarget, true);
      const count = panes.length;
      const isVertical = count % 2 === 1;
      const targetIndex = Math.floor((count - 1) / 2);
      const targetPane = panes[targetIndex] || panes[panes.length - 1];

      const result = await executeTmuxWithSocket(socket, [
        'split-window',
        '-t',
        targetPane,
        isVertical ? '-v' : '-h',
        '-P',
        '-F',
        '#{pane_id}',
      ]);

      if (result.code !== 0) {
        throw new Error(`Failed to create teammate pane: ${result.stderr}`);
      }

      paneId = result.stdout.trim();
    }

    // Thiết lập style
    await this.setPaneBorderColor(paneId, color, true);
    await this.setPaneTitle(paneId, name, color, true);
    await this.rebalancePanesTiled(windowTarget);

    // Delay nhỏ để tmux cập nhật
    await this.delay(PANE_REBALANCE_DELAY_MS);

    return {
      paneId,
      isFirstTeammate,
    };
  }

  /**
   * Tạo swarm session external nếu chưa có
   */
  private async createExternalSwarmSession(
    socket: string
  ): Promise<{ windowTarget: string; paneId: string }> {
    const hasSession = await this.hasSessionInSwarm(SWARM_SESSION_NAME, socket);

    if (!hasSession) {
      // Tạo session mới
      const result = await executeTmuxWithSocket(socket, [
        'new-session',
        '-d',
        '-s',
        SWARM_SESSION_NAME,
        '-n',
        SWARM_WINDOW_NAME,
        '-P',
        '-F',
        '#{pane_id}',
      ]);

      if (result.code !== 0) {
        throw new Error(`Failed to create swarm session: ${result.stderr}`);
      }

      return {
        windowTarget: `${SWARM_SESSION_NAME}:${SWARM_WINDOW_NAME}`,
        paneId: result.stdout.trim(),
      };
    }

    // Session đã tồn tại, kiểm tra window
    const windowTarget = `${SWARM_SESSION_NAME}:${SWARM_WINDOW_NAME}`;
    const windows = await this.listWindows(SWARM_SESSION_NAME, socket);

    if (windows.includes(SWARM_WINDOW_NAME)) {
      // Window đã tồn tại, lấy pane đầu tiên
      const panes = await this.listPanesInWindow(windowTarget, true);
      return {
        windowTarget,
        paneId: panes[0] || '',
      };
    }

    // Tạo window mới
    const result = await executeTmuxWithSocket(socket, [
      'new-window',
      '-t',
      SWARM_SESSION_NAME,
      '-n',
      SWARM_WINDOW_NAME,
      '-P',
      '-F',
      '#{pane_id}',
    ]);

    if (result.code !== 0) {
      throw new Error(`Failed to create swarm window: ${result.stderr}`);
    }

    return {
      windowTarget,
      paneId: result.stdout.trim(),
    };
  }

  /**
   * Gửi command vào pane
   */
  async sendCommandToPane(
    paneId: string,
    command: string,
    useLeaderSocket: boolean = false
  ): Promise<void> {
    const exec = useLeaderSocket
      ? (args: string[]) => executeTmuxWithSocket(getLeaderTmuxSocket(), args)
      : executeTmux;

    const result = await exec(['send-keys', '-t', paneId, command, 'Enter']);
    if (result.code !== 0) {
      throw new Error(`Failed to send command to pane ${paneId}: ${result.stderr}`);
    }
  }

  /**
   * Đặt màu border cho pane
   */
  async setPaneBorderColor(
    paneId: string,
    color: AgentColor,
    useLeaderSocket: boolean = false
  ): Promise<void> {
    const tmuxColor = AGENT_COLOR_TO_TMUX[color] || 'default';
    const exec = useLeaderSocket
      ? (args: string[]) => executeTmuxWithSocket(getLeaderTmuxSocket(), args)
      : executeTmux;

    await exec(['select-pane', '-t', paneId, '-P', `bg=default,fg=${tmuxColor}`]);
    await exec(['set-option', '-p', '-t', paneId, 'pane-border-style', `fg=${tmuxColor}`]);
    await exec(['set-option', '-p', '-t', paneId, 'pane-active-border-style', `fg=${tmuxColor}`]);
  }

  /**
   * Đặt title cho pane
   */
  async setPaneTitle(
    paneId: string,
    title: string,
    color: AgentColor,
    useLeaderSocket: boolean = false
  ): Promise<void> {
    const tmuxColor = AGENT_COLOR_TO_TMUX[color] || 'default';
    const exec = useLeaderSocket
      ? (args: string[]) => executeTmuxWithSocket(getLeaderTmuxSocket(), args)
      : executeTmux;

    await exec(['select-pane', '-t', paneId, '-T', title]);
    await exec([
      'set-option',
      '-p',
      '-t',
      paneId,
      'pane-border-format',
      `#[fg=${tmuxColor},bold] #{pane_title} #[default]`,
    ]);
  }

  /**
   * Bật border status cho window
   */
  async enablePaneBorderStatus(
    windowTarget?: string,
    useLeaderSocket: boolean = false
  ): Promise<void> {
    const target = windowTarget || (await this.getCurrentWindowTarget());
    if (!target) return;

    const exec = useLeaderSocket
      ? (args: string[]) => executeTmuxWithSocket(getLeaderTmuxSocket(), args)
      : executeTmux;

    await exec(['set-option', '-w', '-t', target, 'pane-border-status', 'top']);
  }

  /**
   * Cân bằng lại panes
   */
  async rebalancePanes(windowTarget: string, withLeader: boolean): Promise<void> {
    if (withLeader) {
      await this.rebalancePanesWithLeader(windowTarget);
    } else {
      await this.rebalancePanesTiled(windowTarget);
    }
  }

  /**
   * Cân bằng panes với main-vertical layout (cho leader mode)
   */
  private async rebalancePanesWithLeader(windowTarget: string): Promise<void> {
    const panes = await this.listPanesInWindow(windowTarget);
    if (panes.length <= 2) return;

    await executeTmux(['select-layout', '-t', windowTarget, 'main-vertical']);
    const leaderPane = panes[0];
    await executeTmux(['resize-pane', '-t', leaderPane, '-x', '30%']);
  }

  /**
   * Cân bằng panes với tiled layout
   */
  private async rebalancePanesTiled(windowTarget: string): Promise<void> {
    const socket = getLeaderTmuxSocket();
    const panes = await this.listPanesInWindow(windowTarget, true);
    if (panes.length <= 1) return;

    await executeTmuxWithSocket(socket, ['select-layout', '-t', windowTarget, 'tiled']);
  }

  /**
   * Đóng pane
   */
  async killPane(paneId: string, useLeaderSocket: boolean = false): Promise<boolean> {
    const exec = useLeaderSocket
      ? (args: string[]) => executeTmuxWithSocket(getLeaderTmuxSocket(), args)
      : executeTmux;

    const result = await exec(['kill-pane', '-t', paneId]);
    return result.code === 0;
  }

  /**
   * Ẩn pane (move sang hidden session)
   */
  async hidePane(paneId: string, useLeaderSocket: boolean = false): Promise<boolean> {
    const exec = useLeaderSocket
      ? (args: string[]) => executeTmuxWithSocket(getLeaderTmuxSocket(), args)
      : executeTmux;

    // Tạo hidden session nếu chưa có
    await exec(['new-session', '-d', '-s', HIDDEN_PANES_SESSION]);

    // Move pane sang hidden session
    const result = await exec([
      'break-pane',
      '-d',
      '-s',
      paneId,
      '-t',
      `${HIDDEN_PANES_SESSION}:`,
    ]);

    return result.code === 0;
  }

  /**
   * Hiện pane (move từ hidden session về)
   */
  async showPane(
    paneId: string,
    targetWindow: string,
    useLeaderSocket: boolean = false
  ): Promise<boolean> {
    const exec = useLeaderSocket
      ? (args: string[]) => executeTmuxWithSocket(getLeaderTmuxSocket(), args)
      : executeTmux;

    const result = await exec(['join-pane', '-h', '-s', paneId, '-t', targetWindow]);
    if (result.code !== 0) {
      return false;
    }

    // Reselect layout
    await exec(['select-layout', '-t', targetWindow, 'main-vertical']);

    // Resize leader pane
    const panes = await this.listPanesInWindow(targetWindow, useLeaderSocket);
    if (panes[0]) {
      await exec(['resize-pane', '-t', panes[0], '-x', '30%']);
    }

    return true;
  }

  // ==========================================================================
  // Helper Methods
  // ==========================================================================

  /**
   * Lấy pane ID hiện tại
   */
  private async getCurrentPaneId(): Promise<string | null> {
    const envPaneId = getCurrentPaneIdFromEnv();
    if (envPaneId) return envPaneId;

    const result = await executeTmux(['display-message', '-p', '#{pane_id}']);
    if (result.code !== 0) return null;
    return result.stdout.trim();
  }

  /**
   * Lấy window target hiện tại
   */
  private async getCurrentWindowTarget(): Promise<string | null> {
    if (this.cachedWindowTarget) return this.cachedWindowTarget;

    const paneId = getCurrentPaneIdFromEnv();
    const args = ['display-message'];
    if (paneId) args.push('-t', paneId);
    args.push('-p', '#{session_name}:#{window_index}');

    const result = await executeTmux(args);
    if (result.code !== 0) return null;

    this.cachedWindowTarget = result.stdout.trim();
    return this.cachedWindowTarget;
  }

  /**
   * Lấy số panes trong window
   */
  private async getCurrentWindowPaneCount(
    windowTarget: string,
    useLeaderSocket: boolean = false
  ): Promise<number | null> {
    const panes = await this.listPanesInWindow(windowTarget, useLeaderSocket);
    return panes.length;
  }

  /**
   * Liệt kê panes trong window
   */
  private async listPanesInWindow(
    windowTarget: string,
    useLeaderSocket: boolean = false
  ): Promise<string[]> {
    const exec = useLeaderSocket
      ? (args: string[]) => executeTmuxWithSocket(getLeaderTmuxSocket(), args)
      : executeTmux;

    const result = await exec(['list-panes', '-t', windowTarget, '-F', '#{pane_id}']);
    if (result.code !== 0) return [];

    return result.stdout
      .trim()
      .split('\n')
      .filter(Boolean);
  }

  /**
   * Liệt kê windows trong session
   */
  private async listWindows(sessionName: string, socket: string): Promise<string[]> {
    const result = await executeTmuxWithSocket(socket, [
      'list-windows',
      '-t',
      sessionName,
      '-F',
      '#{window_name}',
    ]);
    if (result.code !== 0) return [];

    return result.stdout
      .trim()
      .split('\n')
      .filter(Boolean);
  }

  /**
   * Kiểm tra session có tồn tại không
   */
  private async hasSessionInSwarm(sessionName: string, socket: string): Promise<boolean> {
    const result = await executeTmuxWithSocket(socket, ['has-session', '-t', sessionName]);
    return result.code === 0;
  }

  /**
   * Delay utility
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Reset state
   */
  reset(): void {
    this.cachedWindowTarget = null;
    this.hasFirstPane = false;
    this.paneLock = Promise.resolve();
  }
}

// ============================================================================
// iTerm2 Backend Implementation
// ============================================================================

/**
 * Backend implementation cho iTerm2
 */
export class ITermBackend implements TerminalBackend {
  readonly type: AgentBackendType = 'iterm2';
  readonly displayName = 'iTerm2';
  readonly supportsHideShow = false;

  /** Danh sách session IDs của teammates */
  private teammateSessionIds: string[] = [];

  /** Đánh dấu đã tạo pane đầu tiên chưa */
  private hasFirstPane = false;

  /** Lock để tránh race condition */
  private paneLock: Promise<void> = Promise.resolve();

  /**
   * Kiểm tra iTerm2 có sẵn không
   */
  async isAvailable(): Promise<boolean> {
    if (!isInsideITerm2()) return false;
    return isITermAvailable();
  }

  /**
   * Kiểm tra có đang chạy trong iTerm2 không
   */
  async isRunningInside(): Promise<boolean> {
    return isInsideITerm2();
  }

  /**
   * Tạo pane mới cho teammate
   */
  async createTeammatePaneInSwarmView(
    name: string,
    color: AgentColor
  ): Promise<PaneCreationResult> {
    // Sử dụng lock
    await this.paneLock;

    let resolve: () => void;
    this.paneLock = new Promise((r) => (resolve = r));

    try {
      const isFirstTeammate = !this.hasFirstPane;
      let args: string[];

      if (isFirstTeammate) {
        // Split đầu tiên: từ leader session
        args = ['session', 'split', '-v'];
      } else {
        // Split tiếp theo: từ teammate cuối cùng
        const lastSession = this.teammateSessionIds[this.teammateSessionIds.length - 1];
        if (lastSession) {
          args = ['session', 'split', '-s', lastSession];
        } else {
          args = ['session', 'split'];
        }
      }

      const result = await executeITerm(args);
      if (result.code !== 0) {
        throw new Error(`Failed to create iTerm2 split pane: ${result.stderr}`);
      }

      if (isFirstTeammate) {
        this.hasFirstPane = true;
      }

      // Parse session ID từ output
      const sessionId = this.parseSessionId(result.stdout);
      if (!sessionId) {
        throw new Error(`Failed to parse session ID from output: ${result.stdout}`);
      }

      this.teammateSessionIds.push(sessionId);

      return {
        paneId: sessionId,
        isFirstTeammate,
      };
    } finally {
      resolve!();
    }
  }

  /**
   * Gửi command vào pane
   */
  async sendCommandToPane(
    paneId: string,
    command: string,
    _useLeaderSocket: boolean = false
  ): Promise<void> {
    const args = paneId
      ? ['session', 'run', '-s', paneId, command]
      : ['session', 'run', command];

    const result = await executeITerm(args);
    if (result.code !== 0) {
      throw new Error(`Failed to send command to iTerm2 pane ${paneId}: ${result.stderr}`);
    }
  }

  /**
   * Đặt màu border (không hỗ trợ trong iTerm2)
   */
  async setPaneBorderColor(
    _paneId: string,
    _color: AgentColor,
    _useLeaderSocket: boolean = false
  ): Promise<void> {
    // iTerm2 không hỗ trợ pane border color qua CLI
  }

  /**
   * Đặt title (không hỗ trợ trong iTerm2)
   */
  async setPaneTitle(
    _paneId: string,
    _title: string,
    _color: AgentColor,
    _useLeaderSocket: boolean = false
  ): Promise<void> {
    // iTerm2 không hỗ trợ pane title qua CLI
  }

  /**
   * Bật border status (không hỗ trợ trong iTerm2)
   */
  async enablePaneBorderStatus(
    _windowTarget?: string,
    _useLeaderSocket?: boolean
  ): Promise<void> {
    // iTerm2 không hỗ trợ
  }

  /**
   * Cân bằng panes (không hỗ trợ trong iTerm2)
   */
  async rebalancePanes(_windowTarget: string, _withLeader: boolean): Promise<void> {
    // iTerm2 không hỗ trợ rebalance qua CLI
  }

  /**
   * Đóng pane
   */
  async killPane(paneId: string, _useLeaderSocket: boolean = false): Promise<boolean> {
    const result = await executeITerm(['session', 'close', '-s', paneId]);
    return result.code === 0;
  }

  /**
   * Ẩn pane (không hỗ trợ trong iTerm2)
   */
  async hidePane(_paneId: string, _useLeaderSocket: boolean = false): Promise<boolean> {
    return false;
  }

  /**
   * Hiện pane (không hỗ trợ trong iTerm2)
   */
  async showPane(
    _paneId: string,
    _targetWindow: string,
    _useLeaderSocket: boolean = false
  ): Promise<boolean> {
    return false;
  }

  /**
   * Parse session ID từ output
   */
  private parseSessionId(output: string): string | null {
    const trimmed = output.trim();
    // Output thường là session ID trên dòng đầu
    const firstLine = trimmed.split('\n')[0];
    return firstLine || null;
  }

  /**
   * Lấy danh sách teammate session IDs
   */
  getTeammateSessionIds(): string[] {
    return [...this.teammateSessionIds];
  }

  /**
   * Reset state
   */
  reset(): void {
    this.teammateSessionIds = [];
    this.hasFirstPane = false;
    this.paneLock = Promise.resolve();
  }
}

// ============================================================================
// Backend Detection & Selection
// ============================================================================

/** Cached backend instance */
let cachedBackend: TerminalBackend | null = null;

/** Registered backends */
const registeredBackends: Map<AgentBackendType, TerminalBackend> = new Map();

/**
 * Đăng ký backend
 * @param backend - Backend instance
 */
export function registerBackend(backend: TerminalBackend): void {
  registeredBackends.set(backend.type, backend);
}

/**
 * Lấy backend theo type
 * @param type - Backend type
 * @returns Backend instance hoặc undefined
 */
export function getBackendByType(type: AgentBackendType): TerminalBackend | undefined {
  return registeredBackends.get(type);
}

/**
 * Detect và trả về backend phù hợp
 * @returns Backend instance hoặc null
 */
export async function detectBackend(): Promise<TerminalBackend | null> {
  if (cachedBackend) return cachedBackend;

  // Ưu tiên tmux nếu đang chạy trong tmux
  if (isInsideTmux()) {
    const tmux = registeredBackends.get('tmux') || new TmuxBackend();
    if (await tmux.isAvailable()) {
      cachedBackend = tmux;
      return tmux;
    }
  }

  // Kiểm tra iTerm2
  if (isInsideITerm2()) {
    const iterm = registeredBackends.get('iterm2') || new ITermBackend();
    if (await iterm.isAvailable()) {
      cachedBackend = iterm;
      return iterm;
    }
  }

  // Fallback: kiểm tra tmux available
  const tmux = registeredBackends.get('tmux') || new TmuxBackend();
  if (await tmux.isAvailable()) {
    cachedBackend = tmux;
    return tmux;
  }

  return null;
}

/**
 * Lấy cached backend
 * @returns Cached backend hoặc null
 */
export function getCachedBackend(): TerminalBackend | null {
  return cachedBackend;
}

/**
 * Reset backend detection
 */
export function resetBackendDetection(): void {
  cachedBackend = null;
}

// ============================================================================
// Initialize Default Backends
// ============================================================================

// Đăng ký backends mặc định
registerBackend(new TmuxBackend());
registerBackend(new ITermBackend());

// ============================================================================
// Exports
// ============================================================================

export default {
  // Classes
  TmuxBackend,
  ITermBackend,

  // Detection functions
  isInsideTmux,
  isInsideITerm2,
  isTmuxAvailable,
  isITermAvailable,
  getCurrentPaneIdFromEnv,
  getLeaderTmuxSocket,

  // Backend management
  registerBackend,
  getBackendByType,
  detectBackend,
  getCachedBackend,
  resetBackendDetection,
};
