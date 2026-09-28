# Manual auth test (Task 6)

No tokens are recorded here. Use your own accounts and follow the flows
below against an unpacked build. Requires two one-time console
registrations (see Prerequisites); the bundle itself holds no secrets.

## Prerequisites

- Google Cloud project with an OAuth client of type **Chrome extension**,
  extension ID pinned to your unpacked ID. Copy the client ID into
  `manifest.json` `oauth2.client_id` (developer-local edit, never
  committed with a real ID). `oauth2.scopes` stays exactly
  `https://www.googleapis.com/auth/gmail.readonly`.
- Entra app registration with **Personal Microsoft accounts only**
  (consumers), redirect `https://<extension-id>.chromiumapp.org`
  (from `chrome.identity.getRedirectURL`), public client, no secret.
  Supply its application (client) ID at sign-in time when prompted.

## Flow A: Gmail sign in

1. Load unpacked (`chrome://extensions` > Developer mode > Load unpacked).
2. Open the popup, click **Sign in with Gmail**.
3. Expected: Google account chooser, then a consent screen listing
   **"Read your Gmail messages"** (readonly) and nothing about send,
   delete, or manage.
4. Accept. Expected: popup shows the Gmail account address; polling
   starts on the next alarm tick.
5. Reload the extension. Expected: still signed in (Chrome token cache).

## Second Gmail account (account switch)

`chrome.identity.getAuthToken` takes no account parameter: it always
resolves the default-account credential. A second Gmail record therefore
signs via `chrome.identity.launchWebAuthFlow` with `login_hint` pinned to
its address (PKCE code flow, offline access), and the worker verifies the
fresh credential against the Gmail profile before storing it under that
address. Silent polls re-verify the same way and never return another
mailbox's token (a mismatch surfaces needs-sign-in, never the other
mailbox's mail).

1. With one Gmail account already signed in, add a second Gmail record
   and click **Sign in** on its row.
2. Expected: Google chooser pre-targeted at the second address
   (pick it if asked), then the same readonly-only consent screen.
3. Accept. Expected: each Gmail row polls its own mailbox; revoking one
grant marks only that row needs-sign-in.

## Second Outlook account (ownership check)

Like Gmail, Outlook sign-in pins the chooser with `login_hint`, but a hint
is not proof: the worker confirms the fresh credential against Graph `/me`
and compares `mail`/`userPrincipalName` to the requested address before
storing it. Picking another account in the flow rejects with an account
mismatch and stores nothing, so one record can never poll another mailbox.

## Flow B: Outlook.com sign in

1. In the popup, click **Sign in with Outlook**.
2. Expected: Microsoft consumers sign-in page
   (`login.microsoftonline.com/consumers`), personal account only;
   work/school accounts are rejected by design.
3. Expected consent lists **User.Read** (sign you in, read profile),
   **Mail.Read** (read your mail), and **offline_access** (stay signed
   in). Nothing about send or Mail.Read.Shared.
4. Accept. Expected: popup shows the Outlook address; the session record
   lands in `chrome.storage.session` (check
   Application > Storage > Session in DevTools, values redacted).

## Flow C: sign out each

1. Gmail: click **Sign out** next to the Gmail account. Expected:
   cached token removed via `removeCachedAuthToken`; next poll for that
   account reports needs-sign-in instead of failing silently.
2. Outlook: click **Sign out** next to the Outlook account. Expected:
   `chrome.storage.session` key `auth.microsoft.graph` removed; next
   poll reports needs-sign-in.
3. Sign back in via Flow A/B. Expected: fresh consent only if the grant
   was revoked; otherwise silent.

## Revocation check (optional)

- Google: remove the grant at myaccount.google.com > Security.
  Expected: next poll 401s once, silent refresh fails, account shows
  needs-sign-in with a button.
- Microsoft: remove the app at account.microsoft.com > Privacy > Apps.
  Expected: refresh grant fails, account shows needs-sign-in.

## PR checklist

- [ ] Flow A PASS (manual, own account)
- [ ] Flow B PASS (manual, own account)
- [ ] Flow C PASS (both sign-outs clear, sign-in recovers)
