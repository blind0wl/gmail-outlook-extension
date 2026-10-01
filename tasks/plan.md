# Gmail action follow-ups — 2026-10-01

Scope: [#16](https://github.com/blind0wl/gmail-outlook-extension/issues/16)
and [#15](https://github.com/blind0wl/gmail-outlook-extension/issues/15), continuing
the approved read/Trash/Undo contract in specs/003-mail-cards-actions/spec.md.

## Decisions and evidence

- The worker journals uncertainty by conversation key. Gmail's reported
  two-to-three-delete threshold has not been reproduced with a real account.
- Initial owner reports described second-account conversations remaining in
  Inbox. Later refreshed Gmail checks confirmed five earlier moves and four
  new moves reached Trash despite uncertain extension results. Those cases
  establish false-negative confirmation; the later disappearance report remains
  distinct. Permanent deletion is not established. See the dated acceptance
  records for the observation sequence rather than treating the initial report
  as the current diagnosis.
- Acknowledgement incorrectly checks the global pending-action count even
  though the worker serializes operations. Test acknowledgement alongside an
  unrelated queued action, then remove that cross-conversation restriction.
- Put recovery before the mail list and explain that only the affected item
  is locked. Keep explicit mailbox checking, durable locks and no POST replay.
- For #15, use the issue's accepted refresh-guidance fallback. The existing
  transport does not update an open Gmail page. Do not claim the provider write
  is delayed or add tab reloads/content scripts without supporting evidence.
- No changes to Gmail acknowledgement recognition: unknown responses still
  fail closed; unread-feed absence cannot confirm Trash or enable Undo.
- Session GETs now bypass the HTTP cache and the action token is read after
  those requests. A regression test proves the prior ordering can use a stale
  token if GETs rotate cookies. This is a candidate mitigation; the owner's
  private-protocol failure is not yet reproduced or proven fixed.
- Content-free worker events answer: which browser slot was targeted, whether
  the write was acknowledged/uncertain/rejected, whether an unknown reply was
  a sign-in challenge, and whether the complete unread feed showed absence.
  No account address, message ID, provider body, URL or session key is logged.

## Ordered tasks

1. #16: reproduce acknowledgement contention, fix recovery and verify repeated
   deletes with an intervening uncertain write across conversations/accounts.
2. #16 transport: refresh session prerequisites, read the token last and emit
   allowlisted diagnostics. Verify rotation and diagnostic privacy with tests.
3. #15: retain immediate read feedback and explain open-page refresh after a
   confirmed Gmail read, excluding failed actions and Outlook.
4. Verify on Node 24 (`npm ci`, `npm run verify`, `git diff --check`), inspect
   synthetic recovery at 480px and 320px, review and record fresh acceptance.

Task completion is tracked in tasks/todo.md. Issue closure requires real-account
acceptance, especially the unknown Gmail acknowledgement after repeated deletes.

## Owner follow-up: repeated recovery rows

The owner reported 30+ identical saved uncertainty rows for one account. Group
these per account, expose the count, and acknowledge a captured batch only after
the user checks all affected actions. Keep partial failures/new locks and Undo
separate. Check state and timestamp in the worker to protect records changed by
another popup. Verify 30-lock grouping, duplicates, partial failure and races in
tests; inspect 480px and 320px, then record a new candidate acceptance result.

## Acceptance still requiring the owner

The original repeated-write instructions are superseded by containment. Do not
repeat writes on disputed conversations or clear their saved locks. Gmail Trash
remains disabled while the exact provider confirmation contract is investigated.
The owner has now requested agent-run E2E testing; this requires an authenticated
test browser and explicitly identified disposable conversations. Record each new
candidate and runtime result separately from historical synthetic checks.

## Current investigation contract

1. Preserve existing uncertain targets. Confirm account-pinned provider state
   without replaying their mutations.
2. Establish either a trustworthy action acknowledgement or complete per-message
   state for the exact conversation. Trash membership plus Inbox exclusion alone
   is insufficient: a conversation can contain a trashed and an archived member.
   A bounded search's missing target, short result list or unverified row labels
   cannot establish the complete state.
3. Reproduce the observed acknowledgement failure using disposable conversations
   in the authenticated test session. Add a failing regression grounded in that
   observed reply/state contract before changing confirmation behavior.
4. Verify repeated Trash beyond three actions, Undo, mixed-folder conversations,
   uncertain responses, worker restart and account isolation. Restore the popup
   and worker Trash controls only after fresh real-account acceptance succeeds.
