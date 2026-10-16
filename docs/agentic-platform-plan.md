# Gr8r agentic work platform rebuild plan

Status: Draft for product decisions  
Date: 2026-10-16  
Planning branch: `plan/agentic-platform`

## Outcome

Rebuild Gr8r Studio as a production task and project platform that:

- preserves the useful workflows and views in the current prototype;
- uses Arc UI components and blocks through the authenticated Arc MCP catalog;
- runs the web application and primary API on Vercel;
- signs people in with Google Workspace and supports invitations, user management, roles, and privileges;
- gives regular members a focused interface, power users advanced controls, and admins a dedicated control plane;
- lets people, agents, and external systems create and update centrally managed tasks;
- exposes a versioned REST API, signed webhooks, and an OAuth-protected remote MCP server;
- can add durable agent execution without coupling the task database to one agent runtime.

## What the current repository actually is

The current application is a high-fidelity browser prototype, not a production backend.

- Vite 6, plain JavaScript ES modules, and CSS; no React or runtime framework.
- All workspace data is seeded into one mutable browser object.
- Persistence is a single debounced `localStorage` value named `gr8r.v2`.
- Login, OAuth buttons, sessions, invitations, roles, permissions, uploads, and billing are simulated UI state.
- There is no database, server API, tenant isolation, real file storage, or authorization boundary.
- The current feature set is broad and worth preserving as a behavioral specification.
- There are no automated tests. The current lint, format check, and production build pass.

Therefore, “preserve the backend” means preserving domain behavior and product functionality while creating the real backend. The local-state implementation is not safe to retain for multiple users.

Important legal gates: the upstream repository currently has no detected `LICENSE` file or GitHub license metadata, and the new fork is public. Before implementation, confirm the owner's rights grant and Arc Pro's source-distribution terms. Do not push Arc Pro source into the public fork unless those terms explicitly permit it; otherwise continue development in a private derived repository while preserving upstream history and required notices.

## Recommended architecture

```text
People in browser ───────────────┐
Restaurant system ─ REST/webhook ├──> Vercel application
MCP clients ─ OAuth/MCP ─────────┘      ├── Authentication and policy
                                         ├── Task / Project services
                                         ├── Integration service
                                         ├── Agent service
                                         └── API adapters
                                                │
                       ┌────────────────────────┼───────────────────────┐
                       ▼                        ▼                       ▼
                PostgreSQL                 Blob storage          Durable outbox
              system of record             attachments          + webhooks
                       │
                       ▼
                  AgentRuntime
                       ├── VercelWorkflowRuntime (recommended first)
                       ├── PiHarnessRuntime (optional Vercel-managed spike)
                       └── PiDurableRuntime (optional external worker)
```

The UI, REST API, MCP server, restaurant connector, and agents must call the same application services. Authorization, validation, audit, idempotency, and business rules live there rather than in individual adapters.

## Recommended stack

| Concern         | Choice                                                                          | Reason                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Web application | Next.js App Router, React, TypeScript                                           | Arc is React-based; Next.js fits Vercel, server rendering, route handlers, and authenticated layouts.                       |
| UI system       | Arc foundation plus selected free and Pro components                            | Source-owned components, consistent tokens, responsive behavior, accessibility notes, and strong task/admin blocks.         |
| Authentication  | Better Auth with Google, organization, admin, JWT, MCP, and CIMD plugins        | Separates Google identity, workspace membership, platform administration, and MCP OAuth 2.1 authorization.                  |
| Database        | Managed PostgreSQL through a Vercel integration; Drizzle for schema and queries | Portable, relational, transaction-friendly, and appropriate for task relationships, authorization, audit, and integrations. |
| Files           | Vercel Blob or an S3-compatible store                                           | The current upload flow stores only fake metadata; production needs actual object storage and signed access.                |
| API             | Next.js route handlers backed by the application-service layer                  | Keeps web and integration behavior in one deployable application without making UI code the policy boundary.                |
| Background work | Vercel Workflows and `WorkflowAgent` behind `AgentRuntime`                      | Resumable, observable execution and durable approval on the requested hosting platform.                                     |
| Tests           | Vitest for domain/policy tests and Playwright for critical journeys             | The rewrite needs behavioral parity and authorization proof, not visual similarity alone.                                   |

