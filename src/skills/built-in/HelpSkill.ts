/**
 * Claude Code - Help Skill
 *
 * Skill /help hien thi thong tin huong dan su dung.
 * Liet ke cac skills, commands va cach su dung Claude Code.
 *
 * Usage: /help [topic]
 * - Neu khong co topic: Hien thi overview va danh sach skills
 * - Neu co topic: Hien thi help cu the cho topic do
 */

import type {
  SkillDefinition,
  SkillDoneCallback,
  SkillResumeFunction,
  SkillHandler,
  SkillCallResult,
  SkillExecutionContext,
  SkillListFormatOptions,
} from '../types';
import {
  getAllSkills,
  getVisibleSkills,
  getSkillsBySource,
  getSkill,
} from '../SkillRegistry';

// ============================================================================
// Constants - Hang so
// ============================================================================

/**
 * Ten skill
 */
const SKILL_NAME = 'help';

/**
 * Cac topic co san
 */
const HELP_TOPICS = [
  'skills',     // Danh sach skills
  'commands',   // Cac CLI commands
  'tools',      // Cac tools co san
  'shortcuts',  // Keyboard shortcuts
  'config',     // Configuration
  'plugins',    // Plugin system
] as const;

type HelpTopic = typeof HELP_TOPICS[number];

// ============================================================================
// Skill Definition - Dinh nghia skill
// ============================================================================

/**
 * Dinh nghia cho help skill
 */
export const helpSkillDefinition: SkillDefinition = {
  type: 'local-jsx',
  name: SKILL_NAME,
  description: 'Show help and available commands',
  argumentHint: '[topic]',
  isEnabled: () => true,
  isHidden: false,
  source: 'built-in',

  call(
    done: SkillDoneCallback,
    _resume: SkillResumeFunction | undefined,
    args?: string
  ): unknown {
    const topic = args?.trim().toLowerCase();

    // Neu co topic cu the
    if (topic && HELP_TOPICS.includes(topic as HelpTopic)) {
      const helpText = getTopicHelp(topic as HelpTopic);
      done(helpText, { display: 'system' });
      return null;
    }

    // Neu topic khong hop le
    if (topic && !HELP_TOPICS.includes(topic as HelpTopic)) {
      // Thu tim skill voi ten do
      const skill = getSkill(topic);
      if (skill) {
        const helpText = getSkillHelp(skill);
        done(helpText, { display: 'system' });
        return null;
      }

      // Khong tim thay
      done(
        `Unknown topic: "${topic}". Available topics: ${HELP_TOPICS.join(', ')}`,
        { display: 'system' }
      );
      return null;
    }

    // Mac dinh: hien thi overview
    const helpText = getOverviewHelp();
    done(helpText, { display: 'system' });
    return null;
  },

  userFacingName(): string {
    return SKILL_NAME;
  },
};

// ============================================================================
// Help Content Generation - Tao noi dung help
// ============================================================================

/**
 * Tao overview help
 */
function getOverviewHelp(): string {
  const visibleSkills = getVisibleSkills();

  const sections = [
    '# Claude Code Help',
    '',
    '## Quick Start',
    '',
    'Claude Code is an AI-powered coding assistant. You can:',
    '- Ask questions about your codebase',
    '- Generate and edit code',
    '- Run shell commands',
    '- Use slash commands for common tasks',
    '',
    '## Available Skills',
    '',
    formatSkillList(visibleSkills, { showDescription: true }),
    '',
    '## Getting More Help',
    '',
    `Use \`/help <topic>\` for detailed help on:`,
    ...HELP_TOPICS.map(t => `- \`/help ${t}\``),
    '',
    'Or \`/help <skill-name>\` for help on a specific skill.',
  ];

  return sections.join('\n');
}

/**
 * Lay help cho topic cu the
 */
function getTopicHelp(topic: HelpTopic): string {
  switch (topic) {
    case 'skills':
      return getSkillsHelp();
    case 'commands':
      return getCommandsHelp();
    case 'tools':
      return getToolsHelp();
    case 'shortcuts':
      return getShortcutsHelp();
    case 'config':
      return getConfigHelp();
    case 'plugins':
      return getPluginsHelp();
    default:
      return `Help for topic "${topic}" is not available.`;
  }
}

/**
 * Help ve skills
 */
