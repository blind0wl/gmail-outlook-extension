# Assessment: unpacked extension identity changes with its path

Date: 2026-09-30. Base: main `384cd1a`. Verdict: valid.

The manifest has no public key, so development installs can derive their ID
from their directory. Microsoft auth uses chrome.identity.getRedirectURL(),
whose origin contains that ID, but the Entra application requires an exact
registered redirect. Moving a checkout/profile can therefore invalidate auth.

Approved baseline scope: pin a public manifest key and register the derived
Microsoft redirect, then verify the ID and auth across reload/restart/path.
Personal unpacked use is the current scope; no Chrome Web Store publishing.

Remediation: generate an RSA public SPKI key once, commit only its base64
public bytes to manifest.json, discard the private key without writing it,
and retain the key as the identity contract. Add a small read-only command to
validate the public key and print the derived ID/redirect using Chromium's
algorithm. Add it to verification. Tests exercise that command against a
known Chromium public-key vector from a different directory and invalid keys.
No provider scopes, credentials, permissions, UI or runtime code changes.

Files: manifest.json, package.json, scripts/extension-identity.mjs,
tests/extension-identity.test.js, README.md, docs/manual-auth.md,
docs/extension-identity.md, docs/baseline.md and this bug's artifacts.

Risks: the new key introduces a new ID once. Chrome storage is per extension
ID; existing accounts/settings may need re-adding and the old install must
be disabled to prevent duplicate polling. No automatic storage migration or
deletion. Register the exact new URI as SPA before owner sign-in acceptance.
External Entra registration is an owner step; agent has no authenticated
portal access. A future Web Store item has its own identity and needs a
deliberate migration; the development key does not guarantee its store ID.

Sources:
- https://developer.chrome.com/docs/extensions/reference/manifest/key
- https://developer.chrome.com/docs/extensions/reference/api/identity
- https://github.com/chromium/chromium/blob/main/components/crx_file/id_util.cc

Human gate: browser ID matches command; compare getRedirectURL; register URI;
add/sign in accounts and poll; reload/restart retains ID, re-auth works; load
a second checkout path or fresh profile and confirm the same ID. Keep real
mail/tokens out of artifacts. Final owner acceptance remains required.
