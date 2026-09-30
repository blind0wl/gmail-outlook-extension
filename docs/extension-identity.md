# Stable unpacked extension identity

The public `key` in manifest.json pins the development extension's identity.
Keep that key unchanged across branches, checkout paths and browser profiles.
It is public configuration, not an OAuth secret. Only an RSA-2048 public SPKI
key was saved; its private key was generated in memory and never saved.

Expected extension ID:

```text
jholbbifabgjdjiiebpghejakkejdpdf
```

Microsoft SPA redirect URI (including the trailing slash):

```text
https://jholbbifabgjdjiiebpghejakkejdpdf.chromiumapp.org/
```

`npm run identity` validates the manifest public key and prints both values.
`npm run verify` includes this check. Tests compare the derivation against
Chromium's known public-key vector and pin this deployment's ID to catch an
accidental key rotation. The command also accepts a manifest path for checking
another checkout: `node scripts/extension-identity.mjs /path/to/manifest.json`.

## One-time setup

1. In [Entra App registrations](https://entra.microsoft.com/), open the app
   with public client ID `9e67dec6-14f7-4e74-999e-ac7c1f1da358` (the existing
   ENTRA_APP_ID in src/auth/microsoft.js). Under Authentication, add the exact
   redirect above to the **Single-page application** platform. Keep existing
   redirects while testing; no secret or permission change is needed.
2. Enable Developer mode in `chrome://extensions`, choose **Load unpacked**
   and select the checkout with this pinned manifest. Confirm its displayed
   ID matches the value above. If the old install remains as another entry,
   disable it to avoid duplicate polling/alerts. Keep its data until acceptance.
3. A new ID has a separate Chrome storage namespace. Add Gmail and Outlook
   accounts in the new popup and restore your sound/settings preferences.
   Existing server mail is unaffected; no automatic local-data migration is
   performed. The old install and its data are not deleted by this change.
4. Sign into Outlook from the extension and Refresh. Allow portal changes
   time to propagate. See [manual auth](manual-auth.md) for registration and
   sanitized error codes if authentication fails.

## Owner acceptance

Record the tested commit, browser and results in docs/acceptance/.

- [ ] Chrome/Helium shows the exact pinned ID after Load unpacked.
- [ ] In the extension's service-worker console,
      `chrome.identity.getRedirectURL()` matches the URI above.
- [ ] Microsoft SPA registration accepts that URI; Outlook sign-in, mail,
      and Open work for the connected accounts. Gmail still works.
- [ ] Reload preserves the same ID, cached mail, accounts and preferences.
      Recover Outlook session credentials with Sign in, then Refresh.
- [ ] Browser restart preserves the ID and local settings; Outlook Sign in
      and Refresh recover the expected mail (session tokens clear on restart).
- [ ] Load a copy of this checkout from a different directory or a fresh
      browser profile; its displayed ID matches. Use a fresh profile or disable
      the first copy during this check. Chrome treats identical IDs as the
      same extension within a profile, so do not expect two independent copies.

The ID/URI are derived and automated checks pass; actual Chrome installation,
external registration, and real-account acceptance remain owner gates.

## Future publishing

This key pins personal unpacked development. It does not reserve a Chrome Web
Store item or its signing identity. Before store publishing, obtain the item's
public key from the developer dashboard and plan any identity/redirect/storage
migration deliberately. Do not replace this key during ordinary feature work.

Sources: [Chrome manifest key](https://developer.chrome.com/docs/extensions/reference/manifest/key),
[Chrome identity](https://developer.chrome.com/docs/extensions/reference/api/identity),
[Chromium ID derivation](https://github.com/chromium/chromium/blob/main/components/crx_file/id_util.cc).
