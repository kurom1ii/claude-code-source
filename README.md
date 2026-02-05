# Claude Code - Reconstructed

> Phien ban tai cau truc day du cua Claude Code CLI tu source da obfuscate

## Gioi thieu

Day la project tai cau truc lai source code cua Claude Code CLI - mot cong cu CLI chinh thuc cua Anthropic de tuong tac voi Claude AI. Source goc da bi obfuscate (lam roi code), project nay da:

1. **Deobfuscate** file `cli.js` goc (7583 dong, 10.72MB)
2. **Phan tich** patterns va cau truc module
3. **Tai tao** thanh TypeScript/React modules co the doc va bao tri duoc
4. **Build** thanh binary chay doc lap

## Cai dat

```bash
# Cai dat dependencies
bun install

# Chay development mode
bun run dev

# Build
bun run build

# Build binary
bun run build:compile
```

## Su dung

```bash
# Hien thi version
./dist/claude --version

# Hien thi help
./dist/claude --help

# Chat voi prompt
./dist/claude "Hello, Claude!"

# Chat interactive mode
./dist/claude
```

## Cau truc project

```
final/
├── src/
│   ├── types/           # Type definitions
│   │   └── index.ts     # Messages, Tools, Agents, MCP types
│   │
│   ├── config/          # Configuration
│   │   └── index.ts     # VERSION, MODELS, THEMES, FLAGS
│   │
│   ├── utils/           # Utilities
│   │   └── index.ts     # Helper functions
│   │
│   ├── api/             # Anthropic API client
│   │   ├── types.ts     # API types
│   │   ├── models.ts    # Model definitions
│   │   ├── errors.ts    # Error classes
│   │   ├── streaming.ts # SSE parsing
│   │   ├── client.ts    # AnthropicClient
│   │   └── index.ts     # Exports
│   │
│   ├── tools/           # Built-in tools
│   │   ├── types.ts     # Tool types
│   │   ├── base.ts      # BaseTool, registry
│   │   ├── BashTool.ts  # Shell commands
│   │   ├── ReadTool.ts  # File reading
│   │   ├── WriteTool.ts # File writing
│   │   ├── EditTool.ts  # String replacement
│   │   ├── GlobTool.ts  # File search
│   │   ├── GrepTool.ts  # Content search
│   │   ├── TaskTool.ts  # Subagent spawning
│   │   ├── WebFetchTool.ts  # URL fetching
│   │   ├── WebSearchTool.ts # Web search
│   │   ├── LSPTool.ts   # Language Server
│   │   └── index.ts     # Exports
│   │
│   ├── ui/              # Ink/React components
│   │   ├── Box.tsx      # Layout component
│   │   ├── Text.tsx     # Text rendering
│   │   ├── Input.tsx    # Text input
│   │   ├── Select.tsx   # Selection
│   │   ├── Spinner.tsx  # Loading indicators
│   │   ├── Thinker.tsx  # Thinking animation
│   │   ├── Divider.tsx  # Separators
│   │   ├── StatusLine.tsx   # Status bar
│   │   ├── MessageDisplay.tsx # Messages
│   │   ├── ToolOutput.tsx   # Tool results
│   │   ├── Theme.tsx    # Theme system
│   │   └── index.tsx    # Exports
│   │
│   └── cli/             # CLI entry point
│       ├── index.ts     # Commander setup
│       └── App.tsx      # Main React app
│
├── dist/                # Build output
│   ├── cli.js           # Bundled JS
│   └── claude           # Compiled binary
│
├── package.json
├── tsconfig.json
├── REFACTOR_PROGRESS.md # Tien trinh
└── README.md            # File nay
```

## Cac module chinh

### API Client (`src/api/`)

```typescript
import { AnthropicClient, createClientFromEnv } from './api';

const client = createClientFromEnv();

// Non-streaming
const response = await client.createMessage({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }],
});

// Streaming
for await (const event of client.streamMessage(request)) {
  if (event.type === 'content_block_delta') {
    process.stdout.write(event.delta.text || '');
  }
}
```

### Tools (`src/tools/`)

```typescript
import { BashTool, ReadTool, EditTool } from './tools';

// Tao tool handler
const bashHandler = BashTool.createHandler(context);
const result = await bashHandler.execute({
  command: 'ls -la',
  timeout: 30000,
});
```

### UI Components (`src/ui/`)

```tsx
import { Box, Text, Spinner, StatusLine } from './ui';

function MyComponent() {
  return (
    <Box flexDirection="column">
      <Text color="green">Hello!</Text>
      <Spinner type="dots" label="Loading..." />
      <StatusLine model="claude-sonnet" tokens={{ input: 100, output: 50 }} />
    </Box>
  );
}
```

## Tools co san

| Tool | Mo ta | Yeu cau xac nhan |
|------|-------|------------------|
| Bash | Chay shell commands | Co |
| Read | Doc file | Khong |
| Write | Ghi file | Co |
| Edit | Sua file (string replacement) | Co |
| Glob | Tim file theo pattern | Khong |
| Grep | Tim noi dung trong files | Khong |
| Task | Spawn subagent | Khong |
| WebFetch | Fetch URL | Khong |
| WebSearch | Tim kiem web | Khong |
| LSP | Language Server Protocol | Khong |

## API Models

```typescript
// Available models
const OPUS_MODELS = ['claude-opus-4-20250514', 'claude-opus-4-5-20251101'];
const SONNET_MODELS = ['claude-sonnet-4-20250514', 'claude-sonnet-4-5-20250929'];
const HAIKU_MODELS = ['claude-haiku-3-5-20250929'];

// Model aliases
const MODEL_ALIASES = {
  opus: 'claude-opus-4-5-20251101',
  sonnet: 'claude-sonnet-4-5-20250929',
  haiku: 'claude-haiku-3-5-20250929',
};
```

## Environment Variables

| Bien | Mo ta |
|------|-------|
| `ANTHROPIC_API_KEY` | API key de xac thuc |
| `CLAUDE_MODEL` | Model mac dinh |
| `CLAUDE_THEME` | Theme (dark/light/monokai/solarized) |

## Qua trinh Deobfuscation

1. **Doc file goc**: `cli.js` (7583 dong, minified)
2. **Phan tich patterns** tu `tweakcc` (patch tool)
3. **Parse AST** voi `@babel/parser`
4. **Beautify** voi `@babel/generator` + `prettier`
5. **Chia sections** theo heuristics
6. **Map identifiers** tu obfuscated -> readable
7. **Tao TypeScript modules** voi types day du
8. **Build** voi `bun`

### Key patterns tim duoc:

```javascript
// Module loader
var o = (A, q, K) => {
  q = A.exports;
  K(q, A);
  return A.exports;
};

// React module: _1
// Chalk: K6
// Text component: f
// Box component: kg5
```

## License

UNLICENSED - Day la project nghien cuu/hoc tap.
Source goc thuoc ve Anthropic.

## Tac gia

Tai cau truc boi Claude voi huong dan cua nguoi dung.
