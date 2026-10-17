'use client';

import type { CSSProperties, MouseEvent as ReactMouseEvent, ReactNode, RefObject } from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  Activity,
  Archive,
  Bell,
  Building2,
  Calendar,
  ChartGantt,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  CircleCheck,
  CircleHelp,
  Code2,
  Component as ComponentIcon,
  Ellipsis,
  FolderPlus,
  FolderKanban,
  Globe,
  Home,
  Inbox,
  Keyboard,
  LayoutDashboard,
  List,
  ListChecks,
  Lock,
  LogOut,
  Megaphone,
  Menu,
  Monitor,
  Moon,
  Paperclip,
  Palette,
  PanelLeft,
  Plus,
  Rocket,
  Search,
  Settings,
  Smartphone,
  SquareKanban,
  Star,
  Sun,
  Target,
  User,
  UserPlus,
  Users,
  type LucideIcon,
} from 'lucide-react';

type Theme = 'light' | 'dark' | 'system';
type MenuType = 'workspace' | 'create' | 'account';

interface ShellPreferences {
  theme: Theme;
  accent: string;
  side: string;
  density: string;
  weekStart: number;
  dateFmt: string;
  lang: string;
  tz: string;
  motion: string;
  home: string;
  openTasks: string;
  name: string;
  title: string;
}

interface Workspace {
  id: string;
  name: string;
  color: string;
  plan: string;
  brand?: boolean;
}

interface MenuState {
  type: MenuType;
  anchor: DOMRect;
  opener: HTMLButtonElement;
}

interface Gr8rShellProps {
  children: ReactNode;
}

interface NavItem {
  label: string;
  icon: LucideIcon;
  count?: number;
  current?: boolean;
}

interface ProjectItem {
  id: string;
  label: string;
  icon: LucideIcon;
  color: string;
  status: string;
  favorite?: boolean;
  private?: boolean;
}

interface UpstreamDestination {
  route: string;
  id?: string;
  tab?: string;
}

const primaryItems: NavItem[] = [
  { label: 'Home', icon: Home },
  { label: 'Inbox', icon: Inbox, count: 3 },
  { label: 'My Tasks', icon: CircleCheck, count: 4, current: true },
  { label: 'Favorites', icon: Star },
  { label: 'Notifications', icon: Bell, count: 6 },
];

const workspaceItems: NavItem[] = [
  { label: 'Overview', icon: LayoutDashboard },
  { label: 'Projects', icon: FolderKanban },
  { label: 'Tasks', icon: ListChecks },
  { label: 'Calendar', icon: Calendar },
  { label: 'Timeline', icon: ChartGantt },
  { label: 'Members', icon: Users },
  { label: 'Activity', icon: Activity },
];

const projects: ProjectItem[] = [
  { id: 'p1', label: 'Website Redesign', icon: Globe, color: '#5A67D8', status: 'var(--blue)', favorite: true },
  { id: 'p2', label: 'Mobile App', icon: Smartphone, color: '#3B82C4', status: 'var(--blue)', favorite: true },
  { id: 'p3', label: 'Marketing Campaign', icon: Megaphone, color: '#C54B78', status: 'var(--gray)' },
  { id: 'p4', label: 'Product Launch', icon: Rocket, color: '#C48A1E', status: 'var(--red)' },
  { id: 'p5', label: 'Design System', icon: ComponentIcon, color: '#8662C9', status: 'var(--blue)' },
  { id: 'p6', label: 'Customer Portal', icon: Building2, color: '#23918A', status: 'var(--amber)', private: true },
];

const workspaces: Workspace[] = [
  { id: 'w1', name: 'Gr8r Studio', color: '#1D1C1A', plan: 'Team', brand: true },
  { id: 'w2', name: 'Personal', color: '#3D8E5F', plan: 'Free' },
  { id: 'w3', name: 'Acme Labs', color: '#3B82C4', plan: 'Business' },
];

