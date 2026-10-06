---
name: Gmail plus Outlook
description: Compact account-owned mail workspace with three remembered themes
colors:
  midnight-bg: "#15232f"
  midnight-panel: "#253948"
  midnight-header: "#293e50"
  midnight-text: "#ecf2f8"
  midnight-muted: "#b1c3d4"
  midnight-line: "#3a4d5e"
  midnight-hover: "#2f4659"
  midnight-accent: "#8ed3cc"
  midnight-danger: "#ffb0ad"
  midnight-tag: "#344d62"
  midnight-control: "#2c4356"
  midnight-on-accent: "#15232f"
  slate-bg: "#dce4ef"
  slate-panel: "#f8faff"
  slate-header: "#eaf0f8"
  slate-text: "#26384e"
  slate-muted: "#53677f"
  slate-line: "#ced9e7"
  slate-hover: "#eaf0f8"
  slate-accent: "#3a649b"
  slate-danger: "#a43d48"
  slate-tag: "#dee8f6"
  slate-control: "#eef3fa"
  slate-on-accent: "#ffffff"
  signal-bg: "#c8cdd1"
  signal-panel: "#e6e8e9"
  signal-header: "#d7dadd"
  signal-text: "#242a2e"
  signal-muted: "#50585f"
  signal-line: "#bbc3c9"
  signal-hover: "#d9dee1"
  signal-accent: "#765014"
  signal-danger: "#a33132"
  signal-tag: "#f2dfb4"
  signal-control: "#d9dee1"
  signal-on-accent: "#ffffff"
typography:
  title:
    fontFamily: "system-ui, sans-serif"
    fontSize: "22px"
    fontWeight: 650
    lineHeight: 1.3
  section-title:
    fontFamily: "system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.5
  account-title:
    fontFamily: "system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 650
    lineHeight: 1.4
  subject:
    fontFamily: "system-ui, sans-serif"
    fontSize: "15px"
    fontWeight: 650
    lineHeight: 1.4
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
  metadata:
    fontFamily: "system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: 1.5
  badge:
    fontFamily: "system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: 1.5
  sender:
    fontFamily: "system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.5
  help:
    fontFamily: "system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.5
  form-heading:
    fontFamily: "system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 650
    lineHeight: 1.5
rounded:
  badge: "4px"
  control: "6px"
  panel: "12px"
  pill: "999px"
  theme-swatch: "5px"
  swatch-inset: "2px"
spacing:
  tight: "4px"
  controls: "6px"
  group: "8px"
  stack: "12px"
  panel-inset: "16px"
  narrow-panel-inset: "14px"
  toolbar-inset: "20px"
  account-gap: "24px"
components:
  button:
    backgroundColor: "{colors.midnight-control}"
    textColor: "{colors.midnight-text}"
    typography: "{typography.control}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
  button-primary:
    backgroundColor: "{colors.midnight-accent}"
    textColor: "{colors.midnight-on-accent}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
  button-open:
    backgroundColor: "transparent"
    textColor: "{colors.midnight-accent}"
    rounded: "{rounded.control}"
    padding: "4px 8px"
  provider-filter:
    backgroundColor: "{colors.midnight-accent}"
    textColor: "{colors.midnight-on-accent}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  provider-badge:
    backgroundColor: "transparent"
    textColor: "{colors.midnight-muted}"
    rounded: "{rounded.badge}"
    padding: "0"
  account-panel:
    backgroundColor: "transparent"
    textColor: "{colors.midnight-text}"
    rounded: "{rounded.control}"
  mail-row:
    backgroundColor: "{colors.midnight-panel}"
    textColor: "{colors.midnight-text}"
    rounded: "{rounded.panel}"
    padding: "14px 16px 8px 18px"
  email-input:
    backgroundColor: "{colors.midnight-control}"
    textColor: "{colors.midnight-text}"
    rounded: "{rounded.control}"
    padding: "8px"
  toolbar-icon:
    backgroundColor: "transparent"
    textColor: "{colors.midnight-text}"
    rounded: "{rounded.control}"
    padding: "6px"
    size: "34px"
---

# Design System: Gmail plus Outlook

## Overview

**Creative North Star: "Midnight desk"**

The approved world is a compact, calm desk for checking personal mail. Blue-grey
surfaces and a pale teal accent make Midnight the default; Slate workspace and
Signal panel apply the same component grammar through their own palettes.
Normal-case native typography and crisp authored icons keep the interface direct.

