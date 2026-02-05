# API Reference

> Tai lieu tham khao API cho Claude Code

## AnthropicClient

### Khoi tao

```typescript
import { AnthropicClient, createClientFromEnv, createClient } from './api';

// Tu environment variable
const client = createClientFromEnv();

// Manual configuration
const client = createClient({
  apiKey: 'sk-ant-...',
  baseUrl: 'https://api.anthropic.com', // optional
  timeout: 60000,  // ms, optional
  maxRetries: 2,   // optional
  defaultModel: 'claude-sonnet-4-20250514', // optional
  defaultMaxTokens: 8192, // optional
});
```

### createMessage

Tao message response (non-streaming).

```typescript
const response = await client.createMessage({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [
    { role: 'user', content: 'Hello!' }
  ],
  system: 'You are a helpful assistant.', // optional
  temperature: 0.7, // optional
  tools: [...], // optional
  tool_choice: { type: 'auto' }, // optional
});

// Response
interface CreateMessageResponse {
  id: string;
  type: 'message';
  role: 'assistant';
  model: string;
  content: ContentBlock[];
  stop_reason: StopReason;
  usage: Usage;
}
```

### streamMessage

Tao message voi streaming response.

```typescript
for await (const event of client.streamMessage({
  model: 'claude-sonnet-4-20250514',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }],
})) {
  switch (event.type) {
    case 'message_start':
      console.log('Message started:', event.message.id);
      break;

    case 'content_block_start':
      console.log('Content block started:', event.index);
      break;

    case 'content_block_delta':
      if (event.delta.type === 'text_delta') {
        process.stdout.write(event.delta.text);
      }
      break;

    case 'content_block_stop':
      console.log('\nContent block ended');
      break;

    case 'message_delta':
      console.log('Stop reason:', event.delta.stop_reason);
      break;

    case 'message_stop':
      console.log('Message complete');
      break;
  }
}
```

### complete

Shorthand de gui prompt va nhan text response.

```typescript
const text = await client.complete('What is 2+2?');
console.log(text); // "4"

// Voi options
const text = await client.complete('What is 2+2?', {
  model: 'claude-haiku-3-5-20250929',
  max_tokens: 100,
  temperature: 0,
});
```

### conversation

Builder pattern de tao conversations.

```typescript
const response = await client
  .conversation()
  .system('You are a math tutor.')
  .user('What is calculus?')
  .useModel('claude-sonnet-4-20250514')
  .withMaxTokens(2000)
  .withTemperature(0.7)
  .send();

// Streaming
for await (const event of client
  .conversation()
  .user('Tell me a story')
  .stream()) {
  // Handle events
}
```

---

## Types

### Messages

```typescript
// Message role
type MessageRole = 'user' | 'assistant';

// Basic message
interface Message {
  role: MessageRole;
  content: string | ContentBlock[];
}

// Content block types
type ContentBlock =
  | TextBlock
  | ImageBlock
  | ToolUseBlock
  | ToolResultBlock
  | ThinkingBlock;

// Text block
interface TextBlock {
  type: 'text';
  text: string;
}

// Image block
interface ImageBlock {
  type: 'image';
  source: ImageSource;
}

interface ImageSource {
  type: 'base64';
  media_type: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  data: string; // base64 encoded
}

// Tool use block
interface ToolUseBlock {
  type: 'tool_use';
  id: string;
  name: string;
  input: Record<string, unknown>;
}

// Tool result block
interface ToolResultBlock {
  type: 'tool_result';
  tool_use_id: string;
  content: string | ContentBlock[];
  is_error?: boolean;
}

// Thinking block (extended thinking)
interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
}
```

### Tools

```typescript
// Tool definition
interface ToolDefinition {
  name: string;
  description: string;
  input_schema: JsonSchema;
}

// Tool choice
type ToolChoice =
  | { type: 'auto' }
  | { type: 'any' }
  | { type: 'tool'; name: string };
```

### Request/Response

```typescript
// Create message request
interface CreateMessageRequest {
  model: string;
  max_tokens: number;
  messages: Message[];
  system?: SystemPrompt;
  tools?: ToolDefinition[];
  tool_choice?: ToolChoice;
  temperature?: number;
  top_p?: number;
  top_k?: number;
  stop_sequences?: string[];
  stream?: boolean;
  thinking?: ThinkingConfig;
  metadata?: RequestMetadata;
}

// System prompt
type SystemPrompt = string | SystemPromptBlock[];

interface SystemPromptBlock {
  type: 'text';
  text: string;
  cache_control?: CacheControl;
}

// Thinking config
interface ThinkingConfig {
  type: 'enabled' | 'disabled';
  budget_tokens?: number; // for enabled
}

// Usage
interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens?: number;
  cache_read_input_tokens?: number;
}

// Stop reason
type StopReason = 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
```

### Streaming Events

```typescript
// Event types
type StreamEvent =
  | MessageStartEvent
  | ContentBlockStartEvent
  | ContentBlockDeltaEvent
  | ContentBlockStopEvent
  | MessageDeltaEvent
  | MessageStopEvent
  | PingEvent
  | ErrorEvent;

interface MessageStartEvent {
  type: 'message_start';
  message: PartialMessage;
}

interface ContentBlockStartEvent {
  type: 'content_block_start';
  index: number;
  content_block: ContentBlock;
}

interface ContentBlockDeltaEvent {
  type: 'content_block_delta';
  index: number;
  delta: ContentDelta;
}

interface ContentBlockStopEvent {
  type: 'content_block_stop';
  index: number;
}

interface MessageDeltaEvent {
  type: 'message_delta';
  delta: {
    stop_reason: StopReason;
    stop_sequence?: string;
  };
  usage: { output_tokens: number };
}

interface MessageStopEvent {
  type: 'message_stop';
}
```

