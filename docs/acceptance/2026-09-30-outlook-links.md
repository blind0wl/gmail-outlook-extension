# Outlook Open — owner acceptance

- Reported: 2026-09-30, repository owner in this thread.
- Candidate: PR #8. Link implementation `9569030`; later commits up to
  `e66fc07` only recorded diagnostics and did not change production behavior.
- Loaded source: owner console output confirmed `safeOutlookWebLink` present.
- Environment: previously reported Helium 0.18.1.1 / Chromium 154.0.8037.57,
  Arch Linux x86_64; not separately reconfirmed for this attempt.

## Observed sequence

Reload followed by Open failed. Refresh followed by Open also failed. A
read-only diagnostic confirmed five cached Outlook messages had no parsable
webLink, so the popup used the legacy fallback.

The owner then followed the extension's Outlook Sign in → Refresh → Open
recovery instructions and reported: "oh that worked". This accepts exact-
message Open in that recovered account. It is consistent with the reload
clearing extension credentials while preserving old cached mail.

## Scope

- [x] Updated link code loaded in the owner's extension.
- [x] Open selects the requested Outlook message after sign-in and refresh,
      based on the owner's report.
- [ ] Another Microsoft mailbox signed into the browser: not separately
      reported in this acceptance.

The baseline's broader smoke report remains separate. This record does not
claim a complete checklist rerun, stable extension identity, or canonical
project closeout. No real mail content, message URLs, addresses or credentials
are recorded.
