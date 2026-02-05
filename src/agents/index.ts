/**
 * Agents Module - Export tất cả các modules liên quan đến agents
 *
 * Module này là entry point cho agent system, bao gồm:
 * - Type definitions
 * - Agent management
 * - Team/Swarm coordination
 * - Inter-agent messaging
 * - Terminal backends (tmux, iTerm2)
 * - Agent definition loading
 */

// ============================================================================
// Types - Export tất cả types
// ============================================================================

export {
  // Agent colors
  AgentColor,
  AGENT_COLOR_TO_TMUX,
  AGENT_COLOR_TO_UI,
  AVAILABLE_AGENT_COLORS,

  // Agent source và type
  AgentSource,
  AgentType,
  AgentBackendType,

  // Agent identity
  AgentIdentity,
  AgentTeamContext,

  // Agent configuration
  AgentDefinition,
  AgentSpawnConfig,

  // Agent status
  AgentStatus,
  isTerminalStatus,
  AgentRuntimeInfo,
  AgentDisplayInfo,

  // Team types
  TeamMember,
  TeamConfig,
  TeamContext,
  TeammateType,
  TeammateInfo,

  // Message types
  AgentMessageType,
  AgentMessage,
  ShutdownRequest,
  ShutdownResponse,
  JoinRequest,
  JoinApproved,
  JoinRejected,
  PlanApprovalRequest,
  PlanApprovalResponse,
  TeammateMessage,

  // Terminal backend types
  PaneCreationResult,
  TerminalBackend,

  // Lifecycle types
  AgentLifecycleEvent,
  AgentLifecycleCallback,

  // Constants
  SWARM_SESSION_NAME,
  SWARM_WINDOW_NAME,
  HIDDEN_PANES_SESSION,
  DEFAULT_AGENT_TIMEOUT_MS,
  MAX_AGENT_TIMEOUT_MS,
  PANE_REBALANCE_DELAY_MS,
  DEFAULT_MODELS_BY_TYPE,
  getDefaultModelForAgentType,
} from './types';

// ============================================================================
// AgentManager - Quản lý agents
// ============================================================================

export {
  AgentManager,
  createAgentManager,
  getGlobalAgentManager,
  resetGlobalAgentManager,
} from './AgentManager';

// ============================================================================
// SwarmCoordinator - Điều phối team/swarm
// ============================================================================

export {
  SwarmCoordinator,
  createSwarmCoordinator,
  getGlobalSwarmCoordinator,
  resetGlobalSwarmCoordinator,
} from './SwarmCoordinator';

// ============================================================================
// MessageBus - Giao tiếp giữa agents
// ============================================================================

export {
  // Class và factory
  MessageBus,
  createMessageBus,
  getGlobalMessageBus,
  resetGlobalMessageBus,

  // Types
  MessageHandler,
  ProtocolHandler,

  // ID generation
  generateMessageId,
  generateRequestId,

  // Parsing functions
  parseTeammateMessages,
  parseJsonMessage,
  parseShutdownRequest,
  parseShutdownResponse,
  parseJoinRequest,
  parseJoinApproved,
  parseJoinRejected,
  parsePlanApprovalRequest,
  parsePlanApprovalResponse,
  getJoinRequestSummary,

  // Creation functions
  createAgentMessage,
  createShutdownRequest,
  createShutdownResponse,
  createJoinRequest,
  createJoinApproved,
  createJoinRejected,
  createPlanApprovalRequest,
  createPlanApprovalResponse,
  createModeChangeMessage,

  // Formatting
  serializeMessage,
  wrapTeammateMessage,
} from './MessageBus';

// ============================================================================
// TerminalBackends - Backends cho terminal (tmux, iTerm2)
// ============================================================================

export {
  // Backend classes
  TmuxBackend,
  ITermBackend,

  // Environment detection
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
} from './TerminalBackends';

// ============================================================================
// AgentDefinitionLoader - Tải và quản lý definitions
// ============================================================================

export {
  // Path utilities
  getAgentsDirectory,
  getRelativeAgentsDirectory,
  getAgentFilePath,
  getRelativeAgentFilePath,

  // Loading functions
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
} from './AgentDefinitionLoader';

// ============================================================================
// Default export - Object chứa tất cả utilities
// ============================================================================

import * as Types from './types';
import * as Manager from './AgentManager';
import * as Swarm from './SwarmCoordinator';
import * as Messages from './MessageBus';
import * as Backends from './TerminalBackends';
import * as Loader from './AgentDefinitionLoader';

/**
 * Default export object chứa tất cả modules
 */
export default {
  Types,
  Manager,
  Swarm,
  Messages,
  Backends,
  Loader,
};
