# Gmail plus Outlook

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Personal mailbox users checking multiple Gmail and Outlook.com accounts in a
browser extension. The owner prioritizes seeing each account separately.

## Product Purpose

Check incoming mail across accounts, identify which account owns each message,
and act on messages quickly. The main popup should show mail; account management,
sound and notification controls belong in a separate settings section.

## Operating Context

Chrome MV3 extension with a compact, vertically scrolling popup. The existing
implementation shows cached sender, subject, snippet and unread state, opens
the provider mailbox, and supports alerts, badge counts and sound controls.
Owner acceptance uses real accounts in a Chromium browser.

## Capabilities and Constraints

Implemented popup workspace (2026-09-30; owner production acceptance pending):

- Stack one full-address account header and only its messages, then the next
  account. Empty and paused accounts retain sections; filters preserve identity.
- Mail and Settings are separate views. Settings contains Accounts, Themes, Notifications, Sound
  and Mail checking. Back restores Mail position; drafts survive updates.
- Expanding a preview displays cached text without marking it read. Open retains
  the existing extension-local read flag and exact provider message link.
- Midnight desk, Slate workspace and Signal panel are selectable and remembered.
  Midnight is the default for missing or invalid saved preferences.

Gmail remains session-cookie Atom feeds; Outlook.com personal mail uses Microsoft
Graph read permission. Provider requests belong to the worker; the popup reads
cache and sends worker messages. Mail/credentials stay in the browser profile.
No backend or analytics; provider access remains read-only in this stage.

Approved staged follow-ups: first Gmail API authorization/read migration, then
individual-message read/unread and Trash actions for both providers. These actions
update the actual mailbox; Trash moves to Trash/Deleted Items and offers Undo.
They will appear directly on cards. Provider write scopes, synchronization and
recovery need their own implementation specification; the current stage has no
read/unread or Trash/Undo buttons. Preview remains display-only in that design.

## Brand Commitments

Owner wants to explore a new look and likes modern interfaces. The current popup
feels too white; colour and surface alternatives are welcome.
Owner approved all three proposed visual themes: Midnight desk, Slate workspace
and Signal panel. Settings must expose a Themes control. Midnight desk is the
new-installation default; remember the user's choice. Normal-case system UI
text and the selected palettes are implemented; DESIGN.md records production
tokens extracted from the build. The owner dislikes the uppercase, widely spaced description lettering on the
comparison board. Use normal-case, readable UI typography. The interactive
previews record the approved directions; production acceptance is a separate owner check.

## Evidence on Hand

Established design: DESIGN.md and src/popup/. Synthetic captures and verification:
docs/ui-workspace/ (current synthetic checks) and docs/ui-usability/ (historical).
Prior owner acceptance: docs/acceptance/2026-09-30-popup-usability.md.
Current popup-workspace owner acceptance remains pending.
No real addresses or mail content should be used in design examples.

## Product Principles

- Make account identity clear before the user acts on mail.
- Prioritize mail in the main view and separate configuration.
- Treat the provider as the source of truth for requested mailbox actions.
- Keep data in the browser profile and preserve keyboard access.
- Present design choices and previews for owner approval before UI edits.

## Owner-approved card/actions update — 2026-10-01

The owner requested separate rounded email cards, bold sender and subject for
all mail, automatic text capped at three lines, a wider popup, and read/Trash
icons revealed on hover. Keyboard focus exposes the same controls. Full-message
reading inside the extension is deferred; provider Open remains available.

The owner explicitly authorized real mailbox writes, rejected Google Cloud/OAuth
setup for Gmail, and accepted whole-conversation Gmail actions. This supersedes
the read-only/staged OAuth statements above for this candidate. Gmail keeps its
browser session; Outlook requests Mail.ReadWrite. A worker-owned ten-minute Undo
journal survives popup close; uncertain results require checking the mailbox.
Actual provider acceptance is pending, especially private Gmail session/Undo
compatibility. No send, permanent-delete, backend, analytics or popup API calls.

## Popup UX and global checking candidate — 2026-10-02

Approved specifications and automatic build authorization supersede the prior
visible-Undo presentation. Completed Trash has concise success feedback, with
no Undo tray/button/countdown. The worker restore journal and uncertainty
recovery remain. Account headings open account-hinted webmail inboxes; routing
still needs fresh two-account acceptance. Settings adds one Mail checking form
at the bottom of Settings, after Sound: duration, seconds/minutes/hours, explicit Save;
1-minute default, 30-second–5-hour range, whole seconds. Saves update storage and
the shared alarm, with rollback on failure and preserved matching alarms on wake.
The popup stays cache-only. Unsaved settings drafts survive unrelated updates.
Synthetic verification passed; actual candidate acceptance is pending in
[the dated record](docs/acceptance/2026-10-02-popup-ux-settings.md). Earlier staged
and expanded-preview descriptions above are historical and do not own current
scope; the current preview is always visible and capped at three lines.


## Owner-approved reversible read interaction — 2026-10-02

Mark read updates the displayed card/count immediately, keeps the card while
hovered or keyboard focused, and commits after five seconds away or immediately
on an outside click. Mark unread during this grace period cancels the staged
read locally, including Gmail. Provider writes begin only at commitment and
remain silent on progress/success; errors restore recovery cards. Committed
Gmail unread stays unavailable. Open retains provider-unchanged local-read
semantics and immediate dismissal; extension counts use local read state.
The owner reported smoke acceptance passed for candidate `ca193e3` on
2026-10-02; coverage details are recorded in the dated read grace-period record.

## Owner-approved visual polish — 2026-10-03

The owner approved the interactive proposal in docs/design/visual-polish/ and
requested implementation. Mail now uses stronger primary-color two-line
subjects, quieter 12px sender text and regular 11px timestamps, slimmer wrapping
account headings, softer surfaces and a separate footer for hover/focus actions.
This supersedes the earlier bold-sender/one-line-subject visual prescription.
Settings keeps its section order with compact account actions, one shared local
removal note, account-specific reconnection hints and miniature theme previews.
Midnight panel is #253948; the three themes and mailbox semantics remain.
The footer layout also restores native Enter/Space activation of mail actions.
Cached preview expansion already exists and is preserved; its discrepancy with
the older no-expansion requirement is recorded in the dated acceptance record.
Fresh real-account acceptance for this visual candidate is pending.
