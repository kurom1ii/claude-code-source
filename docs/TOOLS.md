# Tools Reference

> Tai lieu tham khao cac built-in tools cua Claude Code

## Tong quan

| Tool | Category | Yeu cau xac nhan | Mo ta |
|------|----------|------------------|-------|
| Bash | shell | Co | Chay shell commands |
| Read | filesystem | Khong | Doc file |
| Write | filesystem | Co | Ghi file |
| Edit | filesystem | Co | Sua file (string replacement) |
| Glob | search | Khong | Tim file theo pattern |
| Grep | search | Khong | Tim noi dung trong files |
| Task | agent | Khong | Spawn subagent |
| WebFetch | web | Khong | Fetch URL |
| WebSearch | web | Khong | Tim kiem web |
| LSP | utility | Khong | Language Server Protocol |

---

## BashTool

Chay shell commands.

### Parameters

| Param | Type | Required | Mo ta |
|-------|------|----------|-------|
| command | string | Co | Lenh can chay |
| timeout | number | Khong | Timeout (ms), mac dinh 120000 |
| run_in_background | boolean | Khong | Chay ngam |

### Example

```typescript
import { BashTool } from './tools';

const handler = BashTool.createHandler(context);

const result = await handler.execute({
  command: 'ls -la /home/user',
  timeout: 30000,
});

console.log(result.stdout);
console.log(result.exitCode);
```

### Output

```typescript
interface BashToolOutput {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  executionTime: number;
  backgroundPid?: number;
}
```

### Dangerous Commands

Cac lenh nguy hiem se bi canh bao:
- `rm -rf /`
- `rm -rf ~`
- `rm -rf *`
- `chmod 777`
- `chown -R`
- `mkfs`
- `dd if=`
- `> /dev/sda`
- `:(){ :|:& };:`

### Sandbox Mode

Khi sandbox mode bat, cac lenh sau bi chan:
- `sudo`
- `su`
- `chmod`
- `chown`
- `rm -rf`
- `curl | sh`
- `wget | sh`

---

## ReadTool

Doc file tu filesystem.

### Parameters

| Param | Type | Required | Mo ta |
|-------|------|----------|-------|
| file_path | string | Co | Duong dan tuyet doi |
| offset | number | Khong | Dong bat dau (0-indexed) |
| limit | number | Khong | So dong doc, mac dinh 2000 |
| pages | string | Khong | Page range cho PDF (VD: "1-5") |

### Example

```typescript
import { ReadTool } from './tools';

const handler = ReadTool.createHandler(context);

// Doc file
const result = await handler.execute({
  filePath: '/home/user/code.ts',
});

// Doc voi offset/limit
const result = await handler.execute({
  filePath: '/home/user/bigfile.log',
  offset: 100,
  limit: 50,
});

// Doc PDF
const result = await handler.execute({
  filePath: '/home/user/doc.pdf',
  pages: '1-10',
});
```

### Output

```typescript
interface ReadToolOutput {
  content: string;     // Noi dung voi line numbers
  filePath: string;
  fileType: FileType;  // 'text', 'image', 'pdf', 'notebook', 'binary'
  totalLines: number;
  linesRead: number;
  encoding: string;
  truncated: boolean;
}
```

### File Types

| Type | Extensions | Xu ly |
|------|------------|-------|
| text | .ts, .js, .py, ... | Doc voi line numbers |
| image | .png, .jpg, .gif, ... | Base64 encode |
| pdf | .pdf | Extract text |
| notebook | .ipynb | Parse cells |
| binary | others | Skip hoac base64 |

---

## WriteTool

Ghi file vao filesystem.

### Parameters

| Param | Type | Required | Mo ta |
|-------|------|----------|-------|
| file_path | string | Co | Duong dan tuyet doi |
| content | string | Co | Noi dung can ghi |

### Example

```typescript
import { WriteTool } from './tools';

const handler = WriteTool.createHandler(context);

const result = await handler.execute({
  filePath: '/home/user/newfile.ts',
  content: 'export const foo = 42;',
});
```

### Output

```typescript
interface WriteToolOutput {
  success: boolean;
  filePath: string;
  bytesWritten: number;
  created: boolean;     // File moi hay ghi de
  backupPath?: string;  // Path cua backup (neu co)
}
```

### Protected Files

Cac file duoc bao ve (canh bao truoc khi ghi):
- `.git/config`
- `.git/HEAD`
- `package-lock.json`
- `yarn.lock`
- `pnpm-lock.yaml`

### Sensitive Files

Cac file nhay cam (canh bao):
- `.env`
- `.pem`
- `.key`
- `.secrets`
- `.credentials`
- `.password`

---

## EditTool

Thay the string trong file.

### Parameters

