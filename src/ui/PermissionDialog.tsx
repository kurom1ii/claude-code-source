/**
 * PermissionDialog Component - Dialog xac nhan quyen cho tool
 *
 * Component de hien thi dialog xin phep truoc khi thuc thi tool.
 * Ho tro allow/deny voi option remember choice.
 *
 * Pattern: f7/CK9 -> PermissionDialog
 */

import React, { useState, useCallback } from 'react';
import { Box } from './Box';
import { Text } from './Text';
import { Select, SelectOption } from './Select';
import { Divider } from './Divider';

/**
 * Permission request types
 */
export type PermissionType =
  | 'bash'
  | 'file_write'
  | 'file_read'
  | 'file_edit'
  | 'mcp'
  | 'web_fetch'
  | 'web_search'
  | 'task'
  | 'unknown';

/**
 * Permission decision
 */
export type PermissionDecision = 'allow' | 'deny' | 'allow_always' | 'deny_always';

/**
 * Permission update (for remember choices)
 */
export interface PermissionUpdate {
  type: PermissionType;
  pattern?: string;
  decision: 'allow' | 'deny';
  scope: 'session' | 'project' | 'global';
}

/**
 * Props cho PermissionDialog component
 */
export interface PermissionDialogProps {
  /** Tieu de cua dialog */
  title: string;

  /** Mo ta chi tiet ve permission request */
  description?: string;

  /** Loai permission */
  type: PermissionType;

  /** Ten tool dang yeu cau */
  toolName?: string;

  /** Input/arguments cua tool */
  toolInput?: Record<string, unknown>;

  /** Pattern (file path, command, etc.) */
  pattern?: string;

  /** Risk level */
  riskLevel?: 'low' | 'medium' | 'high';

  /** Hien thi remember options */
  showRememberOptions?: boolean;

  /** Callback khi allow */
  onAllow?: (updates?: PermissionUpdate[]) => void;

  /** Callback khi deny */
  onDeny?: (feedback?: string) => void;

  /** Callback khi cancel (Esc) */
  onCancel?: () => void;

  /** Mau cua dialog */
  color?: string;

  /** An input guide */
  hideInputGuide?: boolean;

  /** An border */
  hideBorder?: boolean;
}

/**
 * Permission icons
 */
const PERMISSION_ICONS: Record<PermissionType, string> = {
  bash: '$',
  file_write: '✏️',
  file_read: '📄',
  file_edit: '📝',
  mcp: '🔌',
  web_fetch: '🌐',
  web_search: '🔍',
  task: '📋',
  unknown: '❓',
};

/**
 * Risk level colors
 */
const RISK_COLORS: Record<string, string> = {
  low: 'green',
  medium: 'yellow',
  high: 'red',
};

/**
 * PermissionDialog Component
 *
 * Hien thi dialog xin phep voi options allow/deny.
 *
 * @example
 * ```tsx
 * <PermissionDialog
 *   title="Allow Bash Command?"
 *   description="The assistant wants to run a command"
 *   type="bash"
 *   toolName="Bash"
 *   toolInput={{ command: "npm install" }}
 *   onAllow={() => console.log('Allowed')}
 *   onDeny={() => console.log('Denied')}
 * />
 * ```
 */
