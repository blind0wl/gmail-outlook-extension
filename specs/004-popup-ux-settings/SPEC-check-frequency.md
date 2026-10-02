# Spec: Global email check frequency

**Module ID**: `check-frequency`
**Created**: 2026-10-02
**Status**: Owner-approved specification, 2026-10-02; ready for technical planning.
**Engineering contract**: [spec.md](spec.md#shared-engineering-contract).

## Objective

Allow users to choose how often the extension automatically checks all enabled
email accounts from one setting. There are no per-account interval controls.

## Approved UX

Add a “Mail checking” section at the bottom of Settings, after Sound, preserving
the relative order of other sections. Use a labelled “Check mail every” duration
field, a seconds/minutes/hours selector and an explicit Save button. Supporting
text states that the interval applies to all enabled accounts and that checks
may be delayed by the browser or mailbox service. Preserve unsaved input and
focus through unrelated cache/theme updates; saving reports success or failure.

## Requirements and success criteria

1. One interval governs the existing shared `mail-poll` alarm for all enabled
   Gmail and Outlook accounts. Disabled/signed-out accounts and account-specific
   backoff retain current eligibility behavior.
2. Retain the 1-minute default and inclusive 30-second–5-hour range from the
   existing worker and v1 product specification. Permit a whole-second duration
   throughout that range; do not limit users to a handful of preset values.
3. Load the effective saved interval when Settings opens. Preserve an existing
   valid `pollIntervalMs`; missing/invalid stored values safely use the default.
   Fractional-millisecond legacy numeric values may be displayed with sufficient
   precision and are not silently rewritten merely by opening Settings.
4. Saving validates the duration as a finite number in range, convertible to
   whole seconds. Empty, nonnumeric, nonfinite, below-minimum, above-maximum
   or subsecond input reports an accessible validation error without changing
   the saved value or alarm.
5. A successful Save persists the shared value and updates the running alarm
   without requiring popup close, worker restart or extension reload. The first
   newly scheduled check is due after the selected interval from successful
   rescheduling; Save itself does not fetch mail or produce mail alerts.
6. Preserve one shared alarm and current poll/mutation serialization. Updating
   the schedule does not cancel in-flight work, start a concurrent poll, clear
   cache/seen IDs, reset notification baselines, or clear backoff/recovery locks.
7. Success means both persistence and scheduling succeeded. Failure reports
   that the setting could not be applied, retains/restores the previous effective
   value and schedule where possible, and permits retry. Avoid displaying an
   unapplied selection as a confirmed saved setting.
8. Keep the value after popup reopen, worker termination, Chrome restart and
   extension reload. No accounts is a valid state: save the preference for
   future accounts without fetching mail.
9. Manual Refresh remains available and retains its existing silent notification
   behavior and account-error handling, regardless of the selected interval.
10. Pending Save prevents duplicate submissions. Rapid successive completed
    saves leave the last successfully applied value in storage and scheduling.
    Popup/provider networking and per-account settings are outside scope.

## Testing strategy

- Unit tests: default, bounds, unit conversion, whole-second validation,
  malformed persisted values and preserving valid existing preferences.
- Worker integration: persistence plus live alarm update, single alarm,
  first-check timing, restart hydration, failed saves/scheduling, duplicate
  requests and updates while a poll/mutation is in flight.
- Synthetic popup: load/save/reopen, accessible errors, pending/success/failure,
  preserved unsaved edits through unrelated updates, no accounts and all themes.
- Fresh Chrome acceptance: save short and longer intervals, observe automatic
  checks across Gmail and Outlook, reopen/reload to confirm persistence, verify
  manual Refresh and paused-account behavior. Treat browser scheduling as best
  effort; do not promise exact wall-clock delivery or bypass provider backoff.
- Run shared commands and inspect 320px/480px Settings layouts.

## Boundaries and open questions

Shared commands, structure, style and boundaries apply. Keep `pollIntervalMs`
and the existing shared alarm concept. Verify current Chrome alarm constraints
and scheduling semantics from official documentation during technical planning.
No new dependency or permission is proposed. Duration field, units, Save,
section placement and global scope are owner-approved.

Owner smoke-test feedback (2026-10-02) moves Mail checking from after Accounts
to the bottom of Settings, after Sound. This supersedes the original placement.
