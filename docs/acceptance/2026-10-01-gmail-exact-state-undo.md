# Exact Gmail state and modern Undo candidate — 2026-10-01

Branch: `fix/gmail-trash-confirmation`. This continues the owner-approved
private Gmail session transport and conversation-level read/Trash/Undo scope.
The repository's Gmail Trash containment remains active pending acceptance.

## Findings and fix

A real Trash write returned HTTP 200 with framed JSON and no legacy `ar` success
record. The complete exact conversation lookup confirmed every member in Trash.
Confirmation now requires all exact members to have the intended labels, with
complete unique `cs` membership matching every `ms` row and fresh account
ownership. Neither HTTP success, `ar` text, Trash search membership nor unread
feed absence can bypass this requirement. Unknown state preserves uncertainty;
mailbox POSTs are never replayed automatically.

The HTML `h/?s=t` Undo endpoint failed in the signed-in account. The replacement
uses the modern Sync Inbox label operation, a freshly bootstrapped framework
XSRF token, and freshly parsed owning-session metadata. It sends only the exact
complete member list, adds Inbox, removes the native restore folder labels, and
preserves unread status. Preflight rejects incomplete/mixed-folder state; already
restored Inbox state resolves without another mailbox write. Ownership and worker
authorization are rechecked before writing and before recording success.

Google's publicly served static client was inspected through Chrome Debugger.
The inspected modules map `GLOBALS[2]` to numeric build changelist, `[3]` to
build label, and `[9]` to session `ik`. `SZB` header construction, `ATj` capability
construction, `nil` initialization, and framework `/token` bootstrap were traced.
The adapter uses source-derived unconditional capabilities and client metadata;
it does not copy native requests, device identifiers, storage headers or trace
values. Static-source fingerprints, excluding inline account data:

- Bootstrap/runtime source: `b102bebe9940be99dbb1517eb58d8da1fc68e9da6c3625866b31eae7b7f534ad`
- Configuration/capabilities source: `7f10cc7e77be4841cdaa47bf1b689cd5f04e8776bf874ad2f80ce9191e0acb2f`
- Header adapter source: `0fb9e27a7a19559a9e978f57b4c26a24aa75c2879e67def574ab90136617cf8c`

This remains an unsupported private protocol. Fresh metadata and fail-closed
checks reduce stale-session and false-success errors; they do not make it a
stable supported API. A supported Gmail API adapter would require the OAuth
setup previously declined by the owner.

## New candidate verification

Environment: Chrome 154, Arch Linux / niri, isolated Chrome test profile, actual
unpacked extension. Only owner-approved Sonarr “episode downloaded” mail was
mutated. The browser parking daemon was temporarily paused to permit interaction.

- RED regression before modern Undo implementation; Node 24 `npm run verify`
  passes **253 tests** after implementation. Includes exact member completeness,
  precision-safe IDs, scoped labels, invalid token/metadata, changed account,
  revoked worker authorization, lost response without replay, contradictory
  post-state, and already-restored state without writing.
- **Three complete real popup Trash → Undo cycles passed**, each with exactly
  two mailbox POSTs and one token bootstrap. Every exact member reached Trash,
  then Inbox; unread status and the restored popup card survived Refresh.
- Cycle three reloaded the unpacked extension between Trash and Undo: the
  persisted Undo journal restored successfully after worker restart.
- Further automated cycles were stopped at the owner's usage-cost request.
  Cleanup checked the remaining isolated-profile journals, restored two test
  conversations, found three already in Inbox, and left zero unresolved targets
  among those records. Existing uncertainty evidence was retained.
- Diagnostics contain no account address, target/member ID, provider body,
  request headers, tokens, mail content or session key.

## Owner-run acceptance — repeated cycles passed, broader checks pending

On 2026-10-01, the owner reported “yep all tests passed” after receiving the
five-cycle extension Trash → Undo checklist for candidate `4d13c20` in the
separate Chrome test profile. This records an owner-reported pass for repeated
cycles, restored unread cards after popup Refresh, and Inbox/unread state after
refreshing Gmail, with no reported failures. No new agent-run tests were performed
for this report. The report does not establish multi-member, mixed-folder or
second-account acceptance; those checks remain open and containment stays active.

### Subsequent owner failure — 2026-10-01

While preparing the multi-message Sonarr check, the owner reported that extension
Trash displayed “The result could not be confirmed” and offered “I’ve checked”.
Whether the target actually contained multiple messages and its resulting Gmail
folder state are not yet established. Saved diagnostics and the uncertainty lock
are to be preserved; no repeat mailbox write was requested. The earlier repeated
cycle pass remains recorded, but this new case is unresolved and blocks acceptance.

### Member target diagnosis and correction — 2026-10-01

The owner confirmed all messages moved to Trash and supplied the newest 20
content-free diagnostics. The latest Trash event (`b3061768-c9ff-4933-9aff-09413a496367`)
was HTTP 200, uncertain/unrecognized, slot 0. Earlier entries include successful
state-verified actions and two additional uncertain Trash events; their causes
are not established by this history.

Read-only inspection of the retained Gmail lock in the isolated test profile
returned one conversation summary, three listed members and three matching
message records, each in Trash and outside Inbox. The saved target differed from
the summary conversation ID but exactly matched a listed member ID. The parser
rejected that identity mapping before evaluating labels. This establishes the
cause of this saved target's false-negative confirmation.

The correction accepts a requested conversation ID or a member ID in the fully
validated member set. Completeness, unique membership, labels and account checks
remain mandatory. Undo uses the resolved conversation ID in its Sync operation,
while preserving the original target for journal/cache matching. Unrelated
targets and incomplete member lists still fail closed.

Both new regressions failed before the correction. Node 24 `npm run verify`
passes 255 tests. Source/diff review checked identity scoping, malformed replies,
Undo request targeting and retained account/authorization checks. The updated
isolated test copy was reloaded; read-only lookup of the same locked target now
recognizes all three messages in Trash. No mailbox write or unlock was performed.
The lock remains saved. A new owner-run three-message Trash → Undo cycle is
still required on this corrected candidate; mixed-folder and second-account
acceptance remain pending. Repository containment remains enabled.

### Corrected three-message candidate — owner pass, 2026-10-01

For corrected candidate `653b56a`, the owner reported “all passed” after the
checklist to restore the saved conversation in Gmail, acknowledge the existing
lock, refresh, and perform extension Trash → Undo. This records an owner-reported
pass for the three-message conversation returning to Inbox with unread status
preserved and no reported error. No additional agent-run mailbox operations were
performed. Mixed-folder and second-account acceptance remain pending; repository
containment stays enabled.

The owner offered to run remaining tests to reduce agent usage. A clean isolated
manual-test copy enables Trash for this authorized test profile only; the main
repository's containment remains unchanged. The test copy contains no E2E helpers.

1. Use only Sonarr “episode downloaded” conversations. Repeat Trash → Undo five
   times. Confirm each card returns unread after popup Refresh, and refresh Gmail
   to confirm the conversations return to Inbox.
2. Report any “Check mailbox”/uncertainty error, missing card, lost unread status,
   or failed Undo. Stop on a failure; do not clear saved evidence or replay it.
3. If an existing authorized Sonarr conversation has two or more messages, use it
   for one cycle and check every message. No multi-member fixture was found among
   the first 50 sampled Sonarr conversations. Real multi-member/mixed-folder and
   second-account acceptance remain open; synthetic coverage is not a substitute.

Do not remove repository containment or claim release acceptance until the
remaining requirements in `tasks/plan.md` are resolved and recorded.
