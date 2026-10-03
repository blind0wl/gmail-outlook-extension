# PR #22 Outlook diagnostics — 2026-10-03

Runtime candidate: `c67f9189dc986a9406e358cee3db1d31718fbaf9`, combining
PR #22 with current main `600d873`. Subsequent acceptance-record/PR-description
updates do not change this runtime candidate. Fresh real-account owner smoke
acceptance: **passed on 2026-10-03**, as recorded below.

The original PR merged cleanly and passed 342 tests, but review reproduced
three gaps: arbitrary identifier-shaped private content survived code
sanitization, forced renewal replaced the endpoint rejection with
`AUTH_REQUIRED`, and sign-out marker storage failures looked like sign-outs.

The candidate rejects unknown diagnostic codes at persistence and display
boundaries, preserves forced-renewal endpoint codes while keeping auth recovery,
and treats sign-out marker storage failures as sanitized transient failures.
Session-only token storage, account isolation, scopes and permissions are
unchanged. Popup CSS/HTML, badge rendering and session generation guards match
current main; the only popup.js change documents the new diagnostic fields.

Fresh verification:

- Three new regression tests failed before the fixes for their expected causes.
- All 10 diagnostics tests passed after fixing those failures. Explicit
  sign-out remains an authentication failure; unknown code strings are dropped.
- Node 24.19.0, `npm ci`, `npm run verify`: 346 tests passed; syntax and
  extension identity checks passed. `git diff --check` passed.
- Independent read-only review found the issues resolved with no remaining
  findings; its supplementary token/session/diagnostics checks passed 42 tests.
  That supplementary run used Node 26 and does not replace the Node 24 full run.

Before merging, reload this candidate in the existing Helium profile and record
a new owner result for this candidate:

- [ ] Current popup appearance and unread badges remain correct.
- [ ] Outlook Sign in succeeds after reload; Refresh updates the account.
- [ ] Gmail and other configured accounts continue working independently.
- [ ] Any Outlook recovery row has only the account and approved diagnostic
      identifiers, with no unexpected popup console errors or popup network
      requests. If no failure occurs, record that diagnostic failure UI was
      not observed rather than claiming it was exercised.
- [ ] Record browser version and any failures in the owner result.

This improves diagnosis of #20; it does not establish or fix the underlying
recurrence cause. Historical acceptance results have not been reused.

## Owner smoke result — 2026-10-03

Loaded PR head: `be1e19acc9af7533be672326cf031fbefb82d01e`, whose runtime
source matches `c67f918`. In response to the candidate-specific reload,
Outlook sign-in/Refresh, other-account and appearance smoke request, the owner
reported: "no errors, just needed to sign in to outlook".

This accepts the requested smoke pass, including Outlook sign-in recovery.
Requiring sign-in after extension reload is consistent with session-only
credential storage. The owner reported no errors or visual regressions.
Browser version, individual account results and explicit DevTools Console/
Network observations were not supplied. No token endpoint rejection was
reported, so failure-specific diagnostic UI remains covered by automated tests
and has not been claimed as exercised with a live provider. The checklist
above retains those detailed checks as unconfirmed; no historical tick was reused.
