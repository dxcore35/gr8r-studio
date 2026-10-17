/* ---------- store ---------- */
import { TODAY, diffD, iso, parse, uid } from './utils.js';
import { PCOLORS, TEAMS_SEED } from './constants.js';
import { seed } from '../data/seed.js';

export const STORE_KEY = 'gr8r.v2';
export const TASK_GATEWAY_KEY = 'gr8r.tasks.v1';
const TASK_GATEWAY_VERSION = 1;
const TASK_GROUPS = [
  { id: 'overdue', label: 'Overdue' },
  { id: 'today', label: 'Today' },
  { id: 'upcoming', label: 'Upcoming' },
  { id: 'completed', label: 'Completed' },
];
export const DEFAULT_PREFS = {
  theme: 'system',
  accent: 'indigo',
  side: 'comfortable',
  density: 'comfortable',
  weekStart: 1,
  dateFmt: 'MMM d',
  lang: 'English (US)',
  tz: '(GMT-07:00) Pacific Time',
  motion: 'system',
  home: 'home',
  openTasks: 'drawer',
  name: 'Tanjim Islam',
  title: 'Head of Product',
};

function readTaskGateway() {
  try {
    const raw = localStorage.getItem(TASK_GATEWAY_KEY);
    if (!raw) return null;
    const value = JSON.parse(raw);
    if (value?.version !== TASK_GATEWAY_VERSION || !Array.isArray(value.data?.groups)) return null;
    const tasks = value.data.groups.flatMap(group => (Array.isArray(group?.tasks) ? group.tasks : []));
    if (
      tasks.some(
        task =>
          !task ||
          typeof task.id !== 'string' ||
          typeof task.key !== 'string' ||
          typeof task.title !== 'string' ||
          typeof task.project?.id !== 'string' ||
          typeof task.project?.name !== 'string' ||
          typeof task.assignee?.id !== 'string' ||
          typeof task.assignee?.name !== 'string',
      )
    )
      return null;
    return { value, tasks };
  } catch {
    return null;
  }
}

function initials(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');
}

function projectKey(name, usedKeys) {
  const base =
    name
      .split(/\s+/)
      .filter(Boolean)
      .map(part => part[0])
      .join('')
      .toUpperCase()
      .slice(0, 4) || 'EXT';
  let key = base;
  let suffix = 2;
  while (usedKeys.has(key)) key = `${base}${suffix++}`;
  usedKeys.add(key);
  return key;
}

function mergeTaskGateway(data) {
  const gateway = readTaskGateway();
  if (!gateway) return data;

  const nativeMembers = data.members.filter(member => !member.gateway);
  const nativeMemberIds = new Set(nativeMembers.map(member => member.id));
  const gatewayMembers = new Map();
  for (const task of gateway.tasks) {
    if (!task.assignee.id || nativeMemberIds.has(task.assignee.id) || gatewayMembers.has(task.assignee.id)) continue;
    gatewayMembers.set(task.assignee.id, {
      id: task.assignee.id,
      name: task.assignee.name,
      email: '',
      role: 'Member',
      team: 'product',
      title: 'Team member',
      c: '#23918A',
      status: 'active',
      last: 0,
      tz: '',
      gateway: true,
    });
  }
  data.members = [...nativeMembers, ...gatewayMembers.values()];

  const nativeProjects = data.projects.filter(project => !project.gateway);
  const nativeProjectIds = new Set(nativeProjects.map(project => project.id));
  const usedProjectKeys = new Set(nativeProjects.map(project => project.key));
  const gatewayProjects = new Map();

  for (const task of gateway.tasks) {
    if (nativeProjectIds.has(task.project.id) || gatewayProjects.has(task.project.id)) continue;
    gatewayProjects.set(task.project.id, {
      id: task.project.id,
      key: projectKey(task.project.name, usedProjectKeys),
      name: task.project.name,
      icon: 'folder',
      color: 'teal',
      status: 'active',
      team: 'product',
      lead: data.me,
      due: task.dueDate || iso(TODAY),
      start: iso(TODAY),
      fav: false,
      members: [...new Set([data.me, ...gateway.tasks.filter(candidate => candidate.project.id === task.project.id).map(candidate => candidate.assignee.id)])],
      desc: 'Synced from My Tasks.',
      milestones: [],
      last: 0,
      gateway: true,
    });
  }

  const baseOrder = data.projOrder.filter(id => nativeProjectIds.has(id));
  data.projects = [...nativeProjects, ...gatewayProjects.values()];
  data.projOrder = [...baseOrder, ...gatewayProjects.keys()];

  const existingGatewayTasks = new Map(data.tasks.filter(task => task.gateway).map(task => [task.id, task]));
  const nativeTasks = data.tasks.filter(task => !task.gateway);
  const nextOrder = Math.max(0, ...nativeTasks.map(task => task.order || 0));
  const now = Date.now();
  const syncedTasks = gateway.tasks.map((task, index) => {
    const extension = task.legacy && typeof task.legacy === 'object' ? task.legacy : {};
    const existing = existingGatewayTasks.get(task.id) || {};
    const preserved = { ...extension, ...existing };
    const origin = gateway.value.origins?.[task.id];
    return {
      ...preserved,
      id: task.id,
      key: task.key,
      project: task.project.id,
      title: task.title,
      status: task.status === 'in_progress' ? 'progress' : task.status,
      assignee: task.assignee.id || data.me,
      priority: ['low', 'medium', 'high'].includes(task.priority) ? task.priority : 'medium',
      due: task.dueDate,
      start: preserved.start ?? task.dueDate,
      labels: Array.isArray(preserved.labels) ? preserved.labels : [],
      subtasks: Array.isArray(preserved.subtasks) ? preserved.subtasks : [],
      attachments: Array.isArray(preserved.attachments) ? preserved.attachments : [],
      deps: Array.isArray(preserved.deps) ? preserved.deps : [],
      desc: typeof task.description === 'string' ? task.description : '',
      estimate: preserved.estimate ?? null,
      created: preserved.created ?? now,
      updated: preserved.updated ?? now,
      order: preserved.order ?? nextOrder + index + 1,
      fav: preserved.fav ?? false,
      recur: preserved.recur ?? null,
      completedAt: task.status === 'done' ? (preserved.completedAt ?? now) : undefined,
      prevStatus: task.status === 'done' && origin ? (origin === 'in_progress' ? 'progress' : 'todo') : preserved.prevStatus,
      gateway: true,
      gatewayAssignee: undefined,
    };
  });
  data.tasks = [...nativeTasks, ...syncedTasks];
  return data;
}