Provider-specific code should stay behind small adapters so Postgres, object storage, email delivery, and agent execution can change without rewriting the product.

## Identity, roles, and interface modes

### Actor model

Use one auditable actor concept for anything that can create, change, comment on, or receive a task:

- `human` — linked to an authenticated user and workspace membership;
- `agent` — linked to an agent definition and scoped runtime credential;
- `integration` — linked to a service account, API key, or OAuth client.

Tasks should record `createdByActorId`; assignments should point to actors; activity and audit events should always record the actor. An agent must never impersonate a human session.

### Identity ownership and admin boundaries

Use one canonical record for each concept:

- Better Auth core owns users, Google accounts, and sessions.
- One Better Auth organization maps one-to-one to one application workspace. The organization plugin's members, invitations, teams, and organization roles are the canonical workspace membership records; do not create parallel membership tables.
- Application project memberships and policy rules narrow what a workspace member can do inside each project.
- Workspace Owner/Admin are organization roles. They manage their workspace but do not receive platform-wide authority.
- Better Auth's admin plugin is reserved for a separate platform-operator role that can manage user accounts and incidents across workspaces. It is not the implementation of workspace Admin.

The normal admin interface described below is workspace administration. Platform operations should live on a separately guarded route and remain invisible to ordinary workspace admins.

### Initial workspace roles

Use a small fixed role set first. Add custom roles only after actual permission needs are known.

| Role    | Intended scope                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------- |
| Owner   | Workspace ownership, owners, security, integrations, deletion, and every admin capability.                |
| Admin   | Members, teams, roles, agents, integrations, audit, and all project operations except ownership transfer. |
| Manager | Create and manage permitted projects, members of those projects, tasks, saved views, and reports.         |
| Member  | Work in joined projects; create and update allowed tasks, comments, and files.                            |
| Guest   | Access only explicitly shared projects or tasks with restricted mutation rights.                          |

Project membership can narrow workspace capabilities. Every permission check must run on the server. Hiding a button is not authorization.

### Interface modes

Permissions and interface complexity are separate concepts.

- **Focused mode**: My tasks, Today, a simple project board/list, task details, comments, completion, and create-task actions.
- **Advanced mode**: workspace-wide views, data grid, saved filters, bulk actions, timeline/calendar, reports, command palette, API access, and integration tools when permitted.
- **Admin control plane**: people, invitations, teams, roles, agents, API keys, webhooks, audit, retention, and workspace settings.

Store an `experienceMode` preference per membership. Default it from the role, allow an eligible user to switch modes, and keep the same authorization rules underneath both.

## Core data model

The schema should be multi-workspace capable even if the first deployment exposes only one workspace.

| Area        | Core records                                                                                                                  |
| ----------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Identity    | Better Auth user/account/session/organization/member/invitation/team; one-to-one workspace profile; project membership; actor |
| Work        | project, project membership, task, task assignment, dependency, label, comment, attachment, saved view                        |
| History     | activity event, security audit event, notification                                                                            |
| Integration | integration connection, service credential, external link, idempotency record, webhook subscription/delivery, outbox event    |
| Agents      | agent definition, agent grant, agent run, run event, approval request, runtime mapping                                        |

Recommended task fields include workspace/project IDs, stable public key, title, structured description, status, priority, start/due timestamps, estimate, recurrence rule, parent task, ordering token, version, archive timestamp, creator actor, source system, and external ID.

Use a task-assignment table even if the first UI shows one accountable owner. This avoids a future schema rewrite when collaborators or multiple agents are required. Use a version or ETag for optimistic concurrency so two boards cannot silently overwrite each other.

Do not preserve raw, unsanitized HTML descriptions from the prototype. Use sanitized Markdown or a structured editor document.

## REST API, webhooks, and MCP

### REST API

Start with a versioned `/api/v1` surface:

- projects: list, read, create, update, archive;
- tasks: list, read, create, update, assign, move, archive;
- comments and attachments;
- members and invitations for authorized admins;
- agent runs and approval decisions;
- webhook subscriptions and delivery inspection.

