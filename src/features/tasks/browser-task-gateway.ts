import { todayDate } from './date';
import { createInMemoryTaskGateway, InMemoryTaskGateway, type InMemoryTaskGatewayScenario, type InMemoryTaskGatewaySnapshot } from './in-memory-task-gateway';
import type { TaskGateway } from './task-gateway';
import type { Task, TaskGroup, TaskGroupId, TaskPriority, TaskStatus } from './types';

export const BROWSER_TASK_STORAGE_KEY = 'gr8r.tasks.v1';

interface TaskStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface BrowserTaskGatewayOptions {
  readonly storage?: TaskStorage | null;
  readonly storageKey?: string;
}

interface StoredTasks extends InMemoryTaskGatewaySnapshot {
  readonly version: 1;
}

const groupIds: readonly TaskGroupId[] = ['overdue', 'today', 'upcoming', 'completed'];
const statuses: readonly TaskStatus[] = ['todo', 'in_progress', 'done'];
const priorities: readonly TaskPriority[] = ['low', 'medium', 'high'];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isTask(value: unknown): value is Task {
  if (!isRecord(value) || !isRecord(value.project) || !isRecord(value.assignee)) return false;

  return (
    typeof value.id === 'string' &&
    typeof value.key === 'string' &&
    typeof value.title === 'string' &&
    typeof value.description === 'string' &&
    typeof value.project.id === 'string' &&
    typeof value.project.name === 'string' &&
    typeof value.assignee.id === 'string' &&
    typeof value.assignee.name === 'string' &&
    typeof value.assignee.initials === 'string' &&
    statuses.includes(value.status as TaskStatus) &&
    priorities.includes(value.priority as TaskPriority) &&
    (value.dueDate === null || typeof value.dueDate === 'string')
  );
}

function isTaskGroup(value: unknown): value is TaskGroup {
  return (
    isRecord(value) && groupIds.includes(value.id as TaskGroupId) && typeof value.label === 'string' && Array.isArray(value.tasks) && value.tasks.every(isTask)
  );
}

function isStoredTasks(value: unknown): value is StoredTasks {
  if (!isRecord(value) || value.version !== 1 || !isRecord(value.data) || !Array.isArray(value.data.groups)) return false;
  if (!value.data.groups.every(isTaskGroup) || value.data.groups.length !== groupIds.length) return false;
  if (
    !isRecord(value.origins) ||
    !Number.isSafeInteger(value.nextTaskSequence) ||
    Number(value.nextTaskSequence) < 1 ||
    Number(value.nextTaskSequence) >= Number.MAX_SAFE_INTEGER
  )
    return false;

  const groups = value.data.groups as TaskGroup[];
  const actualGroupIds = new Set(groups.map(group => group.id));
  if (actualGroupIds.size !== groupIds.length || !groupIds.every(groupId => actualGroupIds.has(groupId))) return false;

  const tasks = groups.flatMap(group => group.tasks);
  const taskIds = new Set(tasks.map(task => task.id));
  const taskKeys = new Set(tasks.map(task => task.key));
  if (taskIds.size !== tasks.length || taskKeys.size !== tasks.length) return false;
  if (groups.some(group => group.tasks.some(task => (group.id === 'completed') !== (task.status === 'done')))) return false;

  return Object.entries(value.origins).every(([taskId, status]) => taskIds.has(taskId) && (status === 'todo' || status === 'in_progress'));
}

function readStoredTasks(storage: TaskStorage, storageKey: string): InMemoryTaskGatewaySnapshot | undefined {
  try {
    const raw = storage.getItem(storageKey);
    if (raw === null) return undefined;
    const stored: unknown = JSON.parse(raw);
    if (!isStoredTasks(stored)) return undefined;
    return {
      data: stored.data,
      origins: stored.origins,
      nextTaskSequence: stored.nextTaskSequence,
    };
  } catch {
    return undefined;
  }
}

function writeStoredTasks(storage: TaskStorage, storageKey: string, snapshot: InMemoryTaskGatewaySnapshot): void {
  try {
    const stored: StoredTasks = { version: 1, ...snapshot };
    storage.setItem(storageKey, JSON.stringify(stored));
  } catch {
    // Storage can be unavailable or full. The in-memory gateway remains usable.
  }
}

function browserStorage(): TaskStorage | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function createBrowserTaskGateway(
  scenario: InMemoryTaskGatewayScenario = 'populated',
  today = todayDate(),
  options: BrowserTaskGatewayOptions = {},
): TaskGateway {
  if (scenario !== 'populated') return createInMemoryTaskGateway(scenario, today);

  const storage = options.storage === undefined ? browserStorage() : options.storage;
  if (storage === null) return createInMemoryTaskGateway(scenario, today);

  const storageKey = options.storageKey ?? BROWSER_TASK_STORAGE_KEY;
  return new InMemoryTaskGateway(scenario, today, {
    initialState: readStoredTasks(storage, storageKey),
    onChange: snapshot => writeStoredTasks(storage, storageKey, snapshot),
  });
}
