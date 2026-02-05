/**
 * Teammate Tool
 *
 * Tool để quản lý teams và điều phối teammates trong swarm mode.
 * Bao gồm các operations:
 * - spawnTeam: Tạo team mới
 * - cleanup: Dọn dẹp team resources
 * - discoverTeams: Tìm teams có thể join
 * - requestJoin: Yêu cầu join team
 * - approveJoin: Approve join request
 * - rejectJoin: Reject join request
 */

import type { ToolDefinition, ToolHandler, ExecutionContext } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Các operations có thể thực hiện
 */
export type TeammateOperation =
  | 'spawnTeam'
  | 'cleanup'
  | 'discoverTeams'
  | 'requestJoin'
  | 'approveJoin'
  | 'rejectJoin';

/**
 * Input của Teammate tool
 */
export interface TeammateToolInput {
  /** Operation cần thực hiện */
  operation: TeammateOperation;
  /** Tên team (cho spawnTeam, requestJoin) */
  team_name?: string;
  /** Mô tả team (cho spawnTeam) */
  description?: string;
  /** Agent type (cho spawnTeam) */
  agent_type?: string;
  /** Tên đề xuất khi join (cho requestJoin) */
  proposed_name?: string;
  /** Capabilities description (cho requestJoin) */
  capabilities?: string;
  /** Target agent ID (cho approveJoin, rejectJoin) */
  target_agent_id?: string;
  /** Request ID (cho approveJoin, rejectJoin) */
  request_id?: string;
  /** Lý do (cho rejectJoin) */
  reason?: string;
  /** Assigned name (cho approveJoin) */
  assigned_name?: string;
  /** Timeout cho requestJoin (ms) */
  timeout_ms?: number;
}

/**
 * Thông tin team member
 */
export interface TeamMember {
  /** Agent ID */
  agentId: string;
  /** Tên hiển thị */
  name: string;
  /** Agent type */
  agentType?: string;
  /** Màu trong UI */
  color?: string;
}

/**
 * Thông tin team
 */
export interface TeamInfo {
  /** Tên team */
  name: string;
  /** Mô tả */
  description?: string;
  /** Leader agent ID */
  leadAgentId: string;
  /** Số members */
  memberCount: number;
  /** Danh sách members */
  members?: TeamMember[];
}

/**
 * Output của Teammate tool
 */
export interface TeammateToolOutput {
  /** Có thành công không */
  success: boolean;
  /** Message mô tả */
  message: string;
  /** Team info (cho spawnTeam, discoverTeams) */
  team?: TeamInfo;
  /** Danh sách teams (cho discoverTeams) */
  teams?: TeamInfo[];
  /** Agent info (cho approveJoin) */
  agent?: TeamMember;
}

// ============================================================================
// Tool Definition
// ============================================================================

export const teammateToolDefinition: ToolDefinition = {
  name: 'Teammate',
  description: `Manage teams and coordinate teammates in a swarm. Use this tool for team operations, communication, and task assignment.

## Operations

### spawnTeam - Create a Team
Create a new team to coordinate multiple agents working on a project.
\`\`\`
{ "operation": "spawnTeam", "team_name": "my-project", "description": "Working on feature X" }
\`\`\`

### discoverTeams - Discover Available Teams
List teams that are available to join.

### requestJoin - Request to Join a Team
Send a join request to a team's leader.
\`\`\`
{ "operation": "requestJoin", "team_name": "my-project", "proposed_name": "helper", "capabilities": "I can help with code review" }
\`\`\`

### approveJoin - Approve a Join Request (Leader Only)
Accept a join request from another agent.
\`\`\`
{ "operation": "approveJoin", "target_agent_id": "helper", "request_id": "join-123" }
\`\`\`

### rejectJoin - Reject a Join Request (Leader Only)
Decline a join request.
\`\`\`
{ "operation": "rejectJoin", "target_agent_id": "helper", "request_id": "join-123", "reason": "Team is at capacity" }
\`\`\`

### cleanup - Clean Up Team Resources
Remove team and task directories when swarm work is complete.

## Important Notes
- Always refer to teammates by their NAME, never by UUID
- Use SendMessage tool for direct communication between teammates
- Teammates go idle after every turn - this is normal behavior`,
  category: 'swarm',
  requiresConfirmation: false,
  parameters: {
    operation: {
      type: 'string',
      description: 'Operation to perform',
      required: true,
      enum: ['spawnTeam', 'cleanup', 'discoverTeams', 'requestJoin', 'approveJoin', 'rejectJoin'],
    },
    team_name: {
      type: 'string',
      description: 'Name for the team (required for spawnTeam, requestJoin)',
      required: false,
    },
    description: {
      type: 'string',
      description: 'Team description/purpose (only for spawnTeam)',
      required: false,
    },
    agent_type: {
      type: 'string',
      description: 'Type/role of the agent',
      required: false,
    },
    proposed_name: {
      type: 'string',
      description: 'Proposed name when joining a team',
      required: false,
    },
    capabilities: {
      type: 'string',
      description: 'Description of what you can help with',
      required: false,
    },
    target_agent_id: {
      type: 'string',
      description: 'Agent name/ID of the target (for approveJoin/rejectJoin)',
      required: false,
    },
    request_id: {
      type: 'string',
      description: 'Request ID for join operations',
      required: false,
    },
    reason: {
      type: 'string',
      description: 'Reason for the operation (for rejectJoin)',
      required: false,
    },
    assigned_name: {
      type: 'string',
      description: 'Name to assign to joining agent (for approveJoin)',
      required: false,
    },
    timeout_ms: {
      type: 'number',
      description: 'Timeout in milliseconds for requestJoin (default: 60000)',
      required: false,
    },
  },
};

