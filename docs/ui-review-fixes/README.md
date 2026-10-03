# Review fixes synthetic browser evidence

Candidate source commit: `19763e94ca35cf18125724c163494ec0ae877474`.
Browser: T3 preview, Chrome `152.0.7977.130` (Electron `44.4.2`) on Linux.
The fixture loads production popup HTML, CSS and JavaScript with fake Chrome
storage/runtime APIs and `example.test` accounts. It makes no provider requests.

## 480px comparison and CSS fallback

`before-{midnight,slate,signal}-{mail,settings}-480.png` are the fresh
pre-edit captures. `baseline-metrics.json` records the 480px computed colors
and element bounds. The six `after-*-480.png` captures are the Task 4 modern
comparison; the popup source in that capture is unchanged between `eee30b4`
and this candidate. The clock-dependent message times advanced between passes;
that incidental difference is not a layout or color change.

`fallback-slate-mail-480.png` and `fallback-slate-settings-focus-480.png` show
the forced fallback branches in modern Chrome. The linked account row fills
426px of its 438px heading; an unlinked heading remains 438px. Theme colors,
selection and focus were valid across Midnight, Slate and Signal. Signal then
ArrowLeft selected Slate; the visually hidden radio retained keyboard focus
and its label had a solid 2px outline at a 2px offset. The stylesheet's
positive and negative support queries were temporarily inverted for this
pass. This does not establish behavior in an older Chromium engine.
`fallback-before-grid-span-signal-480.png` is the diagnostic capture before
the linked-row width correction, retained to document why the fallback rule
spans its wrapper.

## Remaining candidate checks

- At 320×800, all four full `example.test` addresses and header counts fit;
  document and body widths were both 320px. The header unread label was
  `4 unread`. Each Remove button's title matched its accessible label and
  retained `aria-describedby="account-remove-note"`.
- Preset selection filled five minutes without saving or sending a worker
  message. A synthetic storage refill to 60 seconds preserved the dirty draft.
  Manual duration and unit edits cleared every preset highlight. For Save, the
  fixture's worker handler was wrapped to return the production contract and
  update synthetic storage: `300` seconds normalized to `5` minutes, the
  five-minute preset was selected, and success feedback appeared. The fixture
  recorded only `set-poll-interval`; no provider URL appeared in resource
  entries. This does not exercise the real worker.
- Keyboard selection from Signal with ArrowLeft selected Slate and mirrored
  `checked` to `data-selected`; the focused label had a visible 2px outline.
- T3 reported `(hover: none) = false`. The hover-none screenshot injects the
  same declarations as the production `@media (hover: none)` rule; computed
  card actions were visible in normal flow, card time was visible, and there
  was no horizontal overflow. This is a forced synthetic branch, not touch
  device acceptance.
- The CSS zoom capture emulates 200% by using a 202×300 CSS root/body at
  `zoom: 2` inside a 404×600 viewport. Settings scrolls, Back and Save remain
  reachable, and there is no horizontal overflow. DOM values remained `1`
  minute. This is layout evidence, not browser chrome zoom acceptance.

New captures are `synthetic-320-midnight-mail.png`,
`synthetic-320-midnight-settings.png`,
`synthetic-320-midnight-settings-save.png`,
`synthetic-320-forced-hover-none-mail.png`, and
`synthetic-css-zoom-2-settings-404x600.png`.

## Mechanical detector

The single final command was
`impeccable detect --json src/popup/popup.css src/popup/popup.js src/popup/poll-presets.js src/popup/poll-settings-form.js`.
Its JSON output is `mechanical-detector.json` (13 findings: 1 warning and 12
advisories; the CLI returned 2 with findings). The side-tab warning is a false
positive: it identifies the miniature theme swatch's 2px accent stripe, not a
mail-card border. The `#000` color advisory is the mask gradient's opaque
mask color, not a rendered palette color. The remaining 11 advisories expose
existing CSS/design-token documentation mismatches (20px title versus the
documented 22px, and radii outside the documented scale); they do not indicate
a new visual change in this candidate and were left untouched to preserve the
approved popup design.
