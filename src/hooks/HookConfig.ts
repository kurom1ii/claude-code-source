/**
 * Claude Code - Hook Config
 *
 * Load va parse hook configuration tu nhieu nguon:
 * - User settings (~/.claude/settings.json)
 * - Project settings (.claude/settings.json)
 * - Local settings (.claude/settings.local.json)
 * - Plugin hooks (~/.claude/plugins/[star]/hooks/hooks.json)
 */

import { homedir } from 'os';
import { join, dirname } from 'path';
import { existsSync, readFileSync, realpathSync } from 'fs';
import type { HookConfig, HookMatcher, HookEventType, ExtendedHookDefinition } from './types';
import { HookConfigSchema, HookEventTypes } from './types';

// ============================================================================
// Constants - Đường dẫn và hằng số
// ============================================================================

/** Thư mục config của Claude */
const CLAUDE_CONFIG_DIR = join(homedir(), '.claude');

/** File settings của user */
const USER_SETTINGS_PATH = join(CLAUDE_CONFIG_DIR, 'settings.json');

/** Thư mục plugins */
const PLUGINS_DIR = join(CLAUDE_CONFIG_DIR, 'plugins');

/** Tên file hooks config trong plugins */
const HOOKS_CONFIG_FILENAME = 'hooks.json';

// ============================================================================
// Settings Interface - Interface cho settings files
// ============================================================================

/**
 * Interface cho settings file (chỉ phần hooks)
 */
interface SettingsFile {
  hooks?: HookConfig;
  disableAllHooks?: boolean;
  allowManagedHooksOnly?: boolean;
  [key: string]: unknown;
}

// ============================================================================
// Load Functions - Load hooks từ các nguồn khác nhau
// ============================================================================

/**
 * Load và parse JSON file an toàn
 */
function loadJsonFile<T>(filePath: string): T | null {
  try {
    if (!existsSync(filePath)) {
      return null;
    }
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  } catch (error) {
    console.error(`Lỗi khi load file ${filePath}:`, error);
    return null;
  }
}

/**
 * Load hooks từ settings file
 * @param filePath - Đường dẫn tới settings file
 * @returns HookConfig hoặc undefined nếu không có hooks
 */
export function loadHooksFromSettingsFile(filePath: string): HookConfig | undefined {
  const settings = loadJsonFile<SettingsFile>(filePath);
  if (!settings?.hooks) {
    return undefined;
  }

  // Validate hooks schema
  const result = HookConfigSchema.safeParse(settings.hooks);
  if (!result.success) {
    console.error(`Invalid hooks trong ${filePath}:`, result.error.message);
    return undefined;
  }

  return result.data;
}

/**
 * Load hooks từ hooks.json file (plugin format)
 * @param filePath - Đường dẫn tới hooks.json
 * @param pluginName - Tên plugin (để log errors)
 * @returns HookConfig hoặc undefined nếu lỗi
 */
export function loadHooksFromHooksFile(filePath: string, pluginName?: string): HookConfig | undefined {
  const hooksData = loadJsonFile<HookConfig>(filePath);
  if (!hooksData) {
    return undefined;
  }

  // Validate hooks schema
  const result = HookConfigSchema.safeParse(hooksData);
  if (!result.success) {
    const name = pluginName || filePath;
    console.error(`Invalid hooks trong ${name}:`, result.error.message);
    return undefined;
  }

  return result.data;
}

/**
 * Load user hooks từ ~/.claude/settings.json
 */
export function loadUserHooks(): HookConfig | undefined {
  return loadHooksFromSettingsFile(USER_SETTINGS_PATH);
}

/**
 * Load project hooks từ .claude/settings.json
 * @param projectDir - Thư mục project
 */
export function loadProjectHooks(projectDir: string): HookConfig | undefined {
  const projectSettingsPath = join(projectDir, '.claude', 'settings.json');
  return loadHooksFromSettingsFile(projectSettingsPath);
}

/**
 * Load local hooks từ .claude/settings.local.json
 * @param projectDir - Thư mục project
 */
export function loadLocalHooks(projectDir: string): HookConfig | undefined {
  const localSettingsPath = join(projectDir, '.claude', 'settings.local.json');
  return loadHooksFromSettingsFile(localSettingsPath);
}

// ============================================================================
// Merge Functions - Merge hooks từ nhiều nguồn
// ============================================================================

/**
 * Merge hai HookConfig objects
 * Hooks từ source2 được append vào source1
 */
export function mergeHookConfigs(
  source1: HookConfig | undefined,
  source2: HookConfig | undefined
): HookConfig | undefined {
  if (!source1 && !source2) {
    return undefined;
  }
  if (!source1) {
    return source2;
  }
  if (!source2) {
    return source1;
  }

  const merged: HookConfig = {};

  // Collect all event types tu ca hai sources
  const allEventTypes = new Set<HookEventType>([
    ...(Object.keys(source1) as HookEventType[]),
    ...(Object.keys(source2) as HookEventType[]),
  ]);

  for (const eventType of Array.from(allEventTypes)) {
    const matchers1 = source1[eventType] || [];
    const matchers2 = source2[eventType] || [];

    if (matchers1.length > 0 || matchers2.length > 0) {
      merged[eventType] = [...matchers1, ...matchers2];
    }
  }

  return Object.keys(merged).length > 0 ? merged : undefined;
}

/**
 * Load và merge hooks từ tất cả nguồn
 * @param projectDir - Thư mục project
 * @param options - Options cho loading
 */