const defaultPreferences: ShellPreferences = {
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

const storeKey = 'gr8r.v2';

const teams: NavItem[] = [
  { label: 'Design', icon: Palette },
  { label: 'Engineering', icon: Code2 },
  { label: 'Marketing', icon: Megaphone },
  { label: 'Product', icon: Target },
];

const teamIds: Readonly<Record<string, string>> = {
  Design: 'design',
  Engineering: 'eng',
  Marketing: 'mkt',
  Product: 'product',
};

const upstreamRouteByLabel: Readonly<Record<string, string>> = {
  Home: 'home',
  Inbox: 'inbox',
  Favorites: 'favorites',
  Notifications: 'notifications',
  Search: 'search',
  Overview: 'overview',
  Projects: 'projects',
  Tasks: 'tasks',
  Calendar: 'calendar',
  Timeline: 'timeline',
  Members: 'members',
  Activity: 'activity',
  Archive: 'archive',
  Settings: 'settings',
  'Help & resources': 'home',
  'New project': 'projects',
  'New team': 'teams',
};

function upstreamDestinationFor(label: string): UpstreamDestination {
  const direct = upstreamRouteByLabel[label];
  if (direct) return { route: direct };

  const project = projects.find(candidate => label === candidate.label || label.startsWith(`${candidate.label} `));
  if (project) {
    const projectTab = label.slice(project.label.length).trim().toLowerCase();
    const tab = projectTab === 'options' ? 'overview' : projectTab || 'board';
    return { route: 'project', id: project.id, tab };
  }

  const teamId = teamIds[label];
  if (teamId) return { route: 'team', id: teamId };
  return { route: 'home' };
}

function openUpstreamDestination(destination: UpstreamDestination) {
  const url = new URL('/upstream/index.html', window.location.origin);
  if (destination.id) url.searchParams.set('id', destination.id);
  if (destination.tab) url.searchParams.set('tab', destination.tab);
  url.hash = destination.route;
  window.location.assign(url.href);
}

const brandPath =
  'M99.1462 184.663C94.0907 182.417 85.7476 181.12 76.352 179.822C69.5385 178.874 67.8899 178.404 67.8899 176.278C67.8899 174.392 69.5385 173.683 76.938 173.563C99.2654 173.323 105.374 167.424 105.374 156.324C105.374 150.894 103.496 146.521 97.9742 144.275L107.251 142.508L107.489 131.049H79.5204C52.3857 131.049 47.9163 142.508 47.9163 152.421C47.9163 160.337 49.7935 166.596 57.7888 170.139C49.5649 171.557 46.6251 174.621 46.6251 179.942C46.6251 188.207 55.435 189.744 67.3039 191.511C76.819 192.929 86.1055 192.809 86.1055 197.65C86.1055 200.255 83.9899 202.372 77.8816 202.372C68.4759 202.372 67.7707 199.067 67.5423 195.174H46.0391C46.0391 209.579 53.091 216.546 77.7624 216.546C101.967 216.546 107.837 206.983 107.837 197.061C107.837 190.562 104.907 187.029 99.1462 184.663ZM67.5818 145.663H84.7049V161.744H67.5818V145.663Z M131.104 138.36L127.469 131.033H115.133V191.256H137.222V161.27C137.222 153.593 138.98 147.684 152.021 149.101V129.975C140.271 128.907 134.749 132.451 131.104 138.36Z M210.119 152.285C217.757 150.398 223.041 145.207 223.041 136.113C223.041 123.117 214.698 114.502 191.903 114.502C169.109 114.502 160.766 123.117 160.766 136.113C160.766 145.207 166.06 150.398 173.697 152.285C164.878 154.77 159.355 161.029 159.355 170.243C159.355 182.76 167.699 192.443 192.022 192.443C216.108 192.443 224.451 182.76 224.451 170.243C224.451 161.029 218.929 154.77 210.119 152.285ZM204.03 176.172H180.193V160.091H204.03V176.172ZM204.03 144.029H180.193V130.553H204.03V144.029Z M247.211 138.36L243.566 131.033H231.23V191.256H253.32V161.27C253.32 153.593 255.088 147.684 268.128 149.101V129.975C256.379 128.907 250.856 132.451 247.211 138.36Z M284.807 114.502H267.684V130.583H284.807V114.502Z';

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark' || value === 'system';
}