Requirements:

- scoped service credentials rather than shared user cookies;
- `Idempotency-Key` on writes from integrations and agents;
- stable error codes and an OpenAPI document;
- cursor pagination and explicit filtering;
- optimistic concurrency for mutations;
- signed webhooks with delivery records and retry handling;
- per-actor audit entries for every privileged or destructive operation.

### Remote MCP server

Expose a remote HTTP MCP endpoint over the same service layer. Initial tools should stay small:

- `list_projects`
- `list_tasks`
- `get_task`
- `create_task`
- `update_task`
- `assign_task`
- `add_comment`
- `start_agent_run`
- `get_agent_run`

Google sign-in establishes the person's identity; it is not by itself an MCP authorization server. Target MCP `2026-07-28` and use Better Auth's `mcp()`, `jwt()`, and `cimd()` plugins with the `mcp-2026-07-28` metadata profile:

- configure one canonical HTTPS MCP resource identifier and publish RFC 9728 protected-resource metadata plus authorization-server discovery;
- use authorization code with PKCE for user-delegated clients, Client ID Metadata Documents for registration, and enable Dynamic Client Registration only as an explicit legacy compatibility path;
- require the resource indicator in authorization and token requests so access tokens are audience-bound to this MCP server;
- validate signature, issuer, audience, expiry, and DPoP proof when a token is proof-of-possession bound;
- map OAuth scopes for project/task read, task/comment write, agent-run start, and integration administration to the same application permission service used by REST and UI;
- return scope-aware `WWW-Authenticate` challenges so clients can request only the access they need.

A valid token is only the outer authorization ceiling. Every tool call must still resolve the actor and workspace, then pass exactly the same project-level policy checks as the equivalent REST or UI action. Do not expose raw database, shell, or filesystem access to ordinary workplace agents. Pin and verify the Better Auth MCP packages at implementation time because the MCP authorization profile is evolving.

## Restaurant-system integration

The task platform should remain the source of truth.

1. Give the restaurant system a scoped integration actor restricted to its project(s).
2. It creates or upserts tasks through `/api/v1/tasks` using `sourceSystem`, `externalId`, and an idempotency key.
3. The task platform commits the task and an outbox event in one database transaction.
4. A short Vercel Function dispatcher, invoked after writes and by a scheduled Vercel Cron reconciliation, claims pending outbox rows with a transactional lease and publishes them to Vercel Queues using the outbox ID as the idempotency key. It never holds a database transaction open across the network call.
5. Queue consumers deliver signed webhooks, record each attempt, and rely on at-least-once retry. Consumers are idempotent; exhausted or permanently invalid deliveries move to an application-owned failed-delivery state for admin inspection and replay.
6. The restaurant Kanban either reads a filtered task endpoint directly or maintains a projection from those webhooks.
7. Status changes from the restaurant board return through the same API with the current version/ETag.
8. Origin and version metadata prevent webhook echo loops and lost updates. Expired dispatcher leases and unpublished rows are reclaimed by reconciliation.

This keeps tasks centrally managed while allowing the restaurant product to show a purpose-built local board.

## Arc component plan

The Arc MCP server was authenticated with the user's Pro account. A fresh read-only Codex session called Arc's `list_components`, `search_components`, and `get_component` MCP tools to validate these items.

| Surface                            | Arc item                     | Tier |
| ---------------------------------- | ---------------------------- | ---- |
| Simple member header               | `page-header`                | Free |
| Simple task list                   | `sortable-data-table`        | Free |
| Task filters                       | `filter-toolbar`             | Free |
| Power-user navigation              | `workspace-sidebar`          | Pro  |
| Compact board                      | `project-board`              | Pro  |
| Advanced Kanban                    | `kanban-board`               | Pro  |
| Advanced inline task table         | `data-grid`                  | Pro  |
| Task details                       | `drawer`                     | Free |
| Discussion and history             | `comment-thread`, `timeline` | Free |
| Global navigation/actions          | `command-palette`            | Free |
| Google entry screen                | `sign-in`                    | Free |
| Members and invitations            | `team-members`               | Pro  |
| Roles and permission review        | `roles-permissions`          | Pro  |
| Connected systems                  | `integrations`               | Pro  |
| Admin settings search              | `settings-command`           | Pro  |
| Developer credentials              | `api-keys`, `webhooks`       | Pro  |
| Live agent execution and approvals | `agent-run`                  | Pro  |

