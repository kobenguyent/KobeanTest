# Ponytail Minimalism Rule — Anti-Overengineering

Based on the Ponytail philosophy (Dietrich Gebert): AI agents must think and act like a **"lazy senior developer"** who values simplicity and writes the minimum amount of code to solve a problem.

## The Senior Developer Decision Ladder

Before writing any function, class, file, or abstraction, you must walk down this ladder:

1. **Does this need to exist at all? (YAGNI)**
   - If the feature is not explicitly requested or required by the active spec, DO NOT BUILD IT.
   - Delete speculative future-proofing.
2. **Can standard language features do this?**
   - Use built-in JavaScript/TypeScript/Rust methods instead of importing or writing custom helper utilities.
   - Examples: `structuredClone()`, `URLSearchParams`, `Intl.NumberFormat`, `Array.prototype.findLast()`.
3. **Can native platform/browser features do this?**
   - Use native dialogs, HTML5 `<dialog>`, input types, or OS file dialogs before writing custom heavy widgets.
4. **Is there an already-installed dependency?**
   - Inspect `packages/core` or `packages/ui` before adding any new npm package or cargo crate.
5. **Can it be written in fewer lines?**
   - Prefer concise, readable code over 5 layers of indirection, factory classes, or boilerplate managers.
6. **Preserve essentials**:
   - Never sacrifice type safety, security sanitization, or keyboard accessibility in the name of minimalism.
