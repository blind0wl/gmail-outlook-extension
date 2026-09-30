# Focused popup usability — owner acceptance pending

Candidate: fix/popup-usability; implementation commit to be supplied with PR.
Result: **not run** in the owner's extension. Synthetic evidence is separate
in docs/ui-usability/README.md. Record actual commit/browser/results on report.

Reload the extension and reopen its popup with existing accounts. Use Tab,
Shift+Tab, Enter, Space and arrow keys for the affected paths.

- [ ] Popup fits its normal scrolling window without sideways scrolling or
      clipped controls; account identities wrap and Sound is subordinate to Inbox.
- [ ] Account/Refresh actions and sound controls look consistent and show a
      visible keyboard focus ring; pending actions cannot be activated twice.
- [ ] Enter/Space on message summary expands cached text and locally marks
      read, keeps focus and opens no tab. Next Tab reaches independent Open;
      Enter/Space opens the correct Gmail/Outlook message/account.
- [ ] Add Gmail/Outlook focuses email; Cancel and successful Add return focus
      to the launcher. Existing account sign-in/out/remove remain functional.
- [ ] Per-account chime retains focus after toggling; volume percentage updates
      during arrow-key adjustment; mute/volume persist and still affect sound.
- [ ] Refresh/cache updates preserve focus on surviving preview/Open/account
      controls. Signed-out/offline state remains readable and recoverable.
- [ ] No popup console errors; no provider API requests from the popup.

Record only results, not addresses, real mail, URLs or tokens. These ticks do
not claim a new full auth/notification test unrelated to the affected paths.
