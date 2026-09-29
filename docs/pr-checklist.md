# PR checklist — Gmail plus Outlook v1 (human gate)

Every step below needs a real browser, real accounts, or human eyes, so
every step is **human-only**. Headless CI covers adapters, cache, badge
counts, retry, and sanitization (`node --test tests/`); it cannot load
the extension, see a toast, hear a chime, or sign in. Do not merge until
each box is ticked by hand in Chrome with your own accounts.

Setup for the whole pass (human-only):

- `chrome://extensions` > Developer mode > Load unpacked > repo root.
- Configure two Gmail accounts plus one Outlook.com account under the
  `accounts` storage key (provider plus address plus toggles; outlook
  records carry the Entra application id as `clientId`).
- Keep DevTools open on the popup (Console plus Network) for the
  zero-error and zero-request checks.

## Load and inbox (human-only)

- [ ] Popup opens with no console errors while rendering, filtering,
      marking read, or opening threads.
- [ ] Header reads `Inbox` plus the unread count; pills read exactly
      `All`, `Gmail`, `Outlook`.
- [ ] In `All`, `work@gmail.com` and `personal@gmail.com` read as
      separate account lines on their own cards.
- [ ] DevTools Network shows zero requests from the popup itself
      (it reads `chrome.storage.local` only).

## Badge, toast, chime, mute (human-only)

- [ ] New mail on an automatic poll ticks the badge to the exact unread
      total across enabled accounts only.
- [ ] New mail raises one grouped toast per account, never on manual refresh.
- [ ] New mail on an automatic poll plays the chime once; manual refresh
      stays silent.
- [ ] Master mute plus per-account `Chime for <account>` toggles silence
      the chime; unmuting restores it.

## Stale, offline, sign-in recovery (human-only)

- [ ] Force a 429 or 5xx on one account: its row reads
      `<address> — stale, retry <time> (<code>)`, cached mail stays
      visible, and the other accounts keep updating.
- [ ] Go offline: rows read `<address> — offline, showing saved mail`
      with cached mail still visible.
- [ ] Break one session (Gmail: sign that address out of Gmail in a tab,
      or Google Security > Your devices > Sign out; Outlook: revoke at
      account.microsoft.com > Privacy > Apps and services): only that row
      reads needs sign in with a Sign in button; the other accounts keep
      updating.
- [ ] Error rows show the account address plus the numeric code only —
      never a subject, snippet, or body.
- [ ] Click Sign in on the failed row: the account recovers without
      waiting for the next alarm and without touching other accounts.

## Thread links (human-only)

- [ ] `Open` on each Gmail card lands on that account's mailbox
      (`?authuser=<account-email>`), regardless of browser login order.
- [ ] `Open` on the Outlook card lands on that exact message in the
      right mailbox (`/mail/<account>/inbox/id/<id>`) — best-effort
      format; note actual URL behavior if it lands elsewhere.

## Auth flows in docs/manual-auth.md (human-only)

- [ ] Flow A PASS: Gmail works with no OAuth at all. Log into Gmail in a tab,
      add each address from the popup with no consent screen, mail appears,
      still present after extension reload.
- [ ] Flow B PASS: Outlook.com sign in, consumers authority, User.Read
      plus Mail.Read plus offline_access consent only.
- [ ] Flow C PASS: both sign-outs clear (Gmail keeps no tokens, so sign-out
      only stops polling; Outlook session key `auth.microsoft.graph` removed);
      sign-in recovers.

## Automated gate (machine)

- [ ] `node --test tests/` passes with no `MODULE_TYPELESS_PACKAGE_JSON`
      warning (`package.json` keeps `"type": "module"`).
- [ ] `node --check src/popup/popup.js src/background/service-worker.js`
      parses.
- [ ] `grep -rn "fetch(\|XMLHttpRequest\|console\.log" src/popup/`
      returns nothing (no popup network calls, nothing logged).
