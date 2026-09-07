# Taste-Skill Principles — Eliminating AI UI Slop

Derived from modern high-agency frontend practices (`Leonxlnx/taste-skill` and `Dragoon0x/taste-skills`): KobeanTest must look and feel like an elite developer instrument (Linear, Raycast, Apple Pro tools), not a generic AI template.

## Anti-Slop Rules

1. **The 1px Border Rule (No Heavy Drop Shadows)**:
   - Forbid blurry, muddy shadows (`shadow-xl`, `shadow-2xl`).
   - Use crisp, subtle 1px borders: `border border-border/40` with subtle surface contrast elevation (`bg-background` -> `bg-card`).
2. **Micro-Typography Precision**:
   - Headings (`h1`, `h2`, `h3`): Apply tight tracking (`tracking-tight` / `-0.02em`).
   - Timestamps, metadata, and badges: `text-[11px] font-medium tracking-wide uppercase`.
   - Numbers & execution durations: ALWAYS use tabular figures (`tabular-nums font-mono`).
3. **Restrained Color Discipline (60-30-10)**:
   - 60% Canvas / Neutral base (Dark: `#09090B`, Light: `#FFFFFF`).
   - 30% Structural elements (muted text, subtle borders, card panels).
   - 10% Semantic accents ONLY (Emerald for Pass, Rose for Fail, Amber for Blocked, Cyan for Automated).
   - Never use decorative rainbow gradients or neon cards.
4. **Snappy Motion Curves**:
   - Hover transitions: `duration-100 ease-out`.
   - Modals and slide-overs: `duration-200 cubic-bezier(0.16, 1, 0.3, 1)`.
   - No bouncy springs or floaty 500ms laggy animations.
5. **Optical Alignment**:
   - Icons next to text must be optically baseline-aligned (`translate-y-[0.5px]`).
   - Consistent icon stroke width: `strokeWidth={1.75}` via `lucide-react`.
