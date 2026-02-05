/**
 * Input Component - Text input cho Ink CLI
 *
 * Component cho phep nguoi dung nhap text trong terminal.
 * Su dung useInput hook tu Ink de xu ly keyboard events.
 */

import React, { useState, useCallback } from 'react';
import { Box } from './Box';
import { Text } from './Text';

/**
 * Props cho TextInput component
 */
export interface TextInputProps {
  /** Gia tri hien tai */
  value?: string;

  /** Placeholder khi chua co input */
  placeholder?: string;

  /** Callback khi gia tri thay doi */
  onChange?: (value: string) => void;

  /** Callback khi nhan Enter */
  onSubmit?: (value: string) => void;

  /** Focus vao input */
  focus?: boolean;

  /** An ky tu (cho password) */
  mask?: string;

  /** Mau text */
  color?: string;

  /** Hien thi cursor */
  showCursor?: boolean;

  /** Ky tu cursor */
  cursorChar?: string;

  /** Prefix truoc input */
  prefix?: string;

  /** Vo hieu hoa input */
  isDisabled?: boolean;
}

/**
 * TextInput Component
 *
 * Cho phep nhap text trong terminal.
 * Hien thi cursor va placeholder.
 *
 * @example
 * ```tsx
 * const [value, setValue] = useState('');
 * <TextInput
 *   value={value}
 *   onChange={setValue}
 *   onSubmit={(text) => console.log('Submitted:', text)}
 *   placeholder="Nhap lenh..."
 * />
 * ```
 */
export function TextInput({
  value = '',
  placeholder = '',
  onChange,
  onSubmit,
  focus = true,
  mask,
  color,
  showCursor = true,
  cursorChar = '|',
  prefix = '> ',
  isDisabled = false,
}: TextInputProps): React.ReactElement {
  const [cursorPosition, setCursorPosition] = useState(value.length);
  const [cursorVisible, setCursorVisible] = useState(true);

  // Cursor blink effect
  React.useEffect(() => {
    if (!showCursor || !focus) return;

    const interval = setInterval(() => {
      setCursorVisible(prev => !prev);
    }, 500);

    return () => clearInterval(interval);
  }, [showCursor, focus]);

  // Hien thi text voi mask neu can
  const displayValue = mask ? mask.repeat(value.length) : value;

  // Tach text truoc va sau cursor
  const textBeforeCursor = displayValue.slice(0, cursorPosition);
  const textAfterCursor = displayValue.slice(cursorPosition);

  // Xac dinh cursor character
  const cursor = focus && cursorVisible && showCursor ? cursorChar : ' ';

  // Render placeholder neu khong co value
  const showPlaceholder = value.length === 0 && placeholder;

  return (
    <Box>
      {/* Prefix (e.g., "> ") */}
      <Text color="cyan">{prefix}</Text>

      {showPlaceholder ? (
        // Hien thi placeholder
        <Text dimColor>{placeholder}</Text>
      ) : (
        // Hien thi text voi cursor
        <>
          <Text color={color}>{textBeforeCursor}</Text>
          <Text color="cyan" inverse={focus && cursorVisible}>
            {textAfterCursor.charAt(0) || ' '}
          </Text>
          <Text color={color}>{textAfterCursor.slice(1)}</Text>
        </>
      )}
    </Box>
  );
}

/**
 * Props cho PasswordInput
 */
export interface PasswordInputProps extends Omit<TextInputProps, 'mask'> {
  /** Ky tu mask (mac dinh: '*') */
  maskChar?: string;
}

/**
 * PasswordInput Component
 *
 * TextInput voi mask cho mat khau.
 */
export function PasswordInput({
  maskChar = '*',
  ...props
}: PasswordInputProps): React.ReactElement {
  return <TextInput {...props} mask={maskChar} />;
}

/**
 * Props cho MultilineInput
 */
export interface MultilineInputProps {
  /** Gia tri hien tai */
  value?: string;

  /** Placeholder */
  placeholder?: string;

  /** Callback khi thay doi */
  onChange?: (value: string) => void;

  /** Callback khi submit (Ctrl+Enter) */
  onSubmit?: (value: string) => void;

  /** So dong hien thi */
  rows?: number;

  /** Focus */
  focus?: boolean;
}

/**
 * MultilineInput Component
 *
 * Input cho phep nhap nhieu dong.
 * Submit bang Ctrl+Enter.
 */
export function MultilineInput({
  value = '',
  placeholder = '',
  onChange,
  onSubmit,
  rows = 3,
  focus = true,
}: MultilineInputProps): React.ReactElement {
  const lines = value.split('\n');
  const displayLines = Math.min(lines.length, rows);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" padding={1}>
      {lines.slice(-rows).map((line, index) => (
        <Text key={index}>{line || ' '}</Text>
      ))}
      {value.length === 0 && (
        <Text dimColor>{placeholder}</Text>
      )}
      <Box marginTop={1}>
        <Text dimColor>Ctrl+Enter de gui</Text>
      </Box>
    </Box>
  );
}

export default TextInput;
