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
- Mail and Settings are separate views. Settings contains Themes, Accounts,
  Notifications and Sound. Back restores Mail position; drafts survive updates.
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
