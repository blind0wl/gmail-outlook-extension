# Outlook link acceptance follow-up — 2026-09-30

Candidate: PR #8, implementation commit `9569030`. Actual loaded source has
not yet been independently confirmed in the owner's browser.

## Owner observations

1. Reloaded extension and clicked Open: Outlook opened without selecting the
   clicked email. Owner confirmed no popup Refresh in this first attempt.
2. Clicked popup Refresh, waited, then clicked Open: a blank inbox opened
   instead of the selected email.

Acceptance result: **failed**. This supersedes the pending real-account gate
in `test.md`; automated/synthetic passes do not establish a working real link.
PR remains unaccepted and the bug is not done.

## Investigation

The local branch requests Graph webLink, preserves it through normalization
and cache, and validates it in the actual Open handler. Unknowns: whether
the owner loaded that source, whether Outlook refreshed successfully, whether
the cached message has a valid allowlisted webLink, and whether Microsoft
redirects that supplied URL to the inbox.

Reload clears chrome.storage.session, where this extension holds Outlook
credentials. A successful click/response from Refresh does not prove an
Outlook poll succeeded: handleMessage returns ok even when an account poll
reports needsSignIn/backoff/failure. This is a diagnostic hypothesis, not a
confirmed explanation of the owner result. Chrome's documented session
storage behavior: https://developer.chrome.com/docs/extensions/reference/api/storage

Requested read-only, redacted console diagnostics: loaded link-code marker,
cached Outlook link presence, origin, coarse route category, ItemID query
presence, and URL credentials boolean. No mail content, addresses, message
IDs, URL query values, auth data, or raw errors requested.

Next: use those results to locate the failing boundary before changing code
or another acceptance attempt. Do not rewrite the deep-link route speculatively.

## Owner diagnostic result

The read-only console check returned `updatedLinkCode: true` and five cached
Outlook entries with `hasWebLink: false` (no parsable URL). This confirms the
updated popup resolver is present, but the new provider navigation path is
not being used for those entries. It does not prove whether Graph returned
no link or an Outlook refresh failed before obtaining a new response.

Next controlled check: use the extension's per-account Outlook Sign in action.
That action performs interactive credential recovery and then a silent poll.
Refresh and retry Open after it completes. Browser Outlook sign-in is separate
from the extension's Graph session. If no usable webLink appears after that,
inspect only sanitized poll/account-state results before changing the route.

## Recovery acceptance

After the extension Outlook Sign in → Refresh → Open instructions, the owner
reported "oh that worked". The recovered-account exact-message check passed;
see `docs/acceptance/2026-09-30-outlook-links.md` for its scope and unreported
checks. This supersedes the earlier failed attempt for that recovered account.
The new link implementation required no further code change. README now
explains credential recovery after reload/restart. Canonical closeout and the
separate multiple-browser-mailbox check are not claimed from this report.

## Second Outlook account

The owner added another Outlook account, successfully signed in, and saw its
mail in the extension. Open still works for the initial Outlook account, but
Open on the second account produces "The message might have been moved or
deleted" in Outlook web. The multiple-mailbox acceptance check therefore
fails; the initial-account pass does not establish correct cross-account Open.

Current hypothesis: the provider message URL is evaluated in the initial
Outlook web mailbox session, because Graph authentication and Outlook browser
authentication are separate and the supplied webLink does not select a browser
account. Alternative causes include an outdated/moved message or a wrong cache
link. Asked the owner which browser account is selected on the error page.
No account-switching URL or regression expectation is chosen without evidence.

The owner's screenshot shows the standalone Outlook message view with
"(No subject)" and the moved/deleted error, with no profile menu. That view
does not expose the active mailbox. Asked the owner to inspect the normal
inbox at `https://outlook.live.com/mail/` in a separate tab. Microsoft documents
webLink's default popout behavior and dependency on the web mailbox session:
https://learn.microsoft.com/en-us/graph/api/resources/message?view=graph-rest-1.0

The owner confirmed the normal Outlook browser tab is signed into the initial
account. Requested one controlled check: switch that browser tab to the second
account, then retry Open for a second-account message. This separates a web
session mismatch from a genuinely missing message. Await that result before
selecting an automatic account-routing approach or changing product behavior.

The owner switched Outlook web to the second account and retried that account's
message: it opened successfully. This confirms the failure is browser mailbox
selection, rather than the second account's Graph authorization or a missing
message. Both provider links are usable in their matching browser session.

Next experiment: while Outlook web remains on the second account, open an
initial-account message using its validated Microsoft webLink plus login_hint
for that initial account. The console experiment reads extension storage and
opens one trusted Outlook tab; it prints no addresses, mail, IDs or URLs. This
hint's automatic switching behavior is not promised by Graph's webLink contract,
so owner-observed behavior is required before implementation.

The owner ran the hint experiment and reported it opened the initial account's
message while Outlook web was on the second account. The minimal repair now
adds that account hint to validated outlook.live.com provider links. Real
popup acceptance in both directions is still pending the final candidate.
