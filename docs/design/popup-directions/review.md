# Popup direction preview finish re-review

Disposition: SHIP at synthetic proposal-preview scope. Both initial contrast findings are resolved; no remaining material blocker was found in this bounded re-review. This permits proposal handoff, not production deployment, provider-write approval, extension acceptance, or feature closeout. Done means this report submission only.

## Re-review scope and results

Reviewed current held PRODUCT.md, confirmed direction brief, HTML/CSS/JS, supplied wide/narrow Themes screenshots, and the final wide screenshot including revised footer. The owner now approves all three selectable themes and has chosen Midnight desk for new installations; no single-theme selection is required. Incumbent DESIGN.md remains unchanged until the approved production build exists. Earlier account/mail/action assessment below remains applicable; new selector and contrast tokens were reviewed afresh.

- Slate count foreground #3a649b on #eaf0f8 now measures 5.270:1, passing 4.5:1.
- Signal muted #50585f against darkest toolbar gradient stop #cbd0d4 now measures 4.656:1, passing 4.5:1 and resolving the location-dependent gradient risk.
- Settings > Themes has three native radio controls with readable names, labelled radio group, distinct palette swatches, and a Midnight Default marker. The narrow screenshot preserves legibility and enough row height; choice and default remain distinguishable without relying on colour alone.
- Source theme changes preserve the native radio DOM, so focus is not discarded by rerender. Per-frame radio names keep the three comparison controls independent. Theme preferences are isolated in preview-only localStorage keys, validated against known theme IDs on load, with graceful storage-unavailable fallback.
- Both product record and direction brief distinguish approved selectable visual themes from unimplemented provider-write behavior. The final footer invites theme switching and correctly describes Midnight as the planned installation default, while the comparison frames still demonstrate all three initial appearances.

Minor P3 observation: applyTheme updates the visible comparison heading and popup class but leaves the popup aria-label naming its original comparison-frame theme. After switching a frame, that region label can differ from the visible theme name. This does not block the synthetic comparison; synchronize the accessible region label in the production implementation or a later small preview refinement. Settings subtitle does not yet mention Themes; the prominent first Themes section still makes it immediately discoverable.

Root-reported runtime corroboration (not independently rerun): native ArrowDown switched first frame Midnight to Slate with radio focus retained; reload restored Slate; root then restored side-by-side preferences. At 320px, document scroll/client widths were 305/305 and frames 269/269, indicating no horizontal overflow. Original mail/read/trash/Undo/Settings-return evidence remains supplemental. Root reports npm test 160/160 passing as baseline regression evidence; those tests are not prototype selector tests.

Fresh reviewer commands: node --check docs/design/popup-directions/preview.js exited 0 with no output; git diff --check exited 0 with no output; independent Node source-token contrast/SHA-256 script exited 0. Tracked git diff --check does not check the untracked proposal files. Read/view operations succeeded. Report-write Node command exited 0. No browser, network, launcher, server, provider operation or delegated work performed.

## Current SHA-256 bindings (supersede initial candidate bindings)

- PRODUCT.md: 0d937038586042ccf81636d9780c6239b0a0d7249498ce69bbb08243195af5d7
- docs/design/popup-directions/brief.md: 595cdf9f2e7638ff76bae79e573975364d02ad383f2c356a5321468c120ac521
- docs/design/popup-directions/index.html: c967785cd332818bf08608b46cd43d5b1d64534bbd4c4a48caf68c5b529fdf52
- docs/design/popup-directions/preview.css: c447040fdee300c64530958ff05ab769d922ca2955c6a92a9c5b0520369a84a3
- docs/design/popup-directions/preview.js: 53392ed3fee0b0caf0b5d4c1b0b00d700a9ecaa1abcd382ef6a9cb7dd326a4a3
- Wide Themes screenshot /home/dave/.t3/userdata/browser-artifacts/browser-screenshot-127-0-0-1-munxoatn-049c6d34.png: c09c238dfef6aecf82f6660f10623e2ef7b6c39644d8a06abcc7f7db0e98ee22
- Narrow Themes screenshot /home/dave/.t3/userdata/browser-artifacts/browser-screenshot-127-0-0-1-munxoakt-67c5ce00.png: 9241c32ff28c38a5f01333967eece422ce4428242f538c457a1673ab1508510c
- Final wide screenshot /home/dave/.t3/userdata/browser-artifacts/browser-screenshot-127-0-0-1-munxpluz-6b12231b.png: 34a2b1d4f272824857dcdb7336ad10b54238ba0febf1b663bd05cd6a4125a206

