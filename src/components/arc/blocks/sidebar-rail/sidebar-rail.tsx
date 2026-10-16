'use client';

import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactElement, type ReactNode } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { AnimatePresence, LayoutGroup, motion, useMotionValue, useReducedMotion, useTransform, type Transition, type Variants } from 'motion/react';
import { CheckCircle2, ChevronRight, FolderKanban, Inbox, Search, Settings, X, type LucideIcon } from 'lucide-react';
import { Avatar } from '../../avatar/avatar';
import { Tooltip } from '../../tooltip/tooltip';
import { motionTokens } from '../../lib/motion-tokens';
import styles from './sidebar-rail.module.css';

const FULL = 240;
const RAIL = 64;
/** Below this shell width the sidebar leaves the layout and opens as a sheet. Matches the container query in the CSS. */
const COMPACT = 480;
/** Below this shell width the opened sidebar floats over the page from the rail instead of squeezing it, the way a tablet drawer does. */
const FLOAT = 640;
/** Below this shell width the sidebar starts as the icon rail, so the page keeps room to read. It can still be opened. */
const ROOMY = 760;
/** How long a picked row's highlight gets to land before a floating panel or sheet slides away. */
const SETTLE_MS = 200;

type Entry = { id: string; label: string; icon?: LucideIcon; count?: number; children?: Entry[] };

const sections: { id: string; heading?: string; items: Entry[] }[] = [
  {
    id: 'main',
    items: [
      { id: 'my-tasks', label: 'My tasks', icon: CheckCircle2 },
      { id: 'projects', label: 'Projects', icon: FolderKanban },
      { id: 'inbox', label: 'Inbox', icon: Inbox },
      { id: 'search', label: 'Search', icon: Search },
    ],
  },
];
const settingsEntry: Entry = { id: 'settings', label: 'Settings', icon: Settings };

const curve = (points: readonly number[]) => [...points] as [number, number, number, number];
const instant: Transition = { duration: 0 };

/** Labels leave quickly so they are gone a beat before the rail settles, and return a beat after the width starts opening. */
function labelTiming(collapsed: boolean, reduce: boolean): Transition {
  if (reduce) return instant;
  return collapsed ? { duration: 0.14, ease: curve(motionTokens.ease.standard) } : { duration: 0.24, delay: 0.1, ease: curve(motionTokens.ease.enter) };
}

/** Rail-only marks (dividers and unread dots) arrive once the labels have cleared, and leave first when the rail opens. */
function markTiming(collapsed: boolean, reduce: boolean): Transition {
  if (reduce) return instant;
  return collapsed ? { duration: 0.2, delay: 0.16, ease: curve(motionTokens.ease.enter) } : { duration: 0.1, ease: curve(motionTokens.ease.standard) };
}

const rise: Variants = {
  hidden: { opacity: 0, y: 8, filter: `blur(${motionTokens.blur.soft}px)` },
  shown: { opacity: 1, y: 0, filter: 'blur(0px)' },
  gone: { opacity: 0, y: -6, filter: `blur(${motionTokens.blur.subtle}px)` },
};

