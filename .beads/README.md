# .beads Task Graph & Memory

This directory stores the Git-tracked persistent task graph and state for AI agents working across multi-turn sessions on KobeanTest.

## Structure
- `state.json`: Current milestone, active sprint, and task blockers.
- `issues/`: Individual graph-linked task markdown files.

## Philosophy
- Avoid ephemeral markdown memory that is lost when conversations reset.
- Tasks form a DAG (Directed Acyclic Graph) with explicit dependencies (`blocked_by`).
