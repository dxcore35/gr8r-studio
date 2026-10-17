---
version: anydesign-1
name: Gr8r Studio upstream interface
source: https://github.com/gr8rstudio/gr8r-studio
captured_at: 2026-10-17
description: |
  A calm, compact project-management workspace built from warm neutral surfaces,
  precise one-pixel dividers, small Geist typography, and a restrained indigo accent.
  Navigation, page chrome, and dense task views share one strict horizontal rhythm.
colors:
  primary: '#4B5BD6'
  surface-page: '#FBFAF8'
  surface-sidebar: '#F4F3F0'
  surface: '#FFFFFF'
  surface-subtle: '#F6F5F2'
  text-primary: '#1D1C1A'
  text-secondary: '#57544E'
  text-tertiary: '#6B6760'
  border: '#E9E7E2'
  border-strong: '#DAD7D0'
  success: '#25754B'
  warning: '#8F5E0E'
  danger: '#B23C30'
dark-colors:
  primary: '#8E9AF3'
  surface-page: '#1A1A19'
  surface-sidebar: '#151514'
  surface: '#1D1D1C'
  surface-subtle: '#252524'
  text-primary: '#ECEAE5'
  text-secondary: '#B5B2AB'
  text-tertiary: '#9A968F'
  border: '#2C2B29'
  border-strong: '#3A3936'
typography:
  page-title: { fontFamily: 'Geist, sans-serif', fontSize: 23px, fontWeight: 600, lineHeight: 1.2, letterSpacing: -0.022em }
  body: { fontFamily: 'Geist, sans-serif', fontSize: 13.5px, fontWeight: 400, lineHeight: 1.5 }
  compact-label: { fontFamily: 'Geist, sans-serif', fontSize: 12px, fontWeight: 500, lineHeight: 1.4 }
  task-key: { fontFamily: 'Geist Mono, monospace', fontSize: 11px, fontWeight: 400, lineHeight: 1.4 }
spacing:
  base: 4px
  scale: [4px, 8px, 12px, 16px, 20px, 24px, 32px, 40px, 48px]
rounded:
  xs: 4px
  sm: 6px
  md: 8px
  lg: 10px
  full: 999px
shadows:
  control: '0 1px 2px rgba(28,25,20,0.05)'
  card: '0 1px 2px rgba(28,25,20,0.04), 0 0 0 1px #E9E7E2'
  popover: '0 12px 32px -8px rgba(28,25,20,0.16), 0 2px 6px -2px rgba(28,25,20,0.06), 0 0 0 1px #E9E7E2'
layout:
  sidebar-width: 252px
  sidebar-collapsed-width: 52px
  topbar-height: 46px
  content-gutter: 24px
  task-row-height: 40px
components:
  workspace-sidebar: { width: '{layout.sidebar-width}', backgroundColor: '{colors.surface-sidebar}', borderColor: '{colors.border}' }
  top-command-bar: { height: '{layout.topbar-height}', backgroundColor: '{colors.surface}', borderColor: '{colors.border}' }
  page-header: { padding: '24px {layout.content-gutter} 12px', title: '{typography.page-title}' }
  task-toolbar: { minHeight: 44px, padding: '8px {layout.content-gutter}', borderColor: '{colors.border}' }
  grouped-task-list: { rowHeight: '{layout.task-row-height}', dividerColor: '{colors.border}', hoverColor: '{colors.surface-subtle}' }
  primary-button: { height: 30px, backgroundColor: '{colors.primary}', textColor: '#FFFFFF', rounded: '{rounded.sm}', padding: '0 11px' }
---

# Design Analysis: Gr8r Studio upstream interface

> Analysis generated with the `anydesign` skill. Date: 2026-10-17. Emphasis: reconstruction and design system.

## Source

