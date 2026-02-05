/**
 * TaskManagement Tools
 *
 * Tools để quản lý task list trong Claude Code:
 * - TaskCreate: Tạo task mới
 * - TaskUpdate: Cập nhật task
 * - TaskList: Liệt kê tất cả tasks
 * - TaskGet: Lấy chi tiết một task
 */

import type { ToolDefinition, ToolHandler, ExecutionContext } from './types';

// ============================================================================
// Types
// ============================================================================

/**
 * Trạng thái của task
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'deleted';

/**
 * Một task trong task list
 */
export interface Task {
  /** ID duy nhất của task */
  id: string;
  /** Tiêu đề ngắn gọn của task */
  subject: string;
  /** Mô tả chi tiết */
  description: string;
  /** Trạng thái hiện tại */
  status: TaskStatus;
  /** Active form cho spinner khi in_progress */
  activeForm?: string;
  /** Owner của task (agent name) */
  owner?: string;
  /** Metadata tùy chỉnh */
  metadata?: Record<string, unknown>;
  /** Task IDs mà task này blocks */
  blocks?: string[];
  /** Task IDs mà block task này */
  blockedBy?: string[];
  /** Thời gian tạo */
  createdAt: string;
  /** Thời gian cập nhật */
  updatedAt: string;
}

// ============================================================================
// TaskCreate Types
// ============================================================================

export interface TaskCreateInput {
  /** Tiêu đề ngắn gọn của task */
  subject: string;
  /** Mô tả chi tiết */
  description: string;
  /** Active form cho spinner */
  activeForm?: string;
  /** Metadata tùy chỉnh */
  metadata?: Record<string, unknown>;
}

export interface TaskCreateOutput {
  /** ID của task vừa tạo */
  taskId: string;
  /** Message xác nhận */
  message: string;
}

// ============================================================================
// TaskUpdate Types
// ============================================================================

export interface TaskUpdateInput {
  /** ID của task cần update */
  taskId: string;
  /** Trạng thái mới */
  status?: TaskStatus;
  /** Subject mới */
  subject?: string;
  /** Description mới */
  description?: string;
  /** Active form mới */
  activeForm?: string;
  /** Owner mới */
  owner?: string;
  /** Metadata keys to merge */
  metadata?: Record<string, unknown>;
  /** Task IDs to add to blocks */
  addBlocks?: string[];
  /** Task IDs to add to blockedBy */
  addBlockedBy?: string[];
}

export interface TaskUpdateOutput {
  /** Có thành công không */
  success: boolean;
  /** Message mô tả */
  message: string;
}

// ============================================================================
// TaskGet Types
// ============================================================================

export interface TaskGetInput {
  /** ID của task cần lấy */
  taskId: string;
}

export interface TaskGetOutput {
  /** Task data */
  task: Task | null;
  /** Message nếu không tìm thấy */
  message?: string;
}

// ============================================================================
// TaskList Types
// ============================================================================

export interface TaskListInput {
  // No parameters required
}

export interface TaskListOutput {
  /** Danh sách tasks */
  tasks: Task[];
  /** Tổng số tasks */
  total: number;
}

// ============================================================================
// Tool Definitions
// ============================================================================

export const taskCreateToolDefinition: ToolDefinition = {
  name: 'TaskCreate',
  description: `Use this tool to create a structured task list for your current coding session. This helps you track progress, organize complex tasks, and demonstrate thoroughness to the user.

## When to Use This Tool

Use this tool proactively in these scenarios:
- Complex multi-step tasks - When a task requires 3 or more distinct steps
- Non-trivial and complex tasks - Tasks that require careful planning
- Plan mode - When using plan mode, create a task list to track the work
- User explicitly requests todo list
- User provides multiple tasks
- After receiving new instructions - Immediately capture user requirements as tasks
- When you start working on a task - Mark it as in_progress BEFORE beginning work
- After completing a task - Mark it as completed

## When NOT to Use This Tool

Skip using this tool when:
- There is only a single, straightforward task
- The task is trivial and tracking it provides no organizational benefit
- The task can be completed in less than 3 trivial steps

## Task Fields

- **subject**: A brief, actionable title in imperative form (e.g., "Fix authentication bug")
- **description**: Detailed description of what needs to be done
- **activeForm**: Present continuous form shown in spinner when in_progress (e.g., "Fixing authentication bug")`,
  category: 'task-management',
  requiresConfirmation: false,
  parameters: {
    subject: {
      type: 'string',
      description: 'A brief title for the task',
      required: true,
    },
    description: {
      type: 'string',
      description: 'A detailed description of what needs to be done',
      required: true,
    },
    activeForm: {
      type: 'string',
      description: 'Present continuous form shown in spinner when in_progress',
      required: false,
    },
    metadata: {
      type: 'object',
      description: 'Arbitrary metadata to attach to the task',
      required: false,
    },
  },
};

