# TypeScript & Core Standards — KobeanTest

Rules for `packages/core`, `packages/ui`, and web/desktop frontends.

## 1. Strict TypeScript Rules
- Strict mode is strictly enforced (`strict: true`).
- **Zero `any` allowed**. Use `unknown` and narrow with type guards or Zod schemas.
- Interfaces/Types use `PascalCase` without Hungarian prefixes (e.g. `TestCase`, not `ITestCase`).
- Functions use `camelCase`. Files use `kebab-case.ts` or `kebab-case.tsx`.

## 2. Schema-First Design (`packages/core`)
- All entities (`TestCase`, `TestSuite`, `TestRun`, `TestExecution`) must have:
  1. A Zod validation schema (e.g. `testCaseSchema`).
  2. An inferred TypeScript type (e.g. `type TestCase = z.infer<typeof testCaseSchema>`).
- UI forms and IPC payload parsers must use these shared Zod schemas.

## 3. State Management Best Practices
- **Server / Local DB State**: Use `TanStack Query (v5)` with query invalidation.
- **URL & Search State**: Use `TanStack Router` with strictly typed search params.
- **Ephemeral UI State**: Use `Zustand` for sidebar toggles, command palette open state, and active hotkeys.
- Do NOT use React Context for frequently updated state (causes unnecessary re-renders).