The first two new screenshots precede only the footer-text update; the final wide screenshot includes it and was inspected. Source bindings describe the current held candidate. Root may release the hold. Only /tmp/popup-directions-review.md was written; no commits, staging, project/index/spec/skill edits, shared services, browser mutations or provider access. Questions skipped: assignment prohibits owner questions.

---

The original review below is retained as history; its FIX disposition and source bindings apply only to the superseded initial candidate.

# Popup direction preview finish review

Disposition: FIX (preview scope only). All three directions are suitable for owner comparison after the small contrast corrections below. This is not production approval, fidelity approval against a selected comp, extension acceptance, or feature closeout. Done means submission of this independent report only.

## Scope and method

Reviewed held sources on docs/popup-design-direction at base/HEAD 59e16964978f25d1fe01b96ae631e6155637a690. Read the project development-system router/package, methodology and selected engineering verification guidance, PRODUCT.md, incumbent DESIGN.md, the preview HTML/CSS/JS, Impeccable Operate and craft-floor guidance, and three supplied screenshots. Applied design-review techniques at proposal scope; did not invoke the full Impeccable critique command/lifecycle. No selected visual world or comp exists for this held candidate. Existing DESIGN.md remains incumbent authority for production and was not changed.

The assignment limits this reviewer to Node/read-only checks, supplied images, and one /tmp report. Therefore no launcher/context/detector/browser/server/network execution, delegation, owner questions, project persistence, or production workflow was performed. Root's existing detector and browser observations are supplemental reported evidence, not independently rerun checks. Context was read directly from existing project files. Questions skipped: assignment prohibits owner questions; owner selection belongs to root.

## Material findings

1. P2 — Slate's small unread counters narrowly fail the craft-floor text contrast minimum. In preview.css, .count uses #4070ad on account-heading #eaf0f8: 4.426:1 against the required 4.5:1. These are 11px text, so the large-text exception does not apply. Darken the count foreground or its surface enough to clear 4.5:1 with margin. The accent as a focus ring clears 3:1; this finding concerns count text.

2. P2 — Signal's subtitle needs a safer secondary-text contrast pairing. Muted #596169 against the nominal header #d7dadd is 4.481:1. The toolbar overrides that header with a #dce0e3-to-#cbd0d4 gradient, so actual subtitle contrast depends on the background under each glyph. The darker gradient area reduces contrast further. Supplied screenshots/source cannot establish every glyph's composited background; this is a bounded gradient/text risk rather than a claim that every Signal subtitle glyph fails. A slightly darker muted token (verified against the darkest toolbar stop and each other use) removes the risk without changing the direction. Main Signal text and muted text on mail panels pass.

No other material blocker was found for showing the synthetic alternatives to the owner. These two changes concern text mechanics and do not prescribe a preferred theme.

## What works

- Account ownership is structural: each account header immediately precedes only its own messages. Separate account surfaces, clear full addresses, provider badges, unread counters, and sender/subject weight make scanning predictable. The 2/1/1 sample distribution uses the same content across all three themes, supporting a fair comparison.
- Mail stays focused on mail. Settings replaces the message area with Accounts, Notifications and Sound; back navigation is explicit. Read/unread and Trash remain visible beside Open on collapsed messages. Native buttons, checkboxes, and range input preserve familiar interaction, and action names are supplied through visible text or aria-label/title.
- The alternatives satisfy the less-white brief without turning the tool into a showcase. Midnight uses comfortable dark blue-grey layers and teal state signals; Slate offers a gentler transition with tinted frame/header and light mail panels; Signal's silver layers and amber counters make unread state more prominent. The same hierarchy and spacing keep interaction constant while the palette changes. Normal-case system typography and authored SVG icons fit Operate mode.
- Depth is restrained: one offset soft shadow on each popup, separated account sections, no decorative movement, no intrusive modal. Tight message groups and larger account separation preserve hierarchy. The desktop comparison places all three alongside one another; the narrow capture stacks them and retains visible account controls.
- Synthetic scope is explicit in the page header and footer. Sources contain no fetch/provider calls, and account actions report simulation. The previews give useful demonstrations without claiming mailbox writes have been implemented.

