'use client';

import { useEffect, useMemo, useRef, useState, type CSSProperties, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Circle,
  CircleCheck,
  CircleDot,
  ClockAlert,
  Ellipsis,
  List,
  ListFilter,
  Plus,
  Search,
  SignalHigh,
  SignalLow,
  SignalMedium,
  Sun,
  X,
} from 'lucide-react';
import {
  createBrowserTaskGateway,
  createEmptyTaskListFixture,
  createTaskListStateFixture,
  offsetDate,
  todayDate,
  type CreateTaskInput,
  type InMemoryTaskGatewayScenario,
  type Task,
  type TaskGroup,
  type TaskGroupId,
  type TaskListData,
  type TaskListScenario,
  type TaskListState,
  type TaskPriority,
  type TaskStatus,
  type UpdateTaskInput,
} from '@/features/tasks';
import styles from './my-tasks-view.module.css';

type ViewMode = 'list' | 'calendar';
type TaskFilter = 'all' | TaskGroupId | 'todo' | 'in_progress' | TaskPriority;
type SortKey = 'title' | 'project' | 'status' | 'priority' | 'due';
type SortDirection = 1 | -1;

const GRID_TEMPLATE = '18px 30px minmax(220px,1fr) 160px 126px 108px 104px 40px';
const GRID_STYLE = { '--cols': GRID_TEMPLATE } as CSSProperties;

const filterOptions: ReadonlyArray<{ value: TaskFilter; label: string }> = [
  { value: 'all', label: 'All tasks' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'today', label: 'Today' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'todo', label: 'Status: To do' },
  { value: 'in_progress', label: 'Status: In progress' },
  { value: 'low', label: 'Priority: Low' },
  { value: 'medium', label: 'Priority: Medium' },
  { value: 'high', label: 'Priority: High' },
];
const sortOptions: ReadonlyArray<{ value: SortKey; label: string }> = [
  { value: 'due', label: 'Due date' },
  { value: 'title', label: 'Title' },
  { value: 'priority', label: 'Priority' },
  { value: 'status', label: 'Status' },
  { value: 'project', label: 'Project' },
];
const priorityRank: Readonly<Record<TaskPriority, number>> = { low: 1, medium: 2, high: 3 };
const statusRank: Readonly<Record<TaskStatus, number>> = { todo: 1, in_progress: 2, done: 3 };
const statusLabel: Readonly<Record<TaskStatus, string>> = { todo: 'To do', in_progress: 'In progress', done: 'Done' };
const projectColors: Readonly<Record<string, string>> = {
  'project-restaurant-operations': '#23918a',
  'project-website-refresh': '#8662c9',
};
const projects: readonly Task['project'][] = [
  { id: 'project-restaurant-operations', name: 'Restaurant operations' },
  { id: 'project-website-refresh', name: 'Website refresh' },
];

function toGatewayScenario(scenario: TaskListScenario): InMemoryTaskGatewayScenario {
  if (scenario === 'empty' || scenario === 'error') return scenario;
  return 'populated';
}

function projectStyle(task: Task) {
  return { '--c': projectColors[task.project.id] ?? 'var(--gray)' } as CSSProperties;
}

function dateAtUtc(date: string) {
  return new Date(`${date}T00:00:00Z`);
}

