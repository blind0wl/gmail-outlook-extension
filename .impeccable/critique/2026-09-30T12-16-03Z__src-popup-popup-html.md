---
target: Critique first
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/dave/dev/gmail-outlook-extension/src/popup/popup.html"
target_fingerprint: "sha256:15e061f176ef7e40d6448523fbff08aedb771e373037baf3ea45e6a9e094742d"
target_path: /home/dave/dev/gmail-outlook-extension/src/popup/popup.html
timestamp: 2026-09-30T12-16-03Z
slug: src-popup-popup-html
closed: true
---
# Critique — src/popup/popup.html (Operate, 2026-09-30)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Refresh has no progress/completion/last-checked signal |
| 2 | Match System / Real World | 2 | "unread" hides extension-local read override |
| 3 | User Control and Freedom | 3 | Remove has no visible recovery |
| 4 | Consistency and Standards | 3 | Sign in + Sign out shown together regardless of state |
| 5 | Error Prevention | 2 | Remove adjacent to routine actions, equal weight |
| 6 | Recognition Rather Than Recall | 3 | Preview has no visible disclosure cue |
| 7 | Flexibility and Efficiency | 2 | Sequential nav + busy first account buries later accounts |
| 8 | Aesthetic and Minimalist Design | 3 | Separate Open line makes ~130px rows |
| 9 | Error Recovery | 2 | Generic failures + raw codes, duplicated global/inline errors |
| 10 | Help and Documentation | 2 | Gmail "appears automatically" conflicts with manual Add form |
| **Total** | | **24/40** | **Acceptable** |

## Design Specificity Verdict

Product-specific composition, familiar visual vocabulary. Full-address account headers, separate same-provider panels, preserved empty accounts, distinct Preview/Open express the multi-account task. Midnight strongest; Slate credible; Signal silver toolbar adds character but shifts layout with extra bottom spacing. Biggest opportunity: trustworthy mailbox state + cheaper reach to later accounts.

Deterministic scan: 1 advisory only — design-system-color #b4b8bc at src/popup/popup.css:103 (.signal-swatch). Assessment B flags likely false positive: swatch preview per DESIGN.md, not reusable role. No non-advisory findings. HTML-only scan clean.

Browser overlay injection: skipped (unavailable in child run, no injection attempted). No user-visible overlay claimed. Synthetic evidence: docs/ui-workspace/capture.json + .impeccable/review across 404/380/320/480 + intrinsic/autosize extras; zoom-equivalent is CSS emulation, not Chrome zoom.

## What's Working

- Account ownership is structural — full addresses + separate panels reduce wrong-account actions.
- Native interaction well chosen — radios, checkboxes, range, Back/Cancel, visible focus suit compact extension.
- Themes form coherent system — surfaces/controls/accents/native scheme change together, no animation.

## Priority Issues

1. [P1] Open silently changes meaning of unread — card-open calls markRead() before provider open; counts drop via localRead while mailbox unchanged. Fix: explain local behaviour, distinguish local opened vs provider unread. Keep stage boundary (no mailbox-write controls).
2. [P1] Refresh provides no trustworthy freshness signal — button disables briefly, success clears status. Fix: Checking… + completion result + per-account last-successful-check; keep partial failures scoped.
3. [P1] Account setup/management contradictory — Gmail help promises auto-appear vs required address+Add; Sign in/out/Remove always together; Remove unexplained, no recovery. Fix: reconcile copy, state-appropriate actions, explain Remove local-only, proportionate recovery.
4. [P2] First account monopolizes viewport — ~130px rows (Open on own line); 2 messages bury next account; preview repeats subject/snippet. Fix: tighten action layout, account jump if warranted, visible disclosure cue, expanded replaces/extends clearly. Preserve panels.
5. [P2] Keyboard preview loses triage info — card-summary name has subject/account/provider, omits sender/time; long senders truncated, not restored in preview. Fix: associate sender/time/unread accessibly, restore full sender in preview.

## Persona Red Flags

Sam (a11y/keyboard/zoom): 2 controls per message to Tab through; summary name omits sender/time; help/errors not associated with email field; small metadata needs real 200% zoom verification.
Alex (power): no jump between two Gmail accounts; busy first account buries later ones; 12 repeated account buttons in 4-account Settings; Themes before setup slows setup path.
Jordan (first-timer): toolbar count scope vs filters unclear; message text looks informational (no Preview cue); Open side effect undisclosed; auto-appear vs manual entry conflict; success has no explicit confirmation.

## Minor Observations

- Themes ~180px before Accounts prioritizes appearance over setup (deliberate direction change if moved).
- Signal-only toolbar bottom spacing reduces mail capacity, shifts positions between themes.
- "Pause alerts while provider tab focused" scope ambiguous (account/provider/all).
- Empty state names Settings, no direct setup action.
- Theme-save retry on already-selected radio awkward.
- Generic account errors can duplicate inline error, mis-suggest Sign in.

## Questions to Consider

- Should every account's status be visible before first account's messages fill popup?
- What should "unread" mean: provider truth or extension-unopened?
- Why does setup begin beneath full theme chooser?
- What explicit ending proves checking mail / connecting account succeeded?
