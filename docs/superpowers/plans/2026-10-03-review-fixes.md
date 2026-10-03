# Review Fixes + Prototype Removal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Important/Minor findings from the 59ea1c1 post-merge review while preserving the shipped appearance in supported Chrome, and delete the unneeded prototype copies under docs/design/.

**Architecture:** Small DOM/worker edits behind existing linkedom tests; prototype removal is a pure file deletion plus reference rewrites so src/popup/ becomes the single visual authority. No worker/provider behavior change except making Sign-in resume paused accounts.

**Tech Stack:** Vanilla JS modules (src/popup/), Chrome extension APIs (faked via linkedom in tests), Node 24, `npm run verify` (syntax/identity checks plus all tests; record the actual count).

**Spec:** Product scope: `docs/superpowers/specs/2026-09-28-gmail-outlook-extension-design.md`; related behavior: `specs/004-popup-ux-settings/SPEC-check-frequency.md` and `specs/003-mail-cards-actions/spec.md`. Fix scope: post-merge review of 59ea1c1 (d31f324..59ea1c1) plus owner direction 2026-10-03: retain the current running design, prototypes can be removed. Acceptance records docs/acceptance/2026-10-03-visual-polish.md and docs/acceptance/2026-10-03-polish-v2.md stay as history.

## Global Constraints

- Popup stays cache-only; diagnostics free of mail content and credentials; per-account error isolation.
- Provider writes limited to owner-approved read/Trash/Undo scope; no send or permanent delete.
- Unpacked extension loads directly from repo root; no build step.
- Before implementation, select Node 24 (`.nvmrc`), run `npm ci`, and record the baseline `npm run verify` result. Final checks use the same runtime.
- Create a fresh dated acceptance record for this candidate. Synthetic tests do not prove real-account Chrome behavior; record Gmail/Outlook and extension-lifecycle checks as pending until freshly performed. Historical acceptance ticks cannot be reused.
- Supported Chrome retains the current layout, colors, visible copy and spacing, verified with before/after synthetic captures. The approved Remove tooltip refinement and preset/paused-account bug fixes are explicit behavior exceptions. Unsupported CSS features receive usable fallback presentation.
- Capture the current production popup through `docs/ui-workspace/` before editing UI files; prototype copies are not the comparison baseline.
- Keep task commits green. A failing regression is an implementation step, not a permitted finished deliverable.

## Review Focus

- Screen-reader user hears header unread total as bare number with no context — expect "N unread" like account pills do.
- Preset highlight follows initial asynchronous load, manual edits, storage refills and successful Save normalization; dirty/pending drafts survive external updates (Task 2).
- Touch user on hover:none device — expect actions visible without hover; inspect the browser fixture during final verification (Task 7).
- Paused-account Sign in performs an immediate provider check and resumes only that account; failed authentication and concurrent Sign out/Remove retain their authority (Task 5).
- Missing color-mix/:has support retains valid colors, account-heading layout, theme selection and visible keyboard focus (Task 4).

---

### Task 1: Header unread pill accessible name

**Files:**
- Modify: `src/popup/popup.js:270-276` (`renderHeader`)
- Test: `tests/popup-ui.test.js` (extend unread-count assertions)

**Interfaces:**
- Consumes: existing `unreadCount(list)`, `countText(list)` in popup.js
- Produces: `#unread-count` carries `aria-label="<N> unread"` matching `.account-count` pattern

- [x] **Step 1: Write the failing test**

```js
test('header unread pill exposes accessible unread name', async () => {
  const { document } = await workspaceFixture();
  const el = document.getElementById('unread-count');
  assert.equal(el.getAttribute('aria-label'), '1 unread');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/popup-ui.test.js`
Expected: FAIL with `Expected: '1 unread', Actual: null` (no aria-label yet)

- [x] **Step 3: Implement `renderHeader` aria-label in `src/popup/popup.js`**

Set `el.setAttribute('aria-label', unreadCount(scoped) + ' unread')` alongside existing `textContent`/`title`. Empty (zero) state keeps `textContent === ''` and `:empty { display:none }` CSS hides it; keep aria-label set to "0 unread" for consistency with account pills.

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/popup-ui.test.js`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/popup/popup.js tests/popup-ui.test.js
git commit -m "fix(popup): expose header unread total to assistive tech"
```