This is the implementation record extracted on 2026-09-30 from
`src/popup/popup.css`, `popup.html`, `popup.js` and `themes.js`; `src/popup/` is
the production visual authority. It replaces the former white A v5 world.
Historical screenshots and reproduction provenance stay in `docs/ui-baseline/`;
they are historical evidence, not current tokens. Current synthetic verification
is in `docs/ui-workspace/`. The 2026-10-03 visual-polish candidate is recorded in
`docs/acceptance/2026-10-03-visual-polish.md`; fresh real-account acceptance for
that candidate remains pending.

**Key Characteristics:**

- Three complete palettes with Midnight as the remembered-preference fallback.
- Separate rounded mail cards below slim, full-address account headings.
- Normal-case system typography and authored SVG toolbar icons.
- Immediate state changes without ambient or theme-transition motion.

## Colors

The frontmatter records each production custom property with a theme prefix.
The suffix maps directly to its CSS variable: `midnight-bg` is the default `--bg`;
Slate and Signal replace all twelve roles together. Component frontmatter records
Midnight defaults; runtime CSS variables select the corresponding active palette.

### Primary

Midnight's pale teal, Slate's desk blue and Signal's dark amber share the accent
role: selected filters, Open actions, unread dots, counts, links, focus outlines,
native checked controls, text selection and email carets. The on-accent role
supplies the contrasting foreground of selected filters and Add account.

### Neutral

Background surrounds panels and scrollbars; panel is the mail/settings body;
header identifies account ownership; text is the primary foreground. Muted text
carries timestamps, snippets, help, placeholders, control borders and scrollbar
thumbs. Line separates neighboring rows. Control supplies native action/input
surfaces, hover responds to pointers, and tag supports provider identity.
Slate's corrected muted foreground is the `slate-muted` frontmatter token.

Danger is the explicit error/status foreground in every theme. Theme swatches
sample each approved direction; they are previews, not additional reusable roles.

**The Complete Palette Rule.** Switch every semantic role together, including native color scheme, selection, focus, caret and scrollbar colors.

## Typography

**UI Font:** system-ui with sans-serif fallback. There is no display face.
The native stack serves compact interface text, not decorative headings.
All labels remain normal case with ordinary tracking.

### Hierarchy

- **Title** (22px, 650, line-height 1.3): Inbox and Settings toolbar heading.
- **Section title** (15px, 650, line-height 1.5): Settings section headings.
- **Account title** (13px, 650, line-height 1.4): full account address, wrapping anywhere.
- **Subject** (15px, 650, line-height 1.4): unread subject; read subjects use 400.
- **Body** (13px, 400, line-height 1.5): snippets, help and expanded cached text.
- **Control** (13px, 500, line-height 1.5): buttons and filters.
- **Metadata** (11px, 400, line-height 1.5): timestamps and theme default label.
- **Badge** (11px, 600, line-height 1.5): provider labels and account counts.

Sender names are muted 12px medium for unread mail and regular for read mail.
Help text is 12px regular. Subjects use the primary text color and two-line clamp.
Counts, times and volume values use tabular numerals. The unread toolbar count
uses muted 13px regular text alongside the title.

**The Plain Label Rule.** Use normal-case system UI text; do not inherit uppercase, widely tracked comparison-board lettering.

## Layout

The popup is one column (680px maximum width) with a content-sized flex shell
capped at `600px`. Short mail lists and caught-up accounts shrink the popup;
longer content grows to the cap and then scrolls. The intrinsic height must not depend on the initial viewport;
automatically sized extension hosts can start at zero height. The toolbar stays outside the independently scrolling Mail
or Settings viewport. View insets are 16px horizontally and 20px at the bottom;
the toolbar uses 20px horizontal insets (16px at narrow widths). Account groups
have 24px gaps; cards have 8px gaps. Slim, transparent account headings place
full-address identity above provider, checked time and count. Settings panels
use 16px padding (14px at narrow widths).

Sender names retain a single-line ellipsis; subjects wrap to two lines. Cached
plain text is immediately visible with a three-line clamp. The existing cached
preview expansion remains unchanged by this visual pass: click or Enter/Space
expands it, and Escape collapses. This existing behavior differs from the older
No preview expansion requirement in specs/003; removal is not part of this pass.
Message cards use panel surfaces, one-pixel line borders and 12px corners.
A flow-based footer holds muted regular timestamps and 32px Open/read/Trash
buttons. Buttons are siblings of the preview control, so keyboard activation
does not expand the preview. Hover/focus reveals actions; non-hover devices
expose them continuously. Errors follow the footer without overlap.
The volume control is a label/range/value grid with an 8px gap and a 4ch value
column. Toolbar tools wrap at 340px; at 240px the title occupies its own row.
Back to mail remains a single-line label. Native thin scrollbars use theme colors.

