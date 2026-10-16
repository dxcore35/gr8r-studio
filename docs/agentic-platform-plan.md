# Gr8r agentic work platform rebuild plan

- Status: Approved architecture baseline; Google Workspace domain and agent authority pending
- Date: 2026-10-16
- Planning branch: `plan/agentic-platform`

## Outcome

Rebuild Gr8r Studio as a production task and project platform that:

- preserves the useful workflows and views in the current prototype;
- uses Arc UI components and blocks through the authenticated Arc MCP catalog;
- runs the web application and primary API on Vercel;
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
Restaurant system ─ REST API ────┼──> Vercel application
MCP clients ─ OAuth/MCP ─────────┘      ├── Auth0 identity and policy
                                         ├── Task / Project services
                                         ├── Integration service
                                         ├── Agent service
                                         └── API adapters
                                                │
                                  ┌─────────────┴─────────────┐
                                  ▼                           ▼
                           PostgreSQL                    Blob storage
                         system of record                attachments
                       │
                       ▼
                  AgentRuntime
                       ├── VercelWorkflowRuntime (recommended first)
                       ├── PiHarnessRuntime (optional Vercel-managed spike)
                       └── PiDurableRuntime (optional external worker)
```

The UI, REST API, MCP server, restaurant connector, and agents must call the same application services. Authorization, validation, audit, idempotency, and business rules live there rather than in individual adapters.

## Recommended stack

| Concern         | Choice                                                                             | Reason                                                                                                                      |
| --------------- | ---------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Web application | Next.js App Router, React, TypeScript                                              | Arc is React-based; Next.js fits Vercel, server rendering, route handlers, and authenticated layouts.                       |
| UI system       | Arc foundation plus selected free and Pro components                               | Source-owned components, consistent tokens, responsive behavior, accessibility notes, and strong task/admin blocks.         |
| Authentication  | Auth0 with Google Workspace, Organizations, Directory Sync, RBAC, and Auth for MCP | Managed employee identity, organization membership, user administration, API authorization, and MCP OAuth in one provider.  |
| Database        | Managed PostgreSQL through a Vercel integration; Drizzle for schema and queries    | Portable, relational, transaction-friendly, and appropriate for task relationships, authorization, audit, and integrations. |
| Files           | Vercel Blob or an S3-compatible store                                              | The current upload flow stores only fake metadata; production needs actual object storage and signed access.                |
| API             | Next.js route handlers backed by the application-service layer                     | Keeps web and integration behavior in one deployable application without making UI code the policy boundary.                |
| Background work | Vercel Workflows and `WorkflowAgent` behind `AgentRuntime`                         | Resumable, observable execution and durable approval on the requested hosting platform.                                     |
| Tests           | Vitest for domain/policy tests and Playwright for critical journeys                | The rewrite needs behavioral parity and authorization proof, not visual similarity alone.                                   |

Provider-specific code should stay behind small adapters so identity administration, Postgres, object storage, email delivery, and agent execution can change without rewriting the product. Token verification remains a mandatory request-boundary concern rather than a swappable business rule.

## Identity, roles, and interface modes

### Actor model

Use one auditable actor concept for anything that can create, change, comment on, or receive a task:

- `human` — linked to an authenticated user and workspace membership;
- `agent` — linked to an agent definition and scoped runtime credential;
- `integration` — linked to an Auth0 machine-to-machine client or another approved OAuth client.

Tasks should record `createdByActorId`; assignments should point to actors; activity and audit events should always record the actor. An agent must never impersonate a human session.

### Identity ownership and admin boundaries

Use one canonical record for each concept:

- Auth0 owns identities, the Google Workspace enterprise connection, login, sessions/tokens, organization membership, invitations, and organization-role assignments. The Next.js Auth0 SDK handles the application's server-side session.
- Configure the Google Workspace connection to use Google's stable identity ID rather than email for the Auth0 user ID. Persist the Auth0 `sub` as the external identity key; email is a mutable profile attribute, never a foreign key.
- One Auth0 Organization maps one-to-one to one application workspace. The first release creates one company organization and hides workspace switching, while every domain record remains workspace-scoped so more companies can be added without a schema rewrite.
- Auth0 Google Workspace Directory Sync imports employee profiles and selected groups. Disable Membership on Authentication: a synchronized identity is not automatically authorized, and access still requires organization membership or an invitation. Google groups influence authorization only through an explicit reviewed mapping from stable group IDs.
- Application project memberships and policy rules narrow what a workspace member can do inside each project.
- Workspace Owner/Admin are Auth0 organization-member roles with Auth0 API permissions. They manage their workspace but do not receive platform-wide authority.
- A dedicated tenant-level Auth0 role grants platform-operator access and is limited to the small set of accounts that can manage cross-workspace incidents. Platform routes require a non-organization admin session and verify the subject's tenant-level role server-side through the Auth0 Management API, with short-lived caching only if needed; organization role claims never satisfy this check.

The normal admin interface described below is workspace administration. Its server routes derive the target Auth0 Organization from the validated session, then call the Auth0 Management API with a least-privileged machine credential. They never trust an arbitrary organization ID from the browser, and the Management API credential is never sent to the browser. Platform operations live on a separately guarded route and remain invisible to ordinary workspace admins.

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
- **Admin control plane**: people, invitations, teams, roles, agents, API clients, audit, retention, and workspace settings.

Store an `experienceMode` preference per membership. Default it from the role, allow an eligible user to switch modes, and keep the same authorization rules underneath both.

## Core data model

The schema should be multi-workspace capable even if the first deployment exposes only one workspace.

| Area        | Core records                                                                                                             |
| ----------- | ------------------------------------------------------------------------------------------------------------------------ |
| Identity    | Auth0 subject/organization/role references; one-to-one workspace profile; project membership; actor                      |
| Work        | project, project membership, task, task assignment, dependency, label, comment, attachment, saved view                   |
| History     | activity event, security audit event, notification                                                                       |
| Integration | Auth0 machine-client-to-actor mapping, integration connection, external link, idempotency record, synchronization cursor |
| Agents      | agent definition, agent grant, agent run, run event, approval request, runtime mapping                                   |

Store one unique `auth0OrganizationId` on the workspace and one immutable Auth0 `sub` on each human actor profile. Other domain tables reference the internal `workspaceId`; do not copy Auth0 identifiers through every task table.

Recommended task fields include workspace/project IDs, stable public key, title, structured description, status, priority, start/due timestamps, estimate, recurrence rule, parent task, ordering token, version, archive timestamp, creator actor, source system, and external ID.

Use a task-assignment table even if the first UI shows one accountable owner. This avoids a future schema rewrite when collaborators or multiple agents are required. Use a version or ETag for optimistic concurrency so two boards cannot silently overwrite each other.

Do not preserve raw, unsanitized HTML descriptions from the prototype. Use sanitized Markdown or a structured editor document.

## REST API and MCP

### REST API

Start with a versioned `/api/v1` surface:

- projects: list, read, create, update, archive;
- tasks: list, read, create, update, assign, move, archive;
- comments and attachments;
- members and invitations for authorized admins;
- agent runs and approval decisions once agent capabilities are approved.

Requirements:

- Auth0 machine-to-machine clients with narrow API scopes rather than shared user cookies or application-owned passwords;
- `Idempotency-Key` on writes from integrations and agents;
- stable error codes and an OpenAPI document;
- cursor pagination and explicit filtering;
- optimistic concurrency for mutations;
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

Agent-run tools remain disabled until the owner approves concrete agent capabilities and approval rules.

Target MCP `2026-07-28` and use Auth0 Auth for MCP as the OAuth authorization server while the Vercel MCP route remains the protected resource server:

- register the canonical HTTPS MCP URL as an Auth0 API/resource identifier, enable the Resource Parameter Compatibility Profile and Include Issuer in Authorization Responses, and use Auth0's RFC 9068 authorization access-token profile;
- publish RFC 9728 protected-resource metadata from the MCP server and Auth0 authorization-server discovery from the configured Auth0 domain;
- use authorization code with PKCE for user-delegated clients, enable Auth0's Client ID Metadata Document Registration tenant setting, and approve each Client ID Metadata Document client administratively; keep open Dynamic Client Registration disabled unless a specific legacy client requires it;
- promote the Google Workspace connection to domain level for approved third-party MCP clients, grant those clients the task API explicitly, and permit them for the company Organization;
- require the resource indicator so access tokens are audience-bound to this MCP server, and reject tokens without the expected Auth0 issuer, audience, expiry, organization context, and permissions;
- enable Auth0 RBAC and include permissions in access tokens;
- map OAuth scopes for project/task read, task/comment write, and integration administration to the same application permission service used by REST and UI;
- return scope-aware `WWW-Authenticate` challenges so clients can request only the access they need.

A valid Auth0 token is only the outer authorization ceiling. Every tool call must still resolve the actor and workspace, then pass exactly the same project-level policy checks as the equivalent REST or UI action. Do not expose raw database, shell, or filesystem access to ordinary workplace agents.

## Restaurant-system integration

The task platform should remain the source of truth.

1. Give the restaurant system a scoped integration actor restricted to its project(s).
2. Represent it as an Auth0 machine-to-machine application. Map its Auth0 client ID to the integration actor and allowed projects in the application database; Auth0 scopes are a ceiling, not the project authorization rule.
3. It creates or upserts tasks through `/api/v1/tasks` using `sourceSystem`, `externalId`, and an idempotency key.
4. Its Kanban reads canonical tasks directly through a filtered, cursor-paginated endpoint and can request only records changed since its last synchronization cursor.
5. Status changes return through the same API with the current version/ETag so stale clients receive an explicit conflict instead of overwriting newer work.
6. Every request records the integration actor, source, external ID, and audit event.

This direct API model keeps tasks centrally managed and is the selected first implementation. Add signed webhooks and an outbox only if a future integration demonstrates a real push-delivery requirement.

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
| Auth0 entry launcher               | `sign-in`                    | Free |
| Members and invitations            | `team-members`               | Pro  |
| Roles and permission review        | `roles-permissions`          | Pro  |
| Connected systems and API clients  | `integrations`               | Pro  |
| Admin settings search              | `settings-command`           | Pro  |
| Live agent execution and approvals | `agent-run`                  | Pro  |

Arc supplies presentation and interaction behavior, not application security or persistence. Task details, assignee selection, role-aware navigation, and project-specific workflows still require product composition around the Arc primitives.

Use Arc's `sign-in` block only as the branded “Continue with Google Workspace” launcher into Auth0 Universal Login. Do not collect Google credentials or implement a second local login flow in the application.

Install Pro components through the token-gated Arc registry only. The registry token is a development or CI installation secret, not an application runtime secret; do not add it to the deployed Vercel environment unless a reviewed build step actually fetches registry source. Preserve Arc's copyright/license notices and the rights record noted above.

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

### 0. Confirmed inputs and remaining configuration

- Preserve the confirmed upstream and Arc rights record and required notices.
- Record the allowed Google Workspace domain and create the Auth0 tenant, application, API, Google Workspace enterprise connection, and first Organization.
- Record the accepted role/capability matrix and integration boundary.

Proof: Auth0 and deployment configuration inputs are documented, and a test user completes Google Workspace login in the expected Auth0 Organization while a strict administrator-approved CIMD client obtains an organization-bound MCP token for the canonical resource.

### 1. Characterization and foundation

- Tag the existing prototype state.
- Add Playwright journeys for critical existing behavior.
- Establish the Next.js/TypeScript application and Arc foundation.
- Add PostgreSQL migrations, the Auth0 Next.js SDK, Google Workspace connection, Auth0 Organization, Directory Sync, RBAC, workspace scoping, and policy tests.
- Create the shared application-service interfaces used by UI, REST, and MCP.

Proof: baseline journeys run against the prototype; invited Google Workspace login, organization-role claims, and cross-workspace isolation tests pass in the new foundation.

### 2. Production vertical slice

- Single-company workspace onboarding and invited Google sign-in through Auth0 Universal Login.
- Member/admin management through server-side Auth0 Management API calls.
- Project and task CRUD.
- Focused task list, Kanban, task drawer, comments, assignments, and activity.
- A scoped Auth0 machine-to-machine restaurant actor and first idempotent task-create endpoint, exercised from an external-client fixture.
- Server-enforced roles, audit events, and real persistence.

Proof: two users with different roles see and can mutate only authorized data; refresh and concurrent sessions retain consistent task state; repeated delivery of one restaurant request produces exactly one canonical task visible in the focused UI.

### 3. Functional parity and advanced UI

- Dashboard, inbox/notifications, search, saved views, bulk actions.
- Table, calendar, timeline, files, dependencies, recurrence, archive, and project templates.
- Focused/advanced mode switching, accessibility, responsive behavior, and keyboard flows.

Proof: the agreed parity checklist passes end-to-end with production data, loading, error, and empty states.

### 4. Admin, integrations, REST, and MCP

- Admin control plane using Arc's member, role, and integration blocks with server-side Auth0 Management API operations.
- OpenAPI-backed REST endpoints and Auth0 machine-to-machine clients with scoped application actor mappings.
- Complete the restaurant connector and filtered central-task API consumed directly by its Kanban.
- Auth0 Auth for MCP protection over the same authorized services.

Proof: the restaurant Kanban reads the canonical task and updates it with concurrency protection; authorized REST and MCP calls have identical outcomes; unauthorized calls are denied and audited.

### 5. Agents and durable execution

Do not begin this phase until the owner approves the first agent actions and their human-approval boundaries.

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

| Risk                                            | Control                                                                                                                                                           |
| ----------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Rewrite loses subtle behavior                   | Characterization journeys and an explicit parity checklist before deleting legacy code.                                                                           |
| UI-only role checks expose data                 | Central policy service, workspace-scoped queries, and negative authorization tests.                                                                               |
| Board moves conflict                            | Transactional ordering plus optimistic concurrency.                                                                                                               |
| External systems create duplicates/stale writes | Idempotency records, external mappings, versions/ETags, and auditable conflict responses.                                                                         |
| Auth0 Management API privilege leaks            | Server-only least-privileged machine credential; never expose it to the browser; monitor and rotate it.                                                           |
| Auth0 plan omits a required B2B feature         | Verify Organizations, Google Directory Sync, Management API quotas, and Auth for MCP against the selected plan.                                                   |
| Directory data and access policy drift          | Treat periodic sync as identity input, not instant revocation; require explicit organization membership, revoke urgent access directly, and monitor sync results. |
| Rich text introduces XSS                        | Sanitized Markdown or a structured document format.                                                                                                               |
| Arc Pro token leaks                             | Development/CI secret only; never commit it or expose it to the deployed runtime by default.                                                                      |
| Agent runtime becomes infrastructure lock-in    | Small `AgentRuntime` port and product-owned run/approval records.                                                                                                 |
| Pi lifecycle gaps affect privacy or reliability | Keep it optional, external, exact-version pinned, and gated by the spike criteria.                                                                                |
| MCP authorization profile changes               | Pin verified Auth0/MCP SDK versions behind adapters and run discovery, scope, audience, and client-registration tests.                                            |

## Decisions and remaining inputs

Recommended defaults are included so implementation can start quickly.

1. **Code rights and visibility — decided:** the owner confirmed the required upstream and Arc rights for this repository and deployment.
2. **Identity provider — decided:** Auth0 with a Google Workspace enterprise connection, Universal Login, Organizations, organization roles, and Auth for MCP.
3. **Google access policy — configuration needed:** supply the allowed Workspace domain. Default: invitation and matching Workspace identity are both required; no public signup.
4. **Directory management — decided:** use Auth0 Google Workspace Directory Sync for users and selected groups, while organization membership remains the explicit access gate.
5. **Tenancy — decided:** one company in the first UI; retain Auth0 Organization and database workspace boundaries so more companies can be added later.
6. **Assignments — pending:** recommended default is one visible accountable owner plus optional collaborators, backed by the flexible assignment table.
7. **Restaurant integration — decided:** the task platform is canonical and the restaurant Kanban reads/writes its allowed tasks directly through the REST API; no webhook/outbox initially.
8. **Hosting boundary — decided for the foundation:** web, API, database integration, and first agent runtime stay on Vercel. A separate Pi worker requires a later explicit decision.
9. **Agent authority — pending:** no agent mutation or run-start scope is enabled until the first actions and approval rules are approved.
10. **Compliance and region — pending:** EU data residency, deletion, and retention requirements must be supplied before production provider selection.
11. **Existing data — pending:** treat browser-local prototype data as demo data unless a real export must be retained.

The foundation can start once the Google Workspace domain and Auth0 tenant configuration are available. The first implementation pull request should contain the tested Next.js/Arc foundation, Auth0/schema skeleton, and one end-to-end project/task vertical slice rather than a visual-only rewrite. The agent phase remains gated on the pending authority decision.

## Primary references

- Arc AI/MCP and Pro access: <https://uiarc.dev/docs/ai>
- Auth0 Next.js App Router integration: <https://developer.auth0.com/resources/guides/web-app/nextjs/basic-authentication>
- Auth0 Google Workspace enterprise connection: <https://auth0.com/docs/authenticate/identity-providers/enterprise-identity-providers/google-apps>
- Auth0 Google Workspace Directory Sync: <https://auth0.com/docs/authenticate/identity-providers/enterprise-identity-providers/google-directory-sync>
- Auth0 Organization invitations and member roles: <https://auth0.com/docs/manage-users/organizations/configure-organizations/invite-members>
- Auth0 Organization roles: <https://auth0.com/docs/manage-users/organizations/organization-roles>
- Auth0 Organization token validation: <https://auth0.com/docs/manage-users/organizations/using-tokens>
- Auth0 Management API access tokens: <https://auth0.com/docs/secure/tokens/access-tokens/management-api-access-tokens>
- Auth0 Auth for MCP authorization: <https://auth0.com/ai/docs/mcp/get-started/authorization-for-your-mcp-server>
- Auth0 MCP resource-parameter profile: <https://auth0.com/ai/docs/mcp/guides/resource-param-compatibility-profile>
- Auth0 manual CIMD registration: <https://auth0.com/ai/docs/mcp/guides/registering-your-mcp-client-application/manual-cimd-registration>
- Next.js route handlers: <https://nextjs.org/docs/app/getting-started/route-handlers>
- Vercel Workflows: <https://vercel.com/docs/workflows>
- Vercel `WorkflowAgent`: <https://vercel.com/kb/guide/what-is-workflowagent>
- Vercel AI SDK harnesses, including Pi: <https://vercel.com/changelog/program-agent-harnesses-with-ai-sdk>
- MCP `2026-07-28` authorization specification: <https://modelcontextprotocol.io/specification/2026-07-28/basic/authorization>
- Pi durable package: <https://github.com/earendil-works/pi/tree/main/packages/durable>
