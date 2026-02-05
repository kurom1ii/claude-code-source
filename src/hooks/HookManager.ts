/**
 * Claude Code - Hook Manager
 *
 * Quản lý lifecycle của hooks:
 * - Load hooks từ nhiều nguồn (settings, plugins, session)
 * - Match hooks với events
 * - Dedup hooks để tránh chạy duplicate
 * - Track session hooks (in-memory, temporary)
 */

import type {
  HookConfig,
  HookMatcher,
  HookEventType,
  HookInput,
  ExtendedHookDefinition,
  MatchedHook,
  CallbackHookDefinition,
  FunctionHookDefinition,
} from './types';
import { isCommandHook, isPromptHook, isAgentHook } from './types';
import {
  loadUserHooks,
  loadProjectHooks,
  loadLocalHooks,
  loadPluginHooks,
  mergeHookConfigs,
  isAllHooksDisabled,
  isManagedHooksOnly,
  getPluginsDirectory,
  PluginHooksResult,
} from './HookConfig';
import { getMatchQueryFromInput } from './events';
import { existsSync, readdirSync } from 'fs';
import { join } from 'path';

// ============================================================================
// Hook Manager State - State nội bộ
// ============================================================================

/**
 * Session hooks - hooks được add trong session hiện tại
 * Được clear khi session kết thúc
 */
interface SessionHooks {
  /** Hooks nhóm theo event type và agent ID */
  [agentId: string]: {
    [eventType: string]: Array<{
      matcher?: string;
      hooks: ExtendedHookDefinition[];
      onHookSuccess?: (hook: ExtendedHookDefinition, result: unknown) => void;
    }>;
  };
}

/**
 * Plugin hooks with metadata
 */
interface PluginHooksWithMetadata {
  pluginName: string;
  pluginRoot: string;
  config: HookConfig;
}

// ============================================================================
// Hook Manager Class
// ============================================================================

/**
 * HookManager - Quản lý tất cả hooks trong ứng dụng
 */
export class HookManager {
  /** Session hooks - in-memory, temporary */
  private sessionHooks: SessionHooks = {};

  /** Plugin hooks đã load */
  private pluginHooks: PluginHooksWithMetadata[] = [];

  /** Flag để track plugin hooks đã load chưa */
  private pluginHooksLoaded = false;

  /** Project directory hiện tại */
  private projectDir: string;

  /** Cached merged config */
  private cachedConfig: HookConfig | undefined;

  /** Flag để track config đã cache chưa */
  private configCached = false;

  constructor(projectDir: string) {
    this.projectDir = projectDir;
  }

  // ==========================================================================
  // Load Methods - Load hooks từ các nguồn
  // ==========================================================================

  /**
   * Load plugin hooks từ ~/.claude/plugins/
   * Chỉ load một lần, sau đó dùng cache
   */
  async loadPluginHooks(): Promise<void> {
    if (this.pluginHooksLoaded) {
      return;
    }

    const pluginsDir = getPluginsDirectory();
    if (!existsSync(pluginsDir)) {
      this.pluginHooksLoaded = true;
      return;
    }

    try {
      const entries = readdirSync(pluginsDir, { withFileTypes: true });

      for (const entry of entries) {
        if (!entry.isDirectory()) {
          continue;
        }

        const pluginPath = join(pluginsDir, entry.name);
        const result = loadPluginHooks(pluginPath);

        if (result) {
          this.pluginHooks.push(result);
        }
      }
    } catch (error) {
      console.error('Lỗi khi load plugin hooks:', error);
    }

    this.pluginHooksLoaded = true;
  }

  /**
   * Load và merge tất cả hooks
   * @param forceReload - Force reload bỏ qua cache
   */
  async loadAllHooks(forceReload = false): Promise<HookConfig | undefined> {
    // Check cache
    if (this.configCached && !forceReload) {
      return this.cachedConfig;
    }

    // Check if all hooks disabled
    if (isAllHooksDisabled()) {
      this.configCached = true;
      this.cachedConfig = undefined;
      return undefined;
    }

    // Check if only managed hooks allowed
    const managedOnly = isManagedHooksOnly();

    let mergedConfig: HookConfig | undefined;

    // Load user hooks (skip if managedOnly)
    if (!managedOnly) {
      const userHooks = loadUserHooks();
      mergedConfig = mergeHookConfigs(mergedConfig, userHooks);
    }

    // Load project hooks (skip if managedOnly)
    if (!managedOnly) {
      const projectHooks = loadProjectHooks(this.projectDir);
      mergedConfig = mergeHookConfigs(mergedConfig, projectHooks);
    }

    // Load local hooks (skip if managedOnly)
    if (!managedOnly) {
      const localHooks = loadLocalHooks(this.projectDir);
      mergedConfig = mergeHookConfigs(mergedConfig, localHooks);
    }

    // Load plugin hooks (skip if managedOnly)
    if (!managedOnly) {
      await this.loadPluginHooks();
      for (const plugin of this.pluginHooks) {
        mergedConfig = mergeHookConfigs(mergedConfig, plugin.config);
      }
    }

    this.configCached = true;
    this.cachedConfig = mergedConfig;

    return mergedConfig;
  }

