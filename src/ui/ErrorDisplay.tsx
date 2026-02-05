/**
 * ErrorDisplay Component - Hien thi error messages
 *
 * Component de render cac loai error message khac nhau.
 * Ho tro stack traces, suggestions, va error recovery.
 *
 * Pattern: b4A -> ErrorDisplay
 */

import React, { useState } from 'react';
import { Box } from './Box';
import { Text } from './Text';
import { Divider } from './Divider';

/**
 * Error severity levels
 */
export type ErrorSeverity = 'error' | 'warning' | 'info' | 'debug';

/**
 * Error category
 */
export type ErrorCategory =
  | 'network'
  | 'permission'
  | 'validation'
  | 'timeout'
  | 'not_found'
  | 'parse'
  | 'internal'
  | 'unknown';

/**
 * Suggestion for fixing error
 */
export interface ErrorSuggestion {
  /** Suggestion text */
  text: string;

  /** Command or action to run */
  action?: string;

  /** Hotkey to apply suggestion */
  hotkey?: string;
}

/**
 * Props cho ErrorDisplay component
 */
export interface ErrorDisplayProps {
  /** Error message */
  message: string;

  /** Error code (neu co) */
  code?: string;

  /** Error severity */
  severity?: ErrorSeverity;

  /** Error category */
  category?: ErrorCategory;

  /** Stack trace */
  stack?: string;

  /** Suggestions de fix */
  suggestions?: ErrorSuggestion[];

  /** Context information */
  context?: Record<string, unknown>;

  /** Hien thi stack trace */
  showStack?: boolean;

  /** Hien thi context */
  showContext?: boolean;

  /** Collapsible */
  collapsible?: boolean;

  /** Default collapsed */
  defaultCollapsed?: boolean;

  /** Compact mode */
  compact?: boolean;

  /** Border style */
  borderStyle?: 'single' | 'double' | 'round' | 'bold';

  /** Action buttons/links */
  actions?: Array<{
    label: string;
    action: () => void;
  }>;

  /** Callback khi dismiss */
  onDismiss?: () => void;
}

/**
 * Severity configs
 */
const SEVERITY_CONFIG: Record<ErrorSeverity, { icon: string; color: string }> = {
  error: { icon: '✗', color: 'red' },
  warning: { icon: '⚠', color: 'yellow' },
  info: { icon: 'ℹ', color: 'cyan' },
  debug: { icon: '🔍', color: 'gray' },
};

/**
 * Category icons
 */
const CATEGORY_ICONS: Record<ErrorCategory, string> = {
  network: '🌐',
  permission: '🔒',
  validation: '✓',
  timeout: '⏱',
  not_found: '🔍',
  parse: '📄',
  internal: '⚙',
  unknown: '❓',
};

/**
 * Clean stack trace (remove node internals)
 */
function cleanStackTrace(stack: string, maxLines: number = 10): string {
  const lines = stack.split('\n');
  const cleanedLines = lines
    .filter(line => !line.includes('node:internal'))
    .filter(line => !line.includes('node_modules'))
    .slice(0, maxLines);

  return cleanedLines.join('\n');
}

/**
 * ErrorDisplay Component
 *
 * Hien thi error message voi context.
 *
 * @example
 * ```tsx
 * <ErrorDisplay
 *   message="Failed to read file"
 *   code="ENOENT"
 *   severity="error"
 *   category="not_found"
 *   suggestions={[
 *     { text: "Check if the file exists" },
 *     { text: "Run: ls -la", action: "ls -la" }
 *   ]}
 * />
 * ```
 */
export function ErrorDisplay({
  message,
  code,
  severity = 'error',
  category,
  stack,
  suggestions,
  context,
  showStack = false,
  showContext = false,
  collapsible = true,
  defaultCollapsed = true,
  compact = false,
  borderStyle = 'single',
  actions,
  onDismiss,
}: ErrorDisplayProps): React.ReactElement {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const { icon, color } = SEVERITY_CONFIG[severity];
  const categoryIcon = category ? CATEGORY_ICONS[category] : undefined;

  return (
    <Box
      flexDirection="column"
      borderStyle={borderStyle}
      borderColor={color}
      marginY={compact ? 0 : 1}
    >
      {/* Header */}
      <Box paddingX={1} justifyContent="space-between">
        <Box>
          <Text color={color}>{icon} </Text>
          {categoryIcon && <Text>{categoryIcon} </Text>}
          <Text bold color={color}>
            {severity.charAt(0).toUpperCase() + severity.slice(1)}
          </Text>
          {code && (
            <Text dimColor> [{code}]</Text>
          )}
        </Box>

        {onDismiss && (
          <Text dimColor>[x]</Text>
        )}
      </Box>

      {/* Divider */}
      <Box paddingX={1}>
        <Divider dividerDimColor width={40} />
      </Box>

      {/* Main message */}
      <Box paddingX={1}>
        <Text color={color}>{message}</Text>
      </Box>

      {/* Suggestions */}
      {suggestions && suggestions.length > 0 && (
        <Box flexDirection="column" paddingX={1} marginTop={1}>
          <Text dimColor>Suggestions:</Text>
          {suggestions.map((suggestion, index) => (
            <Box key={index} paddingLeft={2}>
              <Text dimColor>• </Text>
              <Text>{suggestion.text}</Text>
              {suggestion.action && (
                <Text color="cyan"> ({suggestion.action})</Text>
              )}
              {suggestion.hotkey && (
                <Text dimColor> [{suggestion.hotkey}]</Text>
              )}
            </Box>
          ))}
        </Box>
      )}

      {/* Collapsible sections */}
      {collapsible && (stack || context) && (
        <Box paddingX={1} marginTop={1}>
          <Text
            dimColor
            italic
            // onClick would toggle collapse in real implementation
          >
            [{collapsed ? 'Show details' : 'Hide details'}]
          </Text>
        </Box>
      )}

      {/* Stack trace */}
      {showStack && stack && !collapsed && (
        <Box flexDirection="column" paddingX={1} marginTop={1}>
          <Text dimColor>Stack trace:</Text>
          <Box
            borderStyle="single"
            borderColor="gray"
            paddingX={1}
            marginTop={1}
          >
            <Text dimColor>{cleanStackTrace(stack)}</Text>
          </Box>
        </Box>
      )}

      {/* Context */}
      {showContext && context && !collapsed && (
        <Box flexDirection="column" paddingX={1} marginTop={1}>
          <Text dimColor>Context:</Text>
          <Box paddingLeft={2}>
            {Object.entries(context).map(([key, value]) => (
              <Box key={key}>
                <Text color="cyan">{key}: </Text>
                <Text>
                  {typeof value === 'string'
                    ? value
                    : JSON.stringify(value)}
                </Text>
              </Box>
            ))}
          </Box>
        </Box>
      )}

      {/* Actions */}
      {actions && actions.length > 0 && (
        <Box paddingX={1} marginTop={1} gap={2}>
          {actions.map((action, index) => (
            <Text key={index} color="cyan">[{action.label}]</Text>
          ))}
        </Box>
      )}
    </Box>
  );
}

