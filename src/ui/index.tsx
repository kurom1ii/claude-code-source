/**
 * UI Components Index - Export tat ca UI components
 *
 * Day la entry point cho UI components cua Claude Code.
 * Import tu day de su dung cac components.
 *
 * @example
 * ```tsx
 * import { Box, Text, Select, Thinker } from './ui';
 * ```
 */

// ============================================================================
// Core Components
// ============================================================================

export {
  Box,
  BoxRow,
  BoxColumn,
  type BoxProps
} from './Box';

export {
  Text,
  BoldText,
  DimText,
  ErrorText,
  SuccessText,
  WarningText,
  InfoText,
  type TextProps
} from './Text';

// ============================================================================
// Input Components
// ============================================================================

export {
  TextInput,
  PasswordInput,
  MultilineInput,
  type TextInputProps,
  type PasswordInputProps,
  type MultilineInputProps,
} from './Input';

export {
  Select,
  MultiSelect,
  type SelectProps,
  type MultiSelectProps,
  type SelectOption,
} from './Select';

// ============================================================================
// Feedback Components
// ============================================================================

export {
  Spinner,
  LoadingDots,
  ProgressBar,
  SPINNER_TYPES,
  type SpinnerProps,
  type SpinnerType,
  type ProgressBarProps,
} from './Spinner';

export {
  Thinker,
  SimpleThinker,
  WorkingIndicator,
  DEFAULT_THINKING_VERBS,
  DEFAULT_SPINNER_PHASES,
  type ThinkerProps,
} from './Thinker';

// ============================================================================
// Layout Components
// ============================================================================

export {
  Divider,
  HorizontalLine,
  SectionHeader,
  DIVIDER_CHARS,
  type DividerProps,
  type DividerCharType,
} from './Divider';

// ============================================================================
// Display Components
// ============================================================================

export {
  StatusLine,
  CompactStatusLine,
  ModeIndicator,
  ShortcutsHelp,
  type StatusLineProps,
  type AppMode,
  type ShortcutItem,
} from './StatusLine';

export {
  MessageDisplay,
  MessageList,
  SystemMessage,
  type MessageDisplayProps,
  type MessageListProps,
  type Message,
  type MessageRole,
  type ContentBlock,
  type ContentType,
} from './MessageDisplay';

export {
  ToolOutput,
  BashOutput,
  FileOutput,
  ToolOutputList,
  type ToolOutputProps,
  type ToolOutputItem,
  type ToolType,
  type ToolStatus,
} from './ToolOutput';

// ============================================================================
// Dialog Components
// ============================================================================

export {
  PermissionDialog,
  SimplePermissionDialog,
  BashPermissionDialog,
  FilePermissionDialog,
  type PermissionDialogProps,
  type PermissionType,
  type PermissionDecision,
  type PermissionUpdate,
} from './PermissionDialog';

export {
  ConfirmationPrompt,
  YesNoPrompt,
  DeleteConfirmation,
  SaveChangesPrompt,
  RetryPrompt,
  MultiChoicePrompt,
  type ConfirmationPromptProps,
  type ConfirmationOption,
} from './ConfirmationPrompt';

// ============================================================================
// Error Components
// ============================================================================

export {
  ErrorDisplay,
  InlineError,
  ErrorBoundaryFallback,
  NetworkError,
  ValidationError,
  PermissionError,
  TimeoutError,
  ErrorList,
  type ErrorDisplayProps,
  type ErrorSeverity,
  type ErrorCategory,
  type ErrorSuggestion,
} from './ErrorDisplay';

// ============================================================================
// Code Display Components
// ============================================================================

export {
  CodeBlock,
  InlineCode,
  DiffBlock,
  JsonBlock,
  ShellBlock,
  CodeSnippet,
  type CodeBlockProps,
  type SupportedLanguage,
  type TokenType,
  type CodeToken,
  type CodeLine,
} from './CodeBlock';

// ============================================================================
// Theme System
// ============================================================================

export {
  // Themes
  LIGHT_THEME,
  DARK_THEME,
  MONOKAI_THEME,
  SOLARIZED_THEME,
  THEMES,
  getThemeColors,

  // Provider & Hook
  ThemeProvider,
  useTheme,
  withTheme,
  ThemeSelector,

  // Types
  type ThemeColors,
  type ThemeId,
  type ThemeContextType,
  type ThemeProviderProps,
} from './Theme';

// ============================================================================
// Default Export - All components as object
// ============================================================================

import { Box, BoxRow, BoxColumn } from './Box';
import { Text, BoldText, DimText, ErrorText, SuccessText, WarningText, InfoText } from './Text';
import { TextInput, PasswordInput, MultilineInput } from './Input';
import { Select, MultiSelect } from './Select';
import { Spinner, LoadingDots, ProgressBar } from './Spinner';
import { Thinker, SimpleThinker, WorkingIndicator } from './Thinker';
import { Divider, HorizontalLine, SectionHeader } from './Divider';
import { StatusLine, CompactStatusLine, ModeIndicator, ShortcutsHelp } from './StatusLine';
import { MessageDisplay, MessageList, SystemMessage } from './MessageDisplay';
import { ToolOutput, BashOutput, FileOutput, ToolOutputList } from './ToolOutput';
import { ThemeProvider, useTheme, ThemeSelector } from './Theme';
import { PermissionDialog, SimplePermissionDialog, BashPermissionDialog, FilePermissionDialog } from './PermissionDialog';
import { ConfirmationPrompt, YesNoPrompt, DeleteConfirmation, SaveChangesPrompt, RetryPrompt, MultiChoicePrompt } from './ConfirmationPrompt';
import { ErrorDisplay, InlineError, ErrorBoundaryFallback, NetworkError, ValidationError, PermissionError as PermissionErrorComponent, TimeoutError, ErrorList } from './ErrorDisplay';
import { CodeBlock, InlineCode, DiffBlock, JsonBlock, ShellBlock, CodeSnippet } from './CodeBlock';

/**
 * UI namespace - chua tat ca components
 */
const UI = {
  // Core
  Box,
  BoxRow,
  BoxColumn,
  Text,
  BoldText,
  DimText,
  ErrorText,
  SuccessText,
  WarningText,
  InfoText,

  // Input
  TextInput,
  PasswordInput,
  MultilineInput,
  Select,
  MultiSelect,

  // Feedback
  Spinner,
  LoadingDots,
  ProgressBar,
  Thinker,
  SimpleThinker,
  WorkingIndicator,

  // Layout
  Divider,
  HorizontalLine,
  SectionHeader,

  // Display
  StatusLine,
  CompactStatusLine,
  ModeIndicator,
  ShortcutsHelp,
  MessageDisplay,
  MessageList,
  SystemMessage,
  ToolOutput,
  BashOutput,
  FileOutput,
  ToolOutputList,

  // Dialog
  PermissionDialog,
  SimplePermissionDialog,
  BashPermissionDialog,
  FilePermissionDialog,
  ConfirmationPrompt,
  YesNoPrompt,
  DeleteConfirmation,
  SaveChangesPrompt,
  RetryPrompt,
  MultiChoicePrompt,

  // Error
  ErrorDisplay,
  InlineError,
  ErrorBoundaryFallback,
  NetworkError,
  ValidationError,
  PermissionErrorComponent,
  TimeoutError,
  ErrorList,

  // Code
  CodeBlock,
  InlineCode,
  DiffBlock,
  JsonBlock,
  ShellBlock,
  CodeSnippet,

  // Theme
  ThemeProvider,
  useTheme,
  ThemeSelector,
};

export default UI;
