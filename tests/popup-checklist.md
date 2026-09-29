# Popup checklist (Task 7 — A v5 inbox, manual Chrome pass)

Load unpacked in Chrome (`chrome://extensions`, developer mode) with two
Gmail accounts plus one Outlook.com account, then eyeball each line.
Manual Chrome verification was NOT performed in the headless environment;
tick each box by hand in a real browser.

- [ ] Header reads `Inbox` followed by an unread count, e.g. `Inbox (3)`.
- [ ] A search icon button labelled `Search mail in provider` sits right of the header.
- [ ] Clicking the search icon opens provider search in a new tab
      (All/Gmail filter: `https://mail.google.com/mail/#search`;
      Outlook filter: `https://outlook.live.com/mail/<account>/search`
      for the newest cached Outlook address, slot 0 when none cached).
      No inline search box exists in the popup.
- [ ] Three high-contrast pills read exactly `All`, `Gmail`, `Outlook`.
- [ ] Selected pill is dark background with white text; unselected pills are
      white background with dark text and a visible border at 13px or larger.
- [ ] In `All`, `work@gmail.com` and `personal@gmail.com` read as separate
      account lines on their own cards (accounts never blur together).
- [ ] Long account addresses wrap onto further lines in full — no truncation
      with ellipsis — while the message time stays top right.
- [ ] Each card shows provider badge (`Gmail` / `Outlook`) plus the full
      account address top left, and the message time top right.
- [ ] Each card shows sender avatar (initial) plus dark subject line
      (`#111111`, weight 600) plus gray snippet below (`#5f6368`).
- [ ] Unread cards carry a visible unread dot; clicking a card removes the
      dot, drops the subject to normal weight, and persists `localRead`
      through to `chrome.storage.local` key `mailCache`.
- [ ] Each card has a single `Open` action button that opens the provider
      thread in a new tab (Gmail: `mail.google.com`, Outlook: `outlook.live.com`).
- [ ] `Open` on a Gmail card lands on that account's mailbox via
      `?authuser=<account-email>` (`work@gmail.com` and `personal@gmail.com`
      each open their own mailbox regardless of browser login order); an
      Outlook card lands on its own account mailbox
      (`/mail/<account>/inbox/id/<id>`), never hardcoded slot 0.
      Covered headless by `node --test tests/popup-links.test.js`.
- [ ] BEST-EFFORT — Outlook thread link (no Microsoft documentation found
      for this format): with a real Outlook.com account cached, click `Open`
      on one of its cards and confirm the new tab lands on that exact
      message in the right mailbox — not the inbox root, not another
      account's mailbox, not an error page. If it lands anywhere else, note
      the actual URL behavior in the fix report so the format can be revised.
- [ ] Keyboard: Tab reaches each card (visible focus ring), Enter or Space
      marks it read — same local-only flag as mouse click — without opening
      the provider. Tabbing into a card's `Open` button keeps native
      behavior: Enter/Space on the button opens the thread (the card
      handler ignores keydowns bubbled from nested controls).
- [ ] No compose, reply, archive, or message-delete controls exist. Remove only removes the account from the extension.
- [ ] Add Gmail and Add Outlook open a readable in-popup form (no oversized native dialogs)
      asking for address plus registration client ID, with per-provider help steps,
      a visible redirect URI to register, and working Cancel. Sign in, Sign out,
      and Remove appear for each configured account. Refresh fetches mail without
      alerts. No storage edits are needed.
- [ ] Per-account stale, offline, retry, and needs-sign-in states render. Signing
      out one account leaves other accounts usable and stays signed out after reload.
- [ ] Selection expands the full cached subject and snippet without HTML execution;
      Enter/Space and storage updates preserve keyboard focus.
- [ ] Mark-read updates the badge immediately and survives a later automatic poll.
- [ ] Focused-provider suppression defaults on; toggling it off permits alerts.
      An unfocused Chrome window does not suppress alerts.
- [ ] Use Mute all sounds during OS DND; automatic OS DND detection is unavailable.
- [ ] No console errors while rendering, filtering, marking read, or opening threads.
- [ ] DevTools Network shows zero requests from the popup itself
      (it reads the cache and sends worker messages; settings use local storage).
- [ ] Sound section: master mute checkbox, volume slider with % label, and
      one `Chime for <account> (<provider>)` toggle per configured account
      from storage key `accounts` — including a configured account with no
      cached messages (its toggle must exist with an empty inbox and must
      not vanish when its messages are read or pruned). Toggling mute then
      triggering an automatic poll with new mail stays silent; unmuting
      chimes once. Headless key-union coverage:
      `node --test tests/sound.test.js` (empty-cache account case).

Static checks that cover part of this in headless CI:

- `node --check src/popup/popup.js` — JS parses.
- `node --test tests/` — full suite passes, no regressions.
- `grep -rn "fetch(\|XMLHttpRequest\|console\.log" src/popup/` returns nothing
  (no network calls, no mail content logged).
- `popup.html` references `popup.css` and `popup.js` only, both resolve.
