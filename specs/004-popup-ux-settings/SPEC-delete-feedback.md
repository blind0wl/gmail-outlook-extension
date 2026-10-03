# Spec: Remove deletion Undo feedback

**Module ID**: `delete-feedback`
**Created**: 2026-10-02
**Status**: Owner-approved specification, 2026-10-02; ready for technical planning.
**Engineering contract**: [spec.md](spec.md#shared-engineering-contract).

## Objective

Allow users to delete mail without a visible Undo tray or toast. All other
deletion behavior stays as it is now.

## Requirements and success criteria

1. Clicking Trash sends the same scoped worker action and immediately hides
   the same message/conversation card. No Undo tray, summary, countdown,
   restore button or replacement Undo toast appears.
2. Successful deletion retains concise success feedback, such as “Moved to
   Trash.”, without suggesting Undo is available in the extension.
3. Confirmed journal entries from earlier deletions do not reveal Undo when the
   popup opens, storage changes, themes change, or Settings returns to Mail.
4. Preserve Gmail conversation-wide Trash, Outlook message moves, provider
   confirmation, pending/duplicate protections, cache/badge updates, and
   existing no-notification behavior for manual operations.
5. Preserve error feedback, failed-action card restoration, uncertain-action
   locks and account-scoped “I’ve checked” recovery. Removing the tray must
   not remove recovery just because both currently share `renderUndo()`.
6. Preserve worker action records, expiry/cleanup and the existing Undo command.
   Do not change provider mutation or storage semantics as incidental cleanup.
7. Preserve all themes, scrolling, settings and unrelated read/message controls.
   Mail uses the space previously occupied by the tray when it was visible.

## Testing strategy

- Synthetic popup tests: successful and failed Trash, journal updates while
  open, reopen with old Undo records, rapid deletions, Settings transitions,
  and uncertain recovery alongside completed Trash records.
- Existing worker/provider tests continue to prove unchanged mutation semantics.
- Fresh real-account Chrome acceptance: Gmail Trash moves the same conversation;
  Outlook Trash moves the same message; no extension Undo UI appears; webmail
  still contains the deleted mail in its recoverable folder.
- Run the shared verification commands. Acceptance stays pending until performed.

## Boundaries and open questions

Shared commands, structure, style and boundaries apply. This changes presentation
only. The owner approved removing the entire visible Undo tray, including old
entries, while keeping the journal. No open questions.