The popup has Mail and Settings views. Settings leads with Accounts, then
Themes, Notifications, Sound and Mail checking sections. Back restores the Mail scroll position;
storage updates retain surviving focus and account drafts. Detailed surface
composition remains in `.impeccable/surfaces/src-popup-popup-html.md`.

## Elevation & Depth

There are no shadows. Tonal separation between background, panel and account
header provides depth; thin dividers separate neighboring mail rows. Signal's toolbar uses its background role; the earlier gradient is superseded
by the owner-approved polish.
All state changes are immediate, with no entrance, ambient or theme-transition
animation.

**Account ownership.** Keep one heading per account and separate rounded messages beneath it; never combine accounts into a shared mailbox group.

## Shapes

Account and Settings panels have gently curved corners (12px), clipped to their
surface. Buttons and email fields use tighter corners (6px); provider badges use 4px;
miniature theme previews use 5px with 2px inset shapes. Provider filters are pills (999px). Unread indicators are
small circles (4px). Ordinary control strokes and row dividers are one pixel.
Toolbar icon buttons are square (34px) with 18px authored stroke SVGs.

## Components

### Buttons

Compact native actions use theme control/text colors, a line-color one-pixel border,
6px corners, 6px by 10px padding and a 32px minimum height. Hover changes the
surface; active changes the border to accent. Disabled actions use muted text
and the default cursor. Add account uses accent/on-accent; Open is a transparent
accent action with 4px by 8px padding. Selected filters and Add account preserve
their contrasting foreground on hover.

### Chips

Provider labels use muted text on transparent backgrounds without inset padding. Counts have a
transparent background and accent text. Filter pills use muted text at rest and
accent/on-accent when selected, expressed with `aria-pressed`.

### Cards / Containers

Each full-address account header owns its messages, including same-provider
accounts. Empty and paused accounts retain identity. Sender and subject are
500- and 650-weight respectively for unread mail and 400 while marking read;
subjects use primary text, while sender and preview use muted text. An unread dot preserves the state distinction. Cached previews never imply a full-message reader that has not been implemented.

Hover/focus actions use authored 16px stroke SVGs on 32px buttons, currentColor
and theme danger for Trash. Gmail labels explicitly name conversation actions;
Outlook labels name individual-message actions. Pending buttons stay focusable
with aria-disabled and resist duplicate clicks; errors display safe recovery text.
Completed Trash has no visible Undo control. Worker restore records survive
popup close for ten minutes; only unconfirmed recovery is presented.
Uncertain responses present “I’ve checked” after the user inspects their mailbox.
Open retains its existing provider link and opened-here behavior. Real-account
acceptance is pending; Gmail’s private session interface can change independently.

### Inputs / Fields

Email fields use control/text colors with an 8px inset, muted border, accent
caret and muted opaque placeholder. Native checkbox/radio inputs are 16px;
labels provide at least 32px rows (theme choices 36px). Range controls remain
native and use the accent color. Errors use danger text with alert/status roles.

### Navigation

Refresh and Settings use authored inline SVGs with current-color strokes
(1.7px), rounded ends and joins. The Back to mail control pairs a matching SVG
with visible text. Every button, input, summary, preview control and link has an accent keyboard
outline (2px) with a 2px offset. Forced colors replace outlines with Highlight,
add CanvasText panel borders and preserve the unread dot; theme swatches retain
their preview colors.

## Do's and Don'ts

### Do:

- **Do** apply the active theme to every surface and interaction color.
- **Do** preserve full account identity, native keyboard controls and visible focus.
- **Do** render external mail as text and clamp previews to three lines.
- **Do** use synthetic account addresses and message content in design examples.

### Don't:

- **Don't** combine messages from different accounts into one account panel.
- **Don't** introduce uppercase tracked labels, glyph toolbar icons or ambient motion.
- **Don't** permanently delete mail or imply full-message reading inside the extension.
- **Don't** treat synthetic screenshots as real-account acceptance.


