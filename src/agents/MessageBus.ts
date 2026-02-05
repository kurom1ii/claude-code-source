/**
 * MessageBus - Hệ thống giao tiếp giữa các agents
 *
 * Module này cung cấp:
 * - Gửi/nhận tin nhắn giữa agents
 * - Broadcast tin nhắn cho team
 * - Xử lý các protocol messages (shutdown, join, plan approval)
 * - Queue và delivery management
 */

import {
  AgentMessage,
  AgentMessageType,
  ShutdownRequest,
  ShutdownResponse,
  JoinRequest,
  JoinApproved,
  JoinRejected,
  PlanApprovalRequest,
  PlanApprovalResponse,
  TeammateMessage,
  AgentColor,
} from './types';

// ============================================================================
// Constants - Hằng số
// ============================================================================

/** Tag XML để wrap teammate messages */
const TEAMMATE_MESSAGE_TAG = 'teammate_message';

/** Regex để parse teammate messages từ text */
const TEAMMATE_MESSAGE_REGEX = new RegExp(
  `<${TEAMMATE_MESSAGE_TAG}\\s+teammate_id="([^"]+)"(?:\\s+color="([^"]+)")?(?:\\s+summary="([^"]+)")?>\\n?([\\s\\S]*?)\\n?<\\/${TEAMMATE_MESSAGE_TAG}>`,
  'g'
);

// ============================================================================
// Message ID Generation - Tạo ID cho messages
// ============================================================================

/**
 * Tạo unique message ID
 * @returns Message ID mới
 */
export function generateMessageId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `msg-${timestamp}-${random}`;
}

/**
 * Tạo unique request ID (cho shutdown, join, etc.)
 * @param prefix - Prefix cho ID
 * @returns Request ID mới
 */
export function generateRequestId(prefix: string = 'req'): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 6);
  return `${prefix}-${timestamp}-${random}`;
}

// ============================================================================
// Message Parsing - Phân tích tin nhắn
// ============================================================================

/**
 * Parse teammate messages từ text
 * Tìm các tags <teammate_message> và extract thông tin
 * @param text - Text chứa messages
 * @returns Mảng TeammateMessage
 */
export function parseTeammateMessages(text: string): TeammateMessage[] {
  const messages: TeammateMessage[] = [];

  let match: RegExpExecArray | null;
  const regex = new RegExp(TEAMMATE_MESSAGE_REGEX.source, 'g');
  while ((match = regex.exec(text)) !== null) {
    if (match[1] && match[4]) {
      messages.push({
        teammateId: match[1],
        color: match[2],
        summary: match[3],
        content: match[4].trim(),
      });
    }
  }

  return messages;
}

/**
 * Parse JSON message từ text
 * Tìm JSON object trong text và parse
 * @param text - Text chứa JSON
 * @returns Parsed object hoặc null
 */
export function parseJsonMessage<T>(text: string): T | null {
  try {
    // Tìm JSON object trong text
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]) as T;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Kiểm tra text có phải là shutdown request không
 * @param text - Text cần kiểm tra
 * @returns ShutdownRequest hoặc null
 */
export function parseShutdownRequest(text: string): ShutdownRequest | null {
  const parsed = parseJsonMessage<ShutdownRequest>(text);
  if (parsed && parsed.type === 'shutdown_request') {
    return parsed;
  }
  return null;
}

/**
 * Kiểm tra text có phải là shutdown response không
 * @param text - Text cần kiểm tra
 * @returns ShutdownResponse hoặc null
 */
export function parseShutdownResponse(text: string): ShutdownResponse | null {
  const parsed = parseJsonMessage<ShutdownResponse>(text);
  if (parsed && parsed.type === 'shutdown_response') {
    return parsed;
  }
  return null;
}

/**
 * Kiểm tra text có phải là join request không
 * @param text - Text cần kiểm tra
 * @returns JoinRequest hoặc null
 */
