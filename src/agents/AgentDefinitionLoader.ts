/**
 * AgentDefinitionLoader - Tải và quản lý agent definitions
 *
 * Module này cung cấp:
 * - Tải agent definitions từ các nguồn khác nhau
 * - Merge và override definitions
 * - Validate definitions
 * - Path utilities cho agent files
 */

import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname, basename } from 'path';
import {
  AgentDefinition,
  AgentSource,
  AgentType,
} from './types';

// ============================================================================
// Constants - Hằng số
// ============================================================================

/** Tên thư mục Claude */
const CLAUDE_FOLDER_NAME = '.claude';

/** Tên thư mục agents */
const AGENTS_DIR = 'agents';

/** Extension cho agent files */
const AGENT_FILE_EXT = '.md';

// ============================================================================
// Path Utilities - Các hàm xử lý đường dẫn
// ============================================================================

/**
 * Lấy home directory
 * @returns Đường dẫn home directory
 */
function getHomeDir(): string {
  return process.env.HOME || process.env.USERPROFILE || '';
}

/**
 * Lấy current working directory
 * @returns Đường dẫn cwd
 */
function getCwd(): string {
  return process.cwd();
}

/**
 * Lấy đường dẫn thư mục agents theo source
 * @param source - Agent source
 * @returns Đường dẫn thư mục
 */
export function getAgentsDirectory(source: AgentSource): string {
  switch (source) {
    case 'built-in':
      throw new Error('Cannot get directory path for built-in agents');

    case 'plugin':
      throw new Error('Cannot get directory path for plugin agents');

    case 'flagSettings':
      throw new Error('Cannot get directory path for flagSettings agents');

    case 'userSettings':
      return join(getHomeDir(), CLAUDE_FOLDER_NAME, AGENTS_DIR);

    case 'projectSettings':
      return join(getCwd(), CLAUDE_FOLDER_NAME, AGENTS_DIR);

    case 'policySettings':
      // Policy settings thường ở vị trí riêng
      return join(getHomeDir(), CLAUDE_FOLDER_NAME, 'policy', AGENTS_DIR);

    case 'localSettings':
      return join(getCwd(), CLAUDE_FOLDER_NAME, AGENTS_DIR);

    default:
      throw new Error(`Unknown agent source: ${source}`);
  }
}

/**
 * Lấy đường dẫn tương đối cho thư mục agents
 * @param source - Agent source
 * @returns Đường dẫn tương đối
 */
export function getRelativeAgentsDirectory(source: AgentSource): string {
  switch (source) {
    case 'projectSettings':
      return join('.', CLAUDE_FOLDER_NAME, AGENTS_DIR);

    default:
      return getAgentsDirectory(source);
  }
}

/**
 * Lấy đường dẫn file của agent definition
 * @param definition - Agent definition
 * @returns Đường dẫn file
 */
export function getAgentFilePath(definition: AgentDefinition): string {
  if (definition.source === 'built-in') {
    return 'Built-in';
  }

  if (definition.source === 'plugin') {
    throw new Error('Cannot get file path for plugin agents');
  }

  const dir = getAgentsDirectory(definition.source);
  const filename = definition.filename || definition.agentType;
  return join(dir, `${filename}${AGENT_FILE_EXT}`);
}

/**
 * Lấy đường dẫn tương đối của agent file
 * @param definition - Agent definition
 * @returns Đường dẫn tương đối
 */
export function getRelativeAgentFilePath(definition: AgentDefinition): string {
  if (definition.source === 'built-in') {
    return 'Built-in';
  }

  const dir = getRelativeAgentsDirectory(definition.source);
  return join(dir, `${definition.agentType}${AGENT_FILE_EXT}`);
}

// ============================================================================
// Definition Loading - Tải definitions
// ============================================================================

/**
 * Parse nội dung file markdown agent
 * @param content - Nội dung file
 * @param source - Source của agent
 * @returns Partial AgentDefinition
 */
