# Prompt for Codex — Fix Navigation Bug + Hardening

Copy everything below into Codex.

---

A user hit this in production: clicking "Students" in the admin sidebar navigated to "Leaderboard" instead, and afterwards NO sidebar links worked at all (pages stopped changing until a manual reload). Root cause is confirmed — it is the page-transition click interceptor in `js/animations.js`. Fix it as specified below, then apply the smaller hardening items. A full static review of all 21 pages found no other wiring problems (ids, globals, REST/RPC names, script includes all verified) — so do NOT refactor anything beyond what is listed here.

## P0 — The navigation interceptor bug (js/animations.js, `handleNavigation`)

**What happens today:** `document.addEventListener('click', handleNavigation, true)` intercepts every internal `.html` link, calls `event.preventDefault()`, plays a 150ms exit animation, then navigates via `window.setTimeout(() => window.location.assign(destination), 150)`. Three defects combine:

1. **Click race → wrong page.** While a navigation is pending (`isNavigating === true`), any further click is `preventDefault()`-ed and silently discarded. Sequence: user clicks Leaderboard (or double-taps near it) → 150ms pending → user clicks Students → Students click is swallowed → pending assign fires → user lands on Leaderboard. Exactly the reported bug.
2. **Stuck flag → all links dead.** `isNavigating` is only reset on `pageshow` with `event.persisted` (bfcache restore). On a slow connection, `location.assign()` can take seconds before unload; during that whole window every click is swallowed. If the navigation stalls or is canceled (slow network, user presses Esc/stop, request fails), `isNavigating` stays `true` forever → "pages are not changing."
3. **Blank/faded page.** `sat-page-exit` animates the main content to `opacity: 0` with fill `both`. When the delayed assign never completes, the user is left staring at an invisible page.

**Required fix — make navigation instant and never suppress a click:**

- Remove `event.preventDefault()`, the `isNavigating` flag, and the 150ms delayed `window.location.assign` entirely. Let the browser handle the click natively.
- If you want to keep a visual exit effect, trigger it from the `pagehide` event (fires when the browser actually navigates away): add the `sat-page-exit` class there. No delay, no interception. Alternatively drop the exit animation and keep only the entrance animation — that is acceptable.
- Keep the entrance animation (`sat-page-enter*`) and everything else in animations.js (skeletons, loader, modals, toasts, button loading) unchanged.
- Delete now-dead code: `isInternalHtmlLink`, `handleNavigation`, the capture-phase click listener, the `isNavigating` reset inside the `pageshow` handler (keep the rest of the `pageshow` logic that restores entrance state after bfcache).
- Verify no other file depends on the removed behavior (grep for `sat-page-exit`, `handleNavigation`, `isNavigating`).

## P1 — Hardening (small, do after P0)

1. **Auth loader watchdog (js/auth-guard.js).** If `satRequireAuth()` hangs on a stalled network, the "Checking access…" overlay (z-index 1000, full-screen) blocks the page forever. Wrap the auth check in a timeout (e.g. `Promise.race` with 15s): on timeout, hide the loader and show a small inline "Connection problem — Retry" state instead of a permanently blocked page.
2. **Mobile drawer resize edge case (js/mobile-nav.js).** If the drawer is open and the window is resized above 768px, `satm-nav-open` remains on `<body>`. Add a `matchMedia('(max-width: 768px)')` change listener that calls `close()` when leaving mobile.
3. **Loader overlay pointer trap.** `.sat-loader-overlay` covers the viewport even while transparent during its 150ms delay window is fine (element not yet created), but add `pointer-events: none` to `.sat-loader-overlay.is-hiding` so a fading-out overlay can never eat a click.

## P2 — Regression test pass (manual, report results)

After the fixes, click through EVERY page in both portals and confirm:

- [ ] Rapidly clicking different sidebar links in succession always lands on the LAST clicked page (the reported bug).
- [ ] Double-clicking a sidebar link navigates normally.
- [ ] Back/forward browser buttons work on every page; no page arrives faded or blank.
- [ ] With DevTools network throttling set to "Slow 3G": clicking a link, then clicking another link before the first loads, still navigates correctly; no dead-click state.
- [ ] Admin: dashboard → students → classes → tests → builder → question bank → vocabulary → leaderboard, all reachable in sequence.
- [ ] Student: home → tests → solve (start + resume) → results → practice → question bank → vocabulary → classes → leaderboard, all reachable.
- [ ] Mobile (≤768px): hamburger opens drawer, tapping a link closes drawer and navigates, overlay tap closes drawer, resize to desktop while open leaves no stuck overlay.
- [ ] Test-solve page: module timer, answering, and submit still work (this page was excluded from the old interceptor — confirm nothing regressed).
- [ ] No console errors on any page load.

Commit with message: "fix: remove click-intercepting page transitions causing lost/stuck navigation".
