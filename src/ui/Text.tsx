/**
 * Text Component - Hien thi text trong Ink CLI
 *
 * Text la component de render van ban voi styling.
 * Ho tro mau sac, bold, italic, underline va cac style khac.
 *
 * Mapping: f -> Text
 */

import React from 'react';

/**
 * Props cho Text component
 * Dua tren Ink's Text API
 */
export interface TextProps {
  /** Noi dung text */
  children?: React.ReactNode;

  // === Colors ===
  /** Mau text (hex, rgb, hoac ten mau) */
  color?: string;

  /** Mau nen */
  backgroundColor?: string;

  /** Lam mo mau text */
  dimColor?: boolean;

  // === Text Styling ===
  /** In dam */
  bold?: boolean;

  /** In nghieng */
  italic?: boolean;

  /** Gach chan */
  underline?: boolean;

  /** Gach ngang */
  strikethrough?: boolean;

  /** Dao nguoc mau (text <-> background) */
  inverse?: boolean;

  // === Text Wrapping ===
  /**
   * Cach xu ly text dai:
   * - 'wrap': Xuong dong tu dong
   * - 'truncate': Cat o cuoi
   * - 'truncate-start': Cat o dau
   * - 'truncate-middle': Cat o giua
   * - 'truncate-end': Cat o cuoi (giong truncate)
   */
  wrap?: 'wrap' | 'truncate' | 'truncate-start' | 'truncate-middle' | 'truncate-end';
}

/**
 * Text Component
 *
 * Render text voi styling trong terminal.
 * Su dung chalk ben trong de apply colors va styles.
 *
 * @example
 * ```tsx
 * <Text color="green" bold>Success!</Text>
 * <Text dimColor>Thong tin phu</Text>
 * ```
 */
export function Text({ children, ...props }: TextProps): React.ReactElement {
  // Ink Text component - render thanh "ink-text" element
  return React.createElement('ink-text', props, children);
}

/**
 * BoldText - Text voi bold=true
 * Shorthand cho text in dam
 */
export function BoldText({ children, ...props }: Omit<TextProps, 'bold'>): React.ReactElement {
  return React.createElement('ink-text', { ...props, bold: true }, children);
}

/**
 * DimText - Text voi dimColor=true
 * Shorthand cho text mo nhat (secondary info)
 */
export function DimText({ children, ...props }: Omit<TextProps, 'dimColor'>): React.ReactElement {
  return React.createElement('ink-text', { ...props, dimColor: true }, children);
}

/**
 * ErrorText - Text mau do cho error messages
 */
export function ErrorText({ children, ...props }: Omit<TextProps, 'color'>): React.ReactElement {
  return React.createElement('ink-text', { ...props, color: 'red' }, children);
}

/**
 * SuccessText - Text mau xanh cho success messages
 */
export function SuccessText({ children, ...props }: Omit<TextProps, 'color'>): React.ReactElement {
  return React.createElement('ink-text', { ...props, color: 'green' }, children);
}

/**
 * WarningText - Text mau vang cho warning messages
 */
export function WarningText({ children, ...props }: Omit<TextProps, 'color'>): React.ReactElement {
  return React.createElement('ink-text', { ...props, color: 'yellow' }, children);
}

/**
 * InfoText - Text mau cyan cho info messages
 */
export function InfoText({ children, ...props }: Omit<TextProps, 'color'>): React.ReactElement {
  return React.createElement('ink-text', { ...props, color: 'cyan' }, children);
}

export default Text;
