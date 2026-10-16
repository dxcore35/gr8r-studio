# Gr8r agentic work platform rebuild plan

- Status: Working Google Cloud architecture baseline; Workspace domain is a production placeholder; agent authority pending
- Date: 2026-10-16
- Planning branch: `plan/agentic-platform`

## Outcome

Rebuild Gr8r Studio as a production task and project platform that:

- preserves the useful workflows and views in the current prototype;
- uses Arc UI components and blocks through the authenticated Arc MCP catalog;
- runs the web application, REST API, and remote MCP endpoint on Google Cloud Run;
- signs people in with Google Workspace and supports invitations, user management, roles, and privileges;
- gives regular members a focused interface, power users advanced controls, and admins a dedicated control plane;
- lets people, agents, and external systems create and update centrally managed tasks;
- exposes a versioned REST API and an OAuth-protected remote MCP server, with webhooks deferred until a real push-integration need exists;
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

Decision recorded 2026-10-16: the owner confirmed the required rights to modify and deploy the upstream source and to use Arc Pro in this repository. Preserve all required upstream and Arc notices and keep the Arc registry credential out of source control.

## Recommended architecture

```text
People in browser ───────────────┐
Restaurant system ─ REST API ────┼──> HTTPS load balancer + Cloud Armor
MCP clients ─ OAuth/MCP ─────────┘                   │
                                                     ▼
                                            gr8r-app on Cloud Run
                                             ├── Auth0 boundary
                                             ├── Task / Project services
                                             ├── Integration service
                                             ├── REST and MCP adapters
                                             └── Admin control plane
                                                     │
                         ┌───────────────────────────┼──────────────────────┐
                         ▼                           ▼                      ▼
              Cloud SQL for PostgreSQL       Cloud Storage          Secret Manager
                 system of record              attachments           scoped secrets
                         │
                         ▼
                    AgentRuntime (phase 5 only)
                         ├── GoogleCloudAgentRuntime
                         │    └── smallest required managed orchestrator/worker
                         └── PiDurableRuntime
                              └── optional private single-owner Compute Engine worker
```

The browser UI reaches server application services only through authenticated route handlers or server actions. REST, MCP, restaurant, and agent adapters call those same server-only services. Authorization, validation, audit, idempotency, and business rules live there rather than in the browser, transport adapters, or repositories.

## Recommended stack

| Concern         | Choice                                                                                          | Reason                                                                                                                     |
| --------------- | ----------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Web application | Next.js App Router, React, TypeScript, standalone container on Cloud Run                        | Arc is React-based; Cloud Run provides managed revisions and scaling without maintaining a VM.                             |
| UI system       | Arc foundation plus selected free and Pro components                                            | Source-owned components, consistent tokens, responsive behavior, accessibility notes, and strong task/admin blocks.        |
| Authentication  | Auth0 with Google Workspace, Organizations, Directory Sync, RBAC, and Auth for MCP              | Managed employee identity, organization membership, user administration, API authorization, and MCP OAuth in one provider. |
| Database        | Cloud SQL for PostgreSQL with Drizzle                                                           | Relational transactions fit task relationships, tenant integrity, authorization, audit, and integrations.                  |
| Files           | Private Cloud Storage with signed upload/download URLs                                          | Production attachments need durable object storage while the application remains the authorization boundary.               |
| API             | Next.js route handlers on Cloud Run backed by the application-service layer                     | UI, REST, and MCP reuse one policy and domain implementation without turning UI code into a security boundary.             |
| Async work      | Cloud Tasks for bounded retryable commands; Workflows and private Cloud Run workers when needed | Both delivery systems can retry, so domain writes remain transactionally idempotent.                                       |
| Agent execution | Product-owned `AgentRuntime`; Google Cloud implementation only after agent authority is agreed  | Keeps task data and approvals independent from one agent framework and avoids prematurely selecting a runtime.             |
| Platform        | Load Balancer, Cloud Armor, Secret Manager, Artifact Registry, Cloud Build, Logging/Monitoring  | Provides managed ingress, secrets, immutable images, delivery, and operations without a general-purpose application VM.    |
| Infrastructure  | Terraform with parameterized project and region                                                 | Reproducible environments without making the unknown production project or region an implementation blocker.               |
| Tests           | Vitest for domain/policy tests and Playwright for critical journeys                             | The rewrite needs behavioral parity and authorization proof, not visual similarity alone.                                  |

Provider-specific code should stay behind small adapters so identity administration, Postgres, object storage, email delivery, and agent execution can change without rewriting the product. Token verification remains a mandatory request-boundary concern rather than a swappable business rule. Protected workspace data is dynamic and uncached initially; Cloud Run instance files, memory, sessions, and framework caches are never authoritative.

## Identity, roles, and interface modes

### Actor model

Use one auditable actor concept for anything that can create, change, comment on, or receive a task:

- `human` — linked to an authenticated user and workspace membership;
- `agent` — linked to an agent definition and scoped runtime credential;
- `integration` — linked to an Auth0 machine-to-machine client or another approved OAuth client.

Tasks should record `createdByActorId`; assignments should point to actors; activity and audit events should always record the actor. An agent must never impersonate a human session.