  /**
   * Clear cache để force reload lần sau
   */
  clearCache(): void {
    this.configCached = false;
    this.cachedConfig = undefined;
  }

  // ==========================================================================
  // Session Hook Methods - Quản lý session hooks
  // ==========================================================================

  /**
   * Add session hook cho một agent
   * Session hooks là temporary và được clear khi session end
   */
  addSessionHook(
    agentId: string,
    eventType: HookEventType,
    hook: ExtendedHookDefinition,
    options: {
      matcher?: string;
      onHookSuccess?: (hook: ExtendedHookDefinition, result: unknown) => void;
    } = {}
  ): void {
    if (!this.sessionHooks[agentId]) {
      this.sessionHooks[agentId] = {};
    }

    if (!this.sessionHooks[agentId][eventType]) {
      this.sessionHooks[agentId][eventType] = [];
    }

    this.sessionHooks[agentId][eventType].push({
      matcher: options.matcher,
      hooks: [hook],
      onHookSuccess: options.onHookSuccess,
    });
  }

  /**
   * Remove session hooks cho một agent
   */
  removeSessionHooks(agentId: string): void {
    delete this.sessionHooks[agentId];
  }

  /**
   * Clear tất cả session hooks
   */
  clearAllSessionHooks(): void {
    this.sessionHooks = {};
  }

  /**
   * Get session hooks cho một agent và event type
   */
  getSessionHooks(
    agentId: string,
    eventType: HookEventType
  ): Array<{
    matcher?: string;
    hooks: ExtendedHookDefinition[];
    onHookSuccess?: (hook: ExtendedHookDefinition, result: unknown) => void;
  }> {
    return this.sessionHooks[agentId]?.[eventType] || [];
  }

  // ==========================================================================
  // Matching Methods - Match hooks với events
  // ==========================================================================

  /**
   * Match một pattern với một query string
   * Supports glob patterns và exact match
   */
  private matchPattern(pattern: string | undefined, query: string | undefined): boolean {
    // Không có pattern = match everything
    if (!pattern) {
      return true;
    }

    // Không có query = chỉ match nếu pattern là wildcard
    if (!query) {
      return pattern === '*';
    }

    // Exact match
    if (pattern === query) {
      return true;
    }

    // Wildcard match
    if (pattern === '*') {
      return true;
    }

    // Glob pattern match (đơn giản hóa)
    // Pattern "Read*" matches "ReadFile", "ReadDir", etc.
    if (pattern.includes('*')) {
      const regex = new RegExp('^' + pattern.replace(/\*/g, '.*') + '$');
      return regex.test(query);
    }

    return false;
  }

  /**
   * Get matching hooks cho một event
   * @param appState - Application state (optional)
   * @param agentId - Agent ID
   * @param eventType - Event type
   * @param input - Hook input
   */
  async getMatchingHooks(
    appState: unknown,
    agentId: string,
    eventType: HookEventType,
    input: HookInput
  ): Promise<MatchedHook[]> {
    const matchQuery = getMatchQueryFromInput(input);
    const allMatched: MatchedHook[] = [];

    // Load hooks từ config
    const config = await this.loadAllHooks();
    if (config && config[eventType]) {
      const matchers = config[eventType] || [];

      for (const matcher of matchers) {
        if (this.matchPattern(matcher.matcher, matchQuery)) {
          for (const hook of matcher.hooks) {
            allMatched.push({
              hook,
              pluginRoot: undefined,
              skillRoot: undefined,
            });
          }
        }
      }
    }

    // Add plugin hooks với pluginRoot
    for (const plugin of this.pluginHooks) {
      const pluginConfig = plugin.config;
      if (pluginConfig && pluginConfig[eventType]) {
        const matchers = pluginConfig[eventType] || [];

        for (const matcher of matchers) {
          if (this.matchPattern(matcher.matcher, matchQuery)) {
            for (const hook of matcher.hooks) {
              allMatched.push({
                hook,
                pluginRoot: plugin.pluginRoot,
                skillRoot: undefined,
              });
            }
          }
        }
      }
    }

    // Add session hooks
    const sessionHooks = this.getSessionHooks(agentId, eventType);
    for (const entry of sessionHooks) {
      if (this.matchPattern(entry.matcher, matchQuery)) {
        for (const hook of entry.hooks) {
          allMatched.push({
            hook,
            pluginRoot: undefined,
            skillRoot: undefined,
          });
        }
      }
    }

    // Dedup hooks
    return this.deduplicateHooks(allMatched);
  }

