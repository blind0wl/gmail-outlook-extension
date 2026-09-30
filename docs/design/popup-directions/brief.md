# Confirmed popup direction

Owner-approved layout and visual choices, 2026-09-30:

The owner reviewed the updated interactive preview and approved it ("looks good"). This confirms the layout and three-theme visual direction for implementation; it is not acceptance of production behavior.

- Mail occupies the main popup. Stack one account header and its messages, then the next account and its messages. Keep the full address and provider visible.
- Settings opens a separate view. Adding accounts, sign in/out, removal, notifications and sound do not appear among mail cards.
- Use normal-case system UI typography. The comparison board's uppercase spaced labels are not part of the popup.
- Ship Midnight desk, Slate workspace and Signal panel as user-selectable themes under Settings > Themes. Midnight desk is the default for new installations; remember the user's choice.
- Show read/unread and Trash icons directly on each mail card, alongside Open. Requested mailbox actions update the real provider; Delete moves to Trash/Deleted Items.

Design previews remain synthetic and simulate these actions. Production work requires the provider-write/authentication specification, permissions and synchronization design. No provider-write transport or authentication migration is selected by this design brief. Trash Undo is owner-approved; production recovery semantics need specification.

The owner subsequently approved layout/themes first, then Gmail authorization,
then real mailbox actions. Each card acts on one message, preview expansion does
not mark it read, and Trash offers Undo. See capabilities.md for module boundaries.
