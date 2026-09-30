# Verification recipe

Setup: Node >=24; `npm ci`. Integrated checks: `npm run verify`.
Existing setup and load-unpacked instructions: ../../README.md.

During implementation, extend meaningful DOM/Chrome-substitute tests for:

1. Two Gmail accounts plus Outlook group as 2/1/1 under their own addresses.
2. Settings hides mail; Back and account recovery preserve intended focus/scroll.
3. Preview changes no read state/request; Open routing remains account-specific.
4. Theme defaults/validation/saving, reopen/reload, rapid selection and storage error.
5. Existing account actions and focused-provider pause/sound still use real contracts.
6. Storage updates preserve focus and unsent form input; removed focus has fallback.

Native T3 synthetic fixture: three themes, empty/error/stale accounts and long
text; 320, 380, 404 and 480px, 200% zoom, native keyboard activation and radio arrows.
Check contrast, overflow, focus, pending/error feedback and all Settings sections.

Owner real-account acceptance: load the verified implementation, check both Gmail
accounts and Outlook separately, exact Open links, preview-only behavior, all
Settings account controls, notifications/chime/mute/volume and each persisted theme.
Record exact tested revision/browser in a new dated acceptance note. Review the
implementation-specific checklist when ready; prior preview or PR #11 acceptance
is not proof of this build. No provider Trash/read/unread acceptance in stage one.