### Identity ownership and admin boundaries

Use one canonical record for each concept:

- Auth0 owns identities, login, sessions/tokens, organization membership, invitations, and organization-role assignments and is authoritative for human workspace roles. The Next.js Auth0 SDK handles the application's server-side session.
- Configure the Google Workspace connection to use Google's stable identity ID rather than email for the Auth0 user ID. Persist the Auth0 `sub` as the external identity key; email is a mutable profile attribute, never a foreign key.
- One Auth0 Organization maps one-to-one to one application workspace. The first release creates one company organization and hides workspace switching, while every domain record remains workspace-scoped so more companies can be added without a schema rewrite.
- The Auth0 tenant, application, API, and first Organization can be created before the real domain is known. Keep `GOOGLE_WORKSPACE_DOMAIN` unset until supplied, never invent a placeholder domain, and disable public signup. Once supplied, configure and prove the Google Workspace enterprise connection plus Directory Sync in staging before production cutover.
- Auth0 Google Workspace Directory Sync imports employee profiles and selected groups. Disable Membership on Authentication: a synchronized identity is not automatically authorized, and access still requires organization membership or an invitation.
- Map only dedicated Google group IDs to application roles; never infer application authority from Google Workspace Super Admin or another built-in administrator role. Because native Auth0 organization-group role inheritance requires automatic membership, the invitation-only model instead reconciles reviewed group mappings only for existing Organization members. Urgent revocation is applied directly rather than waiting for directory synchronization.
- Application project memberships and policy rules narrow what a workspace member can do inside each project.
- Workspace Owner/Admin are Auth0 organization-member roles with Auth0 API permissions. They manage their workspace but do not receive platform-wide authority.
- A dedicated tenant-level Auth0 role grants platform-operator access and is limited to the small set of accounts that can manage cross-workspace incidents. Platform routes require a non-organization admin session and verify the subject's tenant-level role server-side through the Auth0 Management API, with short-lived caching only if needed; organization role claims never satisfy this check.

The normal admin interface described below is workspace administration. Its server routes derive the target Auth0 Organization from the validated session, then call the Auth0 Management API with a least-privileged machine credential. They never trust an arbitrary organization ID from the browser, and the Management API credential is never sent to the browser. Platform operations live on a separately guarded route and remain invisible to ordinary workspace admins.

### Security planes

Keep four permission systems explicit and non-interchangeable:

1. **Google Workspace** proves employee identity and supplies selected directory groups.
2. **Auth0** owns application login, workspace membership, workspace roles, user-delegated OAuth, and machine clients.
3. **Application policy in PostgreSQL** owns project membership, task visibility, resource grants, and actor capabilities.
4. **Google Cloud IAM** controls deployment and workload access to Cloud Run, Cloud SQL, Storage, Secret Manager, and operations; it never grants task-platform access.

Each Cloud Run service or job receives a distinct least-privileged service account. Private worker calls use Google-signed workload identity, while browser, REST, and MCP requests use Auth0 and still pass application policy. Infrastructure deployers use short-lived Workload Identity Federation credentials; do not create long-lived service-account JSON keys or reuse a deployer identity at runtime.

### Initial workspace roles

Use a small fixed role set first. Add custom roles only after actual permission needs are known.

| Role    | Intended scope                                                                                            |
| ------- | --------------------------------------------------------------------------------------------------------- |
| Owner   | Workspace ownership, owners, security, integrations, deletion, and every admin capability.                |
| Admin   | Members, teams, roles, agents, integrations, audit, and all project operations except ownership transfer. |
| Manager | Create and manage permitted projects, members of those projects, tasks, saved views, and reports.         |
| Member  | Work in joined projects; create and update allowed tasks, comments, and files.                            |
| Guest   | Access only explicitly joined projects with restricted mutation rights.                                   |

Project membership can narrow workspace capabilities. Every permission check must run on the server. Hiding a button is not authorization.

### Interface modes

Permissions and interface complexity are separate concepts.

- **Focused mode**: My tasks, Today, a simple project board/list, task details, comments, completion, and create-task actions.
- **Advanced mode**: workspace-wide views, data grid, saved filters, bulk actions, timeline/calendar, reports, command palette, API access, and integration tools when permitted.
- **Admin control plane**: people, invitations, teams, roles, agents, API clients, audit, retention, and workspace settings.

Store an `experienceMode` preference per membership. Default it from the role, allow an eligible user to switch modes, and keep the same authorization rules underneath both.

Members and Guests default to Focused; Managers, Admins, and Owners default to Advanced. Focused mode hides complexity but does not create a weaker authorization path. An authorized deep link may open an advanced surface without silently changing the saved preference. Admin lives under a separate `/admin` route group with an explicit return to the workspace; mode selection never grants admin access. If a role change makes a stored mode unavailable, fall back to the highest permitted mode and explain the change.

### Onboarding and membership lifecycle

Use three explicit entry paths:

- **Bootstrap Owner** configures the first workspace, first project/template, and optional invitations.
- **Invited member** accepts a specific Organization invitation, confirms minimal preferences, and lands in the intended project or My Tasks.
- **Returning member** bypasses onboarding.

