# Kien truc he thong

> Mo ta chi tiet kien truc cua Claude Code CLI

## Tong quan

```
┌─────────────────────────────────────────────────────────────┐
│                         CLI Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Commander  │  │    Ink      │  │      App.tsx        │  │
│  │  (Args)     │  │  (Render)   │  │  (Main Component)   │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                        Core Layer                            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │    API      │  │   Tools     │  │     UI Components   │  │
│  │  Client     │  │  Registry   │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│                      Foundation Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │   Types     │  │   Config    │  │       Utils         │  │
│  │             │  │             │  │                     │  │
│  └─────────────┘  └─────────────┘  └─────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

## Cac layer chinh

### 1. CLI Layer

Chiu trach nhiem:
- Parse command line arguments (Commander)
- Render UI voi Ink (React for terminal)
- Xu ly vong lap chinh cua ung dung

**Files:**
- `src/cli/index.ts` - Entry point, commander setup
- `src/cli/App.tsx` - Main React component

### 2. Core Layer

#### API Module (`src/api/`)

```
┌────────────────────────────────────────┐
│            AnthropicClient             │
├────────────────────────────────────────┤
│ + createMessage(request)               │
│ + streamMessage(request)               │
│ + complete(prompt)                     │
│ + conversation()                       │
├────────────────────────────────────────┤
│ - buildHeaders()                       │
│ - buildRequest()                       │
│ - sendRequest()                        │
│ - sendStreamRequest()                  │
│ - executeWithRetry()                   │
└────────────────────────────────────────┘
              │
              ▼
┌────────────────────────────────────────┐
│           Streaming Module             │
├────────────────────────────────────────┤
│ + parseSSELine()                       │
│ + parseStreamEvent()                   │
│ + streamEvents()                       │
│ + readStream()                         │
│ + StreamMessageBuilder                 │
└────────────────────────────────────────┘
```

#### Tools Module (`src/tools/`)

```
┌─────────────────────────────────────────────────┐
│                 Tool Interface                   │
├─────────────────────────────────────────────────┤
│ ToolDefinition {                                │
│   name: string                                  │
│   description: string                           │
│   category: ToolCategory                        │
│   parameters: Record<string, ParameterDef>      │
│   requiresConfirmation: boolean                 │
│ }                                               │
├─────────────────────────────────────────────────┤
│ ToolHandler<TInput, TOutput> {                  │
│   name: string                                  │
│   definition: ToolDefinition                    │
│   validateInput(input): boolean | string        │
│   execute(input, context): Promise<TOutput>     │
│ }                                               │
└─────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│              Tool Implementations               │
├─────────────────────────────────────────────────┤
│ BashTool    │ ReadTool   │ WriteTool           │
│ EditTool    │ GlobTool   │ GrepTool            │
│ TaskTool    │ WebFetch   │ WebSearch           │
│ LSPTool     │            │                     │
└─────────────────────────────────────────────────┘
```

#### UI Components (`src/ui/`)

```
Core Components:
├── Box.tsx          - Layout container
└── Text.tsx         - Text rendering

Input Components:
├── Input.tsx        - TextInput, PasswordInput
└── Select.tsx       - Select, MultiSelect

Feedback Components:
├── Spinner.tsx      - Loading indicators
└── Thinker.tsx      - Thinking animation

Layout Components:
└── Divider.tsx      - Separators

Display Components:
├── StatusLine.tsx   - Status bar
├── MessageDisplay.tsx - Message rendering
└── ToolOutput.tsx   - Tool results

Theme System:
└── Theme.tsx        - ThemeProvider, themes
```

### 3. Foundation Layer

#### Types (`src/types/`)

Dinh nghia types cho:
- Messages (User, Assistant, System)
- Content blocks (Text, Tool Use, Tool Result)
- Tools (Definition, Handler, Result)
- API (Request, Response, Streaming)
- Agents (Config, State)
- MCP (Protocol types)

#### Config (`src/config/`)

- VERSION - Phien ban hien tai
- MODELS - Danh sach models kha dung
- THEMES - Theme definitions
- FEATURE_FLAGS - Feature toggles
- Context limits - Token limits theo model

#### Utils (`src/utils/`)

Helper functions:
- String: escapeRegex, truncate, slugify
- Version: compareVersions, parseVersion
- Crypto: sha256, uniqueId
- Path: resolvePath, isAbsolute
- Async: retry, withTimeout
- Token: estimateTokens

## Data Flow

### 1. User Input -> Response

```
User Input
    │
    ▼
┌─────────────┐
│   App.tsx   │ ← handleSubmit
└─────────────┘
    │
    ▼
┌─────────────┐
│  Anthropic  │ ← createMessageStream
│   Client    │
└─────────────┘
    │
    ▼
