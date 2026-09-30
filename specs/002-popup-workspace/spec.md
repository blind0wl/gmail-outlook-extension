# Feature Specification: Popup workspace

**Feature Branch**: `docs/popup-design-direction` (specification preparation)
**Created**: 2026-09-30
**Status**: Approved by the owner in conversation, 2026-09-30; ready for technical planning.
**Module ID**: `popup-workspace`
**Input**: Separate account sections, dedicated Settings and three approved themes;
ship this stage before Gmail authorization and provider-backed message actions.

## User Scenarios & Testing

### User Story 1 — See each account separately (Priority: P1)

A user opens the popup and sees one account's identity and messages together,
followed by the next account. Accounts using the same provider remain distinct.

**Why this priority**: Account ownership must be obvious before opening mail.
**Independent Test**: Configure two Gmail accounts and one Outlook account with
synthetic messages; identify each account and open the correct message.

**Acceptance Scenarios**:

1. **Given** three configured accounts, **When** Mail opens, **Then** each account
   has its own section, provider, full address, unread count and only its messages.
2. **Given** configured account order and differently dated messages, **When** mail
   refreshes, **Then** account order remains stable and each account's messages are
   newest first. Existing provider filters restrict sections, not mix messages.
3. **Given** an empty, disabled, signed-out, stale or failed account, **When** Mail
   opens, **Then** that account remains identifiable, with its appropriate state
   and no invented success or messages belonging to another account.
4. **Given** a message, **When** its preview expands, **Then** cached text is shown
   without marking it read locally or in the provider. **When** Open is selected,
   **Then** the existing account-specific provider link opens independently.
5. **Given** an account requiring sign-in, **When** recovery is selected from its
   Mail section, **Then** Settings shows the matching account's sign-in control.
   Account management itself remains in Settings.

### User Story 2 — Manage configuration in Settings (Priority: P1)

A user opens Settings to manage accounts, notifications and sound, then returns
to Mail without losing their place.

**Why this priority**: Mail should not be interrupted by configuration controls.
**Independent Test**: Complete existing account/sound workflows entirely in
Settings and return to the same Mail position using pointer and keyboard.

**Acceptance Scenarios**:

1. **Given** Mail, **When** Settings opens, **Then** message cards are hidden and
   Themes, Accounts, Notifications and Sound appear in that order.
2. **Given** Settings, **When** the user adds, signs into, signs out of or removes
   an account, **Then** existing real worker operations and recovery states apply;
   the relevant controls show pending/success/failure and prevent duplicate work.
3. **Given** Settings, **When** the existing focused-provider alert preference, master
   mute, volume or per-account chime changes, **Then** existing behavior and saved
   preferences continue to work. No new notification preference is introduced.
4. **Given** a scrolled Mail view, **When** Settings opens and Back returns,
   **Then** Mail returns to its saved position and focus returns to Settings.
5. **Given** a surviving focused control or open add-account form, **When** cache,
   account or sound storage updates, **Then** focus and unsent form input survive.
   Cancel or successful add returns focus to the form launcher.

### User Story 3 — Choose a comfortable appearance (Priority: P2)

A user selects Midnight desk, Slate workspace or Signal panel from Settings.

**Why this priority**: The owner approved all three appearances as choices.
**Independent Test**: Switch each theme, close/reopen the popup and reload the
extension; confirm selection and readable controls in both views.

**Acceptance Scenarios**:

1. **Given** a new installation or an existing installation without a valid theme
   preference, **When** the popup opens, **Then** Midnight desk is selected.
2. **Given** Settings → Themes, **When** a different theme is selected, **Then**
   it applies immediately to both Mail and Settings without losing focus, form
   input or navigation state, and is retained after reopen and extension reload.
3. **Given** an invalid saved value, **When** preferences load, **Then** Midnight
   desk is used safely; only known theme names are accepted.
4. **Given** a preference write failure, **When** a theme is selected, **Then** the
   popup stays usable and reports that the preference could not be saved.

### Edge Cases