export function loadAllHooks(
  projectDir: string,
  options: {
    /** Bỏ qua user hooks */
    skipUserHooks?: boolean;
    /** Bỏ qua project hooks */
    skipProjectHooks?: boolean;
    /** Bỏ qua local hooks */
    skipLocalHooks?: boolean;
    /** Bỏ qua plugin hooks */
    skipPluginHooks?: boolean;
  } = {}
): HookConfig | undefined {
  let mergedConfig: HookConfig | undefined;

  // Load user hooks
  if (!options.skipUserHooks) {
    const userHooks = loadUserHooks();
    mergedConfig = mergeHookConfigs(mergedConfig, userHooks);
  }

  // Load project hooks
  if (!options.skipProjectHooks) {
    const projectHooks = loadProjectHooks(projectDir);
    mergedConfig = mergeHookConfigs(mergedConfig, projectHooks);
  }

  // Load local hooks
  if (!options.skipLocalHooks) {
    const localHooks = loadLocalHooks(projectDir);
    mergedConfig = mergeHookConfigs(mergedConfig, localHooks);
  }

  // Plugin hooks được load riêng bởi HookManager
  // vì cần track plugin root path

  return mergedConfig;
}

// ============================================================================
// Plugin Hooks - Load hooks từ plugins
// ============================================================================

/**
 * Kết quả load plugin hooks
 */
export interface PluginHooksResult {
  /** Tên plugin */
  pluginName: string;
  /** Đường dẫn plugin root */
  pluginRoot: string;
  /** Hook config */
  config: HookConfig;
}

/**
 * Load hooks từ một plugin directory
 * @param pluginPath - Đường dẫn tới plugin directory
 * @returns Plugin hooks result hoặc null nếu không có hooks
 */
export function loadPluginHooks(pluginPath: string): PluginHooksResult | null {
  const hooksJsonPath = join(pluginPath, 'hooks', HOOKS_CONFIG_FILENAME);

  if (!existsSync(hooksJsonPath)) {
    return null;
  }

  // Đọc plugin manifest để lấy tên
  const manifestPath = join(pluginPath, '.claude-plugin', 'plugin.json');
  let pluginName = dirname(pluginPath).split('/').pop() || 'unknown';

  if (existsSync(manifestPath)) {
    try {
      const manifest = loadJsonFile<{ name?: string }>(manifestPath);
      if (manifest?.name) {
        pluginName = manifest.name;
      }
    } catch {
      // Ignore manifest errors
    }
  }

  const config = loadHooksFromHooksFile(hooksJsonPath, pluginName);
  if (!config) {
    return null;
  }

  return {
    pluginName,
    pluginRoot: pluginPath,
    config,
  };
}

// ============================================================================
// Validation Functions - Kiểm tra tính hợp lệ
// ============================================================================

/**
 * Validate hook config
 */
export function validateHookConfig(config: unknown): {
  valid: boolean;
  errors?: string[];
  data?: HookConfig;
} {
  const result = HookConfigSchema.safeParse(config);

  if (result.success) {
    return {
      valid: true,
      data: result.data,
    };
  }

  return {
    valid: false,
    errors: result.error.errors.map((e) => `${e.path.join('.')}: ${e.message}`),
  };
}

/**
 * Kiểm tra event type có hợp lệ không
 */
export function isValidEventType(eventType: string): eventType is HookEventType {
  return HookEventTypes.includes(eventType as HookEventType);
}

// ============================================================================
// Settings Helpers - Helpers cho settings
// ============================================================================

/**
 * Kiểm tra disableAllHooks setting
 */
export function isAllHooksDisabled(settingsPath?: string): boolean {
  const path = settingsPath || USER_SETTINGS_PATH;
  const settings = loadJsonFile<SettingsFile>(path);
  return settings?.disableAllHooks === true;
}

/**
 * Kiểm tra allowManagedHooksOnly setting
 */
export function isManagedHooksOnly(settingsPath?: string): boolean {
  const path = settingsPath || USER_SETTINGS_PATH;
  const settings = loadJsonFile<SettingsFile>(path);
  return settings?.allowManagedHooksOnly === true;
}

// ============================================================================
// Path Helpers - Helpers cho đường dẫn
// ============================================================================

/**
 * Lấy đường dẫn tuyệt đối của file
 * @param filePath - Đường dẫn file (có thể relative)
 * @returns Đường dẫn tuyệt đối
 */
export function getAbsolutePath(filePath: string): string {
  try {
    if (existsSync(filePath)) {
      return realpathSync(filePath);
    }
  } catch {
    // Ignore errors
  }
  return filePath;
}

/**
 * Lấy đường dẫn user settings
 */
export function getUserSettingsPath(): string {
  return USER_SETTINGS_PATH;
}

/**
 * Lấy đường dẫn project settings
 */
export function getProjectSettingsPath(projectDir: string): string {
  return join(projectDir, '.claude', 'settings.json');
}

/**
 * Lấy đường dẫn local settings
 */
export function getLocalSettingsPath(projectDir: string): string {
  return join(projectDir, '.claude', 'settings.local.json');
}

/**
 * Lấy đường dẫn plugins directory
 */
export function getPluginsDirectory(): string {
  return PLUGINS_DIR;
}

/**
 * Lấy đường dẫn Claude config directory
 */
export function getClaudeConfigDirectory(): string {
  return CLAUDE_CONFIG_DIR;
}

// ============================================================================
// Env File Helpers - Helpers cho environment file
// ============================================================================

/**
 * Tạo env file path cho SessionStart/Setup hooks
 * Env file chứa các environment variables từ hook
 */
export function createEnvFilePath(eventType: 'SessionStart' | 'Setup', hookIndex: number): string {
  const timestamp = Date.now();
  return join(CLAUDE_CONFIG_DIR, 'tmp', `${eventType.toLowerCase()}_${hookIndex}_${timestamp}.env`);
}
