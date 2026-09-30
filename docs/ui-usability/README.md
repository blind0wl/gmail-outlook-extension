# Focused popup usability — synthetic verification

Date: 2026-09-30. Base main e94de2e; implementation candidate on
fix/popup-usability. T3 collaborative Chromium 152.0.7977.130 / Electron 44.4.2,
Linux x86_64. This is the production popup loaded by the synthetic fixture;
it never reads real extension accounts or tokens.

## Captures

- populated-380.png: 380 × 600, scrollable typical popup.
- populated-full.png: 404 × 1200, whole-surface reference; actual extension
  popups scroll and do not use this tall viewport.
- long-320.png: 320 × 600, long unbroken identity and expanded cached text.
- error-480.png: 480 × 600, offline/backoff accounts.
- add-gmail-380.png: 380 × 600, add form with focused email field.

All captured content is synthetic. Previous docs/ui-baseline captures remain
historical. Normal rendered visuals are unchanged by later aria-only names
and pending-state correction; the source identities below bind final code.

## Browser checks actually run

Baseline 380px viewport: root scroll width 404px vs client width 365px,
Sound h2 24px, three nested button structures. Those defects are corrected.

Round 1: empty, populated, expanded, signed-out, error and long states at
320/380/404/480 × 600. Every root scrollWidth equals clientWidth, including
native vertical scrollbars; no nested interactive buttons; all visible action
buttons at least 32px high. Long expanded subject/snippet and full addresses
wrap instead of widening the popup. Form also fits at 380px.

Confirmation: long 320 × 600 (305px client), populated 380 × 600 (365px
client), populated 404 × 1200 (404px client), error 480 × 600 (465px client),
and Gmail form 380 × 600 all remain without horizontal overflow.

- Native Enter on summary expands, marks locally read, keeps summary focus,
  and opens no provider URL. Tab then Enter on Open creates the account-aware
  Gmail URL and keeps Open focus.
- Native Space on Open opens once with summary still collapsed; Space on
  summary expands while open count is unchanged.
- Tab sets :focus-visible, with a solid 2px rgb(26,115,232) outline. Initial
  programmatic/mouse focus correctly did not force keyboard-only styling.
- Space on per-account chime changes its checked state and retains the
  checkbox after storage rebuild. ArrowRight on volume updates visible and
  spoken percentage to 51% with slider focus retained.
- Add opens/focuses email; Cancel hides the form and returns to its launcher.
- Deferred account action + cache update exposed native-disabled replacement
  losing focus in actual Chromium (BODY). A focused regression then failed.
  The correction uses aria-disabled plus a repeat-activation guard. Browser
  retest: focused sign-out retained; one request despite repeated activation;
  aria-disabled changes true to false after completion with focus retained.

Independent review then found the separate recovery Sign in path omitted
focus/pending restoration. A new DOM regression failed before repair. Targeted
Chromium retest after repair: cache and accountState refresh retain recovery
focus and “Signing in…”/aria-disabled=true; both sign-in locations share one
request despite repeat activation. Completion restores aria-disabled=false
with focus retained; removal deliberately focuses Add Gmail. The account
management and recovery paths now share the same pending-action set.

A no-store fixture server on 8766 avoided cached old assets on the earlier
8765 server; the initial stale-asset load is excluded from candidate evidence.
Impeccable detector ran once and returned []; the later focused pending-state
and aria naming correction was verified with DOM/browser checks rather than
another design scan. Styling preserves existing palette/flat system font.
The primary text/control colors are unchanged; no new contrast palette.

No provider request was made by popup code. The fixture itself fetches local
HTML/modules and substitutes Chrome APIs. No actual extension install, auth,
native notification or screen-reader certification is claimed. Owner checks
remain in docs/acceptance/2026-09-30-popup-usability.md.

## Final source SHA-256

- `src/popup/popup.html`: `3373f5560401db90a8953a375f270035b694a2769320fe1212fefed766ea6222`
- `src/popup/popup.css`: `f139c8a5023303dbf6579e363ee52a039fc1a5dbf3e7deb601ad29846805d961`
- `src/popup/popup.js`: `20a34d6546d6e04c7e3a50907de22325df9ef1ce4b878eae9dd2b6cfbbb0a45f`
- `src/popup/links.js`: `9706c9e4b1ee5ac0417c9c523557894d9b9491c1349126a2c9f9eb76f5277451`
- `tests/visual/popup-fixture.js`: `910bf87053b539ba73412a5756c065fc29a94fefbec9083fc0851c6840395151`