Arc supplies presentation and interaction behavior, not application security or persistence. Task details, assignee selection, role-aware navigation, and project-specific workflows still require product composition around the Arc primitives.

Install Pro components through the token-gated Arc registry only. The registry token is a development or CI installation secret, not an application runtime secret; do not add it to the deployed Vercel environment unless a reviewed build step actually fetches registry source. Preserve Arc's copyright/license notices, and do not apply any repository-wide open-source license to Arc Pro files. Because this fork is public, the legal gate above must be resolved before any Pro source is committed.

### Arc migration method

This is a React rebuild, not a CSS reskin of the current plain-JavaScript application. Apply Arc one behavior pattern at a time:

1. Inventory each existing screen's behavior, states, keyboard actions, and responsive rules, then map it to an Arc block or an explicitly custom composition.
2. Establish Arc foundation first: registry configuration, foundation CSS imported once, Geist or Inter, semantic color/spacing/radius tokens, and light/dark theme attributes.
3. Migrate in slices: application shell, task list and filters, board, task drawer, then admin and agent surfaces. Replace each Arc demo data source with the shared application services.
4. After each slice, prove functional parity plus keyboard access, focus behavior, mobile layout, loading/empty/error states, dark mode, and reduced motion.
5. Remove the corresponding legacy JavaScript and CSS only after that slice passes. Finish with Arc's implementation checklist and repository-wide accessibility tests.

Keep typography and color token-driven, use sentence case and ordinary 400/500 weights, and avoid one-off visual values that make future Arc updates difficult.

## `pi-durable` assessment

`@earendil-works/pi-durable` is useful as a future agent-execution kernel, not as this platform's task backend.

It provides crash-resumable conversations, committed progress, durable tool calls, child tasks/subagents, cancellation, idempotent submissions, task graphs, and usage/cost records. It does not provide Google login, organizations, RBAC, tenant isolation, projects, human tasks, Kanban fields, assignment, a REST API, an MCP server, or restaurant synchronization.

Do not instantiate a Pi Harness inside Vercel request handlers:

- its built-in persistent stores are local SQLite/JSONL or Cloudflare Durable Object SQLite;
- its documented ownership model is one process per storage with no cross-process locking;
- Vercel functions are ephemeral and can scale across instances;
- the package is explicitly experimental and is changing quickly;
- durable wake-up, persisted human approval, and permanent deletion have relevant open issues.

Recommended boundary:

```ts
interface AgentRuntime {
  startRun(input: StartRunInput): Promise<RunHandle>;
  sendInput(runId: string, input: RunInput): Promise<void>;
  cancelRun(runId: string): Promise<void>;
  getRun(runId: string): Promise<RunState>;
  watchRun(runId: string): AsyncIterable<RunEvent>;
}
```

Implement `VercelWorkflowRuntime` first if every production component must stay on Vercel. Vercel's `WorkflowAgent` already supports durable tool steps, resumable streams, and approvals that can suspend beyond a function request, which matches this product's first agent use cases.

Vercel also documents managed Pi harness paths: Workflow SDK's `durable-harness` and AI SDK's experimental `HarnessAgent` Pi adapter. Evaluate those behind `PiHarnessRuntime` if Pi's richer harness features are needed while remaining on Vercel. This is a different integration from embedding `@earendil-works/pi-durable` in a route handler, and the harness packages are currently experimental.

Add `PiDurableRuntime` only after a deployment spike, normally in a separate single-owner worker or Cloudflare Durable Object service. Pi-specific IDs belong only in an internal runtime-mapping table.

Before adopting Pi, prove hard-kill recovery, exactly-once domain effects under duplicate submissions, serialized ownership, tenant isolation, cancellation, reconnect, approval behavior, version upgrades, and retention/deletion. Reject the integration if Pi types leak into the product domain.

## Existing functionality to preserve

