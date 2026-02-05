/**
 * Claude Code API - Model Definitions
 * Định nghĩa các model Claude và configuration
 */

// ============================================================================
// Model ID Constants - Danh sách model ID chính thức
// ============================================================================

/**
 * Claude Opus models - Mạnh nhất, phù hợp cho reasoning phức tạp
 */
export const OPUS_MODELS = {
  OPUS_4_5: 'claude-opus-4-5-20251101',
  OPUS_4_1: 'claude-opus-4-1-20250805',
  OPUS_4: 'claude-opus-4-20250514',
  OPUS_3: 'claude-3-opus-20240229',
} as const;

/**
 * Claude Sonnet models - Cân bằng giữa tốc độ và chất lượng
 */
export const SONNET_MODELS = {
  SONNET_4_5: 'claude-sonnet-4-5-20250929',
  SONNET_4: 'claude-sonnet-4-20250514',
  SONNET_3_7: 'claude-3-7-sonnet-20250219',
  SONNET_3_5_OCT: 'claude-3-5-sonnet-20241022',
  SONNET_3_5_JUN: 'claude-3-5-sonnet-20240620',
} as const;

/**
 * Claude Haiku models - Nhanh nhất, phù hợp cho task đơn giản
 */
export const HAIKU_MODELS = {
  HAIKU_3_5: 'claude-3-5-haiku-20241022',
  HAIKU_3: 'claude-3-haiku-20240307',
} as const;

// ============================================================================
// Model Option Interface
// ============================================================================

export interface ModelOption {
  /** Model ID để gửi trong API request */
  value: string;
  /** Tên hiển thị ngắn gọn */
  label: string;
  /** Mô tả chi tiết */
  description: string;
  /** Thuộc họ model nào */
  family: 'opus' | 'sonnet' | 'haiku';
  /** Context window size (tokens) */
  contextWindow: number;
  /** Có hỗ trợ extended thinking không */
  supportsThinking: boolean;
  /** Có hỗ trợ vision (image input) không */
  supportsVision: boolean;
}

/**
 * Danh sách tất cả models có sẵn
 */
export const AVAILABLE_MODELS: ModelOption[] = [
  // Opus family
  {
    value: OPUS_MODELS.OPUS_4_5,
    label: 'Opus 4.5',
    description: 'Claude Opus 4.5 (November 2025) - Flagship model, best for complex reasoning',
    family: 'opus',
    contextWindow: 200000,
    supportsThinking: true,
    supportsVision: true,
  },
  {
    value: OPUS_MODELS.OPUS_4_1,
    label: 'Opus 4.1',
    description: 'Claude Opus 4.1 (August 2025)',
    family: 'opus',
    contextWindow: 200000,
    supportsThinking: true,
    supportsVision: true,
  },
  {
    value: OPUS_MODELS.OPUS_4,
    label: 'Opus 4',
    description: 'Claude Opus 4 (May 2025)',
    family: 'opus',
    contextWindow: 200000,
    supportsThinking: true,
    supportsVision: true,
  },
  {
    value: OPUS_MODELS.OPUS_3,
    label: 'Opus 3',
    description: 'Claude 3 Opus (February 2024)',
    family: 'opus',
    contextWindow: 200000,
    supportsThinking: false,
    supportsVision: true,
  },

  // Sonnet family
  {
    value: SONNET_MODELS.SONNET_4_5,
    label: 'Sonnet 4.5',
    description: 'Claude Sonnet 4.5 (September 2025) - Best balance of speed and quality',
    family: 'sonnet',
    contextWindow: 200000,
    supportsThinking: true,
    supportsVision: true,
  },
  {
    value: SONNET_MODELS.SONNET_4,
    label: 'Sonnet 4',
    description: 'Claude Sonnet 4 (May 2025)',
    family: 'sonnet',
    contextWindow: 200000,
    supportsThinking: true,
    supportsVision: true,
  },
  {
    value: SONNET_MODELS.SONNET_3_7,
    label: 'Sonnet 3.7',
    description: 'Claude 3.7 Sonnet (February 2025)',
    family: 'sonnet',
    contextWindow: 200000,
    supportsThinking: true,
    supportsVision: true,
  },
  {
    value: SONNET_MODELS.SONNET_3_5_OCT,
    label: 'Sonnet 3.5 (October)',
    description: 'Claude 3.5 Sonnet (October 2024)',
    family: 'sonnet',
    contextWindow: 200000,
    supportsThinking: false,
    supportsVision: true,
  },
  {
    value: SONNET_MODELS.SONNET_3_5_JUN,
    label: 'Sonnet 3.5 (June)',
    description: 'Claude 3.5 Sonnet (June 2024)',
    family: 'sonnet',
    contextWindow: 200000,
    supportsThinking: false,
    supportsVision: true,
  },

  // Haiku family
  {
    value: HAIKU_MODELS.HAIKU_3_5,
    label: 'Haiku 3.5',
    description: 'Claude 3.5 Haiku (October 2024) - Fastest model',
    family: 'haiku',
    contextWindow: 200000,
    supportsThinking: false,
    supportsVision: true,
  },
  {
    value: HAIKU_MODELS.HAIKU_3,
    label: 'Haiku 3',
    description: 'Claude 3 Haiku (March 2024)',
    family: 'haiku',
    contextWindow: 200000,
    supportsThinking: false,
    supportsVision: true,
  },
];

