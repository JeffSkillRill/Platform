# Prompt for Codex — Transition & Loading Animations

Copy everything below into Codex.

---

Add polished transition and loading animations across the platform. Keep all existing invariants: vanilla HTML/CSS/JS with no build step, `window.escapeHtml` on db-sourced strings, no changes to grading/RLS logic. This is a pure UX-polish pass — no functional behavior changes.

## Ground rules

- Create one shared file `css/animations.css` (keyframes, utility classes, skeleton styles) and one small helper `js/animations.js` (page-transition + skeleton/spinner helpers). Link them from every page; don't duplicate keyframes into per-page CSS.
- All animations must respect `@media (prefers-reduced-motion: reduce)` — disable or reduce to opacity-only.
- Keep durations short and consistent: 150–250ms for micro-interactions, 300–400ms max for page/section transitions. Use `ease-out` for entrances, `ease-in` for exits.
- Animate only `opacity` and `transform` (GPU-friendly); never animate `top/left/width/height` or trigger layout.
- Everything must work in dark mode and at 375px width.

## 1. Page transitions

- Fade-in on load: on `DOMContentLoaded`, add a class to `<main>`/content wrapper that fades+slides it in (opacity 0→1, translateY 8px→0, ~300ms).
- Fade-out on navigation: intercept internal link clicks (same-origin `.html` links only), play a ~150ms fade-out, then navigate. Skip for external links, downloads, and when reduced-motion is set. Guard against double-clicks.
- Do NOT add exit transitions inside the active test flow (`student-test-solve.html`) where timing matters — entrance fade only there.

## 2. Loading states (replace blank/jumping content)

- **Skeleton loaders:** while Supabase fetches resolve, show shimmer skeletons matching the final layout for: dashboard stat cards and recent activity (student-home, admin-dashboard), tests lists, leaderboard rows, classes lists, question bank rows/cards, vocabulary lists, results/topic breakdowns, students table. Add a `skeleton(container, type)` helper in `animations.js` with a few templates (card, table-row, list-item, stat).
- **Button loading state:** shared `.btn-loading` class — inline spinner replaces label, button disabled. Apply to all submit/save/login/publish/start-test buttons during their async calls.
- **Full-screen loader:** small centered spinner overlay only where a skeleton doesn't fit (auth redirect check in `auth-guard.js`, test submission/grading). Give it a 150ms delay before appearing so fast responses never flash it.
- When data arrives, swap skeleton→content with a quick fade (no layout jump: skeletons must reserve the same height).

## 3. Micro-interactions

- Cards/list rows: staggered fade-in-up on first render (30–50ms stagger, cap total stagger at ~400ms for long lists).
- Buttons/cards: subtle hover lift (translateY(-1px) + shadow) and active press (scale .98) — only where hover states already exist; don't add hover effects to plain text.
- Modals: overlay fade + panel scale from .96→1 on open, reverse on close (wait for animation end before removing from DOM).
- Toasts/notifications: slide-in from top/right, auto-dismiss slide-out.
- Sidebar nav active-state: smooth background/indicator transition.
- Test flow: gentle crossfade between questions on next/prev (fast, ≤200ms, must not delay input), smooth width transition on progress bar, subtle pulse on the timer when under 5 minutes (opacity pulse only, reduced-motion-safe).
- Correct/incorrect reveal in practice/vocabulary: brief scale+color transition, no confetti or layout shift.

## 4. QA

- Verify every page: no flash of unstyled/empty content, no double-fade, back/forward button works normally (handle `pageshow` with `persisted` to un-fade after bfcache restore).
- Verify reduced-motion mode, dark mode, and 375px width on all pages.
- Verify skeletons never appear stuck if a fetch errors — on error, remove skeleton and show the existing error/empty state.
- List every file touched in the final report.
