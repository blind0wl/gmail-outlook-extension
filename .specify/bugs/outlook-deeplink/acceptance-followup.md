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