export function parseJoinRequest(text: string): JoinRequest | null {
  const parsed = parseJsonMessage<JoinRequest>(text);
  if (parsed && parsed.type === 'join_request') {
    return parsed;
  }
  return null;
}

/**
 * Kiểm tra text có phải là join approved không
 * @param text - Text cần kiểm tra
 * @returns JoinApproved hoặc null
 */
export function parseJoinApproved(text: string): JoinApproved | null {
  const parsed = parseJsonMessage<JoinApproved>(text);
  if (parsed && parsed.type === 'join_approved') {
    return parsed;
  }
  return null;
}

/**
 * Kiểm tra text có phải là join rejected không
 * @param text - Text cần kiểm tra
 * @returns JoinRejected hoặc null
 */
export function parseJoinRejected(text: string): JoinRejected | null {
  const parsed = parseJsonMessage<JoinRejected>(text);
  if (parsed && parsed.type === 'join_rejected') {
    return parsed;
  }
  return null;
}

/**
 * Kiểm tra text có phải là plan approval request không
 * @param text - Text cần kiểm tra
 * @returns PlanApprovalRequest hoặc null
 */
export function parsePlanApprovalRequest(text: string): PlanApprovalRequest | null {
  const parsed = parseJsonMessage<PlanApprovalRequest>(text);
  if (parsed && parsed.type === 'plan_approval_request') {
    return parsed;
  }
  return null;
}

/**
 * Kiểm tra text có phải là plan approval response không
 * @param text - Text cần kiểm tra
 * @returns PlanApprovalResponse hoặc null
 */
export function parsePlanApprovalResponse(text: string): PlanApprovalResponse | null {
  const parsed = parseJsonMessage<PlanApprovalResponse>(text);
  if (parsed && parsed.type === 'plan_approval_response') {
    return parsed;
  }
  return null;
}

/**
 * Tạo summary text cho join request
 * @param text - Text chứa join request
 * @returns Summary string hoặc null
 */
export function getJoinRequestSummary(text: string): string | null {
  const request = parseJoinRequest(text);
  if (request) {
    const capabilities = request.capabilities ? ` - ${request.capabilities}` : '';
    return `[Join Request] ${request.proposedName} wants to join${capabilities}`;
  }

  const approved = parseJoinApproved(text);
  if (approved) {
    return `[Join Approved] You are now ${approved.agentName} in ${approved.teamName}`;
  }

  const rejected = parseJoinRejected(text);
  if (rejected) {
    return `[Join Rejected] ${rejected.reason || 'Request was rejected'}`;
  }

  return null;
}

// ============================================================================
// Message Creation - Tạo tin nhắn
// ============================================================================

/**
 * Tạo agent message cơ bản
 * @param from - Người gửi
 * @param text - Nội dung
 * @param type - Loại tin nhắn (optional)
 * @returns AgentMessage
 */
export function createAgentMessage(
  from: string,
  text: string,
  type?: AgentMessageType
): AgentMessage {
  return {
    from,
    text,
    timestamp: new Date().toISOString(),
    type,
  };
}

/**
 * Tạo shutdown request
 * @param from - Người gửi
 * @param reason - Lý do (optional)
 * @returns ShutdownRequest
 */
export function createShutdownRequest(
  from: string,
  reason?: string
): ShutdownRequest {
  return {
    type: 'shutdown_request',
    requestId: generateRequestId('shutdown'),
    from,
    reason,
  };
}

/**
 * Tạo shutdown response
 * @param requestId - ID của request
 * @param from - Người trả lời
 * @param approved - Đồng ý hay không
 * @param reason - Lý do (nếu từ chối)
 * @returns ShutdownResponse
 */
export function createShutdownResponse(
  requestId: string,
  from: string,
  approved: boolean,
  reason?: string
): ShutdownResponse {
  return {
    type: 'shutdown_response',
    requestId,
    from,
    approved,
    reason,
  };
}