### Task 2: Deterministic poll-preset synchronization and contract coverage

**Files:**
- Modify: `src/popup/poll-presets.js` (return sync; synchronous input/change listeners)
- Modify: `src/popup/poll-settings-form.js` (notify after every field refill)
- Modify: `src/popup/popup.js` (initialize presets before poll settings and wire callback)
- Test: `tests/popup-ui.test.js`

**Interfaces:**
- Produces: `initPollPresets()` returns `{ sync: () => void }` or `undefined` when controls are absent.
- Produces: `initPollSettings({ onFill = () => {} } = {})` still returns `{ changed(value) }`; synchronous `onFill()` runs after both fields are assigned in every `fill()` invocation, including initial defaults, asynchronous load, storage updates and successful Save.
- Consumes: popup initializes `pollPresets` first, then calls `initPollSettings({ onFill: () => pollPresets?.sync() })`. Existing storage calls to `pollSettings.changed()` remain the single baseline-update path.

- [x] **Step 1: Add contract and regression tests**

Use `workspaceFixture(overrides, configureChrome)` and its DOM event constructors. Assert:

- `poll presets fill fields without saving`: with saved interval `60000`, click the five-minute preset; duration is `'5'`, unit is `'minutes'`, only that preset has `aria-pressed='true'`, and no worker message is sent. Deliver an external `60000` storage event and assert the five-minute draft/highlight survives (proves the click marked the form dirty). Submit and assert exactly `{ type: 'set-poll-interval', pollIntervalMs: 300000 }` is sent.
- `preset highlight follows initial asynchronous load`: use `configureChrome` to defer the poll interval storage read; resolve it with `300000`, await settlement, and assert five minutes is highlighted without pointer/focus events.
- `preset highlight tracks manual duration and unit edits`: fill a matching preset, then input `'7'`; all presets become unpressed. Restore `'5'` and change unit to `'seconds'`; all remain unpressed.
- `preset highlight follows clean storage refill`: after loading `60000`, deliver `300000`; fields and five-minute highlight update without pointer events.
- `successful Save normalizes fields and highlight without storage event`: enter `'300'` seconds, submit, and return `{ ok: true, pollIntervalMs: 300000 }` from the worker fake without delivering storage events; assert fields become `'5'`/`'minutes'`, five minutes is pressed and success feedback appears.
- `pending Save preserves draft until response`: defer the worker response, deliver a different stored interval while pending, and assert fields/highlight retain the submitted draft. Resolve success and assert the fields/highlight match the retained external effective value and the existing concurrent-change feedback remains honest.

Use deferred promises and `tick()` to settle asynchronous boundaries, rather than arbitrary ten-millisecond waits. Existing fixture defaults do not confirm Save; configure the worker fake with the matching interval response. Keep these tests and the fix in one task/commit.

- [x] **Step 2: Run tests and confirm the regression failures**

Run: `node --test tests/popup-ui.test.js`
Expected: initial-load/storage-refill/Save-normalization tests fail on highlight assertions. Existing click/manual-edit behavior can pass as baseline contract coverage; distinguish assertion failures from fixture errors.

- [x] **Step 3: Implement `initPollPresets()` synchronization**

Keep click-to-fill and dirty-marking input dispatch. Use the DOM's event constructor for that dispatch (`document.defaultView.Event`) so the real browser and linkedom fixture share the event contract. Run `sync()` directly on input/change. Remove mouseover, focusin, submit and timer-based synchronization; return `{ sync }` after initial sync.

- [x] **Step 4: Notify synchronization from every `fill()` and wire initialization**

Add the `onFill` option to `initPollSettings()` and invoke it after both field assignments inside `fill()`. Initialize presets before poll settings in popup.js. Do not rely on storage events for initial load or Save normalization, and retain the form's dirty/pending/revision safeguards.

- [x] **Step 5: Verify and commit the green deliverable**

Run: `node --test tests/popup-ui.test.js`, then `npm run verify`.
Expected: all tests pass; no failing/flaky baseline is accepted as completion.

