/**
 * ToolOutput Component - Hien thi ket qua tool execution
 *
 * Component de render output tu cac tools nhu Bash, Read, Write, etc.
 * Ho tro syntax highlighting va truncation.
 */

import React, { useState } from 'react';
import { Box } from './Box';
import { Text } from './Text';
import { Divider } from './Divider';
import { Spinner } from './Spinner';

/**
 * Loai tool
 */
export type ToolType =
  | 'bash'
  | 'read'
  | 'write'
  | 'edit'
  | 'glob'
  | 'grep'
  | 'web_fetch'
  | 'web_search'
  | 'task'
  | 'mcp'
  | 'unknown';

/**
 * Trang thai cua tool execution
 */
export type ToolStatus = 'pending' | 'running' | 'success' | 'error' | 'cancelled';

/**
 * Props cho ToolOutput component
 */
export interface ToolOutputProps {
  /** Loai tool */
  type: ToolType;

  /** Ten tool (hien thi) */
  name: string;

  /** Input/arguments cua tool */
  input?: Record<string, unknown>;

  /** Output/result cua tool */
  output?: string;

  /** Trang thai */
  status: ToolStatus;

  /** Error message (neu co) */
  error?: string;

  /** Thoi gian thuc thi (ms) */
  duration?: number;

  /** Truncate output sau N dong */
  maxLines?: number;

  /** Hien thi input */
  showInput?: boolean;

  /** Collapsed by default */
  defaultCollapsed?: boolean;

  /** Mau border */
  borderColor?: string;
}

/**
 * Tool icons
 */
const TOOL_ICONS: Record<ToolType, string> = {
  bash: '$',
  read: '📄',
  write: '✏️',
  edit: '📝',
  glob: '🔍',
  grep: '🔎',
  web_fetch: '🌐',
  web_search: '🔍',
  task: '📋',
  mcp: '🔌',
  unknown: '🔧',
};

/**
 * Tool colors
 */
const TOOL_COLORS: Record<ToolType, string> = {
  bash: 'yellow',
  read: 'cyan',
  write: 'green',
  edit: 'blue',
  glob: 'magenta',
  grep: 'magenta',
  web_fetch: 'cyan',
  web_search: 'cyan',
  task: 'yellow',
  mcp: 'blue',
  unknown: 'gray',
};

/**
 * Status icons
 */
const STATUS_ICONS: Record<ToolStatus, string> = {
  pending: '○',
  running: '◐',
  success: '✓',
  error: '✗',
  cancelled: '⊘',
};

/**
 * Status colors
 */
const STATUS_COLORS: Record<ToolStatus, string> = {
  pending: 'gray',
  running: 'yellow',
  success: 'green',
  error: 'red',
  cancelled: 'gray',
};

/**
 * Truncate text voi max lines
 */
function truncateLines(text: string, maxLines: number): { text: string; truncated: boolean; totalLines: number } {
  const lines = text.split('\n');
  if (lines.length <= maxLines) {
    return { text, truncated: false, totalLines: lines.length };
  }

  return {
    text: lines.slice(0, maxLines).join('\n'),
    truncated: true,
    totalLines: lines.length,
  };
}

/**
 * Format duration
 */
function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  if (ms < 60000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
}

/**
 * ToolOutput Component
 *
 * Hien thi ket qua cua tool execution.
 *
 * @example
 * ```tsx
 * <ToolOutput
 *   type="bash"
 *   name="Bash"
 *   input={{ command: "ls -la" }}
 *   output="file1.txt\nfile2.txt"
 *   status="success"
 *   duration={150}
 * />
 * ```
 */
