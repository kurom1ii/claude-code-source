/**
 * MessageDisplay Component - Render messages trong Claude Code
 *
 * Component de hien thi messages tu user va assistant.
 * Ho tro markdown, code blocks, va cac loai content khac.
 */

import React from 'react';
import { Box } from './Box';
import { Text } from './Text';
import { Divider } from './Divider';

/**
 * Role cua message
 */
export type MessageRole = 'user' | 'assistant' | 'system' | 'tool';

/**
 * Loai content trong message
 */
export type ContentType = 'text' | 'code' | 'thinking' | 'tool_use' | 'tool_result' | 'image';

/**
 * Content block trong message
 */
export interface ContentBlock {
  type: ContentType;
  text?: string;
  language?: string;
  toolName?: string;
  toolInput?: unknown;
  toolResult?: unknown;
  isError?: boolean;
}

/**
 * Message structure
 */
export interface Message {
  id: string;
  role: MessageRole;
  content: ContentBlock[];
  timestamp?: Date;
  model?: string;
  tokens?: number;
}

/**
 * Props cho MessageDisplay component
 */
export interface MessageDisplayProps {
  /** Message de hien thi */
  message: Message;

  /** Hien thi timestamp */
  showTimestamp?: boolean;

  /** Hien thi token count */
  showTokens?: boolean;

  /** Hien thi model name */
  showModel?: boolean;

  /** Compact mode (it margin) */
  compact?: boolean;

  /** Mau cho user messages */
  userColor?: string;

  /** Mau cho assistant messages */
  assistantColor?: string;

  /** Mau cho code blocks */
  codeColor?: string;

  /** Hien thi thinking blocks */
  showThinking?: boolean;
}

/**
 * Render code block
 */
function CodeBlock({
  code,
  language,
  color = 'gray',
}: {
  code: string;
  language?: string;
  color?: string;
}): React.ReactElement {
  const lines = code.split('\n');

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={color}
      paddingX={1}
      marginY={1}
    >
      {/* Language header */}
      {language && (
        <Box marginBottom={1}>
          <Text dimColor>{language}</Text>
        </Box>
      )}

      {/* Code lines voi line numbers */}
      {lines.map((line, index) => (
        <Box key={index}>
          <Text dimColor>{String(index + 1).padStart(3, ' ')} │ </Text>
          <Text>{line}</Text>
        </Box>
      ))}
    </Box>
  );
}

/**
 * Render thinking block
 */
function ThinkingBlock({
  text,
}: {
  text: string;
}): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      marginY={1}
    >
      <Text dimColor italic>💭 Thinking...</Text>
      <Text dimColor>{text}</Text>
    </Box>
  );
}

/**
 * Render tool use block
 */
function ToolUseBlock({
  toolName,
  toolInput,
}: {
  toolName: string;
  toolInput?: unknown;
}): React.ReactElement {
  return (
    <Box flexDirection="column" marginY={1}>
      <Box>
        <Text color="yellow">🔧 </Text>
        <Text bold color="yellow">{toolName}</Text>
      </Box>
      {toolInput && (
        <Box paddingLeft={3}>
          <Text dimColor>{JSON.stringify(toolInput, null, 2)}</Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * Render tool result block
 */
function ToolResultBlock({
  result,
  isError,
}: {
  result?: unknown;
  isError?: boolean;
}): React.ReactElement {
  const resultText = typeof result === 'string'
    ? result
    : JSON.stringify(result, null, 2);

  return (
    <Box
      flexDirection="column"
      marginY={1}
      borderStyle="single"
      borderColor={isError ? 'red' : 'green'}
      paddingX={1}
    >
      <Text color={isError ? 'red' : 'green'}>
        {isError ? '✗ Error' : '✓ Result'}
      </Text>
      <Text>{resultText}</Text>
    </Box>
  );
}

/**
 * MessageDisplay Component
 *
 * Render mot message voi tat ca content blocks.
 *
 * @example
 * ```tsx
 * <MessageDisplay
 *   message={{
 *     id: '1',
 *     role: 'assistant',
 *     content: [{ type: 'text', text: 'Hello!' }]
 *   }}
 * />
 * ```
 */
export function MessageDisplay({
  message,
  showTimestamp = false,
  showTokens = false,
  showModel = false,
  compact = false,
  userColor = 'green',
  assistantColor = 'cyan',
  codeColor = 'gray',
  showThinking = true,
}: MessageDisplayProps): React.ReactElement {
  const roleColor = message.role === 'user' ? userColor : assistantColor;
  const roleLabel = message.role === 'user' ? 'You' : 'Claude';
  const roleIcon = message.role === 'user' ? '👤' : '🤖';

  return (
    <Box flexDirection="column" marginY={compact ? 0 : 1}>
      {/* Message header */}
      <Box marginBottom={1}>
        <Text color={roleColor} bold>
          {roleIcon} {roleLabel}
        </Text>

        {showModel && message.model && (
          <Text dimColor> ({message.model})</Text>
        )}

        {showTokens && message.tokens !== undefined && (
          <Text dimColor> · {message.tokens} tokens</Text>
        )}

        {showTimestamp && message.timestamp && (
          <Text dimColor> · {message.timestamp.toLocaleTimeString()}</Text>
        )}
      </Box>

      {/* Content blocks */}
      {message.content.map((block, index) => {
        switch (block.type) {
          case 'text':
            return (
              <Box key={index} paddingLeft={2}>
                <Text>{block.text}</Text>
              </Box>
            );

          case 'code':
            return (
              <Box key={index} paddingLeft={2}>
                <CodeBlock
                  code={block.text || ''}
                  language={block.language}
                  color={codeColor}
                />
              </Box>
            );

          case 'thinking':
            if (!showThinking) return null;
            return (
              <Box key={index} paddingLeft={2}>
                <ThinkingBlock text={block.text || ''} />
              </Box>
            );

          case 'tool_use':
            return (
              <Box key={index} paddingLeft={2}>
                <ToolUseBlock
                  toolName={block.toolName || 'unknown'}
                  toolInput={block.toolInput}
                />
              </Box>
            );

          case 'tool_result':
            return (
              <Box key={index} paddingLeft={2}>
                <ToolResultBlock
                  result={block.toolResult}
                  isError={block.isError}
                />
              </Box>
            );

          default:
            return null;
        }
      })}
    </Box>
  );
}

/**
 * MessageList Component
 *
 * Render danh sach messages.
 */
export interface MessageListProps {
  messages: Message[];
  showDividers?: boolean;
  compact?: boolean;
}

export function MessageList({
  messages,
  showDividers = true,
  compact = false,
}: MessageListProps): React.ReactElement {
  return (
    <Box flexDirection="column">
      {messages.map((message, index) => (
        <React.Fragment key={message.id}>
          {showDividers && index > 0 && (
            <Divider dividerDimColor />
          )}
          <MessageDisplay message={message} compact={compact} />
        </React.Fragment>
      ))}
    </Box>
  );
}

/**
 * SystemMessage Component
 *
 * Hien thi system message.
 */
export function SystemMessage({
  text,
  type = 'info',
}: {
  text: string;
  type?: 'info' | 'warning' | 'error' | 'success';
}): React.ReactElement {
  const config = {
    info: { color: 'cyan', icon: 'ℹ' },
    warning: { color: 'yellow', icon: '⚠' },
    error: { color: 'red', icon: '✗' },
    success: { color: 'green', icon: '✓' },
  };

  const { color, icon } = config[type];

  return (
    <Box marginY={1}>
      <Text color={color}>{icon} </Text>
      <Text color={color}>{text}</Text>
    </Box>
  );
}

export default MessageDisplay;
