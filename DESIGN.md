---
name: Gmail plus Outlook
description: Existing compact popup for personal mailbox triage
colors:
  ink: "#111111"
  surface: "#ffffff"
  secondary-text: "#5f6368"
  account-text: "#202124"
  border: "#dadce0"
  avatar-surface: "#e8eaed"
  form-surface: "#f8f9fa"
  unread-focus: "#1a73e8"
  outlook: "#0f6cbd"
  error: "#8b1b1b"
typography:
  body:
    fontFamily: "system-ui, sans-serif"
    fontSize: "13px"
    fontWeight: 400
  inbox-title:
    fontFamily: "system-ui, sans-serif"
    fontSize: "18px"
    fontWeight: 700
  subject:
    fontFamily: "system-ui, sans-serif"
    fontSize: "14px"
    fontWeight: 600
  control:
    fontSize: "13px"
    fontWeight: 600
  metadata:
    fontSize: "12px"
  provider-badge:
    fontSize: "11px"
    fontWeight: 700
rounded:
  badge: "4px"
  input: "6px"
  card: "8px"
  pill: "999px"
spacing:
  group: "8px"
  inset: "12px"
  section: "16px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.pill}"
    padding: "4px 12px"
  provider-filter:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  mail-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "8px 10px"
---

## Overview

This is a factual baseline of the existing A v5 popup, captured on 2026-09-30
using Impeccable's extraction guidance. The established direction is clean,
minimal, and task-focused: account identity, unread state, and fast triage lead.
It is not a redesign or a claim that every control meets a finished quality bar.

Source authority is `src/popup/popup.css`, HTML, and rendered output.
Product scope remains in the v1 design spec. Synthetic screenshots and
reproduction instructions are in `docs/ui-baseline/`.

## Colors

Ink on white anchors the interface. Secondary gray carries snippets and times;
the lighter border separates cards. Blue marks unread state and card focus,
while the Outlook badge uses its own blue outline. Errors use dark red. The
Gmail badge and active filter use ink with white text.

## Typography

System fonts keep the popup native and compact. The explicitly styled mail
hierarchy ranges from the inbox title through subject, snippet/control, account/
time, and provider badge. Read subjects drop to normal weight.

Account instructions, sound labels and buttons use the 13px system-font body.
Sound and form headings use 14px semibold, subordinate to the 18px Inbox title.
The focused usability refinement replaces the historical 24px Sound heading
and browser-default account buttons with the existing compact control language.

## Layout

The popup is a single vertical column, normally 404px wide and capped to the
available viewport. Border-box sizing includes the insets; it shrinks without
horizontal overflow when a vertical scrollbar or narrow viewport is present.
Cards stack with a group gap. Each has account/provider at top left, time at
top right, then an avatar beside subject, snippet, and a separate Open action.

Collapsed subjects and snippets use one-line ellipsis; expansion wraps cached
text. Account addresses wrap rather than disappear. There are no media queries.
Historical full-content captures use a 404 × 1200 viewport; actual extension
popups scroll. Current controls and identities wrap within the available width.
Account names sit above wrapping action groups. Sound controls use full-width
rows, and volume uses a compact label/range/percentage grid.

## Elevation & Depth

The system is flat: no shadows, gradients, or animation. Borders identify cards
and inputs; a pale surface identifies the add-account form. There is no authored
motion grammar.

## Shapes

Cards and status rows share softly rounded corners. Inputs are slightly tighter,
badges tighter again, and filters/actions are pills. Avatars are circles with a
32px diameter. Boundaries generally use one-pixel borders.

## Components

- **Filters:** All, Gmail, Outlook; selected state uses ink on white inversion
  and `aria-pressed`. No authored hover transition.
- **Mail cards:** provider/account, timestamp, avatar, subject, snippet, unread
  dot, Open button, and cached preview. A native summary button previews/marks locally read with
  Enter/Space; Open is a sibling native action. All controls use a two-pixel
  blue keyboard outline with a two-pixel offset. Surviving controls retain
  focus across storage updates, and form dismissal returns to its launcher.
- **Account status:** address and sanitized error/retry state; sign-in recovery
  uses the primary pill. Disabled recovery uses gray on white.
- **Add-account form:** labelled email input, provider-specific help, alert
  error, and submit/cancel actions. No user client-ID input.
- **Account actions and sound:** native buttons, checkboxes, and range control.
  Their buttons share the existing pill shape and 32px minimum height. Labels
  provide generous checkbox hit areas; native checkbox/range behavior remains.

## Do's and Don'ts

- Preserve full account identity, unread/read distinction, and cached-only
  preview behavior when extending the current UI.
- Use these captured values to explain existing behavior; make any redesign
  direction explicit before replacing them.
- Render external mail as text and retain visible keyboard focus.
- Do not treat synthetic screenshot coverage as real-account acceptance or a
  completed accessibility audit.

## Focused usability refinement

Approved 2026-09-30. Preserve the flat palette, content, account identity,
filter/read state and action order. Shared hover, active, disabled and keyboard
focus treatments apply to existing controls. No animation or replacement visual
world is introduced. Native scrollbars remain usable. See
`specs/001-popup-usability/` for scope and current verification; historical
baseline captures remain in `docs/ui-baseline/`.
