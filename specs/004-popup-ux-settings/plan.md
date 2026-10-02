# Implementation Plan: Popup UX and global check frequency

**Date**: 2026-10-02
**Status**: Owner-approved plan; implementation candidate completed 2026-10-02,
automated/synthetic checks passed, real-account acceptance pending.
**Specifications**: [scope map](spec.md) and its three approved module specs.
**Task list target**: [tasks.md](tasks.md), explicitly selected by the owner.
Preserve `tasks/plan.md` and `tasks/todo.md`; their Gmail follow-ups are separate.

## Overview

Remove the popup's visible Undo tray without changing provider deletion, make
account headers open the owning webmail inbox, and expose one saved check
interval for all enabled accounts. Preserve account isolation, cache-only
rendering, all three themes, recovery controls and existing message Open.
No new dependency, permission, authentication flow or provider write is needed.

## Dependency graph and execution order

| Slice | Prerequisite | Result |
| --- | --- | --- |
| Routing evidence | Existing provider navigation | Establish mailbox selection before wiring headers |
| Delete feedback | Existing worker actions | Trash works without visible Undo; recovery survives |
| Inbox headings | Routing evidence | Each heading opens its own inbox |
| Interval worker contract | Existing alarm/storage | Validated global scheduling with restart/error behavior |
| Interval Settings UI | Interval worker contract | User can save and apply a duration |
| Documentation | All three UX slices | Current usage and design references match behavior |
| Candidate acceptance | All slices and documentation | Automated, synthetic and fresh real-account evidence |

The three modules are independent in product scope. Execute serially because
they share popup source/tests. No parallel agent work is proposed. Front-load
read-only inbox routing evidence because it is the main provider uncertainty.
Worker scheduling tests precede the Settings UI that consumes that contract.
The ordered checklist and checkpoint details live in `tasks.md`.

## Architecture decisions

### Delete feedback

Remove `undo-tray`/summary/list markup, tray CSS and popup-only rendering/timers.
Separate the retained uncertainty renderer from confirmed Undo presentation;
rename it to describe recovery and update all call sites. The `mail-undo`
container's accessible label must describe recovery, without advertising Undo.
Change successful Trash feedback to “Moved to Trash.” Preserve `mailActions`
synchronization because pending/uncertain records still determine locks.

Do not remove the worker's Undo command, journal, expiration or provider restore
code. Retain all provider/worker tests. Replace only synthetic UI assertions
whose visible Undo requirements have been superseded. Other success/error and
read guidance remains unchanged.

### Account inbox links

Add a pure `accountInboxUrl(account)` helper beside existing message builders
in `src/popup/links.js`. It accepts a configured provider/account record and
builds a fixed HTTPS destination with an encoded address. Unknown provider or
missing address yields no navigable destination, rather than a default mailbox.

Candidate destinations for read-only verification:

- Gmail: `https://mail.google.com/mail/?authuser=<encoded-address>#inbox`.
- Outlook.com: `https://outlook.live.com/mail/0/inbox?login_hint=<encoded-address>`.

These are hypotheses derived from current navigation patterns, not promises
from provider documentation. The old Outlook message fallback using an address
in the path must not be repurposed. Historical two-account message Open passed
on `dfbdda5` (see `docs/acceptance/2026-09-30-outlook-links.md`), but that does
not accept a new inbox URL. Record fresh inbox evidence for both directions
with two accounts per provider. If routing fails, investigate within the same
navigation scope; do not silently open whichever mailbox happens to be active.

Keep a semantic `header` and its labelled `h2`, with one block-level native
anchor enclosing the heading's noninteractive contents. Preserve visible text
and style; add theme-aware hover/focus feedback. Use native `target="_blank"`
and appropriate `rel` behavior, or intercept an ordinary activation through the
existing tab helper, but never use both paths for the same activation. Preserve
native link behavior and test exactly one tab. Capture the focused account key
before `renderList()` rebuilds and restore the surviving heading link; retain
the current fallback if that account no longer appears.

### Global interval contract

Use a small `src/store/poll-settings.js` ES module for shared constants,
storage-value normalization and submitted-duration validation. Keep the storage
key `pollIntervalMs`, alarm name `mail-poll`, default 60,000ms, and inclusive
30,000–18,000,000ms range. Existing worker exports can re-export shared constants
to avoid breaking current tests/imports. Preserve existing numeric clamp tests;
new input validation must explicitly reject coercion of strings, null, objects,
NaN and infinities. Retain valid legacy numeric values on read.

The popup loads the stored effective value but does not write it directly.
Add one worker message using the existing result-object convention:

```js
// Request: numeric milliseconds, finite, in range and divisible by 1000.
{ type: "set-poll-interval", pollIntervalMs: 120000 }
// Success: storage and scheduling both completed.
{ ok: true, pollIntervalMs: 120000 }
// Failure: no raw API exception, provider data or credentials.
{ ok: false, code: "invalid-interval" } // or "save-failed"
```

The worker validates again at the boundary and awaits `ready`. Serialize settings
saves with a dedicated promise tail, without blocking behind slow mailbox polls.
Scheduling changes do not invoke polling or touch existing mutation queues.
Update the runtime message allowlist as well as `handleMessage()`.

