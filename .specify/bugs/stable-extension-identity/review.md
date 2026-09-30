# Independent implementation review: stable extension identity

Date: 2026-09-30. Assignment: `stable-extension-identity / stable-identity-review`.
Status: **done**. Verdict: **approve the implementation candidate for root inspection**.
No Critical or Required findings. This is a pre-PR quality review, not merge
approval or a completion audit; owner acceptance remains pending.

## Bound context and candidate

- Cwd: `/home/dave/dev/gmail-outlook-extension`.
- Branch: `fix/stable-extension-identity`.
- Base `main` and candidate HEAD both:
  `384cd1a366320e6d9bff720511bf1dda0978a758`.
- Candidate is uncommitted; there is no new commit hash.
- Tracked diff SHA-256 (`git diff --binary main --`):
  `f8f00fbbece73ce1e631c91b66a44f1b7e3e037e0482cb4c30017b7d60f2fbf8`.
- Candidate content SHA-256:
  `d44d6781af623e26bd7de5c1669999c538ece807ff0a68616f3e0b6ac6e0de44`.
  This is SHA-256 of UTF-8 rows `path + NUL + file_sha256_hex + LF`, sorted
  lexicographically by path, for the following 12 paths. This review output
  is excluded so the report does not change its own bound candidate.

Reviewed tracked modifications:

- `README.md`
- `docs/baseline.md`
- `docs/manual-auth.md`
- `manifest.json`
- `package.json`

Reviewed untracked candidate inputs:

- `docs/extension-identity.md`
- `scripts/extension-identity.mjs`
- `tests/extension-identity.test.js`
- `.specify/bugs/stable-extension-identity/assessment.md`
- `.specify/bugs/stable-extension-identity/fix.md`
- `.specify/bugs/stable-extension-identity/test.md`
- `.specify/bugs/stable-extension-identity/review-assignment.md`

The only file written by this reviewer is
`.specify/bugs/stable-extension-identity/review.md`. No Git mutations, commits,
`.dev` writes, browser/network actions, owner questions or delegation occurred.
Temporary test manifests were isolated and cleaned by the test suite.

## Review evidence

**Correctness:** The manifest contains a public RSA-2048 SPKI key, confirmed
with Node's crypto parser. The CLI hashes the original public DER bytes with
SHA-256, takes the first 16 digest bytes, and maps hex digits to `a`–`p`.
Its strict base64 and re-export checks reject malformed, noncanonical and
private-key inputs before printing identity. The default manifest resolves
relative to the script rather than cwd. The tests use Chromium's literal
known-vector ID, independent temporary directories, rejection cases and an
exact repository ID contract. They would catch key rotation as well as a
derivation regression. The expected ID is
`jholbbifabgjdjiiebpghejakkejdpdf`; all candidate references use the matching
`https://jholbbifabgjdjiiebpghejakkejdpdf.chromiumapp.org/` redirect. Existing
`src/auth/microsoft.js:getRedirectUri()` calls Chrome's `getRedirectURL()`
without a path, consistent with the trailing slash in this contract.

**Readability and simplicity:** The small standalone CLI uses standard Node
APIs and one bounded error path. The regression tests cover observable
command behavior rather than duplicating the hash algorithm. The change is
focused and does not add a generalized identity or migration subsystem.

**Architecture:** The pin belongs in the manifest and its inspection tool
belongs in developer scripts. `npm run check` integrates validation into
existing verification. No runtime/provider/UI code or dependency changes
occurred. Documentation consistently explains per-ID storage, retaining old
data, disabling a duplicate install, exact SPA registration and intentional
future store migration. No automatic migration is implied.

**Security:** The committed material is public SPKI configuration. The CLI
reads a local manifest and emits only the ID/redirect or a fixed error;
it does not log rejected bytes or underlying crypto/parser exceptions.
No credentials, scopes, permissions or external registrations were changed.
The private-key rejection test verifies no key bytes appear in stderr.
The author's assertion that generation never wrote a private key is recorded
in the fix artifact; historical generation cannot be independently observed
from this candidate, but no private material is present in the reviewed diff.

**Performance:** The tool performs one local read, one public-key parse and
one digest during developer checks. It adds no extension runtime work,
network traffic, polling or popup fetches. No performance issue was found.

## Fresh verification

Independent commands executed in the stated cwd on installed Node
`v26.10.0`:

| Command | Actual exit | Result |
| --- | --- | --- |
| `node --test tests/extension-identity.test.js` | 0 | 4 passed; 0 failed/skipped/cancelled |
| `npm run identity` | 0 | Exact expected ID and Microsoft redirect printed |
| `git diff --check` | 0 | No whitespace diagnostics |
| `node --version` | 0 | `v26.10.0` |
| Node inline public-key inspection | 0 | public, rsa, 2048 bits |
| `git branch --show-current` | 0 | `fix/stable-extension-identity` |
| `git rev-parse HEAD main` | 0 | Both match the base above |
| Python candidate/diff digest calculation | 0 | Hashes above |

Other read-only context and diff inspection commands completed successfully.
One exploratory `rg` included a nonexistent `src/auth/token-store.js` and
reported that missing path; the actual token/session implementation was then
inspected in `src/auth/microsoft.js`. This was a lookup error, not a failed
candidate check.

The author's Node 24 full-suite and syntax results are recorded in `test.md`;
this scoped reviewer did not independently rerun the full suite or Node 24.
The fresh assigned checks establish derivation and CLI behavior, not an
observed Chrome installation or successful Microsoft authentication.

## Findings and remaining gates

No Critical, Required, Optional or Nit code findings.

**FYI:** `.dev/work.yaml` still focuses on issue-3 and queues outlook-deeplink,
while HEAD and `docs/baseline.md` record the later Outlook link merge. The
baseline document explicitly proposes writer reconciliation. This reviewer
does not treat the stale index as completion evidence or update it.

Owner Chrome/Helium installation ID, actual `getRedirectURL()`, Entra SPA
registration, real-account sign-in, reload/restart recovery and another
checkout/profile remain unrun. Root must inspect this report and candidate,
obtain current dated acceptance, reconcile canonical state, and follow the
separate closeout/PR gates before declaring the work complete.
