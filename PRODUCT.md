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

Existing implementation: Gmail is read through session-cookie Atom feeds;
Outlook.com personal mail uses Microsoft Graph read permission. Preview currently
marks read locally. Provider requests belong to the worker; mail and credentials
stay in the browser profile. No custom backend or analytics.

Confirmed next-design requirements (2026-09-30; not implemented):

- Stack separate account sections: one account header followed by only its messages, then the next account and its messages.
- Separate adding accounts, sign in/out, removal, sound and notifications from
  the main mail view. Settings must be a separate view, hidden from the message-card view.
- Provide card icons for read/unread and Delete without requiring preview expansion.
- Read/unread must update the actual Gmail/Outlook mailbox.
- Delete must move mail to the provider's Trash/Deleted Items.

These requested actions expand the previous read-only scope. Authentication,
permissions, mailbox synchronization, error recovery and account migration must
be specified before implementing them. Existing feeds/read scopes cannot supply
the requested write operations. No authentication route or permission change has
been approved as an implementation design yet.

Open decisions: density, account section
interaction, preview/read relationship, pending/error feedback and recovery from
an unintended trash action. Individual-message actions, preview-only expansion
and Trash Undo are approved; their pending/recovery contract still needs specification.

## Brand Commitments

Owner wants to explore a new look and likes modern interfaces. The current popup
feels too white; colour and surface alternatives are welcome.
Owner approved all three proposed visual themes: Midnight desk, Slate workspace
and Signal panel. Settings must expose a Themes control. Midnight desk is the
new-installation default; remember the user's choice. Normal-case system UI
text is used in the previews; production tokens remain to be extracted from the
approved build. The owner dislikes the uppercase, widely spaced description lettering on the
comparison board. Use normal-case, readable UI typography. The interactive
previews record the approved directions; production implementation is separate.

## Evidence on Hand

Established design: DESIGN.md and src/popup/. Synthetic captures and verification:
docs/ui-usability/. Owner acceptance: docs/acceptance/2026-09-30-popup-usability.md.
No real addresses or mail content should be used in design examples.

## Product Principles

- Make account identity clear before the user acts on mail.
- Prioritize mail in the main view and separate configuration.
- Treat the provider as the source of truth for requested mailbox actions.
- Keep data in the browser profile and preserve keyboard access.
- Present design choices and previews for owner approval before UI edits.
