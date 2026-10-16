import type { Task, TaskGatewayError, TaskGroup, TaskGroupId, TaskListData, TaskListScenario, TaskListState } from './types';

export const TASK_FIXTURE_TODAY = '2026-10-16';

const GROUP_LABELS: Readonly<Record<TaskGroupId, string>> = {
  overdue: 'Overdue',
  today: 'Today',
  upcoming: 'Upcoming',
  completed: 'Completed',
};

const GROUP_ORDER: readonly TaskGroupId[] = ['overdue', 'today', 'upcoming', 'completed'];

const restaurantProject = {
  id: 'project-restaurant-operations',
  name: 'Restaurant operations',
} as const;

const websiteProject = {
  id: 'project-website-refresh',
  name: 'Website refresh',
} as const;

const currentUser = {
  id: 'user-mara-ionescu',
  name: 'Mara Ionescu',
  initials: 'MI',
} as const;

const populatedTasks: Readonly<Record<TaskGroupId, readonly Task[]>> = {
  overdue: [
    {
      id: 'task-confirm-weekend-rota',
      key: 'OPS-142',
      title: 'Confirm the weekend rota',
      description: 'Resolve the two remaining shift gaps before publishing.',
      project: restaurantProject,
      assignee: currentUser,
      status: 'in_progress',
      priority: 'high',
      dueDate: '2026-10-15',
    },
  ],
  today: [
    {
      id: 'task-review-supplier-delivery',
      key: 'OPS-147',
      title: 'Review the produce delivery',
      description: 'Record shortages and approve the supplier invoice.',
      project: restaurantProject,
      assignee: currentUser,
      status: 'todo',
      priority: 'medium',
      dueDate: TASK_FIXTURE_TODAY,
    },
    {
      id: 'task-approve-menu-copy',
      key: 'WEB-38',
      title: 'Approve the autumn menu copy',
      description: 'Check allergen wording before the website update is published.',
      project: websiteProject,
      assignee: currentUser,
      status: 'todo',
      priority: 'low',
      dueDate: TASK_FIXTURE_TODAY,
    },
  ],
  upcoming: [
    {
      id: 'task-plan-private-event',
      key: 'OPS-153',
      title: "Plan Friday's private event",
      description: 'Confirm the room layout, staffing, and final guest count.',
      project: restaurantProject,
      assignee: currentUser,
      status: 'todo',
      priority: 'medium',
      dueDate: '2026-10-20',
    },
  ],
  completed: [
    {
      id: 'task-send-daily-brief',
      key: 'OPS-139',
      title: 'Send the daily operations brief',
      description: "Share today's covers, events, and operational notes.",
      project: restaurantProject,
      assignee: currentUser,
      status: 'done',
      priority: 'low',
      dueDate: '2026-10-16',
    },
  ],
};

function cloneTask(task: Task): Task {
  return {
    ...task,
    project: { ...task.project },
    assignee: { ...task.assignee },
  };
}

function buildGroups(tasksByGroup: Readonly<Partial<Record<TaskGroupId, readonly Task[]>>>): TaskGroup[] {
  return GROUP_ORDER.map(id => ({
    id,
    label: GROUP_LABELS[id],
    tasks: (tasksByGroup[id] ?? []).map(cloneTask),
  }));
}

export function summarizeTaskGroups(groups: readonly TaskGroup[]): TaskListData['summary'] {
  const tasks = groups.flatMap(group => group.tasks);

  return {
    total: tasks.length,
    open: tasks.filter(task => task.status !== 'done').length,
    completed: tasks.filter(task => task.status === 'done').length,
    overdue: groups.find(group => group.id === 'overdue')?.tasks.length ?? 0,
  };
}

export function createPopulatedTaskListFixture(): TaskListData {
  const groups = buildGroups(populatedTasks);
  return { groups, summary: summarizeTaskGroups(groups) };
}

export function createEmptyTaskListFixture(): TaskListData {
  const groups = buildGroups({});
  return { groups, summary: summarizeTaskGroups(groups) };
}

export function createUnavailableTaskError(operation: TaskGatewayError['operation'] = 'list_my_tasks'): TaskGatewayError {
  return {
    code: 'unavailable',
    operation,
    message: operation === 'list_my_tasks' ? 'Tasks could not be loaded. Try again.' : 'The task could not be updated. Try again.',
    retryable: true,
  };
}

/**
 * Deterministic display states for Storybook-like previews and UI tests.
 * Loading is intentionally owned by the UI rather than simulated by a Promise
 * that never settles.
 */
export function createTaskListStateFixture(scenario: TaskListScenario): TaskListState {
  switch (scenario) {
    case 'loading':
      return { status: 'loading' };
    case 'empty':
      return { status: 'empty' };
    case 'error':
      return { status: 'error', error: createUnavailableTaskError() };
    case 'populated':
      return { status: 'ready', data: createPopulatedTaskListFixture() };
  }
}
