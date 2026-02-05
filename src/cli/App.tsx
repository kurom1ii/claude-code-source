/**
 * Claude Code - Main App Component
 * React/Ink component chính cho CLI
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useApp, useInput, useStdin } from 'ink';
import { StatusLine } from '../ui';
import { AnthropicClient, createUserMessage } from '../api';
import { getToolDefinitions, executeTool } from '../tools';
import { DEFAULT_MODEL, getRandomThinkingVerb } from '../config';
import type { Message, ContentBlock, AppState, AppMode } from '../types';

// ============================================================================
// Props Interface
// ============================================================================

export interface AppProps {
  /** Enable debug mode */
  debug: boolean;
  /** Enable verbose output */
  verbose: boolean;
  /** Model to use */
  model?: string;
  /** Initial prompt */
  initialPrompt?: string;
  /** Session ID to continue */
  sessionId?: string;
  /** Print mode (output and exit) */
  printMode: boolean;
  /** API key */
  apiKey: string;
}

// ============================================================================
// App Component
// ============================================================================

const App: React.FC<AppProps> = ({
  debug,
  verbose,
  model,
  initialPrompt,
  sessionId,
  printMode,
  apiKey,
}) => {
  const { exit } = useApp();
  const { isRawModeSupported } = useStdin();

  // State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [thinkingVerb, setThinkingVerb] = useState('Thinking');
  const [currentModel, setCurrentModel] = useState(model || DEFAULT_MODEL);
  const [mode, setMode] = useState<AppMode>('code');
  const [error, setError] = useState<string | null>(null);

  // API Client
  const [client] = useState(() => new AnthropicClient({ apiKey }));

  // ============================================================================
  // Handle Input
  // ============================================================================

  useInput((input, key) => {
    if (isProcessing) return;

    // Exit shortcuts
    if (key.ctrl && input === 'c') {
      exit();
      return;
    }

    // Submit on Enter
    if (key.return && inputValue.trim()) {
      handleSubmit(inputValue.trim());
      setInputValue('');
      return;
    }

    // Handle backspace
    if (key.backspace) {
      setInputValue((prev) => prev.slice(0, -1));
      return;
    }

    // Add character
    if (input && !key.ctrl && !key.meta) {
      setInputValue((prev) => prev + input);
    }
  });

  // ============================================================================
  // Handle Message Submit
  // ============================================================================

  const handleSubmit = useCallback(async (prompt: string) => {
    setIsProcessing(true);
    setThinkingVerb(getRandomThinkingVerb());
    setError(null);

    // Add user message
    const userMessage = createUserMessage(prompt);
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);

    try {
      // Call API với streaming
      const stream = client.streamMessage({
        model: currentModel,
        max_tokens: 8096,
        messages: updatedMessages,
        tools: getToolDefinitions() as any,
      });

      let assistantContent: ContentBlock[] = [];

      for await (const event of stream) {
        if (event.type === 'content_block_start' && event.content_block) {
          assistantContent.push(event.content_block);
        } else if (event.type === 'content_block_delta' && event.delta) {
          const lastBlock = assistantContent[assistantContent.length - 1];
          if (lastBlock && event.delta.text && lastBlock.type === 'text') {
            (lastBlock as any).text += event.delta.text;
          }
        }
      }

      // Add assistant response
      const assistantMessage: Message = {
        role: 'assistant',
        content: assistantContent,
      };
      setMessages((prev) => [...prev, assistantMessage]);

      // Handle tool calls
      const toolUses = assistantContent.filter(
        (block) => block.type === 'tool_use'
      );

      for (const toolUse of toolUses) {
        if (toolUse.type === 'tool_use') {
          const result = await executeTool(toolUse.name, toolUse.input as Record<string, unknown>);

          // Add tool result message
          const toolResultMessage: Message = {
            role: 'user',
            content: [
              {
                type: 'tool_result',
                tool_use_id: toolUse.id,
                content: result.success ? (result.output || '') : (result.error || 'Unknown error'),
                is_error: !result.success,
              },
            ],
          };
          setMessages((prev) => [...prev, toolResultMessage]);
        }
      }

      // Continue if there were tool calls
      if (toolUses.length > 0) {
        // Recursively process tool results
        // (Simplified - in real implementation would need proper loop)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setError(message);
    } finally {
      setIsProcessing(false);
    }
  }, [messages, currentModel, client]);

  // ============================================================================
  // Initial Prompt Effect
  // ============================================================================

  useEffect(() => {
    if (initialPrompt) {
      handleSubmit(initialPrompt);
    }
  }, []); // Run once on mount

  // ============================================================================
  // Print Mode Effect
  // ============================================================================

  useEffect(() => {
    if (printMode && !isProcessing && messages.length > 1) {
      // Find last assistant message
      const lastAssistant = [...messages].reverse().find((m) => m.role === 'assistant');
      if (lastAssistant && Array.isArray(lastAssistant.content)) {
        const text = lastAssistant.content
          .filter((b): b is ContentBlock & { type: 'text'; text: string } => b.type === 'text')
          .map((b) => b.text)
          .join('\n');
        console.log(text);
      }
      exit();
    }
  }, [printMode, isProcessing, messages, exit]);

  // ============================================================================
  // Render
  // ============================================================================

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text bold color="cyan">
          Claude Code
        </Text>
        <Text dimColor> v{require('../../package.json').version}</Text>
        <Text dimColor> • {currentModel}</Text>
      </Box>

      {/* Messages */}
      <Box flexDirection="column" marginBottom={1}>
        {messages.map((message, index) => (
          <Box key={index} marginBottom={1}>
            <Text bold color={message.role === 'user' ? 'blue' : 'green'}>
              {message.role === 'user' ? '> ' : '< '}
            </Text>
            <Text wrap="wrap">
              {typeof message.content === 'string'
                ? message.content
                : message.content
                    .filter((b): b is ContentBlock & { type: 'text'; text: string } => b.type === 'text')
                    .map((b) => b.text)
                    .join('\n')}
            </Text>
          </Box>
        ))}
      </Box>

      {/* Processing indicator */}
      {isProcessing && (
        <Box marginBottom={1}>
          <Text color="yellow">⟳ {thinkingVerb}...</Text>
        </Box>
      )}

      {/* Error display */}
      {error && (
        <Box marginBottom={1}>
          <Text color="red">Error: {error}</Text>
        </Box>
      )}

      {/* Input */}
      {!printMode && (
        <Box>
          <Text color="cyan">{'> '}</Text>
          <Text>{inputValue}</Text>
          <Text color="gray">█</Text>
        </Box>
      )}

      {/* Status line */}
      <StatusLine
        mode={mode}
        model={currentModel}
        isProcessing={isProcessing}
        tokenCount={0}
      />
    </Box>
  );
};

export default App;
