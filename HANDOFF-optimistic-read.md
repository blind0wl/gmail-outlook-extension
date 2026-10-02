# Handoff — optimistic read/unread + opened-here leaves instantly (PR #25 branch)

## Where
- Worktree: `/home/dave/.t3/worktrees/gmail-outlook-extension/t3code-97b20972`
- Branch: `t3code/investigate-email-limits-full-preview` (tracks `origin/...`)
- Last pushed: `5ea4877` (v3 card look). PR: https://github.com/blind0wl/gmail-outlook-extension/pull/25
- Uncommitted (DO NOT LOSE): `src/popup/popup.js`, `tests/popup-ui.test.js` — optimistic-read work. Nothing else modified. No stash needed (one old unrelated stash exists on another branch; leave it).

## Owner direction (binding)
- Read/unread toggle and Opened-here: card leaves instantly, provider write runs silently in background.
- Tell the user NOTHING on progress/success. Only errors surface, and on error the card repopulates.
- Gmail unread transport still has no verified opcode → Gmail toggle stays disabled with title text (no silent send). Outlook unread uses `isRead:false` PATCH (already implemented, committed in `273244c`).

## Implemented in working tree (uncommitted)
- `displayedItems()`: any read feedback (pending OR confirmed) hides the card; `localRead===true` (opened-here) hides too; unread feedback still shows.
- `settleMailFeedback()`: keep the OLD conditional delete (`read` confirmed deletes only when cache no longer says unread) — unconditional delete re-shows the card and caused a false hang chase.
- `markRead()`: re-added `renderList()` so opened-here leaves instantly (header-only render was not enough).
- `actOnMail()`: `optimisticRead` skips the "Marking as read…" progress line; success path skips the "Marked as read" status line; failure path unchanged (card repopulates + error).
- Tests rewritten to the new behavior: open/read leave instantly; failures repopulate; reads silent. Old "stays visible / opened-here marker / pressed toggle" tests replaced.

## Test state (do NOT loop full suite blindly)
- Last full run: 27 pass, then hang at ~test 28 (`confirmed Gmail read stays silent...` area). Suite never completed in this session.
- Single-pattern runs are UNRELIABLE on this box: Node is v26.10.0, repo wants 24 (`.nvmrc`). A non-matching `--test-name-pattern` reports 1 pass on an empty match (void result — proved via stash + `zzzz-no-such-test`). Do not trust pattern-run "pass".
- Hang signature seen repeatedly: `Promise resolution is still pending but the event loop has already resolved` + 50-100s timeout. Root causes found so far:
  1. Never-resolving `sendMessage` mocks → fixed with `test.afterEach(() => { try { finish?.(...) } catch {} })` on tests that use `let finish`.
  2. Success-confirm without cache update re-shows the card (items still `unread:true`) → tests must simulate the worker via `change({ mailCache: { newValue: [...] } })`.
  3. `document.querySelector` appearing to hang was actually the assert-fail-vs-hang confusion during TRACE instrumentation — resolved once (2) was understood.

## Memory/lockup guidance (owner reported 49GB node-mainthread, PC locking)
- Cause: ~15 stacked `timeout 100 node --test` runs, each spawning workers that never exited on hang. `timeout` kills the parent; workers can linger.
- Verified clean at handoff: no `node --test` processes, top RSS is a browser renderer (~600-800MB), 47GB+ free.
- Fresh-run rules: one test command at a time; `timeout 50-60`; after every run `pgrep -af "node --test"` and kill strays before the next; prefer `npm test` once at the end over repeated full-file loops; never run pattern-probes in a loop.

## Resume checklist for fresh agent
1. `git status --short` (expect the 2 modified files), `git diff --stat`.
2. Read the current diff of `src/popup/popup.js` (filter/settle/markRead/actOnMail) and `tests/popup-ui.test.js` new optimistic tests.
3. Run ONE full `npm test` with timeout 120; if hang, note which test number stalls (count ✔ lines) and fix that test only.
4. Remaining known failures to reconcile: `hover actions use provider-specific labels` (expects pending `.card.read` visible — superseded by instant-hide), the two `opened mail...` tests (rewritten, verify), `confirmed Gmail read stays silent...` (hang site).
5. Detector: `impeccable detect --json` on popup target was clean except 12px/8px advisories (intentional v3).
6. Commit to the PR branch only when green; PR #25 already linked.