/**
 * Tạo join request
 * @param proposedName - Tên đề xuất
 * @param capabilities - Khả năng (optional)
 * @returns JoinRequest
 */
export function createJoinRequest(
  proposedName: string,
  capabilities?: string
): JoinRequest {
  return {
    type: 'join_request',
    requestId: generateRequestId('join'),
    proposedName,
    capabilities,
  };
}

/**
 * Tạo join approved response
 * @param requestId - ID của request
 * @param teamName - Tên team
 * @param agentId - ID được gán cho agent
 * @param agentName - Tên được gán cho agent
 * @param color - Màu được gán (optional)
 * @returns JoinApproved
 */
export function createJoinApproved(
  requestId: string,
  teamName: string,
  agentId: string,
  agentName: string,
  color?: AgentColor
): JoinApproved {
  return {
    type: 'join_approved',
    requestId,
    teamName,
    agentId,
    agentName,
    color,
  };
}

/**
 * Tạo join rejected response
 * @param requestId - ID của request
 * @param reason - Lý do từ chối (optional)
 * @returns JoinRejected
 */
export function createJoinRejected(
  requestId: string,
  reason?: string
): JoinRejected {
  return {
    type: 'join_rejected',
    requestId,
    reason,
  };
}

/**
 * Tạo plan approval request
 * @param from - Người gửi
 * @param planContent - Nội dung plan
 * @param planFilePath - Đường dẫn file plan (optional)
 * @returns PlanApprovalRequest
 */
export function createPlanApprovalRequest(
  from: string,
  planContent: string,
  planFilePath?: string
): PlanApprovalRequest {
  return {
    type: 'plan_approval_request',
    requestId: generateRequestId('plan'),
    from,
    planContent,
    planFilePath,
  };
}

/**
 * Tạo plan approval response
 * @param requestId - ID của request
 * @param approved - Đồng ý hay không
 * @param feedback - Phản hồi (optional)
 * @returns PlanApprovalResponse
 */
export function createPlanApprovalResponse(
  requestId: string,
  approved: boolean,
  feedback?: string
): PlanApprovalResponse {
  return {
    type: 'plan_approval_response',
    requestId,
    approved,
    feedback,
  };
}

/**
 * Tạo mode change message
 * @param mode - Mode mới
 * @param from - Người gửi
 * @returns Serialized message
 */
export function createModeChangeMessage(mode: string, from: string): string {
  return JSON.stringify({
    type: 'mode_change',
    mode,
    from,
  });
}

// ============================================================================
// Message Formatting - Định dạng tin nhắn
// ============================================================================

/**
 * Serialize message object thành JSON string
 * @param message - Object cần serialize
 * @returns JSON string
 */
export function serializeMessage(message: unknown): string {
  return JSON.stringify(message);
}

/**
 * Wrap content trong teammate message tag
 * @param teammateId - ID của teammate
 * @param content - Nội dung tin nhắn
 * @param color - Màu (optional)
 * @param summary - Tóm tắt (optional)
 * @returns Formatted string
 */
export function wrapTeammateMessage(
  teammateId: string,
  content: string,
  color?: string,
  summary?: string
): string {
  let attrs = `teammate_id="${teammateId}"`;
  if (color) attrs += ` color="${color}"`;
  if (summary) attrs += ` summary="${summary}"`;

  return `<${TEAMMATE_MESSAGE_TAG} ${attrs}>\n${content}\n</${TEAMMATE_MESSAGE_TAG}>`;
}

// ============================================================================
// MessageBus Class
// ============================================================================

/**
 * Message handler callback type
 */
export type MessageHandler = (message: AgentMessage) => void | Promise<void>;

/**
 * Protocol message handler callback type
 */
export type ProtocolHandler<T> = (message: T, from: string) => void | Promise<void>;

/**
 * Lớp quản lý message bus
 */
export class MessageBus {
  /** Map handlers theo recipient */
  private messageHandlers: Map<string, MessageHandler[]> = new Map();