| Param | Type | Required | Mo ta |
|-------|------|----------|-------|
| file_path | string | Co | Duong dan tuyet doi |
| old_string | string | Co | Chuoi can thay the |
| new_string | string | Co | Chuoi moi |
| replace_all | boolean | Khong | Thay the tat ca, mac dinh false |

### Example

```typescript
import { EditTool } from './tools';

const handler = EditTool.createHandler(context);

// Thay the mot lan
const result = await handler.execute({
  filePath: '/home/user/code.ts',
  oldString: 'const foo = 1;',
  newString: 'const foo = 42;',
});

// Thay the tat ca
const result = await handler.execute({
  filePath: '/home/user/code.ts',
  oldString: 'oldName',
  newString: 'newName',
  replaceAll: true,
});
```

### Output

```typescript
interface EditToolOutput {
  success: boolean;
  filePath: string;
  replacementCount: number;
  preview?: string;  // Preview cua thay doi
  diff?: string;     // Diff format
}
```

### Loi thuong gap

1. **old_string khong tim thay**: Chuoi khong ton tai trong file
2. **old_string khong unique**: Tim thay nhieu lan nhung khong dung replace_all
3. **old_string = new_string**: Hai chuoi giong nhau

---

## GlobTool

Tim file theo pattern.

### Parameters

| Param | Type | Required | Mo ta |
|-------|------|----------|-------|
| pattern | string | Co | Glob pattern (VD: `**/*.ts`) |
| path | string | Khong | Thu muc tim, mac dinh cwd |

### Example

```typescript
import { GlobTool } from './tools';

const handler = GlobTool.createHandler(context);

// Tim tat ca TypeScript files
const result = await handler.execute({
  pattern: '**/*.ts',
});

// Tim trong thu muc cu the
const result = await handler.execute({
  pattern: '*.tsx',
  path: '/home/user/project/src/components',
});
```

### Output

```typescript
interface GlobToolOutput {
  files: MatchedFile[];
  totalMatches: number;
  pattern: string;
  searchPath: string;
  truncated: boolean;  // > 1000 results
}

interface MatchedFile {
  absolutePath: string;
  relativePath: string;
  modifiedTime: Date;
  size: number;
  isDirectory: boolean;
}
```

### Glob Patterns

| Pattern | Mo ta |
|---------|-------|
| `*` | Match tat ca tru `/` |
| `**` | Match tat ca ke ca `/` |
| `?` | Match 1 ky tu |
| `[abc]` | Match a, b, hoac c |
| `{a,b}` | Match a hoac b |

### Ignored Directories

Mac dinh bo qua:
- `node_modules`
- `.git`
- `dist`
- `build`
- `coverage`
- `__pycache__`
- `.cache`

---

## GrepTool

Tim noi dung trong files.

### Parameters

| Param | Type | Required | Mo ta |
|-------|------|----------|-------|
| pattern | string | Co | Regex pattern |
| path | string | Khong | Thu muc/file tim |
| glob | string | Khong | Loc file theo glob |
| type | string | Khong | File type (js, py, ts, ...) |
| output_mode | string | Khong | content, files_with_matches, count |
| -A | number | Khong | Dong sau match |
| -B | number | Khong | Dong truoc match |
| -C | number | Khong | Dong context |
| -i | boolean | Khong | Case insensitive |
| -n | boolean | Khong | Show line numbers |
| multiline | boolean | Khong | Match xuyen dong |
| head_limit | number | Khong | Gioi han ket qua |
| offset | number | Khong | Bo qua N ket qua dau |

### Example

```typescript
import { GrepTool } from './tools';

const handler = GrepTool.createHandler(context);

// Tim function definitions
const result = await handler.execute({
  pattern: 'function\\s+\\w+',
  path: '/home/user/project',
  type: 'ts',
  outputMode: 'content',
  context: 2,
});

// Tim files chua pattern
const result = await handler.execute({
  pattern: 'TODO',
  outputMode: 'files_with_matches',
});

// Dem so matches
const result = await handler.execute({
  pattern: 'import',
  outputMode: 'count',
  glob: '*.ts',
});
```

### Output

```typescript
interface GrepToolOutput {
  matches: GrepMatch[];
  totalMatches: number;
  pattern: string;
  searchPath: string;
  outputMode: GrepOutputMode;
  truncated: boolean;
}

interface GrepMatch {
  filePath: string;
  lineNumber?: number;
  content?: string;
  count?: number;
  beforeLines?: string[];
  afterLines?: string[];
}
```

### File Types

| Type | Extensions |
|------|------------|
| js | *.js |
| ts | *.ts |
| tsx | *.tsx |
| py | *.py |
| java | *.java |
| go | *.go |
| rust | *.rs |
| ... | ... |

---

## TaskTool

Spawn subagent de lam viec.

### Parameters

