# Gmail plus Outlook

A personal-use Chrome extension that checks Gmail and Outlook.com in one popup.
It has no backend or analytics. Mail previews, settings, credentials, and cached
account data stay in the Chrome profile; provider requests run in the extension
service worker.

## Install for personal use

1. On GitHub, choose **Code → Download ZIP**, then extract the archive.
2. Open `chrome://extensions` and turn on **Developer mode**.
3. Choose **Load unpacked** and select the extracted folder that contains
   `manifest.json`.
4. Pin **Gmail plus Outlook** to the toolbar and open it to add accounts.

Normal use does not require Node.js, npm, a build step, DevTools, or storage
editing. Keep the extracted folder. To update, replace its files and click
**Reload** for the extension in `chrome://extensions`. The public key in
`manifest.json` keeps this extension's ID stable; do not change or remove it.
The ID is `jholbbifabgjdjiiebpghejakkejdpdf`. Chrome keeps local extension data
under its ID, so another extension ID has separate accounts, cache, and settings.

## Connect accounts

For Gmail, first sign in to the mailbox in a browser tab, then choose **Add
Gmail** in the popup and enter its address. Gmail needs no separate app
registration or consent screen. If its session expires, choose **Sign in** for
that account.

Outlook.com supports personal Microsoft accounts only; work and school accounts
are outside the current scope. The extension's default public Microsoft Entra
application client ID is `9e67dec6-14f7-4e74-999e-ac7c1f1da358`. It is a public
identifier, and the extension uses PKCE without a client secret. The
registration must allow personal Microsoft accounts, public client flows, and
delegated `User.Read`,
`Mail.ReadWrite`, and `offline_access` permissions. Sign-in uses Microsoft's
`consumers` authority. The registration must list this exact URI as a
**Single-page application** redirect, not as a Web or Mobile/Desktop redirect:

```text
https://jholbbifabgjdjiiebpghejakkejdpdf.chromiumapp.org/
```

The included app registration may not be available or configured for your use.
If you cannot use it, create or use your own app registration in the
[Microsoft Entra admin center](https://entra.microsoft.com/) with those
settings, then replace `ENTRA_APP_ID` in `src/auth/microsoft.js` with its public
application client ID. Never add a client secret. After setup, choose **Add
Outlook**, enter the personal mailbox address, and accept Microsoft's consent
screen.

Outlook credentials are held in Chrome session storage and clear when the
extension reloads or Chrome restarts. If you remain signed in to Microsoft in
the browser, Outlook can reconnect silently. Otherwise, or if access is revoked,
sign in to Outlook again from the popup.

## Features and data handling

- Mail stays grouped by account with filters, unread counts, desktop alerts, an
  optional chime, and Midnight desk, Slate workspace, and Signal panel themes.
- Authentication emails can show a desktop **Copy code** action and a copy
  button on the inbox card. **Settings → Notifications → Automatically copy
  new sign-in codes** is off by default; turning it on replaces the clipboard
  with the newest detected code in a poll. The extension asks for clipboard
  write access only and never reads the clipboard. A successful write is
  confirmed with “Your sign-in code is ready to paste.”
- Detection is local and conservative: it requires authentication wording and
  a nearby explicit code label, checks the full message when needed, and skips
  ambiguous or older than ten-minute messages. Codes stay in session storage
  and expire no later than ten minutes after the email timestamp. This is a
  freshness limit, not a claim about the sender's actual code expiry. Mail
  checks can be delayed by the selected polling interval or browser scheduling.
- To exercise the flow without connecting an account, open **Settings → Sign-in
  code testing**. Generate numeric, alphanumeric, body-only, ambiguous, no-code,
  and expired fake emails, or start the 30-second sequence. They appear under
  the separate **Demo** inbox and never enter the real mail cache or contact a
  provider. The first sequence email appears immediately; later examples
  arrive while Chrome is open even when the popup is closed. **Clear demo inbox**
  also stops the sequence.
- The shared mail-check interval defaults to one minute and can be set from 30
  seconds to five hours. Settings also control account management and
  notification behavior.
- Opening a message in webmail records a local read in the extension without
  changing provider state. Expanding unread mail stages a provider read; it
  commits after five seconds away from the card or when clicking elsewhere.
  Marking it unread during that grace period cancels the write.
- Expanding a card loads its complete message. Plain text remains selectable;
  HTML is sanitized and shown in an isolated frame. Credential-free HTTPS
  images load automatically. Their hosts receive image requests and may track
  access; the reader sends no referrer. Links open in browser tabs.
- The cache holds at most 200 messages for up to seven days. Message bodies are
  fetched when opened and retained only while the popup is open.
- Gmail uses the signed-in browser session and an unsupported private session
  protocol. It shows a bounded recent unread feed, and Gmail actions affect the
  whole conversation. Changes to Gmail's private protocol may break access or
  actions.
- Outlook uses Microsoft Graph for a bounded set of recent inbox messages.
  Outlook actions affect one message. A failure for one account does not stop
  other accounts from working.
- Read/unread and recoverable Trash/restore are the only mailbox actions.
  Trash moves mail to the provider's recoverable Trash folder. Committed Gmail
  unread is unavailable. The popup has no Undo button; restore trashed mail in
  webmail. For uncertain actions, a ten-minute worker restore journal and saved
  recovery records help reconcile the result. Check affected mail in webmail
  before acknowledging recovery with **I’ve checked**. The extension does not
  send, permanently delete, search, or archive mail.
- Diagnostics exclude message content and credentials.

## Run the local tests

Node.js is needed only to run the unit tests. From the extension folder:

```sh
node --test test/*.test.mjs
```

## Acknowledgements

[Checker Plus for Gmail](https://jasonsavard.com/CheckerPlusForGmail/), created
by Jason Savard, inspired this project. The notification chime at
`src/notify/sounds/chime.mp3` is from Checker Plus for Gmail version 36.5.2;
the source extension's copyright notice reads “Copyright Jason Savard”.
