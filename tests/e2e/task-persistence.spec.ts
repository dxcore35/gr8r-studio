import { expect, test } from '@playwright/test';
import { BROWSER_TASK_STORAGE_KEY, createBrowserTaskGateway, type Task, type TaskGateway, type TaskListData } from '../../src/features/tasks';

class MemoryStorage {
  readonly #values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.#values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.#values.set(key, value);
  }
}

async function listTasks(gateway: TaskGateway): Promise<TaskListData> {
  const result = await gateway.listMyTasks();
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

function taskById(data: TaskListData, taskId: string): Task | undefined {
  return data.groups.flatMap(group => group.tasks).find(task => task.id === taskId);
}

test('persists mutations and keeps generated task IDs unique after reconstruction', async () => {
  const storage = new MemoryStorage();
  const today = '2026-10-17';
  let gateway = createBrowserTaskGateway('populated', today, { storage });

  const completed = await gateway.completeTask('task-confirm-weekend-rota');
  expect(completed.ok).toBe(true);

  const firstCreated = await gateway.createTask({ title: 'Persisted task', dueDate: today });
  expect(firstCreated.ok).toBe(true);
  if (!firstCreated.ok) throw new Error(firstCreated.error.message);

  gateway = createBrowserTaskGateway('populated', today, { storage });
  const reopened = await gateway.reopenTask('task-confirm-weekend-rota');
  expect(reopened).toMatchObject({ ok: true, value: { status: 'in_progress' } });

  const renamed = await gateway.updateTask(firstCreated.value.id, { title: 'Persisted after reload' });
  expect(renamed).toMatchObject({ ok: true, value: { title: 'Persisted after reload' } });

  const secondCreated = await gateway.createTask({ title: 'Another persisted task', dueDate: null });
  expect(secondCreated.ok).toBe(true);
  if (!secondCreated.ok) throw new Error(secondCreated.error.message);
  expect(secondCreated.value.id).not.toBe(firstCreated.value.id);

  const reloaded = createBrowserTaskGateway('populated', today, { storage });
  const data = await listTasks(reloaded);
  expect(taskById(data, firstCreated.value.id)?.title).toBe('Persisted after reload');
  expect(taskById(data, secondCreated.value.id)?.title).toBe('Another persisted task');

  const nextDayData = await listTasks(createBrowserTaskGateway('populated', '2026-10-18', { storage }));
  expect(nextDayData.groups.find(group => group.id === 'overdue')?.tasks.map(task => task.id)).toContain(firstCreated.value.id);
});

test('falls back safely when stored data is invalid and replaces it after a mutation', async () => {
  const storage = new MemoryStorage();
  storage.setItem(BROWSER_TASK_STORAGE_KEY, '{"version":1,"data":{"groups":[]}}');

  const gateway = createBrowserTaskGateway('populated', '2026-10-17', { storage });
  expect((await listTasks(gateway)).summary.total).toBe(5);

  const created = await gateway.createTask({ title: 'Recovered task', dueDate: null });
  expect(created.ok).toBe(true);

  const stored: unknown = JSON.parse(storage.getItem(BROWSER_TASK_STORAGE_KEY) ?? 'null');
  expect(stored).toMatchObject({ version: 1, data: { summary: { total: 6 } } });
  expect((await listTasks(createBrowserTaskGateway('populated', '2026-10-17', { storage }))).summary.total).toBe(6);
});

test('keeps deterministic fixture scenarios isolated from browser storage', async () => {
  const storage = new MemoryStorage();
  const populated = createBrowserTaskGateway('populated', '2026-10-17', { storage });
  await populated.createTask({ title: 'Stored task', dueDate: null });

  const empty = createBrowserTaskGateway('empty', '2026-10-17', { storage });
  expect((await listTasks(empty)).summary.total).toBe(0);
});
