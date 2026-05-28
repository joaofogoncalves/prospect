# UI Style Guide

The single source of truth for how the **frontend** looks and behaves. Read this
**before making any UI change** and keep new work consistent with it — the goal is
one coherent interface, not a pile of one-off styles. When a change here is
deliberate (a new accent, a new pattern), update this file *and* log it in
[`decisions.md`](./decisions.md). The current identity was established in decisions
[015](./decisions.md) and [016](./decisions.md).

Stack: **React 18 + Vite + Tailwind 4**, shadcn-style primitives over **Base UI**,
**Geist** variable font, light/dark themes driven by a `.dark` class.

---

## 1. Principles

1. **Tasteful, not loud.** One restrained accent. Color carries *meaning*
   (primary action, status), never decoration. If in doubt, stay neutral.
2. **Tokens, not hex.** Style with the semantic CSS variables / Tailwind tokens
   (`bg-primary`, `text-muted-foreground`, `border`, `ring`…). The only sanctioned
   raw-palette use is the status pills (§4). Never hardcode `#fff`/`oklch(...)` in a
   component.
3. **Both themes, always.** Every change must look right in light *and* dark. Use
   tokens (they flip automatically) or pair `… dark:…` utilities. Verify both.
4. **Reuse before building.** Compose from `components/ui/*`, `components/states.tsx`
   (`LoadingState`/`EmptyState`/`ErrorState`), `useQuery`, and `LogoMark` before
   hand-rolling. New shared pieces go in `components/`.
5. **Accessible by default.** Keyboard-operable, labelled, AA-contrast, motion-safe
   (§6, §7). A change isn't done if it regresses any of these.

---

## 2. Color

Tokens live in [`frontend/src/index.css`](../frontend/src/index.css) (`:root` and
`.dark`), in **oklch**.

- **Accent = indigo** (`--primary`, mirrored by `--ring`). It is the brand color
  and the primary-action color — they are intentionally the same.
- **Apply the accent to:** primary buttons (`Button` default variant), text links,
  focus rings, the logo mark, small count/emphasis pills (e.g. the section count
  badge `bg-primary/10 text-primary`), the **active top-nav link** (same pill), and
  **chart bars/lines** (see §9).
- **Do NOT apply the accent to:** card/page backgrounds, body or muted text,
  secondary/ghost buttons, large fills, or as a decorative wash. Header tint is the
  one exception and is kept near-invisible (`bg-primary/[0.03]`).
- **Neutrals** (`background`, `card`, `muted`, `border`, `foreground`,
  `muted-foreground`) do all the heavy lifting. Most surfaces are neutral.
- **Destructive** uses the `destructive` token only — for errors and dangerous
  actions, never for emphasis.

Changing the accent = edit `--primary`/`--ring` in both themes only; it cascades
everywhere. Don't sprinkle a second hue without updating this guide.

---

## 3. Typography & layout

- **Font:** Geist (`font-sans`). No other families.
- **Headings:** `font-semibold` (page title `text-2xl`, optionally `font-bold`) with
  `tracking-tight`. Section headings `text-sm font-semibold`.
- **Secondary text:** `text-sm text-muted-foreground`. Don't dim with opacity —
  use the token.
- **Radius:** use the `rounded-lg` / `rounded-xl` scale (driven by `--radius`); cards
  `rounded-xl`, controls/tables `rounded-lg`. Don't pick arbitrary radii.
- **Page width & rhythm:** content lives in `max-w-4xl` (see `Layout`); stack
  sections with `gap-6`/`gap-8`. Forms and focused cards use `max-w-2xl`/`max-w-sm`.

---

## 4. Components & patterns

- **Buttons** — `components/ui/button.tsx` variants: `default` (accent, primary
  action — one per view), `outline`/`secondary` (neutral), `ghost` (low-emphasis /
  toolbar), `destructive`, `link`. A control that **navigates** must be a `<Link>`
  (style it with `buttonVariants({...})`), not a `<button onClick={navigate}>`.