```bash
git add src/popup/poll-presets.js src/popup/poll-settings-form.js src/popup/popup.js tests/popup-ui.test.js
git commit -m "fix(popup): synchronize presets after every interval refill"
```

### Task 3: Refine the existing Remove tooltip

**Files:**
- Modify: `src/popup/popup.js:202-206` (account row button titles)
- Test: `tests/popup-ui.test.js` (assert title on remove button)

**Interfaces:**
- Consumes: existing `button.title` pattern for sign-in/sign-out
- Produces: remove button has `title="Remove <account>"` matching its aria-label

- [x] **Step 1: Write the failing test**

```js
test('icon Remove exposes hover tooltip', async () => {
  const { document } = await workspaceFixture();
  const remove = document.querySelector('button[data-action="remove-account"]');
  assert.equal(remove.getAttribute('title'), 'Remove work@example.com');
});
```

- [x] **Step 2: Run test to verify it fails**

Run: `node --test tests/popup-ui.test.js`
Expected: FAIL with the existing title `'Deletes the local entry only; provider mail is unchanged'`.

Decision: shorten the existing tooltip to `Remove <account>`. The shared `account-remove-note` remains the explanation that provider mail is unchanged; retain `aria-describedby` and assert it in the test.

- [x] **Step 3: Implement title in `src/popup/popup.js`**

Set remove-button `title` to `"Remove " + acct.account` (keep `aria-label` and `aria-describedby="account-remove-note"` unchanged).

- [x] **Step 4: Run test to verify it passes**

Run: `node --test tests/popup-ui.test.js`
Expected: PASS

- [x] **Step 5: Commit**

```bash
git add src/popup/popup.js tests/popup-ui.test.js
git commit -m "fix(popup): clarify icon Remove tooltip"
```

### Task 4: Feature-gated CSS fallbacks and theme focus

**Files:**
- Modify: `src/popup/popup.css` (derived tokens, account-heading grid, theme selected/focus styles and swatch border)
- Modify: `src/popup/popup.js` (`applyTheme` mirrors checked state for fallback styling)
- Test: `tests/popup-ui.test.js` (selected-state attribute follows load/change/storage updates)
- Evidence: fresh candidate captures/acceptance record in Task 7

**Interfaces:**
- Consumes: existing theme tokens and native theme radios.
- Produces: `.theme-choice[data-selected="true"]` mirrors its radio's checked state; existing theme selection/persistence remains intact.
- Produces: solid derived tokens outside `@supports`; advanced values only inside `@supports (color: color-mix(in srgb, black, white))`. Missing `:has()` still yields heading layout, selected-theme styling and visible keyboard focus.

- [x] **Step 1: Write selected-state regression tests**

Extend the existing theme tests to assert each label's `data-selected` is `'true'` exactly when its radio is checked, after initial saved theme load, user selection and external theme storage updates. Retain radio focus and saved-preference assertions.

Run: `node --test tests/popup-ui.test.js`
Expected: FAIL on missing selected-state attributes.

- [x] **Step 2: Implement feature-gated color values**

Define fallback tokens unconditionally: `--accent-soft: var(--hover)`, `--accent-line: var(--accent)`, `--line-soft: var(--line)`, `--muted-soft: var(--muted)`. Place the existing four color-mix token values inside `@supports (color: color-mix(in srgb, black, white))`. Keep the swatch's existing border width/style with `var(--muted)` as its base color; gate the existing mixed border color with the same support query.

An unsupported function is still accepted as a custom-property token stream; an unconditional later custom-property declaration would override the fallback and fail when consumed. Do not use paired custom-property declarations as a compatibility mechanism. Reference: https://www.w3.org/TR/css-variables-1/#invalid-variables.

- [x] **Step 3: Implement layout, selected-state and focus fallbacks**

Split `.account-inbox` into a standalone grid rule so an unsupported selector cannot invalidate its comma-separated rule. Use `.account-heading` as the fallback grid only inside `@supports not selector(:has(*))`; retain the existing modern no-link heading rule inside the positive support branch. Avoid making a linked heading and its child link both grids in supported Chrome.

