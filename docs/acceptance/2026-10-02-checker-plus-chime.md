# Checker Plus chime — 2026-10-02

Candidate: working-tree changes on `t3code/explore-chime-notifications`, based
on `4ec4a37`. The owner approved using the installed Checker Plus for Gmail
chime and requested a README acknowledgement of Jason Savard and the project
as the inspiration for this extension.

The offscreen player now plays the bundled MP3 instead of synthesizing two
notes. Volume and mute preferences, automatic-poll eligibility and manual
refresh silence use the existing worker/settings logic. The original package
copyright notice is preserved alongside the sound, and README records its
source and version. No new dependencies, permissions or provider operations.

Fresh automated verification:

- Four playback boundary tests failed against the synthesized player, then
  passed after the replacement. They cover the bundled URL, requested volume,
  restart on another alert, zero/clamped/default volume, rejected playback,
  subsequent alerts and synchronous audio failures. Browser media APIs are
  doubled under Node; these tests do not establish audible Chrome playback.
- Node 24.19.0 with `npm ci`, then `npm run verify`: all 290 tests passed,
  including syntax and extension identity checks.
- `git diff --check`: passed.
- The bundled MP3 matches the installed Checker Plus for Gmail 36.5.2
  `sounds/chime.mp3` byte for byte. SHA-256:
  `906e8855703b2267af12a35d876761123a8823892f68ed409541c180516da029`.
  `ffprobe` confirmed a 0.628005-second, mono 44.1 kHz MP3, 5,659 bytes.

Fresh real-account Chrome acceptance: **pending; not performed**.
Reload the unpacked extension and verify that automatic new mail plays the
Checker Plus chime at the selected volume. Check a second automatic alert
after the offscreen document has been idle for more than 30 seconds, master
mute, per-account mute, zero volume and silent manual refresh. Confirm one
chime for a polling cycle with new mail across multiple accounts. No historical
acceptance result has been reused for this candidate.

## Loaded-folder follow-up — 2026-10-02

The owner reported hearing the old sound after reload. Inspection of Helium's
extension metadata identified its unpacked root as
`/home/dave/dev/gmail-outlook-extension`, rather than this T3 worktree. The
loaded root still contained the original oscillator player. The chime changes,
README acknowledgement, sound/copyright files and regression tests were applied
to that clean checkout as well, based on `ce9f20a` on
`fix/outlook-reauth-diagnostics`.

The four playback regressions failed against the loaded root's old player.
After applying the change, Node 24.19.0 `npm ci` and `npm run verify` passed
all 282 tests in that checkout. `git diff --check` passed, and the loaded
root's MP3 matches the SHA-256 above. The suite count differs because the
loaded checkout and T3 worktree are on different branches. Real-account
audible acceptance is still pending the owner's next extension reload/check.

## Owner smoke-test result — 2026-10-02

**Passed.** After updating the folder loaded by Helium and reloading the
extension, the owner confirmed: “yes that worked better. Smoke test passed”.
This confirms audible playback of the replacement chime in the loaded
extension. The owner did not report individual results for the broader
mute/volume, multi-account or offscreen-idle checks listed above; those remain
unconfirmed by this smoke test. The earlier pending statements record the
state before this confirmation.
