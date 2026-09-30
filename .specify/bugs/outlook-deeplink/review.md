# Independent quality review: outlook-deeplink

- Date: 2026-09-30.
- Assignment: outlook-deeplink-review.
- Status: done (review submission only).
- Verdict: no blocking findings; approve the implementation for owner acceptance.
- Base: main / HEAD `0a78989aaf9031d764c67e131604ec29c0a63efa`.
- Candidate: uncommitted repair on `fix/outlook-deeplink`, including the new regression test and bug artifacts. No candidate commit exists.
- Report: `.specify/bugs/outlook-deeplink/review.md`.
- Ownership: no commits or Git mutations; no `.dev` writes. This report is the only file written by the reviewer.

## Findings

No Critical or Required findings across correctness, readability, architecture, security, or performance.

**Optional — acceptance wording:** `tests/popup-checklist.md:24` still describes the Outlook target as only `outlook.live.com`, whereas the repair deliberately accepts `outlook.office.com` and `outlook.office365.com` too. Consider describing this as a validated Outlook web origin so a valid provider link does not appear to fail that checklist item. This is a documentation consistency suggestion, not a merge blocker.

## Review evidence

Reviewed the assessment before the tests, then the complete seven-file tracked diff against main and the new `tests/outlook-deeplink.test.js`. Read the bug fix/test reports, assignment, README, v1 product design, popup checklist, historical screenshot provenance, provider implementation, cache projection, persistence/hydration bridge, actual popup Open handler, and existing provider/link tests.

- Correctness: `$select` requests `webLink`; normalization and merge retain string links; storage persistence and hydration use that shape. The regression traverses the real provider/cache/storage/resolver path, resets memory before hydration, checks encoded identifiers, and verifies refresh preserves local read state. Legacy entries and invalid links retain the account-aware fallback. Gmail ignores `webLink`. The actual popup handler already resolves `threadUrl(item)` and sends mark-read separately.
- Readability: the small private URL helper names its policy clearly; the explicit origin set and existing fallback keep the flow simple. No unnecessary abstraction or orphaned production code was introduced.
- Architecture: provider retrieval remains in the provider layer; cache retains an optional normalized field; final navigation validation belongs in the pure popup resolver. Popup remains cache-only; scopes, permissions, provider error isolation, and server read state remain unchanged.
- Security: URL parsing rejects malformed inputs; exact HTTPS origin checks reject external hosts, spoofed suffixes, alternate ports, relative URLs, and dangerous schemes. Credentials are explicitly rejected even on trusted origins. Mail links remain in local cache, with no new logging, diagnostics, or bearer-token navigation. No dependencies were added.
- Performance: no new requests or loops were introduced. The existing bounded provider scan/cache remain bounded; one small string per cached Outlook item and one URL parse per Open are proportionate to this repair.

## Commands and results

| Command | Exit | Observed result |
| --- | --- | --- |
| `node --test tests/outlook-deeplink.test.js` | 0 | 3 tests passed, 0 failed, 0 skipped |
| `node --version` | 0 | v26.10.0, installed shell runtime |
| `git diff --check` | 0 | No whitespace errors |
| `git diff main` / `git diff main --stat` | 0 | Reviewed all seven tracked changed files |
| `git status --short`, `git rev-parse HEAD`, `git branch --show-current` | 0 | Dirty candidate on the stated branch/base; new test and bug artifacts are untracked |

The review's targeted test run used the installed Node 26 runtime. The author's Node 24 full-suite pass is recorded in `test.md`; this reviewer did not independently rerun that suite or claim fresh Node 24 evidence. No browser, network, real-account acceptance, or closeout validation was performed in this scoped review.

## Candidate content identity

SHA-256 of implementation and regression files inspected:

```text
94b4ac0cee2f90741b246b9d2eb5942ae41dc6cf4a591f333516a10668aa5b5e  src/popup/links.js
084fcd0abae5e5b275778db36ea866d19fd7250f2a1ef719a47a8fd99b1bc657  src/providers/outlook.js
90cfd7ed60fb6b1c0288c02f7506f960701057330653b6b7985730d3c5be8380  src/store/cache.js
b1ac8029bfea50ea8db7a9b94b96dbf7fb4350dc50e51855b8fe348a9c9c3e07  tests/outlook-deeplink.test.js
```

## Remaining gates and state proposal

Real-account exact-message selection after refresh/restart and under a different Microsoft browser session remains unverified. The existing fallback limitation is recorded honestly. Synthetic tests establish link plumbing and local navigation policy, not Microsoft's remote mailbox behavior. Owner acceptance and the subsequent independent bound completion audit/closeout remain required; this review does not authorize merge or mark the bug done.

Canonical state still says queued, while the candidate and bug artifacts show an applied repair with partial verification. The recorded automated gate's directory form remains inconsistent with the documented Node 24 command; `docs/baseline.md` already proposes a writer update. These are known state/evidence discrepancies, not new code defects. Proposed report to the canonical writer: repair independently reviewed with no blocking findings, targeted regression passed, owner acceptance pending; do not set done from this submission.
