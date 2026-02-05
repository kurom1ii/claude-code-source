/**
 * Box Component - Container layout cho Ink CLI
 *
 * Box la component co ban nhat trong Ink, tuong tu div trong HTML.
 * Ho tro flexbox layout de sap xep cac element con.
 *
 * Mapping: kg5 -> Box
 */

import React from 'react';

/**
 * Props cho Box component
 * Dua tren Ink's Box API
 */
export interface BoxProps {
  /** Cac element con ben trong Box */
  children?: React.ReactNode;

  // === Flexbox Layout ===
  /** Huong sap xep: 'row' (ngang) hoac 'column' (doc) */
  flexDirection?: 'row' | 'column' | 'row-reverse' | 'column-reverse';

  /** Wrap content khi vuot qua width */
  flexWrap?: 'wrap' | 'nowrap' | 'wrap-reverse';

  /** Flex grow ratio */
  flexGrow?: number;

  /** Flex shrink ratio */
  flexShrink?: number;

  /** Flex basis */
  flexBasis?: number | string;

  /** Can chinh items theo cross axis */
  alignItems?: 'flex-start' | 'center' | 'flex-end' | 'stretch';

  /** Can chinh content theo main axis */
  justifyContent?:
    | 'flex-start'
    | 'center'
    | 'flex-end'
    | 'space-between'
    | 'space-around'
    | 'space-evenly';

  /** Tu can chinh item nay */
  alignSelf?: 'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch';

  // === Padding ===
  /** Padding tat ca cac canh */
  padding?: number;

  /** Padding trai va phai */
  paddingX?: number;

  /** Padding tren va duoi */
  paddingY?: number;

  /** Padding tren */
  paddingTop?: number;

  /** Padding duoi */
  paddingBottom?: number;

  /** Padding trai */
  paddingLeft?: number;

  /** Padding phai */
  paddingRight?: number;

  // === Margin ===
  /** Margin tat ca cac canh */
  margin?: number;

  /** Margin trai va phai */
  marginX?: number;

  /** Margin tren va duoi */
  marginY?: number;

  /** Margin tren */
  marginTop?: number;

  /** Margin duoi */
  marginBottom?: number;

  /** Margin trai */
  marginLeft?: number;

  /** Margin phai */
  marginRight?: number;

  // === Dimensions ===
  /** Chieu rong (so hoac percentage string) */
  width?: number | string;

  /** Chieu cao */
  height?: number | string;

  /** Chieu rong toi thieu */
  minWidth?: number | string;

  /** Chieu cao toi thieu */
  minHeight?: number | string;

  // === Border ===
  /** Kieu border: single, double, round, bold, classic, arrow, doubleSingle, singleDouble */
  borderStyle?:
    | 'single'
    | 'double'
    | 'round'
    | 'bold'
    | 'classic'
    | 'arrow'
    | 'doubleSingle'
    | 'singleDouble';

  /** Mau border */
  borderColor?: string;

  /** Hien thi border tren */
  borderTop?: boolean;

  /** Hien thi border duoi */
  borderBottom?: boolean;

  /** Hien thi border trai */
  borderLeft?: boolean;

  /** Hien thi border phai */
  borderRight?: boolean;

  /** Dim border color */
  borderDimColor?: boolean;

  // === Display ===
  /** Che do hien thi */
  display?: 'flex' | 'none';

  /** Overflow behavior */
  overflow?: 'visible' | 'hidden';

  /** Hien thi gap giua cac item */
  gap?: number;

  /** Gap giua cac column */
  columnGap?: number;

  /** Gap giua cac row */
  rowGap?: number;
}

/**
 * Box Component
 *
 * Container co ban cho layout trong Ink.
 * Render thanh "ink-box" element.
 *
 * @example
 * ```tsx
 * <Box flexDirection="column" padding={1}>
 *   <Text>Dong 1</Text>
 *   <Text>Dong 2</Text>
 * </Box>
 * ```
 */
export function Box({ children, ...props }: BoxProps): React.ReactElement {
  // Ink Box component - render thanh "ink-box" element
  // React.createElement duoc su dung de tao element truc tiep
  return React.createElement('ink-box', props, children);
}

/**
 * BoxRow - Box voi flexDirection="row"
 * Shorthand component de sap xep element theo hang ngang
 */
export function BoxRow({ children, ...props }: Omit<BoxProps, 'flexDirection'>): React.ReactElement {
  return React.createElement('ink-box', { ...props, flexDirection: 'row' }, children);
}

/**
 * BoxColumn - Box voi flexDirection="column"
 * Shorthand component de sap xep element theo cot doc
 */
export function BoxColumn({ children, ...props }: Omit<BoxProps, 'flexDirection'>): React.ReactElement {
  return React.createElement('ink-box', { ...props, flexDirection: 'column' }, children);
}

export default Box;
