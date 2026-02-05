/**
 * Select Component - Menu chon lua cho Ink CLI
 *
 * Component cho phep nguoi dung chon tu danh sach options.
 * Ho tro navigation bang keyboard, highlight, va layout.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box } from './Box';
import { Text } from './Text';

/**
 * Option trong Select menu
 */
export interface SelectOption<T = string> {
  /** Gia tri cua option */
  value: T;

  /** Label hien thi */
  label: string;

  /** Mo ta them (optional) */
  description?: string;

  /** Disable option nay */
  disabled?: boolean;

  /** Hotkey cho option */
  hotkey?: string;
}

/**
 * Props cho Select component
 */
export interface SelectProps<T = string> {
  /** Danh sach options */
  options: SelectOption<T>[];

  /** Gia tri mac dinh */
  defaultValue?: T;

  /** Gia tri dang focus */
  focusValue?: T;

  /** Vo hieu hoa select */
  isDisabled?: boolean;

  /** An index numbers */
  hideIndexes?: boolean;

  /** So options hien thi cung luc */
  visibleOptionCount?: number;

  /** Text de highlight trong labels */
  highlightText?: string;

  /** Layout: vertical (doc) hoac horizontal (ngang) */
  layout?: 'vertical' | 'horizontal';

  /** Vo hieu hoa selection (chi hien thi) */
  disableSelection?: boolean;

  /** Callback khi chon option */
  onChange?: (value: T) => void;

  /** Callback khi huy (Escape) */
  onCancel?: () => void;

  /** Callback khi focus thay doi */
  onFocus?: (value: T) => void;

  /** Ky tu indicator cho item dang chon */
  indicator?: string;

  /** Ky tu indicator cho item chua chon */
  indicatorEmpty?: string;

  /** Mau highlight */
  highlightColor?: string;
}

/**
 * Highlight text match trong string
 */
function highlightMatch(text: string, highlight: string, color: string = 'yellow'): React.ReactElement {
  if (!highlight) {
    return <Text>{text}</Text>;
  }

  const lowerText = text.toLowerCase();
  const lowerHighlight = highlight.toLowerCase();
  const index = lowerText.indexOf(lowerHighlight);

  if (index === -1) {
    return <Text>{text}</Text>;
  }

  const before = text.slice(0, index);
  const match = text.slice(index, index + highlight.length);
  const after = text.slice(index + highlight.length);

  return (
    <Text>
      {before}
      <Text color={color} bold>{match}</Text>
      {after}
    </Text>
  );
}

/**
 * Select Component
 *
 * Menu chon lua voi keyboard navigation.
 * Su dung arrow keys de di chuyen, Enter de chon.
 *
 * @example
 * ```tsx
 * <Select
 *   options={[
 *     { value: 'yes', label: 'Yes' },
 *     { value: 'no', label: 'No' },
 *   ]}
 *   onChange={(value) => console.log('Selected:', value)}
 * />
 * ```
 */
