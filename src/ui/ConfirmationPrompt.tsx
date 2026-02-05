/**
 * ConfirmationPrompt Component - Generic yes/no confirmation dialog
 *
 * Component de hien thi dialog xac nhan voi cac lua chon yes/no.
 * Dung cho cac thao tac can xac nhan tu nguoi dung.
 *
 * Pattern: G1z -> ConfirmationPrompt
 */

import React, { useCallback } from 'react';
import { Box } from './Box';
import { Text } from './Text';
import { Select, SelectOption } from './Select';
import { Divider } from './Divider';

/**
 * Confirmation option
 */
export interface ConfirmationOption<T = string> {
  /** Gia tri */
  value: T;

  /** Label hien thi */
  label: string;

  /** Mo ta them */
  description?: string;

  /** Hotkey */
  hotkey?: string;

  /** La option nguy hiem (destructive) */
  isDestructive?: boolean;
}

/**
 * Props cho ConfirmationPrompt component
 */
export interface ConfirmationPromptProps<T = string> {
  /** Tieu de cua dialog */
  title: string;

  /** Mo ta them */
  subtitle?: string;

  /** Noi dung chi tiet */
  description?: React.ReactNode;

  /** Cac options (mac dinh: Yes/No) */
  options?: ConfirmationOption<T>[];

  /** Callback khi chon option */
  onSelect?: (value: T) => void;

  /** Callback khi confirm (chon Yes) */
  onConfirm?: () => void;

  /** Callback khi cancel (chon No hoac Esc) */
  onCancel?: () => void;

  /** Mau cua dialog */
  color?: string;

  /** Dim border color */
  borderDimColor?: boolean;

  /** An input guide */
  hideInputGuide?: boolean;

  /** An border */
  hideBorder?: boolean;

  /** Custom input guide */
  inputGuide?: string;

  /** Layout: vertical hoac horizontal */
  layout?: 'vertical' | 'horizontal';

  /** Default value */
  defaultValue?: T;
}

/**
 * Default options (Yes/No)
 */
const DEFAULT_OPTIONS: ConfirmationOption<string>[] = [
  { value: 'yes', label: 'Yes', hotkey: 'y' },
  { value: 'no', label: 'No', hotkey: 'n' },
];

/**
 * ConfirmationPrompt Component
 *
 * Hien thi dialog xac nhan voi options.
 *
 * @example
 * ```tsx
 * <ConfirmationPrompt
 *   title="Delete file?"
 *   subtitle="This action cannot be undone"
 *   onConfirm={() => deleteFile()}
 *   onCancel={() => setShowDialog(false)}
 * />
 * ```
 */
export function ConfirmationPrompt<T = string>({
  title,
  subtitle,
  description,
  options,
  onSelect,
  onConfirm,
  onCancel,
  color = 'warning',
  borderDimColor = true,
  hideInputGuide = false,
  hideBorder = false,
  inputGuide,
  layout = 'vertical',
  defaultValue,
}: ConfirmationPromptProps<T>): React.ReactElement {
  // Use default options if not provided
  const confirmOptions = (options || DEFAULT_OPTIONS) as ConfirmationOption<T>[];

  const handleSelect = useCallback((value: T) => {
    if (onSelect) {
      onSelect(value);
    } else {
      // Default behavior: treat 'yes' as confirm, 'no' as cancel
      if (value === 'yes') {
        onConfirm?.();
      } else {
        onCancel?.();
      }
    }
  }, [onSelect, onConfirm, onCancel]);

  // Convert to SelectOption format
  const selectOptions: SelectOption<T>[] = confirmOptions.map(opt => ({
    value: opt.value,
    label: opt.label,
    description: opt.description,
    hotkey: opt.hotkey,
  }));

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
        {/* Title & Subtitle */}
        <Box flexDirection="column">
          <Text bold color={color}>{title}</Text>
          {subtitle && (
            <Text dimColor>{subtitle}</Text>
          )}
        </Box>

        {/* Description */}
        {description && (
          <Box paddingLeft={1}>
            {typeof description === 'string' ? (
              <Text>{description}</Text>
            ) : (
              description
            )}
          </Box>
        )}

        {/* Options */}
        <Select
          options={selectOptions}
          onChange={handleSelect}
          layout={layout}
          indicator=">"
          indicatorEmpty=" "
          highlightColor="cyan"
          defaultValue={defaultValue}
        />
      </Box>

      {/* Input guide */}
      {!hideInputGuide && (
        <Box paddingX={hideBorder ? 0 : 1}>
          <Text dimColor italic>
            {inputGuide || 'Enter to confirm, Esc to cancel'}
          </Text>
        </Box>
      )}
    </Box>
  );
}

