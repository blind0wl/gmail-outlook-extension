# Feature Specification: Focused popup usability

**Feature Branch**: `fix/popup-usability`
**Created**: 2026-09-30
**Status**: Approved scope; owner agreed to the proposed focused pass in chat.
**Input**: Consistent controls/typography, narrow scrolling, keyboard focus and
accessible control states using Impeccable within the established design.

## User Scenarios & Testing

### User Story 1 — Read and open mail with the keyboard (P1)

A user tabs to a cached message, previews it, and separately opens its mailbox.
Acceptance: preview and Open have distinct accessible controls; Enter/Space
preview preserves focus and marks locally read without navigating. Open still
selects the account/message using the existing provider link. Cache updates
preserve focus on a surviving message control.

### User Story 2 — Manage accounts and sound (P1)

A user connects an account, cancels the form, or changes account/sound settings.
Acceptance: actions wrap consistently; Cancel/success returns focus to its
launcher; a chime toggle retains focus after settings updates; volume shows
its current percentage while adjusted. Existing worker/storage actions remain.

### User Story 3 — Scan a compact popup (P2)

A user scans mail and settings in a narrow, scrolling popup.
Acceptance: no horizontal overflow at 320, 380, 404 and 480px widths with
vertical scrolling and long addresses/text; settings headings remain smaller
than Inbox; controls share the current font and visible focus/state treatment.

### Edge Cases

Empty cache, signed-out/error accounts, long unbroken addresses and snippets,
account removal, storage changes while focused, disabled pending actions,
zoom/reflow, expanded cached text and native scrollbars.

## Requirements

- **FR-001**: Preserve the established flat palette, provider identity, read
  state, content and action order; refine the current surface.
- **FR-002**: All popup controls must have consistent type, usable hit areas
  (at least 24px; buttons target 32px) and visible keyboard focus/states.
- **FR-003**: Message preview and provider Open must be independent native
  keyboard controls with meaningful names and expansion state.
- **FR-004**: Surviving account/sound/message controls must keep focus across
  their refresh; closing the account form returns focus to its launcher.
- **FR-005**: Account actions, sound rows, forms and full cached text must
  wrap within the popup; mail may scroll vertically without clipping controls.
- **FR-006**: Volume feedback must update during keyboard/pointer adjustment;
  persistence retains the current storage contract.
- **FR-007**: Popup remains cache-only; provider links, authentication,
  polling, notifications, storage schema and extension identity are unchanged.

## Success Criteria

- **SC-001**: A keyboard user completes preview/Open, Add/Cancel and sound
  adjustment without focus dropping on surviving controls.
- **SC-002**: All representative synthetic states fit the specified narrow
  widths without horizontal scrolling; live owner popup acceptance is required.
- **SC-003**: Full automated suite and independent spec/quality review pass;
  real-account popup checks remain pending until the owner reports them.

## Assumptions and boundaries

Personal mailbox triage, Operate mode. DESIGN.md/code are incumbent visual
authority. No new settings, collapse workflow, search, dark mode, animation,
provider behavior or Gmail stale-link repair. No framework/dependency changes.