Invitation states are pending, accepted, expired, revoked, or failed. Resend and bulk invitation operations report per-recipient results. Pending invitees cannot receive assignments. Removing a member deactivates the membership and actor rather than erasing history; open accountable assignments and project ownership become explicit reassignment work for an Admin or Owner.

## Core data model

The schema should be multi-workspace capable even if the first deployment exposes only one workspace.

| Area        | Core records                                                                                                          |
| ----------- | --------------------------------------------------------------------------------------------------------------------- |
| Identity    | identity, workspace, workspace membership, actor, project membership, Auth0 organization/role references              |
| Work        | project, project health, task, task assignment, recurrence series, dependency, label, comment, attachment, saved view |
| History     | activity event, append-only security audit event, notification, monotonic workspace change event                      |
| Integration | Auth0 machine-client mapping, integration connection, external link, idempotency record, synchronization cursor       |
| Agents      | agent definition, agent grant, agent run, run event, approval request, command, runtime mapping                       |

Separate global identity from company participation. `identity` stores the immutable Auth0 `sub`; `workspaceMembership` is unique by `(workspaceId, identityId)` and stores local status, experience preference, and an optional non-authoritative role projection for display; the workspace-local human `actor` links to that membership. Human authorization requires both valid Auth0 Organization membership/role claims and an active local membership, and either side may deny. Group reconciliation changes Auth0 Organization roles; a local projection or cache can never elevate authority. Deactivate memberships and actors instead of deleting them so history remains attributable when one person leaves or later joins another workspace.

Store one unique `auth0OrganizationId` on the workspace. Every project-owned record carries `workspaceId`, and composite foreign keys/checks prevent cross-workspace parents, dependencies, assignments, comments, attachments, external links, runs, or approvals. UI, REST, MCP, and integration adapters derive the workspace from the validated session/token/client mapping and resolve resource IDs inside it; a caller-supplied workspace ID never establishes authority.

Recommended task fields include workspace/project IDs, immutable public key, title, structured description, fixed initial status, priority, start/due timestamps, estimate, recurrence-series reference, parent task, lane-scoped ordering token, version, archive timestamp, and creator actor. Keep external identifiers in `externalLink`, unique by workspace, integration connection, entity type, and external ID, rather than duplicating them on tasks.

The first release uses the prototype's fixed task workflow and treats dependencies as advisory warnings. Project lifecycle and project health are separate: for example, Completed or Archived are lifecycle states while At Risk is health. Archive is recoverable; permanent deletion is an explicit privileged retention operation. Recurring occurrences share a series identity so completion, edits, and retries cannot generate duplicates.

Use a task-assignment table with one optional `accountable` owner, human or enabled agent, plus optional human `collaborator` rows. Only active project members are assignable as humans; adding a person to a project is a separate authorized action. Integration actors provide provenance and are not assignees. Assignment grants neither project access nor agent execution permission, and assigning an agent never silently starts a run.

Use a version/ETag for optimistic concurrency so two boards cannot silently overwrite each other. A board move updates status, lane order, version, activity, audit, and any integration-visible change event in one transaction. Every relevant create, update, archive, delete, or visibility change commits its monotonic change event or tombstone atomically with the canonical mutation. Activity is collaborator-readable product history; security audit is immutable administrative evidence written atomically with the mutation and includes actor/principal snapshot, channel, outcome, target, correlation ID, and integration or run context.

Do not preserve raw, unsanitized HTML descriptions from the prototype. Use sanitized Markdown or a structured editor document.

## REST API and MCP

### REST API

Start with a versioned `/api/v1` surface:

- projects: list, read, create, update, archive;
- tasks: list, read, create, update, assign, move, archive;
- comments and attachments;
- members and invitations for authorized admins;
- a scoped monotonic change feed for approved integrations;
- agent runs and approval decisions once agent capabilities are approved.

Requirements:

- Auth0 machine-to-machine clients with narrow API scopes rather than shared user cookies or application-owned passwords;
- `Idempotency-Key` on writes from integrations and agents, scoped by actor/client and operation. Store the request fingerprint and result in the same transaction as the mutation; reuse with a different payload returns a conflict;
- stable error codes and an OpenAPI document;
- cursor pagination and explicit filtering;
- ETags on reads and mandatory `If-Match` on update, assign, move, and archive, with distinct missing-precondition and stale-version errors;
- per-actor audit entries for every privileged or destructive operation.

An integration create may bind a new `externalLink`; an existing mapping is changed only by an explicit patch with the current version. “Upsert” must never overwrite canonical human edits implicitly. Operations that outlive an HTTP request return a durable operation or run ID instead of depending on an open Cloud Run connection.

### Remote MCP server

Expose a remote HTTP MCP endpoint over the same service layer. Initial tools should stay small:

- `list_projects`
- `list_tasks`
- `get_task`
- `create_task`
- `update_task`
- `assign_task`
- `add_comment`

Agent-run tools remain disabled until the owner approves concrete agent capabilities and approval rules.

Target MCP `2026-07-28` and use Auth0 Auth for MCP as the OAuth authorization server while the Cloud Run MCP route remains the protected resource server:

