'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, CheckCircle2, RotateCcw } from 'lucide-react';
import { Alert } from '@/components/arc/alert/alert';
import { Badge, type BadgeTone } from '@/components/arc/badge/badge';
import { Button } from '@/components/arc/button/button';
import { EmptyState } from '@/components/arc/empty-state/empty-state';
import SegmentedControl from '@/components/arc/segmented-control/segmented-control';
import { Skeleton } from '@/components/arc/skeleton/skeleton';
import { SortableDataTable, type DataColumn } from '@/components/arc/sortable-data-table/sortable-data-table';
import {
  createInMemoryTaskGateway,
  createTaskListStateFixture,
  type InMemoryTaskGatewayScenario,
  type Task,
  type TaskGroupId,
  type TaskListData,
  type TaskListScenario,
  type TaskListState,
  type TaskPriority,
} from '@/features/tasks';
import styles from './my-tasks-view.module.css';

type TaskFilter = 'all' | 'today' | 'upcoming' | 'completed';

type TaskRow = Record<string, unknown> & {
  id: string;
  task: Task;
  title: string;
  project: string;
  due: string;
  dueSort: string;
  priority: TaskPriority;
  group: TaskGroupId;
};

const filters: Array<{ value: TaskFilter; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
];

const previewScenarios: ReadonlyArray<{ value: TaskListScenario; label: string }> = [
  { value: 'populated', label: 'Populated' },
  { value: 'empty', label: 'Empty' },
  { value: 'loading', label: 'Loading' },
  { value: 'error', label: 'Error' },
];

const priorityTone: Readonly<Record<TaskPriority, BadgeTone>> = {
  low: 'neutral',
  medium: 'info',
  high: 'warning',
};

function toGatewayScenario(scenario: TaskListScenario): InMemoryTaskGatewayScenario {
  if (scenario === 'empty' || scenario === 'error') return scenario;
  return 'populated';
}

function formatDueDate(task: Task, group: TaskGroupId) {
  if (task.dueDate === null) return 'No date';
  if (group === 'today' || (group === 'completed' && task.dueDate === '2026-10-16')) return 'Today';
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(new Date(`${task.dueDate}T00:00:00Z`));
}

function rowsFor(data: TaskListData, filter: TaskFilter): TaskRow[] {
  return data.groups
    .filter(group => filter === 'all' || group.id === filter)
    .flatMap(group =>
      group.tasks.map(task => ({
        id: task.id,
        task,
        title: task.title,
        project: task.project.name,
        due: formatDueDate(task, group.id),
        dueSort: task.dueDate ?? '9999-12-31',
        priority: task.priority,
        group: group.id,
      })),
    );
}