## Source contrast evidence

WCAG relative-luminance calculation, independent Node script, exit 0. Rounded ratios:

| Theme | Main text/panel | Muted/panel | Muted/nominal header | Count/heading | Trash/panel |
| --- | ---: | ---: | ---: | ---: | ---: |
| Midnight | 11.354 | 7.088 | 6.122 | 6.497 | 7.356 |
| Slate | 11.438 | 5.090 | 4.636 | 4.426 | 6.022 |
| Signal | 11.817 | 5.117 | 4.481 | 8.308* | 5.615 |

*Signal count uses #ffcf73 on #3c352b, not the accent/header pairing. Gradient compositing, native checkbox/range rendering and antialiasing were not independently browser sampled.

## Evidence and limits

Fresh reviewer checks:
- node --check docs/design/popup-directions/preview.js — exit 0; no output.
- git diff --check — exit 0; no output. The preview files are untracked, so this command does not independently validate their whitespace; it verifies tracked diff only.
- Node SHA-256 plus source contrast script — exit 0; hashes below and ratios above.
- git status --short; git rev-parse HEAD; git branch --show-current — exit 0. Observed untracked .impeccable/questions/, PRODUCT.md and docs/design/; no tracked changes. Branch and HEAD match the assignment.
- Supplied initial desktop mail, desktop Settings, and narrow Settings screenshots inspected using view_image. Desktop captures are visibly reduced/soft; the narrow capture gives clearer control/type evidence. Root states initial mail source equivalence and has a fresh final mail capture; reviewer did not inspect that extra capture.

Root-reported browser evidence: three accounts and 2/1/1 messages per direction; no horizontal overflow at desktop/narrow 320; Settings contains zero mail cards and three sections; Settings-return focus preserved; read toggles, trash removal and Undo restoration, 25% volume feedback; native Enter/Space focus checks. These observations corroborate source structure, but are not this reviewer's executed browser acceptance.

Bounded caveats for later implementation: actual provider writes/auth/permissions, pending/error recovery, real-account Chrome acceptance, long/localized mail, scaling/zoom and assistive-technology testing remain outside this preview review. The preview's simple one-message Undo and full rerender focus behavior are demonstrations, not an approved recovery contract. Do not infer a settled provider-write design from this report. Reported 3px browser focus and source 2px focus should be reconciled if that computed value is reused as durable source-bound evidence.

State observation: .dev/project.md describes popup-usability as active, while .dev/work.yaml marks it done with PR #11. This unrelated saved-state wording discrepancy was not corrected; root owns canonical state. No new feature state or competing lifecycle was created here.

## SHA-256 bindings

- PRODUCT.md: 8425287ec9d6a95d1d11d52a2a362d6e317a4c2ad65f35684da1b1fcb82d4681
- docs/design/popup-directions/index.html: b3f37775ac6bbbbf969235c86121c5a6bab8da95e17b8cdc66a218a8aa048892
- docs/design/popup-directions/preview.css: c1b22c3ac882fbbca4c118c77b8e625731ccd4bdc7a060f7a44b81ac9b663ebd
- docs/design/popup-directions/preview.js: 5e0aba5049abe8d3c29401e0314b4cbd504f1b182fcd8ade33527ca8f64a155c
- /home/dave/.t3/userdata/browser-artifacts/browser-screenshot-127-0-0-1-munx566f-bbc08704.png: 0cde65b878b0eb066f64e5fde5f212305cb06a376b7866a79accb6f82ecaba15
- /home/dave/.t3/userdata/browser-artifacts/browser-screenshot-127-0-0-1-munx6myn-a909a96d.png: 3bb217622a4acda143fed84d4e28c5755a6cb9866e17012a6fbd5a8f48affd59
- /home/dave/.t3/userdata/browser-artifacts/browser-screenshot-127-0-0-1-munx7dys-85265cbd.png: 6d3a12ce1ddd2dcb1c4dc0141e28ea1d28055a064adab835438df41c03d83e2a

Only /tmp/popup-directions-review.md was written. No project/index/spec/skill edits, no commits, no staging, no provider access, no services started, no browser mutations, and no delegated work. This verdict binds the held candidate above, before root's proposed theme-selector additions or token corrections.
