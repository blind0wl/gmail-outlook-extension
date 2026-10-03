# Polish v2 prototype

Side-by-side review of the current popup and a proposed polish, using the real
popup runtime with synthetic mail. Nothing in `src/` is changed.

Run `python3 -m http.server 8767 --bind 127.0.0.1` at the worktree root and open
`http://127.0.0.1:8767/docs/design/polish-v2/`.

- `popup/` is a working copy of `src/popup/` (HTML, CSS, JS) with the proposal applied.
  Its imports point back at `src/store` and `src/notify`.
- `frame.html` + `frame.js` are the synthetic Chrome boundary. `?v=current` loads
  `src/popup/` untouched; `?v=proposed` loads `popup/`.
- `index.html` shows both side by side. View, theme, sample state and Settings
  section apply to both.

## What the proposal changes

Markup/JS (structural, needs test updates if adopted): explainer note moved below
the list; unread counts are numeric pills; empty accounts read "All caught up.";
card time moves into the sender row and the footer row is removed; actions float
over the time on hover/focus; Settings account rows get an avatar, status dot, a
single relevant Sign in / Sign out action and an icon Remove; chime rows show the
address with the provider beneath; Mail checking gets preset chips that fill the
fields (Save stays explicit).

CSS only: segmented provider filter, themed switches, three-tile theme picker,
softer read cards, slim status bar, bottom fade on scroll areas.

Not adopted yet. DESIGN.md and tests are untouched until approval.
