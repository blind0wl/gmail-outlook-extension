# Zero-area preview toggle fix — owner acceptance passed

Candidate: `c8cfd7e` ("fix: give preview toggle and Open an explicit actions row"),
PR #14 branch `polish/popup-critique-fixes`.
Result: **passed**, owner reported "PASSES" on 2026-09-30 after reloading the
unpacked extension and clicking through the affected paths in the real popup.
Browser/version was not restated for this run; the earlier recorded environment
was Helium 0.18.1.1 / Chromium 154.0.8037.57 on Arch Linux x86_64.
Synthetic verification is separate in docs/ui-workspace/README.md.

Affected paths (the reported bug: clicking an email did nothing, nor did Open):

- [x] Clicking the snippet row expands the display-only preview; sender and
      subject stay static and intentionally do not respond to clicks.
- [x] Open launches the correct provider message for the right account and
      marks the message opened-here without changing the provider mailbox.

Record only results, not addresses, real mail, URLs or tokens. These ticks do
not claim a new full auth/notification test unrelated to the affected paths.
