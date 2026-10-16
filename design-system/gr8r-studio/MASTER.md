# Gr8r Studio UI/UX master

This file is the visual and interaction contract for the rebuild. Page-specific files in `design-system/gr8r-studio/pages/` may refine a rule, but must not weaken accessibility, authorization clarity, or the shared Arc foundation.

## Product intent

Gr8r Studio is an internal work-management system for people, integrations, and agents. It should feel calm, trustworthy, and fast under daily operational load. It is an application, not a marketing site.

The interface has three presentations over the same records and permissions:

- **Focused:** personal work, small project boards, and only the controls needed to complete the current task.
- **Advanced:** workspace-wide planning, richer views, filters, bulk actions, provenance, and operational detail.
- **Admin:** a separate `/admin` control plane for people, roles, integrations, audit, and system configuration.

Focused and Advanced are preferences, not security boundaries. Permissions are always enforced separately. The first UI shows one company; workspace boundaries remain in the data and service contracts so a switcher can be added later without redesigning the shell.

## Visual direction

- Use Arc components before custom components.
- Use Arc `foundation.css` once at the application root.
- Use only Arc semantic tokens such as `--background`, `--surface`, `--foreground`, `--muted-foreground`, `--border`, and `--accent`. Do not introduce raw product colors.
- Start with Arc's neutral surfaces and blue accent preset. Accent is reserved for the current selection, primary action, focus, and essential data emphasis.
- Support light and dark themes from the first slice.
- Use borders and surface changes for hierarchy. Shadows belong only to floating overlays such as menus and drawers.
- Use one page container. Do not wrap every section in a card.
- Avoid gradients, glow, decorative illustrations, oversized metrics, and motion that does not explain state.

## Typography

- Headings: Geist through `--font-display`.
- Body and controls: Inter through `--font-body`.
- Weights: 400 and 500 only.
- Use sentence case. Do not use eyebrow text or all-caps labels.
- Default body size is 14px for dense work surfaces and 16px for forms, onboarding, and explanatory copy.
- Prefer the Arc type scale: 12, 14, 16, 18, 22, 28, 36, 52, and 72px.

## Layout and density

- Follow a 4px grid.
- Use 16px internal control/panel spacing, 24px between related regions, and 24–32px desktop page padding.
- Use 16px page padding on phones.
- Use Arc radii consistently: 18px controls, 26px panels, and 34px major surfaces.
- Use `sidebar-rail` as the initial application shell because the first release has one company and the component includes mobile navigation.
- Keep the primary content column readable; data tables and boards may use the available viewport width.
- Keep one clear primary action per surface.

## Information architecture

### Focused

Primary navigation contains My tasks, Projects, Inbox, and Search. The default landing page is My tasks. Project pages prefer the compact board or list. Advanced fields such as dependencies, recurrence, estimates, bulk actions, provenance diagnostics, and workspace-wide reporting stay behind progressive disclosure.

### Advanced

Advanced navigation adds workspace tasks, saved views, calendar, timeline, files, activity, and operational filters. Projects may use board, list, table, calendar, and timeline views. Advanced does not grant extra permission.

### Admin

Admin uses a separate route group and shell context with an explicit Return to workspace action. Its initial information architecture reserves People, Invitations, Teams, Roles, Integrations, Audit, and Settings. API clients arrive with the external API in phase 4, Agents with approved execution capabilities in phase 5, and Retention with production hardening in phase 6. Deferred destinations remain hidden until they have working behavior. Only authorized roles see or enter Admin.

## Arc composition map

| Surface               | Arc component                   | Product composition                                          |
| --------------------- | ------------------------------- | ------------------------------------------------------------ |
| Application shell     | `sidebar-rail`                  | Mode-aware navigation, global create action, user menu       |
| Page heading          | `page-header`                   | Title, compact context, one primary action                   |
| Focused task list     | `sortable-data-table`           | Completion, owner, due date, priority, filtered empty states |
| Focused project board | `project-board`                 | Fixed initial statuses and explicit accessible moves         |
| Advanced board        | `kanban-board`                  | Ordering, grouping, optional swimlanes, conflict recovery    |
| Task filters          | `filter-toolbar`                | Search, assignee, status, source, saved views                |
| Task detail           | `drawer`                        | Editable fields, comments, activity, provenance, run history |
| Conversation/history  | `comment-thread`, `timeline`    | Human discussion separate from immutable activity/audit      |
| Global actions        | `command-palette`               | Navigation and permitted actions only                        |
| People                | `team-members`, `invite-people` | Active, invited, deactivated, resend/revoke states           |
| Permissions           | `roles-permissions`             | Capability review; changes require explicit confirmation     |
| Connected systems     | `integrations`                  | Restaurant and future clients, scope, health, conflicts      |
| Advanced bulk editing | `data-grid`                     | Add only when real inline-editing needs justify it           |
| Agent execution       | `agent-run`                     | Phase 5 only: run state, approval, retry, human takeover     |