function readStoredShell(): Record<string, unknown> | null {
  try {
    const raw = window.localStorage.getItem(storeKey);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function preferencesFromStore(store: Record<string, unknown> | null): ShellPreferences {
  const stored = store?.prefs && typeof store.prefs === 'object' ? (store.prefs as Partial<ShellPreferences>) : {};
  return {
    ...defaultPreferences,
    ...stored,
    theme: isTheme(stored.theme) ? stored.theme : defaultPreferences.theme,
  };
}

function applyPreferences(preferences: ShellPreferences) {
  const root = document.documentElement;
  if (preferences.theme === 'system') root.removeAttribute('data-theme');
  else root.dataset.theme = preferences.theme;
  if (preferences.accent === 'indigo') root.removeAttribute('data-accent');
  else root.dataset.accent = preferences.accent;
  root.dataset.side = preferences.side;
  root.dataset.density = preferences.density;
  if (preferences.motion === 'reduce') root.dataset.motion = 'reduce';
  else root.removeAttribute('data-motion');
}

function saveStoredShell(updates: Record<string, unknown>) {
  try {
    const current = readStoredShell() ?? {};
    window.localStorage.setItem(storeKey, JSON.stringify({ ...current, ...updates }));
  } catch {
    // Storage can be blocked. The in-memory shell remains usable.
  }
}

function Icon({ icon: IconComponent, size = 16 }: { icon: LucideIcon; size?: number }) {
  return <IconComponent aria-hidden="true" className="i" size={size} strokeWidth={1.8} />;
}

function WorkspaceMark({ workspace, size = 22 }: { workspace: Workspace; size?: number }) {
  if (!workspace.brand) {
    return (
      <span className="ws-logo" style={{ '--c': workspace.color, width: size, height: size } as CSSProperties} aria-hidden="true">
        {workspace.name.charAt(0)}
      </span>
    );
  }
  return (
    <span className="ws-logo brand" style={{ width: size, height: size }} aria-hidden="true">
      <svg viewBox="0 0 332 332">
        <rect width="332" height="332" fill="#000" />
        <path d={brandPath} fill="#fff" />
      </svg>
    </span>
  );
}

function Avatar({ className = '', decorative = false }: { className?: string; decorative?: boolean }) {
  return (
    <span
      className={`av ${className}`}
      style={{ '--c': '#5A67D8' } as CSSProperties}
      aria-hidden={decorative ? true : undefined}
      aria-label={decorative ? undefined : 'Tanjim Islam'}
    >
      TI
    </span>
  );
}

function NavButton({ item, collapsed, onSelect }: { item: NavItem; collapsed: boolean; onSelect: (label: string) => void }) {
  const { icon, label, count, current } = item;
  return (
    <button
      type="button"
      className={`sitem${current ? ' on' : ''}`}
      aria-current={current ? 'page' : undefined}
      aria-label={collapsed ? label : undefined}
      data-tip={collapsed ? label : undefined}
      data-tip-pos={collapsed ? 'right' : undefined}
      onClick={() => onSelect(label)}
    >
      <Icon icon={icon} />
      <span className="trunc">{label}</span>
      {count ? <span className={`ct${label === 'Inbox' ? ' dotc' : ''}`}>{count}</span> : null}
    </button>
  );
}

function Sidebar({
  activeMenu,
  collapsed,
  mobileOpen,
  isNarrow,
  workspace,
  onCollapse,
  onMenuOpen,
  onSelect,
  initialFocus,
}: {
  activeMenu: MenuType | null;
  collapsed: boolean;
  mobileOpen: boolean;
  isNarrow: boolean;
  workspace: Workspace;
  onCollapse: () => void;
  onMenuOpen: (type: MenuType, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onSelect: (label: string) => void;
  initialFocus: RefObject<HTMLButtonElement | null>;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ p1: true });

  function toggleProject(projectId: string) {
    setExpanded(current => ({ ...current, [projectId]: !current[projectId] }));
  }

  return (
    <nav id="main-navigation" className="side" aria-label="Main" inert={isNarrow && !mobileOpen ? true : undefined}>
      <div className="side-top">
        <div className="row" style={{ gap: 2 }}>
          <button
            ref={initialFocus}
            type="button"
            className="ws grow"
            aria-label="Switch workspace"
            aria-haspopup="menu"
            aria-controls="shell-workspace-menu"
            aria-expanded={activeMenu === 'workspace'}
            data-shell-menu-trigger="workspace"
            onClick={event => onMenuOpen('workspace', event)}
          >
            <WorkspaceMark workspace={workspace} />
            <span className="ws-name trunc">{workspace.name}</span>
            <span className="chev-d faint">
              <Icon icon={ChevronsUpDown} size={13} />
            </span>
          </button>
          {!collapsed ? (
            <button type="button" className="ibtn ibtn-sm hide-m" aria-label="Collapse sidebar" data-tip="Collapse sidebar  [" onClick={onCollapse}>
              <Icon icon={PanelLeft} size={15} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="side-scroll">
        {collapsed ? (
          <button type="button" className="sitem" aria-label="Expand sidebar" data-tip="Expand sidebar" data-tip-pos="right" onClick={onCollapse}>
            <Icon icon={PanelLeft} />
          </button>
        ) : null}

        {primaryItems.map(item => (
          <NavButton key={item.label} item={item} collapsed={collapsed} onSelect={onSelect} />
        ))}

        <div className="sgroup">
          <div className="sgroup-h">Workspace</div>
          {workspaceItems.map(item => (
            <NavButton key={item.label} item={item} collapsed={collapsed} onSelect={onSelect} />
          ))}
        </div>

        <div className="sgroup" id="side-projects">
          <div className="sgroup-h">
            <span>Projects</span>
            <span className="sp" />
            <button type="button" className="ibtn ibtn-xs" aria-label="New project" data-tip="New project  P" onClick={() => onSelect('New project')}>
              <Icon icon={Plus} size={14} />
            </button>
          </div>
          {projects.map(project => {
            const ProjectIcon = project.icon;
            const open = Boolean(expanded[project.id]);
            const subItems = [
              { label: 'Board', icon: SquareKanban },
              { label: 'List', icon: List },
              { label: 'Timeline', icon: ChartGantt },
              { label: 'Files', icon: Paperclip },
            ];
            return (
              <div className="sproj" key={project.id}>
                <div
                  className="sitem"
                  role="link"
                  tabIndex={0}
                  aria-label={collapsed ? project.label : undefined}
                  data-tip={collapsed ? project.label : undefined}
                  data-tip-pos={collapsed ? 'right' : undefined}
                  onClick={() => onSelect(project.label)}
                  onKeyDown={event => {
                    if (event.target !== event.currentTarget || (event.key !== 'Enter' && event.key !== ' ')) return;
                    event.preventDefault();
                    onSelect(project.label);
                  }}
                >
                  <button
                    type="button"
                    className="pico"
                    style={{ '--c': project.color } as CSSProperties}
                    aria-label={`Toggle ${project.label} sub-pages`}
                    aria-controls={`project-${project.id}-subpages`}
                    aria-expanded={open && !collapsed}
                    onClick={event => {
                      event.stopPropagation();
                      toggleProject(project.id);
                    }}
                  >
                    <ProjectIcon aria-hidden="true" className="i" size={12} strokeWidth={1.8} />
                  </button>
                  <span className="trunc">{project.label}</span>
                  {project.favorite ? (
                    <span className="fav">
                      <Icon icon={Star} size={11} />
                    </span>
                  ) : null}
                  {project.private ? (
                    <span className="faint" style={{ marginLeft: 4 }}>
                      <Icon icon={Lock} size={11} />
                    </span>
                  ) : null}
                  <span className="sdot" style={{ background: project.status }} title="Project status" />
                  <span className="hov">
                    <button
                      type="button"
                      className="ibtn ibtn-xs"
                      aria-label={`${project.label} options`}
                      onClick={event => {
                        event.stopPropagation();
                        onSelect(`${project.label} options`);
                      }}
                    >
                      <Icon icon={Ellipsis} size={14} />
                    </button>
                    <button
                      type="button"
                      className="ibtn ibtn-xs"
                      aria-label={`${open ? 'Collapse' : 'Expand'} ${project.label}`}
                      aria-controls={`project-${project.id}-subpages`}
                      aria-expanded={open && !collapsed}
                      onClick={event => {
                        event.stopPropagation();
                        toggleProject(project.id);
                      }}
                    >
                      <span className={`chev${open ? ' open' : ''}`}>
                        <Icon icon={ChevronRight} size={13} />
                      </span>
                    </button>
                  </span>
                </div>
                <div id={`project-${project.id}-subpages`} className={`sub${open && !collapsed ? ' open' : ''}`}>
                  {subItems.map(item => (
                    <button key={item.label} type="button" className="sitem" onClick={() => onSelect(`${project.label} ${item.label}`)}>
                      <Icon icon={item.icon} size={14} />
                      <span>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
          <NavButton item={{ label: 'Archive', icon: Archive, count: 2 }} collapsed={collapsed} onSelect={onSelect} />
        </div>

        <div className="sgroup">
          <div className="sgroup-h">
            <span>Teams</span>
            <span className="sp" />
            <button type="button" className="ibtn ibtn-xs" aria-label="New team" data-tip="New team" onClick={() => onSelect('New team')}>
              <Icon icon={Plus} size={14} />
            </button>
          </div>
          {teams.map(item => (
            <NavButton key={item.label} item={item} collapsed={collapsed} onSelect={onSelect} />
          ))}
        </div>
      </div>

      <div className="side-bot">
        <NavButton item={{ label: 'Help & resources', icon: CircleHelp }} collapsed={collapsed} onSelect={onSelect} />
        <NavButton item={{ label: 'Settings', icon: Settings }} collapsed={collapsed} onSelect={onSelect} />
        <button
          type="button"
          className="sitem"
          style={{ height: 36 }}
          aria-label={collapsed ? 'Profile' : undefined}
          data-tip={collapsed ? 'Profile' : undefined}
          data-tip-pos={collapsed ? 'right' : undefined}
          aria-haspopup="menu"
          aria-controls="shell-account-menu"
          aria-expanded={activeMenu === 'account'}
          data-shell-menu-trigger="account"
          onClick={event => onMenuOpen('account', event)}
        >
          <Avatar className="presence" />
          <span className="trunc" style={{ color: 'var(--text)', fontWeight: 500 }}>
            Tanjim Islam
          </span>
          <span className="ct">
            <Icon icon={ChevronsUpDown} size={13} />
          </span>
        </button>
      </div>
    </nav>
  );
}

function Topbar({
  activeMenu,
  onMobileToggle,
  onMenuOpen,
  onSelect,
  mobileButton,
  mobileOpen,
}: {
  activeMenu: MenuType | null;
  onMobileToggle: () => void;
  onMenuOpen: (type: MenuType, event: ReactMouseEvent<HTMLButtonElement>) => void;
  onSelect: (label: string) => void;
  mobileButton: RefObject<HTMLButtonElement | null>;
  mobileOpen: boolean;
}) {
  return (
    <header className="topbar">
      <button
        ref={mobileButton}
        type="button"
        className="ibtn"
        aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'}
        aria-controls="main-navigation"
        aria-expanded={mobileOpen}
        id="mnav-btn"
        onClick={onMobileToggle}
      >
        <Icon icon={Menu} size={17} />
      </button>
      <style>{'@media(min-width:901px){#mnav-btn{display:none!important}}'}</style>
      <nav className="crumbs trunc" aria-label="Breadcrumb">
        <button type="button" className="cur" aria-current="page">
          My Tasks
        </button>
      </nav>
      <span className="sp" />
      <button type="button" className="topsearch" aria-label="Search and commands" onClick={() => onSelect('Search')}>
        <Icon icon={Search} size={14} />
        <span className="lbltxt">Search or jump to…</span>
        <span className="kbd">⌘K</span>
      </button>
      <button type="button" className="ibtn" aria-label="Notifications" data-tip="Notifications" onClick={() => onSelect('Notifications')}>
        <Icon icon={Bell} />
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 6,
            right: 7,
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--accent)',
            boxShadow: '0 0 0 2px var(--surface)',
          }}
        />
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        aria-label="Create new"
        aria-haspopup="menu"
        aria-controls="shell-create-menu"
        aria-expanded={activeMenu === 'create'}
        data-shell-menu-trigger="create"
        onClick={event => onMenuOpen('create', event)}
      >
        <Icon icon={Plus} size={14} />
        <span className="hide-m">New</span>
        <span className="hide-m">
          <Icon icon={ChevronDown} size={12} />
        </span>
      </button>
      <button
        type="button"
        className="ibtn hide-m"
        style={{ width: 'auto', padding: '0 2px' }}
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-controls="shell-account-menu"
        aria-expanded={activeMenu === 'account'}
        data-shell-menu-trigger="account"
        onClick={event => onMenuOpen('account', event)}
      >
        <Avatar className="md" />
      </button>
    </header>
  );
}

function MenuButton({
  icon,
  label,
  shortcut,
  selected,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  shortcut?: string;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button type="button" className="mi" role="menuitem" onClick={onClick}>
      <Icon icon={icon} size={15} />
      <span>{label}</span>
      {shortcut ? (
        <span className="r">
          <kbd>{shortcut}</kbd>
        </span>
      ) : null}
      {selected ? (
        <span className="ck">
          <Icon icon={Check} size={14} />
        </span>
      ) : null}
    </button>
  );
}

function ShellMenu({
  menu,
  menuRef,
  preferences,
  workspace,
  onAction,
  onTheme,
  onWorkspace,
}: {
  menu: MenuState;
  menuRef: RefObject<HTMLDivElement | null>;
  preferences: ShellPreferences;
  workspace: Workspace;
  onAction: (label: string) => void;
  onTheme: (theme: Theme) => void;
  onWorkspace: (workspace: Workspace) => void;
}) {
  const style: CSSProperties = {
    left: menu.anchor.left,
    top: menu.anchor.bottom + 4,
    width: menu.type === 'create' ? 220 : 260,
  };

  return (
    <div
      id={`shell-${menu.type}-menu`}
      ref={menuRef}
      className="pop floating enter"
      role="menu"
      aria-label={`${menu.type} menu`}
      style={style}
      onKeyDown={event => {
        if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        const items = Array.from(event.currentTarget.querySelectorAll<HTMLElement>('[role^="menuitem"]:not([aria-disabled="true"])'));
        if (!items.length) return;
        const current = items.indexOf(document.activeElement as HTMLElement);
        const next =
          event.key === 'Home'
            ? 0
            : event.key === 'End'
              ? items.length - 1
              : event.key === 'ArrowDown'
                ? (current + 1) % items.length
                : (current - 1 + items.length) % items.length;
        event.preventDefault();
        items[next]?.focus();
      }}
    >
      {menu.type === 'create' ? (
        <>
          <div className="mh">Create</div>
          <MenuButton icon={CircleCheck} label="Task" shortcut="N" onClick={() => onAction('Create task')} />
          <MenuButton icon={FolderPlus} label="Project" shortcut="P" onClick={() => onAction('Create project')} />
          <MenuButton icon={Users} label="Team" onClick={() => onAction('Create team')} />
          <div className="msep" />
          <MenuButton icon={UserPlus} label="Invite member" onClick={() => onAction('Invite member')} />
        </>
      ) : null}

      {menu.type === 'workspace' ? (
        <>
          <div className="mh">Workspaces</div>
          {workspaces.map(item => (
            <button key={item.id} type="button" className="mi" role="menuitem" onClick={() => onWorkspace(item)}>
              <WorkspaceMark workspace={item} size={20} />
              <span className="grow">{item.name}</span>
              <span className="faint" style={{ fontSize: 11 }}>
                {item.plan}
              </span>
              {item.id === workspace.id ? (
                <span className="ck">
                  <Icon icon={Check} size={14} />
                </span>
              ) : null}
            </button>
          ))}
          <div className="msep" />
          <MenuButton icon={Plus} label="Create workspace" onClick={() => onAction('Create workspace')} />
          <MenuButton icon={Settings} label="Workspace settings" onClick={() => onAction('Workspace settings')} />
          <MenuButton icon={UserPlus} label="Invite members" onClick={() => onAction('Invite members')} />
          <div className="msep" />
          <MenuButton icon={LogOut} label="Sign out" onClick={() => onAction('Sign out')} />
        </>
      ) : null}

      {menu.type === 'account' ? (
        <>
          <div className="row" style={{ padding: '8px 8px 10px', gap: 10 }}>
            <Avatar className="lg" decorative />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 600 }}>{preferences.name}</div>
              <div className="faint trunc" style={{ fontSize: 12 }}>
                hello@gr8rstudio.com
              </div>
            </div>
          </div>
          <div className="msep" />
          <MenuButton icon={User} label="View profile" onClick={() => onAction('View profile')} />
          <MenuButton icon={Settings} label="Account settings" onClick={() => onAction('Account settings')} />
          <div className="msep" />
          <div className="mh">Theme</div>
          <div style={{ padding: '2px 6px 6px' }}>
            <div className="seg" style={{ width: '100%' }} role="group" aria-label="Theme">
              {(
                [
                  ['light', Sun, 'Light'],
                  ['dark', Moon, 'Dark'],
                  ['system', Monitor, 'System'],
                ] as const
              ).map(([theme, icon, label]) => (
                <button
                  key={theme}
                  type="button"
                  className={preferences.theme === theme ? 'on' : undefined}
                  style={{ flex: 1, justifyContent: 'center' }}
                  role="menuitemradio"
                  aria-checked={preferences.theme === theme}
                  onClick={() => onTheme(theme)}
                >
                  <Icon icon={icon} size={13} />
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="msep" />
          <MenuButton icon={Keyboard} label="Keyboard shortcuts" shortcut="?" onClick={() => onAction('Keyboard shortcuts')} />
          <MenuButton icon={LogOut} label="Sign out" onClick={() => onAction('Sign out')} />
        </>
      ) : null}
    </div>
  );
}

function BottomNavigation({ onOpen, onSelect, disabled }: { onOpen: () => void; onSelect: (label: string) => void; disabled: boolean }) {
  const items: NavItem[] = [
    { label: 'Home', icon: Home },
    { label: 'My Tasks', icon: CircleCheck, current: true },
    { label: 'Projects', icon: FolderKanban },
    { label: 'Inbox', icon: Inbox },
  ];
  return (
    <nav className="bottomnav" aria-label="Primary" inert={disabled ? true : undefined}>
      {items.map(item => (
        <button
          key={item.label}
          type="button"
          className={item.current ? 'on' : undefined}
          aria-current={item.current ? 'page' : undefined}
          onClick={() => onSelect(item.label)}
        >
          <Icon icon={item.icon} size={19} />
          <span>{item.label}</span>
          {item.label === 'Inbox' ? <span className="bdot" aria-hidden="true" /> : null}
        </button>
      ))}
      <button type="button" onClick={onOpen} aria-label="More navigation">
        <Icon icon={Ellipsis} size={19} />
        <span>More</span>
      </button>
    </nav>
  );
}

export function Gr8rShell({ children }: Gr8rShellProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isNarrow, setIsNarrow] = useState(false);
  const [preferences, setPreferences] = useState<ShellPreferences>(defaultPreferences);
  const [workspace, setWorkspace] = useState<Workspace>(workspaces[0]);
  const [menu, setMenu] = useState<MenuState | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [status, setStatus] = useState('');
  const mobileButton = useRef<HTMLButtonElement | null>(null);
  const mobileInitialFocus = useRef<HTMLButtonElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const store = readStoredShell();
    const nextPreferences = preferencesFromStore(store);
    const storedData = store?.data && typeof store.data === 'object' ? (store.data as Record<string, unknown>) : null;
    const storedWorkspace = storedData?.ws && typeof storedData.ws === 'object' ? (storedData.ws as Record<string, unknown>) : null;
    const nextWorkspace = workspaces.find(item => item.name === storedWorkspace?.name) ?? workspaces[0];
    applyPreferences(nextPreferences);
    const frame = window.requestAnimationFrame(() => {
      setPreferences(nextPreferences);
      setWorkspace(nextWorkspace);
      setCollapsed(store?.collapsed === true);
      setHydrated(true);
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    const query = window.matchMedia('(max-width: 900px)');
    const sync = () => {
      setIsNarrow(query.matches);
      if (!query.matches) setMobileOpen(false);
    };
    sync();
    query.addEventListener('change', sync);
    return () => query.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (event.key === 'Escape' && mobileOpen) {
        setMobileOpen(false);
        focusMobileButton();
        return;
      }
      if (event.key === '[' && !event.metaKey && !event.ctrlKey && !event.altKey && !target?.isContentEditable && !target?.matches('input, textarea, select')) {
        event.preventDefault();
        if (isNarrow) setMobileOpen(current => !current);
        else {
          setCollapsed(current => {
            const next = !current;
            saveStoredShell({ collapsed: next });
            return next;
          });
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isNarrow, mobileOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const frame = window.requestAnimationFrame(() => mobileInitialFocus.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [mobileOpen]);

  useEffect(() => {
    if (!menu) return;
    const opener = menu.opener;
    const frame = window.requestAnimationFrame(() => {
      const element = menuRef.current;
      if (!element) return;
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      let left = menu.anchor.left;
      let top = menu.anchor.bottom + 4;
      if (left + width > window.innerWidth - 8) left = Math.max(8, menu.anchor.right - width);
      if (top + height > window.innerHeight - 8) top = Math.max(8, menu.anchor.top - height - 4);
      element.style.left = `${left}px`;
      element.style.top = `${top}px`;
      element.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
    });

    function closeFromPointer(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (menuRef.current?.contains(target) || target.closest('[data-shell-menu-trigger]')) return;
      setMenu(null);
    }

    function closeFromKeyboard(event: KeyboardEvent) {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      setMenu(null);
      window.requestAnimationFrame(() => opener.focus({ preventScroll: true }));
    }

    function closeFromViewport() {
      setMenu(null);
    }

    document.addEventListener('pointerdown', closeFromPointer);
    document.addEventListener('keydown', closeFromKeyboard);
    window.addEventListener('resize', closeFromViewport);
    window.addEventListener('scroll', closeFromViewport, true);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', closeFromPointer);
      document.removeEventListener('keydown', closeFromKeyboard);
      window.removeEventListener('resize', closeFromViewport);
      window.removeEventListener('scroll', closeFromViewport, true);
    };
  }, [menu]);

  function focusMobileButton() {
    window.requestAnimationFrame(() => mobileButton.current?.focus());
  }

  function closeMobile() {
    setMobileOpen(false);
    focusMobileButton();
  }

  function toggleMobile() {
    setCollapsed(false);
    setMobileOpen(current => !current);
  }

  function toggleCollapsed() {
    setCollapsed(current => {
      const next = !current;
      saveStoredShell({ collapsed: next });
      return next;
    });
  }

  function select(label: string) {
    if (label === 'My Tasks') {
      setStatus('My Tasks is open');
      if (isNarrow) {
        setMobileOpen(false);
        focusMobileButton();
      }
      return;
    }
    setStatus(`Opening ${label}`);
    if (isNarrow) setMobileOpen(false);
    openUpstreamDestination(upstreamDestinationFor(label));
  }

  function openMenu(type: MenuType, event: ReactMouseEvent<HTMLButtonElement>) {
    const opener = event.currentTarget;
    if (menu?.type === type && menu.opener === opener) {
      setMenu(null);
      return;
    }
    setMenu({ type, anchor: opener.getBoundingClientRect(), opener });
  }

  function menuAction(label: string) {
    setMenu(null);
    if (label === 'Create task') {
      window.dispatchEvent(new CustomEvent('gr8r:create-task'));
      setStatus('New task composer opened');
      return;
    }
    const route =
      label === 'Create project'
        ? 'projects'
        : label === 'Create team'
          ? 'teams'
          : label.includes('Invite')
            ? 'members'
            : label === 'Sign out'
              ? 'login'
              : 'settings';
    setStatus(`Opening ${label}`);
    openUpstreamDestination({ route });
  }

  function setTheme(theme: Theme) {
    const next = { ...preferences, theme };
    setPreferences(next);
    applyPreferences(next);
    saveStoredShell({ prefs: next });
    setStatus(`${theme === 'system' ? 'System' : theme === 'dark' ? 'Dark' : 'Light'} theme enabled`);
  }

  function switchWorkspace(nextWorkspace: Workspace) {
    setWorkspace(nextWorkspace);
    setMenu(null);
    const store = readStoredShell();
    const data = store?.data && typeof store.data === 'object' ? (store.data as Record<string, unknown>) : {};
    saveStoredShell({
      data: {
        ...data,
        ws: {
          name: nextWorkspace.name,
          url: nextWorkspace.name.toLowerCase().replace(/[^a-z0-9]+/g, ''),
          c: nextWorkspace.color,
          brand: Boolean(nextWorkspace.brand),
        },
      },
    });
    setStatus(`Switched to ${nextWorkspace.name}`);
  }

  return (
    <div id="app" data-hydrated={hydrated ? 'true' : 'false'}>
      <a className="skip" href="#main-content">
        Skip to content
      </a>
      <div className={`shell${collapsed ? ' collapsed' : ''}${mobileOpen ? ' mnav' : ''}`}>
        <Sidebar
          activeMenu={menu?.type ?? null}
          collapsed={collapsed}
          mobileOpen={mobileOpen}
          isNarrow={isNarrow}
          initialFocus={mobileInitialFocus}
          onCollapse={toggleCollapsed}
          onMenuOpen={openMenu}
          onSelect={select}
          workspace={workspace}
        />
        {mobileOpen ? <button type="button" className="side-scrim" aria-label="Close navigation" onClick={closeMobile} /> : null}
        <main className="main" id="main" inert={isNarrow && mobileOpen ? true : undefined}>
          <Topbar
            activeMenu={menu?.type ?? null}
            mobileButton={mobileButton}
            mobileOpen={mobileOpen}
            onMenuOpen={openMenu}
            onMobileToggle={toggleMobile}
            onSelect={select}
          />
          <div className="content" id="main-content" tabIndex={-1}>
            {children}
          </div>
        </main>
        <BottomNavigation disabled={isNarrow && mobileOpen} onOpen={toggleMobile} onSelect={select} />
      </div>
      {menu ? (
        <ShellMenu
          menu={menu}
          menuRef={menuRef}
          onAction={menuAction}
          onTheme={setTheme}
          onWorkspace={switchWorkspace}
          preferences={preferences}
          workspace={workspace}
        />
      ) : null}
      <span className="sr" aria-live="polite">
        {status}
      </span>
    </div>
  );
}
