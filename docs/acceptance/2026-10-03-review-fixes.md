# Review fixes candidate acceptance

- **Date tested:** 2026-10-03
- **Candidate source commit:** `19763e94ca35cf18125724c163494ec0ae877474`
- **Browser:** T3 preview, Chrome `152.0.7977.130` / Electron `44.4.2`, Linux
- **Result:** Automated and synthetic checks recorded; live-account acceptance remains pending. This candidate is not fully accepted for shipping.

## Automated and synthetic results

- Node `v24.21.0`; `PATH=/tmp/node-v24.21.0-linux-x64/bin:$PATH npm run verify` — passed. Syntax checks passed for 58 JavaScript files, extension identity passed, and 336 tests passed with no failures.
- Fresh 320px, preset/Save, hover-none and CSS zoom emulation checks, plus modern and forced-fallback comparisons, are documented in [the browser evidence notes](../ui-review-fixes/README.md). All browser content used the synthetic fixture; no real mailbox content, credentials or provider requests were used.
- Actual browser chrome zoom and an older Chromium engine were not tested; CSS zoom and forced support-query branches are synthetic evidence only.

## Code review

Fresh Luna/max whole-branch review found no Critical, Important or Minor findings. See [the review report](../ui-review-fixes/code-review.md). The code-reviewed candidate remains pending live acceptance.

## Real-account Chrome acceptance — pending

Each item remains unchecked until freshly performed against this candidate. No historical acceptance ticks were reused.

### Gmail

- [ ] Sign in to a paused account and confirm the immediate provider fetch updates its cache.
- [ ] Confirm a later scheduled poll continues updating that account.
- [ ] Sign out during authentication and during a provider fetch; confirm recovery cannot restore the account.
- [ ] Remove during authentication and during a provider fetch; confirm the account and cache stay removed.

### Outlook

- [ ] Sign in to a paused account and confirm the immediate provider fetch updates its cache.
- [ ] Confirm a later scheduled poll continues updating that account.
- [ ] Sign out during authentication and during a provider fetch; confirm recovery cannot restore the account.
- [ ] Remove during authentication and during a provider fetch; confirm the account and cache stay removed.

### Extension lifecycle and browser

- [ ] Reopen the popup and confirm the current account, theme and interval state.
- [ ] Restart the worker and confirm persisted state and scheduled polling resume.
- [ ] Verify actual 200% browser chrome zoom in Chrome.