- register the canonical HTTPS MCP URL as an Auth0 API/resource identifier, enable the Resource Parameter Compatibility Profile and Include Issuer in Authorization Responses, and use Auth0's RFC 9068 authorization access-token profile;
- publish RFC 9728 protected-resource metadata from the MCP server and Auth0 authorization-server discovery from the configured Auth0 domain;
- use authorization code with PKCE for user-delegated clients, enable Auth0's Client ID Metadata Document Registration tenant setting, and approve each Client ID Metadata Document client administratively; keep open Dynamic Client Registration disabled unless a specific legacy client requires it;
- promote the Google Workspace connection to domain level for approved third-party MCP clients, grant those clients the task API explicitly, and permit them for the company Organization;
- require the resource indicator so access tokens are audience-bound to this MCP server, and reject tokens without the expected Auth0 issuer, audience, expiry, organization context, and permissions;
- enable Auth0 RBAC and include permissions in access tokens;
- map OAuth scopes for project/task read, task/comment write, and integration administration to the same application permission service used by REST and UI;
- return scope-aware `WWW-Authenticate` challenges so clients can request only the access they need.

A valid Auth0 token is only the outer authorization ceiling. Every tool call must still resolve the actor and workspace, then pass exactly the same project-level policy checks as the equivalent REST or UI action. Every MCP mutation carries an idempotency key; mutations of an existing versioned entity also carry `expectedVersion` and return the new version. Do not expose raw database, shell, or filesystem access to ordinary workplace agents.

## Restaurant-system integration

The task platform should remain the source of truth.

1. Give the restaurant system a scoped integration actor restricted to its project(s).
2. Represent it as an Auth0 machine-to-machine application. Map its Auth0 client ID to the integration actor and allowed projects in the application database; Auth0 scopes are a ceiling, not the project authorization rule.
3. It creates tasks through `/api/v1/tasks` with an idempotency key and binds its ID through the canonical `externalLink`. Updates to an existing mapping are explicit versioned patches, not blind upserts.
4. Its Kanban reads canonical tasks directly through a filtered endpoint. Incremental synchronization uses a monotonic workspace change-event cursor bound to that integration's filter and scope, and returns archive, deletion, and access-loss tombstones so removed cards converge correctly.
5. Status changes return through the same API with the current version/ETag so stale clients receive an explicit conflict instead of overwriting newer work. The integration contract defines status mapping and field authority before implementation.
6. Every request records the integration actor, external link, correlation ID, activity where useful, and immutable audit event.

This direct API model keeps tasks centrally managed and is the selected first implementation. Task details expose concise “Created by Restaurant system” provenance; Advanced/Admin views also expose source filters, external link, last accepted change, and conflicts. Disabling the integration never deletes its tasks. Add signed webhooks and an outbox only if a future integration demonstrates a real push-delivery requirement.

## Arc component plan

The Arc MCP server was authenticated with the user's Pro account. A fresh read-only Codex session called Arc's `list_components`, `search_components`, and `get_component` MCP tools to validate these items.

| Surface                            | Arc item                     | Tier |
| ---------------------------------- | ---------------------------- | ---- |
| Simple member header               | `page-header`                | Free |
| Simple task list                   | `sortable-data-table`        | Free |
| Task filters                       | `filter-toolbar`             | Free |
| Initial application navigation     | `sidebar-rail`               | Pro  |
| Future multi-workspace navigation  | `workspace-sidebar`          | Pro  |
| Compact board                      | `project-board`              | Pro  |
| Advanced Kanban                    | `kanban-board`               | Pro  |
| Advanced inline task table         | `data-grid`                  | Pro  |
| Task details                       | `drawer`                     | Free |
| Discussion and history             | `comment-thread`, `timeline` | Free |
| Global navigation/actions          | `command-palette`            | Free |
| Auth0 entry launcher               | `sign-in`                    | Free |
| Members                            | `team-members`               | Pro  |
| Bulk invitations                   | `invite-people`              | Pro  |
| Roles and permission review        | `roles-permissions`          | Pro  |
| Connected systems and API clients  | `integrations`               | Pro  |
| Admin settings search              | `settings-command`           | Pro  |
| Live agent execution and approvals | `agent-run`                  | Pro  |

Arc supplies presentation and interaction behavior, not application security or persistence. Task details, assignee selection, role-aware navigation, and project-specific workflows still require product composition around the Arc primitives.

Use Arc's `sign-in` block only as the branded “Continue with Google Workspace” launcher into Auth0 Universal Login. Do not collect Google credentials or implement a second local login flow in the application.

Install Pro components through the token-gated Arc registry only. The registry token is a development or CI installation secret, not an application runtime secret; do not add it to the deployed Google Cloud runtime unless a reviewed build step actually fetches registry source. Preserve Arc's copyright/license notices and the rights record noted above.

### Arc migration method

This is a React rebuild, not a CSS reskin of the current plain-JavaScript application. Apply Arc one behavior pattern at a time:

