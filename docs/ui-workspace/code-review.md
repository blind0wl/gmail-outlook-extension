# Popup workspace code review

Date: 2026-09-30. Reviewed the approved specification and plan, committed changes
from `59e1696..HEAD`, and the current uncommitted production HTML/CSS/JS edits.
Workflow: installed Addy `code-review-and-quality` skill; independent source
review across correctness, readability, architecture, security and performance.

## Verdict: Approve code; owner acceptance remains pending

No unresolved Required or Critical source findings remain. This approves the
implementation code after the race fix; it is not a merge or shipping approval.

### Resolved — P2: Pending Add completion overwrote a newer account draft

Original location: `src/popup/popup.js:562–565` before the fix; current guard at
`src/popup/popup.js:557–569`.

Start adding a Gmail account and leave the worker request pending. Cancel the
form, open Add Outlook, and type a new address. When the earlier Gmail request
succeeds, its continuation unconditionally clears the shared email input and
hides the current Outlook form. The newer unsent draft is lost and focus moves
to its launcher. The analogous failure path places the earlier operation's
error in the newer form.

Reproduced using the actual popup module with the existing linkedom/Chrome
boundary: one pending Gmail request, then a new Outlook draft; after resolving
the first request, `draft` was empty and `formHidden` was true. The submit
continuation is inherited code, but the approved Settings workflow explicitly
requires stable unsent form input and pending behavior (FR-004/FR-007 and story
2). Existing tests only complete Add before opening another form.

The fix increments a form generation on opening and cancellation, captures that
generation and the exact submitted draft, and checks both before changing the
form on completion. An obsolete request can no longer clear, hide, refocus or
place its form error in the newer draft. Shared lifecycle feedback remains
independent. Submission also guards disabled/pending and absent-provider states.
Delayed-success and delayed-failure tests reproduce cancel/reopen and verify the
new draft, provider title, form visibility, error state and input focus survive.
Independently reviewed the fix and these regressions; the finding is resolved.

## Review evidence

- Account sections use canonical account identity, preserve configured order,
  sort cached messages by date, retain empty/paused/error sections and exclude
  orphan cache messages from Mail.
- Preview changes only the expanded cached-text display. Open retains the exact
  existing `threadUrl` routing and local `mark-read` worker action.
- Mail recovery navigates to the matching Settings sign-in control. Account
  controls guard repeated activation of the same pending worker operation.
  Surviving message/account/chime focus is restored after list updates.
- Theme IDs are validated, writes serialize, failure feedback avoids raw storage
  errors, and token changes preserve form DOM and focus. The initial theme read
  has a bounded reveal deadline.
- External message strings render through text content. No provider requests,
  credential reads, mailbox-write controls, authentication changes, manifest
  changes or runtime dependencies were introduced. Provider link validation
  remains in its existing owner module.
- Cache rendering remains bounded by the existing cache contract. No additional
  network work is introduced; the account/message grouping is appropriate for
  the current bounded personal-mail dataset.
- Independently ran `npm run verify` with Node 24.21.0: syntax and identity checks
  passed; all 170 tests passed, zero failures or skips after the race fix.

## Remaining acceptance

Owner real-account Chromium acceptance is pending. This source review and the
synthetic tests do not establish actual extension dimensions, real sign-in,
provider opening, notifications or chime behavior. A new dated acceptance result
is required before merge under SC-005 and the repository baseline. Visual finish
and narrow/zoom browser evidence are separate checks.
