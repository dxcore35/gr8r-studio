# Gr8r Studio

Gr8r Studio is becoming a shared task workspace for people, connected business systems, and agents. The current production slice rebuilds the focused **My tasks** journey with Next.js, TypeScript, and licensed Arc components while preserving the original prototype as a behavioral reference.

## Current UI slice

- Responsive workspace shell with desktop rail and mobile navigation sheet
- Focused task list with sorting and task filters
- Complete and reopen interactions through a typed task gateway
- Loading, empty, error, retry, and filtered-empty states
- Light and dark themes
- Deterministic restaurant-operations fixtures for UI development
- Automated functional, responsive, reduced-motion, and WCAG A/AA checks

The task data is still simulated. The `TaskGateway` boundary is the integration seam for the future API; authentication, user management, projects, restaurant sync, and agent execution are planned but not wired in this slice.

## Stack

- Next.js App Router and React
- TypeScript
- Arc foundation, components, and Pro sidebar source supplied through the authenticated UIarc MCP connection
- CSS Modules and semantic Arc tokens
- Playwright and axe-core

## Getting started

Requires Node.js 20.9 or newer (`.nvmrc` pins Node.js 22).

```bash
npm install
npm run dev       # http://localhost:3000
npm run build     # production build
npm run start     # serve the production build
npm run typecheck
npm run lint
npm run format:check
npm run test:e2e
```

Open `/my-tasks`. In development, use the **Preview state** control or one of these URLs:

- `/my-tasks?scenario=populated`
- `/my-tasks?scenario=empty`
- `/my-tasks?scenario=loading`
- `/my-tasks?scenario=error`

## Project structure

```text
src/app/                         Next.js routes and screen composition
src/app/my-tasks/_components/    Focused My tasks UI
src/components/arc/              Installed Arc foundation and components
src/components/theme-toggle/     Product-level theme control
src/features/tasks/              Task types, fixtures, and gateway boundary
tests/e2e/                        Playwright behavior and accessibility tests
docs/agentic-platform-plan.md     Product and platform delivery plan
design-system/gr8r-studio/        Design-system source of truth
```

The legacy Vite implementation remains under the existing JavaScript folders for reference. Next.js only registers `.ts` and `.tsx` routes, so those files are not part of the production application.

## Deployment

`vercel.json` selects the native Next.js build on Vercel. No production secrets or authentication configuration are required for this fixture-backed UI slice.
