# Owner acceptance — popup workspace (pending)

Implementation and synthetic verification are ready for owner testing. This is
an unchecked template, not a passed acceptance result. Use the final candidate
commit shown in the PR handoff, and record any subsequent revision explicitly.

- Date tested:
- Candidate commit:
- Browser and version:
- OS:
- Result: pending

- [ ] Individual account sections (two Gmail accounts; Outlook) and filters.
- [ ] Settings-only configuration; Back restores Mail scroll/focus.
- [ ] Preview expands without changing unread state; Open retains exact links.
- [ ] Midnight/Slate/Signal themes; arrow keys, saved selection on reopen/reload.
- [ ] Accounts add/cancel/sign in/out/remove, pending actions and newer drafts.
- [ ] Notifications and sound preferences/automatic behavior; silent Refresh.
- [ ] Keyboard focus, long text, constrained layout and actual 200% browser zoom.
- [ ] No unexpected Console errors or popup provider requests.

Run the full affected-path procedure in tests/popup-checklist.md. On completion,
copy the filled result to a new dated docs/acceptance/ record. Do not include
real addresses, message URLs, mail content or credentials.