For Save, snapshot the prior stored preference and current alarm, persist the
new interval, then await replacement of the named alarm using both
`delayInMinutes` and `periodInMinutes`. Return success only after both complete.
On failure restore the prior storage value (remove the key if originally absent)
and restore the prior schedule where possible. Report failure even if rollback
succeeds. If rollback also fails, report that application could not be confirmed;
reload effective state, permit retry, and never claim the new setting was saved.

Storage and alarms are separate asynchronous APIs, not an atomic transaction.
A worker crash between them is reconciled during initialization: read the saved
effective interval, query the named alarm, create it if absent, and replace it
only if its period differs. Preserve the next firing of an already matching
alarm. This avoids resetting the countdown whenever MV3 wakes the worker.
Do not add a new persisted transaction journal for this reversible preference.
Handle initialization-time scheduling failures without making the shared `ready`
promise permanently reject for unrelated mail/account operations. A later Save
or worker initialization can retry scheduling; never present a failed schedule
as successfully applied.

### Settings UI

Place the Mail checking section at the bottom of Settings, after Sound. Use a retained form
with a numeric duration, native unit selector and Save button. Convert units to
milliseconds and validate whole-second results, without floating-point rounding
that silently turns invalid input into a valid value. Display errors beside the
field, associate supporting text/error with the control, and announce save
status. Pending Save prevents resubmission and preserves the selected input.

Maintain effective saved state separately from unsaved draft input. Cache,
theme, sound and unrelated account events do not reset edits or focus. Preference
events update the effective baseline; update displayed values only when there
is no unsaved draft or pending save. A storage event alone is not proof that
scheduling succeeded. Popup close during Save must not stop worker processing.

## Verification checkpoints

1. **After routing evidence and deletion slice:** existing provider/worker tests
   pass; recovery survives tray removal; routing uncertainty is documented.
2. **After heading and worker interval slices:** URL/tab/focus tests pass;
   scheduling tests prove restart preservation, rollback and no provider calls.
3. **After Settings UI and documentation:** complete Node 24 verification;
   browser checks of all themes at 320px/480px, keyboard and zoom; documentation
   names the new behavior and preserves historical acceptance records.
4. **Candidate completion:** code/UX review and fresh dated real-account Chrome
   results for each of the three modules. Do not reuse historical ticks.

Implementation commands:

```sh
nvm install 24
nvm use 24
npm ci
npm run verify
git diff --check
/home/dave/.codex-proxy/skills/impeccable/scripts/impeccable detect --json src/popup/popup.html src/popup/popup.js src/popup/popup.css
```

Load the repository root unpacked; there is no build/server command. Use T3
preview tools for synthetic browser verification. Real mailbox writes during
acceptance require owner testing or an already explicitly authorized disposable
fixture; planning does not authorize writes to arbitrary messages.

## Risks and mitigations

| Risk | Mitigation |
| --- | --- |
| Removing Undo also removes uncertainty controls | Separate recovery renderer first; test mixed journal states and acknowledgement |
| Inbox hint selects the active account instead of its owner | Read-only two-account checks before shipping; keep exact-account criterion |
| Header rerender loses keyboard focus | Restore by stable provider/account identity; test surviving and removed accounts |
| New interval is saved but alarm replacement fails | Worker owns both operations, rollback on failure and reconcile on restart |
| Worker wake continually postpones polling | Preserve matching alarm and its scheduled time |
| Preference update erases unsaved input | Keep form DOM/draft state independent of cache renders |
| Browser sleep/throttling delays checks | Honest supporting copy and no exact-time delivery promise |

## Source grounding

Checked 2026-10-02:

- [Chrome alarms](https://developer.chrome.com/docs/extensions/reference/api/alarms):
  same-name creation replaces the alarm, delay/period control initial and
  recurring checks, and normal alarms have a 30-second minimum with possible
  delays. Check existence on worker start for restart compatibility.
- [Chrome storage](https://developer.chrome.com/docs/extensions/reference/api/storage):
  asynchronous local settings and change events; there is no combined
  storage/alarm transaction.
- [Graph message resource](https://learn.microsoft.com/en-us/graph/api/resources/message?view=graph-rest-1.0):
  message `webLink` concerns opening a message, not a guaranteed account-inbox
  routing contract. Inbox hints therefore need direct compatibility evidence.

Use the already available alarms/storage permissions. Avoid requiring newer
alarm persistence flags when querying/recreating the existing alarm suffices.

## Open questions and approval

No unresolved product question. Exact inbox-routing compatibility is a bounded
technical verification task. The owner-selected document paths supersede the
skill's default paths for this initiative. Review this plan and `tasks.md`
before implementation. The owner approved the specifications/plan and invoked
`/build auto`; that authorization superseded the earlier inspection-only
restriction. Build resumed from the handoff without repeating approvals.

## Execution notes — 2026-10-02

Tasks 2–7 implemented and verified; review recorded in the candidate acceptance
file. Task 1's real-provider routing evidence and Task 8's actual extension
acceptance remain pending. Task 3 proceeded as a candidate with explicit routing
uncertainty, without treating synthetic URLs as proven provider selection.
The retained Settings form lives in `src/popup/poll-settings-form.js` to avoid
adding form state to mailbox rendering. The fixture's obsolete expanded-preview
click was removed because production previews are always visible. A select-value
shim is limited to Linkedom tests; production uses native select semantics.