Mailbox feedback: Trash hides the card on click. Mark-read removes heading
emphasis immediately, keeps the card while pending, then clears it after
confirmation. Failures restore the authoritative cached state. Provider-read mail
is omitted, and later unread replies can reappear after reconciliation.
Unconfirmed recovery appears before the mail list; uncertainty copy names the
explicit “I’ve checked” step and explains that other mail remains usable.
Unconfirmed actions use one row per account with a count and one acknowledgement
button, including a busy state. Completed Trash reports “Moved to Trash.”.
Confirmed Gmail read feedback includes guidance to refresh a stale open Gmail page.


## Historical compact Undo tray — 2026-10-01 (superseded 2026-10-02)

Undo sits immediately below the toolbar, outside the scrolling Mail surface.
The native disclosure can collapse; its open list has a fixed 112px viewport
with independent themed scrolling. Newest deletion leads; individual buttons
retain subject/account accessibility labels. Existing panel, line, text and
control tokens apply across Midnight, Slate and Signal. Recovery locks remain
in Mail. Synthetic 480px and 320px checks passed; real extension acceptance is
pending in docs/acceptance/2026-10-01-compact-undo-stack.md.

## Popup UX candidate — 2026-10-02

Whole account headers are native links, including empty/paused/error accounts.
They retain 12px/14px padding, all visible metadata, semantic headings and wrapped
addresses. Hover highlights the whole header with the theme hover token and a 2px inset
accent outline, without moving the heading or underlining its address; keyboard
focus uses the accent inset outline. Account-key focus survives mailbox renders.
Account routing is a compatibility candidate awaiting real-account acceptance.

Mail checking follows Sound at the bottom of Settings. Native duration input, unit select
and Save share an 8px-gap grid; input and select use control/text/muted tokens,
6px corners and 8px padding. Numeric values use tabular numerals and accent
carets. Errors use danger and role=alert; application status uses role=status.
Pending Save prevents duplicate submissions. The retained form preserves drafts
and focus across unrelated renders. Synthetic checks cover all three themes at
320px/480px and 200% CSS zoom; they do not establish real-account acceptance.
The old compact Undo tray section above is retained as a historical record only.

## Owner-approved visual polish — 2026-10-03

Implemented in `src/popup/` (visual polish, 2026-10-03): stronger subjects,
quieter sender/time metadata, wrapping transparent account headings, softer
card/button lines, compact Settings account actions and miniature theme previews.
All three themes, Settings order and mailbox action semantics remain. Removal
guidance is shared below Accounts; account-local reconnection guidance remains
visible when needed.
This record supersedes older visual measurements above where they conflict.
Fresh real-account acceptance remains pending in
`docs/acceptance/2026-10-03-visual-polish.md`.

## Owner-approved polish v2 — 2026-10-03

Implemented in `src/popup/` (polish v2, 2026-10-03). Supersedes the card footer,
account-heading, Settings account-row and control details above. The owner
acceptance record is `docs/acceptance/2026-10-03-polish-v2.md`.

- Cards: sender and time share one row. Hover/focus actions float over the time
  (absolute, 28px buttons); no footer row on pointer devices. With `hover: none`
  the actions stay visible in flow. Read cards use a transparent surface and a
  softer line. The unread dot is 7px.
- Account headings: address and a numeric unread pill (`aria-label` "N unread")
  share a row; provider and "Checked" time sit beneath. Zero shows an outlined
  pill. Empty checked accounts read "All caught up." Whole-heading link and
  hover highlight stay; the hover outline is replaced by the hover token fill.
- Toolbar: the unread total is a pill. Provider filters sit in one segmented
  track. The counts explainer is a footnote below the list.
- Settings: account rows have an avatar, status dot, one primary action (Sign out
  when connected, Sign in when paused or needing sign-in) and an icon Remove with
  the same accessible name. Themes are three tiles over native radios. Checkboxes
  render as switches (native input, forced-colors falls back to native). Chime
  rows show the address with the provider beneath. Mail checking adds preset
  chips that only fill the fields; Save remains explicit.
- Status bar: hairline top border, muted 12px text. Mail and Settings fade at
  the bottom edge. Derived tokens use `color-mix` over the existing twelve roles.

Synthetic checks only; real-account acceptance is pending.

2026-10-03 count refinement: account and toolbar counts have a 22px minimum
width and 22px height, with centred text and line-height 1. Single digits are
circular; larger counts widen into pills without clipping. Account counts align
to the end of their grid cell rather than stretching.
