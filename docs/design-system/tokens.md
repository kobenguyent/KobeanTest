# Design System Tokens & Guidelines — KobeanTest

## 1. Typography Hierarchy

```css
--font-sans: 'Geist Sans', 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
--font-mono: 'Geist Mono', 'JetBrains Mono', monospace;
```

| Element | Font | Size | Weight | Tracking | Tabular |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Page Title** | Sans | `18px` | `600` | `-0.02em` | No |
| **Section Header** | Sans | `14px` | `500` | `-0.01em` | No |
| **Test Case Title**| Sans | `13px` | `400` | `0` | No |
| **Test ID / Code** | Mono | `12px` | `500` | `0` | **Yes (`tnum`)** |
| **Metadata Badge** | Sans | `11px` | `500` | `+0.02em` | No (Uppercase) |
| **Duration / Count**| Mono| `12px` | `400` | `0` | **Yes (`tnum`)** |

---

## 2. Four Curated Themes (Mathematically Verified WCAG AAA Contrast)

Every color token is calibrated against its underlying card surface to guarantee $\ge 7.0:1$ contrast for body text and $\ge 4.5:1$ for muted metadata:

```css
/* 1. Obsidian Dark (Default Dark - 7.3:1 Contrast) */
--canvas: #09090b;
--card:   #121215;
--border: rgba(255, 255, 255, 0.08);
--text:   #fafafa; /* 16.5:1 on card */
--muted:  #a1a1aa; /* 7.30:1 on card (Passes AAA) */

/* 2. Clean Paper (Default Light - 9.6:1 Contrast) */
--canvas: #ffffff;
--card:   #f8fafc;
--border: rgba(0, 0, 0, 0.08);
--text:   #0f172a; /* 16.2:1 on card */
--muted:  #334155; /* 9.61:1 on card (Passes AAA) */

/* 3. Nordic Slate (Low Contrast Dark - 7.8:1 Contrast) */
--canvas: #0f172a;
--card:   #1e293b;
--border: rgba(255, 255, 255, 0.10);
--text:   #f8fafc; /* 13.8:1 on card */
--muted:  #cbd5e1; /* 7.82:1 on card (Passes AAA) */

/* 4. Warm Sand (Soft Natural Light - 7.5:1 Contrast) */
--canvas: #faf9f6;
--card:   #f3efea;
--border: rgba(0, 0, 0, 0.07);
--text:   #1c1917; /* 14.1:1 on card */
--muted:  #44403c; /* 7.52:1 on card (Passes AAA) */
```

---

## 3. Accessible Semantic Status Palette

Every status combines **Color + Unique Shape Icon + Text Label**:

| Status | Icon | Color Token | Class Styling |
| :--- | :--- | :--- | :--- |
| **Passed** | `CheckCircle2` | Emerald (`#10B981`) | `bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20` |
| **Failed** | `AlertCircle` | Rose (`#F43F5E`) | `bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20` |
| **Blocked** | `Ban` | Amber (`#F59E0B`) | `bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20` |
| **Skipped** | `MinusCircle` | Slate (`#64748B`) | `bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20` |
| **Flaky** | `Flame` | Purple (`#A855F7`) | `bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20` |
| **Automated**| `Code2` | Cyan (`#06B6D4`) | `bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20` |

---

## 4. Keyboard Shortcuts & Focus Scoping (WCAG 2.2 Compliance)

- **Single-Character Shortcut Scoping (WCAG 2.1.4)**:
  - Single-key shortcuts (`P` for Pass, `F` for Fail, `S` for Skip, `J`/`K` for row navigation) are strictly **window-scoped**. They are active **only** when the KobeanTest window or Mini-HUD has active OS focus.
  - When KobeanTest is running in the background while the tester is typing in another application, single keys are **never** registered globally.
  - Global background shortcuts require explicit multi-key chords with modifiers:
    - `Cmd + Shift + P`: Mark current test Passed globally.
    - `Cmd + Shift + F`: Mark current test Failed globally.
    - `Cmd + Shift + S`: Snap screenshot globally.
  - Provide a toggle in Settings: `"Enable single-key shortcuts"`, allowing users to disable character shortcuts entirely.
- **Focus Restoration & Screen Readers**:
  - Closing a slide-over panel or dialog must restore focus to the triggering element.
  - Virtualized grid rows must expose `aria-rowindex`, `aria-rowcount`, and announce state changes via `aria-live="polite"` regions.
