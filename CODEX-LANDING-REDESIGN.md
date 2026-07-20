# Prompt for Codex — Full Landing Page Redesign (index.html)

Copy everything below into Codex.

---

Rebuild the landing page (`index.html` + `css/index.css`) from scratch as a modern, animated, user-friendly marketing page. This touches ONLY the landing page — do not modify any admin/student pages, JS logic, Supabase code, or shared CSS other than what's listed here. Keep all platform invariants: vanilla HTML/CSS/JS, no build step, no frameworks, no new dependencies.

## Step 0 — Safety

Commit current state first: `git add -A && git commit -m "checkpoint: before landing redesign"`. Then work on the redesign so it's trivially revertable.

## Keep (do not lose)

- Brand identity: 4Prep colors — navy `#0b1628`, teal `#3CDBBF` (+ existing accent palette violet/amber/coral/sky in `css/index.css` `:root`). Reuse these tokens; you may extend them.
- The `<fourprep-logo>` web component (`js/logo.js`, `css/logo.css`) in nav and footer.
- Fonts: Inter + Space Grotesk from Google Fonts (already linked).
- All links: `student-login.html`, `admin-login.html`, `#platform` anchor.
- Head metadata: favicons, manifest, theme-color, viewport.
- Shared animation infra: keep `css/animations.css` and `js/animations.js` linked; new landing-specific animations go in `css/index.css` (or inline `<script>` at end of body), NOT into the shared files.
- Real facts only — this platform has: full SAT-style tests (98 questions, 4 modules, module timers), answer review, score history up to 1600, class leaderboard, vocabulary practice, question bank, classes. Do NOT invent fake stats (users count, ratings, testimonials with fake names).

## New page structure

Build these sections in order:

1. **Sticky nav** — transparent over hero, gains blur + background + shadow after ~50px scroll (JS class toggle). Mobile: hamburger that opens a slide-down menu (animated, closes on link tap and Escape). Links: Platform, Features, Admin, and a prominent "Student login" button.
2. **Hero** — full-viewport, navy gradient background with animated elements: slow-moving gradient blobs or subtle floating geometric shapes (CSS keyframes, GPU-only transforms). Headline with a gradient-text accent, subline, two CTAs (Student login primary, Admin access secondary). Staggered entrance: eyebrow → headline → text → buttons fade-in-up on load. Include a **3D animated visual** on the right side (see "3D effects" below): a mock test-card / scorecard built in pure HTML/CSS (score ring, answer choices with a "correct" tick animating in on a loop) that tilts in 3D toward the cursor — NOT an image.
3. **Stats band** — the 3 real stats (98 questions, 4 modules, 1600 score tracking). Numbers count up from 0 when scrolled into view (IntersectionObserver, ~1s, respects reduced-motion by rendering final value instantly).
4. **Features** (`id="platform"`) — 6 cards: Assigned tests, Timed practice, Answer review, Progress dashboard, Vocabulary practice, Question bank. Icon in a colored tint circle (rotate through the accent palette), hover lift + icon wiggle/scale. Cards reveal with staggered fade-in-up on scroll.
5. **How it works** — 3 numbered steps (Sign in with instructor credentials → Take assigned tests → Review answers and track growth), connected by a line that draws in on scroll (scaleX transform). Steps reveal sequentially.
5b. **Platform showcase carousel** — an auto-advancing carousel (one slide visible, ~5s interval) cycling through the platform's areas: Practice tests, Answer review, Leaderboard, Vocabulary, Question bank. Each slide = a stylized pure-CSS mock UI panel (mini progress bars, answer bubbles, rank rows — no screenshots, no images) + short caption. Requirements: dot indicators + prev/next arrows, pause on hover/focus, swipe support on touch (pointer events), infinite loop, slides animate with translateX + slight 3D depth (outgoing slide recedes with `rotateY`/`scale`). Keyboard accessible (arrows work, dots are buttons with `aria-label`), `aria-roledescription="carousel"`, auto-advance disabled under reduced-motion.
6. **CTA band** — gradient navy→teal band, "Ready to continue?" heading, Student login + Admin login buttons. Subtle animated shine or floating dots.
7. **Footer** — logo lockup, login links, copyright line.

## 3D effects (make these impressive but tasteful)

All pure CSS 3D (`perspective`, `transform-style: preserve-3d`, `rotateX/rotateY/translateZ`) + a little JS — no WebGL, no Three.js, no libraries.

- **3D logo moment:** in the hero, wrap `<fourprep-logo>` (or a larger duplicate near the headline) in a 3D stage: slow continuous Y-axis rotation OR an entrance where it flips in (`rotateY(-180deg)→0`) with layered depth (duplicate shadow layer offset in `translateZ` for thickness). On hover: speeds up / tilts toward cursor. Do NOT modify `js/logo.js` — wrap it from outside.
- **Cursor-tilt hero card:** hero scorecard tracks the mouse (`mousemove` on the hero, max ±10deg rotateX/rotateY, eased with a small lerp in rAF), with a glare/light-sweep pseudo-element that follows the tilt. Resets smoothly on mouseleave. Desktop only (pointer:fine); static on touch.
- **3D feature cards:** subtle per-card tilt on hover (±6deg) with inner elements at different `translateZ` depths (icon pops forward).
- **Depth parallax:** hero background blobs move at slightly different rates on scroll (`translateY` via rAF-throttled scroll listener) for a layered 3D feel.
- All 3D effects fully disabled under reduced-motion and on touch devices where hover doesn't exist.

## Animation rules

- Scroll reveals: one `IntersectionObserver` (threshold ~0.15, unobserve after reveal) adding `.in-view`; elements start `opacity:0; translateY(16px)` and transition in 400–500ms `ease-out`, staggered 60–80ms via `transition-delay` or `--i` custom property.
- Micro-interactions: buttons hover lift (translateY(-2px) + shadow) and press (scale .97); nav links animated underline; smooth scroll for `#platform` (already have `scroll-behavior: smooth`).
- Ambient hero motion: 20–30s loops, very low amplitude, `transform`/`opacity` only.
- Everything respects `@media (prefers-reduced-motion: reduce)`: kill ambient loops and count-up, reduce reveals to opacity-only or none.
- Animate only `opacity` and `transform`. No layout-triggering properties, no scroll-jacking, no libraries.
- Content must be visible if JS fails: apply hidden initial states via a JS-added class on `<html>` (e.g. `js-anim`), so no-JS users see everything.

## Quality bar

- Fully responsive: 375px, 768px, 1440px. Mobile nav must work; hero visual may hide or simplify on small screens.
- Semantic HTML (`header/nav/main/section/footer`), aria-labels on nav and icon-only elements, `aria-expanded` on hamburger, visible focus states.
- Lighthouse-friendly: no CLS from animations (reserve space), decorative elements `aria-hidden="true"`.
- Keep the landing JS self-contained (~250 lines max): nav scroll state, hamburger, IntersectionObserver reveals, count-up, carousel, tilt/parallax. All rAF-based, no per-frame layout reads (cache rects on resize).

## QA before finishing

- Test at 375px / 768px / 1440px widths.
- Test with reduced-motion emulated: page fully readable, no stuck hidden elements.
- Test with JS disabled: all content visible.
- Verify all 4 links navigate correctly and `#platform` scrolls.
- Verify back/forward (`pageshow` bfcache restore) doesn't leave the page faded out.
- Verify carousel: swipe works on touch, arrows/dots/keyboard work, pauses on hover, no layout shift between slides.
- Verify 3D tilt doesn't jitter (lerped) and the page stays 60fps while scrolling with hero animations running.
- List every file touched in the final report.
