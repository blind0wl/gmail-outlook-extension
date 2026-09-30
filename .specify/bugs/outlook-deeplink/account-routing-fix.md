# Fix update: select the owning Outlook.com mailbox

Date: 2026-09-30. Assessment: account-routing-assessment.md. Status: applied.

`safeOutlookWebLink` now receives the cached account and sets `login_hint` on
validated outlook.live.com URLs. This replaces an existing hint and leaves
the provider message identity/other query values intact. The account hint is
limited to the personal Outlook.com endpoint tested by the owner; office.com
and office365.com provider URLs retain their previous behavior. No scopes,
permissions, auth flows, cache layout or UI change.

Tests verify two owning mailbox hints, replacement of a stale hint, encoded
OWA query and deeplink path IDs, missing account, persistence, and the existing
URL trust boundary. Four of five focused tests failed before the repair; all
five now pass. Full suite: 157 passed; 32 syntax checks. Node 24.21.0 repeats
both successfully. Real popup synthetic Open produces distinct hints for two
cached accounts and preserves encoded message parameters.

README/checklist explain the routing and affected acceptance. Historical
reports remain history. Owner's controlled hinted URL experiment passed, but
owner testing of both actual popup accounts on the final candidate remains
required. See account-routing-test.md and the independent review report.
