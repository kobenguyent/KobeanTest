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

## 2. Four Curated Themes

```css
/* 1. Obsidian Dark (Default Dark) */
--canvas: #09090b;
--card:   #121215;
--border: rgba(255, 255, 255, 0.08);
--text:   #fafafa;
--muted:  #a1a1aa;

/* 2. Clean Paper (Default Light) */
--canvas: #ffffff;
--card:   #f8fafc;
--border: rgba(0, 0, 0, 0.08);
--text:   #0f172a;
--muted:  #64748b;

/* 3. Nordic Slate (Low Contrast Dark) */
--canvas: #0f172a;
--card:   #1e293b;
--border: rgba(255, 255, 255, 0.10);
--text:   #f1f5f9;
--muted:  #94a3b8;

/* 4. Warm Sand (Soft Natural Light) */
--canvas: #faf9f6;
--card:   #f3efea;
--border: rgba(0, 0, 0, 0.07);
--text:   #1c1917;
--muted:  #78716c;
```

---

## 3. Accessible Semantic Status Palette

Every status combines **Color + Shape Icon + Text** to guarantee 100% accessibility for color-blind users:

| Status | Icon | Color Token | Class Styling |
| :--- | :--- | :--- | :--- |
| **Passed** | `CheckCircle2` | Emerald (`#10B981`) | `bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20` |
| **Failed** | `AlertCircle` | Rose (`#F43F5E`) | `bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20` |
| **Blocked** | `Ban` | Amber (`#F59E0B`) | `bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20` |
| **Skipped** | `MinusCircle` | Slate (`#94A3B8`) | `bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-500/20` |
| **Flaky** | `Flame` | Purple (`#A855F7`) | `bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/20` |
| **Automated**| `Code2` | Cyan (`#06B6D4`) | `bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20` |

---

## 4. Iconography Guardrails
- Icon library: `lucide-react` strictly.
- Stroke width: `strokeWidth={1.75}` across all icons.
- Baseline optical adjustment: Add `translate-y-[0.5px]` when placing an icon adjacent to body text.
