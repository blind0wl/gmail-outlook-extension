# Task 4: Feature-gated CSS fallbacks and theme focus

**Status: DONE**

## Implementation

- `applyTheme()` now mirrors each radio's checked state onto its enclosing
  `.theme-choice[data-selected]`. The existing selected border, background and
  inset accent indication work without `:has()`.
- Derived color tokens and the theme-swatch mixed border now have solid base
  values, with `color-mix()` values only inside
  `@supports (color: color-mix(in srgb, black, white))`.
- `.account-inbox` has an independent grid rule. The modern no-link heading
  grid is guarded by `@supports selector(:has(*))`; the fallback heading grid
  and `:focus-within` theme outline are guarded by its negative branch. The
  fallback linked grid spans its wrapper tracks so linked headings retain a
  usable row width.
- Native theme radios and their keyboard behavior remain in place.

## TDD and automated verification

**RED** — before production edits:

```text
PATH=/tmp/node-v24.21.0-linux-x64/bin:$PATH node --test tests/popup-ui.test.js
```

Result: 72 passed, 1 failed. The new load/change/external-storage assertions
failed as expected because the unchecked Midnight label had no `data-selected`
attribute (`null !== 'false'`).

**GREEN** — after implementation:

```text
PATH=/tmp/node-v24.21.0-linux-x64/bin:$PATH node --test tests/popup-ui.test.js
```

Result: 73 passed, 0 failed.

**Full verification**:

```text
PATH=/tmp/node-v24.21.0-linux-x64/bin:$PATH npm run verify
```

Result, exit 0: syntax checks passed for 58 JavaScript files; extension
identity check passed; 327 tests passed, 0 failed.

## Browser comparison

Used T3 preview tab `tab_2` at
`http://127.0.0.1:8767/docs/ui-workspace/`, with the production popup fixture,
each `?theme=` value, and a matched 480×800 viewport. Compared the six fresh
baseline captures (`before-{theme}-{view}-480.png`) with the six candidate
captures (`after-{theme}-{view}-480.png`) for Midnight, Slate and Signal in
Mail and Settings. The established layout and theme colors remain visually
consistent. Fixture message times advanced between captures, and pointer hover
landed on Back to mail in the Settings captures; these incidental differences
were not treated as UI changes.

In current Chrome, `CSS.supports()` was true for both `selector(:has(*))` and
the color-mix query. Modern linked account headings remained a block wrapper
containing one 438×48.5px grid link. The selected radio, `data-selected="true"`,
accent border/background/shadow, and mixed swatch border computed correctly.

For the fallback pass, fetched the production stylesheet into a temporary
fixture style element, changed positive feature queries to false queries and
negative `:has()` queries to true queries, then inserted one synthetic unlinked
heading. The browser remained modern Chrome; this exercises fallback rules but
does not establish support in an older Chromium build.

The first forced-fallback render exposed the nested-grid issue: the linked row
was 171px wide with its unread count at x=157, while the wrapper was 438px.
After adding `grid-column: 1 / -1` to `.account-inbox` in the negative branch,
the link filled the wrapper's available content width (426px) and the count
moved to x=412. The unlinked synthetic heading remained a 438px grid with its
count at x=422. The link remains inset by the fallback wrapper's own padding;
the nearly full-width link and all heading content stay legible and usable.

With the fallback stylesheet active, all three themes produced valid computed
token, selected-state, swatch-border and form-line colors. The selected tile
mirrored its checked radio in every theme. Clicking Signal and pressing
ArrowLeft selected Slate through the native radio group; the focused radio had
opacity 0 and its label showed the fallback solid 2px accent outline at a 2px
offset. The T3 preview reported no console entries during the inspected states.

## Files and evidence

- Source and regression: `src/popup/popup.css`, `src/popup/popup.js`,
  `tests/popup-ui.test.js`.
- Candidate captures: `docs/ui-review-fixes/after-*.png`.
- Fallback captures: `docs/ui-review-fixes/fallback-before-grid-span-signal-480.png`,
  `docs/ui-review-fixes/fallback-slate-mail-480.png`, and
  `docs/ui-review-fixes/fallback-slate-settings-focus-480.png`.
- The controller's fresh baseline files remain separate and were not included
  in this task commit. Task 7 owns the dated acceptance record and any final
  acceptance statement.

## Self-review

The positive `:has()` branches do not apply to linked headings, and the
unsupported selector is no longer in a comma-separated rule with the inbox
link. Fallback presentation and radio state were checked in the browser as
well as in DOM tests. No unrelated design or documentation artifacts were
changed. Real-account behavior and an actual older Chromium engine were outside
this synthetic CSS compatibility check.
