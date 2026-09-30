# Data model

Existing persisted shapes are unchanged: `accounts`, `mailCache`, `accountState`,
`skipFocusedProvider` and `soundSettings`. No credentials, message IDs or read flags
are migrated in popup-workspace.

New key: `popupTheme`, string in {midnight, slate, signal}; default midnight.
Load treats missing/invalid values as default. Save accepts only a known ID and
surfaces storage errors. Concurrent selections serialize writes to retain the
latest user choice. This preference remains local to the browser profile.

Transient state: view {mail, settings}, Mail scroll position/provider filter,
expanded message keys, focus identity {accountKey, messageKey, action}, pending
existing account operations, form provider/input/error and theme-save feedback.
Theme changes do not reset these fields; popup reopen starts Mail with saved theme.

Derived section: configured account identity/provider/status, newest-first matching
cached messages and existing cache-based unread count. Unconfigured orphan cache
items are excluded from sections; worker cache data is not silently rewritten.