- **Cards** — `components/ui/card.tsx` for any contained block (detail, forms, auth).
- **Tables** (the list pattern, see `IntakeList.tsx`):
  - `<table aria-labelledby={sectionHeadingId}>`; header row neutral
    (`bg-muted/50 text-xs font-medium text-muted-foreground`, **not** uppercase).
  - Zebra rows (`odd:bg-muted/20`) + `hover:bg-muted/50` for scanability.
  - **Row navigation = one stretched link.** Put the `<Link>` in the primary cell
    with `after:absolute after:inset-0` over a `relative` row; do **not** add
    `onClick` to `<tr>` (it isn't keyboard-operable). One interactive element per row.
  - Paginate long lists (~8/page); short, personal lists stay unpaged.
  - **Tags: searchable, not displayed.** AI tags are part of the search haystack
    but kept *off* the row by default (a column of badges is too loud, and tag
    counts are near-constant noise). When the active search matches a row's tag(s),
    reveal just those tag(s) as static `Badge variant="secondary"` under the title —
    so a tag-driven match shows *why* the row is in the results. Static text only;
    don't make tag chips clickable (it would break the one-link-per-row rule).
- **Status pills** — `Badge` + **icon + text + solid tint** (never color alone):
  - Analyzed → `bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300` + `CircleCheck`.
  - Not analyzed → `bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300` + `Clock`.
  - These solid tints are AA-contrast in both themes; **don't** revert to
    `bg-*/15`-style opacity tints (they fail contrast). Add new statuses the same way.
- **Async states** — always use `components/states.tsx`: `LoadingState` (skeleton),
  `EmptyState` (icon + message + optional CTA), `ErrorState` (`role="alert"` + retry).
  Pair with `useQuery`. Don't hand-roll loading/empty/error UI.
- **Empty/permission messaging** — explain *why* (e.g. read-only for non-owners),
  don't just show a dead end.

---

## 5. Logo & brand mark

[`components/LogoMark.tsx`](../frontend/src/components/LogoMark.tsx) is the only mark.
It's inline SVG drawn with `currentColor` (so color it via `text-*`). The concept:
three tapering lines (raw incoming requests) funnel down to a single diamond — the
appraised gem, the opportunity surfaced from the noise.

- **Header / auth lockup:** `<LogoMark size={22..24} className="text-primary" />`
  beside the "Prospect" wordmark.
- **Loading indicator:** the *same* mark with `animate` (it draws itself, then
  breathes) — use it for the AI-analysis wait (create "working" state, detail
  analyze). Don't introduce a separate spinner for that flow.
- Keep the mark monochrome and simple; if it evolves, evolve it here, in one place.

---

## 6. Motion

Defined in `index.css` (keyframes + `.pi-*` classes) and tuned in the Base UI
primitives. Motion should *clarify*, not perform.

| Context | Duration / easing | Notes |
| --- | --- | --- |
| Dialog popup | 200ms ease-out, transform+opacity | `dialog.tsx` |
| Dialog backdrop | 150ms opacity | trails the popup |
| Dropdown menu | 150ms ease-out | `dropdown-menu.tsx` |
| Route / page entry | 180ms fade (`.pi-page-enter` on `<main>`) | opacity only |
| Create-flow phase change | 220ms (`.pi-phase-enter`, keyed `<Card>`) | small slide+fade |
| Logo draw / breathe | 1.6s draw, 2.4s breathe | loading only |

- Keep UI feedback in the **150–250ms** range. The logo loop is intentionally longer
  (it signals a multi-second wait).
- **Don't animate:** filter/sort re-renders, static list loads, whole-page slides,
  focus rings.
- **`prefers-reduced-motion` is mandatory.** A global guardrail in `index.css`
  collapses animation/transition durations and shows the logo fully-drawn. Any *new*
  keyframe animation must still look correct (or disappear) under reduced motion —
  prefer opacity over transforms, and never rely on motion to convey meaning.

---

## 7. Accessibility (non-negotiable)

- **Keyboard:** everything interactive is reachable and operable by keyboard with a
  visible `focus-visible` ring. No click-only affordances (see the table row rule).
- **Semantics:** real elements/roles — links navigate, buttons act; tables are
  labelled; headings nest in order; icons that are decorative get `aria-hidden`.
- **Labels:** every input/select has a `<label>` or `aria-label`. Avoid double-
  labelling (a wrapping `<label>` *and* an `aria-label`).
- **Status & errors:** never color-only — pair with icon/text. Errors render in a
  `role="alert"` region.
- **Contrast:** text ≥ 4.5:1, UI/large text ≥ 3:1, in **both** themes. Check new
  color pairings before shipping.

---

## 9. Charts & dashboard

The dashboard (`pages/Dashboard.tsx`) uses **Recharts**. Keep charts as restrained as
the rest of the UI — they inform, they don't decorate.

- **Colors come from tokens, resolved to concrete strings.** Never hand Recharts a
  CSS `var(--x)` — it doesn't survive the SVG→canvas serialization used for PNG
  export. Use `useChartColors()` (`lib/useChartColors.ts`), which reads the tokens and
  re-reads on theme change. Single-series **bars/lines use the indigo accent**
  (`--primary`); axis/grid use `border`/`muted-foreground`.
- **Status keeps its meaning-colors.** The analyzed/not-analyzed donut reuses the
  list's **emerald/amber** (the only sanctioned non-token colors, branched per theme
  in `useChartColors`). Don't introduce a rainbow palette for categories — a single
  accent across bars reads cleaner and stays on-brand.
- **No chart animation.** Set `isAnimationActive={false}`: the global
  `prefers-reduced-motion` guard only covers CSS (Recharts animates via JS), and a
  still chart makes PNG export deterministic. Give each `ResponsiveContainer` an
  explicit `height` (not `100%`) so screen, print, and tests agree.
- **Cards & layout.** Each chart lives in a `Card` (§4) with a `CardHeader` title and a
  ghost **PNG** download button in `CardAction`. KPI numbers use
  `text-3xl font-semibold tabular-nums`.
- **Export.** Per-chart PNG via `exportChartPng` (`lib/exportChart.ts`); CSV/JSON via
  `lib/exportData.ts`; full report via `window.print()`. The print layout is driven by
  an `@media print` block in `index.css` plus two classes: **`pi-no-print`** (hide
  chrome/buttons — also on the app `<header>`) and **`pi-report-section`** (keep a card
  whole across page breaks). Wrap the printable region in `#dashboard-report`.
- **Accessibility.** Charts are decorative duplicates of data shown elsewhere (KPI
  cards, the leaderboard **table**). Keep that table — it's the accessible source of
  truth; don't make a chart the only way to read a number.

---

## 8. Verifying UI work

1. `npm run build` (type-check) and the test suites — `npm run test` /
   `npm run test:e2e` — must pass. Add/extend tests for new state transitions.
2. Use the real browser (Playwright MCP) **sparingly** — only for substantial or
   complex UI changes, and then in a few purposeful steps. Routine tweaks are covered
   by the build + tests. (See CLAUDE.md → "Use the browser sparingly".)
3. Check **both themes** and a reduced-motion run for anything animated.