/**
 * YesNoPrompt Component
 *
 * Simple yes/no confirmation.
 */
export function YesNoPrompt({
  title,
  subtitle,
  description,
  onConfirm,
  onCancel,
  yesLabel = 'Yes',
  noLabel = 'No',
  color = 'warning',
}: {
  title: string;
  subtitle?: string;
  description?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
  yesLabel?: string;
  noLabel?: string;
  color?: string;
}): React.ReactElement {
  const options: ConfirmationOption<string>[] = [
    { value: 'yes', label: yesLabel, hotkey: 'y' },
    { value: 'no', label: noLabel, hotkey: 'n' },
  ];

  return (
    <ConfirmationPrompt
      title={title}
      subtitle={subtitle}
      description={description}
      options={options}
      onConfirm={onConfirm}
      onCancel={onCancel}
      color={color}
    />
  );
}

/**
 * DeleteConfirmation Component
 *
 * Confirmation cho delete operations.
 */
export function DeleteConfirmation({
  itemName,
  itemType = 'item',
  onConfirm,
  onCancel,
}: {
  itemName: string;
  itemType?: string;
  onConfirm?: () => void;
  onCancel?: () => void;
}): React.ReactElement {
  return (
    <ConfirmationPrompt
      title={`Delete ${itemType}?`}
      subtitle={itemName}
      description={
        <Text color="red">
          This action cannot be undone.
        </Text>
      }
      options={[
        { value: 'yes', label: `Yes, delete ${itemType}`, isDestructive: true },
        { value: 'no', label: 'No, keep it' },
      ]}
      onConfirm={onConfirm}
      onCancel={onCancel}
      color="error"
    />
  );
}

/**
 * SaveChangesPrompt Component
 *
 * Prompt truoc khi thoat khi co unsaved changes.
 */
export function SaveChangesPrompt({
  fileName,
  onSave,
  onDiscard,
  onCancel,
}: {
  fileName?: string;
  onSave?: () => void;
  onDiscard?: () => void;
  onCancel?: () => void;
}): React.ReactElement {
  const options: ConfirmationOption<string>[] = [
    { value: 'save', label: 'Save changes', hotkey: 's' },
    { value: 'discard', label: 'Discard changes', isDestructive: true, hotkey: 'd' },
    { value: 'cancel', label: 'Cancel', hotkey: 'c' },
  ];

  return (
    <ConfirmationPrompt
      title="Unsaved Changes"
      subtitle={fileName ? `File: ${fileName}` : undefined}
      description="You have unsaved changes. What would you like to do?"
      options={options}
      onSelect={(value) => {
        switch (value) {
          case 'save':
            onSave?.();
            break;
          case 'discard':
            onDiscard?.();
            break;
          case 'cancel':
            onCancel?.();
            break;
        }
      }}
      color="warning"
    />
  );
}

/**
 * RetryPrompt Component
 *
 * Prompt de retry mot operation.
 */
export function RetryPrompt({
  operation,
  error,
  onRetry,
  onCancel,
}: {
  operation: string;
  error?: string;
  onRetry?: () => void;
  onCancel?: () => void;
}): React.ReactElement {
  return (
    <ConfirmationPrompt
      title={`${operation} Failed`}
      subtitle={error}
      description="Would you like to try again?"
      options={[
        { value: 'yes', label: 'Retry', hotkey: 'r' },
        { value: 'no', label: 'Cancel' },
      ]}
      onConfirm={onRetry}
      onCancel={onCancel}
      color="error"
    />
  );
}

/**
 * MultiChoicePrompt Component
 *
 * Prompt voi nhieu lua chon.
 */
export function MultiChoicePrompt<T = string>({
  title,
  subtitle,
  description,
  choices,
  onSelect,
  onCancel,
  color = 'info',
}: {
  title: string;
  subtitle?: string;
  description?: string;
  choices: Array<{ value: T; label: string; description?: string }>;
  onSelect?: (value: T) => void;
  onCancel?: () => void;
  color?: string;
}): React.ReactElement {
  return (
    <ConfirmationPrompt
      title={title}
      subtitle={subtitle}
      description={description}
      options={choices}
      onSelect={onSelect}
      onCancel={onCancel}
      color={color}
    />
  );
}

export default ConfirmationPrompt;
