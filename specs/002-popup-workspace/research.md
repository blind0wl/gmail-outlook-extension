# First-stage research

Repository inspected at 59e1696; no production source changed during planning.

- Current popup is one ES-module IIFE, with distinct account/mail/status/sound
  renderers and stable focus recovery added in PR #11. Build on those paths;
  replacing the stack would add risk without serving the approved design.
- Source already has Add/Sign in/Sign out/Remove, focused-provider alert pause,
  master mute, volume and per-account chime. Synthetic preview's desktop/badge
  checkboxes are illustrative and are not new first-stage requirements.
- `accounts` order is persisted. Section key uses provider plus normalized account;
  grouping by provider alone would mix same-provider accounts and fail the brief.
- Existing preview and Open each mark locally read. Owner explicitly approved
  display-only preview; leave Open's current side effect for compatibility until
  provider actions replace local state. Do not mislabel this as a server write.
- Theme presets reuse the corrected prototype palette. Slate counter #3a649b on
  #eaf0f8 gives 5.270:1; Signal muted #50585f on darkest toolbar #cbd0d4 gives
  4.656:1. These proposal ratios do not substitute for built-state contrast checks.
- Global stored preference belongs in chrome.storage.local, not prototype
  localStorage. Native radio selection, root tokens and no DOM replacement keep
  keyboard focus and account drafts stable.
- Existing extension identity and Outlook link routing must remain unchanged.
  `npm run verify` is the integrated command; owner real-account acceptance remains
  required under .dev/verification.yaml v2. No missing source/build prerequisite.

No first-stage OAuth research is required. Later Google API/client compatibility
and permissions are separately recorded in
../../docs/design/popup-directions/mailbox-readiness.md (repository root reference:
docs/design/popup-directions/mailbox-readiness.md).