function gatewayStatus(status) {
  if (status === 'done') return 'done';
  if (status === 'progress') return 'in_progress';
  return 'todo';
}

function gatewayPriority(priority) {
  if (priority === 'low' || priority === 'medium' || priority === 'high') return priority;
  return priority === 'urgent' ? 'high' : 'medium';
}

function gatewayGroup(task, today) {
  if (task.status === 'done') return 'completed';
  if (!task.due || task.due > today) return 'upcoming';
  if (task.due < today) return 'overdue';
  return 'today';
}

function legacyTaskExtension(task) {
  const { id, key, project, title, status, assignee, priority, due, desc, gateway, gatewayAssignee, ...extension } = task;
  return extension;
}

function syncTaskGateway(data) {
  const previous = readTaskGateway();
  const legacyTasks = data.tasks.filter(task => task.gateway);
  if (!previous && legacyTasks.length === 0) return;

  const usedKeys = new Set();
  const tasks = legacyTasks.map((task, index) => {
    const project = data.projects.find(candidate => candidate.id === task.project);
    const member = data.members.find(candidate => candidate.id === task.assignee) || data.members.find(candidate => candidate.id === data.me);
    const assignee = {
      id: member?.id || data.me,
      name: member?.name || 'Unassigned',
      initials: initials(member?.name || 'Unassigned'),
    };
    const baseKey = String(task.key || `TASK-${index + 1}`);
    let key = baseKey;
    let suffix = 2;
    while (usedKeys.has(key)) key = `${baseKey}-${suffix++}`;
    usedKeys.add(key);
    return {
      id: String(task.id),
      key,
      title: String(task.title || 'Untitled'),
      description: String(task.desc || ''),
      project: {
        id: project?.id || 'project-unassigned',
        name: project?.name || 'Unassigned',
      },
      assignee,
      status: gatewayStatus(task.status),
      priority: gatewayPriority(task.priority),
      dueDate: task.due || null,
      legacy: legacyTaskExtension(task),
    };
  });

  const today = iso(TODAY);
  const groups = TASK_GROUPS.map(group => ({
    ...group,
    tasks: tasks.filter((task, index) => gatewayGroup(legacyTasks[index], today) === group.id),
  }));
  const origins = {};
  const previousOrigins = previous?.value?.origins || {};
  for (const task of legacyTasks) {
    if (task.status !== 'done') continue;
    const origin = previousOrigins[task.id] || gatewayStatus(task.prevStatus);
    origins[task.id] = origin === 'in_progress' ? 'in_progress' : 'todo';
  }
  const nextTaskSequence =
    Number.isSafeInteger(previous?.value?.nextTaskSequence) && previous.value.nextTaskSequence < Number.MAX_SAFE_INTEGER
      ? previous.value.nextTaskSequence
      : 154;
  const completed = tasks.filter(task => task.status === 'done').length;
  const snapshot = {
    version: TASK_GATEWAY_VERSION,
    data: {
      groups,
      summary: {
        total: tasks.length,
        open: tasks.length - completed,
        completed,
        overdue: groups.find(group => group.id === 'overdue').tasks.length,
      },
    },
    origins,
    nextTaskSequence,
  };
  localStorage.setItem(TASK_GATEWAY_KEY, JSON.stringify(snapshot));
}

