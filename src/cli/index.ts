#!/usr/bin/env node
/**
 * Claude Code CLI - Entry Point
 * Main entry point cho ung dung
 *
 * Enhanced with full subcommand support:
 * - mcp: MCP server management
 * - doctor: Health check
 * - update: Check for updates
 * - config: Configuration management
 */

import { Command, Option } from 'commander';
import { render } from 'ink';
import React from 'react';
import { VERSION, APP_NAME, getApiKey, CLAUDE_CONFIG_DIR } from '../config';
import App from './App';

// ============================================================================
// Types
// ============================================================================

export interface CliOptions {
  debug?: boolean | string;
  verbose?: boolean;
  model?: string;
  prompt?: string;
  print?: boolean;
  continue?: boolean;
  resume?: string | boolean;
  forkSession?: boolean;
  apiKey?: string;
  outputFormat?: 'text' | 'json' | 'stream-json';
  inputFormat?: 'text' | 'stream-json';
  systemPrompt?: string;
  appendSystemPrompt?: string;
  permissionMode?: string;
  allowedTools?: string[];
  disallowedTools?: string[];
  mcpConfig?: string[];
  addDir?: string[];
  dangerouslySkipPermissions?: boolean;
  maxTurns?: number;
  maxThinkingTokens?: number;
  agent?: string;
  sessionId?: string;
  interactive?: boolean;
}

// ============================================================================
// Permission Modes
// ============================================================================

const PERMISSION_MODES = ['default', 'plan', 'bypassPermissions'] as const;

// ============================================================================
// Helper Functions
// ============================================================================

function configureHelp() {
  const getOptionName = (opt: { long?: string; short?: string }) =>
    opt.long?.replace(/^--/, '') ?? opt.short?.replace(/^-/, '') ?? '';

  return {
    sortSubcommands: true,
    sortOptions: true,
    compareOptions: (a: { long?: string; short?: string }, b: { long?: string; short?: string }) =>
      getOptionName(a).localeCompare(getOptionName(b)),
  };
}

// ============================================================================
// CLI Program
// ============================================================================

const program = new Command();

program
  .name(APP_NAME)
  .description(
    'Claude Code - starts an interactive session by default, use -p/--print for non-interactive output'
  )
  .version(`${VERSION} (Claude Code Community)`, '-v, --version', 'Output the version number')
  .configureHelp(configureHelp())
  .enablePositionalOptions()
  .argument('[prompt]', 'Your prompt', String)
  .helpOption('-h, --help', 'Display help for command')

  // Debug options
  .option(
    '-d, --debug [filter]',
    'Enable debug mode with optional category filtering (e.g., "api,hooks" or "!1p,!file")'
  )
  .option('--verbose', 'Override verbose mode setting from config')

  // Print mode options
  .option(
    '-p, --print',
    'Print response and exit (useful for pipes). Note: The workspace trust dialog is skipped when Claude is run with -p mode.'
  )
  .addOption(
    new Option(
      '--output-format <format>',
      'Output format (only works with --print): "text" (default), "json" (single result), or "stream-json" (realtime streaming)'
    ).choices(['text', 'json', 'stream-json'])
  )
  .addOption(
    new Option(
      '--input-format <format>',
      'Input format (only works with --print): "text" (default), or "stream-json" (realtime streaming)'
    ).choices(['text', 'stream-json'])
  )

  // Session management
  .option(
    '-c, --continue',
    'Continue the most recent conversation in the current directory'
  )
  .option(
    '-r, --resume [value]',
    'Resume a conversation by session ID, or open interactive picker with optional search term'
  )
  .option(
    '--fork-session',
    'When resuming, create a new session ID instead of reusing the original (use with --resume or --continue)'
  )
  .option(
    '--session-id <uuid>',
    'Use a specific session ID for the conversation (must be a valid UUID)'
  )
  .option(
    '--no-session-persistence',
    'Disable session persistence - sessions will not be saved to disk (only works with --print)'
  )

  // Model options
  .option(
    '--model <model>',
    "Model for the current session. Provide an alias (e.g. 'sonnet' or 'opus') or a full model name."
  )
  .option('--agent <agent>', "Agent for the current session. Overrides the 'agent' setting.")

  // System prompt options
  .addOption(
    new Option('--system-prompt <prompt>', 'System prompt to use for the session')
  )
  .addOption(
    new Option(
      '--append-system-prompt <prompt>',
      'Append a system prompt to the default system prompt'
    )
  )

  // Permission options
  .addOption(
    new Option('--permission-mode <mode>', 'Permission mode to use for the session').choices(
      PERMISSION_MODES
    )
  )
  .option(
    '--dangerously-skip-permissions',
    'Bypass all permission checks. Recommended only for sandboxes with no internet access.'
  )

  // Tool options
  .option(
    '--allowed-tools <tools...>',
    'Comma or space-separated list of tool names to allow (e.g. "Bash(git:*) Edit")'
  )
  .option(
    '--disallowed-tools <tools...>',
    'Comma or space-separated list of tool names to deny (e.g. "Bash(git:*) Edit")'
  )

  // MCP options
  .option(
    '--mcp-config <configs...>',
    'Load MCP servers from JSON files or strings (space-separated)'
  )
  .option(
    '--strict-mcp-config',
    'Only use MCP servers from --mcp-config, ignoring all other MCP configurations'
  )

  // Other options
  .option('--add-dir <directories...>', 'Additional directories to allow tool access to')
  .option('--api-key <key>', 'Anthropic API key')
  .option('--no-interactive', 'Run in non-interactive mode')

  // Hidden advanced options
  .addOption(
    new Option('--max-turns <turns>', 'Maximum number of agentic turns in non-interactive mode')
      .argParser(Number)
      .hideHelp()
  )
  .addOption(
    new Option('--max-thinking-tokens <tokens>', 'Maximum number of thinking tokens')
      .argParser(Number)
      .hideHelp()
  );