1. Inventory each existing screen's behavior, states, keyboard actions, and responsive rules, then map it to an Arc block or an explicitly custom composition.
2. Establish Arc foundation first: registry configuration, foundation CSS imported once, Geist headings, Inter body text, semantic color/spacing/radius tokens, and light/dark theme attributes.
3. Migrate in slices: application shell and one Focused task journey, board and task drawer, Advanced views, then Admin. Replace each Arc demo data source with the typed browser gateway; defer interactive agent surfaces until phase 5.
4. After each slice, prove functional parity plus keyboard access, focus behavior, mobile layout, loading/empty/error states, dark mode, and reduced motion.
5. Remove the corresponding legacy JavaScript and CSS only after that slice passes. Finish with Arc's implementation checklist and repository-wide accessibility tests.

Keep typography and color token-driven, use sentence case and ordinary 400/500 weights, and avoid one-off visual values that make future Arc updates difficult.

### Product state and recovery contract

Every primary surface must distinguish true empty, filtered empty, and permission-limited empty states; initial load from background refresh; partial widget failure from whole-page failure; and validation, denied, missing, rate-limited, network, server, and version-conflict errors. Failed writes preserve drafts and offer refresh/reapply rather than discarding local work. Bulk operations report partial failures per item.

Do not promise offline synchronization in the first release. Previously loaded read-only content may remain visible, but writes are disabled with an explanation and unsent form drafts stay local until connectivity returns.

## `pi-durable` assessment

`@earendil-works/pi-durable` is useful as a future agent-execution kernel, not as this platform's task backend.

It provides crash-resumable conversations, committed progress, durable tool calls, child tasks/subagents, cancellation, idempotent submissions, task graphs, and usage/cost records. It does not provide Google login, organizations, RBAC, tenant isolation, projects, human tasks, Kanban fields, assignment, a REST API, an MCP server, or restaurant synchronization.

Do not instantiate a Pi Harness inside Cloud Run request handlers or assume a Cloud Run Job makes its local storage durable:

- its built-in persistent stores are local SQLite/JSONL or Cloudflare Durable Object SQLite;
- its documented ownership model is one process per storage with no cross-process locking;
- Cloud Run instances and local files are replaceable, revisions can overlap, and Jobs exit after bounded work;
- Pi has no built-in PostgreSQL storage adapter or distributed owner lease;
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

Do not add an agent-runtime dependency before phase 5. The first managed option is `GoogleCloudAgentRuntime`: authoritative run, command, grant, approval, and event records stay in Cloud SQL, then the approved capability selects only the primitives it needs. Workflows fits multi-step waits and callbacks, a private Cloud Run worker fits short request-driven steps, Jobs fit bounded isolated work, and Cloud Tasks fits retryable dispatch. Any selected retrying mechanism uses deterministic step idempotency identities.

If Pi-specific semantics are still valuable, the smallest safe pilot is one private, non-Spot Compute Engine VM, one Pi process, and one attached Persistent Disk. Pin the exact Pi version, use stop-before-start deployment, least-privileged workload identity, Secret Manager, application-consistent snapshots, and a tested restore. This is deliberately not highly available: a VM or zone outage pauses agent runs while Cloud Run and Cloud SQL keep the human task platform available. GKE is a later operational option only if an approved agent SLO or existing cluster justifies it.

Pi-specific IDs belong only in an internal runtime-mapping table. Pi tools call the same scoped application services as every other actor; its SQLite database is an execution checkpoint, never the source of truth. Before adoption, prove hard-kill recovery, duplicate-domain-effect prevention, serialized ownership, tenant isolation, cancellation, reconnect, single-use approval, version upgrade, deletion/retention, stop/start handoff, backup, and restore. Reject the integration if Pi types leak into the product domain.

Task status and agent-run status remain separate. Runs use explicit states such as queued, running, waiting for approval, waiting for input, retrying, succeeded, failed, canceling, and canceled. A run stores the initiating actor, executing agent, immutable grant snapshot, target task version, and attempt history. An approval binds to one exact proposed action, payload, and version and is single-use. Assignment does not start a run, change task status, or grant permission; starting work is a separate authorized action.

## Existing functionality to preserve

The rebuild should retain these product capabilities, delivered in tested slices:

- home dashboard, inbox, notifications, favorites, search, and My tasks;
- workspace overview, projects, members, teams, activity, settings, and archive;
- project overview, board, list, table, calendar, timeline, files, and activity views;
- task creation/editing, drag-and-drop moves, comments, subtasks, dependencies, labels, estimates, recurrence, attachments, and favorites;
- project templates, saved views, filters, sorting, grouping, command palette, keyboard flows, responsive states, loading/empty/error states, and reduced motion.

Some implementation details must change for multi-user correctness: embedded subtasks, floating-number ordering, synchronous global mutations, client-generated IDs, fake attachments, raw HTML, and client-only permission checks.

## Delivery sequence and proof

### UI-first implementation strategy

Build and approve the product experience before connecting production identity, persistence, and external systems. This is not a disposable visual prototype: establish the production Next.js/TypeScript/Arc application, routing, accessibility, responsive behavior, and component composition around a small typed browser gateway. A deterministic fixture implementation exercises that gateway until an authenticated server-backed implementation replaces it.

UI components must not import fixture data, server application services, repositories, Auth0, or database types. The production browser gateway calls authenticated route handlers or server actions; those adapters call separate server-only application services and repositories. Browser storage may retain presentation preferences and failed form drafts, but it is never the task source of truth. A local-only scenario switcher may simulate role, mode, data volume, errors, restaurant provenance, and inert agent identity; it must not ship as a production access control.