✅ Primary source: the upstream [Gr8r Studio repository](https://github.com/gr8rstudio/gr8r-studio), its live Vercel deployment, and the preserved legacy files in this fork. The local `src/styles/` and legacy shell/page files are byte-for-byte unchanged from upstream commit `904205c6`. Tokens came from the live CSS-variable digest and `src/styles/tokens.css`; layout and component behavior came from `src/shell/layout.js`, `src/pages/my-tasks.js`, and the imported stylesheets. Visual checks used `docs/preview.png` in light mode and the live My Tasks screen in dark mode. The failed automated Playwright frame capture is not treated as evidence.

## TL;DR

Gr8r Studio is a dense desktop productivity interface that stays calm through warm neutral surfaces, compact type, and disciplined one-pixel structure. ✅ Its identity depends less on decoration than on exact alignment: the breadcrumb, page header, toolbar, list header, and task content all start from `{layout.content-gutter}` (24px). Reuse the upstream shell and styles directly; do not reinterpret them as a floating rail, card dashboard, or generic component-library theme.

## 1. Visual identity

### 1.1 Surface description

- **Personality:** ✅ calm, compact, structured, precise.
- **Mood:** ✅ focused workspace rather than promotional SaaS chrome.
- **Stylistic references:** ⚠️ Linear/Asana-class project tooling, with warmer surfaces and quieter contrast.
- **Information density:** ✅ high on desktop; rows are `{layout.task-row-height}` (40px), labels start at 11–13.5px.
- **Implicit positioning:** ⚠️ professional team operations where speed and scanability outrank visual spectacle.

### 1.2 Brand voice / Atmosphere

The interface assumes people return throughout the workday and already understand task-management conventions. ✅ It therefore makes the structure persistent and predictable: a full workspace sidebar, a thin command bar, modest page headers, and lists separated primarily by dividers. Color speaks only for accent, project identity, and task state; the workspace itself stays quiet.

### 1.3 The "ONE brand thing"

- **The thing:** ✅ the compact black `gr8r` workspace mark inside a warm-neutral 252px sidebar.
- **Why it carries the brand:** it remains identifiable even when the central content changes between boards, calendars, settings, and lists.
- **Restraint around it:** the shell uses `{colors.surface-sidebar}` (#F4F3F0), `{colors.surface}` (#FFFFFF), and one indigo `{colors.primary}` (#4B5BD6) accent.
- **Scope:** it belongs in the workspace switcher/sidebar; it is not repeated as card decoration or page artwork.

## 2. Design System (tokens)

### 2.1 Colors

| Token             | Hex                                  | Role                      | Where it appears                           | Confidence |
| ----------------- | ------------------------------------ | ------------------------- | ------------------------------------------ | ---------- |
| `primary`         | `{colors.primary}` (#4B5BD6)         | Accent and primary action | New task, unread badges, selected controls | ✅         |
| `surface-page`    | `{colors.surface-page}` (#FBFAF8)    | Light page canvas         | General application background             | ✅         |
| `surface-sidebar` | `{colors.surface-sidebar}` (#F4F3F0) | Navigation surface        | Persistent workspace sidebar               | ✅         |
| `surface`         | `{colors.surface}` (#FFFFFF)         | Raised/plain work surface | Main content, inputs, controls             | ✅         |
| `surface-subtle`  | `{colors.surface-subtle}` (#F6F5F2)  | Hover and secondary fill  | Hovered rows, ghost controls               | ✅         |
| `text-primary`    | `{colors.text-primary}` (#1D1C1A)    | Main text                 | Titles, task names, active navigation      | ✅         |
| `text-secondary`  | `{colors.text-secondary}` (#57544E)  | Supporting text           | Descriptions, inactive navigation          | ✅         |
| `border`          | `{colors.border}` (#E9E7E2)          | Structural line           | Shell, tables, grouped lists               | ✅         |
| `success`         | `{colors.success}` (#25754B)         | Positive status           | Done/completed state                       | ✅         |
| `warning`         | `{colors.warning}` (#8F5E0E)         | Attention state           | Due/in-progress context                    | ✅         |
| `danger`          | `{colors.danger}` (#B23C30)          | Error/overdue             | Overdue tasks and destructive state        | ✅         |

Dark mode is independently defined rather than inverted:

| Token             | Hex                                       | Role                        | Confidence |
| ----------------- | ----------------------------------------- | --------------------------- | ---------- |
| `primary`         | `{dark-colors.primary}` (#8E9AF3)         | Accent with dark foreground | ✅         |
| `surface-page`    | `{dark-colors.surface-page}` (#1A1A19)    | Main dark canvas            | ✅         |
| `surface-sidebar` | `{dark-colors.surface-sidebar}` (#151514) | Dark sidebar                | ✅         |
| `surface`         | `{dark-colors.surface}` (#1D1D1C)         | Dark work surface           | ✅         |
| `text-primary`    | `{dark-colors.text-primary}` (#ECEAE5)    | Main dark-theme text        | ✅         |
| `text-secondary`  | `{dark-colors.text-secondary}` (#B5B2AB)  | Supporting dark-theme text  | ✅         |
| `border`          | `{dark-colors.border}` (#2C2B29)          | Dark structural line        | ✅         |

### 2.2 Typography

✅ The source declares Geist with system sans-serif fallbacks and Geist Mono for task keys.

| Token           | Size   | Weight | Line-height | Use                             |
| --------------- | ------ | ------ | ----------- | ------------------------------- |
| `page-title`    | 23px   | 600    | 1.2         | Page titles                     |
| `body`          | 13.5px | 400    | 1.5         | Task titles and general UI copy |
| `compact-label` | 12px   | 500    | 1.4         | Headers, controls, metadata     |
| `task-key`      | 11px   | 400    | 1.4         | Project/task identifiers        |

Page titles use `-0.022em` tracking. Labels remain sentence case except upstream sidebar group labels, which deliberately use compact uppercase tracking.

### 2.3 Spacing

✅ The base unit is `{spacing.base}` (4px). Observed values are `{spacing.scale}` (4, 8, 12, 16, 20, 24, 32, 40, and 48px). The shared desktop content gutter is `{layout.content-gutter}` (24px), reduced to 16px below 900px.

### 2.4 Radii

✅ Controls use `{rounded.xs}`–`{rounded.sm}` (4–6px), task cards/mobile rows use `{rounded.md}` (8px), larger panels use `{rounded.lg}` (10px), and avatars/status dots use `{rounded.full}`. Avoid inflating this into a soft 12–20px card system.

### 2.5 Elevation system

| Level | Name       | Treatment                                               | Use                                    |
| ----- | ---------- | ------------------------------------------------------- | -------------------------------------- |
| 0     | Structural | One-pixel `{colors.border}` or `{colors.border-strong}` | Shell, rows, panels                    |
| 1     | Control    | `{shadows.control}`                                     | Secondary buttons and small controls   |
| 2     | Card       | `{shadows.card}`                                        | Bounded dashboard panels               |
| 3     | Overlay    | `{shadows.popover}`                                     | Menus, command palette, mobile sidebar |

✅ Elevation is border-first. Shadows are quiet and functional; there are no decorative gradients.

### 2.6 Borders

✅ Structural borders are 1px `{colors.border}` (#E9E7E2). Strong control borders use `{colors.border-strong}` (#DAD7D0). Inputs focus with the primary border plus a 3px translucent accent halo. Task rows use the lighter divider scale.

### 2.7 Accessibility quick-check

The generated `design-a11y.md` verifies six primary pairs. ✅ Light primary text is 16.32:1, light secondary text is 7.54:1, and the light accent button pair is 5.58:1. Dark primary text is 14.49:1, dark secondary text is 7.97:1, and the dark accent button pair is 7.10:1. All pass WCAG AA for normal text.

## 3. Components Inventory

### 3.1 Generic components

#### workspace-sidebar

- **Variants:** expanded 252px; collapsed 52px; mobile 280px overlay.
- **Visible states:** active row, hover, project expansion, unread counts, collapsed tooltips.
- **Composition:** workspace switcher, primary navigation, workspace links, project tree, help/settings/profile.
- **Treatment:** `{colors.surface-sidebar}` with a 1px right border and 30px navigation rows.
- **Confidence:** ✅ source CSS and live shell.

#### top-command-bar

- **Size:** `{layout.topbar-height}` (46px desktop; 50px on small screens).
- **Composition:** breadcrumb, command search, notifications, create menu, account avatar.
- **Visible states:** search hover, unread notification, menu disclosure.
- **Treatment:** flat `{colors.surface}` with one bottom border; no floating card.
- **Confidence:** ✅ source CSS and live shell.

#### page-header

- **Composition:** title/summary on the left, view switcher and one primary action on the right.
- **Spacing:** `24px {layout.content-gutter} 12px` for full-bleed views.
- **Title:** `{typography.page-title}` with compact negative tracking.
- **Responsive:** actions wrap beneath the title at small widths.
- **Confidence:** ✅ source CSS and `pageMyTasks()`.

#### task-toolbar

- **Composition:** compact search, Filter, Sort, optional Group/Columns, then flexible trailing actions.
- **Size:** 44px minimum with 8px vertical padding and 4px gaps.
- **Treatment:** flat, border-bottom only; ghost actions use 26px height.
- **Visible states:** active filters, input focus, menu-expanded controls.
- **Confidence:** ✅ source CSS and `viewToolbar()`.

#### grouped-task-list

- **Structure:** sticky column header, 36px group headers, `{layout.task-row-height}` rows, inline add-task rows.
- **Columns:** completion, task, project, status, priority, due date, overflow.
- **Visible states:** hover, selected, done, drag target, expanded subtasks, collapsed group.
- **Responsive:** under 640px the header hides and rows become bordered, wrapping cards.
- **Confidence:** ✅ source CSS and `listHtml()`.

#### primary-button

- **Variants:** primary, secondary, ghost, danger; small and large sizes also exist.
- **Default size:** 30px high with 11px horizontal padding and `{rounded.sm}`.
- **Visible states:** hover, pressed 0.97 scale, disabled, loading.
- **Treatment:** `{colors.primary}` with white text in light mode; dark mode uses the dark accent pair.
- **Confidence:** ✅ source CSS.

### 3.2 Signature components

The signature pattern is the **full workspace navigator plus dense grouped task list**. ✅ The sidebar carries hierarchy and context while the main pane remains almost entirely flat; group headers, columns, and row-level controls create structure without card nesting. The command search and compact task identifiers reinforce the desktop-tool character.

## 4. Layout & Composition

### 4.1 Grid & containers

✅ The desktop shell is a two-column grid: `{layout.sidebar-width}` (252px) plus the flexible main area. The sidebar collapses to 52px. The main pane stacks a `{layout.topbar-height}` (46px) command bar above one independently scrolling content region. Standard pages cap at 1160px; list/board views use `.page.flush` at full width.

### 4.2 Composition patterns

- **Persistent workspace frame:** sidebar + command bar remain stable between routes.
- **Full-bleed work view:** page header, toolbar, grouped list/board share one gutter line.
- **Divider-led density:** rows and panels rely on one-pixel boundaries rather than detached cards.
- **Single primary action:** New task is the chromatic action; view/filter controls remain neutral.

### 4.3 Responsive behavior

| Breakpoint | Observed behavior                                                            | Confidence |
| ---------- | ---------------------------------------------------------------------------- | ---------- |
| ≤1100px    | Search compresses to icon; two-column content stacks                         | ✅         |
| ≤900px     | Sidebar becomes a 280px off-canvas sheet; gutter becomes 16px                | ✅         |
| ≤640px     | 50px topbar, bottom navigation, wrapped page actions, task rows become cards | ✅         |

The mobile list preserves completion and task identity first, then wraps metadata. Top-bar actions expand to at least 40px; bottom navigation uses 48px minimum rows. ⚠️ The upstream desktop sidebar rows are intentionally denser than touch-target guidance and should remain exact on pointer layouts while mobile controls retain enlarged hit areas.

### 4.4 Image behavior

- ✅ The shell uses the compact vector `gr8r` brand mark and Lucide line icons.
- ✅ Avatars are initials-based colored circles, not photography.
- ✅ Project identities use small colored vector tiles/dots.
- No decorative hero imagery or background gradients are part of the product UI.

## 5. Reconstruction Notes

Use the existing Vite ES-module application and imported upstream CSS as the canonical implementation; the repository itself is stronger evidence than a visual rewrite. For future React/Next surfaces, port semantic behavior behind the same DOM/class contract before replacing individual primitives.

**Quick wins:** restore the original runtime as the active app; keep the upstream stylesheet cascade intact; use the existing shell/list renderers instead of recreating them from screenshots.

**Tricky bits:** the custom Lucide subset plugin; focus/scroll preservation during string-render rerenders; mobile sidebar/bottom navigation; theme/density/accent attributes; grouped list drag and inline-edit states.

Define and preserve hover, focus, loading, empty, error, selection, drag, collapsed, and mobile-sheet states.

| Layer            | Confidence | Why                                                                  |
| ---------------- | ---------- | -------------------------------------------------------------------- |
| Identity         | ✅ High    | README preview plus live light/dark application                      |
| Tokens           | ✅ High    | Explicit upstream CSS variables and live digest                      |
| Components       | ✅ High    | Source renderers and exact CSS classes                               |
| Responsive       | ✅ High    | Explicit upstream media queries                                      |
| Backend behavior | ❓ Low     | Upstream is an in-memory prototype; server contracts are not defined |

## 6. Do's and Don'ts

### Do

- Use `{layout.content-gutter}` (24px desktop, 16px below 900px) for breadcrumb, page header, toolbar, and task content alignment.
- Keep the full `{layout.sidebar-width}` (252px) workspace hierarchy and 52px collapsed state.
- Preserve the compact `{typography.body}` (13.5px) / `{typography.compact-label}` (12px) hierarchy on desktop.
- Reserve `{colors.primary}` (#4B5BD6) for primary actions, selected states, and meaningful unread emphasis.
- Use one-pixel dividers and warm surface tokens before introducing elevation.

### Don't

- Do not replace the sidebar with a generic 64px floating rail or omit its project/team hierarchy.
- Do not turn grouped task rows into a conventional card/table component on desktop.
- Do not introduce large radii, glass, gradients, or persistent card shadows.
- Do not enlarge page titles beyond `{typography.page-title}` (23px) or use display-scale marketing typography inside the app.
- Do not replace the upstream light/dark palettes with a generic neutral scale or pure black/white surfaces.

## 7. Open Questions

- The eventual authenticated user and workspace data contracts remain undefined; the visual system does not answer backend ownership.
- UIArc components may be used for new functionality only when their rendered structure and tokens are adapted to this source of truth.

## 8. Companion files

- `design-tokens.json`: generated from this document with `build_tokens_json.py`.
- `design-a11y.md`: generated contrast report for the six core light/dark text pairs.
- `css-vars.json`: full CSS-variable extraction from the live upstream deployment.
- `../../preview.png`: upstream light-mode application screenshot used for visual confirmation.