// ============================================================================
// Model Aliases - Tên tắt tiện lợi
// ============================================================================

/**
 * Các alias có thể sử dụng thay cho model ID đầy đủ
 */
export type ModelAlias =
  | 'opus'          // Latest Opus
  | 'sonnet'        // Latest Sonnet
  | 'haiku'         // Latest Haiku
  | 'sonnet[1m]'    // Sonnet với 1M context
  | 'opusplan'      // Opus cho planning, Sonnet cho execution
  | 'opusplan[1m]'; // Opusplan với 1M context Sonnet

export const MODEL_ALIASES: ModelAlias[] = [
  'opus',
  'sonnet',
  'haiku',
  'sonnet[1m]',
  'opusplan',
  'opusplan[1m]',
];

/**
 * Chuyển đổi alias thành model ID thực tế
 */
export function resolveModelAlias(aliasOrId: ModelAlias | string): string {
  switch (aliasOrId) {
    case 'opus':
      return OPUS_MODELS.OPUS_4_5;
    case 'sonnet':
      return SONNET_MODELS.SONNET_4;
    case 'haiku':
      return HAIKU_MODELS.HAIKU_3_5;
    case 'sonnet[1m]':
      return SONNET_MODELS.SONNET_4; // Cùng model, khác context config
    case 'opusplan':
      return OPUS_MODELS.OPUS_4_5;
    case 'opusplan[1m]':
      return OPUS_MODELS.OPUS_4_5;
    default:
      return aliasOrId;
  }
}

/**
 * Lấy label hiển thị cho model hoặc alias
 */
export function getModelLabel(modelOrAlias: string): string {
  // Kiểm tra special aliases trước
  switch (modelOrAlias) {
    case 'opusplan':
      return 'Opus Plan';
    case 'opusplan[1m]':
      return 'Opus Plan 1M';
    case 'sonnet[1m]':
      return 'Sonnet 1M';
  }

  // Tìm trong danh sách models
  const model = AVAILABLE_MODELS.find(m => m.value === modelOrAlias);
  return model?.label || modelOrAlias;
}

/**
 * Lấy mô tả chi tiết cho model hoặc alias
 */
export function getModelDescription(modelOrAlias: string): string {
  switch (modelOrAlias) {
    case 'opusplan':
      return 'Opus 4.5 in plan mode, else Sonnet 4.5';
    case 'opusplan[1m]':
      return 'Opus 4.5 in plan mode, else Sonnet 4.5 (1M context)';
    case 'sonnet[1m]':
      return 'Sonnet 4.5 with 1M context window';
  }

  const model = AVAILABLE_MODELS.find(m => m.value === modelOrAlias);
  return model?.description || '';
}

// ============================================================================
// Context Limits - Giới hạn context window
// ============================================================================

/**
 * Các giới hạn context có sẵn (tính bằng tokens)
 */
export const CONTEXT_LIMITS = {
  /** Default 200K context */
  DEFAULT: 200_000,
  /** 1 million tokens */
  ONE_MILLION: 1_000_000,
  /** 2 million tokens */
  TWO_MILLION: 2_000_000,
} as const;

/**
 * Lấy context limit cho model
 * Có thể override bằng biến môi trường CLAUDE_CODE_CONTEXT_LIMIT
 */
export function getContextLimit(modelId: string): number {
  // Kiểm tra environment variable override
  const envLimit = process.env.CLAUDE_CODE_CONTEXT_LIMIT;
  if (envLimit) {
    const parsed = parseInt(envLimit, 10);
    if (!isNaN(parsed) && parsed > 0) {
      return parsed;
    }
  }

  // Kiểm tra suffix [2m] cho 2M context
  if (modelId.includes('[2m]')) {
    return CONTEXT_LIMITS.TWO_MILLION;
  }

  // Kiểm tra suffix [1m] cho 1M context
  if (modelId.includes('[1m]')) {
    return CONTEXT_LIMITS.ONE_MILLION;
  }

  // Default 200K context
  return CONTEXT_LIMITS.DEFAULT;
}