  /** Handlers cho broadcast */
  private broadcastHandlers: MessageHandler[] = [];

  /** Queue tin nhắn chưa gửi được */
  private messageQueue: Map<string, AgentMessage[]> = new Map();

  /** Tên team */
  private teamName?: string;

  /** Tên agent của instance này */
  private selfAgentName?: string;

  /**
   * Constructor
   * @param teamName - Tên team (optional)
   * @param selfAgentName - Tên agent của instance này (optional)
   */
  constructor(teamName?: string, selfAgentName?: string) {
    this.teamName = teamName;
    this.selfAgentName = selfAgentName;
  }

  /**
   * Đặt tên team
   * @param teamName - Tên team
   */
  setTeamName(teamName: string): void {
    this.teamName = teamName;
  }

  /**
   * Đặt tên agent
   * @param agentName - Tên agent
   */
  setSelfAgentName(agentName: string): void {
    this.selfAgentName = agentName;
  }

  // ==========================================================================
  // Message Sending - Gửi tin nhắn
  // ==========================================================================

  /**
   * Gửi tin nhắn cho một agent
   * @param recipient - Tên người nhận
   * @param message - Tin nhắn
   * @returns true nếu gửi thành công
   */
  async sendMessage(recipient: string, message: AgentMessage): Promise<boolean> {
    // Lấy handlers của recipient
    const handlers = this.messageHandlers.get(recipient);

    if (!handlers || handlers.length === 0) {
      // Không có handler, queue lại
      this.queueMessage(recipient, message);
      return false;
    }

    // Gọi tất cả handlers
    for (const handler of handlers) {
      try {
        await handler(message);
      } catch (error) {
        console.error(`Error in message handler for '${recipient}':`, error);
      }
    }

    return true;
  }

  /**
   * Gửi tin nhắn text đơn giản
   * @param recipient - Tên người nhận
   * @param text - Nội dung
   * @param from - Người gửi (mặc định là selfAgentName)
   * @returns true nếu gửi thành công
   */
  async sendText(
    recipient: string,
    text: string,
    from?: string
  ): Promise<boolean> {
    const message = createAgentMessage(from || this.selfAgentName || 'unknown', text);
    return this.sendMessage(recipient, message);
  }

  /**
   * Broadcast tin nhắn cho tất cả agents
   * @param message - Tin nhắn
   * @param excludeSelf - Không gửi cho bản thân (default: true)
   */
  async broadcast(message: AgentMessage, excludeSelf: boolean = true): Promise<void> {
    // Gọi broadcast handlers
    for (const handler of this.broadcastHandlers) {
      try {
        await handler(message);
      } catch (error) {
        console.error('Error in broadcast handler:', error);
      }
    }

    // Gửi cho từng registered recipient
    for (const [recipient, handlers] of this.messageHandlers.entries()) {
      if (excludeSelf && recipient === this.selfAgentName) {
        continue;
      }

      for (const handler of handlers) {
        try {
          await handler(message);
        } catch (error) {
          console.error(`Error in message handler for '${recipient}':`, error);
        }
      }
    }
  }

  /**
   * Broadcast text đơn giản
   * @param text - Nội dung
   * @param from - Người gửi (mặc định là selfAgentName)
   */
  async broadcastText(text: string, from?: string): Promise<void> {
    const message = createAgentMessage(from || this.selfAgentName || 'unknown', text);
    message.type = 'broadcast';
    await this.broadcast(message);
  }

  // ==========================================================================
  // Message Receiving - Nhận tin nhắn
  // ==========================================================================