function parseAgentMarkdown(
  content: string,
  source: AgentSource
): Partial<AgentDefinition> {
  const result: Partial<AgentDefinition> = { source };

  // Parse frontmatter nếu có
  const frontmatterMatch = content.match(/^---\n([\s\S]*?)\n---/);
  if (frontmatterMatch) {
    const frontmatter = frontmatterMatch[1];

    // Parse model
    const modelMatch = frontmatter.match(/model:\s*(.+)/);
    if (modelMatch) {
      result.model = modelMatch[1].trim();
    }

    // Parse description
    const descMatch = frontmatter.match(/description:\s*(.+)/);
    if (descMatch) {
      result.description = descMatch[1].trim();
    }

    // Parse allowed tools
    const allowedMatch = frontmatter.match(/allowedTools:\s*\[(.*)\]/);
    if (allowedMatch) {
      result.allowedTools = allowedMatch[1]
        .split(',')
        .map((t) => t.trim().replace(/['"]/g, ''))
        .filter(Boolean);
    }

    // Parse disallowed tools
    const disallowedMatch = frontmatter.match(/disallowedTools:\s*\[(.*)\]/);
    if (disallowedMatch) {
      result.disallowedTools = disallowedMatch[1]
        .split(',')
        .map((t) => t.trim().replace(/['"]/g, ''))
        .filter(Boolean);
    }

    // Lấy phần còn lại làm system prompt
    const afterFrontmatter = content.substring(frontmatterMatch[0].length).trim();
    if (afterFrontmatter) {
      result.systemPrompt = afterFrontmatter;
    }
  } else {
    // Không có frontmatter, toàn bộ là system prompt
    result.systemPrompt = content.trim();
  }

  return result;
}

/**
 * Tải agent definition từ file
 * @param filePath - Đường dẫn file
 * @param source - Source của agent
 * @returns AgentDefinition hoặc null
 */
export function loadAgentFromFile(
  filePath: string,
  source: AgentSource
): AgentDefinition | null {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    const parsed = parseAgentMarkdown(content, source);

    // Lấy agentType từ tên file
    const filename = basename(filePath, AGENT_FILE_EXT);
    const dir = dirname(filePath);

    const definition: AgentDefinition = {
      agentType: filename,
      source,
      filename,
      baseDir: dir,
      ...parsed,
    };

    return definition;
  } catch (error) {
    console.error(`Failed to load agent from ${filePath}:`, error);
    return null;
  }
}

/**
 * Tải tất cả agents từ một directory
 * @param dirPath - Đường dẫn thư mục
 * @param source - Source của agents
 * @returns Mảng AgentDefinition
 */
export function loadAgentsFromDirectory(
  dirPath: string,
  source: AgentSource
): AgentDefinition[] {
  if (!existsSync(dirPath)) {
    return [];
  }

  const definitions: AgentDefinition[] = [];

  try {
    const entries = readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith(AGENT_FILE_EXT)) {
        const filePath = join(dirPath, entry.name);
        const definition = loadAgentFromFile(filePath, source);
        if (definition) {
          definitions.push(definition);
        }
      }
    }
  } catch (error) {
    console.error(`Failed to load agents from ${dirPath}:`, error);
  }

  return definitions;
}

/**
 * Tải agents từ user settings (~/.claude/agents/)
 * @returns Mảng AgentDefinition
 */
export function loadUserAgents(): AgentDefinition[] {
  const dir = getAgentsDirectory('userSettings');
  return loadAgentsFromDirectory(dir, 'userSettings');
}

/**
 * Tải agents từ project settings (.claude/agents/)
 * @returns Mảng AgentDefinition
 */
export function loadProjectAgents(): AgentDefinition[] {
  const dir = getAgentsDirectory('projectSettings');
  return loadAgentsFromDirectory(dir, 'projectSettings');
}

// ============================================================================
// Built-in Agents - Agents tích hợp sẵn
// ============================================================================

/**
 * Lấy danh sách built-in agents
 * @returns Mảng AgentDefinition
 */
export function getBuiltInAgents(): AgentDefinition[] {
  return [
    {
      agentType: 'Plan',
      source: 'built-in',
      description: 'Agent chuyên lập kế hoạch và phân tích task',
      model: 'claude-opus-4-5-20251101',
      systemPrompt: `You are a planning agent. Your job is to:
1. Analyze the task requirements
2. Break down complex tasks into steps
3. Create a structured plan
4. Identify potential issues and dependencies

Always think step by step and be thorough in your analysis.`,
    },
    {
      agentType: 'Explore',
      source: 'built-in',
      description: 'Agent chuyên khám phá và tìm hiểu codebase',
      model: 'claude-sonnet-4-5-20250929',
      systemPrompt: `You are an exploration agent. Your job is to:
1. Search and navigate codebases
2. Find relevant files and code patterns
3. Understand code structure and architecture
4. Report findings clearly

Use search tools effectively and be thorough in your exploration.`,
    },
  ];
}

// ============================================================================
// Definition Merging - Gộp definitions
// ============================================================================

/**
 * Kiểm tra một definition có phải built-in không
 * @param definition - Definition cần kiểm tra
 * @returns true nếu là built-in
 */
export function isBuiltIn(definition: AgentDefinition): boolean {
  return definition.source === 'built-in';
}

/**
 * Kiểm tra một definition có phải plugin không
 * @param definition - Definition cần kiểm tra
 * @returns true nếu là plugin
 */
export function isPlugin(definition: AgentDefinition): boolean {
  return definition.source === 'plugin';
}

/**
 * Kiểm tra một definition có thể edit được không
 * @param definition - Definition cần kiểm tra
 * @returns true nếu editable
 */
export function isEditable(definition: AgentDefinition): boolean {
  return !isBuiltIn(definition) && !isPlugin(definition);
}

/**
 * Thứ tự ưu tiên của sources (càng cao càng ưu tiên)
 */
const SOURCE_PRIORITY: Record<AgentSource, number> = {
  'built-in': 0,
  plugin: 1,
  userSettings: 2,
  projectSettings: 3,
  flagSettings: 4,
  policySettings: 5,
  localSettings: 3, // Cùng priority với projectSettings
};

/**
 * Merge danh sách definitions, loại bỏ duplicates
 * Definitions với source priority cao hơn sẽ override
 * @param definitions - Mảng tất cả definitions
 * @returns Mảng definitions đã merge
 */
export function mergeAgentDefinitions(
  definitions: AgentDefinition[]
): AgentDefinition[] {
  // Tách theo source
  const bySource: Record<string, AgentDefinition[]> = {
    'built-in': [],
    plugin: [],
    userSettings: [],
    projectSettings: [],
    flagSettings: [],
    policySettings: [],
    localSettings: [],
  };

  for (const def of definitions) {
    bySource[def.source]?.push(def);
  }

  // Sắp xếp theo priority và merge
  const sourceOrder: AgentSource[] = [
    'built-in',
    'plugin',
    'userSettings',
    'projectSettings',
    'flagSettings',
    'policySettings',
  ];

  const merged = new Map<AgentType, AgentDefinition>();

  for (const source of sourceOrder) {
    for (const def of bySource[source] || []) {
      merged.set(def.agentType, def);
    }
  }

  return Array.from(merged.values());
}

/**
 * Tìm definition theo agentType
 * @param definitions - Mảng definitions
 * @param agentType - Loại agent cần tìm
 * @returns Definition hoặc undefined
 */
export function findDefinition(
  definitions: AgentDefinition[],
  agentType: AgentType
): AgentDefinition | undefined {
  return definitions.find((d) => d.agentType === agentType);
}

/**
 * Kiểm tra một definition có bị override bởi definition khác không
 * @param definition - Definition cần kiểm tra
 * @param allDefinitions - Tất cả definitions
 * @returns { isOverridden, overriddenBy }
 */
export function checkOverride(
  definition: AgentDefinition,
  allDefinitions: AgentDefinition[]
): { isOverridden: boolean; overriddenBy?: string } {
  const priority = SOURCE_PRIORITY[definition.source];

  for (const other of allDefinitions) {
    if (
      other.agentType === definition.agentType &&
      other.source !== definition.source &&
      SOURCE_PRIORITY[other.source] > priority
    ) {
      return {
        isOverridden: true,
        overriddenBy: other.source,
      };
    }
  }

  return { isOverridden: false };
}

// ============================================================================
// Validation - Kiểm tra hợp lệ
// ============================================================================

/**
 * Validate agent type name
 * @param agentType - Tên cần validate
 * @returns Lỗi string hoặc null nếu hợp lệ
 */
export function validateAgentType(agentType: string): string | null {
  if (!agentType || agentType.trim().length === 0) {
    return 'Agent type is required';
  }

  // Kiểm tra ký tự hợp lệ (alphanumeric, dash, underscore)
  if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(agentType)) {
    return 'Agent type must start with a letter and contain only letters, numbers, dashes, and underscores';
  }

  // Kiểm tra độ dài
  if (agentType.length > 50) {
    return 'Agent type must be 50 characters or less';
  }

  // Kiểm tra reserved names
  const reserved = ['system', 'user', 'assistant', 'tool', 'claude'];
  if (reserved.includes(agentType.toLowerCase())) {
    return `"${agentType}" is a reserved name`;
  }

  return null;
}

/**
 * Validate agent definition
 * @param definition - Definition cần validate
 * @returns Mảng lỗi (rỗng nếu hợp lệ)
 */
export function validateDefinition(definition: Partial<AgentDefinition>): string[] {
  const errors: string[] = [];

  // Validate agentType
  if (!definition.agentType) {
    errors.push('agentType is required');
  } else {
    const typeError = validateAgentType(definition.agentType);
    if (typeError) {
      errors.push(typeError);
    }
  }

  // Validate source
  if (!definition.source) {
    errors.push('source is required');
  }

  // Validate system prompt (warning, not error)
  if (!definition.systemPrompt || definition.systemPrompt.trim().length < 10) {
    // Đây chỉ là warning, không block
  }

  return errors;
}

// ============================================================================
// All-in-one Loader
// ============================================================================

/**
 * Tải tất cả agents từ mọi nguồn
 * @param includeBuiltIn - Có bao gồm built-in không (default: true)
 * @returns Mảng AgentDefinition đã merge
 */
export function loadAllAgents(includeBuiltIn: boolean = true): AgentDefinition[] {
  const definitions: AgentDefinition[] = [];

  // Built-in agents
  if (includeBuiltIn) {
    definitions.push(...getBuiltInAgents());
  }

  // User agents
  definitions.push(...loadUserAgents());

  // Project agents
  definitions.push(...loadProjectAgents());

  // Merge và trả về
  return mergeAgentDefinitions(definitions);
}

// ============================================================================
// Display Helpers - Hỗ trợ hiển thị
// ============================================================================

/**
 * Lấy tên hiển thị cho source
 * @param source - Agent source
 * @returns Tên hiển thị
 */
export function getSourceDisplayName(source: AgentSource | 'all'): string {
  switch (source) {
    case 'all':
      return 'Agents';
    case 'built-in':
      return 'Built-in agents';
    case 'plugin':
      return 'Plugin agents';
    case 'userSettings':
      return 'User agents';
    case 'projectSettings':
      return 'Project agents';
    case 'policySettings':
      return 'Managed agents';
    case 'flagSettings':
      return 'CLI arg agents';
    case 'localSettings':
      return 'Local agents';
    default:
      return source;
  }
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Path utilities
  getAgentsDirectory,
  getRelativeAgentsDirectory,
  getAgentFilePath,
  getRelativeAgentFilePath,

  // Loading
  loadAgentFromFile,
  loadAgentsFromDirectory,
  loadUserAgents,
  loadProjectAgents,
  getBuiltInAgents,
  loadAllAgents,

  // Merging
  mergeAgentDefinitions,
  findDefinition,
  checkOverride,

  // Validation
  validateAgentType,
  validateDefinition,

  // Helpers
  isBuiltIn,
  isPlugin,
  isEditable,
  getSourceDisplayName,
};