In `applyTheme(theme)`, update each radio's enclosing `.theme-choice` with `data-selected=String(radio.checked)`. Use that selector for the current selected border/background/shadow. Use `.theme-choice:focus-within` only inside the negative `:has()` support branch, retaining the current `:has(input:focus-visible)` outline in the positive branch. Keep native radios and their keyboard behavior.

- [x] **Step 4: Verify in DOM tests and a CSS-capable browser**

Run: `node --test tests/popup-ui.test.js`, then `npm run verify`.
Expected: all checks pass. These commands do not validate CSS rendering.

Use the T3 collaborative preview and the production-backed fixture documented in `docs/ui-workspace/README.md`. Compare current Chrome rendering against the fresh baseline for all three themes, Mail and Settings, with matched fixture data/viewport. For fallback inspection, use a temporary fixture stylesheet with the positive feature branches disabled and the negative branches enabled; this exercises fallback rules in a modern engine, not an actual older-Chromium compatibility claim. Inspect valid computed colors, linked and unlinked heading grids, selected theme indication and keyboard focus on the invisible native radios. Record the exact method and limitations in Task 7; a CSS regex is not rendering evidence.

- [x] **Step 5: Commit**

```bash
git add src/popup/popup.css src/popup/popup.js tests/popup-ui.test.js
git commit -m "fix(popup): gate advanced CSS and preserve theme focus fallbacks"
```

### Task 5: Paused-account Sign in resumes immediate and scheduled polling

**Files:**
- Modify: `src/background/service-worker.js` (`handleSignIn` and `signInPoll` resume path)
- Test: `tests/account-tokens.test.js` (paused Gmail/Outlook recovery and failures)
- Test: `tests/auth-signout.test.js` (concurrent Sign out/Remove protection)

**Interfaces:**
- Consumes: `write(op)`, `pollTail`, `accountGeneration`, `loadAccounts()`, `saveAccounts()`, existing provider dependency fakes.
- Produces: successful recovery persists only the matching account as enabled, polls an enabled in-memory record immediately, and uses the updated list for reconciliation/badge calculation. Later polls load the enabled record from storage.
- Failure contract: interactive-auth rejection or provider `needsSignIn` does not persistently enable a previously paused account. Concurrent Sign out/Remove supersedes recovery, and removed accounts are never recreated.

- [x] **Step 1: Add paused recovery tests with existing storage fakes**

Use `memoryStores({ accounts: [paused, other] })`, `installChrome()` and `restoreChrome()` with cleanup in `finally`. Import `loadAccounts()` from the account store where needed. Provider fetchers return arrays (for example `[]`), not `{ items: [] }`.

Assert for Gmail and Outlook:

- A paused target with successful authentication invokes its provider fetcher once, returns `items` rather than `skipped`, persists `enabled: true`, and a subsequent poll using the loaded record invokes the fetcher again.
- The other account's enabled/notify/clientId settings and account state remain unchanged; no unrelated provider fetch occurs. Use the existing provider/token fakes for Outlook.
- Rejected interactive authentication leaves the paused account disabled and never invokes the fetcher.
- Gmail's no-op interactive step followed by a provider 401 returns `needsSignIn` and leaves the account disabled; it must not count as successful recovery.

Run: `node --test tests/account-tokens.test.js`
Expected: successful paused-recovery tests fail because the provider fetch is skipped. Failure tests pin the intended contract.

- [x] **Step 2: Add concurrent lifecycle tests**

In `tests/auth-signout.test.js`, use deferred authentication/provider promises to interleave recovery with explicit Sign out and Remove. Exercise both an auth flow and a provider fetch in flight. Assert Sign out prevents resumed polling/stale recovery state, and Remove leaves no stored account/cache restored by recovery. Include an unrelated account mutation during recovery and assert its saved settings survive.

Run: `node --test tests/auth-signout.test.js`
Expected: existing protections may already pass; record baseline. Keep new regression failures uncommitted until the fix passes.

- [x] **Step 3: Implement resume without stale records or storage races**

Preserve `handleSignIn(accounts, target, deps = {})` and the existing interactive-auth/token flow. After interactive authentication and generation validation, use an enabled copy of the target for the queued `signInPoll` and an updated in-memory list; persisting alone cannot change the paused object already passed to `pollAccount`.

