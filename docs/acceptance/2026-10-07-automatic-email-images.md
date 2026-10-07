# Automatic email images — 2026-10-07

Candidate: branch `load-email-images`. The owner requested removal of the Load
images button and automatic image loading when reading a complete email.

Credential-free HTTPS images now load automatically in the expanded HTML reader.
The toolbar and per-message image opt-in state are removed. Inert sanitization,
no-referrer, script-denying CSP and sandbox remain. Attachment/cid, HTTP, data
and credential-bearing image URLs remain placeholders. External hosts can still
reject or fail image requests; attachment rendering is outside this amendment.

## Verification

- Node 24.21.0: `npm ci` succeeded with zero reported vulnerabilities;
  `npm run verify` passed syntax/identity checks and all 382 tests.
- Sanitizer tests check automatic HTTPS sources, no-referrer, restricted CSP,
  unsupported-source placeholders, and removal of credentials, srcset and event
  handlers. Popup tests cover rerenders, collapse/reopen, Escape and account removal.
- T3 collaborative browser used the actual popup HTML/CSS/JS and the existing
  synthetic Chrome boundary. A synthetic HTML body with a public HTTPS PNG
  loaded without an image button (natural width 544px). No image nodes were
  inserted into the parent document; scripts were absent from the email frame.
  Both embedded and insecure image sources remained placeholders. Frame height
  was 406px for a 404px body; final text was present with no horizontal overflow.
- Independent read-only review found no material issues in the actual diff.
- `git diff --check` passed. Impeccable's detector reported existing palette,
  sizing and theme-preview advisories; this change adds no visual styling.

These are automated and synthetic checks. Real-account Chrome acceptance for
this candidate is pending; the previous reader's acceptance is historical.

## Owner Chrome follow-up

1. Reload the unpacked extension from this worktree at `chrome://extensions`.
2. Expand an HTML newsletter in Gmail and Outlook where available. HTTPS images
   should appear immediately without a Load images button. Check the final text
   is reachable and image sizing fits the popup.
3. Collapse/reopen, then close/reopen the popup and read another HTML message.
   Automatic loading should work each time. Attachment images still use Open.
4. Check a plain-text message, an email link and Escape to collapse. Confirm
   selection/focus keeps the reader available and existing actions still work.

Record pass/fail and provider here after the owner reviews this candidate;
mail contents and credentials are not needed.
