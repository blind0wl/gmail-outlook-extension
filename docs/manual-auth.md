# Manual auth and account lifecycle

Ordinary use requires no DevTools, no storage edits, and no IDs of any kind. Load the unpacked extension and add accounts from the popup. Never enter a client secret anywhere.

## Registration

### Gmail: none needed

Gmail reads the browser session you already have. Log into Gmail in any tab, click Add Gmail, enter the address, and the account appears. There is no Google Cloud project, no OAuth client, no consent screen, and no token stored anywhere. The extension fetches the unread feed with your session cookie and nothing else. If the session lapses, the account shows Sign in, which opens the Gmail login tab.

### Outlook.com: one developer registration

Create an Entra registration for **Personal Microsoft accounts only**: open [Entra admin center, App registrations](https://entra.microsoft.com/) and start a New registration. Then, in Authentication:

- Set Supported account types to Personal Microsoft accounts only. If the portal refuses, edit the **Manifest** instead: set `"signInAudience": "PersonalMicrosoftAccount"` **together with** the token version in the same save — `"accessTokenAcceptedVersion": 2` (older manifests) or `"api": { "requestedAccessTokenVersion": 2 }` (Graph-format manifests, where a top-level `accessTokenAcceptedVersion` is rejected as unknown). Saving either property alone fails validation.
- Register the exact `https://<extension-id>.chromiumapp.org/` redirect under the **Single-page application** platform — not Mobile/desktop, not Web. The token exchange is a `fetch()` from the extension worker (cross-origin), which Microsoft permits only for the SPA type (`AADSTS90023` otherwise), and the URI string may exist under only one platform type, so delete-then-re-add across two saves if it is already registered elsewhere. Allow a few minutes for propagation after every save.
- Enable public client flows. Use delegated `User.Read`, `Mail.Read`, and `offline_access`. No secret is used. Put the public application client ID into `ENTRA_APP_ID` in `src/auth/microsoft.js` (it is a public identifier, safe to commit). Users then click Add Outlook, enter their address, and accept the consent screen. The extension uses the consumers authority and PKCE.

Sign-in failures surface a short code in the popup (e.g. `token-exchange/invalid_client/AADSTS70011`): fixed identifiers from the endpoint, never mail content.

## Auth contract note (feed transport)

Gmail uses no OAuth at all: no Cloud project, no client ID, no consent screen, no verification or assessment, no tokens in any storage. The only Gmail fetch host is `mail.google.com`. Outlook keeps delegated Microsoft OAuth with the developer-owned app id; its tokens live in `chrome.storage.session` only. Allowed fetch hosts are `mail.google.com`, `graph.microsoft.com`, and `login.microsoftonline.com`.

A lapsed Gmail session shows Sign in, which opens the Gmail login tab. Outlook sign-in uses the baked-in developer app id plus PKCE with no secret.

The separate `tabs` permission amendment allows the worker to inspect the active tab URL in the focused window for notification suppression. It does not add fetch hosts or persist tab URLs.

## Account flows

1. Log into Gmail in a tab. Click Add Gmail and enter the mailbox address. No consent screen appears. Repeat for each Gmail address.
2. Click Add Outlook, enter a personal mailbox address, and accept the Microsoft consent screen. Work or school accounts are outside this registration and scope.
3. Both providers immediately fetch recent inbox mail. The first successful population creates a quiet baseline, with no toast or chime for history. Empty inboxes also establish a baseline.
4. Click Refresh. Cache and badge update, but manual refresh never toasts or chimes.
5. Click Sign out for one account. Its tokens are removed and explicit signed-out state survives worker restart. Automatic polling must not sign it back in. Other accounts remain usable. Sign in explicitly to resume.
6. Click Remove. The account and its cached messages disappear from the extension; no server mail is deleted. Other account rows remain.
7. Revoke a grant in the provider's account settings. A failed silent renewal shows needs sign in for that account. Transient 429/5xx shows a retry deadline instead.

## Focus and OS DND

Pause alerts while a provider tab is focused defaults off: toasts and chimes fire even while looking at the mailbox. Ticking the option suppresses toast and chime for that provider while its tab is active in the focused Chrome window; cache and badge update either way.

Chrome's [notifications API](https://developer.chrome.com/docs/extensions/reference/api/notifications) exposes `granted` or `denied` permission, not OS DND. Native toast visibility follows OS policy. The extension cannot infer DND for offscreen audio, so enable Mute all sounds when using OS DND. Toasts themselves are silent, and the offscreen chime follows master and per-account mute. Automatic OS DND sound suppression is explicitly withdrawn from the original requirement.

## Live acceptance checklist

- [ ] Two Gmail accounts and one Outlook account add successfully from popup prompts.
- [ ] Mailbox ownership mismatch rejects without caching a foreign credential.
- [ ] Per-account sign-out remains effective after worker restart and does not affect another account.
- [ ] Explicit sign-in resumes that account; removal drops only its extension cache.
- [ ] Gmail needs no registration at all (session-cookie transport); Outlook token lifecycle verified with actual accounts.
- [ ] Refresh, baseline, focused-tab suppression, master mute, chime, and badge verified in Chrome.

These boxes require live accounts. Automated fixtures and DOM tests do not mark them complete.