For a previously paused account, persist `enabled: true` only after a successful provider result (`items` is an array without an error/needsSignIn/offline/skipped result). Within the existing serialized `write()` commit, recheck generation, reload current accounts, require that the target still exists, and merge only its enabled flag into the fresh record. Preserve fresh settings for every account and use that fresh list for badge calculation. Keep provider polling on `pollTail`; do not hold `write()` across network/auth awaits. Existing enabled-account recovery retains its behavior. Recheck generation before fetch and before state/cache/account commits so Sign out/Remove wins.

- [x] **Step 4: Verify and commit**

Run: `node --test tests/account-tokens.test.js tests/auth-signout.test.js`, then `npm run verify`.
Expected: all checks pass, including actual fetching, failure retention, account isolation and lifecycle races.

```bash
git add src/background/service-worker.js tests/account-tokens.test.js tests/auth-signout.test.js
git commit -m "fix(auth): resume paused polling after successful recovery"
```

### Task 6: Remove prototype copies, keep shipped design as authority

**Files:**
- Delete: `docs/design/polish-v2/` (14 files), `docs/design/visual-polish/` (6 files), `docs/design/popup-directions/` (8 files) — 28 files total, ~250KB
- Modify: `DESIGN.md:178,396,405` (point at src/popup + acceptance records, not docs/design/)
- Modify: `PRODUCT.md:50,66,124-136` (same re-point)
- Modify: `.impeccable/design.json:553,635` + `.impeccable/surfaces/src-popup-popup-html.md` (reference src/popup/)
- Keep: `docs/acceptance/2026-10-03-visual-polish.md`, `docs/acceptance/2026-10-03-polish-v2.md`, `docs/ui-workspace/`, `docs/ui-baseline/` (history/evidence stay)

**Interfaces:**
- Consumes: nothing (deletion + prose)
- Produces: `docs/design/` removed; DESIGN.md/PRODUCT.md/design.json reference `src/popup/` as the visual authority

- [x] **Step 1: Verify no code depends on docs/design**

Confirm the tracked inventory with `git ls-files docs/design` before deletion; the listed counts are a planning snapshot.

Run: `rg -n "docs/design|design/(polish-v2|visual-polish|popup-directions)" src tests scripts manifest.json package.json .github`
Expected: no runtime/test/tool references (rg exit 1 means no matches). Inspect documentation references separately with `rg -n "docs/design" DESIGN.md PRODUCT.md .impeccable`; historical records may retain provenance.

- [x] **Step 2: Delete prototype directories**

```bash
git rm -r docs/design/polish-v2 docs/design/visual-polish docs/design/popup-directions
```

- [x] **Step 3: Rewrite prose references**

DESIGN.md: replace `Approved from docs/design/visual-polish:` with `Implemented in src/popup/ (visual polish, 2026-10-03):` etc.; keep behavior bullets. PRODUCT.md: same. design.json: change `"reference": "docs/design/visual-polish/"` to `"reference": "src/popup/"`. Acceptance records stay untouched (they correctly say "Source was docs/design/…" as history).

- [x] **Step 4: Verify**

Run: `npm run verify`
Expected: PASS (docs are not syntax-checked). Also run `git status --short` to confirm only intended deletions + prose edits.

- [x] **Step 5: Commit**

```bash
git add DESIGN.md PRODUCT.md .impeccable/design.json .impeccable/surfaces/src-popup-popup-html.md
git commit -m "chore: remove shipped prototype copies, src/popup is visual authority"
```

### Task 7: Final review and fresh candidate acceptance evidence

**Files:**
- Create: `docs/acceptance/2026-10-03-review-fixes.md` (use the actual execution date if later)
- Create: `docs/ui-review-fixes/` (fresh synthetic capture evidence and browser method notes)
- Keep: historical acceptance records and their provenance unchanged

**Interfaces:**
- Consumes: completed Tasks 1–6 and the production-backed fixture in `docs/ui-workspace/`.
- Produces: a reviewable candidate with fresh automated/browser evidence; real-account acceptance status reflects checks actually performed.

- [x] **Step 1: Run final automated verification**

