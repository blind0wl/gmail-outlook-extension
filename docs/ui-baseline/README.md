# Popup visual baseline

These captures document the existing popup with synthetic data. They are
references for future design work, not approved redesigns or real-account
Chrome acceptance. No real email addresses, messages, or credentials are used.

## Reproduce

Serve the repository root locally:

```sh
python3 -m http.server 8765 --bind 127.0.0.1
```

Open `http://127.0.0.1:8765/tests/visual/popup.html?state=populated` in the
collaborative browser. Use a 404 × 1200 CSS-pixel viewport; the 380px body plus
24px horizontal padding matches the popup's minimum outer width. Wait until
`document.documentElement.dataset.fixtureReady` matches the requested state.

The fixture imports the production HTML, CSS, and popup JavaScript. Its
in-memory Chrome substitutes never contact providers, write extension storage,
or open provider tabs. Captures use the browser's current system font and
native form controls, so those may differ across operating systems. Captured
2026-09-30 with T3's Linux Chromium 152 collaborative browser, against popup
source from commit `1b94326` (the subsequent baseline commit changes docs/tools
only). The tall viewport records full content; it does not simulate Chrome's
popup-height constraint. No horizontal overflow appeared in the full captures.

| State | Query | Capture |
| --- | --- | --- |
| Empty | `?state=empty` | [empty.png](empty.png) |
| Populated | `?state=populated` | [populated.png](populated.png) |
| Expanded cached preview | `?state=expanded` | [expanded.png](expanded.png) |
| Outlook signed out | `?state=signed-out` | [signed-out.png](signed-out.png) |
| Offline Gmail / throttled Outlook | `?state=error` | [error.png](error.png) |

## Known design debt

The inbox uses consistent cards and pills, while account actions and sound
settings retain native controls and larger default body text. Heading/body
hierarchy is weak in those sections. The list-item button role wraps a nested
Open button; screen-reader behavior still needs live accessibility review.
There is no responsive breakpoint, dark theme, custom motion, or reusable CSS
token layer. At the minimum width, shorter viewports with non-overlay vertical
scrollbars can introduce horizontal overflow. Preserve this baseline until a
design change is approved.