// ============================================================================
// In-Memory Team Store
// ============================================================================

const teamStore = new Map<string, TeamInfo>();
const pendingRequests = new Map<string, { teamName: string; agentId: string; proposedName: string }>();

/**
 * Reset stores (for testing)
 */
export function resetTeamStore(): void {
  teamStore.clear();
  pendingRequests.clear();
}

// ============================================================================
// Validation
// ============================================================================

export function validateTeammateToolInput(input: unknown): boolean | string {
  if (!input || typeof input !== 'object') {
    return 'Input must be an object';
  }

  const inp = input as Record<string, unknown>;

  if (typeof inp.operation !== 'string') {
    return 'operation is required';
  }

  const validOps: TeammateOperation[] = [
    'spawnTeam',
    'cleanup',
    'discoverTeams',
    'requestJoin',
    'approveJoin',
    'rejectJoin',
  ];

  if (!validOps.includes(inp.operation as TeammateOperation)) {
    return `operation must be one of: ${validOps.join(', ')}`;
  }

  // Validate required fields per operation
  switch (inp.operation) {
    case 'spawnTeam':
      if (typeof inp.team_name !== 'string' || inp.team_name.trim() === '') {
        return 'team_name is required for spawnTeam';
      }
      break;
    case 'requestJoin':
      if (typeof inp.team_name !== 'string' || inp.team_name.trim() === '') {
        return 'team_name is required for requestJoin';
      }
      break;
    case 'approveJoin':
    case 'rejectJoin':
      if (typeof inp.target_agent_id !== 'string' || inp.target_agent_id.trim() === '') {
        return `target_agent_id is required for ${inp.operation}`;
      }
      if (typeof inp.request_id !== 'string' || inp.request_id.trim() === '') {
        return `request_id is required for ${inp.operation}`;
      }
      break;
  }

  return true;
}

// ============================================================================
// Handler
// ============================================================================

export function createTeammateToolHandler(
  context: ExecutionContext
): ToolHandler<TeammateToolInput, TeammateToolOutput> {
  return {
    name: 'Teammate',
    definition: teammateToolDefinition,
    validateInput: validateTeammateToolInput,

    async execute(
      input: TeammateToolInput,
      ctx: ExecutionContext
    ): Promise<TeammateToolOutput> {
      switch (input.operation) {
        case 'spawnTeam': {
          const teamName = input.team_name!;

          if (teamStore.has(teamName)) {
            return {
              success: false,
              message: `Team "${teamName}" already exists`,
            };
          }

          const team: TeamInfo = {
            name: teamName,
            description: input.description,
            leadAgentId: ctx.agentId || 'leader',
            memberCount: 1,
            members: [
              {
                agentId: ctx.agentId || 'leader',
                name: 'team-lead',
                agentType: input.agent_type,
              },
            ],
          };

          teamStore.set(teamName, team);

          return {
            success: true,
            message: `Team "${teamName}" created successfully`,
            team,
          };
        }

        case 'discoverTeams': {
          const teams = Array.from(teamStore.values());
          return {
            success: true,
            message: `Found ${teams.length} team(s)`,
            teams,
          };
        }

        case 'requestJoin': {
          const teamName = input.team_name!;
          const team = teamStore.get(teamName);

          if (!team) {
            return {
              success: false,
              message: `Team "${teamName}" not found`,
            };
          }

          const requestId = `join-${Date.now()}`;
          const proposedName = input.proposed_name || `agent-${Date.now()}`;

          pendingRequests.set(requestId, {
            teamName,
            agentId: ctx.agentId || 'unknown',
            proposedName,
          });

          return {
            success: true,
            message: `Join request sent to team "${teamName}". Request ID: ${requestId}`,
          };
        }

        case 'approveJoin': {
          const request = pendingRequests.get(input.request_id!);

          if (!request) {
            return {
              success: false,
              message: `Request "${input.request_id}" not found`,
            };
          }

          const team = teamStore.get(request.teamName);
          if (!team) {
            return {
              success: false,
              message: `Team "${request.teamName}" not found`,
            };
          }

          const assignedName = input.assigned_name || request.proposedName;
          const newMember: TeamMember = {
            agentId: request.agentId,
            name: assignedName,
          };

          team.members = [...(team.members || []), newMember];
          team.memberCount = team.members.length;

          pendingRequests.delete(input.request_id!);

          return {
            success: true,
            message: `Approved join request for "${assignedName}"`,
            agent: newMember,
          };
        }

        case 'rejectJoin': {
          const request = pendingRequests.get(input.request_id!);

          if (!request) {
            return {
              success: false,
              message: `Request "${input.request_id}" not found`,
            };
          }

          pendingRequests.delete(input.request_id!);

          return {
            success: true,
            message: `Rejected join request: ${input.reason || 'No reason provided'}`,
          };
        }

        case 'cleanup': {
          // Get team name from context or environment
          const teamName = ctx.teamName || process.env.CLAUDE_CODE_TEAM_NAME;

          if (!teamName) {
            return {
              success: false,
              message: 'No team context found',
            };
          }

          teamStore.delete(teamName);

          return {
            success: true,
            message: `Team "${teamName}" cleaned up successfully`,
          };
        }

        default:
          return {
            success: false,
            message: `Unknown operation: ${input.operation}`,
          };
      }
    },
  };
}

// ============================================================================
// Module Export
// ============================================================================

export default {
  definition: teammateToolDefinition,
  createHandler: createTeammateToolHandler,
  validate: validateTeammateToolInput,
  resetTeamStore,
};