No accounts; accounts without mail; disabled/removed accounts while Settings is
open; multiple same-provider accounts; long unbroken addresses, subjects and
snippets; missing metadata; partial/stale cache; provider filter with no matching
accounts; keyboard navigation; zoom and native scrollbars; rapid theme changes;
failed preference storage; storage changes while a form or control is focused.

## Requirements

### Functional Requirements

- **FR-001**: Mail MUST group messages by provider plus normalized account address,
  in configured account order; messages within a section MUST be newest first.
- **FR-002**: Each configured account MUST show its full wrapping address,
  provider, section unread count and applicable status/empty state. Read display
  and count semantics remain those of the existing cache for this stage.
- **FR-003**: Mail MUST contain message preview/Open, provider filters, refresh
  and Settings navigation. Account connection/removal, notification and sound
  controls MUST be in Settings. Account recovery in Mail navigates to Settings.
- **FR-004**: Settings MUST preserve every existing account, notification and sound
  capability and its persisted values; sample-only preview options MUST NOT ship.
- **FR-005**: Preview MUST display cached text without changing read state. Open
  MUST keep existing account-specific routing and remain a separate control.
- **FR-006**: Themes MUST offer the three approved named appearances, apply to all
  popup states, and persist a validated choice with Midnight desk as fallback.
- **FR-007**: Native keyboard controls MUST have meaningful names, visible focus,
  selected/expanded/pending state and error feedback. Surviving controls and form
  input MUST remain stable through refresh, view changes and theme changes.
- **FR-008**: All themes MUST use normal-case system UI typography, readable
  contrast (4.5:1 small text, 3:1 large text and relevant control boundaries),
  at least 24px targets with buttons targeting 32px, and fit 320–480px widths
  without horizontal scrolling. Cached expansion wraps long text.
- **FR-009**: Account, cache, sound and notification data MUST be preserved on
  upgrade. This stage MUST NOT introduce provider-write buttons, new consent,
  permanent deletion, or simulated production actions.
- **FR-010**: The popup MUST remain cache-only, render external mail as text and
  preserve extension identity, provider polling/authentication and local privacy.

### Key Entities

- **Account section**: configured account identity, status, provider and its mail.
- **Message**: existing cached identity, sender, subject, snippet, date, unread/
  legacy local-read display and provider link. No identity migration in this stage.
- **Theme preference**: one of the three names, shared by the two popup views.
- **View state**: active Mail/Settings view, Mail position, focused control and
  account form input; view/form state is transient rather than account data.

## Success Criteria

### Measurable Outcomes

- **SC-001**: With two Gmail accounts and one Outlook account, every displayed
  message belongs to exactly one matching section; Open targets the same account
  and message as before; preview alone changes no read state.
- **SC-002**: All existing account, notification and sound workflows work from
  Settings using pointer and keyboard; Mail shows no configuration controls.
- **SC-003**: All three themes survive popup reopen and extension reload, with
  Midnight desk used for missing/invalid preferences and visible save-failure feedback.
- **SC-004**: Empty/error/long-content states fit 320, 380, 404 and 480px widths
  and 200% zoom without horizontal scrolling; keyboard focus and contrast meet
  FR-007/FR-008 in each theme.
- **SC-005**: Applicable automated checks, fresh independent specification/code
  review and owner real-account Chromium acceptance pass before merge. Preview
  approval and old acceptance do not satisfy the new implementation's gates.

## Assumptions

Approved visual authority is docs/design/popup-directions/brief.md and its
interactive samples, with contrast corrections recorded in review.md. Existing
DESIGN.md describes the incumbent build until extraction from the new build.

This is module one of the approved capability map. Provider-backed read/unread,
Trash and Undo are committed follow-up scope, not delivered here. Preview-only
behavior applies here because the owner explicitly confirmed it. Old local-read
flags are retained for compatibility until the mailbox migration specifies their
retirement; this stage does not create new local-read flags.

Use existing provider filters and configured account order; no new account
reordering, collapse workflow, font dependency, animation or notification option.
No framework/backend change or permission expansion. The queued Gmail stale-Open
assessment remains separate. Only requested message mutation in later stages
changes the read-only v1 principles, through an explicit approved amendment.