| Param | Type | Required | Mo ta |
|-------|------|----------|-------|
| description | string | Co | Mo ta ngan (3-5 tu) |
| prompt | string | Co | Prompt cho subagent |
| subagent_type | string | Khong | Explore, Plan, general-purpose |
| team_name | string | Khong | Ten team (swarm mode) |
| name | string | Khong | Ten teammate |
| model | string | Khong | Model su dung |
| timeout | number | Khong | Timeout (ms), mac dinh 5 phut |

### Example

```typescript
import { TaskTool } from './tools';

const handler = TaskTool.createHandler(context);

// Spawn Explore agent
const result = await handler.execute({
  description: 'Find auth files',
  prompt: 'Find all files related to authentication in this codebase',
  subagentType: 'Explore',
});

// Spawn team member
const result = await handler.execute({
  description: 'Implement login',
  prompt: 'Implement the login functionality',
  subagentType: 'general-purpose',
  teamName: 'feature-auth',
  name: 'login-dev',
});
```

### Output

```typescript
interface TaskToolOutput {
  taskId: string;
  status: TaskStatus;  // 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  result?: string;
  error?: string;
  executionTime?: number;
  agentInfo?: {
    type: SubagentType;
    name?: string;
    teamName?: string;
  };
}
```

### Subagent Types

| Type | Mo ta | Model khuyen nghi |
|------|-------|-------------------|
| Explore | Kham pha codebase | sonnet |
| Plan | Lap ke hoach | opus |
| general-purpose | Da nang | sonnet |

---

## WebFetchTool

Fetch noi dung tu URL.

### Parameters

| Param | Type | Required | Mo ta |
|-------|------|----------|-------|
| url | string | Co | URL can fetch |
| prompt | string | Co | Prompt xu ly noi dung |

### Example

```typescript
import { WebFetchTool } from './tools';

const handler = WebFetchTool.createHandler(context);

const result = await handler.execute({
  url: 'https://docs.example.com/api',
  prompt: 'Extract the main API endpoints from this page',
});
```

### Output

```typescript
interface WebFetchToolOutput {
  content: string;
  url: string;
  finalUrl: string;
  contentType: string;
  redirected: boolean;
  fetchTime: number;
  cached: boolean;
}
```

### Luu y

- KHONG hoat dong voi authenticated URLs:
  - Google Docs
  - Confluence
  - Jira
  - Notion
  - Slack
- Voi GitHub URLs, nen dung `gh` CLI
- Co cache 15 phut

---

## WebSearchTool

Tim kiem tren web.

### Parameters

| Param | Type | Required | Mo ta |
|-------|------|----------|-------|
| query | string | Co | Query tim kiem |
| allowed_domains | string[] | Khong | Chi lay tu cac domain nay |
| blocked_domains | string[] | Khong | Bo qua cac domain nay |

### Example

```typescript
import { WebSearchTool } from './tools';

const handler = WebSearchTool.createHandler(context);

const result = await handler.execute({
  query: 'TypeScript generics tutorial',
  allowedDomains: ['typescript-lang.org', 'github.com'],
});
```

### Output

```typescript
interface WebSearchToolOutput {
  results: SearchResult[];
  query: string;
  resultCount: number;
  filtered: boolean;
  searchTime: number;
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
  domain: string;
  publishedDate?: string;
}
```

### Luu y

- PHAI them phan "Sources:" sau khi tra loi
- Chi kha dung tai US

---

## LSPTool

Tuong tac voi Language Server Protocol.

### Parameters

| Param | Type | Required | Mo ta |
|-------|------|----------|-------|
| operation | string | Co | getDiagnostics, goToDefinition, findReferences, hover, completion, documentSymbols, workspaceSymbols |
| file_path | string | Tuy operation | Duong dan file |
| position | object | Tuy operation | { line, character } (0-indexed) |
| query | string | Tuy operation | Query cho workspaceSymbols |

### Example

```typescript
import { LSPTool } from './tools';

const handler = LSPTool.createHandler(context);

// Lay diagnostics
const result = await handler.execute({
  operation: 'getDiagnostics',
  filePath: '/home/user/code.ts',
});

// Go to definition
const result = await handler.execute({
  operation: 'goToDefinition',
  filePath: '/home/user/code.ts',
  position: { line: 10, character: 5 },
});

// Hover info
const result = await handler.execute({
  operation: 'hover',
  filePath: '/home/user/code.ts',
  position: { line: 15, character: 10 },
});
```

### Output

```typescript
interface LSPToolOutput {
  operation: LSPOperation;
  diagnostics?: Diagnostic[];
  locations?: Location[];
  hoverInfo?: HoverInfo;
  completions?: CompletionItem[];
  symbols?: DocumentSymbol[];
  executionTime: number;
}
```

### Luu y

- Can co LSP server chay cho ngon ngu tuong ung
- Hien tai la placeholder implementation
