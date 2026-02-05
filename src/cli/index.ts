#!/usr/bin/env node
/**
 * Claude Code CLI - Entry Point
 * Main entry point cho ứng dụng
 */

import { Command } from 'commander';
import { render } from 'ink';
import React from 'react';
import { VERSION, APP_NAME, getApiKey } from '../config';
import App from './App';

// ============================================================================
// CLI Program
// ============================================================================

const program = new Command();

program
  .name(APP_NAME)
  .description('Claude Code - AI assistant for software development')
  .version(VERSION)
  .option('-d, --debug', 'Enable debug mode')
  .option('-v, --verbose', 'Enable verbose output')
  .option('-m, --model <model>', 'Model to use (opus, sonnet, haiku)')
  .option('-p, --prompt <prompt>', 'Initial prompt')
  .option('--no-interactive', 'Run in non-interactive mode')
  .option('--api-key <key>', 'Anthropic API key')
  .option('-c, --continue <session>', 'Continue from session')
  .option('--print', 'Print response and exit');

// Parse arguments
program.parse();

const options = program.opts();

// ============================================================================
// Startup
// ============================================================================

async function main() {
  // Check API key
  const apiKey = options.apiKey || getApiKey();
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required.');
    console.error('Set it with: export ANTHROPIC_API_KEY="your-key-here"');
    process.exit(1);
  }

  // Check if stdin is TTY (interactive mode)
  const isInteractive = process.stdin.isTTY && options.interactive !== false;

  // Handle non-interactive mode (piped input)
  if (!isInteractive && !options.prompt) {
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk;
    }
    options.prompt = input.trim();
  }

  // Render the app
  try {
    const { waitUntilExit } = render(
      React.createElement(App, {
        debug: options.debug || false,
        verbose: options.verbose || false,
        model: options.model,
        initialPrompt: options.prompt,
        sessionId: options.continue,
        printMode: options.print || false,
        apiKey,
      })
    );

    await waitUntilExit();
  } catch (error) {
    if (error instanceof Error) {
      console.error('Error:', error.message);
      if (options.debug) {
        console.error(error.stack);
      }
    }
    process.exit(1);
  }
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
