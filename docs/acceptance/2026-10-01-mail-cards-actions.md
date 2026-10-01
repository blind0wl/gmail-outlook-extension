# Mail cards and mailbox actions — 2026-10-01

Candidate: feature/mail-cards-actions (commit recorded in handoff).
Result: automated/synthetic checks passed; real-account acceptance **pending**.
No historical acceptance ticks are reused.

- Node 24.21.0, npm ci, npm run verify; final test count in verification record.
- T3 synthetic browser: 480px Midnight/Slate; 320px Signal with long account and
  unbroken preview text. Three-line clamp measures 58.5px at 19.5px line height;
  no document horizontal overflow. Sender/subject remain 600-weight for all mail.
- Action icons have opacity 0 at rest, opacity 1 on keyboard focus, 34px targets.
  Native Enter triggers synthetic Trash then Undo; card count 4 → 3 → 4 and
  runtime messages identify the cached key/action. No real provider writes.
- Tests cover slot/account verification, pre-POST sign-out checks, provider
  denial/ambiguous responses, duplicate requests, returned Outlook move IDs,
  expired records, removal races and late-journal-read sign-out races.
- Impeccable detector: one advisory for pre-existing Signal swatch #b4b8bc;
  unrelated to card changes. No suppressions added.
- Independent code review completed; reported race/privacy fixes addressed.

## Real-account procedure (unchecked)

- [ ] Reload extension and approve its cookies permission if prompted.
- [ ] Two Gmail accounts signed into the same browser profile: verify each action
  uses the correct account after changing login order.
- [ ] Gmail conversation mark-read changes Gmail state. Gmail conversation Trash
  moves the whole conversation, never permanently deletes.
- [ ] Gmail Undo restores unread AND read conversations, including conversations
  beyond the Atom feed's bounded results. Private session/legacy Undo endpoints
  are unverified compatibility candidates, not a guaranteed supported API.
- [ ] Sign out/sign in Outlook in Settings to consent to Mail.ReadWrite, then
  verify read, Trash and Undo with returned move IDs and original folder.
- [ ] Close/reopen popup and restart worker during Undo availability (ten minutes).
- [ ] Offline, permission denial and unknown response produce honest recovery.
  Check mailbox before selecting “I’ve checked”; it releases the action lock.
- [ ] Confirm manual actions never produce new-mail toast/chime; badge/cache
  update only after confirmation, with per-account isolation.
- [ ] Verify actual hover, keyboard, constrained popup, zoom, Settings and themes.

Browser/version, OS, tested commit and owner result: pending.