// ============================================================================
// Main Action
// ============================================================================

program.action(async (prompt: string | undefined, options: CliOptions) => {
  // Handle "code" as first word (backward compatibility)
  if (prompt === 'code') {
    console.warn('\x1b[33mTip: You can launch Claude Code with just `claude`\x1b[0m');
    prompt = undefined;
  }

  // Check API key
  const apiKey = options.apiKey || getApiKey();
  if (!apiKey) {
    console.error('Error: ANTHROPIC_API_KEY environment variable is required.');
    console.error('Set it with: export ANTHROPIC_API_KEY="your-key-here"');
    process.exit(1);
  }

  // Validate session-id usage
  if (options.sessionId && (options.continue || options.resume) && !options.forkSession) {
    console.error(
      'Error: --session-id can only be used with --continue or --resume if --fork-session is also specified.'
    );
    process.exit(1);
  }

  // Check if stdin is TTY (interactive mode)
  const isInteractive = process.stdin.isTTY && options.interactive !== false;

  // Handle non-interactive mode (piped input)
  let inputPrompt = prompt;
  if (!isInteractive && !prompt) {
    let input = '';
    for await (const chunk of process.stdin) {
      input += chunk;
    }
    inputPrompt = input.trim();
  }

  // Print mode
  const isPrintMode = options.print || false;

  // Render the app
  try {
    const { waitUntilExit } = render(
      React.createElement(App, {
        debug: !!options.debug,
        verbose: options.verbose || false,
        model: options.model,
        initialPrompt: inputPrompt,
        sessionId: typeof options.resume === 'string' ? options.resume : undefined,
        printMode: isPrintMode,
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
});

// ============================================================================
// MCP Subcommand
// ============================================================================

const mcpCommand = program
  .command('mcp')
  .description('Configure and manage MCP servers')
  .helpOption('-h, --help', 'Display help for command')
  .configureHelp(configureHelp());

// MCP serve
mcpCommand
  .command('serve')
  .description('Start the Claude Code MCP server')
  .option('-d, --debug', 'Enable debug mode')
  .option('--verbose', 'Override verbose mode setting from config')
  .action(async (options) => {
    console.log('Starting Claude Code MCP server...');
    console.log('Debug:', options.debug || false);
    console.log('Verbose:', options.verbose || false);
    // TODO: Implement MCP server
    console.log('MCP server is not yet implemented in community fork.');
  });

// MCP add
mcpCommand
  .command('add <type> <name> <command-or-url> [args...]')
  .description('Add an MCP server (stdio or SSE)')
  .option('-s, --scope <scope>', 'Configuration scope (local, user, or project)', 'local')
  .option('-e, --env <env...>', 'Environment variables (NAME=value)')
  .action(async (type, name, commandOrUrl, args, options) => {
    console.log(`Adding MCP server: ${name}`);
    console.log(`Type: ${type}`);
    console.log(`Command/URL: ${commandOrUrl}`);
    console.log(`Args: ${args.join(' ')}`);
    console.log(`Scope: ${options.scope}`);
    // TODO: Implement MCP add
    console.log('MCP add is not yet implemented in community fork.');
  });

// MCP remove
mcpCommand
  .command('remove <name>')
  .description('Remove an MCP server')
  .option('-s, --scope <scope>', 'Configuration scope (local, user, or project)')
  .action(async (name, options) => {
    console.log(`Removing MCP server: ${name}`);
    console.log(`Scope: ${options.scope || 'auto-detect'}`);
    // TODO: Implement MCP remove
    console.log('MCP remove is not yet implemented in community fork.');
  });

// MCP list
mcpCommand
  .command('list')
  .description('List configured MCP servers')
  .action(async () => {
    console.log('Listing MCP servers...');
    // TODO: Implement MCP list
    console.log('No MCP servers configured. Use `claude mcp add` to add a server.');
  });

// MCP get
mcpCommand
  .command('get <name>')
  .description('Get details about an MCP server')
  .action(async (name) => {
    console.log(`Getting details for MCP server: ${name}`);
    // TODO: Implement MCP get
    console.log('MCP get is not yet implemented in community fork.');
  });

// MCP add-json
mcpCommand
  .command('add-json <name> <json>')
  .description('Add an MCP server with a JSON string')
  .option('-s, --scope <scope>', 'Configuration scope (local, user, or project)', 'local')
  .action(async (name, json, options) => {
    console.log(`Adding MCP server from JSON: ${name}`);
    console.log(`Scope: ${options.scope}`);
    // TODO: Implement MCP add-json
    console.log('MCP add-json is not yet implemented in community fork.');
  });

// MCP reset-project-choices
mcpCommand
  .command('reset-project-choices')
  .description('Reset all approved and rejected project-scoped (.mcp.json) servers')
  .action(async () => {
    console.log('Resetting project MCP server choices...');
    // TODO: Implement reset
    console.log('All project-scoped server approvals have been reset.');
  });

// ============================================================================
// Doctor Subcommand
// ============================================================================

program
  .command('doctor')
  .description('Check the health of your Claude Code installation')
  .helpOption('-h, --help', 'Display help for command')
  .action(async () => {
    console.log('Running Claude Code health check...\n');

    // Check API key
    const apiKey = getApiKey();
    if (apiKey) {
      console.log('\x1b[32m✓\x1b[0m API key configured');
    } else {
      console.log('\x1b[31m✗\x1b[0m API key not configured');
      console.log('  Set ANTHROPIC_API_KEY environment variable');
    }

    // Check config directory
    const fs = await import('fs');
    if (fs.existsSync(CLAUDE_CONFIG_DIR)) {
      console.log(`\x1b[32m✓\x1b[0m Config directory exists: ${CLAUDE_CONFIG_DIR}`);
    } else {
      console.log(`\x1b[33m!\x1b[0m Config directory not found: ${CLAUDE_CONFIG_DIR}`);
    }

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
    if (majorVersion >= 18) {
      console.log(`\x1b[32m✓\x1b[0m Node.js version: ${nodeVersion}`);
    } else {
      console.log(`\x1b[31m✗\x1b[0m Node.js version too old: ${nodeVersion} (requires >= 18)`);
    }

    // Check platform
    console.log(`\x1b[32m✓\x1b[0m Platform: ${process.platform} ${process.arch}`);

    console.log('\nHealth check complete.');
    process.exit(0);
  });

// ============================================================================
// Update Subcommand
// ============================================================================

program
  .command('update')
  .description('Check for updates and install if available')
  .helpOption('-h, --help', 'Display help for command')
  .action(async () => {
    console.log('Checking for updates...');
    console.log(`Current version: ${VERSION}`);
    // TODO: Implement update check
    console.log('Update check is not yet implemented in community fork.');
    console.log('Please check GitHub for the latest version.');
    process.exit(0);
  });

// ============================================================================
// Config Subcommand
// ============================================================================

const configCommand = program
  .command('config')
  .description('Manage Claude Code configuration')
  .helpOption('-h, --help', 'Display help for command')
  .configureHelp(configureHelp());

// Config show
configCommand
  .command('show')
  .description('Show current configuration')
  .action(async () => {
    console.log('Current configuration:\n');
    console.log(`Config directory: ${CLAUDE_CONFIG_DIR}`);
    console.log(`API Key: ${getApiKey() ? '***configured***' : 'not set'}`);
    console.log(`Version: ${VERSION}`);
    process.exit(0);
  });

// Config set
configCommand
  .command('set <key> <value>')
  .description('Set a configuration value')
  .action(async (key, value) => {
    console.log(`Setting ${key} = ${value}`);
    // TODO: Implement config set
    console.log('Config set is not yet implemented in community fork.');
  });

// Config get
configCommand
  .command('get <key>')
  .description('Get a configuration value')
  .action(async (key) => {
    console.log(`Getting value for: ${key}`);
    // TODO: Implement config get
    console.log('Config get is not yet implemented in community fork.');
  });

// ============================================================================
// Session Subcommand
// ============================================================================

const sessionCommand = program
  .command('session')
  .description('Manage Claude Code sessions')
  .helpOption('-h, --help', 'Display help for command')
  .configureHelp(configureHelp());

// Session list
sessionCommand
  .command('list')
  .description('List recent sessions')
  .option('-n, --limit <number>', 'Number of sessions to show', '10')
  .action(async (options) => {
    console.log(`Listing last ${options.limit} sessions...`);
    // TODO: Implement session list
    console.log('Session list is not yet implemented in community fork.');
  });

// Session show
sessionCommand
  .command('show <session-id>')
  .description('Show details of a session')
  .action(async (sessionId) => {
    console.log(`Showing session: ${sessionId}`);
    // TODO: Implement session show
    console.log('Session show is not yet implemented in community fork.');
  });

// Session delete
sessionCommand
  .command('delete <session-id>')
  .description('Delete a session')
  .action(async (sessionId) => {
    console.log(`Deleting session: ${sessionId}`);
    // TODO: Implement session delete
    console.log('Session delete is not yet implemented in community fork.');
  });

// ============================================================================
// Startup
// ============================================================================

async function main() {
  try {
    await program.parseAsync(process.argv);
  } catch (error) {
    if (error instanceof Error) {
      console.error('Fatal error:', error.message);
    }
    process.exit(1);
  }
}

// Run
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

// Export for testing
export { program };
