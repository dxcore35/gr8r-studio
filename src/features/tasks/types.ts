export type TaskId = string;

export type TaskStatus = 'todo' | 'in_progress' | 'done';

export type TaskPriority = 'low' | 'medium' | 'high';

export type TaskGroupId = 'overdue' | 'today' | 'upcoming' | 'completed';

export interface Task {
  readonly id: TaskId;
  readonly key: string;
  readonly title: string;
  readonly description: string;
  readonly project: {
    readonly id: string;
    readonly name: string;
  };
  readonly assignee: {
    readonly id: string;
    readonly name: string;
    readonly initials: string;
  };
  readonly status: TaskStatus;
  readonly priority: TaskPriority;
  readonly dueDate: string | null;
}

export interface CreateTaskInput {
  readonly title: string;
  readonly dueDate: string | null;
  readonly description?: string;
  readonly status?: TaskStatus;
  readonly priority?: TaskPriority;
  readonly project?: Task['project'];
}

export type UpdateTaskInput = Partial<Pick<Task, 'title' | 'description' | 'project' | 'status' | 'priority' | 'dueDate'>>;

export interface TaskGroup {
  readonly id: TaskGroupId;
  readonly label: string;
  readonly tasks: readonly Task[];
}

export interface TaskListData {
  readonly groups: readonly TaskGroup[];
  readonly summary: {
    readonly total: number;
    readonly open: number;
    readonly completed: number;
    readonly overdue: number;
  };
}

export type TaskGatewayOperation = 'list_my_tasks' | 'create_task' | 'update_task' | 'complete_task' | 'reopen_task';

export type TaskGatewayErrorCode = 'not_found' | 'unavailable';

export interface TaskGatewayError {
  readonly code: TaskGatewayErrorCode;
  readonly operation: TaskGatewayOperation;
  readonly message: string;
  readonly retryable: boolean;
}

export type Result<T, E = TaskGatewayError> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly error: E };

export type TaskListState =
  | { readonly status: 'loading' }
  | { readonly status: 'ready'; readonly data: TaskListData }
  | { readonly status: 'empty' }
  | { readonly status: 'error'; readonly error: TaskGatewayError };

export type TaskListScenario = 'populated' | 'empty' | 'loading' | 'error';