function getSkillsHelp(): string {
  const builtIn = getSkillsBySource('built-in');
  const user = getSkillsBySource('user');
  const project = getSkillsBySource('project');
  const plugin = getSkillsBySource('plugin');

  const sections = [
    '# Skills',
    '',
    'Skills are slash commands that perform common tasks.',
    '',
    '## Built-in Skills',
    '',
    formatSkillList(builtIn, { showDescription: true, showArgumentHint: true }),
  ];

  if (user.length > 0) {
    sections.push('', '## User Skills', '');
    sections.push(formatSkillList(user, { showDescription: true }));
  }

  if (project.length > 0) {
    sections.push('', '## Project Skills', '');
    sections.push(formatSkillList(project, { showDescription: true }));
  }

  if (plugin.length > 0) {
    sections.push('', '## Plugin Skills', '');
    sections.push(formatSkillList(plugin, { showDescription: true, groupBySource: true }));
  }

  sections.push(
    '',
    '## Creating Custom Skills',
    '',
    'You can create custom skills by adding `.md` files to:',
    '- `~/.claude/skills/` - User-level skills',
    '- `.claude/skills/` - Project-level skills',
    '',
    'See `/help plugins` for plugin-based skills.'
  );

  return sections.join('\n');
}

/**
 * Help ve commands
 */
function getCommandsHelp(): string {
  return `
# CLI Commands

## Basic Usage

\`\`\`bash
claude                    # Start interactive mode
claude "your prompt"      # Send a one-off prompt
claude -p "prompt"        # Use -p flag for prompt
\`\`\`

## Options

| Option | Description |
|--------|-------------|
| \`-p, --prompt\` | Prompt to send |
| \`--continue\` | Continue last conversation |
| \`--resume <id>\` | Resume specific conversation |
| \`--model <model>\` | Use specific model |
| \`--output-format\` | Output format (text, json, stream-json) |
| \`--verbose\` | Enable verbose output |
| \`--version\` | Show version |
| \`--help\` | Show help |

## Examples

\`\`\`bash
# Ask a question
claude "How do I sort an array in JavaScript?"

# Continue previous conversation
claude --continue

# Resume specific session
claude --resume abc123

# Use different model
claude --model claude-3-opus "Complex analysis task"
\`\`\`
`;
}

/**
 * Help ve tools
 */
function getToolsHelp(): string {
  return `
# Available Tools

Claude Code has access to these tools:

## File System Tools

| Tool | Description |
|------|-------------|
| **Read** | Read file contents |
| **Write** | Create/overwrite files |
| **Edit** | Make precise edits to files |
| **Glob** | Find files by pattern |
| **Grep** | Search file contents |

## Shell Tools

| Tool | Description |
|------|-------------|
| **Bash** | Execute shell commands |

## Web Tools

| Tool | Description |
|------|-------------|
| **WebFetch** | Fetch and process URLs |
| **WebSearch** | Search the web |

## Code Intelligence

| Tool | Description |
|------|-------------|
| **LSP** | Language Server Protocol operations |
| **Task** | Create sub-agent tasks |

## Tool Usage

Tools are automatically selected based on your request.
You can also explicitly ask to use a specific tool.
`;
}

/**
 * Help ve shortcuts
 */
function getShortcutsHelp(): string {
  return `
# Keyboard Shortcuts

## Navigation

| Shortcut | Action |
|----------|--------|
| \`Ctrl+C\` | Cancel current operation |
| \`Ctrl+D\` | Exit (when input is empty) |
| \`Ctrl+L\` | Clear screen |
| \`Up/Down\` | Navigate history |

## Editing

| Shortcut | Action |
|----------|--------|
| \`Ctrl+A\` | Move to beginning of line |
| \`Ctrl+E\` | Move to end of line |
| \`Ctrl+U\` | Clear line before cursor |
| \`Ctrl+K\` | Clear line after cursor |
| \`Ctrl+W\` | Delete word before cursor |

## Completion

| Shortcut | Action |
|----------|--------|
| \`Tab\` | Autocomplete |
| \`Escape\` | Dismiss suggestions |
`;
}

/**
 * Help ve config
 */
function getConfigHelp(): string {
  return `
# Configuration

## Config Locations

| Location | Scope |
|----------|-------|
| \`~/.claude/settings.json\` | Global user settings |
| \`.claude/settings.json\` | Project-specific settings |
| \`CLAUDE.md\` | Project instructions |

## Common Settings

\`\`\`json
{
  "model": "claude-sonnet-4-20250514",
  "permissions": {
    "allow_bash": true,
    "allow_write": true,
    "allowed_tools": ["*"]
  },
  "mcpServers": {
    "server-name": {
      "command": "...",
      "args": []
    }
  }
}
\`\`\`

## Environment Variables

| Variable | Description |
|----------|-------------|
| \`ANTHROPIC_API_KEY\` | API key (required) |
| \`CLAUDE_CODE_MODEL\` | Default model |
| \`CLAUDE_CODE_DEBUG\` | Enable debug mode |

## CLAUDE.md

Project-specific instructions placed in \`CLAUDE.md\`:

\`\`\`markdown
# Project: My App

## Coding Standards
- Use TypeScript
- Follow ESLint rules

## Architecture
- Components in /src/components
- Utils in /src/utils
\`\`\`
`;
}

