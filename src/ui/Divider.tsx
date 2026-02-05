/**
 * Divider Component - Visual separator cho Ink CLI
 *
 * Component de tao duong ke ngang hoac doc trong terminal.
 * Ho tro title o giua va nhieu kieu ky tu.
 */

import React from 'react';
import { Box, BoxProps } from './Box';
import { Text } from './Text';

/**
 * Props cho Divider component
 */
export interface DividerProps {
  /** Huong cua divider: ngang hoac doc */
  orientation?: 'horizontal' | 'vertical';

  /** Title hien thi o giua divider */
  title?: string;

  /** Chieu rong (cho horizontal) hoac cao (cho vertical) */
  width?: number;

  /** Padding xung quanh divider */
  padding?: number;

  /** Padding xung quanh title */
  titlePadding?: number;

  /** Mau title */
  titleColor?: string;

  /** Dim title */
  titleDimColor?: boolean;

  /** Bold title */
  titleBold?: boolean;

  /** Ky tu dung de ve divider */
  dividerChar?: string;

  /** Mau divider */
  dividerColor?: string;

  /** Dim divider */
  dividerDimColor?: boolean;

  /** Props them cho Box container */
  boxProps?: BoxProps;

  /** Vi tri title: trai, giua, hoac phai */
  titleAlign?: 'left' | 'center' | 'right';
}

/**
 * Cac ky tu divider co san
 */
export const DIVIDER_CHARS = {
  /** Duong ke don */
  single: '─',

  /** Duong ke doi */
  double: '═',

  /** Duong ke dam */
  bold: '━',

  /** Duong ke cham */
  dotted: '·',

  /** Duong ke gach ngang */
  dashed: '-',

  /** Duong ke doc */
  vertical: '│',

  /** Duong ke doc doi */
  verticalDouble: '║',

  /** Duong ke doc dam */
  verticalBold: '┃',
} as const;

export type DividerCharType = keyof typeof DIVIDER_CHARS;

/**
 * Divider Component
 *
 * Tao duong ke de phan cach noi dung.
 *
 * @example
 * ```tsx
 * // Divider don gian
 * <Divider />
 *
 * // Divider voi title
 * <Divider title="Section Header" />
 *
 * // Divider doc
 * <Divider orientation="vertical" />
 * ```
 */
export function Divider({
  orientation = 'horizontal',
  title,
  width,
  padding = 0,
  titlePadding = 1,
  titleColor,
  titleDimColor = false,
  titleBold = false,
  dividerChar,
  dividerColor,
  dividerDimColor = true,
  boxProps = {},
  titleAlign = 'center',
}: DividerProps): React.ReactElement {
  // Chon ky tu divider
  const char = dividerChar || (orientation === 'horizontal' ? DIVIDER_CHARS.single : DIVIDER_CHARS.vertical);

  // Vertical divider - don gian chi la ky tu doc
  if (orientation === 'vertical') {
    return (
      <Box {...boxProps} paddingX={padding}>
        <Text color={dividerColor} dimColor={dividerDimColor}>
          {char}
        </Text>
      </Box>
    );
  }

  // Horizontal divider
  const totalWidth = width || 40;

  // Divider khong co title
  if (!title) {
    const dividerLine = char.repeat(totalWidth);

    return (
      <Box {...boxProps} paddingY={padding}>
        <Text color={dividerColor} dimColor={dividerDimColor}>
          {dividerLine}
        </Text>
      </Box>
    );
  }

  // Divider co title
  const titlePaddingStr = ' '.repeat(titlePadding);
  const titleWithPadding = `${titlePaddingStr}${title}${titlePaddingStr}`;
  const titleLength = titleWithPadding.length;
  const remainingWidth = Math.max(0, totalWidth - titleLength);

  let leftWidth: number;
  let rightWidth: number;

  switch (titleAlign) {
    case 'left':
      leftWidth = 2;
      rightWidth = remainingWidth - 2;
      break;
    case 'right':
      leftWidth = remainingWidth - 2;
      rightWidth = 2;
      break;
    case 'center':
    default:
      leftWidth = Math.floor(remainingWidth / 2);
      rightWidth = remainingWidth - leftWidth;
      break;
  }

  const leftSide = char.repeat(Math.max(0, leftWidth));
  const rightSide = char.repeat(Math.max(0, rightWidth));

  return (
    <Box {...boxProps} paddingY={padding}>
      <Text color={dividerColor} dimColor={dividerDimColor}>
        {leftSide}
      </Text>
      <Text color={titleColor} dimColor={titleDimColor} bold={titleBold}>
        {titleWithPadding}
      </Text>
      <Text color={dividerColor} dimColor={dividerDimColor}>
        {rightSide}
      </Text>
    </Box>
  );
}

/**
 * HorizontalLine Component
 *
 * Shorthand cho duong ke ngang don gian.
 */
export function HorizontalLine({
  width = 40,
  char = DIVIDER_CHARS.single,
  color,
  dimColor = true,
}: {
  width?: number;
  char?: string;
  color?: string;
  dimColor?: boolean;
}): React.ReactElement {
  return (
    <Text color={color} dimColor={dimColor}>
      {char.repeat(width)}
    </Text>
  );
}

/**
 * SectionHeader Component
 *
 * Tieu de section voi divider.
 */
export function SectionHeader({
  title,
  width = 40,
  color = 'cyan',
}: {
  title: string;
  width?: number;
  color?: string;
}): React.ReactElement {
  return (
    <Box flexDirection="column" marginY={1}>
      <Divider
        title={title}
        width={width}
        titleColor={color}
        titleBold
        titleDimColor={false}
      />
    </Box>
  );
}

export default Divider;