export function load() {
  let stored = null;
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) {
      const j = JSON.parse(raw);
      if (j && typeof j === 'object') stored = j;
    }
  } catch {
    /* storage blocked or corrupt: start from seed data */
  }
  const data = stored?.data?.tasks ? stored.data : seed();
  return { ...(stored || {}), data: mergeTaskGateway(data) };
}
export const saved = load();
export const S = {
  data: saved?.data || seed(),
  prefs: Object.assign({}, DEFAULT_PREFS, saved?.prefs || {}),
  views: saved?.views || {},
  ui: {
    fx: {},
    auth: null,
    authStep: 'login',
    onb: 0,
    onbData: { use: 'product', team: 'kanban', size: '2-10', ws: '', proj: 'Website Launch', tmpl: 'web', invites: '' },
    route: 'home',
    params: {},
    history: [],
    collapsed: !!saved?.collapsed,
    mnav: false,
    expanded: { p1: true },
    drawer: null,
    drawerFull: false,
    drawerTab: 'comments',
    modals: [],
    pop: null,
    palette: null,
    loading: false,
    offline: false,
    sel: new Set(),
    composer: null,
    editCell: null,
    openTasks: {},
    collapsedGroups: {},
    calDate: iso(TODAY),
    calMode: 'month',
    tlZoom: 'week',
    tlGroup: 'status',
    fileView: 'grid',
    projView: 'grid',
    homeTab: 'upcoming',
    inboxCat: 'all',
    inboxUnread: false,
    inboxSel: null,
    notifFilter: 'all',
    settings: 'appearance',
    searchQ: '',
    searchCat: 'all',
    myView: 'list',
    membersTab: 'members',
    collapsedCols: {},
    errors: {},
    drafts: {},
  },
};
export let _saveT;
export function save() {
  clearTimeout(_saveT);
  _saveT = setTimeout(() => {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify({ data: S.data, prefs: S.prefs, views: S.views, collapsed: S.ui.collapsed }));
      syncTaskGateway(S.data);
    } catch {
      /* storage full or blocked: keep working in memory */
    }
  }, 150);
}

/* ---------- lookups ---------- */
export const D = () => S.data;
export const me = () => D().members.find(m => m.id === D().me);
export const mem = id => D().members.find(m => m.id === id);
export const proj = id => D().projects.find(p => p.id === id);
export const task = id => D().tasks.find(t => t.id === id);
export const pColor = p => PCOLORS[p?.color] || PCOLORS.slate;
export const visibleProjects = () =>
  D()
    .projOrder.map(proj)
    .filter(Boolean)
    .filter(p => !p.archived);
export const canSee = p => !p.private || p.members.includes(D().me);
export const tasksOf = pid => D().tasks.filter(t => t.project === pid && !t.archived);
export const allTasks = () => D().tasks.filter(t => !t.archived && canSee(proj(t.project)));
export const isOver = t => t.due && t.status !== 'done' && diffD(parse(t.due), TODAY) < 0;
export const commentsOf = tid => D().comments.filter(c => c.task === tid);
export function progressOf(pid) {
  const ts = tasksOf(pid);
  if (!ts.length) return 0;
  return Math.round((ts.filter(t => t.status === 'done').length / ts.length) * 100);
}
export function taskProg(t) {
  if (t.status === 'done') return 100;
  if (t.subtasks.length) return Math.round((t.subtasks.filter(s => s.done).length / t.subtasks.length) * 100);
  return { backlog: 0, todo: 5, progress: 45, review: 80 }[t.status] || 0;
}

/* ---------- activity + notification helpers ---------- */
export function logAct(verb, t, extra = '') {
  D().activity.unshift({ id: uid('a'), by: D().me, verb, task: t?.id || null, project: t?.project || null, at: Date.now(), extra });
  if (t) t.updated = Date.now();
}

/* ---------- teams (workspace data, seeded on first use) ---------- */
export const NO_TEAM = { id: '', name: 'No team', icon: 'users', c: '#8A867E', desc: '' };
export function teamsList() {
  const d = D();
  if (!d.teams) d.teams = TEAMS_SEED.map(t => ({ ...t }));
  return d.teams;
}
export function team(id) {
  return teamsList().find(t => t.id === id) || null;
}
export const TM = new Proxy({}, { get: (_, k) => team(k) || NO_TEAM });