This order lets users validate Focused, Advanced, and Admin workflows early while preserving a clean path to Auth0, PostgreSQL, REST, MCP, and restaurant integration. The shared service contracts and representative fixtures are the boundary that prevents the UI-first phase from becoming throwaway work.

### 0. UI contract and behavior capture

- Preserve the confirmed upstream and Arc rights record and required notices.
- Tag the existing prototype state and retain it as behavioral reference.
- Add characterization journeys for critical existing behavior before replacing it.
- Adopt `design-system/gr8r-studio/MASTER.md` as the UI contract and define the Focused, Advanced, and Admin information architecture.
- Record navigation, task/project lifecycle, assignment, onboarding, invitation, restaurant-provenance, and agent-state behavior.
- Record the state/recovery matrix and the accepted role/capability boundary.

Proof: the characterization journeys pass against the prototype; every primary surface has a component mapping and state contract; open infrastructure inputs do not block UI implementation.

### 1. Production frontend with fixture services

- Establish the Next.js/TypeScript application, route groups, and Arc foundation.
- Create a typed browser-gateway interface plus a deterministic in-memory fixture implementation.
- In the first pull request, build the responsive shell and one complete Focused My tasks journey, including task detail or completion through the gateway.
- In follow-up UI slices, add the project board and drawer, Advanced views and filters, then representative Admin people/roles/integration surfaces.
- Cover loading, empty, denied, partial failure, conflict, long-content, and restaurant-provenance scenarios. Defer interactive agent-run and approval UI until phase 5.
- Add a local/test-only scenario switcher for role, experience mode, data state, and service outcome.
- Keep the legacy application intact until each replacement slice proves its behavior.

Proof: each agreed journey passes against the fixture gateway at 390, 768, 1024, and 1440px; keyboard, automated accessibility, light/dark, and reduced-motion checks pass; components have no direct dependency on fixtures, Auth0, server services, or persistence.

### 2. Identity, persistence, and Google Cloud foundation

- Record `GCP_PROJECT_ID`, `GCP_REGION`, and `GOOGLE_WORKSPACE_DOMAIN` as configuration values; the last may remain unset until supplied.
- Add parameterized Terraform for required APIs, service accounts/IAM, Artifact Registry, Secret Manager, Cloud Run, Cloud SQL, Cloud Storage, and observability.
- Configure GitHub-to-Google Workload Identity Federation so CI uses short-lived credentials and no service-account JSON key.
- Add PostgreSQL migrations, workspace scoping, composite tenant-integrity constraints, immutable audit records, and policy tests.
- Add the Auth0 Next.js SDK, first Organization, Organization/RBAC enforcement, server-side Management API boundary, and test identities. Keep public signup disabled; defer the Workspace enterprise connection and Directory Sync until the real domain is supplied.
- Implement server-only application services and repository interfaces behind authenticated route handlers/server actions. Do not replace UI fixture adapters in this phase.
- Establish the Cloud Run application, migration job, Cloud SQL, private Storage bucket, scoped secrets, logging, and HTTPS ingress without relying on instance-local state.

Proof: Terraform validates and plans; CI builds an immutable image without a long-lived Google key; test organization login, role claims, and negative cross-workspace database/policy tests pass; the runtime identity cannot perform schema migrations; leaving the Workspace domain unset neither blocks non-production work nor enables public signup.

### 3. Production core and functional parity

- Bootstrap-owner and invited-member onboarding through Auth0 Universal Login, with returning members bypassing setup.
- Implement the production browser gateway and replace fixture-backed user-workspace slices one at a time.
- Wire project/task CRUD, Focused and Advanced views, comments, assignments, activity, signed attachments, dashboard, inbox/notifications, search, saved views, bulk actions, calendar, timeline, dependencies, recurrence, archive, and templates to production services.
- Add a scoped Auth0 machine-to-machine restaurant actor and first idempotent task-create endpoint, exercised from an external-client fixture.
- Preserve server-enforced roles, versions/conflict recovery, tenant integrity, and immutable audit events while replacing all user-workspace fixture paths. Admin fixture paths remain for phase 4.

Proof: two users with different roles see and mutate only authorized data; the agreed parity and recovery-state checklist passes end-to-end with production data; refresh, concurrent sessions, and Cloud Run replacement retain consistent state; repeated restaurant delivery produces exactly one domain effect; attachment access cannot cross workspaces; version conflicts preserve local work for reapply.

### 4. Admin, integrations, REST, and MCP

- Replace Admin fixture paths with server-side Auth0 Management API operations and application services, including members, invitations, teams, roles, integrations, audit, and settings.
- OpenAPI-backed REST endpoints and Auth0 machine-to-machine clients with scoped application actor mappings.
- Complete the restaurant connector, provenance UI, and monotonic change feed consumed directly by its Kanban.
- Auth0 Auth for MCP protection over the same authorized services.

Proof: the restaurant Kanban converges across create, update, archive, and access removal; authorized REST and MCP calls have identical outcomes; wrong audience, organization, scope, project access, version, or idempotency reuse is denied and audited.