  /**
   * Đăng ký handler cho tin nhắn đến agent
   * @param agentName - Tên agent
   * @param handler - Handler function
   * @returns Hàm để hủy đăng ký
   */
  onMessage(agentName: string, handler: MessageHandler): () => void {
    const handlers = this.messageHandlers.get(agentName) || [];
    handlers.push(handler);
    this.messageHandlers.set(agentName, handlers);

    // Gửi các tin nhắn đang queue
    this.flushQueuedMessages(agentName);

    // Return unsubscribe function
    return () => {
      const currentHandlers = this.messageHandlers.get(agentName);
      if (currentHandlers) {
        const index = currentHandlers.indexOf(handler);
        if (index > -1) {
          currentHandlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * Đăng ký handler cho broadcast
   * @param handler - Handler function
   * @returns Hàm để hủy đăng ký
   */
  onBroadcast(handler: MessageHandler): () => void {
    this.broadcastHandlers.push(handler);

    return () => {
      const index = this.broadcastHandlers.indexOf(handler);
      if (index > -1) {
        this.broadcastHandlers.splice(index, 1);
      }
    };
  }

  // ==========================================================================
  // Message Queue - Hàng đợi tin nhắn
  // ==========================================================================

  /**
   * Queue tin nhắn khi không có handler
   * @param recipient - Người nhận
   * @param message - Tin nhắn
   */
  private queueMessage(recipient: string, message: AgentMessage): void {
    const queue = this.messageQueue.get(recipient) || [];
    queue.push(message);
    this.messageQueue.set(recipient, queue);
  }

  /**
   * Gửi các tin nhắn đang queue cho recipient
   * @param recipient - Người nhận
   */
  private async flushQueuedMessages(recipient: string): Promise<void> {
    const queue = this.messageQueue.get(recipient);
    if (!queue || queue.length === 0) return;

    // Clear queue trước khi gửi để tránh infinite loop
    this.messageQueue.delete(recipient);

    for (const message of queue) {
      await this.sendMessage(recipient, message);
    }
  }

  /**
   * Lấy số tin nhắn đang queue cho recipient
   * @param recipient - Người nhận
   * @returns Số tin nhắn
   */
  getQueuedMessageCount(recipient: string): number {
    return this.messageQueue.get(recipient)?.length || 0;
  }

  /**
   * Clear queue cho recipient
   * @param recipient - Người nhận
   */
  clearQueue(recipient: string): void {
    this.messageQueue.delete(recipient);
  }

  /**
   * Clear tất cả queues
   */
  clearAllQueues(): void {
    this.messageQueue.clear();
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  /**
   * Xóa tất cả handlers của một agent
   * @param agentName - Tên agent
   */
  removeAgent(agentName: string): void {
    this.messageHandlers.delete(agentName);
    this.messageQueue.delete(agentName);
  }

  /**
   * Xóa tất cả handlers và queues
   */
  clear(): void {
    this.messageHandlers.clear();
    this.broadcastHandlers = [];
    this.messageQueue.clear();
  }
}

// ============================================================================
// Factory Function
// ============================================================================

/**
 * Tạo MessageBus instance mới
 * @param teamName - Tên team (optional)
 * @param selfAgentName - Tên agent (optional)
 * @returns MessageBus instance
 */
export function createMessageBus(teamName?: string, selfAgentName?: string): MessageBus {
  return new MessageBus(teamName, selfAgentName);
}

// ============================================================================
// Singleton Instance
// ============================================================================

/** Global message bus instance */
let globalMessageBus: MessageBus | null = null;

/**
 * Lấy global message bus instance
 * @returns MessageBus instance
 */
export function getGlobalMessageBus(): MessageBus {
  if (!globalMessageBus) {
    globalMessageBus = new MessageBus();
  }
  return globalMessageBus;
}

/**
 * Reset global message bus
 */
export function resetGlobalMessageBus(): void {
  if (globalMessageBus) {
    globalMessageBus.clear();
  }
  globalMessageBus = null;
}

// ============================================================================
// Exports
// ============================================================================

export default {
  // Classes
  MessageBus,

  // Factory functions
  createMessageBus,
  getGlobalMessageBus,
  resetGlobalMessageBus,

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

  // Formatting functions
  serializeMessage,
  wrapTeammateMessage,
};
