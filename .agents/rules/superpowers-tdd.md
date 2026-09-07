# Superpowers Discipline Rule — Process & TDD Enforcement

Inspired by the Superpowers methodology (Jesse Vincent / `obra/superpowers`): AI agents must not rush blindly into code generation. Every change follows a disciplined state machine.

## The 5-Step Engineering Loop

```
  [1. Brainstorm & Scope] ──► [2. Spec & Zod Schema] ──► [3. Failing Test (Red)]
                                                                   │
  [5. Review & Blast Radius] ◄── [4. Minimal Code (Green)] ◄───────┘
```

1. **Step 1: Brainstorm & Scope**
   - Check if an existing pattern in the codebase already solves this problem.
   - Outline the solution in 3–5 bullet points.
2. **Step 2: Spec & Schema First**
   - Define data types and validation contracts in `packages/core/src/schemas.ts` using Zod before implementing UI or backend logic.
3. **Step 3: Red (Failing Test)**
   - Write a unit test that verifies the expected behavior and fails for the right reason.
4. **Step 4: Green (Minimal Implementation)**
   - Write only enough production code to make the test pass.
5. **Step 5: Review & Blast Radius**
   - Verify that no callers or adjacent modules were broken.
   - Run `pnpm typecheck` to guarantee zero compilation regressions.