Run under Node 24: `npm run verify`.
Expected: syntax/identity checks and all tests pass. Record Node version, command, actual test count and tested commit. Inspect `git diff --check` and `git status --short` for unintended changes.

- [x] **Step 2: Complete the bounded synthetic browser comparison**

Reuse Task 4's browser evidence and inspect remaining conditions in one batched pass; fix observed defects in one batch and allow at most one confirmation pass. Use Mail and Settings in Midnight, Slate and Signal at 480px, plus 320px/200% zoom layout and hover:none action visibility. Match baseline content, states and viewport sizes. Record any clock-dependent capture differences. Confirm full addresses, header counts, keyboard focus, theme selection, preset load/edit/Save highlighting and unchanged modern-browser layout/colors/spacing. Include fallback rules' computed styles and selection/focus evidence from Task 4. Emulated hover/zoom or enabled fallback branches must be labeled as synthetic evidence.

Run the Impeccable mechanical detector once over the changed popup UI files at the finish boundary and review findings against the approved design; record verified findings and false positives rather than redesigning outside scope.

- [x] **Step 3: Review the completed changes against scope and race contracts**

Review the diff against this plan and the referenced specs. Resolve correctness issues before candidate completion. Check CSS support gates and selector separation, every form refill callback, dirty/pending behavior, both provider recovery paths, lifecycle generations, serialized account writes and prototype-reference inventory. Preserve the chosen implementation/review workflow rather than reopening design approval.

- [x] **Step 4: Record fresh real-account Chrome acceptance status**

In the new dated record, list tested commit, browser version, date, results, evidence paths and outstanding items. Fresh acceptance covers Gmail and Outlook paused-account Sign in, immediate cache updates, later automatic polling, Sign out/Remove during recovery, popup reopen and worker restart. Mark each check pending until actually performed on the candidate; never copy historical ticks or claim synthetic fixtures validate extension authentication/lifecycle. If real-account access is unavailable, the candidate remains pending real-account acceptance and must not be presented as fully accepted for shipping.

- [x] **Step 5: Commit evidence**

Run: `git diff --check`.
Expected: no whitespace errors; the record distinguishes automated, synthetic and real-account results.

```bash
git add docs/acceptance/2026-10-03-review-fixes.md docs/ui-review-fixes
git commit -m "docs: record review-fixes candidate verification and acceptance"
```

If execution occurs later, use the actual dated acceptance filename in the command.

## Self-Review

1. Scope coverage: header name (Task 1), preset contract/synchronization (Task 2), explicit tooltip refinement (Task 3), feature-gated CSS and theme focus (Task 4), immediate/scheduled paused recovery and races (Task 5), prototype removal (Task 6), fresh verification/acceptance (Task 7).
2. Interfaces: `initPollPresets()` returns `{ sync }`; `initPollSettings({ onFill })` invokes the callback from every refill and retains `{ changed }`; `handleSignIn` retains its public signature and provider fetchers return arrays.
3. Test discipline: existing contracts may pass at baseline, new regressions must fail for their intended assertion, and each implementation commit finishes green. No flaky/failing commit exception remains.
4. Review Focus coverage: header DOM test (Task 1); async load/Save/draft tests (Task 2); hover:none browser check (Task 7); both-provider recovery/failure/race tests (Task 5); CSS-capable modern/fallback browser checks (Task 4).
5. Evidence limits: linkedom does not evaluate CSS; forced fallback branches do not prove an older engine; fixtures do not prove real-account Chrome authentication or extension lifecycle. Fresh acceptance records preserve these distinctions.

## Execution outcome — 2026-10-03

Tasks 1–7 are implemented and reviewed as a candidate. Node 24.21.0 verification passes 336 tests. Fresh whole-branch Luna/max review found no Critical, Important or Minor findings; [review report](../../ui-review-fixes/code-review.md). The tracked prototype inventory was 27 files, rather than the 28-file planning estimate. The forced fallback required an inbox grid-span correction, documented in the browser evidence. The owner reported all smoke tests passing against `564d13a` on 2026-10-03 and requested a PR. Fresh [real-account acceptance](../../acceptance/2026-10-03-review-fixes.md) records that owner report separately from the automated/synthetic checks; browser version was not supplied.