## Core interaction rules

- Selecting a task opens a URL-addressable detail drawer; closing it returns focus to the invoking row or card.
- Creating or editing work preserves the draft after validation, network, or version-conflict failure.
- Board moves are optimistic only when rollback is unambiguous. A conflict offers refresh and reapply.
- One visible accountable owner may be a human or enabled agent. Human collaborators are secondary.
- Assigning an agent never starts it. Starting a run is a separate, explicit action.
- Restaurant-created work shows concise provenance in Focused mode and full sync diagnostics in Advanced/Admin.
- Destructive and privilege-changing actions name the impact and require explicit confirmation.
- Success is shown in place. Do not interrupt routine work with success modals.

## State contract

Every data surface must have designed behavior for:

- initial loading and background refresh;
- true empty, filtered empty, and permission-limited empty;
- validation, denied, missing/deleted, network, server, rate-limit, and version-conflict errors;
- mutation success, optimistic rollback, and partial bulk failure;
- disabled actions with a visible reason;
- long names, descriptions, comments, and translated text;
- inactive members, disabled integrations, and unavailable agents.

Previously loaded content may remain read-only while offline. Do not promise offline synchronization. Preserve unsent form drafts locally, but never treat browser storage as the domain source of truth.

## Responsive and accessible behavior

- Verify at 390, 768, 1024, and 1440px; also check the 320px edge case.
- Use the shell's mobile navigation. Boards scroll horizontally with snap points; drawers become nearly full width.
- Keep interactive targets at least 44×44px where touch is expected.
- All actions must be keyboard reachable with Arc's visible `:focus-visible` treatment.
- Preserve logical DOM and focus order. Do not rely on color, hover, drag, or icons alone.
- Use accessible names for icon-only controls and announce asynchronous results appropriately.
- Respect `prefers-reduced-motion`; essential state changes must remain understandable without animation.

## Motion

Use short, restrained transitions only for drawers, menus, row insertion/removal, state changes, and board moves. Do not animate initial page content or use scroll-reveal effects. Reduced-motion mode removes spatial movement while preserving immediate state feedback.

## Content

- Use plain language and direct verbs: Create task, Invite people, Start run, Return to workspace.
- Distinguish Activity, which collaborators read, from Audit, which administrators inspect.
- State who or what performed an action: “Created by Restaurant system” or “Requested by Support agent.”
- Error messages explain what happened, what was preserved, and the next safe action.
- Avoid technical integration terminology in Focused mode unless it helps the person recover.

## UI-first implementation boundary

The UI is production code behind a small typed browser gateway. Its first implementation uses deterministic fixture data. The production implementation calls authenticated route handlers or server actions. Those server adapters call separate, server-only application services, and those services use PostgreSQL repositories. UI components never import fixtures, server application services, repositories, Auth0, or database types.

The first reviewable slice contains only:

1. the responsive `sidebar-rail` shell and Arc theme foundation;
2. Focused My tasks with loading, empty, error, and populated scenarios;
3. one complete task journey through the same browser gateway;
4. deterministic role/scenario switching available only in local development and tests.

Follow-up fixture-backed slices add the project board and task drawer, then Advanced views, then Admin. Interactive `agent-run` design remains in phase 5 after agent authority and approval rules are approved; earlier UI may show inert agent identity or provenance only.

Each slice is complete when its primary journeys pass keyboard, responsive, light/dark, reduced-motion, and automated accessibility checks without requiring the production backend.

## Forbidden patterns

- Raw color values or one-off visual tokens in product components.
- UI-only authorization or hiding as the only protection.
- Automatic agent execution on assignment.
- Nested cards, decorative shadows, gradients, glows, and layout-shifting hover effects.
- Emoji used as product icons; use the component's icon set consistently.
- Icon-only actions without accessible names or unfamiliar icons without labels/tooltips.
- Silent destructive actions, discarded drafts, or generic “Something went wrong” recovery.
- Horizontal page overflow on phones; only intentionally scrollable board/table regions may overflow.
