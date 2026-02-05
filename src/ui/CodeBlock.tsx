/**
 * CodeBlock Component - Syntax highlighted code display
 *
 * Component de hien thi code voi syntax highlighting.
 * Ho tro line numbers, language detection, va copy functionality.
 *
 * Pattern: PM/DJ -> CodeBlock
 */

import React, { useState, useMemo } from 'react';
import { Box } from './Box';
import { Text } from './Text';
import { Divider } from './Divider';

/**
 * Supported languages
 */
export type SupportedLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'rust'
  | 'go'
  | 'java'
  | 'c'
  | 'cpp'
  | 'csharp'
  | 'ruby'
  | 'php'
  | 'swift'
  | 'kotlin'
  | 'scala'
  | 'shell'
  | 'bash'
  | 'zsh'
  | 'powershell'
  | 'sql'
  | 'html'
  | 'css'
  | 'scss'
  | 'json'
  | 'yaml'
  | 'toml'
  | 'xml'
  | 'markdown'
  | 'diff'
  | 'plaintext';

/**
 * Token types for syntax highlighting
 */
export type TokenType =
  | 'keyword'
  | 'string'
  | 'number'
  | 'comment'
  | 'function'
  | 'variable'
  | 'operator'
  | 'punctuation'
  | 'type'
  | 'builtin'
  | 'constant'
  | 'property'
  | 'plain';

/**
 * Token trong code
 */
export interface CodeToken {
  type: TokenType;
  value: string;
}

/**
 * Line trong code
 */
export interface CodeLine {
  number: number;
  tokens: CodeToken[];
  isHighlighted?: boolean;
  isAdded?: boolean;
  isRemoved?: boolean;
}

/**
 * Props cho CodeBlock component
 */
export interface CodeBlockProps {
  /** Code content */
  code: string;

  /** Language */
  language?: SupportedLanguage | string;

  /** Hien thi line numbers */
  showLineNumbers?: boolean;

  /** Starting line number */
  startingLineNumber?: number;

  /** Highlighted lines (1-indexed) */
  highlightedLines?: number[];

  /** File path (hien thi o header) */
  filePath?: string;

  /** Max lines to display */
  maxLines?: number;

  /** Wrap long lines */
  wrapLines?: boolean;

  /** Border style */
  borderStyle?: 'single' | 'double' | 'round' | 'bold' | 'none';

  /** Border color */
  borderColor?: string;

  /** Dim the code */
  dimCode?: boolean;

  /** Compact mode (no padding) */
  compact?: boolean;

  /** Hien thi copy button */
  showCopyButton?: boolean;

  /** Callback khi copy */
  onCopy?: () => void;

  /** Theme colors override */
  themeColors?: Partial<Record<TokenType, string>>;
}

/**
 * Default token colors
 */
const DEFAULT_TOKEN_COLORS: Record<TokenType, string> = {
  keyword: '#ff79c6',     // pink
  string: '#f1fa8c',      // yellow
  number: '#bd93f9',      // purple
  comment: '#6272a4',     // gray
  function: '#50fa7b',    // green
  variable: '#f8f8f2',    // white
  operator: '#ff79c6',    // pink
  punctuation: '#f8f8f2', // white
  type: '#8be9fd',        // cyan
  builtin: '#ffb86c',     // orange
  constant: '#bd93f9',    // purple
  property: '#66d9ef',    // light blue
  plain: '#f8f8f2',       // white
};

/**
 * Language extensions map
 */
const LANGUAGE_ALIASES: Record<string, SupportedLanguage> = {
  js: 'javascript',
  ts: 'typescript',
  jsx: 'javascript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  sh: 'bash',
  yml: 'yaml',
  md: 'markdown',
};

/**
 * Simple tokenizer keywords per language
 */
const LANGUAGE_KEYWORDS: Partial<Record<SupportedLanguage, string[]>> = {
  javascript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'typeof', 'instanceof'],
  typescript: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'class', 'import', 'export', 'from', 'async', 'await', 'try', 'catch', 'throw', 'new', 'this', 'typeof', 'instanceof', 'interface', 'type', 'enum', 'implements', 'extends', 'private', 'public', 'protected', 'readonly'],
  python: ['def', 'class', 'import', 'from', 'return', 'if', 'elif', 'else', 'for', 'while', 'try', 'except', 'finally', 'with', 'as', 'lambda', 'yield', 'raise', 'pass', 'break', 'continue', 'and', 'or', 'not', 'in', 'is', 'True', 'False', 'None', 'async', 'await'],
  rust: ['fn', 'let', 'mut', 'const', 'struct', 'enum', 'impl', 'trait', 'pub', 'use', 'mod', 'if', 'else', 'match', 'for', 'while', 'loop', 'return', 'self', 'Self', 'where', 'async', 'await', 'move', 'unsafe'],
  go: ['func', 'var', 'const', 'type', 'struct', 'interface', 'package', 'import', 'if', 'else', 'for', 'range', 'switch', 'case', 'default', 'return', 'go', 'chan', 'select', 'defer', 'make', 'new'],
  bash: ['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'function', 'return', 'exit', 'export', 'local', 'readonly', 'declare'],
};