export function PermissionDialog({
  title,
  description,
  type,
  toolName,
  toolInput,
  pattern,
  riskLevel = 'medium',
  showRememberOptions = true,
  onAllow,
  onDeny,
  onCancel,
  color = 'permission',
  hideInputGuide = false,
  hideBorder = false,
}: PermissionDialogProps): React.ReactElement {
  const [selectedOption, setSelectedOption] = useState<string | null>(null);

  const icon = PERMISSION_ICONS[type];
  const riskColor = RISK_COLORS[riskLevel];
  const borderDimColor = hideBorder ? undefined : true;

  // Build options
  const options: SelectOption<string>[] = [
    { value: 'allow', label: 'Yes, allow this time' },
    { value: 'deny', label: 'No, deny this request' },
  ];

  if (showRememberOptions) {
    options.push(
      { value: 'allow_always', label: 'Yes, always allow this' },
      { value: 'deny_always', label: 'No, always deny this' }
    );
  }

  const handleSelect = useCallback((value: string) => {
    setSelectedOption(value);

    if (value === 'allow' || value === 'allow_always') {
      const updates: PermissionUpdate[] = value === 'allow_always' && pattern
        ? [{
            type,
            pattern,
            decision: 'allow',
            scope: 'session',
          }]
        : [];
      onAllow?.(updates.length > 0 ? updates : undefined);
    } else if (value === 'deny' || value === 'deny_always') {
      onDeny?.();
    }
  }, [type, pattern, onAllow, onDeny]);

  return (
    <Box flexDirection="column">
      {/* Border/Divider */}
      {!hideBorder && (
        <Divider dividerColor={color} dividerDimColor={borderDimColor} />
      )}

      {/* Content */}
      <Box
        flexDirection="column"
        paddingX={hideBorder ? 0 : 1}
        paddingBottom={1}
        gap={1}
      >
        {/* Title */}
        <Box flexDirection="column">
          <Box>
            <Text color={color}>{icon} </Text>
            <Text bold color={color}>{title}</Text>
          </Box>
          {description && (
            <Text dimColor>{description}</Text>
          )}
        </Box>

        {/* Tool info */}
        {toolName && (
          <Box flexDirection="column" paddingLeft={2}>
            <Box>
              <Text dimColor>Tool: </Text>
              <Text bold>{toolName}</Text>
            </Box>

            {/* Risk level */}
            <Box>
              <Text dimColor>Risk: </Text>
              <Text color={riskColor}>{riskLevel}</Text>
            </Box>
          </Box>
        )}

        {/* Tool input */}
        {toolInput && Object.keys(toolInput).length > 0 && (
          <Box
            flexDirection="column"
            borderStyle="single"
            borderColor="gray"
            paddingX={1}
            marginTop={1}
          >
            {Object.entries(toolInput).map(([key, value]) => (
              <Box key={key}>
                <Text color="cyan">{key}: </Text>
                <Text wrap="truncate">
                  {typeof value === 'string'
                    ? (value.length > 60 ? value.slice(0, 60) + '...' : value)
                    : JSON.stringify(value, null, 2)}
                </Text>
              </Box>
            ))}
          </Box>
        )}

        {/* Pattern (if applicable) */}
        {pattern && (
          <Box paddingLeft={2}>
            <Text dimColor>Pattern: </Text>
            <Text color="yellow">{pattern}</Text>
          </Box>
        )}

        {/* Options */}
        <Box marginTop={1}>
          <Select
            options={options}
            onChange={handleSelect}
            layout="vertical"
            indicator=">"
            indicatorEmpty=" "
            highlightColor="cyan"
          />
        </Box>
      </Box>

      {/* Input guide */}
      {!hideInputGuide && (
        <Box paddingX={hideBorder ? 0 : 1}>
          <Text dimColor italic>
            Enter to confirm, Esc to cancel
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * SimplePermissionDialog Component
 *
 * Version don gian chi voi Allow/Deny.
 */
export function SimplePermissionDialog({
  title,
  description,
  onAllow,
  onDeny,
  color = 'permission',
}: {
  title: string;
  description?: string;
  onAllow?: () => void;
  onDeny?: () => void;
  color?: string;
}): React.ReactElement {
  return (
    <PermissionDialog
      title={title}
      description={description}
      type="unknown"
      showRememberOptions={false}
      onAllow={() => onAllow?.()}
      onDeny={() => onDeny?.()}
      color={color}
    />
  );
}

/**
 * BashPermissionDialog Component
 *
 * Permission dialog cho Bash commands.
 */
export function BashPermissionDialog({
  command,
  workingDirectory,
  onAllow,
  onDeny,
}: {
  command: string;
  workingDirectory?: string;
  onAllow?: (updates?: PermissionUpdate[]) => void;
  onDeny?: () => void;
}): React.ReactElement {
  return (
    <PermissionDialog
      title="Allow Bash Command?"
      description="The assistant wants to run a shell command"
      type="bash"
      toolName="Bash"
      toolInput={{
        command,
        ...(workingDirectory && { cwd: workingDirectory }),
      }}
      pattern={command.split(' ')[0]} // First word as pattern
      riskLevel="high"
      onAllow={onAllow}
      onDeny={onDeny}
    />
  );
}

/**
 * FilePermissionDialog Component
 *
 * Permission dialog cho file operations.
 */
export function FilePermissionDialog({
  operation,
  filePath,
  content,
  onAllow,
  onDeny,
}: {
  operation: 'read' | 'write' | 'edit';
  filePath: string;
  content?: string;
  onAllow?: (updates?: PermissionUpdate[]) => void;
  onDeny?: () => void;
}): React.ReactElement {
  const operationLabels = {
    read: 'Read File',
    write: 'Write File',
    edit: 'Edit File',
  };

  const permissionTypes: Record<string, PermissionType> = {
    read: 'file_read',
    write: 'file_write',
    edit: 'file_edit',
  };

  return (
    <PermissionDialog
      title={`Allow ${operationLabels[operation]}?`}
      description={`The assistant wants to ${operation} a file`}
      type={permissionTypes[operation]}
      toolName={operationLabels[operation]}
      toolInput={{
        path: filePath,
        ...(content && { content: content.slice(0, 100) + (content.length > 100 ? '...' : '') }),
      }}
      pattern={filePath}
      riskLevel={operation === 'read' ? 'low' : 'high'}
      onAllow={onAllow}
      onDeny={onDeny}
    />
  );
}

export default PermissionDialog;
