# Focused popup usability — owner acceptance passed

Candidate: `95650aaddc38d0d79fcb707b29c8143e38636f50`, PR #11.
Result: **passed**, owner reported “all passed” on 2026-09-30 after following
the affected-path checklist. All owner-ticked results below are preserved.
Browser/version was not restated for this run; the earlier recorded environment
was Helium 0.18.1.1 / Chromium 154.0.8037.57 on Arch Linux x86_64.
Synthetic verification is separate in docs/ui-usability/README.md.

Reload the extension and reopen its popup with existing accounts. Use Tab,
Shift+Tab, Enter, Space and arrow keys for the affected paths.

- [x] Popup fits its normal scrolling window without sideways scrolling or
      clipped controls; account identities wrap and Sound is subordinate to Inbox.
- [x] Account/Refresh actions and sound controls look consistent and show a
      visible keyboard focus ring; pending actions cannot be activated twice.
- [x] Enter/Space on message summary expands cached text and locally marks
      read, keeps focus and opens no tab. Next Tab reaches independent Open;
      Enter/Space opens the correct Gmail/Outlook message/account.
- [x] Add Gmail/Outlook focuses email; Cancel and successful Add return focus
      to the launcher. Existing account sign-in/out/remove remain functional.
- [x] Per-account chime retains focus after toggling; volume percentage updates
      during arrow-key adjustment; mute/volume persist and still affect sound.
- [x] Refresh/cache updates preserve focus on surviving preview/Open/account
      controls. Signed-out/offline state remains readable and recoverable.
- [x] No popup console errors; no provider API requests from the popup.

Record only results, not addresses, real mail, URLs or tokens. These ticks do
not claim a new full auth/notification test unrelated to the affected paths.