  /**
   * Dedup hooks để tránh chạy duplicate
   * Dựa trên command/prompt string
   */
  private deduplicateHooks(hooks: MatchedHook[]): MatchedHook[] {
    const seen = new Map<string, MatchedHook>();

    // Separate hooks theo type để dedup riêng
    const commandHooks: MatchedHook[] = [];
    const promptHooks: MatchedHook[] = [];
    const agentHooks: MatchedHook[] = [];
    const callbackHooks: MatchedHook[] = [];
    const functionHooks: MatchedHook[] = [];

    for (const matched of hooks) {
      const { hook } = matched;

      if (isCommandHook(hook)) {
        // Dedup command hooks by command string
        const key = `command:${hook.command}`;
        if (!seen.has(key)) {
          seen.set(key, matched);
          commandHooks.push(matched);
        }
      } else if (isPromptHook(hook)) {
        // Dedup prompt hooks by prompt string
        const key = `prompt:${hook.prompt}`;
        if (!seen.has(key)) {
          seen.set(key, matched);
          promptHooks.push(matched);
        }
      } else if (isAgentHook(hook)) {
        // Dedup agent hooks by prompt output
        const promptResult = typeof hook.prompt === 'function' ? hook.prompt([]) : String(hook.prompt);
        const key = `agent:${promptResult}`;
        if (!seen.has(key)) {
          seen.set(key, matched);
          agentHooks.push(matched);
        }
      } else if (hook.type === 'callback') {
        // Callback hooks không dedup (mỗi callback là unique)
        callbackHooks.push(matched);
      } else if (hook.type === 'function') {
        // Function hooks không dedup
        functionHooks.push(matched);
      }
    }

    // Return theo thứ tự: command, prompt, agent, callback, function
    return [...commandHooks, ...promptHooks, ...agentHooks, ...callbackHooks, ...functionHooks];
  }

  // ==========================================================================
  // Utility Methods
  // ==========================================================================

  /**
   * Get số lượng hooks đã load
   */
  getHookCount(): { total: number; plugins: number; session: number } {
    let total = 0;
    let plugins = 0;
    let session = 0;

    // Count config hooks
    if (this.cachedConfig) {
      for (const eventType of Object.keys(this.cachedConfig)) {
        const matchers = this.cachedConfig[eventType as HookEventType] || [];
        for (const matcher of matchers) {
          total += matcher.hooks.length;
        }
      }
    }

    // Count plugin hooks
    for (const plugin of this.pluginHooks) {
      for (const eventType of Object.keys(plugin.config)) {
        const matchers = plugin.config[eventType as HookEventType] || [];
        for (const matcher of matchers) {
          plugins += matcher.hooks.length;
        }
      }
    }

    // Count session hooks
    for (const agentId of Object.keys(this.sessionHooks)) {
      for (const eventType of Object.keys(this.sessionHooks[agentId])) {
        const entries = this.sessionHooks[agentId][eventType];
        for (const entry of entries) {
          session += entry.hooks.length;
        }
      }
    }

    total += plugins + session;

    return { total, plugins, session };
  }

  /**
   * Check nếu có hooks cho một event type
   */
  hasHooksForEvent(eventType: HookEventType): boolean {
    // Check cached config
    if (this.cachedConfig?.[eventType]?.length) {
      return true;
    }

    // Check plugin hooks
    for (const plugin of this.pluginHooks) {
      if (plugin.config[eventType]?.length) {
        return true;
      }
    }

    // Check session hooks (tất cả agents)
    for (const agentId of Object.keys(this.sessionHooks)) {
      if (this.sessionHooks[agentId][eventType]?.length) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get danh sách event types có hooks
   */
  getActiveEventTypes(): HookEventType[] {
    const active: Set<HookEventType> = new Set();

    // From cached config
    if (this.cachedConfig) {
      for (const eventType of Object.keys(this.cachedConfig) as HookEventType[]) {
        if (this.cachedConfig[eventType]?.length) {
          active.add(eventType);
        }
      }
    }

    // From plugin hooks
    for (const plugin of this.pluginHooks) {
      for (const eventType of Object.keys(plugin.config) as HookEventType[]) {
        if (plugin.config[eventType]?.length) {
          active.add(eventType);
        }
      }
    }

    // From session hooks
    for (const agentId of Object.keys(this.sessionHooks)) {
      for (const eventType of Object.keys(this.sessionHooks[agentId]) as HookEventType[]) {
        if (this.sessionHooks[agentId][eventType]?.length) {
          active.add(eventType);
        }
      }
    }

    return Array.from(active);
  }

  /**
   * Reset manager state
   */
  reset(): void {
    this.clearCache();
    this.clearAllSessionHooks();
    this.pluginHooks = [];
    this.pluginHooksLoaded = false;
  }
}

// ============================================================================
// Singleton Instance - Global instance
// ============================================================================

let globalManager: HookManager | null = null;

/**
 * Get hoặc create global HookManager instance
 */
export function getHookManager(projectDir?: string): HookManager {
  if (!globalManager && projectDir) {
    globalManager = new HookManager(projectDir);
  }

  if (!globalManager) {
    throw new Error('HookManager chưa được khởi tạo. Cần gọi với projectDir lần đầu.');
  }

  return globalManager;
}

/**
 * Reset global HookManager
 */
export function resetHookManager(): void {
  if (globalManager) {
    globalManager.reset();
    globalManager = null;
  }
}