The rebuild should retain these product capabilities, delivered in tested slices:

- home dashboard, inbox, notifications, favorites, search, and My tasks;
- workspace overview, projects, members, teams, activity, settings, and archive;
- project overview, board, list, table, calendar, timeline, files, and activity views;
- task creation/editing, drag-and-drop moves, comments, subtasks, dependencies, labels, estimates, recurrence, attachments, and favorites;
- project templates, saved views, filters, sorting, grouping, command palette, keyboard flows, responsive states, loading/empty/error states, and reduced motion.

Some implementation details must change for multi-user correctness: embedded subtasks, floating-number ordering, synchronous global mutations, client-generated IDs, fake attachments, raw HTML, and client-only permission checks.

## Delivery sequence and proof

### 0. Decisions and legal gate

- Confirm source-code rights.
- Confirm Arc Pro redistribution terms and choose a permitted repository visibility before installing Pro source.
- Resolve the product questions below.
- Record the accepted role/capability matrix and integration boundary.

Proof: decisions are documented and no unresolved choice changes the data or deployment architecture.

### 1. Characterization and foundation

- Tag the existing prototype state.
- Add Playwright journeys for critical existing behavior.
- Establish the Next.js/TypeScript application and Arc foundation.
- Add PostgreSQL migrations, Better Auth, workspace scoping, and policy tests.
- Create the shared application-service interfaces used by UI, REST, and MCP.

Proof: baseline journeys run against the prototype; Google-domain login and cross-workspace isolation tests pass in the new foundation.

### 2. Production vertical slice

- Workspace onboarding and invited Google sign-in.
- Member/admin management.
- Project and task CRUD.
- Focused task list, Kanban, task drawer, comments, assignments, and activity.
- A scoped restaurant integration actor and first idempotent task-create endpoint, exercised from an external-client fixture.
- Server-enforced roles, audit events, and real persistence.

Proof: two users with different roles see and can mutate only authorized data; refresh and concurrent sessions retain consistent task state; repeated delivery of one restaurant request produces exactly one canonical task visible in the focused UI.

### 3. Functional parity and advanced UI

- Dashboard, inbox/notifications, search, saved views, bulk actions.
- Table, calendar, timeline, files, dependencies, recurrence, archive, and project templates.
- Focused/advanced mode switching, accessibility, responsive behavior, and keyboard flows.

Proof: the agreed parity checklist passes end-to-end with production data, loading, error, and empty states.

### 4. Admin, integrations, REST, and MCP

- Admin control plane using Arc's member, role, integration, API-key, and webhook blocks.
- OpenAPI-backed REST endpoints, scoped service accounts, webhook outbox/deliveries.
- Complete the restaurant connector, outbox/queue dispatcher, signed webhooks, delivery inspection, and central Kanban projection.
- OAuth-protected remote MCP server using the same authorized services.

Proof: the restaurant projection converges after retries without echo loops; authorized REST and MCP calls have identical outcomes; unauthorized calls are denied and audited.

### 5. Agents and durable execution

- Agent definitions, grants, assignments, run history, progress, outputs, and approval records.
- `AgentRuntime` with Vercel Workflows and `WorkflowAgent` first.
- Arc `agent-run` UI for progress and approval.
- Optional Vercel-managed Pi harness spike; use an isolated external Pi Durable adapter only if its specific semantics are required.

Proof: assigning a task to an agent creates an auditable run, survives a forced interruption, pauses at required approvals, and cannot exceed its task/project scopes.

### 6. Hardening and cutover

- Rate limits, secret rotation, retention/deletion, backups and restore test, observability, performance, and security review.
- Production Vercel environments, database/storage regions, custom domain, and rollback procedure.
- Data import only if real browser-local data must be retained.

Proof: production checklist, restore drill, authorization test suite, accessibility checks, and rollback rehearsal pass before cutover.

## Main risks and controls

