/**
 * Spinner Component - Loading animation cho Ink CLI
 *
 * Hien thi animation khi dang loading/processing.
 * Ho tro nhieu kieu spinner khac nhau.
 */

import React, { useState, useEffect } from 'react';
import { Box } from './Box';
import { Text } from './Text';

/**
 * Cac kieu spinner co san
 */
export const SPINNER_TYPES = {
  /** Spinner mac dinh - dots quay */
  dots: {
    frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'],
    interval: 80,
  },

  /** Spinner dang line */
  line: {
    frames: ['-', '\\', '|', '/'],
    interval: 100,
  },

  /** Spinner dang arc */
  arc: {
    frames: ['◜', '◠', '◝', '◞', '◡', '◟'],
    interval: 100,
  },

  /** Spinner dang circle */
  circle: {
    frames: ['◐', '◓', '◑', '◒'],
    interval: 100,
  },

  /** Spinner dang square */
  square: {
    frames: ['◰', '◳', '◲', '◱'],
    interval: 100,
  },

  /** Spinner dang bounce */
  bounce: {
    frames: ['⠁', '⠂', '⠄', '⠂'],
    interval: 120,
  },

  /** Spinner dang clock */
  clock: {
    frames: ['🕐', '🕑', '🕒', '🕓', '🕔', '🕕', '🕖', '🕗', '🕘', '🕙', '🕚', '🕛'],
    interval: 100,
  },

  /** Spinner dang earth */
  earth: {
    frames: ['🌍', '🌎', '🌏'],
    interval: 180,
  },

  /** Spinner dang moon */
  moon: {
    frames: ['🌑', '🌒', '🌓', '🌔', '🌕', '🌖', '🌗', '🌘'],
    interval: 100,
  },

  /** Spinner dang dots2 */
  dots2: {
    frames: ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'],
    interval: 80,
  },

  /** Spinner dang simple dots */
  simpleDots: {
    frames: ['.  ', '.. ', '...', '   '],
    interval: 400,
  },

  /** Spinner dang bar growing */
  bar: {
    frames: ['[    ]', '[=   ]', '[==  ]', '[=== ]', '[====]', '[ ===]', '[  ==]', '[   =]'],
    interval: 100,
  },
} as const;

export type SpinnerType = keyof typeof SPINNER_TYPES;

/**
 * Props cho Spinner component
 */
export interface SpinnerProps {
  /** Kieu spinner */
  type?: SpinnerType;

  /** Frames tu dinh nghia (override type) */
  frames?: string[];

  /** Thoi gian giua cac frames (ms) */
  interval?: number;

  /** Text hien thi ben canh spinner */
  label?: string;

  /** Mau spinner */
  color?: string;

  /** Mau label */
  labelColor?: string;

  /** Vi tri label: truoc hoac sau spinner */
  labelPosition?: 'before' | 'after';

  /** Dim spinner */
  dimColor?: boolean;
}

/**
 * Spinner Component
 *
 * Hien thi loading animation.
 *
 * @example
 * ```tsx
 * <Spinner type="dots" label="Loading..." color="cyan" />
 * ```
 */
export function Spinner({
  type = 'dots',
  frames,
  interval,
  label,
  color = 'cyan',
  labelColor,
  labelPosition = 'after',
  dimColor = false,
}: SpinnerProps): React.ReactElement {
  const [frameIndex, setFrameIndex] = useState(0);

  // Lay frames va interval tu type hoac props
  const spinnerConfig = SPINNER_TYPES[type];
  const spinnerFrames = frames || spinnerConfig.frames;
  const spinnerInterval = interval || spinnerConfig.interval;

  // Animation loop
  useEffect(() => {
    const timer = setInterval(() => {
      setFrameIndex(prev => (prev + 1) % spinnerFrames.length);
    }, spinnerInterval);

    return () => clearInterval(timer);
  }, [spinnerFrames.length, spinnerInterval]);

  const spinnerElement = (
    <Text color={color} dimColor={dimColor}>
      {spinnerFrames[frameIndex]}
    </Text>
  );

  const labelElement = label && (
    <Text color={labelColor} dimColor={dimColor}>
      {' '}{label}
    </Text>
  );

  return (
    <Box>
      {labelPosition === 'before' && labelElement}
      {spinnerElement}
      {labelPosition === 'after' && labelElement}
    </Box>
  );
}

/**
 * LoadingDots Component
 *
 * Hien thi "Loading..." voi dots animation.
 */
export function LoadingDots({
  text = 'Loading',
  color,
}: {
  text?: string;
  color?: string;
}): React.ReactElement {
  const [dots, setDots] = useState('');

  useEffect(() => {
    const timer = setInterval(() => {
      setDots(prev => {
        if (prev.length >= 3) return '';
        return prev + '.';
      });
    }, 400);

    return () => clearInterval(timer);
  }, []);

  return (
    <Text color={color}>
      {text}{dots.padEnd(3, ' ')}
    </Text>
  );
}

/**
 * ProgressBar Component
 *
 * Hien thi progress bar.
 */
export interface ProgressBarProps {
  /** Progress value (0-100) */
  value: number;

  /** Chieu rong cua bar */
  width?: number;

  /** Ky tu cho phan da hoan thanh */
  filledChar?: string;

  /** Ky tu cho phan chua hoan thanh */
  emptyChar?: string;

  /** Mau phan da hoan thanh */
  filledColor?: string;

  /** Mau phan chua hoan thanh */
  emptyColor?: string;

  /** Hien thi phan tram */
  showPercentage?: boolean;

  /** Border characters */
  leftBorder?: string;
  rightBorder?: string;
}

export function ProgressBar({
  value,
  width = 20,
  filledChar = '█',
  emptyChar = '░',
  filledColor = 'green',
  emptyColor = 'gray',
  showPercentage = true,
  leftBorder = '[',
  rightBorder = ']',
}: ProgressBarProps): React.ReactElement {
  // Clamp value to 0-100
  const clampedValue = Math.min(100, Math.max(0, value));
  const filledWidth = Math.round((clampedValue / 100) * width);
  const emptyWidth = width - filledWidth;

  return (
    <Box>
      <Text dimColor>{leftBorder}</Text>
      <Text color={filledColor}>{filledChar.repeat(filledWidth)}</Text>
      <Text color={emptyColor}>{emptyChar.repeat(emptyWidth)}</Text>
      <Text dimColor>{rightBorder}</Text>
      {showPercentage && (
        <Text dimColor> {clampedValue.toFixed(0)}%</Text>
      )}
    </Box>
  );
}

export default Spinner;
