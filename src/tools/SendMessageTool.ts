/**
 * SendMessage Tool
 *
 * Tool để gửi messages giữa teammates trong swarm mode.
 * Hỗ trợ các loại message:
 * - message: Direct message đến một teammate
 * - broadcast: Gửi đến tất cả teammates
 * - shutdown_request: Yêu cầu teammate shutdown
 * - shutdown_response: Phản hồi shutdown request
 * - plan_approval_response: Approve/reject plan của teammate
 */

import type { ToolDefinition, ToolHandler, ExecutionContext } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Các loại message
 */
export type MessageType =
  | 'message'
  | 'broadcast'
  | 'shutdown_request'
  | 'shutdown_response'
  | 'plan_approval_response';

/**
 * Input của SendMessage tool
 */
export interface SendMessageToolInput {
  /** Loại message */
  type: MessageType;
  /** Người nhận (cho message, shutdown_request, plan_approval_response) */
  recipient?: string;
  /** Nội dung message */
  content?: string;
  /** Summary ngắn cho preview (5-10 từ) */
  summary?: string;
  /** Request ID để respond (cho shutdown_response, plan_approval_response) */
  request_id?: string;
  /** Approve hay không (cho shutdown_response, plan_approval_response) */
  approve?: boolean;
}

/**
 * Output của SendMessage tool
 */
export interface SendMessageToolOutput {
  /** Có thành công không */
  success: boolean;
  /** Message mô tả */
  message: string;
  /** Message ID nếu gửi thành công */
  messageId?: string;
  /** Số recipients nếu broadcast */
  recipientCount?: number;
}

// ============================================================================
// Tool Definition
// ============================================================================

export const sendMessageToolDefinition: ToolDefinition = {
  name: 'SendMessage',
  description: `Send messages to teammates and handle protocol requests/responses in a swarm.

## Message Types

### type: "message" - Send a Direct Message
Send a message to a **single specific teammate**. You MUST specify the recipient.

**IMPORTANT**: Your plain text output is NOT visible to teammates. You **MUST** use this tool to communicate.

\`\`\`
{ "type": "message", "recipient": "researcher", "content": "Your message here", "summary": "Brief status update" }
\`\`\`

### type: "broadcast" - Send Message to ALL Teammates (USE SPARINGLY)
Send the **same message to everyone** on the team at once.

**WARNING: Broadcasting is expensive.** Each broadcast sends a separate message to every teammate.

\`\`\`
{ "type": "broadcast", "content": "Message to all", "summary": "Critical issue found" }
\`\`\`

**Use broadcast only for:**
- Critical issues requiring immediate team-wide attention
- Major announcements that affect every teammate equally

### type: "shutdown_request" - Request a Teammate to Shut Down
\`\`\`
{ "type": "shutdown_request", "recipient": "researcher", "content": "Task complete" }
\`\`\`

### type: "shutdown_response" - Respond to a Shutdown Request
\`\`\`
{ "type": "shutdown_response", "request_id": "abc-123", "approve": true }
\`\`\`

### type: "plan_approval_response" - Approve or Reject a Teammate's Plan
\`\`\`
{ "type": "plan_approval_response", "request_id": "abc-123", "recipient": "researcher", "approve": true }
\`\`\`

## Important Notes
- Always refer to teammates by their NAME (e.g., "team-lead", "researcher"), never by UUID
- Do NOT send structured JSON status messages
- Use TaskUpdate to mark tasks completed - idle notifications are automatic`,
  category: 'swarm',
  requiresConfirmation: false,
  parameters: {
    type: {
      type: 'string',
      description: 'Message type',
      required: true,
      enum: ['message', 'broadcast', 'shutdown_request', 'shutdown_response', 'plan_approval_response'],
    },
    recipient: {
      type: 'string',
      description: 'Agent name of the recipient (required for message, shutdown_request, plan_approval_response)',
      required: false,
    },
    content: {
      type: 'string',
      description: 'Message text, reason, or feedback',
      required: false,
    },
    summary: {
      type: 'string',
      description: 'A 5-10 word summary of the message, shown as preview in UI',
      required: false,
    },
    request_id: {
      type: 'string',
      description: 'Request ID to respond to (required for shutdown_response, plan_approval_response)',
      required: false,
    },
    approve: {
      type: 'boolean',
      description: 'Whether to approve the request (required for shutdown_response, plan_approval_response)',
      required: false,
    },
  },
};

// ============================================================================
// Message Queue (In-Memory)
// ============================================================================

interface QueuedMessage {
  id: string;
  from: string;
  to: string;
  type: MessageType;
  content: string;
  summary?: string;
  timestamp: string;
}

const messageQueue = new Map<string, QueuedMessage[]>();

/**
 * Reset message queue (for testing)
 */
export function resetMessageQueue(): void {
  messageQueue.clear();
}

/**
 * Get messages for an agent
 */
export function getMessagesForAgent(agentName: string): QueuedMessage[] {
  return messageQueue.get(agentName) || [];
}