/**
 * Help ve plugins
 */
function getPluginsHelp(): string {
  return `
# Plugins

## Overview

Plugins extend Claude Code with additional functionality:
- Custom skills/commands
- MCP servers
- Tool integrations

## Plugin Locations

| Location | Description |
|----------|-------------|
| \`~/.claude/plugins/\` | User plugins |
| \`.claude/plugins/\` | Project plugins |

## Plugin Structure

\`\`\`
my-plugin/
├── manifest.json       # Plugin metadata
├── skills/
│   ├── skill.md        # Skill definition
│   └── another.md
└── commands/
    └── command.md
\`\`\`

## manifest.json

\`\`\`json
{
  "name": "my-plugin",
  "version": "1.0.0",
  "description": "My awesome plugin",
  "skillsPath": "./skills",
  "commandsPath": "./commands"
}
\`\`\`

## Installing Plugins

1. Clone/download plugin to plugins directory
2. Restart Claude Code
3. Plugin skills will be available as \`/plugin-name:skill-name\`
`;
}

/**
 * Help cho mot skill cu the
 */
function getSkillHelp(skill: SkillDefinition): string {
  const sections = [
    `# /${skill.userFacingName()}`,
    '',
    skill.description,
    '',
  ];

  if (skill.argumentHint) {
    sections.push(
      '## Usage',
      '',
      `\`/${skill.userFacingName()} ${skill.argumentHint}\``,
      ''
    );
  }

  if (skill.source) {
    sections.push(`**Source:** ${skill.source}`);
  }

  if (skill.pluginName) {
    sections.push(`**Plugin:** ${skill.pluginName}`);
  }

  return sections.join('\n');
}

// ============================================================================
// Formatting Functions - Cac ham format
// ============================================================================

/**
 * Format danh sach skills
 */
function formatSkillList(
  skills: SkillDefinition[],
  options: SkillListFormatOptions = {}
): string {
  const {
    showDescription = false,
    showArgumentHint = false,
    groupBySource = false,
  } = options;

  if (groupBySource) {
    // Nhom theo plugin name
    const groups = new Map<string, SkillDefinition[]>();
    for (const skill of skills) {
      const key = skill.pluginName || 'Other';
      const list = groups.get(key) || [];
      list.push(skill);
      groups.set(key, list);
    }

    const lines: string[] = [];
    const groupEntries = Array.from(groups.entries());
    for (const [group, groupSkills] of groupEntries) {
      lines.push(`### ${group}`, '');
      lines.push(formatSkillListSimple(groupSkills, showDescription, showArgumentHint));
      lines.push('');
    }
    return lines.join('\n');
  }

  return formatSkillListSimple(skills, showDescription, showArgumentHint);
}

/**
 * Format danh sach skills don gian (khong nhom)
 */
function formatSkillListSimple(
  skills: SkillDefinition[],
  showDescription: boolean,
  showArgumentHint: boolean
): string {
  const lines: string[] = [];

  for (const skill of skills) {
    let line = `- \`/${skill.userFacingName()}\``;

    if (showArgumentHint && skill.argumentHint) {
      line += ` ${skill.argumentHint}`;
    }

    if (showDescription && skill.description) {
      line += ` - ${skill.description}`;
    }

    lines.push(line);
  }

  return lines.join('\n');
}

// ============================================================================
// Skill Handler Implementation
// ============================================================================

/**
 * Handler xu ly help skill
 */
export const helpSkillHandler: SkillHandler = {
  definition: helpSkillDefinition,

  validateArgs(_args: string | undefined): boolean | string {
    return true;
  },

  async execute(
    args: string | undefined,
    _context: SkillExecutionContext
  ): Promise<SkillCallResult> {
    const topic = args?.trim().toLowerCase();

    let helpText: string;

    if (topic && HELP_TOPICS.includes(topic as HelpTopic)) {
      helpText = getTopicHelp(topic as HelpTopic);
    } else if (topic) {
      const skill = getSkill(topic);
      if (skill) {
        helpText = getSkillHelp(skill);
      } else {
        helpText = `Unknown topic: "${topic}". Available topics: ${HELP_TOPICS.join(', ')}`;
      }
    } else {
      helpText = getOverviewHelp();
    }

    return {
      success: true,
      result: helpText,
    };
  },
};

// ============================================================================
// Exports
// ============================================================================

export { HELP_TOPICS, type HelpTopic };

export default {
  definition: helpSkillDefinition,
  handler: helpSkillHandler,
  getOverviewHelp,
  getTopicHelp,
  getSkillHelp,
  formatSkillList,
};