export function ToolOutput({
  type,
  name,
  input,
  output,
  status,
  error,
  duration,
  maxLines = 20,
  showInput = true,
  defaultCollapsed = false,
  borderColor,
}: ToolOutputProps): React.ReactElement {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const icon = TOOL_ICONS[type];
  const color = borderColor || TOOL_COLORS[type];
  const statusIcon = STATUS_ICONS[status];
  const statusColor = STATUS_COLORS[status];

  // Truncate output neu can
  const outputResult = output ? truncateLines(output, maxLines) : null;

  return (
    <Box
      flexDirection="column"
      borderStyle="single"
      borderColor={color}
      marginY={1}
    >
      {/* Header */}
      <Box paddingX={1} justifyContent="space-between">
        <Box>
          <Text color={color}>{icon} </Text>
          <Text bold color={color}>{name}</Text>
        </Box>

        <Box>
          {/* Duration */}
          {duration !== undefined && status !== 'running' && (
            <Text dimColor>{formatDuration(duration)} · </Text>
          )}

          {/* Status */}
          {status === 'running' ? (
            <Spinner type="dots" color={statusColor} />
          ) : (
            <Text color={statusColor}>{statusIcon} {status}</Text>
          )}
        </Box>
      </Box>

      {!collapsed && (
        <>
          {/* Input */}
          {showInput && input && Object.keys(input).length > 0 && (
            <Box flexDirection="column" paddingX={1} marginTop={1}>
              <Text dimColor>Input:</Text>
              <Box paddingLeft={2}>
                {Object.entries(input).map(([key, value]) => (
                  <Box key={key}>
                    <Text color="cyan">{key}: </Text>
                    <Text>
                      {typeof value === 'string'
                        ? (value.length > 50 ? value.slice(0, 50) + '...' : value)
                        : JSON.stringify(value)}
                    </Text>
                  </Box>
                ))}
              </Box>
            </Box>
          )}

          {/* Divider */}
          {(output || error) && (
            <Box paddingX={1}>
              <Divider dividerDimColor width={40} />
            </Box>
          )}

          {/* Output */}
          {outputResult && (
            <Box flexDirection="column" paddingX={1}>
              <Text>{outputResult.text}</Text>
              {outputResult.truncated && (
                <Text dimColor italic>
                  ... ({outputResult.totalLines - maxLines} more lines)
                </Text>
              )}
            </Box>
          )}

          {/* Error */}
          {error && (
            <Box paddingX={1}>
              <Text color="red">{error}</Text>
            </Box>
          )}
        </>
      )}

      {/* Collapse indicator */}
      {(output || error) && (
        <Box paddingX={1}>
          <Text dimColor italic>
            [{collapsed ? 'collapsed' : 'expanded'}]
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * BashOutput Component
 *
 * Shorthand cho Bash tool output.
 */
export function BashOutput({
  command,
  output,
  exitCode,
  duration,
}: {
  command: string;
  output?: string;
  exitCode?: number;
  duration?: number;
}): React.ReactElement {
  const status: ToolStatus = exitCode === undefined
    ? 'running'
    : (exitCode === 0 ? 'success' : 'error');

  return (
    <ToolOutput
      type="bash"
      name="Bash"
      input={{ command }}
      output={output}
      status={status}
      error={exitCode !== 0 && exitCode !== undefined ? `Exit code: ${exitCode}` : undefined}
      duration={duration}
    />
  );
}

/**
 * FileOutput Component
 *
 * Hien thi noi dung file.
 */
export function FileOutput({
  path,
  content,
  language,
  status = 'success',
}: {
  path: string;
  content: string;
  language?: string;
  status?: ToolStatus;
}): React.ReactElement {
  const lines = content.split('\n');

  return (
    <ToolOutput
      type="read"
      name={`Read: ${path}`}
      output={content}
      status={status}
      maxLines={30}
    />
  );
}

/**
 * ToolOutputList Component
 *
 * Hien thi danh sach tool outputs.
 */
export interface ToolOutputItem {
  id: string;
  type: ToolType;
  name: string;
  input?: Record<string, unknown>;
  output?: string;
  status: ToolStatus;
  error?: string;
  duration?: number;
}

export function ToolOutputList({
  items,
  collapseCompleted = true,
}: {
  items: ToolOutputItem[];
  collapseCompleted?: boolean;
}): React.ReactElement {
  return (
    <Box flexDirection="column">
      {items.map(item => (
        <ToolOutput
          key={item.id}
          {...item}
          defaultCollapsed={collapseCompleted && item.status === 'success'}
        />
      ))}
    </Box>
  );
}

export default ToolOutput;
