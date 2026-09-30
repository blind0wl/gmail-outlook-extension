# Outlook Open — owner acceptance

- Reported: 2026-09-30, repository owner in this thread.
- Candidate: PR #8. Initial link implementation `9569030`; final account
  routing implementation `dfbdda5`, tested and passed by the owner.
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
- [x] Final two-account popup test on `dfbdda5`: after reloading the extension,
      Open from each Outlook account selects the correct message without
      manually switching Outlook web accounts. Owner reported "test passed"
      in response to those exact instructions.

## Account-routing diagnosis and final acceptance

Before the account hint repair, the second account's Open reported moved or
deleted while Outlook web was on the initial account. Switching the browser
to the second made the message open. Adding the initial account's login_hint
to a validated provider link then opened the initial message from the second
browser session. The final popup repair applies that same account hint.

`dfbdda5` passed 157 tests and 32 syntax checks on Node 24 and 26; GitHub Actions
run `36678250499` passed. Independent implementation review found no blocking
findings. The owner separately passed the final two-account popup check above.

The baseline's broader smoke report remains separate. This record does not
claim a complete checklist rerun, stable extension identity, or canonical
project closeout. No real mail content, message URLs, addresses or credentials
are recorded.