function PreviewPicker({ scenario }: { scenario: TaskListScenario }) {
  const router = useRouter();

  return (
    <label className={styles.previewPicker}>
      <span>Preview state</span>
      <select value={scenario} onChange={event => router.replace(`/my-tasks?scenario=${event.target.value}`)}>
        {previewScenarios.map(option => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function TaskTableSkeleton() {
  return (
    <section className={styles.loadingPanel} aria-label="Task list">
      <div className={styles.loadingHead}>
        <Skeleton label="Loading task filters" lines={1} />
        <Skeleton label="Loading task summary" lines={1} />
      </div>
      {Array.from({ length: 5 }, (_, index) => (
        <div className={styles.loadingRow} key={index}>
          <Skeleton label={`Loading task ${index + 1}`} lines={2} />
        </div>
      ))}
    </section>
  );
}

interface MyTasksViewProps {
  scenario: TaskListScenario;
  showScenarioPicker?: boolean;
}

export function MyTasksView({ scenario, showScenarioPicker = false }: MyTasksViewProps) {
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [state, setState] = useState<TaskListState>(() => createTaskListStateFixture(scenario));
  const [gateway, setGateway] = useState(() => createInMemoryTaskGateway(toGatewayScenario(scenario)));
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');

  const rows = useMemo(() => (state.status === 'ready' ? rowsFor(state.data, filter) : []), [filter, state]);

  async function refresh(nextGateway = gateway) {
    const result = await nextGateway.listMyTasks();
    if (!result.ok) {
      setState({ status: 'error', error: result.error });
      return;
    }
    setState(result.value.summary.total === 0 ? { status: 'empty' } : { status: 'ready', data: result.value });
  }

  async function retry() {
    setState({ status: 'loading' });
    const nextGateway = createInMemoryTaskGateway('populated');
    setGateway(nextGateway);
    await refresh(nextGateway);
    setAnnouncement('Tasks loaded');
  }

  async function toggleTask(task: Task) {
    if (pendingTaskId !== null) return;
    setPendingTaskId(task.id);
    const result = task.status === 'done' ? await gateway.reopenTask(task.id) : await gateway.completeTask(task.id);
    if (!result.ok) {
      setState({ status: 'error', error: result.error });
      setPendingTaskId(null);
      return;
    }
    await refresh();
    setPendingTaskId(null);
    setAnnouncement(task.status === 'done' ? `${task.title} reopened` : `${task.title} completed`);
  }

  const columns: DataColumn<TaskRow>[] = [
    {
      key: 'task',
      label: 'Status',
      sortable: false,
      width: 72,
      render: (_, row) => {
        const done = row.task.status === 'done';
        const label = done ? `Reopen ${row.task.title}` : `Complete ${row.task.title}`;
        return (
          <Button
            aria-label={label}
            className={styles.taskAction}
            disabled={pendingTaskId !== null && pendingTaskId !== row.id}
            loading={pendingTaskId === row.id}
            onClick={() => void toggleTask(row.task)}
            size="sm"
            variant="ghost"
          >
            {done ? <RotateCcw aria-hidden="true" size={17} /> : <Check aria-hidden="true" size={18} />}
          </Button>
        );
      },
    },
    {
      key: 'title',
      label: 'Task',
      sortable: true,
      render: (_, row) => (
        <span className={styles.taskTitle} data-completed={row.task.status === 'done' || undefined}>
          <strong>{row.title}</strong>
          <span>{row.task.key}</span>
        </span>
      ),
    },
    { key: 'project', label: 'Project', sortable: true },
    {
      key: 'dueSort',
      label: 'Due',
      sortable: true,
      width: 116,
      render: (_, row) => (
        <span className={styles.due} data-overdue={row.group === 'overdue' || undefined}>
          {row.due}
        </span>
      ),
    },
    {
      key: 'priority',
      label: 'Priority',
      sortable: true,
      width: 116,
      render: (_, row) => (
        <Badge size="sm" tone={priorityTone[row.priority]}>
          {row.priority[0].toUpperCase() + row.priority.slice(1)}
        </Badge>
      ),
    },
  ];

  return (
    <div className={styles.page}>
      <header className={styles.pageHeader}>
        <div>
          <h1>My tasks</h1>
          <p>One clear list of the work that needs your attention.</p>
        </div>
        {showScenarioPicker ? <PreviewPicker scenario={scenario} /> : null}
      </header>

      {state.status === 'loading' ? <TaskTableSkeleton /> : null}

      {state.status === 'error' ? (
        <section className={styles.statePanel} aria-label="Task list error">
          <Alert tone="danger" title="Tasks are unavailable">
            {state.error.message}
          </Alert>
          {state.error.retryable ? (
            <Button onClick={() => void retry()} variant="secondary">
              Try again
            </Button>
          ) : null}
        </section>
      ) : null}

      {state.status === 'empty' ? (
        <section className={styles.statePanel} aria-label="Empty task list">
          <EmptyState
            description="New assignments from your team, connected systems, and agents will appear here."
            icon={<CheckCircle2 aria-hidden="true" />}
            title="You have no assigned tasks"
          />
        </section>
      ) : null}

      {state.status === 'ready' ? (
        <section className={styles.taskSection} aria-label="Task list">
          <div className={styles.taskToolbar}>
            <SegmentedControl label="Filter tasks" onValueChange={value => setFilter(value as TaskFilter)} options={filters} value={filter} />
            <p className={styles.summary}>
              <strong>{state.data.summary.open}</strong> open
              <span aria-hidden="true"> · </span>
              <strong>{state.data.summary.overdue}</strong> overdue
              <span aria-hidden="true"> · </span>
              <strong>{state.data.summary.completed}</strong> completed
            </p>
          </div>

          {rows.length > 0 ? (
            <div className={styles.tablePanel}>
              <SortableDataTable
                caption="Tasks assigned to Mara Ionescu"
                columns={columns}
                itemName={{ one: 'task', other: 'tasks' }}
                rowKey="id"
                rows={rows}
              />
            </div>
          ) : (
            <div className={styles.filteredEmpty}>
              <EmptyState
                action={
                  <Button onClick={() => setFilter('all')} variant="secondary">
                    Show all tasks
                  </Button>
                }
                description={`There are no ${filter} tasks in this view.`}
                icon={<CheckCircle2 aria-hidden="true" />}
                title="Nothing in this filter"
              />
            </div>
          )}
        </section>
      ) : null}

      <p className={styles.srOnly} aria-live="polite" role="status">
        {announcement}
      </p>
    </div>
  );
}