┌─────────────┐
│  Streaming  │ ← SSE events
│   Parser    │
└─────────────┘
    │
    ▼
┌─────────────┐
│   Content   │ ← text, tool_use
│   Blocks    │
└─────────────┘
    │
    ├─── text ──────────────────┐
    │                           ▼
    │                   ┌─────────────┐
    │                   │  Render UI  │
    │                   └─────────────┘
    │
    └─── tool_use ──────────────┐
                                ▼
                        ┌─────────────┐
                        │   Execute   │
                        │    Tool     │
                        └─────────────┘
                                │
                                ▼
                        ┌─────────────┐
                        │ Tool Result │
                        └─────────────┘
                                │
                                ▼
                        ┌─────────────┐
                        │  Continue   │
                        │ Conversation│
                        └─────────────┘
```

### 2. Tool Execution

```
Tool Use Block
    │
    ▼
┌─────────────┐
│  Validate   │
│   Input     │
└─────────────┘
    │
    ├─── invalid ───► Error
    │
    └─── valid
          │
          ▼
    ┌─────────────┐
    │  Execute    │
    │   Handler   │
    └─────────────┘
          │
          ▼
    ┌─────────────┐
    │   Format    │
    │   Output    │
    └─────────────┘
          │
          ▼
    ┌─────────────┐
    │ Tool Result │
    │   Message   │
    └─────────────┘
```

## Error Handling

```
┌────────────────────────────────────────┐
│           AnthropicApiError            │ ← Base class
├────────────────────────────────────────┤
│ AuthenticationError  │ 401             │
│ PermissionError      │ 403             │
│ NotFoundError        │ 404             │
│ RateLimitError       │ 429             │
│ InvalidRequestError  │ 400             │
│ OverloadedError      │ 529             │
│ InternalServerError  │ 500             │
├────────────────────────────────────────┤
│ TimeoutError         │ Client timeout  │
│ ConnectionError      │ Network error   │
│ StreamAbortedError   │ Stream abort    │
│ ParseError           │ JSON parse fail │
└────────────────────────────────────────┘
```

### Retry Strategy

```typescript
// Retryable errors:
// - RateLimitError (429)
// - OverloadedError (529)
// - TimeoutError
// - ConnectionError

// Retry delay calculation:
const baseDelay = 1000; // 1 second
const maxDelay = 30000; // 30 seconds

function getRetryDelay(attempt: number): number {
  const exponentialDelay = baseDelay * Math.pow(2, attempt);
  const jitter = Math.random() * 0.3 * exponentialDelay;
  return Math.min(exponentialDelay + jitter, maxDelay);
}
```

## Streaming Protocol

### Server-Sent Events (SSE)

```
event: message_start
data: {"type":"message_start","message":{...}}

event: content_block_start
data: {"type":"content_block_start","index":0,...}

event: content_block_delta
data: {"type":"content_block_delta","delta":{"text":"Hello"}}

event: content_block_stop
data: {"type":"content_block_stop","index":0}

event: message_delta
data: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}

event: message_stop
data: {"type":"message_stop"}
```

### Stream Message Builder

```typescript
class StreamMessageBuilder {
  message: PartialMessage;
  contentBlocks: ContentBlock[];

  processEvent(event: StreamEvent): void {
    switch (event.type) {
      case 'message_start':
        // Initialize message
        break;
      case 'content_block_start':
        // Add new content block
        break;
      case 'content_block_delta':
        // Update content block
        break;
      case 'message_delta':
        // Update message metadata
        break;
    }
  }
}
```

## Theme System

```typescript
interface ThemeColors {
  // Text
  text: string;
  textMuted: string;
  textDim: string;

  // Status
  success: string;
  warning: string;
  error: string;
  info: string;

  // UI Elements
  border: string;
  background: string;
  highlight: string;

  // Syntax (for code)
  keyword: string;
  string: string;
  number: string;
  comment: string;
}

// Available themes:
// - dark (default)
// - light
// - monokai
// - solarized
```

## Security Considerations

### Sandbox Mode

```typescript
// Blocked commands in sandbox mode:
const SANDBOX_BLOCKED = [
  'rm -rf /',
  'sudo',
  'chmod 777',
  // ...
];

// Protected files:
const PROTECTED_FILES = [
  '.git/config',
  'package-lock.json',
  // ...
];

// Sensitive file extensions:
const SENSITIVE_EXTENSIONS = [
  '.env',
  '.pem',
  '.key',
  // ...
];
```

### Input Validation

Moi tool co validateInput() function:
- Kiem tra required parameters
- Validate types
- Check path constraints
- Detect dangerous operations
