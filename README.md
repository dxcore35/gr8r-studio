# Gr8r Studio

Gr8r Studio is becoming a shared task workspace for people, connected business systems, and agents. The current production slice ports the original Gr8r **My Tasks** experience into Next.js and TypeScript while keeping a typed boundary for the future API. Routes that have not been migrated yet are built from the retained upstream source and remain available from the new shell, so the fork does not strand any original screens or interactions during the migration.

## Current UI slice

- Original Gr8r sidebar, topbar, grouped task list, calendar, and mobile navigation
- Search, filtering, sorting, group collapsing, and task creation
- Complete, reopen, and create interactions through a typed task gateway
- Browser-local task persistence behind the same replaceable gateway boundary
- Two-way task synchronization with the retained upstream screens, including assignees and legacy-only task details
- Exact project, project-view, and team handoff from the rebuilt shell
- Loading, empty, error, retry, and filtered-empty states
- Light and dark themes
- Deterministic restaurant-operations fixtures for UI development
- Automated functional, responsive, reduced-motion, and WCAG A/AA checks

The task data is still local. The `TaskGateway` boundary is the integration seam for the future API; authentication, user management, restaurant sync, and agent execution are planned but not wired in this slice.

## Stack

- Next.js App Router and React
- TypeScript
- The original Gr8r token and component stylesheet cascade
- CSS Modules for React-specific states only
- Licensed Arc/UIarc source retained for later screens where it can match the Gr8r language exactly
- The complete upstream Vite application as a generated migration fallback
- Playwright and axe-core

## Getting started

Requires Node.js 20.9 or newer (`.nvmrc` pins Node.js 22).

```bash
npm install
npm run dev       # builds the upstream fallback, then starts http://localhost:3000
npm run build     # builds the upstream fallback and the production Next app
npm run start     # serve the production build
npm run typecheck
npm run lint
npm run format:check
npm run test:e2e
```

Open `/my-tasks`. The following fixture URLs cover non-happy-path states without adding development controls to the production-matched interface:

- `/my-tasks?scenario=populated`
- `/my-tasks?scenario=empty`
- `/my-tasks?scenario=loading`
- `/my-tasks?scenario=error`

## Project structure

```text
src/app/                         Next.js routes and screen composition
src/app/my-tasks/_components/    Focused My tasks UI
src/components/gr8r-shell/       Original Gr8r shell port
src/components/arc/              Licensed Arc/UIarc source for later slices
src/features/tasks/              Task types, fixtures, and gateway boundary
src/styles/                      Original Gr8r design system and responsive rules
src/**/*.js                      Retained upstream app used by the migration fallback
tests/e2e/                        Playwright behavior and accessibility tests
docs/agentic-platform-plan.md     Product and platform delivery plan
docs/design-reference/            Extracted parity specification and tokens
design-system/gr8r-studio/        Design-system source of truth
```

The Vite fallback is generated into `public/upstream/` before local development and production builds. The directory is intentionally ignored because it is reproducible from the retained upstream source.

## Deployment

`vercel.json` selects the native Next.js build on Vercel. No production secrets or authentication configuration are required for this fixture-backed UI slice.
