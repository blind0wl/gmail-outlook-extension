# Design

- Toolbar: grey outline envelope (`#c5c7c9`) on a transparent background.
- Use `src/icons/toolbar.svg` as the source for the 16 px and 32 px toolbar PNGs.
- Envelope: 24-unit viewBox, 3-unit stroke (2 px at 16 px toolbar size), rounded rectangle corners.
- Keep the toolbar glyph free of a background tile or border.
- Notification and extension listing artwork retain `src/notify/icon.png`.
- Toolbar unread counts retain their existing badge treatment.
- Popup colors and typography use the existing theme tokens in `src/popup/themes.js`.
- Reuse the popup's existing spacing and icon-button styles.
