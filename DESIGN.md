---
name: Gmail plus Outlook
description: Compact account-owned mail workspace with three remembered themes
colors:
  midnight-bg: "#15232f"
  midnight-panel: "#223443"
  midnight-header: "#293e50"
  midnight-text: "#ecf2f8"
  midnight-muted: "#b1c3d4"
  midnight-line: "#3d5163"
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
  slate-line: "#dbe4ef"
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
  signal-line: "#c2c9cf"
  signal-hover: "#d9dee1"
  signal-accent: "#765014"
  signal-danger: "#a33132"
  signal-tag: "#f2dfb4"
  signal-control: "#d9dee1"
  signal-on-accent: "#ffffff"
typography:
  title:
    fontFamily: "system-ui, sans-serif"
    fontSize: "20px"
    fontWeight: 650
    lineHeight: 1.3
  section-title:
    fontFamily: "system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 650
    lineHeight: 1.5
  account-title:
    fontFamily: "system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.4
  subject:
    fontFamily: "system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: 1.5
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.5
  control:
    fontFamily: "system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 600
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
rounded:
  badge: "4px"
  control: "6px"
  panel: "12px"
  pill: "999px"
spacing:
  tight: "4px"
  controls: "6px"
  group: "8px"
  stack: "12px"
  panel-inset: "14px"
  toolbar-inset: "16px"
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
    backgroundColor: "{colors.midnight-tag}"
    textColor: "{colors.midnight-text}"
    rounded: "{rounded.badge}"
    padding: "2px 6px"
  account-panel:
    backgroundColor: "{colors.midnight-panel}"
    textColor: "{colors.midnight-text}"
    rounded: "{rounded.panel}"
  mail-row:
    backgroundColor: "transparent"
    textColor: "{colors.midnight-text}"
    padding: "12px 14px 10px 20px"
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
`src/popup/popup.css`, `popup.html`, `popup.js` and `themes.js`. It replaces the
former white A v5 world. Historical screenshots and reproduction provenance stay
in `docs/ui-baseline/`; they are historical evidence, not current tokens.
Current synthetic verification is in `docs/ui-workspace/`; real-account owner
acceptance of this candidate remains pending.

**Key Characteristics:**

- Three complete palettes with Midnight as the remembered-preference fallback.
- Flat mail rows inside separate account panels.
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

- **Title** (20px, 650, line-height 1.3): Inbox and Settings toolbar heading.
- **Section title** (14px, 650, line-height 1.5): Settings section headings.
- **Account title** (14px, 600, line-height 1.4): full account address, wrapping anywhere.
- **Subject** (14px, 600, line-height 1.5): unread subject; read subjects use 400.
- **Body** (13px, 400, line-height 1.5): snippets, help and expanded cached text.
- **Control** (13px, 600, line-height 1.5): buttons and filters.
- **Metadata** (11px, 400, line-height 1.5): timestamps and theme default label.
- **Badge** (11px, 600, line-height 1.5): provider labels and account counts.

Sender names are 13px semibold for unread mail and regular for read mail.
Counts, times and volume values use tabular numerals. The unread toolbar count
uses muted 13px regular text alongside the title.

**The Plain Label Rule.** Use normal-case system UI text; do not inherit uppercase, widely tracked comparison-board lettering.

## Layout

The popup is one column (404px maximum width) with a fixed-height flex shell
(`600px`). The intrinsic height must not depend on the initial viewport;
automatically sized extension hosts can start at zero height. The toolbar stays outside the independently scrolling Mail
or Settings viewport. View insets are 12px horizontally and 16px at the bottom;
the toolbar uses a 16px inset. Panels stack with 12px gaps. Account headers and
mail rows use a 14px horizontal inset; rows reserve 20px on the left for the
unread dot. Settings panels use a 14px inset.

Account identity wraps; sender, subject and snippet collapse with a one-line
ellipsis until preview text is expanded. Buttons and account actions wrap.
Mail rows keep static headings above a snippet toggle and Open sharing one explicit actions row.
Account headers show a visible per-account checked time from the worker-persisted
stamp; failed or paused accounts show no stamp. Counts report provider unread mail
with an opened-here suffix when mail was opened locally. A muted mail note states
the same. A visible Preview cue labels the toggle and names its collapse state;
the opened area shows the cached body text only, since sender and subject stay
visible as headings.
The volume control is a label/range/value grid with an 8px gap and a 4ch value
column. Toolbar tools wrap at 340px; at 240px the title occupies its own row.
Back to mail remains a single-line label. Native thin scrollbars use theme colors.