### 5. Agents and durable execution

Do not begin this phase until the owner approves the first agent actions and their human-approval boundaries.

- Agent definitions, grants, assignments, run history, progress, outputs, and approval records.
- Land product-owned run, command, grant, approval, and event records before choosing a provider.
- Implement the smallest `GoogleCloudAgentRuntime` required by the approved capability, choosing Workflows, a private Cloud Run worker, bounded Jobs, or Cloud Tasks only where its execution shape requires it.
- Arc `agent-run` UI for progress and approval.
- Only if its specific semantics remain useful, spike `PiDurableRuntime` on one private single-owner Compute Engine VM with Persistent Disk.

Proof: explicit start creates an auditable run; forced worker termination resumes from persisted state; replay causes no duplicate domain effect; approval survives waiting/redeployment and authorizes only its bound action; cancellation is durable; workload IAM and application grants independently deny out-of-scope action. A Pi pilot must additionally pass stop/start ownership, backup, and restore tests.

### 6. Hardening and cutover

- Rate limits, secret rotation, retention/deletion, backups and restore test, observability, performance, and security review.
- Production Cloud Run, Cloud SQL HA/PITR, Cloud Storage lifecycle, load balancer/Cloud Armor, Artifact Registry, selected region, custom hostname, budgets/alerts, and revision rollback procedure.
- Prove the real Auth0 Google Workspace enterprise connection, invitation-plus-domain rule, selected-group Directory Sync, and final group-to-role reconciliation in staging before cutover, then promote the verified configuration to production.
- Data import only if real browser-local data must be retained.

Proof: restore into a separate database instance, expand/contract migration compatibility, bad-revision traffic rollback, secret rotation, authorization tests, final invited-domain login, explicit non-member denial, accessibility checks, and rollback rehearsal pass before cutover.

## Main risks and controls

| Risk                                            | Control                                                                                                                                                           |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rewrite loses subtle behavior                   | Characterization journeys and an explicit parity checklist before deleting legacy code.                                                                           |
| Fixture-backed UI drifts from production        | A small typed browser gateway plus contract tests run against both fixture and authenticated server-backed implementations.                                       |
| UI-only role checks expose data                 | Central policy service, workspace-scoped queries, and negative authorization tests.                                                                               |
| Board moves conflict                            | Transactional ordering plus optimistic concurrency.                                                                                                               |
| External systems create duplicates/stale writes | Idempotency records, external mappings, versions/ETags, and auditable conflict responses.                                                                         |
| Cloud Run terminates or overlaps instances      | Persist before responding; no process-local authority, sessions, jobs, or protected-data cache.                                                                   |
| Autoscaling exhausts Cloud SQL connections      | Bound each instance pool and derive Cloud Run maximum instances from the measured database connection budget.                                                     |
| Cloud Tasks or Workflows repeats a step         | Deterministic step keys, transactional idempotency, current entity versions, and compensating actions for external effects.                                       |
| Deployment revision/schema mismatch             | Expand/contract migrations, a dedicated migration job, a compatibility window, staged traffic, and tested rollback.                                               |
| Public traffic bypasses edge controls           | Restrict Cloud Run ingress to the load balancer and disable the default service URL where supported.                                                              |
| Auth0 Management API privilege leaks            | Server-only least-privileged machine credential; never expose it to the browser; monitor and rotate it.                                                           |
| Auth0 plan omits a required B2B feature         | Verify Organizations, Google Directory Sync, Management API quotas, and Auth for MCP against the selected plan.                                                   |
| Directory data and access policy drift          | Treat periodic sync as identity input, not instant revocation; require explicit organization membership, revoke urgent access directly, and monitor sync results. |
| Auth0 or Google identity is unavailable         | Deny new or uncertain authentication and privileged changes; never fall back to email/domain trust.                                                               |
| Rich text introduces XSS                        | Sanitized Markdown or a structured document format.                                                                                                               |
| Signed attachment is abandoned or unsafe        | Finalize metadata server-side, validate object type/size, define scanning policy, and expire orphaned uploads.                                                    |
| Arc Pro token leaks                             | Development/CI secret only; never commit it or expose it to the deployed runtime by default.                                                                      |
| Agent runtime becomes infrastructure lock-in    | Small `AgentRuntime` port and product-owned run/approval records.                                                                                                 |
| Pi lifecycle gaps affect privacy or reliability | Keep it deferred, private, exact-version pinned, single-owner, backed up, and gated by phase-5 recovery proofs.                                                   |
| Optional single Pi worker is unavailable        | Human task platform remains available; agent runs pause and recover. Add HA only when an approved agent SLO justifies a new design.                               |
| MCP authorization profile changes               | Pin verified Auth0/MCP SDK versions behind adapters and run discovery, scope, audience, and client-registration tests.                                            |

## Decisions and remaining inputs

Recommended defaults are included so implementation can start quickly.

