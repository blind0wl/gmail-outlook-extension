import {POLL_INTERVAL_KEY, normalizePollInterval, durationToMs, intervalDraft} from '../store/poll-settings.js';

// Retain the form DOM independently of mailbox renders. Storage events update
// the effective baseline; only the worker response can confirm application.
export function initPollSettings({ onFill = () => {} } = {}) {
  const form = document.getElementById('poll-settings-form');
  const duration = document.getElementById('poll-duration');
  const unit = document.getElementById('poll-unit');
  const save = document.getElementById('poll-save');
  const error = document.getElementById('poll-error');
  const status = document.getElementById('poll-status');
  let effective = normalizePollInterval(), dirty = false, pending = false, revision = 0;
  function fill() {
    const draft = intervalDraft(effective);
    duration.value = draft.value;
    unit.value = draft.unit;
    onFill();
  }
  function showError(message, invalid = false) {
    error.textContent = message;
    error.hidden = !message;
    duration.setAttribute('aria-invalid', String(invalid));
  }
  function changed(value) {
    revision++;
    const next = normalizePollInterval(value);
    // A different preference does not confirm its alarm has been applied.
    // Preserve pending feedback until the worker replies to this submission.
    if (next !== effective && !pending) status.textContent = '';
    effective = next;
    if (!dirty && !pending) fill();
  }
  async function load() {
    const version = revision;
    try {
      const data = await chrome.storage.local.get(POLL_INTERVAL_KEY);
      if (version === revision) changed(data[POLL_INTERVAL_KEY]);
    } catch {
      if (version === revision) showError('Could not load the saved interval. Try saving your choice again.');
    }
  }
  fill();
  void load();
  for (const control of [duration,unit]) control.addEventListener('input', () => {
    dirty = true;
    status.textContent = '';
    showError('');
  });
  // Native selects emit change; keeping both events also serves keyboard use.
  unit.addEventListener('change', () => { dirty = true; status.textContent = ''; showError(''); });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (pending) return;
    const pollIntervalMs = durationToMs(duration.value,unit.value);
    if (pollIntervalMs === null) {
      showError('Choose 30 seconds to 5 hours, using whole seconds.',true);
      duration.focus();
      return;
    }
    // Saving supersedes any read begun before this submission.
    const saveRevision = ++revision;
    pending = true;
    save.disabled = true;
    duration.readOnly = true;
    unit.disabled = true;
    form.setAttribute('aria-busy','true');
    showError('');
    status.textContent = 'Applying interval…';
    try {
      const result = await chrome.runtime.sendMessage({type:'set-poll-interval',pollIntervalMs});
      if (result?.ok && result.pollIntervalMs === pollIntervalMs) {
        // Preference events can arrive while this worker reply is in transit.
        // Keep a different observed value, and do not claim it was applied.
        const changedDuringSave = revision !== saveRevision && effective !== result.pollIntervalMs;
        if (!changedDuringSave) effective = result.pollIntervalMs;
        revision++;
        dirty = false;
        fill();
        status.textContent = changedDuringSave
          ? 'The interval changed while saving. Check the current value before saving again.'
          : 'Saved. Applies to all enabled accounts.';
      } else {
        status.textContent = '';
        showError(result?.uncertain ? 'The interval could not be confirmed. Check your choice and try again.' : 'Could not apply the interval. Your choice is still here; try again.');
        dirty = true;
        await load();
      }
    } catch {
      status.textContent = '';
      dirty = true;
      showError('The interval could not be confirmed. Your choice is still here; try again.');
      await load();
    } finally {
      pending = false;
      save.disabled = false;
      duration.readOnly = false;
      unit.disabled = false;
      form.setAttribute('aria-busy','false');
    }
  });
  return {changed};
}
