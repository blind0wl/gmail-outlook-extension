# Popup workspace acceptance

Run against the candidate PR revision in an unpacked extension with two Gmail
accounts and at least one Outlook.com account. Record date, tested commit,
browser/version and results in a new file under docs/acceptance/. These boxes
are a procedure, not evidence of a current pass.

- [x] Mail opens with Inbox/count and Refresh/Settings icons with accessible
      names. All/Gmail/Outlook filters work. Configuration is only in Settings.
- [x] Each configured account has its own full-address section in configured
      order, including two Gmail accounts; messages are newest first within it.
      Empty, paused, stale/offline and sign-in sections stay identifiable.
- [x] A message shows sender, time, subject/snippet and an unread indicator.
      Full account addresses and expanded text wrap without horizontal scroll.
- [x] Expanding/collapsing a preview by mouse or Enter/Space does not change
      unread counts, badge or the mailbox. Preview renders text safely.
- [x] Open retains the existing local-read behavior and opens that account’s
      exact provider message. Check Gmail account selection and Outlook links
      after Sign in and Refresh, including a second Outlook account while the
      browser is signed into the other mailbox. Do not record message URLs.
- [x] Settings replaces Mail. Back restores Mail scroll and focuses Settings.
      Hidden controls stay out of the tab order. Manage sign-in opens Settings
      and focuses the relevant account’s Sign in control without starting auth.
- [x] Themes lists Midnight desk (default), Slate workspace and Signal panel.
      Native radio arrow keys select and immediately apply all three. Reopen
      and reload retain the selection. Changes preserve focus and account drafts.
- [x] Accounts includes Add Gmail/Outlook, provider/address identification and
      Sign in/Sign out/Remove. Add/Cancel and errors work; pending actions do
      not repeat. Cancel/reopen during a pending Add preserves the newer draft.
      Removing/signing out one account leaves other accounts usable.
- [x] Notifications retains focused-provider suppression; Sound retains master
      mute, volume/% and a chime toggle for every account, including empty ones.
      Preferences persist. Manual Refresh stays silent; automatic alerts/chime
      still work. Use master mute for OS Do Not Disturb.
- [x] Keyboard focus remains visible in each theme on Mail, radios, forms,
      account actions and sound controls. Tab can reach controls below the fold.
      Account/message removal sends focus to a surviving control.
- [x] At 320, 380, 404 and 480px constrained widths and actual 200% browser zoom,
      both views remain usable, wrap and scroll vertically without lost controls.
- [x] Console has no unexpected errors; popup Network has no provider requests.
      Sign-in/retry failure on one account does not hide mail in other sections.
- [x] No read/unread or Trash/Undo actions appear in this stage. Remove removes
      the configured account only, not provider mail.

Automated checks: Node 24, `npm ci`, `npm run verify`, `git diff --check`.
Synthetic browser checks are in docs/ui-workspace/ and do not replace real
provider authentication, extension reload, native notifications or audio.