1. **Code rights and visibility — decided:** the owner confirmed the required upstream and Arc rights for this repository and deployment.
2. **Identity provider — decided:** Auth0 with a Google Workspace enterprise connection, Universal Login, Organizations, organization roles, and Auth for MCP.
3. **Google access policy — non-blocking configuration:** the Workspace domain is unknown for now. Keep it unset until supplied; then validate invitation and matching Workspace identity in staging before cutover, with no public signup.
4. **Directory management — decided:** use Auth0 Google Workspace Directory Sync for users and selected groups, while invitation/Organization membership remains the explicit access gate. Map dedicated stable group IDs only for existing members; Google administrator roles do not become application roles.
5. **Tenancy — decided:** one company in the first UI; retain Auth0 Organization and database workspace boundaries so more companies can be added later.
6. **Assignments — working default:** one visible accountable human or enabled agent plus optional human collaborators. Only active project members are human assignees; assignment never grants access or starts an agent run.
7. **Restaurant integration — decided:** the task platform is canonical and the restaurant Kanban reads/writes its allowed tasks directly through the REST API; no webhook/outbox initially.
8. **Hosting boundary — working default:** Next.js, REST, and MCP run on Cloud Run with Cloud SQL, Cloud Storage, Secret Manager, Cloud Tasks/Workflows as needed, and Google observability. Compute Engine is excluded from the baseline; one private VM is only a possible phase-5 Pi pilot.
9. **Agent authority — pending:** no agent mutation or run-start scope is enabled until the first actions and approval rules are approved.
10. **Compliance, region, and recovery — pending:** EU data residency, deletion/retention, production region, RTO, and RPO must be supplied before production cutover. Terraform remains region-parameterized and stateful services are co-located when selected.
11. **Existing data — working default:** treat browser-local prototype data as demo data unless a real export is later identified.

UI work can start without the Google Workspace domain. The domain is required only for production identity-policy validation and cutover, not for the UI, schema, API, MCP, or parameterized cloud platform. The first implementation pull request should contain the tested Next.js/Arc foundation, typed browser gateway, deterministic fixture implementation, responsive shell, and one complete Focused task journey. Board, Advanced, and Admin fixture-backed slices follow before Auth0, schema, and Google Cloud integration. The agent phase remains gated on the pending authority decision.

## Primary references

- Arc AI/MCP and Pro access: <https://uiarc.dev/docs/ai>
- Auth0 Next.js App Router integration: <https://developer.auth0.com/resources/guides/web-app/nextjs/basic-authentication>
- Auth0 Google Workspace enterprise connection: <https://auth0.com/docs/authenticate/identity-providers/enterprise-identity-providers/google-apps>
- Auth0 Google Workspace Directory Sync: <https://auth0.com/docs/authenticate/identity-providers/enterprise-identity-providers/google-directory-sync>
- Auth0 enterprise-group roles: <https://auth0.com/docs/manage-users/access-control/configure-core-rbac/rbac-users/assign-roles-to-groups>
- Auth0 Organization invitations and member roles: <https://auth0.com/docs/manage-users/organizations/configure-organizations/invite-members>
- Auth0 Organization roles: <https://auth0.com/docs/manage-users/organizations/organization-roles>
- Auth0 Organization token validation: <https://auth0.com/docs/manage-users/organizations/using-tokens>
- Auth0 Management API access tokens: <https://auth0.com/docs/secure/tokens/access-tokens/management-api-access-tokens>
- Auth0 Auth for MCP authorization: <https://auth0.com/ai/docs/mcp/get-started/authorization-for-your-mcp-server>
- Auth0 MCP resource-parameter profile: <https://auth0.com/ai/docs/mcp/guides/resource-param-compatibility-profile>
- Auth0 manual CIMD registration: <https://auth0.com/ai/docs/mcp/guides/registering-your-mcp-client-application/manual-cimd-registration>
- Next.js route handlers: <https://nextjs.org/docs/app/getting-started/route-handlers>
- Next.js self-hosting: <https://nextjs.org/docs/app/guides/self-hosting>
- Cloud Run Next.js deployment: <https://docs.cloud.google.com/run/docs/quickstarts/frameworks/deploy-nextjs-service>
- Cloud Run ingress: <https://docs.cloud.google.com/run/docs/securing/ingress>
- Cloud Run container contract and Jobs: <https://docs.cloud.google.com/run/docs/container-contract>, <https://docs.cloud.google.com/run/docs/create-jobs>
- Cloud SQL from Cloud Run: <https://docs.cloud.google.com/sql/docs/postgres/connect-run>
- Cloud Storage signed URLs: <https://docs.cloud.google.com/storage/docs/access-control/signed-urls>
- Cloud Tasks and Workflows: <https://docs.cloud.google.com/tasks/docs/dual-overview>, <https://docs.cloud.google.com/workflows/docs/overview>
- Cloud Run service-to-service authentication: <https://docs.cloud.google.com/run/docs/authenticating/service-to-service>
- Google Workload Identity Federation for delivery pipelines: <https://docs.cloud.google.com/iam/docs/workload-identity-federation-with-deployment-pipelines>
- Cloud Run secrets: <https://docs.cloud.google.com/run/docs/configuring/services/secrets>
- Compute Engine Persistent Disk: <https://docs.cloud.google.com/compute/docs/disks/persistent-disks>
- MCP `2026-07-28` authorization specification: <https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization>
- Pi durable package: <https://github.com/earendil-works/pi/tree/main/packages/durable>
