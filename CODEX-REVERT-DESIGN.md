# Prompt for Codex — Revert to the Original Design (keep Vocabulary, Question Bank, Classes)

Copy everything below into Codex.

---

Revert the recent visual redesign completely and restore the platform''s ORIGINAL design, while keeping the new features (Vocabulary, Question Bank, Classes) fully working. The redesign is currently UNCOMMITTED working-tree changes; the original design is commit `e3f72b7` (HEAD). The new feature pages are untracked files, so they survive a revert untouched — but they must be restyled to match the original design.

## Step 0 — Safety backup

Before touching anything, preserve the current state so nothing is lost:
```
git checkout -b redesign-backup
git add -A && git commit -m "backup: dsatuz-style redesign (reverted)"
git checkout main   # or the original working branch
git checkout redesign-backup -- .   # only if needed later; otherwise skip
```
Then return the working tree to the pre-revert state on the main branch by checking out main WITHOUT the backup commit''s changes (the backup branch keeps them).

## Step 1 — Identify feature wiring inside modified files (do this BEFORE restoring)

These tracked files were modified by BOTH the redesign and feature work. Diff each against HEAD and note the non-design changes that must be re-applied after restore:
- `supabase-config.js` — likely new helper(s) the feature pages call (e.g. satPatch or similar). Feature pages must not break.
- `js/student-home.js`, `js/student-tests.js`, `js/admin-test-builder.js` — may contain class-assignment or navigation wiring in addition to restyling.
- All modified `*.html` — the only feature-relevant change is usually new sidebar nav links (Vocabulary, Question Bank, Classes).

Record these needed fragments, then proceed.

## Step 2 — Restore the original design from HEAD

Restore every MODIFIED tracked file to its original version:
```
git restore -- README.md index.html *.html css/ js/ supabase-config.js
```
(Equivalently `git checkout -- <file>` per file. Do NOT delete untracked files.)

Then delete redesign-only artifacts:
- `css/base.css`, `css/theme.css` — delete; nothing restored should reference them. Grep the repo for `base.css` and `theme.css` references and remove any that remain.
- The countdown/target-score dashboard additions disappear with the restore — that is intended. Keep `migrations/003-dashboard-fields.sql` on disk (harmless, columns may already exist in the DB; do not write a down-migration).
- Keep the renamed seed `seed-practice-test-A-spr-gridin.sql`; the old `seed-practice-test-A-spr-upgrade.sql` stays deleted.

## Step 3 — Re-apply ONLY the functional wiring (in original design language)

1. **Helpers:** re-add to `supabase-config.js` any helper functions the feature pages require (from Step 1 notes) — code only, no styling.
2. **Navigation:** add sidebar links for Practice/My Mistakes (if present before), Classes, Vocabulary, and Question Bank to the student pages, and Classes/Vocabulary/Question Bank to the admin pages — using the EXACT original sidebar markup pattern and CSS classes from the restored pages (copy an existing `nav-item` block; same icons style, same classes; no new CSS frameworks or tokens).
3. **Class-based test visibility:** whatever JS changes were needed for class assignments (Step 1 notes) get re-applied without any visual changes.

## Step 4 — Restyle the feature pages to the ORIGINAL design

The untracked feature pages currently use the removed redesign system. Rewrite their markup/CSS to match the original design exactly:
- `student-classes.html`, `student-vocabulary.html`, `student-question-bank.html`, `student-practice.html` (if it uses base.css), `admin-classes.html`, `admin-vocabulary.html`, `admin-question-bank.html` + their CSS files.
- Method: take an original page as the template — copy its sidebar, topbar, fonts (Inter + Space Grotesk), CSS variables (teal accent `#3adbba`, teal-light backgrounds, existing card/table/button/modal/toast styles from the restored per-page CSS files), then port the feature content into those patterns. Each feature page''s CSS should look like a sibling of the original per-page stylesheets (define the same `:root` variables the originals use), NOT like the redesign.
- Keep ALL feature functionality identical: vocabulary lists/flashcards/quiz, question bank filters/sessions/server-graded checks, classes membership and class-assigned tests.

## Step 5 — Verify

- [ ] `git diff` on originally-tracked files shows ONLY: added nav links + re-applied helper/wiring code. Zero CSS changes to restored stylesheets.
- [ ] No file references `base.css` or `theme.css`; both are deleted.
- [ ] Every original page looks exactly as it did at commit `e3f72b7`.
- [ ] Vocabulary, Question Bank, Classes all still work end-to-end (flashcards, quiz, filtered sessions with server-side answer checks, class-assigned test visibility).
- [ ] Feature pages are visually indistinguishable in style from the original pages (same sidebar, same teal palette, same card/button styles).
- [ ] The exam solve flow, results, leaderboards, and admin pages all function as before.
- [ ] Everything works at commit time: commit the result with a clear message, e.g. "revert redesign to original look; keep vocabulary, question bank, classes".

The backup branch `redesign-backup` must remain so the redesign can be recovered later if wanted.
