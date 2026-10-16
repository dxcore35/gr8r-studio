import { createEmptyTaskListFixture, createPopulatedTaskListFixture, createUnavailableTaskError, summarizeTaskGroups, TASK_FIXTURE_TODAY } from './fixtures';
import type { TaskGateway } from './task-gateway';
import type { Result, Task, TaskGatewayError, TaskGroup, TaskGroupId, TaskId, TaskListData, TaskStatus } from './types';

export type InMemoryTaskGatewayScenario = 'populated' | 'empty' | 'error';

interface TaskOrigin {
  readonly groupId: Exclude<TaskGroupId, 'completed'>;
  readonly status: Exclude<TaskStatus, 'done'>;
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

function groupForDueDate(dueDate: string | null): TaskOrigin['groupId'] {
  if (dueDate === null || dueDate > TASK_FIXTURE_TODAY) return 'upcoming';
  if (dueDate < TASK_FIXTURE_TODAY) return 'overdue';
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

  constructor(scenario: InMemoryTaskGatewayScenario = 'populated') {
    this.#scenario = scenario;
    const data = scenario === 'empty' ? createEmptyTaskListFixture() : createPopulatedTaskListFixture();
    this.#groups = cloneGroups(data.groups);
  }

  async listMyTasks(): Promise<Result<TaskListData, TaskGatewayError>> {
    if (this.#scenario === 'error') {
      return failure(createUnavailableTaskError('list_my_tasks'));
    }

    return success(this.#snapshot());
  }

  async completeTask(taskId: TaskId): Promise<Result<Task, TaskGatewayError>> {
    if (this.#scenario === 'error') {
      return failure(createUnavailableTaskError('complete_task'));
    }

    const found = this.#findTask(taskId);
    if (found === null) return failure(this.#notFound('complete_task'));
    if (found.task.status === 'done') return success(cloneTask(found.task));

    const originGroupId = found.group.id === 'completed' ? groupForDueDate(found.task.dueDate) : found.group.id;
    this.#origins.set(taskId, {
      groupId: originGroupId,
      status: found.task.status,
    });

    const completedTask = { ...found.task, status: 'done' as const };
    found.group.tasks.splice(found.taskIndex, 1);
    this.#group('completed').tasks.unshift(completedTask);

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
      groupId: groupForDueDate(found.task.dueDate),
      status: 'todo' as const,
    };
    const reopenedTask = { ...found.task, status: origin.status };
    found.group.tasks.splice(found.taskIndex, 1);
    this.#group(origin.groupId).tasks.unshift(reopenedTask);
    this.#origins.delete(taskId);

    return success(cloneTask(reopenedTask));
  }

  #snapshot(): TaskListData {
    const groups = cloneGroups(this.#groups);
    return { groups, summary: summarizeTaskGroups(groups) };
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

export function createInMemoryTaskGateway(scenario: InMemoryTaskGatewayScenario = 'populated'): TaskGateway {
  return new InMemoryTaskGateway(scenario);
}
