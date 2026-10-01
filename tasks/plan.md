# Gmail action follow-ups — 2026-10-01

Scope: [#16](https://github.com/blind0wl/gmail-outlook-extension/issues/16)
and [#15](https://github.com/blind0wl/gmail-outlook-extension/issues/15), continuing
the approved read/Trash/Undo contract in specs/003-mail-cards-actions/spec.md.

## Decisions and evidence

- The worker journals uncertainty by conversation key. Gmail's reported
  two-to-three-delete threshold has not been reproduced with a real account.
- During this follow-up the owner confirmed that Trash on the second Gmail
  account left conversations in Inbox after refreshing Gmail, despite cards
  disappearing from the extension, with repeated unconfirmed-result warnings.
  This is an actual provider-state failure, not only an open-page styling issue.
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

Test beyond three Trash actions with two signed-in Gmail accounts; confirm
unrelated conversations/accounts remain usable after uncertainty, check the
mailbox and use “I’ve checked”, then continue. Check popup reopen and worker
restart. For #15, keep Gmail's inbox open and confirm the guidance and actual
read state after refreshing Gmail. Record candidate, Chrome version, OS and date
without mail content, credentials or raw provider replies.
