import { createEmptyTaskListFixture, createPopulatedTaskListFixture, createUnavailableTaskError, summarizeTaskGroups } from './fixtures';
import { todayDate } from './date';
import type { TaskGateway } from './task-gateway';
import type { CreateTaskInput, Result, Task, TaskGatewayError, TaskGroup, TaskGroupId, TaskId, TaskListData, TaskStatus, UpdateTaskInput } from './types';

export type InMemoryTaskGatewayScenario = 'populated' | 'empty' | 'error';

interface TaskOrigin {
  readonly status: Exclude<TaskStatus, 'done'>;
}

export interface InMemoryTaskGatewaySnapshot {
  readonly data: TaskListData;
  readonly origins: Readonly<Record<TaskId, Exclude<TaskStatus, 'done'>>>;
  readonly nextTaskSequence: number;
}

export interface InMemoryTaskGatewayOptions {
  readonly initialState?: InMemoryTaskGatewaySnapshot;
  readonly onChange?: (snapshot: InMemoryTaskGatewaySnapshot) => void;
}

interface MutableTaskGroup {
  readonly id: TaskGroupId;
  readonly label: string;
  tasks: Task[];
}

function success<T>(value: T): Result<T, TaskGatewayError> {
  return { ok: true, value };
}

function failure(error: TaskGatewayError): Result<never, TaskGatewayError> {
  return { ok: false, error };
}

function cloneTask(task: Task): Task {
  return {
    ...task,
    project: { ...task.project },
    assignee: { ...task.assignee },
  };
}

function cloneGroups(groups: readonly TaskGroup[]): MutableTaskGroup[] {
  return groups.map(group => ({
    id: group.id,
    label: group.label,
    tasks: group.tasks.map(cloneTask),
  }));
}

function regroupTasks(groups: readonly TaskGroup[], today: string): MutableTaskGroup[] {
  const regrouped = cloneGroups(createEmptyTaskListFixture().groups);

  for (const task of groups.flatMap(group => group.tasks)) {
    const groupId = task.status === 'done' ? 'completed' : groupForDueDate(task.dueDate, today);
    const group = regrouped.find(candidate => candidate.id === groupId);
    if (group === undefined) throw new Error(`Fixture group is missing: ${groupId}`);
    group.tasks.push(cloneTask(task));
  }

  return regrouped;
}

function nextTaskSequence(groups: readonly TaskGroup[], requestedSequence = 154): number {
  let sequence = requestedSequence;
  const usedIds = new Set(groups.flatMap(group => group.tasks.flatMap(task => [task.id, task.key])));

  while (usedIds.has(`task-created-${sequence}`) || usedIds.has(`OPS-${sequence}`)) {
    sequence += 1;
  }

  return sequence;
}

function groupForDueDate(dueDate: string | null, today: string): Exclude<TaskGroupId, 'completed'> {
  if (dueDate === null || dueDate > today) return 'upcoming';
  if (dueDate < today) return 'overdue';
  return 'today';
}

/**
 * Testable invariants:
 * - every read returns a fresh snapshot, so consumers cannot mutate the store;
 * - complete and reopen are idempotent;
 * - successful transitions update both the task status and its list group;
 * - errors do not modify state.
 */
export class InMemoryTaskGateway implements TaskGateway {
  readonly #scenario: InMemoryTaskGatewayScenario;
  readonly #groups: MutableTaskGroup[];
  readonly #origins = new Map<TaskId, TaskOrigin>();
  readonly #today: string;
  readonly #onChange: InMemoryTaskGatewayOptions['onChange'];
  #nextTaskSequence = 154;

  constructor(scenario: InMemoryTaskGatewayScenario = 'populated', today = todayDate(), options: InMemoryTaskGatewayOptions = {}) {
    this.#scenario = scenario;
    this.#today = today;
    this.#onChange = options.onChange;
    const data = options.initialState?.data ?? (scenario === 'empty' ? createEmptyTaskListFixture() : createPopulatedTaskListFixture(today));
    this.#groups = options.initialState === undefined ? cloneGroups(data.groups) : regroupTasks(data.groups, today);
    for (const [taskId, status] of Object.entries(options.initialState?.origins ?? {})) {
      this.#origins.set(taskId, { status });
    }
    this.#nextTaskSequence = nextTaskSequence(this.#groups, options.initialState?.nextTaskSequence);
  }