function isoDate(date: Date) {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDueDate(task: Task, today: string) {
  if (task.dueDate === null) return 'Set date';
  const difference = Math.round((dateAtUtc(task.dueDate).getTime() - dateAtUtc(today).getTime()) / 86_400_000);
  if (difference === 0) return 'Today';
  if (difference === 1) return 'Tomorrow';
  if (difference === -1) return 'Yesterday';
  if (difference > 1 && difference < 7) {
    return new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(dateAtUtc(task.dueDate));
  }
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(dateAtUtc(task.dueDate));
}

function compareTasks(left: Task, right: Task, key: SortKey, direction: SortDirection) {
  let result = 0;
  if (key === 'priority') result = priorityRank[right.priority] - priorityRank[left.priority];
  else if (key === 'status') result = statusRank[left.status] - statusRank[right.status];
  else if (key === 'due') result = (left.dueDate ?? '9999-12-31').localeCompare(right.dueDate ?? '9999-12-31');
  else if (key === 'project') result = left.project.name.localeCompare(right.project.name);
  else result = left.title.localeCompare(right.title);
  return (result || left.title.localeCompare(right.title)) * direction;
}

function filteredGroups(data: TaskListData, query: string, filter: TaskFilter, sortKey: SortKey, direction: SortDirection): TaskGroup[] {
  const needle = query.trim().toLocaleLowerCase();
  return data.groups.map(group => ({
    ...group,
    tasks: group.tasks
      .filter(task => filter === 'all' || group.id === filter || task.status === filter || task.priority === filter)
      .filter(task => !needle || `${task.key} ${task.title} ${task.project.name}`.toLocaleLowerCase().includes(needle))
      .toSorted((left, right) => compareTasks(left, right, sortKey, direction)),
  }));
}

function StatusIcon({ status }: { status: TaskStatus }) {
  if (status === 'done') return <CircleCheck aria-hidden="true" color="var(--st-done)" size={14} />;
  if (status === 'in_progress') return <CircleDot aria-hidden="true" color="var(--st-progress)" size={14} />;
  return <Circle aria-hidden="true" color="var(--st-todo)" size={14} />;
}

function PriorityIcon({ priority, size = 14 }: { priority: TaskPriority; size?: number }) {
  if (priority === 'high') return <SignalHigh aria-hidden="true" size={size} />;
  if (priority === 'medium') return <SignalMedium aria-hidden="true" size={size} />;
  return <SignalLow aria-hidden="true" size={size} />;
}

function GroupIcon({ id }: { id: TaskGroupId }) {
  if (id === 'overdue') return <ClockAlert aria-hidden="true" color="var(--red)" size={14} />;
  if (id === 'today') return <Sun aria-hidden="true" size={14} />;
  if (id === 'completed') return <CircleCheck aria-hidden="true" color="var(--green)" size={14} />;
  return <CalendarDays aria-hidden="true" size={14} />;
}

function LoadingList() {
  return (
    <section className={`${styles.listWrap} list-wrap`} aria-label="Task list">
      <div className={styles.loadingList} aria-busy="true">
        {Array.from({ length: 5 }, (_, index) => (
          <div className={`${styles.loadingRow} row`} key={index} role="status" aria-label={`Loading task ${index + 1}`} aria-busy="true">
            <span className="sk" style={{ width: 15, height: 15, borderRadius: 4 }} />
            <span className="sk" style={{ width: `${46 + index * 7}%`, height: 10 }} />
            <span className="sp" />
            <span className="sk" style={{ width: 70, height: 18, borderRadius: 5 }} />
            <span className="sk" style={{ width: 54, height: 10 }} />
          </div>
        ))}
        <span className={styles.srOnly} role="status" aria-label="Loading task filters" aria-busy="true">
          Loading task filters
        </span>
      </div>
    </section>
  );
}

interface TaskToolbarProps {
  query: string;
  filter: TaskFilter;
  sortKey: SortKey;
  filterOpen: boolean;
  sortOpen: boolean;
  onQueryChange: (value: string) => void;
  onFilterChange: (value: TaskFilter) => void;
  onSortChange: (value: SortKey) => void;
  onToggleFilter: () => void;
  onToggleSort: () => void;
}

function TaskToolbar({
  query,
  filter,
  sortKey,
  filterOpen,
  sortOpen,
  onQueryChange,
  onFilterChange,
  onSortChange,
  onToggleFilter,
  onToggleSort,
}: TaskToolbarProps) {
  const sortName = sortOptions.find(option => option.value === sortKey)?.label ?? 'Due date';

  return (
    <>
      <div className="toolbar" role="toolbar" aria-label="Task controls">
        <label className="inwrap">
          <Search className="i" aria-hidden="true" size={13} />
          <span className={styles.srOnly}>Search tasks</span>
          <input className="input search-sm" placeholder="Search tasks" type="search" value={query} onChange={event => onQueryChange(event.target.value)} />
        </label>

        <div className={styles.toolbarMenu}>
          <button
            className={`btn btn-ghost${filter !== 'all' ? ' on' : ''}`}
            type="button"
            aria-controls="task-filter-menu"
            aria-expanded={filterOpen}
            onClick={onToggleFilter}
          >
            <ListFilter className="i" aria-hidden="true" size={14} />
            Filter
            {filter !== 'all' ? <span className={`${styles.activeCount} badge accent`}>1</span> : null}
          </button>
          {filterOpen ? (
            <div className={styles.menu} id="task-filter-menu" role="group" aria-label="Filter tasks">
              {filterOptions.map(option => (
                <button
                  className={filter === option.value ? styles.menuActive : undefined}
                  type="button"
                  aria-pressed={filter === option.value}
                  key={option.value}
                  onClick={() => onFilterChange(option.value)}
                >
                  <span>{option.label}</span>
                  {filter === option.value ? <CheckCircle2 aria-hidden="true" size={14} /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className={styles.toolbarMenu}>
          <button className="btn btn-ghost" type="button" aria-controls="task-sort-menu" aria-expanded={sortOpen} onClick={onToggleSort}>
            <ArrowUpDown className="i" aria-hidden="true" size={14} />
            <span className="hide-m">Sort:</span> {sortName}
          </button>
          {sortOpen ? (
            <div className={styles.menu} id="task-sort-menu" role="group" aria-label="Sort tasks">
              {sortOptions.map(option => (
                <button
                  className={sortKey === option.value ? styles.menuActive : undefined}
                  type="button"
                  aria-pressed={sortKey === option.value}
                  key={option.value}
                  onClick={() => onSortChange(option.value)}
                >
                  <span>{option.label}</span>
                  {sortKey === option.value ? <CheckCircle2 aria-hidden="true" size={14} /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>
      {filter !== 'all' ? (
        <div className="chipsbar">
          <ListFilter aria-hidden="true" size={13} />
          <span className="chip">
            {filterOptions.find(option => option.value === filter)?.label}
            <button className="ibtn" type="button" aria-label="Remove filter" onClick={() => onFilterChange('all')}>
              <X aria-hidden="true" size={12} />
            </button>
          </span>
          <span className="sp" />
          <button className="btn btn-sm btn-ghost" type="button" onClick={() => onFilterChange('all')}>
            Clear all
          </button>
        </div>
      ) : null}
    </>
  );
}

interface TaskRowProps {
  task: Task;
  groupId: TaskGroupId;
  pending: boolean;
  blocked: boolean;
  today: string;
  onToggle: (task: Task) => void;
  onMore: (task: Task) => void;
  onUpdate: (task: Task, input: UpdateTaskInput) => void;
}

function TaskRow({ task, groupId, pending, blocked, today, onToggle, onMore, onUpdate }: TaskRowProps) {
  const done = task.status === 'done';
  const overdue = groupId === 'overdue' && !done;

  return (
    <div className={`trow${done ? ' done' : ''}${pending ? ` ${styles.pending}` : ''}`} style={GRID_STYLE} role="row">
      <div className="handle" aria-hidden="true" role="cell" />
      <div className="c-check" role="cell">
        <input
          className="check round"
          type="checkbox"
          checked={done}
          disabled={blocked}
          aria-label={done ? `Reopen ${task.title}` : `Complete ${task.title}`}
          onChange={() => onToggle(task)}
        />
      </div>
      <div className="ttl" role="cell">
        <span className={styles.titleIndent} aria-hidden="true" />
        <span className="key">{task.key}</span>
        <button className={`tt ${styles.titleButton}`} type="button" onClick={() => onMore(task)}>
          {task.title}
        </button>
      </div>
      <div className="c-meta c-project" role="cell">
        <label className={`pillbtn ${styles.cellControl}`}>
          <span className="pdot" style={projectStyle(task)} />
          <span className="trunc">{task.project.name}</span>
          <select
            aria-label={`Project for ${task.title}`}
            value={task.project.id}
            disabled={blocked}
            onChange={event => {
              const project = projects.find(item => item.id === event.target.value);
              if (project) onUpdate(task, { project });
            }}
          >
            {projects.map(project => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="c-meta c-status" role="cell">
        <label className={`pillbtn ${styles.cellControl}`}>
          <StatusIcon status={task.status} />
          <span>{statusLabel[task.status]}</span>
          <select
            aria-label={`Status for ${task.title}`}
            value={task.status}
            disabled={blocked}
            onChange={event => onUpdate(task, { status: event.target.value as TaskStatus })}
          >
            {(['todo', 'in_progress', 'done'] as const).map(status => (
              <option key={status} value={status}>
                {statusLabel[status]}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="c-meta c-priority" role="cell">
        <label className={`pillbtn ${styles.cellControl}`}>
          <PriorityIcon priority={task.priority} />
          <span>{task.priority[0].toUpperCase() + task.priority.slice(1)}</span>
          <select
            aria-label={`Priority for ${task.title}`}
            value={task.priority}
            disabled={blocked}
            onChange={event => onUpdate(task, { priority: event.target.value as TaskPriority })}
          >
            {(['low', 'medium', 'high'] as const).map(priority => (
              <option key={priority} value={priority}>
                {priority[0].toUpperCase() + priority.slice(1)}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="c-meta c-due" role="cell">
        <label className={`pillbtn ${styles.cellControl}${overdue ? ' over' : ''}`}>
          <Calendar aria-hidden="true" size={13} />
          <span className="num">{formatDueDate(task, today)}</span>
          <input
            aria-label={`Due date for ${task.title}`}
            type="date"
            value={task.dueDate ?? ''}
            disabled={blocked}
            onChange={event => onUpdate(task, { dueDate: event.target.value || null })}
          />
        </label>
      </div>
      <div className="c-more" role="cell">
        <button className="ibtn ibtn-sm" type="button" aria-label={`More actions for ${task.title}`} onClick={() => onMore(task)}>
          <Ellipsis aria-hidden="true" size={15} />
        </button>
      </div>
    </div>
  );
}

interface GroupedTaskListProps {
  groups: readonly TaskGroup[];
  collapsed: Readonly<Record<TaskGroupId, boolean>>;
  pendingTaskId: string | null;
  sortKey: SortKey;
  sortDirection: SortDirection;
  today: string;
  onCreate: (groupId: TaskGroupId, title: string) => Promise<boolean>;
  onMore: (task: Task) => void;
  onUpdate: (task: Task, input: UpdateTaskInput) => void;
  onSort: (key: SortKey) => void;
  onToggleGroup: (groupId: TaskGroupId) => void;
  onToggleTask: (task: Task) => void;
}

function GroupedTaskList({
  groups,
  collapsed,
  pendingTaskId,
  sortKey,
  sortDirection,
  today,
  onCreate,
  onMore,
  onUpdate,
  onSort,
  onToggleGroup,
  onToggleTask,
}: GroupedTaskListProps) {
  const [composerGroup, setComposerGroup] = useState<TaskGroupId | null>(null);
  const [composerTitle, setComposerTitle] = useState('');
  const [saving, setSaving] = useState(false);
  function startComposer(groupId: TaskGroupId) {
    if (collapsed[groupId]) onToggleGroup(groupId);
    setComposerGroup(groupId);
    setComposerTitle('');
  }
  async function submitComposer(event: FormEvent<HTMLFormElement>, groupId: TaskGroupId) {
    event.preventDefault();
    const title = composerTitle.trim();
    if (!title || saving) return;
    setSaving(true);
    const saved = await onCreate(groupId, title);
    setSaving(false);
    if (saved) setComposerTitle('');
  }
  const arrow = (key: SortKey) => {
    if (sortKey !== key) return null;
    return sortDirection > 0 ? <ArrowUp aria-hidden="true" size={11} /> : <ArrowDown aria-hidden="true" size={11} />;
  };
  const heading = (key: SortKey, label: string) => (
    <button className={styles.columnButton} type="button" onClick={() => onSort(key)}>
      {label} {arrow(key)}
    </button>
  );

  return (
    <div className={`${styles.taskList} tlist`} role="table" aria-label="Tasks assigned to Mara Ionescu">
      <div role="rowgroup">
        <div className="thead" style={GRID_STYLE} role="row">
          <div role="columnheader" />
          <div role="columnheader" />
          <div role="columnheader">{heading('title', 'Task')}</div>
          <div role="columnheader">{heading('project', 'Project')}</div>
          <div role="columnheader">{heading('status', 'Status')}</div>
          <div role="columnheader">{heading('priority', 'Priority')}</div>
          <div role="columnheader">{heading('due', 'Due date')}</div>
          <div role="columnheader" />
        </div>
      </div>

      {groups.map(group => {
        const isCollapsed = collapsed[group.id];
        return (
          <div className={styles.rowGroup} role="rowgroup" key={group.id}>
            <div className="grp" role="row">
              <div className={styles.groupCell} role="cell">
                <button
                  className="ibtn ibtn-xs"
                  type="button"
                  aria-expanded={!isCollapsed}
                  aria-label={`Toggle ${group.label} group`}
                  onClick={() => onToggleGroup(group.id)}
                >
                  {isCollapsed ? <ChevronRight aria-hidden="true" size={13} /> : <ChevronDown aria-hidden="true" size={13} />}
                </button>
                <GroupIcon id={group.id} />
                <span>{group.label}</span>
                <span className="cnt">{group.tasks.length}</span>
                <button className="ibtn ibtn-xs" type="button" aria-label={`Add task to ${group.label}`} onClick={() => startComposer(group.id)}>
                  <Plus aria-hidden="true" size={13} />
                </button>
              </div>
            </div>
            {!isCollapsed
              ? group.tasks.map(task => (
                  <TaskRow
                    blocked={pendingTaskId !== null}
                    groupId={group.id}
                    key={task.id}
                    pending={pendingTaskId === task.id}
                    task={task}
                    today={today}
                    onMore={onMore}
                    onToggle={onToggleTask}
                    onUpdate={onUpdate}
                  />
                ))
              : null}
            {!isCollapsed ? (
              <div className={styles.addTableRow} role="row">
                <div role="cell">
                  {composerGroup === group.id ? (
                    <form className={`addrow ${styles.inlineComposer}`} onSubmit={event => void submitComposer(event, group.id)}>
                      <Plus aria-hidden="true" size={14} />
                      <input
                        className="inline-in"
                        aria-label="New task name"
                        placeholder="Task name — press Enter to add, Esc to cancel"
                        autoFocus
                        value={composerTitle}
                        disabled={saving}
                        onChange={event => setComposerTitle(event.target.value)}
                        onKeyDown={event => {
                          if (event.key === 'Escape') setComposerGroup(null);
                        }}
                      />
                    </form>
                  ) : (
                    <button className="addrow" type="button" onClick={() => startComposer(group.id)}>
                      <Plus aria-hidden="true" size={14} />
                      Add task
                    </button>
                  )}
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

interface TaskCalendarProps {
  tasks: readonly Task[];
  cursor: Date;
  today: string;
  onAdd: (dueDate: string) => void;
  onCursorChange: (date: Date) => void;
  onTask: (task: Task) => void;
}

function TaskCalendar({ tasks, cursor, today, onAdd, onCursorChange, onTask }: TaskCalendarProps) {
  const [mode, setMode] = useState<'month' | 'week'>('month');
  const year = cursor.getUTCFullYear();
  const month = cursor.getUTCMonth();
  const first = new Date(Date.UTC(year, month, 1));
  const mondayOffset = (first.getUTCDay() + 6) % 7;
  const start = addDays(first, -mondayOffset);
  const cells = Array.from({ length: 42 }, (_, index) => addDays(start, index));
  const trimmed = cells[35]?.getUTCMonth() !== month ? cells.slice(0, 35) : cells;
  const weekStart = addDays(cursor, -((cursor.getUTCDay() + 6) % 7));
  const weekDays = Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
  const shortDate = (date: Date) => new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(date);
  const label =
    mode === 'month'
      ? new Intl.DateTimeFormat('en', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(first)
      : `${shortDate(weekDays[0])} – ${shortDate(weekDays[6])}, ${weekDays[6].getUTCFullYear()}`;
  const tasksByDate = Map.groupBy(
    tasks.filter(task => task.dueDate !== null),
    task => task.dueDate as string,
  );
  const move = (offset: number) => onCursorChange(mode === 'month' ? new Date(Date.UTC(year, month + offset, 1)) : addDays(cursor, offset * 7));

  return (
    <section className="cal" aria-label="Task calendar">
      <div className="toolbar" role="toolbar" aria-label="Calendar controls">
        <button className="btn btn-secondary btn-sm" type="button" onClick={() => onCursorChange(dateAtUtc(today))}>
          Today
        </button>
        <div className={styles.calendarArrows}>
          <button className="ibtn ibtn-sm" type="button" aria-label={`Previous ${mode}`} onClick={() => move(-1)}>
            <ChevronLeft aria-hidden="true" size={16} />
          </button>
          <button className="ibtn ibtn-sm" type="button" aria-label={`Next ${mode}`} onClick={() => move(1)}>
            <ChevronRight aria-hidden="true" size={16} />
          </button>
        </div>
        <h2 className={styles.calendarTitle} aria-live="polite">
          {label}
        </h2>
        <span className="sp" />
        <span className={`${styles.projectLegend} hide-m`}>
          <span>
            <i style={{ '--c': projectColors['project-restaurant-operations'] } as CSSProperties} />
            Restaurant operations
          </span>
          <span>
            <i style={{ '--c': projectColors['project-website-refresh'] } as CSSProperties} />
            Website refresh
          </span>
        </span>
        <div className="seg" aria-label="Calendar range">
          <button className={mode === 'month' ? 'on' : ''} type="button" aria-pressed={mode === 'month'} onClick={() => setMode('month')}>
            Month
          </button>
          <button className={mode === 'week' ? 'on' : ''} type="button" aria-pressed={mode === 'week'} onClick={() => setMode('week')}>
            Week
          </button>
        </div>
      </div>
      {mode === 'month' ? (
        <>
          <div className="cal-h" aria-hidden="true">
            {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
              <div key={day}>{day}</div>
            ))}
          </div>
          <div className="cal-g">
            {trimmed.map(date => {
              const dateString = isoDate(date);
              const dayTasks = tasksByDate.get(dateString) ?? [];
              const currentMonth = date.getUTCMonth() === month;
              const isToday = dateString === today;
              return (
                <div className={`cday${currentMonth ? '' : ' out'}${isToday ? ' today' : ''}`} key={dateString}>
                  <span className="dn" aria-current={isToday ? 'date' : undefined}>
                    {date.getUTCDate()}
                  </span>
                  <button className="ibtn ibtn-xs add" type="button" aria-label={`Add task on ${dateString}`} onClick={() => onAdd(dateString)}>
                    <Plus aria-hidden="true" size={13} />
                  </button>
                  {dayTasks.slice(0, 3).map(task => (
                    <button
                      className={`cev${task.status === 'done' ? ' done' : ''}`}
                      style={projectStyle(task)}
                      type="button"
                      title={task.title}
                      key={task.id}
                      onClick={() => onTask(task)}
                    >
                      {task.status === 'done' ? <StatusIcon status="done" /> : <PriorityIcon priority={task.priority} size={11} />}
                      <span className="trunc">{task.title}</span>
                      <span className="av" style={{ '--c': projectColors[task.project.id] } as CSSProperties} aria-label={task.assignee.name}>
                        {task.assignee.initials}
                      </span>
                    </button>
                  ))}
                  {dayTasks.length > 3 ? <span className="cmore">+{dayTasks.length - 3} more</span> : null}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="week">
          {weekDays.map(date => {
            const dateString = isoDate(date);
            const dayTasks = tasksByDate.get(dateString) ?? [];
            return (
              <div className="wcol" key={dateString}>
                <div className={`wcol-h${dateString === today ? ' today' : ''}`}>
                  <span className="n">{date.getUTCDate()}</span>
                  <span className="muted">{new Intl.DateTimeFormat('en', { weekday: 'short', timeZone: 'UTC' }).format(date)}</span>
                  <span className="sp" />
                  <button className="ibtn ibtn-xs" type="button" aria-label={`Add task on ${dateString}`} onClick={() => onAdd(dateString)}>
                    <Plus aria-hidden="true" size={13} />
                  </button>
                </div>
                <div className="wcol-b">
                  {dayTasks.length ? (
                    dayTasks.map(task => (
                      <button className="wcard" style={projectStyle(task)} type="button" key={task.id} onClick={() => onTask(task)}>
                        <span className="t">
                          <span className="pdot" style={projectStyle(task)} />
                          {task.title}
                        </span>
                        <span className="m">
                          <StatusIcon status={task.status} />
                          <PriorityIcon priority={task.priority} size={11} />
                          <span className="trunc grow">{task.project.name}</span>
                        </span>
                      </button>
                    ))
                  ) : (
                    <span className="faint">No tasks</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

interface ComposerProps {
  dueDate: string;
  open: boolean;
  onDueDateChange: (date: string) => void;
  onClose: () => void;
  onSave: (input: CreateTaskInput) => Promise<boolean>;
}

function TaskComposer({ dueDate, open, onDueDateChange, onClose, onSave }: ComposerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [status, setStatus] = useState<TaskStatus>('todo');
  const [projectId, setProjectId] = useState(projects[0].id);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const cleanTitle = title.trim();
    if (!cleanTitle || saving) return;
    setSaving(true);
    const saved = await onSave({
      title: cleanTitle,
      description,
      dueDate: dueDate || null,
      priority,
      status,
      project: projects.find(project => project.id === projectId),
    });
    setSaving(false);
    if (saved) {
      setTitle('');
      setDescription('');
    }
  }

  return (
    <dialog
      className={styles.composerDialog}
      ref={dialogRef}
      aria-labelledby="new-task-title"
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
      onClose={onClose}
    >
      <form aria-busy={saving} onSubmit={event => void submit(event)}>
        <header className={`modal-h ${styles.composerHeader}`}>
          <div>
            <h2 id="new-task-title">New task</h2>
          </div>
          <button className="ibtn ibtn-sm" type="button" aria-label="Close new task" onClick={onClose}>
            <X aria-hidden="true" size={16} />
          </button>
        </header>
        <div className={`modal-b ${styles.composerBody}`}>
          <label>
            <span className={styles.srOnly}>Task name</span>
            <input className="input input-lg" placeholder="Task name" value={title} autoFocus required onChange={event => setTitle(event.target.value)} />
          </label>
          <label>
            <span className={styles.srOnly}>Description</span>
            <textarea
              className="textarea"
              placeholder="Add a description… (optional)"
              rows={3}
              value={description}
              onChange={event => setDescription(event.target.value)}
            />
          </label>
          <div className={styles.composerFields}>
            <label>
              <span>Due date</span>
              <input className="input" type="date" value={dueDate} onChange={event => onDueDateChange(event.target.value)} />
            </label>
            <label>
              <span>Project</span>
              <select className="select" value={projectId} onChange={event => setProjectId(event.target.value)}>
                {projects.map(project => (
                  <option key={project.id} value={project.id}>
                    {project.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Status</span>
              <select className="select" value={status} onChange={event => setStatus(event.target.value as TaskStatus)}>
                {(['todo', 'in_progress', 'done'] as const).map(value => (
                  <option key={value} value={value}>
                    {statusLabel[value]}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Priority</span>
              <select className="select" value={priority} onChange={event => setPriority(event.target.value as TaskPriority)}>
                {(['low', 'medium', 'high'] as const).map(value => (
                  <option key={value} value={value}>
                    {value[0].toUpperCase() + value.slice(1)}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Assignee</span>
              <input className="input" value="Mara Ionescu" readOnly />
            </label>
          </div>
        </div>
        <footer className={`modal-f ${styles.composerActions}`}>
          <button className="btn btn-secondary" type="button" disabled={saving} onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" type="submit" disabled={saving}>
            {saving ? 'Creating…' : 'Create task'}
          </button>
        </footer>
      </form>
    </dialog>
  );
}

function TaskDrawer({ task, onClose, onUpdate }: { task: Task | null; onClose: () => void; onUpdate: (task: Task, input: UpdateTaskInput) => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (task && !dialog.open) dialog.showModal();
    if (!task && dialog.open) dialog.close();
  }, [task]);
  return (
    <dialog
      ref={dialogRef}
      className={`drawer ${styles.taskDrawer}`}
      aria-label={task ? `Task: ${task.title}` : 'Task details'}
      onClose={onClose}
      onClick={event => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onClose();
      }}
      onCancel={event => {
        event.preventDefault();
        onClose();
      }}
    >
      {task ? (
        <>
          <header className="drawer-h">
            <span className="key">{task.key}</span>
            <span className="sp" />
            <button className="ibtn ibtn-sm" type="button" aria-label="Close task details" onClick={onClose}>
              <X aria-hidden="true" size={16} />
            </button>
          </header>
          <div className="drawer-b" key={task.id}>
            <label className={styles.srOnly} htmlFor="drawer-title">
              Task title
            </label>
            <input
              id="drawer-title"
              className="ttl-edit"
              defaultValue={task.title}
              onBlur={event => {
                const title = event.target.value.trim();
                if (title && title !== task.title) onUpdate(task, { title });
                else if (!title) event.target.value = task.title;
              }}
            />
            <div className={styles.drawerProperties}>
              <label>
                Project
                <select
                  className="select"
                  value={task.project.id}
                  onChange={event => {
                    const project = projects.find(item => item.id === event.target.value);
                    if (project) onUpdate(task, { project });
                  }}
                >
                  {projects.map(project => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Status
                <select className="select" value={task.status} onChange={event => onUpdate(task, { status: event.target.value as TaskStatus })}>
                  {(['todo', 'in_progress', 'done'] as const).map(value => (
                    <option key={value} value={value}>
                      {statusLabel[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Priority
                <select className="select" value={task.priority} onChange={event => onUpdate(task, { priority: event.target.value as TaskPriority })}>
                  {(['low', 'medium', 'high'] as const).map(value => (
                    <option key={value} value={value}>
                      {value[0].toUpperCase() + value.slice(1)}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                Due date
                <input className="input" type="date" value={task.dueDate ?? ''} onChange={event => onUpdate(task, { dueDate: event.target.value || null })} />
              </label>
              <label>
                Assignee<span>{task.assignee.name}</span>
              </label>
            </div>
            <section className="dsec">
              <div className="dsec-h">
                <h3>Description</h3>
              </div>
              <label className={styles.srOnly} htmlFor="drawer-description">
                Description
              </label>
              <textarea
                id="drawer-description"
                className={`input ${styles.description}`}
                defaultValue={task.description}
                placeholder="Add a description…"
                onBlur={event => {
                  if (event.target.value !== task.description) onUpdate(task, { description: event.target.value });
                }}
              />
            </section>
          </div>
        </>
      ) : null}
    </dialog>
  );
}

interface MyTasksViewProps {
  scenario: TaskListScenario;
}

export function MyTasksView({ scenario }: MyTasksViewProps) {
  const [today] = useState(todayDate);
  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<TaskFilter>('all');
  const [sortKey, setSortKey] = useState<SortKey>('due');
  const [sortDirection, setSortDirection] = useState<SortDirection>(1);
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<TaskGroupId, boolean>>({ overdue: false, today: false, upcoming: false, completed: true });
  const [state, setState] = useState<TaskListState>(() => createTaskListStateFixture(scenario, today));
  const [gateway, setGateway] = useState(() => createBrowserTaskGateway(toGatewayScenario(scenario), today));
  const [pendingTaskId, setPendingTaskId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState('');
  const [calendarCursor, setCalendarCursor] = useState(() => dateAtUtc(today));
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerDueDate, setComposerDueDate] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  useEffect(() => {
    const openTaskComposer = () => {
      setComposerDueDate('');
      setComposerOpen(true);
    };
    window.addEventListener('gr8r:create-task', openTaskComposer);
    return () => window.removeEventListener('gr8r:create-task', openTaskComposer);
  }, []);

  useEffect(() => {
    if (scenario === 'loading') return;
    let active = true;
    void gateway.listMyTasks().then(result => {
      if (!active) return;
      if (!result.ok) {
        setState({ status: 'error', error: result.error });
        return;
      }
      setState(result.value.summary.total === 0 ? { status: 'empty' } : { status: 'ready', data: result.value });
    });
    return () => {
      active = false;
    };
  }, [gateway, scenario]);

  const groups = useMemo(
    () =>
      state.status === 'ready' || state.status === 'empty'
        ? filteredGroups(state.status === 'ready' ? state.data : createEmptyTaskListFixture(), query, filter, sortKey, sortDirection)
        : [],
    [filter, query, sortDirection, sortKey, state],
  );
  const visibleTasks = useMemo(() => groups.flatMap(group => group.tasks), [groups]);
  const selectedTask = state.status === 'ready' ? (state.data.groups.flatMap(group => group.tasks).find(task => task.id === selectedTaskId) ?? null) : null;
  const counts =
    state.status === 'ready'
      ? (Object.fromEntries(state.data.groups.map(group => [group.id, group.tasks.length])) as Record<TaskGroupId, number>)
      : { overdue: 0, today: 0, upcoming: 0, completed: 0 };

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
    const nextGateway = createBrowserTaskGateway('populated', today);
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

  async function updateTask(task: Task, input: UpdateTaskInput) {
    if (pendingTaskId !== null) return;
    setPendingTaskId(task.id);
    const result = await gateway.updateTask(task.id, input);
    if (!result.ok) setAnnouncement(result.error.message);
    else {
      await refresh();
      setAnnouncement(`${result.value.title} updated`);
    }
    setPendingTaskId(null);
  }

  function setTaskFilter(value: TaskFilter) {
    setFilter(value);
    setFilterOpen(false);
    if (value === 'overdue' || value === 'today' || value === 'upcoming' || value === 'completed') setCollapsed(current => ({ ...current, [value]: false }));
  }

  function changeSort(key: SortKey) {
    setSortDirection(current => (sortKey === key ? (current === 1 ? -1 : 1) : 1));
    setSortKey(key);
    setSortOpen(false);
  }

  function openComposer(dueDate = '') {
    setComposerDueDate(dueDate);
    setComposerOpen(true);
  }

  async function createTask(input: CreateTaskInput) {
    const result = await gateway.createTask(input);
    if (!result.ok) {
      setAnnouncement(result.error.message);
      return false;
    }

    await refresh();
    setComposerOpen(false);
    setAnnouncement(`${result.value.title} created`);
    return true;
  }

  async function createInGroup(groupId: TaskGroupId, title: string) {
    const dueDate = groupId === 'today' ? today : groupId === 'upcoming' ? offsetDate(today, 3) : null;
    return createTask({ title, dueDate, status: groupId === 'completed' ? 'done' : 'todo' });
  }

  function onKeyDown(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Escape') return;
    setFilterOpen(false);
    setSortOpen(false);
  }

  const summary = `${counts.today} due today · ${counts.overdue} overdue · ${counts.upcoming} upcoming`;

  return (
    <div className="page flush" onKeyDown={onKeyDown}>
      <div className="ph">
        <div>
          <h1>My Tasks</h1>
          <p>{state.status === 'loading' ? 'Loading your assigned work…' : summary}</p>
        </div>
        <div className="acts">
          <div className="seg" role="tablist" aria-label="View">
            <button
              className={viewMode === 'list' ? 'on' : ''}
              type="button"
              role="tab"
              aria-selected={viewMode === 'list'}
              onClick={() => setViewMode('list')}
            >
              <List aria-hidden="true" size={13} />
              List
            </button>
            <button
              className={viewMode === 'calendar' ? 'on' : ''}
              type="button"
              role="tab"
              aria-selected={viewMode === 'calendar'}
              onClick={() => setViewMode('calendar')}
            >
              <CalendarDays aria-hidden="true" size={13} />
              Calendar
            </button>
          </div>
          <button className="btn btn-primary" type="button" onClick={() => openComposer()}>
            <Plus className="i" aria-hidden="true" size={14} />
            New task
          </button>
        </div>
      </div>

      {state.status === 'ready' || state.status === 'empty' ? (
        <TaskToolbar
          filter={filter}
          filterOpen={filterOpen}
          query={query}
          sortKey={sortKey}
          sortOpen={sortOpen}
          onFilterChange={setTaskFilter}
          onQueryChange={setQuery}
          onSortChange={changeSort}
          onToggleFilter={() => {
            setFilterOpen(open => !open);
            setSortOpen(false);
          }}
          onToggleSort={() => {
            setSortOpen(open => !open);
            setFilterOpen(false);
          }}
        />
      ) : null}

      {state.status === 'loading' ? <LoadingList /> : null}

      {state.status === 'error' ? (
        <section className={`${styles.statePanel} empty-state`} role="alert" aria-label="Task list error">
          <div className="glyph">
            <AlertTriangle aria-hidden="true" size={20} />
          </div>
          <h2 className="es-h">Tasks are unavailable</h2>
          <p>{state.error.message}</p>
          {state.error.retryable ? (
            <button className="btn btn-secondary" type="button" onClick={() => void retry()}>
              Try again
            </button>
          ) : null}
        </section>
      ) : null}

      {(state.status === 'ready' || state.status === 'empty') && viewMode === 'list' ? (
        <section className={`${styles.listWrap} list-wrap`} aria-label="Task list">
          <GroupedTaskList
            collapsed={collapsed}
            groups={groups}
            pendingTaskId={pendingTaskId}
            sortDirection={sortDirection}
            sortKey={sortKey}
            today={today}
            onCreate={createInGroup}
            onMore={task => setSelectedTaskId(task.id)}
            onSort={changeSort}
            onToggleGroup={groupId => setCollapsed(current => ({ ...current, [groupId]: !current[groupId] }))}
            onToggleTask={task => void toggleTask(task)}
            onUpdate={(task, input) => void updateTask(task, input)}
          />
        </section>
      ) : null}

      {(state.status === 'ready' || state.status === 'empty') && viewMode === 'calendar' ? (
        <TaskCalendar
          cursor={calendarCursor}
          tasks={visibleTasks}
          today={today}
          onAdd={openComposer}
          onCursorChange={setCalendarCursor}
          onTask={task => setSelectedTaskId(task.id)}
        />
      ) : null}

      <TaskComposer
        dueDate={composerDueDate}
        open={composerOpen}
        onDueDateChange={setComposerDueDate}
        onClose={() => setComposerOpen(false)}
        onSave={createTask}
      />
      <TaskDrawer task={selectedTask} onClose={() => setSelectedTaskId(null)} onUpdate={(task, input) => void updateTask(task, input)} />

      <p className={styles.srOnly} aria-live="polite" role="status">
        {announcement}
      </p>
    </div>
  );
}