/**
 * Simple syntax tokenizer
 */
function tokenizeLine(line: string, language?: SupportedLanguage): CodeToken[] {
  if (!line) {
    return [{ type: 'plain', value: '' }];
  }

  const tokens: CodeToken[] = [];
  const keywords = language ? (LANGUAGE_KEYWORDS[language] || []) : [];

  // Simple regex-based tokenization
  const patterns: Array<{ regex: RegExp; type: TokenType }> = [
    // Comments
    { regex: /^(\/\/.*|#.*|--.*)/g, type: 'comment' },
    // Strings
    { regex: /^("[^"]*"|'[^']*'|`[^`]*`)/g, type: 'string' },
    // Numbers
    { regex: /^(\d+\.?\d*)/g, type: 'number' },
    // Operators
    { regex: /^([+\-*/%=<>!&|^~?:]+)/g, type: 'operator' },
    // Punctuation
    { regex: /^([{}[\]();,.])/g, type: 'punctuation' },
    // Words (keywords, functions, variables)
    { regex: /^([a-zA-Z_]\w*)/g, type: 'variable' },
    // Whitespace and other
    { regex: /^(\s+)/g, type: 'plain' },
    { regex: /^(.)/g, type: 'plain' },
  ];

  let remaining = line;
  while (remaining.length > 0) {
    let matched = false;

    for (const { regex, type } of patterns) {
      regex.lastIndex = 0;
      const match = regex.exec(remaining);
      if (match) {
        let tokenType = type;
        const value = match[1];

        // Check if it's a keyword
        if (type === 'variable' && keywords.includes(value)) {
          tokenType = 'keyword';
        }
        // Check if it's a function call (followed by parenthesis)
        else if (type === 'variable' && remaining[value.length] === '(') {
          tokenType = 'function';
        }

        tokens.push({ type: tokenType, value });
        remaining = remaining.slice(value.length);
        matched = true;
        break;
      }
    }

    if (!matched) {
      // Fallback: take one character
      tokens.push({ type: 'plain', value: remaining[0] });
      remaining = remaining.slice(1);
    }
  }

  return tokens;
}

/**
 * Parse code into lines
 */
function parseCode(
  code: string,
  language?: SupportedLanguage,
  startingLineNumber: number = 1,
  highlightedLines?: number[]
): CodeLine[] {
  const lines = code.split('\n');
  const highlightSet = new Set(highlightedLines || []);

  return lines.map((lineContent, index) => {
    const lineNumber = startingLineNumber + index;
    const tokens = tokenizeLine(lineContent, language);

    // Check for diff markers
    const isAdded = lineContent.startsWith('+') && language === 'diff';
    const isRemoved = lineContent.startsWith('-') && language === 'diff';

    return {
      number: lineNumber,
      tokens,
      isHighlighted: highlightSet.has(lineNumber),
      isAdded,
      isRemoved,
    };
  });
}

/**
 * Normalize language name
 */
function normalizeLanguage(lang?: string): SupportedLanguage | undefined {
  if (!lang) return undefined;
  const lower = lang.toLowerCase();
  return (LANGUAGE_ALIASES[lower] as SupportedLanguage) || (lower as SupportedLanguage);
}

/**
 * CodeBlock Component
 *
 * Hien thi code voi syntax highlighting.
 *
 * @example
 * ```tsx
 * <CodeBlock
 *   code="const hello = 'world';"
 *   language="javascript"
 *   showLineNumbers
 *   filePath="example.js"
 * />
 * ```
 */
export function CodeBlock({
  code,
  language,
  showLineNumbers = true,
  startingLineNumber = 1,
  highlightedLines,
  filePath,
  maxLines,
  wrapLines = false,
  borderStyle = 'single',
  borderColor = 'gray',
  dimCode = false,
  compact = false,
  showCopyButton = false,
  onCopy,
  themeColors,
}: CodeBlockProps): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const normalizedLang = normalizeLanguage(language);
  const tokenColors = { ...DEFAULT_TOKEN_COLORS, ...themeColors };

  // Parse and memoize
  const lines = useMemo(() => {
    return parseCode(code, normalizedLang, startingLineNumber, highlightedLines);
  }, [code, normalizedLang, startingLineNumber, highlightedLines]);

  // Apply maxLines
  const displayLines = maxLines ? lines.slice(0, maxLines) : lines;
  const truncated = maxLines && lines.length > maxLines;

  // Calculate line number width
  const maxLineNumber = startingLineNumber + lines.length - 1;
  const lineNumberWidth = String(maxLineNumber).length;

  return (
    <Box
      flexDirection="column"
      borderStyle={borderStyle === 'none' ? undefined : borderStyle}
      borderColor={borderColor}
      marginY={compact ? 0 : 1}
    >
      {/* Header */}
      {(filePath || language || showCopyButton) && (
        <>
          <Box paddingX={1} justifyContent="space-between">
            <Box>
              {filePath && (
                <Text bold color="cyan">{filePath}</Text>
              )}
              {filePath && language && <Text dimColor> · </Text>}
              {language && (
                <Text dimColor>{normalizedLang || language}</Text>
              )}
            </Box>

            {showCopyButton && (
              <Text
                dimColor={!copied}
                color={copied ? 'green' : undefined}
              >
                {copied ? '✓ Copied' : '[Copy]'}
              </Text>
            )}
          </Box>
          <Box paddingX={1}>
            <Divider dividerDimColor width={40} />
          </Box>
        </>
      )}

      {/* Code lines */}
      <Box flexDirection="column" paddingX={compact ? 0 : 1}>
        {displayLines.map((line) => (
          <Box
            key={line.number}
            // Highlight background for marked lines
          >
            {/* Line number */}
            {showLineNumbers && (
              <Text dimColor>
                {String(line.number).padStart(lineNumberWidth, ' ')} │{' '}
              </Text>
            )}

            {/* Diff markers */}
            {line.isAdded && (
              <Text color="green">+</Text>
            )}
            {line.isRemoved && (
              <Text color="red">-</Text>
            )}

            {/* Tokens */}
            <Text
              wrap={wrapLines ? 'wrap' : 'truncate'}
              dimColor={dimCode}
              backgroundColor={line.isHighlighted ? 'yellow' : undefined}
            >
              {line.tokens.map((token, tokenIndex) => (
                <Text
                  key={tokenIndex}
                  color={tokenColors[token.type]}
                  dimColor={dimCode}
                >
                  {token.value}
                </Text>
              ))}
            </Text>
          </Box>
        ))}

        {/* Truncation indicator */}
        {truncated && (
          <Text dimColor italic>
            ... ({lines.length - maxLines!} more lines)
          </Text>
        )}
      </Box>
    </Box>
  );
}

/**
 * InlineCode Component
 *
 * Inline code snippet.
 */
export function InlineCode({
  children,
  color = 'cyan',
}: {
  children: string;
  color?: string;
}): React.ReactElement {
  return (
    <Text color={color} bold>
      `{children}`
    </Text>
  );
}

/**
 * DiffBlock Component
 *
 * Hien thi diff output.
 */
export function DiffBlock({
  diff,
  filePath,
  showLineNumbers = true,
}: {
  diff: string;
  filePath?: string;
  showLineNumbers?: boolean;
}): React.ReactElement {
  return (
    <CodeBlock
      code={diff}
      language="diff"
      filePath={filePath}
      showLineNumbers={showLineNumbers}
      borderColor="blue"
    />
  );
}

/**
 * JsonBlock Component
 *
 * Hien thi formatted JSON.
 */
export function JsonBlock({
  data,
  indent = 2,
  maxDepth = 5,
}: {
  data: unknown;
  indent?: number;
  maxDepth?: number;
}): React.ReactElement {
  const jsonString = JSON.stringify(data, null, indent);

  return (
    <CodeBlock
      code={jsonString}
      language="json"
      showLineNumbers={false}
    />
  );
}

/**
 * ShellBlock Component
 *
 * Hien thi shell/bash code.
 */
export function ShellBlock({
  command,
  output,
  showPrompt = true,
}: {
  command: string;
  output?: string;
  showPrompt?: boolean;
}): React.ReactElement {
  const code = showPrompt
    ? `$ ${command}${output ? '\n' + output : ''}`
    : `${command}${output ? '\n' + output : ''}`;

  return (
    <CodeBlock
      code={code}
      language="bash"
      showLineNumbers={false}
      borderColor="yellow"
    />
  );
}

/**
 * CodeSnippet Component
 *
 * Code snippet voi context.
 */
export function CodeSnippet({
  code,
  language,
  title,
  description,
}: {
  code: string;
  language?: string;
  title?: string;
  description?: string;
}): React.ReactElement {
  return (
    <Box flexDirection="column" marginY={1}>
      {title && (
        <Text bold>{title}</Text>
      )}
      {description && (
        <Text dimColor>{description}</Text>
      )}
      <CodeBlock
        code={code}
        language={language as SupportedLanguage}
        showLineNumbers={true}
      />
    </Box>
  );
}

export default CodeBlock;