The popup has Mail and Settings views. Settings leads with Accounts, then
Themes, Notifications and Sound sections. Back restores the Mail scroll position;
storage updates retain surviving focus and account drafts. Detailed surface
composition remains in `.impeccable/surfaces/src-popup-popup-html.md`.

## Elevation & Depth

There are no shadows. Tonal separation between background, panel and account
header provides depth; thin dividers separate neighboring mail rows. Signal's
silver toolbar has the authored vertical gradient from `#dce0e3` to `#cbd0d4`.
That material belongs to Signal; it is not a global ban on gradients.
All state changes are immediate, with no entrance, ambient or theme-transition
animation.

**The Flat Row Rule.** Give each account one enclosing panel; separate its messages with dividers rather than independent raised cards.

## Shapes

Account and Settings panels have gently curved corners (12px), clipped to their
surface. Buttons and email fields use tighter corners (6px); provider badges and
theme swatches use 4px. Provider filters are pills (999px). Unread indicators are
small circles (5px). Ordinary control strokes and row dividers are one pixel.
Toolbar icon buttons are square (34px) with 18px authored stroke SVGs.

## Components

### Buttons

Compact native actions use theme control/text colors, a muted one-pixel border,
6px corners, 6px by 10px padding and a 32px minimum height. Hover changes the
surface; active changes the border to accent. Disabled actions use muted text
and the default cursor. Add account uses accent/on-accent; Open is a transparent
accent action with 4px by 8px padding. Selected filters and Add account preserve
their contrasting foreground on hover.

### Chips

Provider badges use tag/text colors with 2px by 6px padding. Counts have a
transparent background and accent text. Filter pills use muted text at rest and
accent/on-accent when selected, expressed with `aria-pressed`.

### Cards / Containers

Each full-address account header owns its messages, including same-provider
accounts. Empty and paused accounts keep their panels and identity. Flat rows
have static sender/time and subject headings above a snippet toggle with a sibling
Open button on one flex line. Subjects use the theme accent color so they stand
apart from the muted preview text; unread subjects and senders are semibold while
read mail uses regular weight. Only the snippet area is the preview toggle: a native
summary button with `aria-expanded` and `aria-controls` whose accessible name carries
subject, sender, time and unread state, with a visible Preview cue naming its
collapse state for sighted users. The opened area shows the cached body text only,
wrapping with preserved line breaks. Preview is display-only. Refresh announces Checking then a checked time, or names
accounts needing attention on partial success; progress, success and error states
use distinct lifecycle styling. Error notes keep numeric codes beside actionable
guidance (automatic retry, Refresh, account-specific sign-in); add-account
failures name the failing step. Each account row carries its own lifecycle hint.
Open retains the extension-local read flag and the exact provider message link,
labelled as opened-here with provider unchanged.
Stage 1 has no mailbox read/unread, Trash or Undo buttons.

### Inputs / Fields

Email fields use control/text colors with an 8px inset, muted border, accent
caret and muted opaque placeholder. Native checkbox/radio inputs are 16px;
labels provide at least 32px rows (theme choices 36px). Range controls remain
native and use the accent color. Errors use danger text with alert/status roles.

### Navigation

Refresh and Settings use authored inline SVGs with current-color strokes
(1.7px), rounded ends and joins. The Back to mail control pairs a matching SVG
with visible text. Every button, input, summary and link has an accent keyboard
outline (2px) with a 2px offset. Forced colors replace outlines with Highlight,
add CanvasText panel borders and preserve the unread dot; theme swatches retain
their preview colors.

## Do's and Don'ts

### Do:

- **Do** apply the active theme to every surface and interaction color.
- **Do** preserve full account identity, native keyboard controls and visible focus.
- **Do** render external mail as text and keep expanded preview display-only.
- **Do** use synthetic account addresses and message content in design examples.

### Don't:

- **Don't** combine messages from different accounts into one account panel.
- **Don't** introduce uppercase tracked labels, glyph toolbar icons or ambient motion.
- **Don't** add later-stage mailbox write controls to the Stage 1 component set.
- **Don't** treat synthetic screenshots as real-account acceptance.