export const taskUpdateToolDefinition: ToolDefinition = {
  name: 'TaskUpdate',
  description: `Use this tool to update a task in the task list.

## When to Use This Tool

**Mark tasks as resolved:**
- When you have completed the work described in a task
- When a task is no longer needed or has been superseded
- IMPORTANT: Always mark your assigned tasks as resolved when you finish them

**Delete tasks:**
- Setting status to "deleted" permanently removes the task

**Update task details:**
- When requirements change or become clearer
- When establishing dependencies between tasks

## Fields You Can Update

- **status**: pending, in_progress, completed, deleted
- **subject**: Change the task title
- **description**: Change the task description
- **activeForm**: Present continuous form for spinner
- **owner**: Change the task owner
- **metadata**: Merge metadata keys into the task
- **addBlocks**: Mark tasks that cannot start until this one completes
- **addBlockedBy**: Mark tasks that must complete before this one can start`,
  category: 'task-management',
  requiresConfirmation: false,
  parameters: {
    taskId: {
      type: 'string',
      description: 'The ID of the task to update',
      required: true,
    },
    status: {
      type: 'string',
      description: 'New status for the task',
      required: false,
      enum: ['pending', 'in_progress', 'completed', 'deleted'],
    },
    subject: {
      type: 'string',
      description: 'New subject for the task',
      required: false,
    },
    description: {
      type: 'string',
      description: 'New description for the task',
      required: false,
    },
    activeForm: {
      type: 'string',
      description: 'Present continuous form for spinner',
      required: false,
    },
    owner: {
      type: 'string',
      description: 'New owner for the task',
      required: false,
    },
    metadata: {
      type: 'object',
      description: 'Metadata keys to merge into the task',
      required: false,
    },
    addBlocks: {
      type: 'array',
      description: 'Task IDs that this task blocks',
      required: false,
    },
    addBlockedBy: {
      type: 'array',
      description: 'Task IDs that block this task',
      required: false,
    },
  },
};

export const taskGetToolDefinition: ToolDefinition = {
  name: 'TaskGet',
  description: `Use this tool to retrieve a task by its ID from the task list.

## When to Use This Tool

- When you need the full description and context before starting work on a task
- To understand task dependencies (what it blocks, what blocks it)
- After being assigned a task, to get complete requirements`,
  category: 'task-management',
  requiresConfirmation: false,
  parameters: {
    taskId: {
      type: 'string',
      description: 'The ID of the task to retrieve',
      required: true,
    },
  },
};

export const taskListToolDefinition: ToolDefinition = {
  name: 'TaskList',
  description: `Use this tool to list all tasks in the task list.

## When to Use This Tool

- To see what tasks are available to work on
- To check overall progress on the project
- To find tasks that are blocked and need dependencies resolved
- Before assigning tasks to teammates
- After completing a task, to check for newly unblocked work

**Prefer working on tasks in ID order** (lowest ID first) when multiple tasks are available.`,
  category: 'task-management',
  requiresConfirmation: false,
  parameters: {},
};

// ============================================================================
// In-Memory Task Store
// ============================================================================

const taskStore = new Map<string, Task>();
let nextTaskId = 1;

/**
 * Reset task store (for testing)
 */
export function resetTaskStore(): void {
  taskStore.clear();
  nextTaskId = 1;
}

/**
 * Get all tasks
 */
export function getAllTasks(): Task[] {
  return Array.from(taskStore.values()).filter((t) => t.status !== 'deleted');
}

/**
 * Get task by ID
 */
export function getTaskById(id: string): Task | null {
  return taskStore.get(id) || null;
}

// ============================================================================
// Validation
// ============================================================================

export function validateTaskCreateInput(input: unknown): boolean | string {
  if (!input || typeof input !== 'object') {
    return 'Input must be an object';
  }

  const inp = input as Record<string, unknown>;

  if (typeof inp.subject !== 'string' || inp.subject.trim() === '') {
    return 'subject is required';
  }

  if (typeof inp.description !== 'string' || inp.description.trim() === '') {
    return 'description is required';
  }

  return true;
}

export function validateTaskUpdateInput(input: unknown): boolean | string {
  if (!input || typeof input !== 'object') {
    return 'Input must be an object';
  }

  const inp = input as Record<string, unknown>;

  if (typeof inp.taskId !== 'string' || inp.taskId.trim() === '') {
    return 'taskId is required';
  }

  if (
    inp.status !== undefined &&
    !['pending', 'in_progress', 'completed', 'deleted'].includes(inp.status as string)
  ) {
    return 'status must be pending, in_progress, completed, or deleted';
  }

  return true;
}

