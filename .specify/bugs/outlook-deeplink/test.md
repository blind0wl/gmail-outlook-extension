# Bug Verification: Outlook exact-message links

- **Slug**: outlook-deeplink (from fix context)
- **Tested**: 2026-09-30
- **Assessment**: ./assessment.md
- **Fix**: ./fix.md
- **Result**: partial

## Summary

The automated regression and actual popup handler pass with synthetic data.
Real Outlook message selection has not been exercised; owner acceptance and
the subsequent canonical closeout remain required.

## Checks Performed

| Check | Command / Action | Result | Notes |
| --- | --- | --- | --- |
| Pre-fix regression | node --test tests/outlook-deeplink.test.js | expected failure | 2 failed, 1 passed |
| Full checks | npm run verify | pass | 32 syntax checks, 155 tests |
| Node 24 suite | Node 24.21.0 --test "tests/*.test.js" | pass | 155 tests, zero skipped |
| Popup Open | T3 Chromium 152 synthetic fixture | pass | Exact encoded provider URL forwarded, mark-read retained |
| Real account reproduction | Owner Helium refresh/Open/restart/multiple mailbox check | not-run | Pending owner |
| Diff hygiene | git diff --check | pass | No whitespace errors |

## Output Excerpts

Full suite: tests 155; pass 155; fail 0; skipped 0.
Browser fixture expected and actual both:
`https://outlook.live.com/owa/?ItemID=AAMk%2B%2F%3D&exvsurl=1&viewmodel=ReadMessageItem`
This is synthetic test data, not a real message URL.

## Residual Risks

- Microsoft web sessions control mailbox sign-in; synthetic navigation does
  not prove the remote message opens in the owner's account.
- Old cached messages need a successful refresh for webLink.
- The canonical automated command still uses the old directory form that
  fails on Node 24. Its writer update remains proposed in docs/baseline.md.

## Recommendation

Submit the tested candidate for owner acceptance. Hold completion until the
exact tested revision is accepted, the independent completion audit is bound
to the accepted candidate, and the canonical writer runs closeout. The
earlier baseline acceptance of 604b03a does not apply to this behavior change.
