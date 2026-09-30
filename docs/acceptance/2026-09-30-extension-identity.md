# Stable extension identity — owner acceptance

- Reported: 2026-09-30, repository owner in this thread: “All checks passed”.
- Candidate: PR #9, implementation `fb18eb92b9f41086927a3210768d53f562e38600`.
  This was the PR head when acceptance was reported; no implementation changes
  followed. Acceptance applies to the setup/checklist supplied for that candidate.
- Environment: previously reported Helium 0.18.1.1 / Chromium 154.0.8037.57,
  Arch Linux x86_64; not separately reconfirmed for this attempt.

## Accepted checks

Based on the owner's report covering the supplied identity acceptance checklist:

- [x] Loaded extension ID matches `jholbbifabgjdjiiebpghejakkejdpdf`.
- [x] `chrome.identity.getRedirectURL()` matches
      `https://jholbbifabgjdjiiebpghejakkejdpdf.chromiumapp.org/`.
- [x] The existing Entra app accepts the exact SPA redirect; connected Outlook
      accounts sign in, Refresh and Open work, and Gmail still works.
- [x] Reload preserves ID, local accounts/cache/preferences and sign-in recovery.
- [x] Browser restart preserves ID/local preferences and Outlook recovery works.
- [x] Another checkout path or fresh profile displays the same pinned ID.

The report does not identify which alternate-path/profile option was used.
No private account data, tokens, message URLs or mail content are recorded.

## Scope and automated evidence

The implementation passed 161 tests, 34 syntax checks and the identity command
on Node 24.21.0 and Node 26. Independent implementation review found no blockers;
GitHub Actions run `36680566200` passed on the accepted implementation.

This records owner acceptance of the identity setup and focused checklist.
The broader baseline smoke record remains separate. PR merge and canonical
project-state reconciliation/closeout are separate steps; this record does
not declare the project done.
