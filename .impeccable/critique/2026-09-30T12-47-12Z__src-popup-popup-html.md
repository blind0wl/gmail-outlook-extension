---
target: src/popup/popup.html
total_score: 28
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
target_identity: "file:/home/dave/dev/gmail-outlook-extension/src/popup/popup.html"
target_fingerprint: "sha256:bcc0da861749f4945d5db13f3c9925ddb8deb351e4e836a178fe03d17f4159a1"
target_path: /home/dave/dev/gmail-outlook-extension/src/popup/popup.html
timestamp: 2026-09-30T12-47-12Z
slug: src-popup-popup-html
---
# Re-critique — src/popup/popup.html (Operate, post-fix)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Account freshness misleading; success styled as danger |
| 2 | Match System / Real World | 2 | "Unread" is a hybrid provider/local state |
| 3 | User Control and Freedom | 3 | Local opened state has no reversal |
| 4 | Consistency and Standards | 3 | Preview cue + success/error styling inconsistent |
| 5 | Error Prevention | 3 | Lifecycle actions offered regardless of state |
| 6 | Recognition Rather Than Recall | 3 | Freshness hover-only; toolbar icon-only |
| 7 | Flexibility and Efficiency | 3 | Sequential traversal still costly |
| 8 | Aesthetic and Minimalist Design | 3 | Repeated Preview labels consume height |
| 9 | Error Recovery | 3 | Raw codes + generic add failures |
| 10 | Help and Documentation | 3 | Lifecycle explanations buried below list |
| **Total** | | **28/40** | **Good** |

Prior run: 24/40 Acceptable. Setup-copy contradiction resolved; keyboard preview resolved in implementation; Open/unread, Refresh freshness, viewport monopoly partially resolved.

## Design Specificity Verdict

Authored for multi-account mail: full-address headers, provider badges, flat rows, separate Mail/Settings. Midnight calm; Slate/Signal same grammar. Missed opportunity is operational specificity — whose mail is clear, but which account was checked, when, and what "unread" means is not.

Deterministic scan: 1 advisory, 0 non-advisory — design-system-color #b4b8bc at popup.css:111 (.signal-swatch), agreed false positive (swatch preview per DESIGN.md). Committed captures predate e63aa3b (hashes mismatch popup.html/css/js); rendered appearance of jump nav, Preview cue, flex rows, new copy unverified from stale captures — fresh captures required. No overlay claimed; browser injection skipped in child run.

## What's Working

- Account ownership unmistakable, including same-provider accounts.
- Preview earns its place: visible affordance, native semantics, restored metadata.
- Themes one consistent system, immediate, no motion.

## Priority Issues

1. [P1] Freshness claims exceed evidence — one session-global timestamp copied to every account title; empty right after Refresh; identical on healthy/failed/paused. Needs persisted per-account check info + explicit partial-failure feedback (likely needs worker outcomes, not just popup copy).
2. [P1] "Unread" conflates mailbox state with local attention — isUnread() excludes opened mail but labels still say unread; copy explains mechanism without resolving vocabulary.
3. [P1] Jump nav fragile — scrolls away; rebuild loses focused-button identity (focus fell to BODY on cache update); no counts/status in nav.
4. [P2] Recovery copy not diagnostic — accountStatusLabel leaks numeric codes (429); add failure blames the address regardless of cause.
5. [P2] Settings appearance-first — Themes ~180px before Accounts; lifecycle note below whole list, not local to accounts.

## Persona Red Flags

Sam: jump focus loss on updates; hover-only freshness unreachable by Tab; 11px operational text; 200% zoom acceptance still pending.
Alex: jumps disappear after first move; no compact health/count overview; sequential traversal costly.
Jordan: "Checked mail" reads as universal success; Themes-first ordering; generic failure copy misdirects retry.

## Minor Observations

- lifecycle-message danger-styles Checking/Checked, persists across views.
- Preview cue has no collapse state (▾ always).
- 11px timestamps/jump labels/cues small for operational info.
- Empty state doesn't distinguish checked-empty from no-data.
- "No IDs / nothing to register" introduces concerns users never had.

## Questions to Consider

- Provider-unread or opened-here — which does "unread" mean, and why does the UI claim both?
- What earns the word "Checked" on a paused or failed account?
- Why does account nav show addresses without counts, health, freshness?
- Should first Settings decision be theme or mailbox?