// ============================================================================
// Model Selection for Modes - Chọn model theo chế độ
// ============================================================================

export type OperationMode = 'code' | 'plan';

/**
 * Lấy model phù hợp cho mode hiện tại khi sử dụng opusplan alias
 *
 * @param alias - Model alias đang sử dụng
 * @param mode - Chế độ hiện tại (code/plan)
 * @param exceedsContextLimit - Có vượt quá context limit không
 * @returns Model ID phù hợp
 */
export function getModelForMode(
  alias: string,
  mode: OperationMode,
  exceedsContextLimit: boolean = false
): string {
  // Opusplan: dùng Opus cho planning, Sonnet cho execution
  if ((alias === 'opusplan' || alias === 'opusplan[1m]') && mode === 'plan' && !exceedsContextLimit) {
    return OPUS_MODELS.OPUS_4_5;
  }

  // Opusplan[1m]: Sonnet với 1M context cho execution
  if (alias === 'opusplan[1m]') {
    return SONNET_MODELS.SONNET_4;
  }

  // Opusplan thường: Sonnet tiêu chuẩn cho execution
  if (alias === 'opusplan') {
    return SONNET_MODELS.SONNET_4;
  }

  // Các alias khác: resolve bình thường
  return resolveModelAlias(alias);
}

// ============================================================================
// Model Config - Cấu hình model đầy đủ
// ============================================================================

export interface ModelConfig {
  /** Model ID thực tế */
  modelId: string;
  /** Alias nếu đang sử dụng */
  alias?: ModelAlias;
  /** Context limit */
  contextLimit: number;
  /** Extended thinking có được bật không */
  thinkingEnabled?: boolean;
  /** Budget tokens cho thinking */
  thinkingBudget?: number;
}

/**
 * Tạo config đầy đủ cho model
 */
export function createModelConfig(modelId: string, alias?: ModelAlias): ModelConfig {
  const resolvedId = resolveModelAlias(modelId);
  const modelInfo = AVAILABLE_MODELS.find(m => m.value === resolvedId);

  return {
    modelId: resolvedId,
    alias,
    contextLimit: getContextLimit(modelId),
    thinkingEnabled: modelInfo?.supportsThinking ?? false,
  };
}

// ============================================================================
// Model Selector Options - Options cho UI model selector
// ============================================================================

export interface ModelSelectorOption {
  value: string;
  label: string;
  description: string;
}

/**
 * Lấy danh sách options cho model selector UI
 */
export function getModelSelectorOptions(currentModel: string | null): ModelSelectorOption[] {
  // Bắt đầu với danh sách models chuẩn
  const options: ModelSelectorOption[] = AVAILABLE_MODELS.map(m => ({
    value: m.value,
    label: m.label,
    description: m.description,
  }));

  // Thêm opusplan options
  options.push({
    value: 'opusplan',
    label: 'Opus Plan Mode',
    description: 'Use Opus 4.5 in plan mode, Sonnet 4.5 otherwise',
  });

  options.push({
    value: 'opusplan[1m]',
    label: 'Opus Plan Mode 1M',
    description: 'Use Opus 4.5 in plan mode, Sonnet 4.5 (1M context) otherwise',
  });

  // Nếu current model là custom không có trong list, thêm vào
  if (currentModel && !options.some(o => o.value === currentModel)) {
    options.push({
      value: currentModel,
      label: currentModel,
      description: 'Custom model',
    });
  }

  return options;
}

// ============================================================================
// Model Utilities - Các hàm tiện ích khác
// ============================================================================

/**
 * Kiểm tra model có hỗ trợ extended thinking không
 */
export function supportsExtendedThinking(modelId: string): boolean {
  const resolved = resolveModelAlias(modelId);
  const model = AVAILABLE_MODELS.find(m => m.value === resolved);
  return model?.supportsThinking ?? false;
}

/**
 * Kiểm tra model có hỗ trợ vision không
 */
export function supportsVision(modelId: string): boolean {
  const resolved = resolveModelAlias(modelId);
  const model = AVAILABLE_MODELS.find(m => m.value === resolved);
  return model?.supportsVision ?? false;
}

/**
 * Lấy model family (opus/sonnet/haiku)
 */
export function getModelFamily(modelId: string): 'opus' | 'sonnet' | 'haiku' | 'unknown' {
  const resolved = resolveModelAlias(modelId);
  const model = AVAILABLE_MODELS.find(m => m.value === resolved);
  return model?.family ?? 'unknown';
}

/**
 * Default model khi không chỉ định
 */
export const DEFAULT_MODEL = SONNET_MODELS.SONNET_4;

/**
 * Default max tokens output
 */
export const DEFAULT_MAX_TOKENS = 8192;
