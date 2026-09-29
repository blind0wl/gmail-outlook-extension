# Manual auth and account lifecycle

Ordinary use requires no DevTools or storage edits. Register the public OAuth clients once, load the unpacked extension, and enter client IDs through the popup. Never enter a client secret.

## Registration

### Gmail

Enable Gmail API in a Google Cloud project: open [Google Cloud Console, Credentials](https://console.cloud.google.com/apis/credentials), creating a project first if you have none. Configure the OAuth consent screen for personal testing and add your accounts as test users. Request only `https://www.googleapis.com/auth/gmail.readonly`.

Create an OAuth client of type **Web application** for the account chooser. Register the exact authorized redirect URI `https://<extension-id>.chromiumapp.org/`, including the trailing slash. Find the extension ID on chrome://extensions. Paste this client's public ID when Add Gmail asks for it. Do not paste the client secret. This flow requests `response_type=token`, validates state and redirect, verifies the returned token through the Gmail profile endpoint, and stores it only in session storage. There is no code exchange or refresh grant.

Optionally configure a separate **Chrome extension** client, pinned to the extension ID, as `oauth2.client_id` in the developer's manifest. Chrome-managed credentials can then renew silently. They are always checked against the requested Gmail address before use. The Web client is separate and is stored from the popup prompt.

### Outlook.com

Create an Entra registration for **Personal Microsoft accounts only**: open [Entra admin center, App registrations](https://entra.microsoft.com/) and start a New registration. Add the exact `https://<extension-id>.chromiumapp.org/` redirect as a Mobile and desktop application public-client redirect. Enable public client flows as required by that registration. Use delegated `User.Read`, `Mail.Read`, and `offline_access`. No secret is used. Paste the public application client ID when Add Outlook asks for it. The extension uses the consumers authority and PKCE.

## Chrome identity verification and contract note

Checked Chrome's published [identity reference](https://developer.chrome.com/docs/extensions/reference/api/identity) on 2026-09-29. No installed local Chrome identity documentation or Chrome binary was available in this environment, so this is documentation verification, not live Chrome verification.

`TokenDetails.account` is supported and takes an `AccountInfo` containing a stable Google account ID. The earlier claim that getAuthToken has no account parameter was wrong. An email address is not that ID. The documented `getAccounts` enumeration API is Dev-channel-only, and `getProfileUserInfo` exposes only the primary account. This does not provide a stable-channel, arbitrary-secondary-account chooser for the extension's email-address model without additional identity discovery.

The custom chooser therefore remains, but the old code exchange at oauth2.googleapis.com is removed. Google's [OAuth implicit-flow documentation](https://developers.google.com/identity/protocols/oauth2/javascript-implicit-flow) describes the Web-client token response and registered redirect. The only extension fetch is to the existing Gmail API host. **The four approved host permissions do not change.** Tokens returned to the redirect are never logged or stored locally. A Web-flow credential expires and may require Sign in again when Chrome cannot renew that same account. Browser restart also clears session storage. This is an explicit auth-contract amendment and a live acceptance concern.

The separate `tabs` permission amendment allows the worker to inspect the active tab URL in the focused window for notification suppression. It does not add fetch hosts or persist tab URLs.

## Account flows

1. Click Add Gmail, enter the mailbox address and Web client ID, and accept the read-only consent. Repeat for a second Gmail address. Choosing a different mailbox must reject rather than store a foreign token.
2. Click Add Outlook, enter a personal mailbox address and Entra application client ID, and accept consent. Work or school accounts are outside this registration and scope.
3. Both providers immediately fetch recent inbox mail. The first successful population creates a quiet baseline, with no toast or chime for history. Empty inboxes also establish a baseline.
4. Click Refresh. Cache and badge update, but manual refresh never toasts or chimes.
5. Click Sign out for one account. Its tokens are removed and explicit signed-out state survives worker restart. Automatic polling must not sign it back in. Other accounts remain usable. Sign in explicitly to resume.
6. Click Remove. The account and its cached messages disappear from the extension; no server mail is deleted. Other account rows remain.
7. Revoke a grant in the provider's account settings. A failed silent renewal shows needs sign in for that account. Transient 429/5xx shows a retry deadline instead.

## Focus and OS DND

Pause alerts while a provider tab is focused defaults on. It suppresses toast and chime for that provider while its tab is active in the focused Chrome window. Turning the option off permits alerts; cache and badge update either way.

Chrome's [notifications API](https://developer.chrome.com/docs/extensions/reference/api/notifications) exposes `granted` or `denied` permission, not OS DND. Native toast visibility follows OS policy. The extension cannot infer DND for offscreen audio, so enable Mute all sounds when using OS DND. Toasts themselves are silent, and the offscreen chime follows master and per-account mute. Automatic OS DND sound suppression is explicitly withdrawn from the original requirement.

## Live acceptance checklist

- [ ] Two Gmail accounts and one Outlook account add successfully from popup prompts.
- [ ] Mailbox ownership mismatch rejects without caching a foreign credential.
- [ ] Per-account sign-out remains effective after worker restart and does not affect another account.
- [ ] Explicit sign-in resumes that account; removal drops only its extension cache.
- [ ] Google Web redirect registration and renewal behavior verified with actual accounts.
- [ ] Refresh, baseline, focused-tab suppression, master mute, chime, and badge verified in Chrome.

These boxes require live accounts. Automated fixtures and DOM tests do not mark them complete.