/**
 * Clear messages for an agent
 */
export function clearMessagesForAgent(agentName: string): void {
  messageQueue.delete(agentName);
}

// ============================================================================
// Validation
// ============================================================================

export function validateSendMessageToolInput(
  input: unknown
): boolean | string {
  if (!input || typeof input !== 'object') {
    return 'Input must be an object';
  }

  const inp = input as Record<string, unknown>;

  if (typeof inp.type !== 'string') {
    return 'type is required';
  }

  const validTypes: MessageType[] = [
    'message',
    'broadcast',
    'shutdown_request',
    'shutdown_response',
    'plan_approval_response',
  ];

  if (!validTypes.includes(inp.type as MessageType)) {
    return `type must be one of: ${validTypes.join(', ')}`;
  }

  // Validate required fields per type
  switch (inp.type) {
    case 'message':
    case 'shutdown_request':
      if (typeof inp.recipient !== 'string' || inp.recipient.trim() === '') {
        return `recipient is required for ${inp.type}`;
      }
      break;

    case 'broadcast':
      if (typeof inp.content !== 'string' || inp.content.trim() === '') {
        return 'content is required for broadcast';
      }
      if (typeof inp.summary !== 'string' || inp.summary.trim() === '') {
        return 'summary is required for broadcast';
      }
      break;

    case 'shutdown_response':
    case 'plan_approval_response':
      if (typeof inp.request_id !== 'string' || inp.request_id.trim() === '') {
        return `request_id is required for ${inp.type}`;
      }
      if (typeof inp.approve !== 'boolean') {
        return `approve is required for ${inp.type}`;
      }
      break;
  }

  return true;
}

// ============================================================================
// Handler
// ============================================================================

export function createSendMessageToolHandler(
  context: ExecutionContext
): ToolHandler<SendMessageToolInput, SendMessageToolOutput> {
  return {
    name: 'SendMessage',
    definition: sendMessageToolDefinition,
    validateInput: validateSendMessageToolInput,

    async execute(
      input: SendMessageToolInput,
      ctx: ExecutionContext
    ): Promise<SendMessageToolOutput> {
      const fromAgent = ctx.agentName || 'unknown';
      const messageId = `msg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      switch (input.type) {
        case 'message': {
          const msg: QueuedMessage = {
            id: messageId,
            from: fromAgent,
            to: input.recipient!,
            type: 'message',
            content: input.content || '',
            summary: input.summary,
            timestamp: new Date().toISOString(),
          };

          const queue = messageQueue.get(input.recipient!) || [];
          queue.push(msg);
          messageQueue.set(input.recipient!, queue);

          return {
            success: true,
            message: `Message sent to ${input.recipient}`,
            messageId,
          };
        }

        case 'broadcast': {
          // In reality, this would send to all team members
          // For now, just log it
          return {
            success: true,
            message: 'Broadcast sent to all teammates',
            messageId,
            recipientCount: 0, // Would be actual count in real implementation
          };
        }

        case 'shutdown_request': {
          const msg: QueuedMessage = {
            id: messageId,
            from: fromAgent,
            to: input.recipient!,
            type: 'shutdown_request',
            content: input.content || 'Shutdown requested',
            timestamp: new Date().toISOString(),
          };

          const queue = messageQueue.get(input.recipient!) || [];
          queue.push(msg);
          messageQueue.set(input.recipient!, queue);

          return {
            success: true,
            message: `Shutdown request sent to ${input.recipient}`,
            messageId,
          };
        }

        case 'shutdown_response': {
          if (input.approve) {
            // In reality, this would trigger shutdown
            return {
              success: true,
              message: 'Shutdown approved. Terminating...',
            };
          } else {
            return {
              success: true,
              message: `Shutdown rejected: ${input.content || 'No reason provided'}`,
            };
          }
        }

        case 'plan_approval_response': {
          const msg: QueuedMessage = {
            id: messageId,
            from: fromAgent,
            to: input.recipient!,
            type: 'plan_approval_response',
            content: input.approve
              ? 'Plan approved'
              : `Plan rejected: ${input.content || 'No feedback provided'}`,
            timestamp: new Date().toISOString(),
          };

          const queue = messageQueue.get(input.recipient!) || [];
          queue.push(msg);
          messageQueue.set(input.recipient!, queue);

          return {
            success: true,
            message: input.approve
              ? `Plan approved for ${input.recipient}`
              : `Plan rejected for ${input.recipient}`,
            messageId,
          };
        }

        default:
          return {
            success: false,
            message: `Unknown message type: ${input.type}`,
          };
      }
    },
  };
}

// ============================================================================
// Module Export
// ============================================================================

export default {
  definition: sendMessageToolDefinition,
  createHandler: createSendMessageToolHandler,
  validate: validateSendMessageToolInput,
  resetMessageQueue,
  getMessagesForAgent,
  clearMessagesForAgent,
};
