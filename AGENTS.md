# AGENTS.md

## Build, Lint, and Test Commands
- **Start dev server:** `bun run dev`
- **Build (prod):** `bun run build`
- **Build (dev):** `bun run build:dev`
- **Lint:** `bun run lint`
- **Preview build:** `bun run preview`
- **Testing:** No test script defined; add tests and scripts if needed.

## Code Style Guidelines
- **Imports:** Use ES module syntax. Prefer absolute imports via `@/` for `src/*`.
- **Formatting:** Follow Prettier defaults (2 spaces, semicolons, single quotes, trailing commas where possible).
- **Types:** Use TypeScript for all code. Explicit types preferred for props, function params, and return values. `any` discouraged.
- **Naming:** Use camelCase for variables/functions, PascalCase for components/types, UPPER_CASE for constants.
- **Error Handling:** Use try/catch for async code. Surface errors via UI or logs, not silent failures.
- **React:** Use function components. Prefer hooks for state/effects. Follow React Hooks lint rules.
- **Unused Vars:** Allowed (ESLint disables unused vars rule).
- **Exports:** Only export React components as default if using react-refresh.
- **Tailwind:** Use utility classes, dark mode via `class`.
- **File Structure:** Organize by feature in `src/components`, `src/hooks`, etc.

_This file is for agentic coding agents. Update if project conventions change._
