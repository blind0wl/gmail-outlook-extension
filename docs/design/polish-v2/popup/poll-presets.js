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
    duration.dispatchEvent(new Event("input", { bubbles: true }));
    sync();
  }));
  // The form refills its fields from storage and after saves without events,
  // so refresh the highlight whenever the user reaches the form.
  for (const type of ["input", "change", "focusin", "mouseover", "submit"]) form.addEventListener(type, () => setTimeout(sync, 0));
  sync();
}
