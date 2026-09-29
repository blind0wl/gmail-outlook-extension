# issue-2 owner acceptance report

**Work**: issue-2 — Route sign-in polling through the serialized poll queue
**Acceptance actor**: Repository owner (dave)
**Date**: 2026-09-29
**Channel**: Session chat — owner stated "I accepted the PR, merged." PR #4 merged as `df6b209`. Checklist ticked in-commit `2fb487b` ("docs: mark PR checklist complete", author dave).
**Strategy**: Project-declared `human-gate` gate (`.dev/verification.yaml` v1): `docs/pr-checklist.md` exercised in a real Chromium browser (owner-reported Helium) with real accounts, covering sign-in recovery plus badge, toast, chime, and mute regression. Owner-reported environment note: reloading the unpacked extension generated a new extension ID, so the Microsoft redirect URI needed re-registration on the Entra SPA blade. Gmail unaffected. Pre-existing environmental behavior, unrelated to the fix.

## Criteria assessed

Sign-in recovery per `docs/pr-checklist.md`: break one session, only that row reads needs sign in, click Sign in recovers the account without waiting for the next alarm and without touching other accounts. Regression sweep from the same checklist: badge, grouped toast, chime, master and per-account mute, stale and offline rows, Gmail thread links. Outlook exact-message thread link was left unticked as best-effort and is tracked separately as `outlook-deeplink`.

## Result

**Passed** with one stated qualification. All ticked boxes in `docs/pr-checklist.md` at `2fb487b` pass. The single unticked box is the Outlook exact-message best-effort item, which remains open under `outlook-deeplink` and is out of issue-2 scope.

## Honesty notes

- The owner gave no per-check verbal breakdown in chat beyond the merge approval. The ticked boxes committed by the owner in `2fb487b` serve as the recorded per-check result.
- Human verification is user-reported, not agent-executed, per project policy.
- Unresolved findings: Outlook exact-message link behavior (queued as `outlook-deeplink`); stable extension ID pin idea from the checkpoint, not yet indexed.
