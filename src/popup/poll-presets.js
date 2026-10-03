// Presets only fill the duration and unit. Saving stays explicit.
export function initPollPresets() {
  const form = document.getElementById("poll-settings-form");
  const duration = document.getElementById("poll-duration");
  const unit = document.getElementById("poll-unit");
  if (!form || !duration || !unit) return;
  const buttons = [...form.querySelectorAll(".poll-presets button")];
  const sync = () => buttons.forEach(b => b.setAttribute("aria-pressed", String(b.dataset.value === duration.value && b.dataset.unit === unit.value)));
  buttons.forEach(b => b.addEventListener("click", () => {
    duration.value = b.dataset.value;
    unit.value = b.dataset.unit;
    duration.dispatchEvent(new document.defaultView.Event("input", { bubbles: true }));
  }));
  for (const type of ["input", "change"]) form.addEventListener(type, sync);
  sync();
  return { sync };
}
