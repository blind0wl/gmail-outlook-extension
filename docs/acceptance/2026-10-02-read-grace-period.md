# Reversible read grace period — 2026-10-02

Candidate: the read-grace-period commit following `b4860ff` on
`t3code/investigate-email-limits-full-preview`, PR #25.

## Owner smoke feedback and approved correction

The owner reported Open did not appear read in the extension and immediate
Read dismissal prevented toggling back to unread. The owner approved keeping a
read card while hovered or keyboard focused, then waiting five seconds after
leaving; outside clicks commit immediately. Provider writes wait for dismissal,
so Mark unread cancels locally during the grace period, including Gmail.
This supersedes the previous immediate-read-dismissal candidate's acceptance
requirements. Open remains local only and dismisses its card immediately.
The popup's count/toggle logic now consistently uses extension-local read state.

## Implementation and fresh verification

Staged reads are popup-session projections over cached mail. Timer expiration,
outside click, window blur or pagehide commits the worker read exactly once.
Local reversal cancels the timer without sending a provider command. Opening or
moving a staged card to Trash discards its staged read and performs only the
chosen action. Disabled controls on another card still commit the prior read.
Account removal/disable cancels pending staging. Live pointer movement reconciles
hover after cache updates replace card nodes. Mouse focus does not prolong the
keyboard-focus hold. Failed committed requests retain existing recovery cards
and durable uncertainty locks; there is no automatic provider mutation retry.

- Node 24.21.0 `npm run verify`: syntax/identity checks and all 319 tests pass.
- Popup tests: 65 pass, including Gmail local reversal, five-second commitment,
  hover/keyboard holds through cache replacement, mouse focus, outside clicks,
  lifecycle submission, locked-control clicks and account removal/disable.
- Grace-period tests failed against immediate dismissal before implementation.
  The staged-Open test also failed when its cancellation was removed.
  Mouse-focus and all independent review findings were reproduced by failing
  tests, then passed after their fixes.
- Independent review identified disabled-control click propagation, obsolete
  account staging and stale hover after DOM replacement; all were addressed.
- Existing worker local-read persistence/badge tests and read error/cache-order
  tests remain green. Tests explicitly commit the staged action before checking
  provider-response success/error behavior.
- `git diff --check` passed; Impeccable detector found no JavaScript issues.
  No design tokens or CSS changed.

## Real-account Chrome acceptance

Owner-reported smoke acceptance passed for `ca193e3`; see the dated update
below. During agent verification, T3 preview status and background preview
opening returned `available:false`. No real mail or credentials were accessed and no
live provider mutations were performed during automated verification.
Historical results are not reused.

Smoke checks for the owner:

1. Open Gmail/Outlook mail from its card. Confirm owning-message navigation,
   extension local unread count/badge reduction and persistent dismissal on
   reopen, without treating this as a provider mark-read command.
2. Mark read while hovered. Confirm read styling, pressed Mark unread toggle,
   reduced popup count and no progress/success status. Toggle back before
   dismissal: the card is unread again and the mailbox remains unread.
3. Leave with the mouse: commit after five seconds. Return within five seconds:
   keep the card, then restart the five-second wait on leaving again. Repeat
   across cache refreshes and with keyboard focus/Tab navigation.
4. Click another card, a locked action, Refresh, Settings or a filter: commit
   the previous staged read. Read errors restore a recovery card; unrelated
   mail remains usable.
5. Close the popup or switch windows with a staged read. Reopen and verify the
   worker received one read and mailbox state matches. Chrome popup teardown
   may differ from synthetic blur/pagehide dispatch; this delivery check is
   still required before claiming lifecycle acceptance.


## Owner smoke acceptance — 2026-10-02

Candidate: `ca193e3` — Keep read cards reversible until grace-period dismissal.
After receiving this candidate for reload/testing, the owner reported:
“smoke test pass”. This records fresh owner acceptance of the revised read-card
interaction. It supersedes the pending smoke status above for this candidate.

Browser version, provider/account coverage and individual checklist results
were not supplied. The report does not establish separate detailed lifecycle,
failure/recovery or keyboard protocol results; those remain unverified unless
confirmed explicitly. The agent did not access real mail or credentials.
