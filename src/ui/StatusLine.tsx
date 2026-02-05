/**
 * StatusLine Component - Bottom status bar cho Claude Code
 *
 * Hien thi thong tin trang thai o duoi cung cua terminal.
 * Bao gom: mode, model, tokens, shortcuts.
 */

import React from 'react';
import { Box } from './Box';
import { Text } from './Text';

/**
 * Cac mode co the cua Claude Code
 */
export type AppMode = 'code' | 'plan' | 'bash';

/**
 * Props cho StatusLine component
 */
export interface StatusLineProps {
  /** Mode hien tai: code, plan, hoac bash */
  mode: AppMode;

  /** Ten model dang su dung */
  model?: string;

  /** So tokens da su dung */
  tokens?: number;

  /** Max tokens */
  maxTokens?: number;

  /** Toolset dang active */
  toolset?: string;

  /** Hien thi shortcuts */
  showShortcuts?: boolean;

  /** Hien thi bash mode hint */
  showBashHint?: boolean;

  /** Mau cua bash border/hint */
  bashBorderColor?: string;

  /** Custom shortcuts de hien thi */
  customShortcuts?: Array<{ key: string; description: string }>;

  /** Chieu rong cua status line */
  width?: number;

  /** Thong tin them (e.g., branch name, project) */
  extraInfo?: string;
}

/**
 * Format so tokens (e.g., 1234 -> "1.2k")
 */
function formatTokenCount(tokens: number): string {
  if (tokens < 1000) {
    return tokens.toString();
  }
  if (tokens < 1000000) {
    return `${(tokens / 1000).toFixed(1)}k`;
  }
  return `${(tokens / 1000000).toFixed(2)}M`;
}

/**
 * StatusLine Component
 *
 * Status bar hien thi o duoi terminal.
 * Pattern tu source: Contains "! for bash mode" va "? for shortcuts"
 *
 * @example
 * ```tsx
 * <StatusLine
 *   mode="code"
 *   model="claude-opus-4"
 *   tokens={15000}
 *   showShortcuts
 * />
 * ```
 */
export function StatusLine({
  mode,
  model,
  tokens,
  maxTokens,
  toolset,
  showShortcuts = true,
  showBashHint = true,
  bashBorderColor = 'yellow',
  customShortcuts,
  width,
  extraInfo,
}: StatusLineProps): React.ReactElement {
  const modeDisplay = mode.charAt(0).toUpperCase() + mode.slice(1);

  // Tinh toan token usage percentage
  const tokenPercentage = maxTokens && tokens
    ? Math.round((tokens / maxTokens) * 100)
    : undefined;

  // Mau cho token count dua tren usage
  const tokenColor = tokenPercentage
    ? (tokenPercentage > 80 ? 'red' : tokenPercentage > 50 ? 'yellow' : undefined)
    : undefined;

  return (
    <Box
      flexDirection="row"
      justifyContent="space-between"
      width={width || '100%'}
      paddingX={1}
    >
      {/* Left side: Mode, model, tokens */}
      <Box>
        {/* Mode indicator */}
        <Text bold color={mode === 'bash' ? bashBorderColor : 'cyan'}>
          [{modeDisplay}]
        </Text>

        {/* Toolset */}
        {toolset && (
          <Text dimColor> [{toolset}]</Text>
        )}

        {/* Model name */}
        {model && (
          <>
            <Text dimColor> on </Text>
            <Text>{model}</Text>
          </>
        )}

        {/* Token count */}
        {tokens !== undefined && (
          <>
            <Text dimColor> · </Text>
            <Text color={tokenColor}>
              {formatTokenCount(tokens)}
              {maxTokens && (
                <Text dimColor>/{formatTokenCount(maxTokens)}</Text>
              )}
            </Text>
            <Text dimColor> tokens</Text>
          </>
        )}

        {/* Extra info */}
        {extraInfo && (
          <>
            <Text dimColor> · </Text>
            <Text dimColor>{extraInfo}</Text>
          </>
        )}
      </Box>

      {/* Right side: Shortcuts */}
      <Box>
        {/* Bash mode hint */}
        {showBashHint && mode !== 'bash' && (
          <Text color={bashBorderColor}>! for bash mode</Text>
        )}

        {/* Shortcuts hint */}
        {showShortcuts && (
          <>
            {showBashHint && mode !== 'bash' && (
              <Text dimColor> · </Text>
            )}
            <Text dimColor>? for shortcuts</Text>
          </>
        )}

        {/* Custom shortcuts */}
        {customShortcuts && customShortcuts.length > 0 && (
          <>
            <Text dimColor> · </Text>
            {customShortcuts.map((shortcut, index) => (
              <React.Fragment key={shortcut.key}>
                {index > 0 && <Text dimColor> · </Text>}
                <Text color="cyan">{shortcut.key}</Text>
                <Text dimColor> {shortcut.description}</Text>
              </React.Fragment>
            ))}
          </>
        )}
      </Box>
    </Box>
  );
}

/**
 * CompactStatusLine Component
 *
 * Phien ban ngan gon cua StatusLine.
 */
export function CompactStatusLine({
  mode,
  model,
  tokens,
}: {
  mode: AppMode;
  model?: string;
  tokens?: number;
}): React.ReactElement {
  return (
    <Box>
      <Text bold color="cyan">[{mode}]</Text>
      {model && <Text dimColor> {model}</Text>}
      {tokens !== undefined && (
        <Text dimColor> ({formatTokenCount(tokens)})</Text>
      )}
    </Box>
  );
}

/**
 * ModeIndicator Component
 *
 * Chi hien thi mode indicator.
 */
export function ModeIndicator({
  mode,
  showLabel = true,
}: {
  mode: AppMode;
  showLabel?: boolean;
}): React.ReactElement {
  const modeConfig = {
    code: { color: 'cyan', icon: '⚡' },
    plan: { color: 'yellow', icon: '📋' },
    bash: { color: 'orange', icon: '$' },
  };

  const config = modeConfig[mode];

  return (
    <Box>
      <Text color={config.color}>{config.icon}</Text>
      {showLabel && (
        <Text color={config.color} bold> {mode.toUpperCase()}</Text>
      )}
    </Box>
  );
}

/**
 * ShortcutsHelp Component
 *
 * Hien thi danh sach shortcuts.
 */
export interface ShortcutItem {
  key: string;
  description: string;
  mode?: AppMode | 'all';
}

export function ShortcutsHelp({
  shortcuts,
  currentMode,
}: {
  shortcuts: ShortcutItem[];
  currentMode?: AppMode;
}): React.ReactElement {
  // Filter shortcuts theo mode
  const filteredShortcuts = currentMode
    ? shortcuts.filter(s => !s.mode || s.mode === 'all' || s.mode === currentMode)
    : shortcuts;

  return (
    <Box flexDirection="column" padding={1} borderStyle="single" borderColor="gray">
      <Text bold color="cyan">Keyboard Shortcuts</Text>
      <Text dimColor>─────────────────</Text>
      {filteredShortcuts.map(shortcut => (
        <Box key={shortcut.key}>
          <Text color="yellow" bold>{shortcut.key.padEnd(10)}</Text>
          <Text dimColor>{shortcut.description}</Text>
        </Box>
      ))}
    </Box>
  );
}

export default StatusLine;
