# Popup workspace verification

The fixture reuses production popup HTML, CSS and JavaScript with a synthetic
Chrome storage/runtime boundary. It makes no provider requests or real mailbox
changes. Accounts use example.test addresses. Screenshots are verification
captures, not generated assets or production mail.

For visual reproduction only, from the repository root run:

```sh
python3 -m http.server 8766 --bind 127.0.0.1
```

Open http://127.0.0.1:8766/docs/ui-workspace/ in T3 preview. Optional query flags:
`theme=midnight|slate|signal`, `empty`, `long`, `error`, `pending`, `save-error`,
`action-error`. Runtime requests are recorded without opening external tabs.
The synthetic `fixture.update()` helper reproduces storage changes. Close the
server after use; the actual extension needs no server or build.

Checks performed 2026-09-30:

- Node 24.21.0, `npm ci`, `npm run verify`: syntax/identity and all 170 tests pass.
- T3 browser: Mail and Settings at 404px Midnight, 380px Slate, 320px Signal
  (long address/error), and 480px empty. No document horizontal overflow.
- Native Tab and radio ArrowRight changed Slate to Signal, retained radio focus
  and persisted the selection. DOM tests cover reopen, external updates, drafts
  and failed storage writes.
- Preview expanded long unbroken cached text with zero runtime requests and no
  horizontal overflow. Settings Add/Cancel, pending sign-in, failure feedback,
  lower Notifications/Sound controls and scroll were inspected.
- Layout equivalent of 200% zoom: CSS zoom 2 with a 202px root / 300px body in
  a 404×600 viewport. Settings wraps, scrolls and exposes Back. T3 resize has a
  240px minimum; this is an emulation, not actual browser zoom acceptance.
- Console empty in inspected synthetic states. Production has no provider
  network calls. Native extension behavior remains owner acceptance.

Inspected captures are under `.impeccable/review/`; file names state theme,
view/state and viewport width. All were opened before independent review.
The independent code review and Impeccable finish review live beside this file.

Impeccable detector ran once; detector.json retains its findings. The primary
selected-control hover issue was fixed with a contrasting accent hover surface.
Advisories refer to the superseded white DESIGN system; approved themes are
now documented as the replacement system. Slate muted text was darkened to
#53677f to meet normal-text contrast on the popup background. No detector ignores
were added. Controls use visible focus, 32px minimum buttons and native labels.

Real-account acceptance is pending: reload/reopen, exact provider links,
account sign-in/out/remove, badge, native notifications/chime, saved themes and
actual browser zoom. Follow tests/popup-checklist.md on the candidate PR revision;
record a new dated result under docs/acceptance/. Historical passes are not reused.

The owner retired ai-dev-system during this work. AGENTS.md and the Pi router
were updated; `.dev` records remain historical and are not active approval gates.
Approved spec/plan/tasks remain the feature’s scope and progress records.

Review outcome: independent Addy code review approved after a delayed account-add
race was fixed and covered by success/failure regressions. Impeccable reviewed
all 14 captures; its sole material fix was documentary. The verdict pass scored
that fix resolved and returned `ship` at the documentary-fix scope. DESIGN.md and
its schema-v2 sidecar record all three production themes and current controls.
Source/capture hashes in capture.json bind this evidence to the production files.