---

## Error Classes

```typescript
// Base error
class AnthropicApiError extends Error {
  status?: number;
  errorType?: string;
  requestId?: string;

  static fromResponse(body, status, requestId): AnthropicApiError;
}

// Specific errors
class AuthenticationError extends AnthropicApiError {}  // 401
class PermissionError extends AnthropicApiError {}      // 403
class NotFoundError extends AnthropicApiError {}        // 404
class RateLimitError extends AnthropicApiError {
  retryAfter?: number;  // seconds
}                                                        // 429
class InvalidRequestError extends AnthropicApiError {}  // 400
class OverloadedError extends AnthropicApiError {}      // 529
class InternalServerError extends AnthropicApiError {}  // 500

// Client-side errors
class TimeoutError extends AnthropicApiError {
  timeout: number;
}
class ConnectionError extends AnthropicApiError {
  cause?: Error;
}
class StreamAbortedError extends AnthropicApiError {}
class ParseError extends AnthropicApiError {}
```

### Error handling

```typescript
import { isAnthropicError, shouldRetry, getRetryDelay } from './api/errors';

try {
  const response = await client.createMessage(request);
} catch (error) {
  if (isAnthropicError(error)) {
    if (error instanceof RateLimitError) {
      const delay = error.retryAfter ?? getRetryDelay(0);
      await sleep(delay * 1000);
      // retry
    } else if (error instanceof AuthenticationError) {
      console.error('Invalid API key');
    }
  }
}
```

---

## Models

### Available Models

```typescript
// Opus models (most capable)
const OPUS_MODELS = [
  'claude-opus-4-20250514',
  'claude-opus-4-5-20251101',
];

// Sonnet models (balanced)
const SONNET_MODELS = [
  'claude-sonnet-4-20250514',
  'claude-sonnet-4-5-20250929',
];

// Haiku models (fastest)
const HAIKU_MODELS = [
  'claude-haiku-3-5-20250929',
];
```

### Model Aliases

```typescript
const MODEL_ALIASES = {
  opus: 'claude-opus-4-5-20251101',
  sonnet: 'claude-sonnet-4-5-20250929',
  haiku: 'claude-haiku-3-5-20250929',
};

// Resolve alias
const modelId = resolveModelAlias('sonnet');
// -> 'claude-sonnet-4-5-20250929'
```

### Model Utilities

```typescript
// Lay label cho model
getModelLabel('claude-sonnet-4-20250514');
// -> 'Claude Sonnet 4'

// Lay mo ta
getModelDescription('claude-sonnet-4-20250514');
// -> 'Balanced performance and cost'

// Lay context limit
getContextLimit('claude-sonnet-4-20250514');
// -> 200000

// Kiem tra ho tro extended thinking
supportsExtendedThinking('claude-sonnet-4-20250514');
// -> true

// Kiem tra ho tro vision
supportsVision('claude-sonnet-4-20250514');
// -> true

// Lay model family
getModelFamily('claude-sonnet-4-20250514');
// -> 'sonnet'
```

---

## Streaming Utilities

### parseSSELine

Parse mot dong SSE.

```typescript
const result = parseSSELine('data: {"type":"message_start",...}');
// -> { event: 'data', data: '{"type":"message_start",...}' }
```

### parseStreamEvent

Parse SSE data thanh StreamEvent.

```typescript
const event = parseStreamEvent('{"type":"message_start",...}');
// -> MessageStartEvent
```

### streamEvents

Async generator cho stream events.

```typescript
for await (const event of streamEvents(response.body)) {
  // Handle event
}
```

### readStream

Doc stream voi callbacks.

```typescript
const response = await readStream(stream, {
  onEvent: (event) => console.log(event),
  onText: (text) => process.stdout.write(text),
  onToolUse: (toolUse) => console.log('Tool:', toolUse.name),
  onError: (error) => console.error(error),
});
```

### StreamMessageBuilder

Builder de accumulate stream events thanh message.

```typescript
const builder = new StreamMessageBuilder();

for await (const event of streamEvents(stream)) {
  builder.processEvent(event);

  if (event.type === 'content_block_delta') {
    // Access partial content
    console.log(builder.getText());
  }
}

// Get final message
const message = builder.getMessage();
```

### extractTextFromMessage

Extract text tu message response.

```typescript
const text = extractTextFromMessage(response);
```

### extractToolUsesFromMessage

Extract tool uses tu message response.

```typescript
const toolUses = extractToolUsesFromMessage(response);
for (const toolUse of toolUses) {
  console.log(toolUse.name, toolUse.input);
}
```

---

## Helper Functions

### createUserMessage

```typescript
const message = createUserMessage('Hello!');
// -> { role: 'user', content: 'Hello!' }
```

### createAssistantMessage

```typescript
const message = createAssistantMessage('Hi there!');
// -> { role: 'assistant', content: 'Hi there!' }
```

### createToolResultMessage

```typescript
const message = createToolResultMessage(
  'toolu_123',  // tool_use_id
  'Result content',
  false  // is_error
);
// -> { role: 'user', content: [{ type: 'tool_result', ... }] }
```
