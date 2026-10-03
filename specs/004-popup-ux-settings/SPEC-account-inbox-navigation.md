# Spec: Account headings open inboxes

**Module ID**: `account-inbox-navigation`
**Created**: 2026-10-02
**Status**: Owner-approved specification, 2026-10-02; ready for technical planning.
**Engineering contract**: [spec.md](spec.md#shared-engineering-contract).

## Objective

Let users open an account's inbox directly from its Mail heading, even when
that account has no cached messages.

## Requirements and success criteria

1. Each visible account header is one native, keyboard-accessible inbox link.
   Clicking anywhere on the heading or activating it with Enter opens exactly
   one new active browser tab for that account's provider inbox.
2. Gmail opens Gmail; Outlook.com/Hotmail/Live opens Outlook.com. The destination
   carries the owning account identity, not a numeric slot assumed from sign-in
   order. It opens the inbox rather than a cached message.
3. With two signed-in accounts of the same provider, selecting either heading
   opens that account's inbox even when the other mailbox is active in webmail.
4. Keep the full wrapping address, provider, count, checked time and semantic
   account heading. Give the link a meaningful accessible name identifying the
   account/inbox and new-tab behavior. Provide clear hover and visible focus
   feedback using the current themes; do not add nested interactive controls.
5. Empty, paused, signed-out and errored accounts retain their inbox links.
   Webmail may require sign-in. Clicking a heading does not change extension
   authentication or enable polling for a paused account.
6. Navigation does not mark messages read locally or at the provider, change
   cache/counts, or trigger a refresh. Existing message Open remains unchanged.
7. Preserve focused heading identity through cache/account rerenders when the
   account survives. Filters and account order retain their existing behavior.
8. Build destinations from configured provider/account data, encoding addresses
   and using fixed HTTPS provider origins. No caller-supplied arbitrary URL,
   new permission or popup provider request is required.

## Testing strategy

- URL helper tests cover both providers, encoded addresses, multiple accounts
  and supported-origin behavior. Do not reuse an unreliable message fallback
  simply by deleting the message ID.
- Synthetic DOM/tab tests cover one tab per activation, empty/paused/error
  accounts, filters, accessible semantics, surviving focus and zero mailbox
  actions/cache writes from heading activation.
- Fresh real-account Chrome acceptance must prove correct mailbox selection in
  both directions for two accounts per provider, including when the other
  account is active. Existing Outlook message `login_hint` evidence is not proof
  that a new inbox URL works. Verify sign-in behavior when a session is absent.
- Run shared checks and inspect all themes at 320px/480px.

## Boundaries and open questions

Shared commands, structure, style and boundaries apply. Microsoft work/school
support and changes to message Open are outside scope. The whole-header hit
area is owner-approved. Exact provider inbox URL forms require
source verification and real-account acceptance during planning/implementation;
the acceptance requirement must not be weakened to “URL contains an address”.