function RailTip({ enabled, label, note, children }: { enabled: boolean; label: string; note?: string; children: ReactElement }) {
  const [open, setOpen] = useState(false);
  // Closing the rail while a tip is open should not leave it armed for the next collapse.
  if (!enabled && open) setOpen(false);
  return (
    <TooltipPrimitive.Root open={enabled && open} onOpenChange={next => setOpen(next && enabled)}>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content className={styles.tip} side="right" sideOffset={14} collisionPadding={8}>
          {label}
          {note && <span className={styles.tipNote}>{note}</span>}
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
}

type RowProps = {
  entry: Entry;
  nested?: boolean;
  current: boolean;
  lit: boolean;
  expanded?: boolean;
  turned?: boolean;
  controls?: string;
  collapsed: boolean;
  tips: boolean;
  layoutId: string;
  reduce: boolean;
  onClick: () => void;
};

function NavRow({ entry, nested, current, lit, expanded, turned, controls, collapsed, tips, layoutId, reduce, onClick }: RowProps) {
  const Icon = entry.icon;
  const fade = labelTiming(collapsed, reduce);
  const mark = markTiming(collapsed, reduce);
  return (
    <RailTip enabled={tips} label={entry.label} note={entry.count ? `${entry.count} unread` : undefined}>
      <button
        type="button"
        className={[styles.item, nested ? styles.nested : '', lit ? styles.lit : ''].join(' ')}
        aria-current={current ? 'page' : undefined}
        aria-expanded={expanded}
        aria-controls={controls}
        onClick={onClick}
      >
        {lit && (
          <motion.span layoutId={layoutId} className={styles.highlight} style={{ borderRadius: 8 }} transition={reduce ? instant : motionTokens.spring.morph} />
        )}
        {Icon && <Icon className={styles.icon} size={16} strokeWidth={1.75} aria-hidden="true" />}
        <motion.span className={styles.label} initial={false} animate={{ opacity: collapsed ? 0 : 1, x: collapsed ? -6 : 0 }} transition={fade}>
          {entry.label}
          {entry.count ? <span className={styles.srOnly}>, {entry.count} unread</span> : null}
        </motion.span>
        {entry.count ? (
          <>
            <motion.span className={styles.count} aria-hidden="true" initial={false} animate={{ opacity: collapsed ? 0 : 1 }} transition={fade}>
              {entry.count}
            </motion.span>
            <motion.span
              className={styles.dot}
              aria-hidden="true"
              initial={false}
              animate={{ opacity: collapsed ? 1 : 0, scale: collapsed ? 1 : 0.3 }}
              transition={collapsed && !reduce ? { ...motionTokens.spring.snappy, delay: 0.16 } : mark}
            />
          </>
        ) : null}
        {turned !== undefined && (
          <motion.span
            className={styles.chevron}
            aria-hidden="true"
            initial={false}
            animate={{ opacity: collapsed ? 0 : 1, rotate: turned ? 90 : 0 }}
            transition={{ opacity: fade, rotate: reduce ? instant : motionTokens.spring.snappy }}
          >
            <ChevronRight size={14} strokeWidth={1.75} />
          </motion.span>
        )}
      </button>
    </RailTip>
  );
}

type NavProps = {
  variant: 'side' | 'sheet';
  baseId: string;
  collapsed: boolean;
  active: string;
  open: Record<string, boolean>;
  reduce: boolean;
  onSelect: (id: string) => void;
  onGroup: (id: string) => void;
};

function Navigation({ variant, baseId, collapsed, active, open, reduce, onSelect, onGroup }: NavProps) {
  const tips = variant === 'side' && collapsed;
  const layoutId = `${variant}-active`;
  const fade = labelTiming(collapsed, reduce);
  const mark = markTiming(collapsed, reduce);
  const height = reduce ? instant : motionTokens.spring.smooth;
  const shared = { collapsed, tips, layoutId, reduce };
  return (
    <motion.nav className={styles.nav} aria-label="Gr8r Studio" layoutScroll>
      {sections.map(section => {
        const headingId = `${baseId}-${variant}-${section.id}`;
        return (
          <div
            key={section.id}
            className={styles.section}
            role={section.heading ? 'group' : undefined}
            aria-labelledby={section.heading ? headingId : undefined}
          >
            {section.heading && (
              <motion.div className={styles.heading} initial={false} animate={{ height: collapsed ? 17 : 32 }} transition={height}>
                <motion.span
                  id={headingId}
                  className={styles.headingText}
                  initial={false}
                  animate={{ opacity: collapsed ? 0 : 1, x: collapsed ? -6 : 0 }}
                  transition={fade}
                >
                  {section.heading}
                </motion.span>
                <motion.span
                  className={styles.divider}
                  aria-hidden="true"
                  initial={false}
                  animate={{ opacity: collapsed ? 1 : 0, scaleX: collapsed ? 1 : 0.3 }}
                  transition={mark}
                />
              </motion.div>
            )}
            <ul className={styles.list} role="list">
              {section.items.map(entry => {
                if (!entry.children)
                  return (
                    <li key={entry.id}>
                      <NavRow entry={entry} current={active === entry.id} lit={active === entry.id} onClick={() => onSelect(entry.id)} {...shared} />
                    </li>
                  );
                const listId = `${baseId}-${variant}-${entry.id}-list`;
                const shown = !!open[entry.id] && !collapsed;
                const holdsActive = entry.children.some(child => child.id === active);
                return (
                  <li key={entry.id}>
                    <NavRow
                      entry={entry}
                      current={false}
                      lit={holdsActive && !shown}
                      expanded={shown}
                      turned={!!open[entry.id]}
                      controls={listId}
                      onClick={() => onGroup(entry.id)}
                      {...shared}
                    />
                    <motion.ul
                      id={listId}
                      className={styles.children}
                      role="list"
                      inert={!shown}
                      initial={false}
                      animate={shown ? { height: 'auto', opacity: 1, transitionEnd: { overflow: 'visible' } } : { height: 0, opacity: 0, overflow: 'hidden' }}
                      transition={{
                        height,
                        opacity: reduce ? instant : { duration: shown ? 0.24 : 0.14, delay: shown ? 0.06 : 0, ease: curve(motionTokens.ease.standard) },
                      }}
                    >
                      {entry.children.map(child => (
                        <li key={child.id}>
                          <NavRow
                            entry={child}
                            nested
                            current={active === child.id}
                            lit={shown && active === child.id}
                            onClick={() => onSelect(child.id)}
                            {...shared}
                          />
                        </li>
                      ))}
                    </motion.ul>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
      <ul className={`${styles.list} ${styles.footerList}`} role="list">
        <li>
          <NavRow entry={settingsEntry} current={active === 'settings'} lit={active === 'settings'} onClick={() => onSelect('settings')} {...shared} />
        </li>
      </ul>
    </motion.nav>
  );
}

function Brand({ collapsed, reduce, name, detail }: { collapsed: boolean; reduce: boolean; name: string; detail: string }) {
  return (
    <div className={styles.brand}>
      <span className={styles.mark} aria-hidden="true">
        G
      </span>
      <motion.span
        className={styles.stack}
        initial={false}
        animate={{ opacity: collapsed ? 0 : 1, x: collapsed ? -6 : 0 }}
        transition={labelTiming(collapsed, reduce)}
      >
        <strong>{name}</strong>
        <span>{detail}</span>
      </motion.span>
    </div>
  );
}

function Profile({ collapsed, reduce, name, role }: { collapsed: boolean; reduce: boolean; name: string; role: string }) {
  return (
    <div className={styles.profile}>
      <Avatar name={name} size="sm" status="online" />
      <motion.span
        className={styles.stack}
        initial={false}
        animate={{ opacity: collapsed ? 0 : 1, x: collapsed ? -6 : 0 }}
        transition={labelTiming(collapsed, reduce)}
      >
        <strong>{name}</strong>
        <span>{role}</span>
      </motion.span>
    </div>
  );
}

/** The divider in the panel icon slides with the sidebar, so the control shows what it is about to do. */
function PanelGlyph({ collapsed, reduce }: { collapsed: boolean; reduce: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
      <rect x="2.75" y="3.75" width="14.5" height="12.5" rx="3.5" />
      <motion.path d="M8.25 4.25v11.5" initial={false} animate={{ x: collapsed ? -2.5 : 0 }} transition={reduce ? instant : motionTokens.spring.smooth} />
    </svg>
  );
}

export interface SidebarRailProps {
  activeId?: string;
  children: ReactNode;
  pageTitle: string;
  topbarActions?: ReactNode;
  workspaceDetail?: string;
  workspaceName?: string;
  userName?: string;
  userRole?: string;
  onNavigate?: (id: string) => void;
}

export function SidebarRail({
  activeId = 'my-tasks',
  children,
  pageTitle,
  topbarActions,
  workspaceDetail = 'Operations',
  workspaceName = 'Gr8r Studio',
  userName = 'Alex Morgan',
  userRole = 'Owner',
  onNavigate,
}: SidebarRailProps) {
  const baseId = useId();
  const prefersReduced = !!useReducedMotion();
  // The first measurement settles the layout before paint, so it never animates.
  const [settling, setSettling] = useState(true);
  const reduce = prefersReduced || settling;
  const [collapsed, setCollapsed] = useState(false);
  const [floating, setFloating] = useState(false);
  const active = activeId;
  const [open, setOpen] = useState<Record<string, boolean>>({ projects: true });
  const [sheetOpen, setSheetOpen] = useState(false);
  const [frame, setFrame] = useState<HTMLElement | null>(null);
  const [status, setStatus] = useState('');
  const sheet = useRef<HTMLDivElement>(null);
  const menuButton = useRef<HTMLButtonElement>(null);
  const dragging = useRef(false);
  const closeTimer = useRef(0);
  const sidebarId = `${baseId}-sidebar`;

  // The [ shortcut toggles the rail, or the sheet when the shell is narrow. It stays out of text fields and off-screen shells.
  useEffect(() => {
    if (!frame) return;
    function onKey(event: KeyboardEvent) {
      if (event.key !== '[' || event.metaKey || event.ctrlKey || event.altKey || event.defaultPrevented || !frame) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName))) return;
      const box = frame.getBoundingClientRect();
      if (!box.width || box.bottom < 0 || box.top > window.innerHeight) return;
      event.preventDefault();
      if (frame.clientWidth < COMPACT) {
        setSheetOpen(!sheetOpen);
        return;
      }
      setCollapsed(!collapsed);
      setStatus(collapsed ? 'Sidebar expanded' : 'Sidebar collapsed');
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [frame, collapsed, sheetOpen]);

  // A mid-width shell starts on the rail; crossing the threshold later folds or opens it once, and a sheet has no place in the wide layout.
  const roomy = useRef<boolean | null>(null);
  useLayoutEffect(() => {
    if (!frame) return;
    const fit = () => {
      const width = frame.clientWidth;
      if (width >= COMPACT) setSheetOpen(false);
      const floats = width >= COMPACT && width < FLOAT;
      setFloating(floats);
      const next = width >= ROOMY;
      if (roomy.current !== next) {
        roomy.current = next;
        setCollapsed(!next);
      }
      // A panel left open while the shell narrows would cover the page, so it folds back to the rail.
      else if (floats) setCollapsed(true);
    };
    fit();
    const settle = requestAnimationFrame(() => setSettling(false));
    const observer = new ResizeObserver(fit);
    observer.observe(frame);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(settle);
    };
  }, [frame]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  function toggleRail() {
    setCollapsed(!collapsed);
    setStatus(collapsed ? 'Sidebar expanded' : 'Sidebar collapsed');
  }

  const overlaid = floating && !collapsed;

  function fold() {
    setCollapsed(true);
    setStatus('Sidebar collapsed');
  }

  function select(id: string, fromSheet = false) {
    if (fromSheet && dragging.current) return;
    onNavigate?.(id);
    const label = [...sections.flatMap(section => section.items), settingsEntry].find(entry => entry.id === id)?.label ?? 'Page';
    setStatus(id === activeId ? `${label} opened` : `${label} is planned for the next UI slice`);
    if (!fromSheet && !overlaid) return;
    // Let the highlight arrive before the sheet or the floating panel slides away.
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => (fromSheet ? setSheetOpen(false) : setCollapsed(true)), reduce ? 0 : SETTLE_MS);
  }

  function toggleGroup(id: string, fromSheet = false) {
    if (fromSheet && dragging.current) return;
    // In the rail a group has nowhere to open, so the sidebar widens to reveal it.
    if (collapsed && !fromSheet) {
      setCollapsed(false);
      setOpen(current => ({ ...current, [id]: true }));
      setStatus('Sidebar expanded');
      return;
    }
    setOpen(current => ({ ...current, [id]: !current[id] }));
  }

  // The scrim follows the sheet, so a drag to dismiss lightens the page under the finger instead of waiting for release.
  const sheetX = useMotionValue<number | string>('-100%');
  const scrimOpacity = useTransform(sheetX, value => {
    const width = sheet.current?.offsetWidth || 288;
    const shift = typeof value === 'number' ? value / width : value.endsWith('%') ? parseFloat(value) / 100 : parseFloat(value) / width;
    return Math.min(1, Math.max(0, 1 + (Number.isFinite(shift) ? shift : -1)));
  });

  const swap = reduce ? instant : { duration: motionTokens.duration.standard, ease: curve(motionTokens.ease.enter) };

  return (
    <LayoutGroup id={baseId}>
      <TooltipPrimitive.Provider delayDuration={250} skipDelayDuration={300}>
        <section
          ref={setFrame}
          className={styles.shell}
          aria-label={`${workspaceName} workspace`}
          onKeyDown={event => {
            if (event.key === 'Escape' && overlaid && !event.defaultPrevented) {
              event.preventDefault();
              fold();
            }
          }}
        >
          {/* The slot holds the sidebar's place in the row. On a floating shell it keeps the rail's width and the panel opens over the page. */}
          <motion.div
            className={styles.slot}
            initial={false}
            animate={{ width: floating || collapsed ? RAIL : FULL }}
            transition={reduce ? instant : motionTokens.spring.smooth}
          >
            <motion.div
              id={sidebarId}
              className={styles.sidebar}
              initial={false}
              animate={{ width: collapsed ? RAIL : FULL }}
              transition={reduce ? instant : motionTokens.spring.smooth}
              data-collapsed={collapsed || undefined}
              data-floating={overlaid || undefined}
            >
              <Brand collapsed={collapsed} reduce={reduce} name={workspaceName} detail={workspaceDetail} />
              <Navigation
                variant="side"
                baseId={baseId}
                collapsed={collapsed}
                active={active}
                open={open}
                reduce={reduce}
                onSelect={id => select(id)}
                onGroup={id => toggleGroup(id)}
              />
              <Profile collapsed={collapsed} reduce={reduce} name={userName} role={userRole} />
            </motion.div>
          </motion.div>
          <AnimatePresence>
            {overlaid && (
              <motion.div
                key="float-scrim"
                className={`${styles.scrim} ${styles.floatScrim}`}
                aria-hidden="true"
                onClick={fold}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={reduce ? instant : { duration: motionTokens.duration.standard, ease: curve(motionTokens.ease.standard) }}
              />
            )}
          </AnimatePresence>

          <div className={styles.main}>
            <header className={styles.topbar}>
              <Tooltip
                side="bottom"
                content={
                  <span className={styles.shortcut}>
                    {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                    <kbd>[</kbd>
                  </span>
                }
              >
                <button
                  type="button"
                  className={`${styles.iconButton} ${styles.railToggle}`}
                  aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  aria-expanded={!collapsed}
                  aria-controls={sidebarId}
                  aria-keyshortcuts="["
                  onClick={toggleRail}
                >
                  <PanelGlyph collapsed={collapsed} reduce={reduce} />
                </button>
              </Tooltip>
              <button
                ref={menuButton}
                type="button"
                className={`${styles.iconButton} ${styles.menuButton}`}
                aria-label="Open navigation"
                aria-haspopup="dialog"
                aria-expanded={sheetOpen}
                aria-keyshortcuts="["
                onClick={() => setSheetOpen(true)}
              >
                <PanelGlyph collapsed={false} reduce={reduce} />
              </button>
              <nav className={styles.crumbs} aria-label="Breadcrumb">
                <ol>
                  <li className={styles.crumbRoot}>{workspaceName}</li>
                  <li className={styles.crumbCurrent} aria-current="page">
                    <AnimatePresence mode="popLayout" initial={false}>
                      <motion.span key={pageTitle} variants={rise} initial="hidden" animate="shown" exit="gone" transition={swap}>
                        {pageTitle}
                      </motion.span>
                    </AnimatePresence>
                  </li>
                </ol>
              </nav>
              {topbarActions ? <div className={styles.team}>{topbarActions}</div> : null}
            </header>

            <main id="main-content" tabIndex={-1} className={styles.content}>
              {children}
            </main>
            <p className={styles.srOnly} role="status" aria-live="polite">
              {status}
            </p>
          </div>

          <Dialog.Root open={sheetOpen} onOpenChange={setSheetOpen}>
            <AnimatePresence>
              {sheetOpen && frame && (
                <Dialog.Portal forceMount container={frame}>
                  <Dialog.Overlay asChild forceMount>
                    <motion.div className={styles.scrim} style={{ opacity: scrimOpacity }} />
                  </Dialog.Overlay>
                  <Dialog.Content
                    asChild
                    forceMount
                    aria-describedby={undefined}
                    onCloseAutoFocus={event => {
                      event.preventDefault();
                      menuButton.current?.focus({ preventScroll: true });
                    }}
                    onOpenAutoFocus={event => {
                      const current = sheet.current?.querySelector<HTMLElement>("[aria-current='page']");
                      if (current && !current.closest('[inert]')) {
                        event.preventDefault();
                        current.focus();
                      }
                    }}
                  >
                    <motion.div
                      ref={sheet}
                      className={styles.sheet}
                      style={{ x: sheetX }}
                      initial={{ x: '-100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '-100%' }}
                      transition={reduce ? instant : motionTokens.spring.smooth}
                      drag={prefersReduced ? false : 'x'}
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={{ left: 0.9, right: 0.04 }}
                      dragMomentum={false}
                      onDragStart={() => {
                        dragging.current = true;
                        sheet.current?.setAttribute('data-dragging', '');
                      }}
                      onDragEnd={(_, info) => {
                        sheet.current?.removeAttribute('data-dragging');
                        window.setTimeout(() => {
                          dragging.current = false;
                        }, 0);
                        if (info.offset.x < -72 || info.velocity.x < -480) setSheetOpen(false);
                      }}
                    >
                      <Dialog.Title className={styles.srOnly}>Navigation</Dialog.Title>
                      <div className={styles.sheetHead}>
                        <Brand collapsed={false} reduce={reduce} name={workspaceName} detail={workspaceDetail} />
                        <Dialog.Close asChild>
                          <button type="button" className={styles.iconButton} aria-label="Close navigation">
                            <X size={18} strokeWidth={1.75} aria-hidden="true" />
                          </button>
                        </Dialog.Close>
                      </div>
                      <Navigation
                        variant="sheet"
                        baseId={baseId}
                        collapsed={false}
                        active={active}
                        open={open}
                        reduce={reduce}
                        onSelect={id => select(id, true)}
                        onGroup={id => toggleGroup(id, true)}
                      />
                      <Profile collapsed={false} reduce={reduce} name={userName} role={userRole} />
                    </motion.div>
                  </Dialog.Content>
                </Dialog.Portal>
              )}
            </AnimatePresence>
          </Dialog.Root>
        </section>
      </TooltipPrimitive.Provider>
    </LayoutGroup>
  );
}

export default SidebarRail;
