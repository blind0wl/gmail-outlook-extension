# Independent quality review: Outlook.com account routing

- Date: 2026-09-30.
- Assignment: `outlook-account-routing-review`, work item `outlook-deeplink`;
  brief: `account-routing-review-assignment.md`.
- Cwd: `/home/dave/dev/gmail-outlook-extension`.
- Status: **done** (review submission only).
- Verdict: **approve implementation for owner acceptance; no Critical or
  Required findings**. Final popup acceptance and closeout remain pending.
- Base/HEAD: `bc7f79c7f81285a7e3aa01154f24502f571ec2dc` on
  `fix/outlook-deeplink`.
- Candidate: uncommitted changes against that base; no candidate commit.
- Ownership: this report is the reviewer's only write. No commits, Git
  mutations, `.dev` writes, browser/network actions, or delegation performed.

## Scope and findings

Reviewed all five tracked changed paths: `src/popup/links.js`,
`tests/outlook-deeplink.test.js`, `README.md`, `tests/popup-checklist.md`, and
`acceptance-followup.md` in this directory. Read the new account-routing
assessment, fix, test, and assignment artifacts. Also inspected the provider
account normalization, cache projection, actual popup Open handler, existing
link tests, v1 design, and project verification policy as supporting context.
The earlier repair review is historical evidence, not approval of this candidate.

No Critical, Required, Optional, or Nit code findings identified.

**FYI — remote behavior remains an acceptance gate:** The regression proves
that each cached account emits its own hint and keeps the encoded message
identity. It cannot prove Microsoft switches browser mailboxes. The owner
experiment establishes one controlled direction, while final popup Open in
both directions remains explicitly pending in the current artifacts. This
limits the approval to implementation quality; it does not authorize merge
or establish bug completion.

## Five-axis review

- **Correctness:** The private resolver receives the owning normalized cached
  account and replaces `login_hint` only after existing link validation and
  only on `https://outlook.live.com`. `URLSearchParams.set` safely encodes the
  account and replaces stale hints without string concatenation. The tests
  distinguish two owning mailboxes, replace an existing hint, retain encoded
  ItemID and deeplink path identity, and traverse provider/cache/persistence
  hydration. Empty account, office.com/office365.com links, unsafe links,
  legacy fallback, Gmail routing, and local-read persistence retain expected
  behavior. This is the smallest repair supported by the recorded owner
  mailbox-mismatch reproduction and successful hint experiment.
- **Readability and simplicity:** One extra helper argument and one guarded
  parameter update express the routing policy directly; the comment explains
  the Graph/browser session distinction. The existing helper remains small,
  with no new abstraction, unrelated conditional flow, or orphaned code.
- **Architecture:** Navigation selection stays in the existing pure popup
  resolver. The popup continues to consume cache only; provider retrieval,
  authentication, cache shape, permissions, and per-account error isolation
  do not change. Personal Outlook.com scope matches the v1 spec. The existing
  office origins are retained without extending the experiment to work mail.
- **Security:** Exact HTTPS origin validation and rejection of URL credentials
  precede account insertion; the adversarial origin/scheme/port tests still
  pass. Account text becomes an encoded query value on the trusted Microsoft
  endpoint and cannot change the destination origin. No token handling,
  sensitive diagnostics, dependency, permission, or credential exposure is
  added. Durable examples contain synthetic accounts and identifiers.
- **Performance:** The update occurs during Open, with one existing URL parse
  and one bounded query parameter mutation. It introduces no fetching,
  rendering work, polling, unbounded loops, or new dependencies.

## Verification evidence

| Command | Exit | Fresh reviewer observation |
| --- | --- | --- |
| `node --test tests/outlook-deeplink.test.js` | 0 | 5 passed; 0 failed, skipped, cancelled, or todo |
| `git diff --check` | 0 | No whitespace errors; rerun as a separate command |
| `node --version` | 0 | v26.10.0 installed shell runtime |
| `git diff bc7f79c`, `git status --short`, base/branch inspection | 0 | Candidate and paths match the assignment |

The author's current account-routing-test report records the relevant red
failures, full suite/syntax checks, Node 24.21.0 checks, and synthetic popup
navigation. The reviewer read those records but did not independently rerun
the full suite, Node 24, or browser acceptance. There is no build requirement
for this unpacked extension. No final closeout validator was run in this
bounded implementation review.

## Candidate identity

SHA-256 of reviewed candidate source, test, and scoped artifacts:

```text
5985feb7e7f88348f29b871f4bea63d29554aa56d1a2956921c18ff4444ecb3b  src/popup/links.js
e6f5ffc97b6eeabf111cec95415db09a1e7a72e9fc8a3277511ad28d3db1e1ee  tests/outlook-deeplink.test.js
de828586e4a105e42b19abef57dc0e63638849a6ab6ab678bd9229eb908aa0a1  README.md
2be9e68d6ad8237ecc4b456943fa634f9108914cd946e769ed4c6abd734683bd  tests/popup-checklist.md
3571be2a8c143ec2cf391be62187fe7a5c33309527148653fe2203aa6f6dcc30  .specify/bugs/outlook-deeplink/account-routing-assessment.md
f8c4e9536840e6850f7c3df9b58a2e50d1d41c0156a2e6e3a1182c8ff13e6710  .specify/bugs/outlook-deeplink/account-routing-fix.md
4ad457be3b3ef43c79e1406a9e0056e0979b2d2504989217020c028114e9e6da  .specify/bugs/outlook-deeplink/account-routing-test.md
172167d4527e763342415efccc0e74317832a05a0dbaf22105c353b22d0f992e  .specify/bugs/outlook-deeplink/acceptance-followup.md
54ab9c572503ff63d9e4179c9a7fbdfa35714a2d8e456b4e749db998c870f78c  .specify/bugs/outlook-deeplink/account-routing-review-assignment.md
```

Base source/test hashes:

```text
94b4ac0cee2f90741b246b9d2eb5942ae41dc6cf4a591f333516a10668aa5b5e  bc7f79c:src/popup/links.js
b1ac8029bfea50ea8db7a9b94b96dbf7fb4350dc50e51855b8fe348a9c9c3e07  bc7f79c:tests/outlook-deeplink.test.js
```

## State proposal and remaining work

The canonical index still lists `outlook-deeplink` as queued although the
candidate and new bug artifacts establish an applied repair under review.
This is a state/evidence discrepancy for the canonical writer, not a source
defect. Proposed update: account-routing implementation independently reviewed
with no blocking findings; focused checks pass; final owner popup acceptance
in both mailbox directions remains pending. Do not mark done from this report.
Root inspection, current acceptance evidence, and the subsequent independent
bound closeout audit remain required under the project workflow.