/**
 * InlineError Component
 *
 * Compact inline error display.
 */
export function InlineError({
  message,
  severity = 'error',
}: {
  message: string;
  severity?: ErrorSeverity;
}): React.ReactElement {
  const { icon, color } = SEVERITY_CONFIG[severity];

  return (
    <Box>
      <Text color={color}>{icon} </Text>
      <Text color={color}>{message}</Text>
    </Box>
  );
}

/**
 * ErrorBoundaryFallback Component
 *
 * Fallback UI khi component crash.
 */
export function ErrorBoundaryFallback({
  error,
  resetError,
}: {
  error: Error;
  resetError?: () => void;
}): React.ReactElement {
  return (
    <ErrorDisplay
      message={error.message}
      severity="error"
      category="internal"
      stack={error.stack}
      showStack={true}
      suggestions={[
        { text: 'Try refreshing the application' },
        { text: 'Check the console for more details' },
      ]}
      actions={resetError ? [{ label: 'Retry', action: resetError }] : undefined}
    />
  );
}

/**
 * NetworkError Component
 *
 * Error display cho network issues.
 */
export function NetworkError({
  message,
  url,
  statusCode,
  onRetry,
}: {
  message: string;
  url?: string;
  statusCode?: number;
  onRetry?: () => void;
}): React.ReactElement {
  return (
    <ErrorDisplay
      message={message}
      code={statusCode?.toString()}
      severity="error"
      category="network"
      context={url ? { url } : undefined}
      showContext={!!url}
      suggestions={[
        { text: 'Check your internet connection' },
        { text: 'Verify the URL is correct' },
        { text: 'Try again later' },
      ]}
      actions={onRetry ? [{ label: 'Retry', action: onRetry }] : undefined}
    />
  );
}

/**
 * ValidationError Component
 *
 * Error display cho validation issues.
 */
export function ValidationError({
  field,
  message,
  expectedType,
  actualValue,
}: {
  field: string;
  message: string;
  expectedType?: string;
  actualValue?: unknown;
}): React.ReactElement {
  return (
    <ErrorDisplay
      message={message}
      severity="warning"
      category="validation"
      context={{
        field,
        ...(expectedType && { expectedType }),
        ...(actualValue !== undefined && { actualValue: String(actualValue) }),
      }}
      showContext={true}
      compact={true}
    />
  );
}

/**
 * PermissionError Component
 *
 * Error display cho permission issues.
 */
export function PermissionError({
  resource,
  action,
  message,
}: {
  resource: string;
  action: string;
  message?: string;
}): React.ReactElement {
  return (
    <ErrorDisplay
      message={message || `Permission denied: cannot ${action} ${resource}`}
      severity="error"
      category="permission"
      context={{ resource, action }}
      showContext={true}
      suggestions={[
        { text: 'Check file permissions' },
        { text: `Run: chmod +rw ${resource}`, action: `chmod +rw ${resource}` },
      ]}
    />
  );
}

/**
 * TimeoutError Component
 *
 * Error display cho timeout issues.
 */
export function TimeoutError({
  operation,
  timeout,
  onRetry,
}: {
  operation: string;
  timeout: number;
  onRetry?: () => void;
}): React.ReactElement {
  return (
    <ErrorDisplay
      message={`${operation} timed out after ${timeout}ms`}
      severity="error"
      category="timeout"
      suggestions={[
        { text: 'The operation is taking longer than expected' },
        { text: 'Try again or increase timeout' },
      ]}
      actions={onRetry ? [{ label: 'Retry', action: onRetry }] : undefined}
    />
  );
}

/**
 * ErrorList Component
 *
 * Hien thi nhieu errors.
 */
export function ErrorList({
  errors,
  title,
  compact = true,
}: {
  errors: Array<{ message: string; severity?: ErrorSeverity }>;
  title?: string;
  compact?: boolean;
}): React.ReactElement {
  return (
    <Box flexDirection="column">
      {title && (
        <Text bold color="red">{title}</Text>
      )}
      {errors.map((error, index) => (
        <InlineError
          key={index}
          message={error.message}
          severity={error.severity}
        />
      ))}
    </Box>
  );
}

export default ErrorDisplay;