| Risk                                            | Control                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Upstream has no detected license                | Obtain written permission or a license before implementation and commercial deployment.                                  |
| Public fork could redistribute Arc Pro source   | Confirm Arc terms first or move implementation to a private derived repository; preserve notices and license boundaries. |
| Rewrite loses subtle behavior                   | Characterization journeys and an explicit parity checklist before deleting legacy code.                                  |
| UI-only role checks expose data                 | Central policy service, workspace-scoped queries, and negative authorization tests.                                      |
| Board moves conflict                            | Transactional ordering plus optimistic concurrency.                                                                      |
| External systems create duplicates or loops     | Idempotency records, external mapping, transactional outbox, origin/version metadata.                                    |
| Rich text introduces XSS                        | Sanitized Markdown or a structured document format.                                                                      |
| Arc Pro token leaks                             | Development/CI secret only; never commit it or expose it to the deployed runtime by default.                             |
| Agent runtime becomes infrastructure lock-in    | Small `AgentRuntime` port and product-owned run/approval records.                                                        |
| Pi lifecycle gaps affect privacy or reliability | Keep it optional, external, exact-version pinned, and gated by the spike criteria.                                       |
| Vercel Queues remains beta or MCP auth changes  | Pin verified versions behind adapters and keep provider replacement paths.                                               |

## Product decisions required

Recommended defaults are included so implementation can start quickly.

1. **Code rights and visibility** — Do you own `gr8rstudio/gr8r-studio`, or have permission for commercial modification and deployment? May Arc Pro source be stored in a public repository? If not, the implementation must move from the public fork to a private derived repository. These are hard gates before implementation.
2. **Google access policy** — Which Workspace domain(s) are allowed? Recommended: invitation required **and** a matching verified Workspace domain; no public signup.
3. **Directory management** — Is app-owned invitation/user management enough, or must Google Admin directory/groups auto-provision and deactivate users? Recommended: app-owned users first; directory sync later.
4. **Tenancy** — Is this only for one company, or will clients/restaurants receive separate workspaces? Recommended: multi-workspace schema with a single-workspace first UI.
5. **Assignments** — Should a task have one accountable owner, multiple assignees, or owner plus collaborators? Recommended: one visible owner plus optional collaborators, backed by a flexible assignment table.
6. **Restaurant integration** — What is its stack, where is it hosted, and can its Kanban read the central API directly? Recommended: this platform is canonical; the restaurant board is a filtered client/projection.
7. **Hosting boundary** — Must every backend component run on Vercel, or is a separate agent worker acceptable? Recommended: all-Vercel first with `WorkflowAgent`; test Vercel's managed Pi harness path before considering a separate Pi Durable worker.
8. **Agent authority** — Which first real tasks should an agent perform, and which actions require human approval? Recommended: begin with create/update/comment/draft operations; require approval for reassignment, deletion, external messages, and privileged changes.
9. **Compliance and region** — Are EU data residency, GDPR deletion, retention periods, or audit retention requirements mandatory? This determines providers and the Pi decision.
10. **Existing data** — Is any current browser-local prototype data valuable? Recommended: treat it as demo data unless a real export must be migrated.

After these decisions, the first implementation pull request should contain the tested Next.js/Arc foundation, production auth/schema skeleton, and one end-to-end project/task vertical slice rather than a visual-only rewrite.

## Primary references

- Arc AI/MCP and Pro access: <https://uiarc.dev/docs/ai>
- Better Auth Google Workspace restriction: <https://better-auth.com/docs/authentication/google>
- Better Auth organization plugin: <https://better-auth.com/docs/plugins/organization>
- Better Auth admin plugin: <https://better-auth.com/docs/plugins/admin>
- Better Auth MCP and CIMD plugins: <https://better-auth.com/docs/plugins/mcp>
- Next.js route handlers: <https://nextjs.org/docs/app/getting-started/route-handlers>
- Vercel Workflows: <https://vercel.com/docs/workflows>
- Vercel Queues: <https://vercel.com/docs/queues>
- Vercel `WorkflowAgent`: <https://vercel.com/kb/guide/what-is-workflowagent>
- Vercel AI SDK harnesses, including Pi: <https://vercel.com/changelog/program-agent-harnesses-with-ai-sdk>
- MCP `2026-07-28` authorization specification: <https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization>
- Pi durable package: <https://github.com/earendil-works/pi/tree/main/packages/durable>
