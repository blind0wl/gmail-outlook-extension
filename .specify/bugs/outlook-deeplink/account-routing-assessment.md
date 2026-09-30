# Assessment update: Outlook browser mailbox selection

Date: 2026-09-30. Base implementation: `9569030`, unchanged through `bc7f79c`.
Verdict: valid; root cause reproduced by the owner with two personal accounts.

The initial account's Open works. The second account's Open reports moved or
deleted while Outlook web is signed into the initial account. Switching the
browser to the second account makes that same message open. Graph credentials
and the browser's active mailbox are separate; preserving webLink alone does
not direct the browser to the account owning the cached message.

A controlled experiment left Outlook web on the second account, took an
initial-account message's validated provider webLink, and set `login_hint` to
its owning account. The owner confirmed it opened the initial account's message.
This is direct runtime evidence for the candidate parameter. Graph documents
the original message webLink and signed-in mailbox requirement, but does not
promise automatic account selection by this extra parameter. Real-browser
acceptance must therefore remain a gate for both directions.

Preferred remediation: append/replace `login_hint` with the normalized cached
account after the existing URL origin/credential validation. Preserve message
identity and other provider URL parameters. Keep URLs without a known account
and unsafe/legacy fallback behavior unchanged. Do not derive browser account
slots, change provider credentials, add permissions, or introduce a new UI.

Files: src/popup/links.js; tests/outlook-deeplink.test.js; README.md and popup
checklist; bug-directory assessment/fix/test/review artifacts. Add regression
coverage for two distinct mailbox hints, encoded ItemID preservation, overriding
an existing hint, and missing account. Existing trust-boundary cases must pass.

Required verification: observe red before the repair, full npm run verify and
Node 24 checks, actual popup synthetic Open, independent review, and owner
two-account Open after loading the final candidate. Canonical state/closeout
remain the writer's responsibility; this assessment does not mark done.
