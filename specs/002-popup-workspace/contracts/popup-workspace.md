# Popup workspace boundaries

- Popup consumes local storage snapshots and onChanged; no provider fetch or OAuth.
- Existing runtime requests remain refresh, add-account, sign-in, sign-out and
  remove-account. Existing Open retains its mark-read request and threadUrl routing.
  Preview expansion sends no mark-read or other mailbox request.
- Account normalization/keying stays aligned with src/store/accounts.js. Requests
  carry the stored provider/account, and unchanged worker validation remains final.
- Theme helper exposes known IDs/default, validated load and serialized save;
  DOM interaction remains in popup.js. Preference errors reach visible status,
  without raw storage/provider exception text. Theme IDs never become arbitrary CSS.
- Mail and Settings use native named navigation controls. Hidden view is removed
  from keyboard/accessibility navigation. Forms and surviving focus identity persist.
- Account recovery in Mail navigates to the matching Settings control; it does not
  start sign-in automatically. Ordinary Settings opens at its first useful control;
  Back returns to the Settings launcher in Mail with the saved scroll position.
- Theme labels, visible selected state and accessible names always agree. Native
  radio controls support arrows and retain focus across styling changes.
- Future read/unread, Trash and Undo commands are not defined or exposed here.