export function Select<T = string>({
  options,
  defaultValue,
  focusValue,
  isDisabled = false,
  hideIndexes = false,
  visibleOptionCount = 5,
  highlightText,
  layout = 'vertical',
  disableSelection = false,
  onChange,
  onCancel,
  onFocus,
  indicator = '>',
  indicatorEmpty = ' ',
  highlightColor = 'cyan',
}: SelectProps<T>): React.ReactElement {
  // Tim index cua option dang chon
  const getInitialIndex = useCallback(() => {
    if (focusValue !== undefined) {
      const idx = options.findIndex(o => o.value === focusValue);
      return idx >= 0 ? idx : 0;
    }
    if (defaultValue !== undefined) {
      const idx = options.findIndex(o => o.value === defaultValue);
      return idx >= 0 ? idx : 0;
    }
    return 0;
  }, [options, focusValue, defaultValue]);

  const [selectedIndex, setSelectedIndex] = useState(getInitialIndex);
  const [scrollOffset, setScrollOffset] = useState(0);

  // Cap nhat scroll offset khi selected index thay doi
  useEffect(() => {
    // Dam bao selected item luon hien thi
    const halfVisible = Math.floor(visibleOptionCount / 2);

    if (selectedIndex < scrollOffset + halfVisible) {
      setScrollOffset(Math.max(0, selectedIndex - halfVisible));
    } else if (selectedIndex >= scrollOffset + visibleOptionCount - halfVisible) {
      setScrollOffset(Math.min(
        options.length - visibleOptionCount,
        selectedIndex - visibleOptionCount + halfVisible + 1
      ));
    }
  }, [selectedIndex, visibleOptionCount, options.length]);

  // Notify focus change
  useEffect(() => {
    if (onFocus && options[selectedIndex]) {
      onFocus(options[selectedIndex].value);
    }
  }, [selectedIndex, options, onFocus]);

  // Keyboard navigation (trong thuc te dung useInput tu Ink)
  // Day chi la logic, event handling se duoc Ink xu ly

  // Tinh toan visible options
  const visibleOptions = options.slice(
    Math.max(0, scrollOffset),
    Math.min(options.length, scrollOffset + visibleOptionCount)
  );

  // Check neu co scroll indicators
  const hasScrollUp = scrollOffset > 0;
  const hasScrollDown = scrollOffset + visibleOptionCount < options.length;

  return (
    <Box flexDirection={layout === 'vertical' ? 'column' : 'row'}>
      {/* Scroll up indicator */}
      {hasScrollUp && layout === 'vertical' && (
        <Text dimColor>  ... ({scrollOffset} more above)</Text>
      )}

      {/* Render visible options */}
      {visibleOptions.map((option, visibleIdx) => {
        const actualIndex = scrollOffset + visibleIdx;
        const isSelected = actualIndex === selectedIndex;
        const isOptionDisabled = option.disabled || isDisabled;

        return (
          <Box
            key={String(option.value)}
            marginRight={layout === 'horizontal' ? 2 : 0}
          >
            {/* Selection indicator */}
            <Text color={isSelected ? highlightColor : undefined}>
              {isSelected ? indicator : indicatorEmpty}
              {' '}
            </Text>

            {/* Index number */}
            {!hideIndexes && (
              <Text dimColor={!isSelected}>
                {actualIndex + 1}.{' '}
              </Text>
            )}

            {/* Hotkey */}
            {option.hotkey && (
              <Text color="yellow">[{option.hotkey}] </Text>
            )}

            {/* Label - voi highlight neu co */}
            {highlightText ? (
              <Box>
                {isSelected ? (
                  <Text bold color={highlightColor}>
                    {highlightMatch(option.label, highlightText, 'yellow').props.children}
                  </Text>
                ) : (
                  highlightMatch(option.label, highlightText)
                )}
              </Box>
            ) : (
              <Text
                bold={isSelected}
                color={isOptionDisabled ? 'gray' : (isSelected ? highlightColor : undefined)}
                dimColor={isOptionDisabled}
                strikethrough={isOptionDisabled}
              >
                {option.label}
              </Text>
            )}

            {/* Description */}
            {option.description && (
              <Text dimColor> - {option.description}</Text>
            )}
          </Box>
        );
      })}

      {/* Scroll down indicator */}
      {hasScrollDown && layout === 'vertical' && (
        <Text dimColor>  ... ({options.length - scrollOffset - visibleOptionCount} more below)</Text>
      )}
    </Box>
  );
}

/**
 * Props cho MultiSelect
 */
export interface MultiSelectProps<T = string> extends Omit<SelectProps<T>, 'onChange'> {
  /** Cac gia tri da chon */
  selectedValues?: T[];

  /** Callback khi selection thay doi */
  onChange?: (values: T[]) => void;

  /** Ky tu checkbox checked */
  checkboxChecked?: string;

  /** Ky tu checkbox unchecked */
  checkboxUnchecked?: string;
}

/**
 * MultiSelect Component
 *
 * Cho phep chon nhieu options.
 * Su dung Space de toggle, Enter de confirm.
 */
export function MultiSelect<T = string>({
  options,
  selectedValues = [],
  onChange,
  checkboxChecked = '[x]',
  checkboxUnchecked = '[ ]',
  ...props
}: MultiSelectProps<T>): React.ReactElement {
  const [selected, setSelected] = useState<Set<T>>(new Set(selectedValues));

  // Them checkbox vao label
  const optionsWithCheckbox = options.map(opt => ({
    ...opt,
    label: `${selected.has(opt.value) ? checkboxChecked : checkboxUnchecked} ${opt.label}`,
  }));

  return (
    <Select
      {...props}
      options={optionsWithCheckbox}
      onChange={(value) => {
        const newSelected = new Set(selected);
        if (newSelected.has(value)) {
          newSelected.delete(value);
        } else {
          newSelected.add(value);
        }
        setSelected(newSelected);
        onChange?.(Array.from(newSelected));
      }}
    />
  );
}

export default Select;
