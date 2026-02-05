/**
 * Thinker Component - Thinking animation cho Claude Code
 *
 * Hien thi animation "dang suy nghi" voi spinner va verbs thay doi.
 * Day la component dac trung cua Claude Code.
 */

import React, { useState, useEffect } from 'react';
import { Box } from './Box';
import { Text } from './Text';

/**
 * Danh sach thinking verbs mac dinh
 * Pattern: Array voi 50+ "-ing" verbs
 * Tu file source: Cac tu nhu Analyzing, Computing, etc.
 */
export const DEFAULT_THINKING_VERBS = [
  'Accomplishing',
  'Actioning',
  'Analyzing',
  'Architecting',
  'Brainstorming',
  'Building',
  'Calculating',
  'Coding',
  'Compiling',
  'Computing',
  'Conceptualizing',
  'Configuring',
  'Constructing',
  'Creating',
  'Debugging',
  'Decomposing',
  'Designing',
  'Developing',
  'Devising',
  'Drafting',
  'Engineering',
  'Evaluating',
  'Executing',
  'Exploring',
  'Factoring',
  'Formulating',
  'Generating',
  'Ideating',
  'Implementing',
  'Improving',
  'Innovating',
  'Integrating',
  'Investigating',
  'Iterating',
  'Learning',
  'Mapping',
  'Modeling',
  'Optimizing',
  'Organizing',
  'Planning',
  'Processing',
  'Programming',
  'Prototyping',
  'Reasoning',
  'Refactoring',
  'Researching',
  'Solving',
  'Structuring',
  'Synthesizing',
  'Thinking',
  'Troubleshooting',
  'Understanding',
  'Visualizing',
  'Working',
  'Zigzagging',
] as const;

/**
 * Spinner frames mac dinh (braille dots)
 */
export const DEFAULT_SPINNER_PHASES = [
  '⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'
] as const;

/**
 * Props cho Thinker component
 */
export interface ThinkerProps {
  /** Tip hien thi khi verbose mode */
  spinnerTip?: string;

  /** Message de override (hien thi thay vi animation) */
  overrideMessage?: string;

  /** Hien thi them thong tin chi tiet */
  verbose?: boolean;

  /** Danh sach thinking verbs */
  verbs?: readonly string[] | string[];

  /** Format string cho verb display. Su dung {verb} de chen verb */
  format?: string;

  /** Cac frames cua spinner animation */
  phases?: readonly string[] | string[];

  /** Thoi gian giua cac frames (ms) */
  updateInterval?: number;

  /** Dao nguoc animation khi den cuoi (thay vi loop lai tu dau) */
  reverseMirror?: boolean;

  /** Mau spinner */
  spinnerColor?: string;

  /** Mau text */
  textColor?: string;

  /** Dim text */
  dimColor?: boolean;

  /** Italic text */
  italic?: boolean;

  /** Thoi gian giua cac lan doi verb (ms) */
  verbChangeInterval?: number;

  /** Random verb thay vi theo thu tu */
  randomVerbs?: boolean;
}

/**
 * Thinker Component
 *
 * Hien thi "thinking" animation dac trung cua Claude Code.
 * Spinner quay + verb thay doi theo thoi gian.
 *
 * @example
 * ```tsx
 * // Co ban
 * <Thinker />
 *
 * // Voi tip
 * <Thinker spinnerTip="Processing your request" verbose />
 *
 * // Custom verbs
 * <Thinker verbs={['Analyzing', 'Computing', 'Processing']} />
 * ```
 */
export function Thinker({
  spinnerTip,
  overrideMessage,
  verbose = false,
  verbs = DEFAULT_THINKING_VERBS,
  format = '{verb}...',
  phases = DEFAULT_SPINNER_PHASES,
  updateInterval = 80,
  reverseMirror = true,
  spinnerColor = 'cyan',
  textColor,
  dimColor = true,
  italic = true,
  verbChangeInterval,
  randomVerbs = false,
}: ThinkerProps): React.ReactElement {
  const [frame, setFrame] = useState(0);
  const [verbIndex, setVerbIndex] = useState(0);
  const [direction, setDirection] = useState(1); // 1 = forward, -1 = backward

  // Spinner animation
  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => {
        const next = prev + direction;

        // Xu ly khi den cuoi frames
        if (next >= phases.length - 1) {
          if (reverseMirror) {
            // Dao nguoc huong
            setDirection(-1);
            return phases.length - 1;
          }
          // Loop lai tu dau
          return 0;
        }

        // Xu ly khi den dau frames (khi dang di nguoc)
        if (next <= 0) {
          setDirection(1);
          // Doi verb khi hoan thanh 1 cycle
          if (!verbChangeInterval) {
            setVerbIndex(v => {
              if (randomVerbs) {
                return Math.floor(Math.random() * verbs.length);
              }
              return (v + 1) % verbs.length;
            });
          }
          return 0;
        }

        return next;
      });
    }, updateInterval);

    return () => clearInterval(timer);
  }, [phases.length, updateInterval, reverseMirror, verbs.length, direction, randomVerbs, verbChangeInterval]);

  // Verb change theo interval rieng (neu co)
  useEffect(() => {
    if (!verbChangeInterval) return;

    const timer = setInterval(() => {
      setVerbIndex(v => {
        if (randomVerbs) {
          return Math.floor(Math.random() * verbs.length);
        }
        return (v + 1) % verbs.length;
      });
    }, verbChangeInterval);

    return () => clearInterval(timer);
  }, [verbChangeInterval, verbs.length, randomVerbs]);

  // Neu co override message, hien thi no thay vi animation
  if (overrideMessage) {
    return (
      <Box>
        <Text>{overrideMessage}</Text>
      </Box>
    );
  }

  const currentVerb = verbs[verbIndex];
  const displayText = format.replace('{verb}', currentVerb);
  const spinner = phases[frame];

  return (
    <Box>
      <Text color={spinnerColor}>{spinner}</Text>
      <Text color={textColor} dimColor={dimColor} italic={italic}>
        {' '}{displayText}
      </Text>
      {verbose && spinnerTip && (
        <Text dimColor> ({spinnerTip})</Text>
      )}
    </Box>
  );
}

/**
 * SimpleThinker Component
 *
 * Phien ban don gian chi hien thi spinner va text co dinh.
 */
export function SimpleThinker({
  text = 'Thinking...',
  spinnerColor = 'cyan',
}: {
  text?: string;
  spinnerColor?: string;
}): React.ReactElement {
  const [frame, setFrame] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setFrame(prev => (prev + 1) % DEFAULT_SPINNER_PHASES.length);
    }, 80);

    return () => clearInterval(timer);
  }, []);

  return (
    <Box>
      <Text color={spinnerColor}>{DEFAULT_SPINNER_PHASES[frame]}</Text>
      <Text dimColor italic> {text}</Text>
    </Box>
  );
}

/**
 * WorkingIndicator Component
 *
 * Indicator don gian cho trang thai "dang lam viec".
 */
export function WorkingIndicator({
  task,
  showDots = true,
}: {
  task?: string;
  showDots?: boolean;
}): React.ReactElement {
  const [dots, setDots] = useState('');

  useEffect(() => {
    if (!showDots) return;

    const timer = setInterval(() => {
      setDots(prev => (prev.length >= 3 ? '' : prev + '.'));
    }, 400);

    return () => clearInterval(timer);
  }, [showDots]);

  return (
    <Box>
      <Text color="yellow">⚡</Text>
      <Text dimColor> Working{task ? ` on ${task}` : ''}{dots.padEnd(3, ' ')}</Text>
    </Box>
  );
}

export default Thinker;
