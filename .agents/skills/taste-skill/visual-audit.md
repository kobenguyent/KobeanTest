# Visual Taste Audit Checklist

Verify each item before committing any UI code:

1. [ ] **Border Discipline**: Are borders subtle 1px (`border border-border/40`)? Are heavy muddy drop shadows avoided?
2. [ ] **Typography Hierarchy**: Are headings tightly tracked (`tracking-tight`)? Are metadata labels small, clean, and uppercase (`text-[11px] font-medium uppercase`)?
3. [ ] **Tabular Numerals**: Do all counters, run percentages, durations, and test IDs use `tabular-nums`?
4. [ ] **Icon Alignment**: Are icons rendered with `strokeWidth={1.75}` via `lucide-react` and optically aligned with adjacent text?
5. [ ] **Restrained Palette**: Is color used strictly for semantic state (Pass/Fail/Blocked/Skip) and primary action, rather than decorative noise?
6. [ ] **Keyboard Usability**: Can this component be focused and navigated via keyboard with crisp focus rings (`ring-1 ring-ring`)?
7. [ ] **Theme Contrast**: Does the text meet WCAG AAA contrast in both Dark (`#09090B`) and Light (`#FFFFFF`) themes?