  async listMyTasks(): Promise<Result<TaskListData, TaskGatewayError>> {
    if (this.#scenario === 'error') {
      return failure(createUnavailableTaskError('list_my_tasks'));
    }

    return success(this.#snapshot());
  }

  async createTask(input: CreateTaskInput): Promise<Result<Task, TaskGatewayError>> {
    if (this.#scenario === 'error') {
      return failure(createUnavailableTaskError('create_task'));
    }

    const sequence = nextTaskSequence(this.#groups, this.#nextTaskSequence);
    this.#nextTaskSequence = sequence + 1 >= Number.MAX_SAFE_INTEGER ? 154 : sequence + 1;
    const task: Task = {
      id: `task-created-${sequence}`,
      key: `OPS-${sequence}`,
      title: input.title.trim(),
      description: input.description ?? '',
      project: input.project ?? {
        id: 'project-restaurant-operations',
        name: 'Restaurant operations',
      },
      assignee: {
        id: 'user-mara-ionescu',
        name: 'Mara Ionescu',
        initials: 'MI',
      },
      status: input.status ?? 'todo',
      priority: input.priority ?? 'medium',
      dueDate: input.dueDate,
    };

    this.#group(task.status === 'done' ? 'completed' : groupForDueDate(task.dueDate, this.#today)).tasks.unshift(task);
    this.#notifyChange();
    return success(cloneTask(task));
  }

  async updateTask(taskId: TaskId, input: UpdateTaskInput): Promise<Result<Task, TaskGatewayError>> {
    if (this.#scenario === 'error') return failure(createUnavailableTaskError('update_task'));
    const found = this.#findTask(taskId);
    if (found === null) return failure(this.#notFound('update_task'));

    const task = { ...found.task, ...input };
    if (found.task.status !== 'done' && task.status === 'done') {
      this.#origins.set(taskId, { status: found.task.status });
    } else if (task.status !== 'done') {
      this.#origins.delete(taskId);
    }
    found.group.tasks.splice(found.taskIndex, 1);
    this.#group(task.status === 'done' ? 'completed' : groupForDueDate(task.dueDate, this.#today)).tasks.unshift(task);
    this.#notifyChange();
    return success(cloneTask(task));
  }

  async completeTask(taskId: TaskId): Promise<Result<Task, TaskGatewayError>> {
    if (this.#scenario === 'error') {
      return failure(createUnavailableTaskError('complete_task'));
    }

    const found = this.#findTask(taskId);
    if (found === null) return failure(this.#notFound('complete_task'));
    if (found.task.status === 'done') return success(cloneTask(found.task));

    this.#origins.set(taskId, {
      status: found.task.status,
    });

    const completedTask = { ...found.task, status: 'done' as const };
    found.group.tasks.splice(found.taskIndex, 1);
    this.#group('completed').tasks.unshift(completedTask);
    this.#notifyChange();

    return success(cloneTask(completedTask));
  }

  async reopenTask(taskId: TaskId): Promise<Result<Task, TaskGatewayError>> {
    if (this.#scenario === 'error') {
      return failure(createUnavailableTaskError('reopen_task'));
    }

    const found = this.#findTask(taskId);
    if (found === null) return failure(this.#notFound('reopen_task'));
    if (found.task.status !== 'done') return success(cloneTask(found.task));

    const origin = this.#origins.get(taskId) ?? {
      status: 'todo' as const,
    };
    const reopenedTask = { ...found.task, status: origin.status };
    found.group.tasks.splice(found.taskIndex, 1);
    this.#group(groupForDueDate(reopenedTask.dueDate, this.#today)).tasks.unshift(reopenedTask);
    this.#origins.delete(taskId);
    this.#notifyChange();

    return success(cloneTask(reopenedTask));
  }

  #snapshot(): TaskListData {
    const groups = cloneGroups(this.#groups);
    return { groups, summary: summarizeTaskGroups(groups) };
  }

  #notifyChange(): void {
    this.#onChange?.({
      data: this.#snapshot(),
      origins: Object.fromEntries(Array.from(this.#origins, ([taskId, origin]) => [taskId, origin.status])),
      nextTaskSequence: this.#nextTaskSequence,
    });
  }

  #group(groupId: TaskGroupId): MutableTaskGroup {
    const group = this.#groups.find(candidate => candidate.id === groupId);
    if (group === undefined) {
      throw new Error(`Fixture group is missing: ${groupId}`);
    }
    return group;
  }

  #findTask(taskId: TaskId): {
    group: MutableTaskGroup;
    task: Task;
    taskIndex: number;
  } | null {
    for (const group of this.#groups) {
      const taskIndex = group.tasks.findIndex(task => task.id === taskId);
      if (taskIndex !== -1) {
        return { group, task: group.tasks[taskIndex], taskIndex };
      }
    }
    return null;
  }

  #notFound(operation: TaskGatewayError['operation']): TaskGatewayError {
    return {
      code: 'not_found',
      operation,
      message: 'This task is no longer available.',
      retryable: false,
    };
  }
}

export function createInMemoryTaskGateway(scenario: InMemoryTaskGatewayScenario = 'populated', today = todayDate()): TaskGateway {
  return new InMemoryTaskGateway(scenario, today);
}