export function validateTaskGetInput(input: unknown): boolean | string {
  if (!input || typeof input !== 'object') {
    return 'Input must be an object';
  }

  const inp = input as Record<string, unknown>;

  if (typeof inp.taskId !== 'string' || inp.taskId.trim() === '') {
    return 'taskId is required';
  }

  return true;
}

export function validateTaskListInput(input: unknown): boolean | string {
  return true; // No required parameters
}

// ============================================================================
// Handlers
// ============================================================================

export function createTaskCreateToolHandler(
  context: ExecutionContext
): ToolHandler<TaskCreateInput, TaskCreateOutput> {
  return {
    name: 'TaskCreate',
    definition: taskCreateToolDefinition,
    validateInput: validateTaskCreateInput,

    async execute(input: TaskCreateInput): Promise<TaskCreateOutput> {
      const id = String(nextTaskId++);
      const now = new Date().toISOString();

      const task: Task = {
        id,
        subject: input.subject,
        description: input.description,
        status: 'pending',
        activeForm: input.activeForm,
        metadata: input.metadata,
        blocks: [],
        blockedBy: [],
        createdAt: now,
        updatedAt: now,
      };

      taskStore.set(id, task);

      return {
        taskId: id,
        message: `Task #${id} created successfully: ${input.subject}`,
      };
    },
  };
}

export function createTaskUpdateToolHandler(
  context: ExecutionContext
): ToolHandler<TaskUpdateInput, TaskUpdateOutput> {
  return {
    name: 'TaskUpdate',
    definition: taskUpdateToolDefinition,
    validateInput: validateTaskUpdateInput,

    async execute(input: TaskUpdateInput): Promise<TaskUpdateOutput> {
      const task = taskStore.get(input.taskId);

      if (!task) {
        return {
          success: false,
          message: `Task #${input.taskId} not found`,
        };
      }

      // Update fields
      if (input.status !== undefined) task.status = input.status;
      if (input.subject !== undefined) task.subject = input.subject;
      if (input.description !== undefined) task.description = input.description;
      if (input.activeForm !== undefined) task.activeForm = input.activeForm;
      if (input.owner !== undefined) task.owner = input.owner;

      // Merge metadata
      if (input.metadata) {
        task.metadata = { ...task.metadata, ...input.metadata };
        // Remove null values
        for (const key in task.metadata) {
          if (task.metadata[key] === null) {
            delete task.metadata[key];
          }
        }
      }

      // Add blocks
      if (input.addBlocks) {
        task.blocks = [...new Set([...(task.blocks || []), ...input.addBlocks])];
      }

      // Add blockedBy
      if (input.addBlockedBy) {
        task.blockedBy = [...new Set([...(task.blockedBy || []), ...input.addBlockedBy])];
      }

      task.updatedAt = new Date().toISOString();

      return {
        success: true,
        message: `Updated task #${input.taskId} status`,
      };
    },
  };
}

export function createTaskGetToolHandler(
  context: ExecutionContext
): ToolHandler<TaskGetInput, TaskGetOutput> {
  return {
    name: 'TaskGet',
    definition: taskGetToolDefinition,
    validateInput: validateTaskGetInput,

    async execute(input: TaskGetInput): Promise<TaskGetOutput> {
      const task = taskStore.get(input.taskId);

      if (!task) {
        return {
          task: null,
          message: `Task #${input.taskId} not found`,
        };
      }

      return { task };
    },
  };
}

export function createTaskListToolHandler(
  context: ExecutionContext
): ToolHandler<TaskListInput, TaskListOutput> {
  return {
    name: 'TaskList',
    definition: taskListToolDefinition,
    validateInput: validateTaskListInput,

    async execute(): Promise<TaskListOutput> {
      const tasks = getAllTasks();

      return {
        tasks,
        total: tasks.length,
      };
    },
  };
}

// ============================================================================
// Module Export
// ============================================================================

export const TaskCreateTool = {
  definition: taskCreateToolDefinition,
  createHandler: createTaskCreateToolHandler,
  validate: validateTaskCreateInput,
};

export const TaskUpdateTool = {
  definition: taskUpdateToolDefinition,
  createHandler: createTaskUpdateToolHandler,
  validate: validateTaskUpdateInput,
};

export const TaskGetTool = {
  definition: taskGetToolDefinition,
  createHandler: createTaskGetToolHandler,
  validate: validateTaskGetInput,
};

export const TaskListTool = {
  definition: taskListToolDefinition,
  createHandler: createTaskListToolHandler,
  validate: validateTaskListInput,
};

export default {
  TaskCreate: TaskCreateTool,
  TaskUpdate: TaskUpdateTool,
  TaskGet: TaskGetTool,
  TaskList: TaskListTool,
  resetTaskStore,
  getAllTasks,
  getTaskById,
};
