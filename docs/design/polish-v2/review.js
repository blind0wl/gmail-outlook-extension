const frames = [...document.querySelectorAll("iframe")];
const state = { view: "mail", theme: "midnight", sample: "", width: 480, section: "" };

function select(group, attr, value) {
  document.querySelectorAll(`#${group} button`).forEach(b => b.setAttribute("aria-pressed", String(b.dataset[attr] === value)));
}
function load() {
  frames.forEach(f => {
    const p = new URLSearchParams({ v: f.dataset.v, theme: state.theme });
    if (state.sample) p.set(state.sample, "");
    f.style.width = state.width + "px";
    f.src = `frame.html?${p}`;
  });
}
async function ready(f) {
  for (let i = 0; i < 150; i++) {
    const d = f.contentDocument;
    if (d?.getElementById("inbox-list") && f.contentWindow.fixture && !d.body.hasAttribute("data-theme-loading")) return d;
    await new Promise(r => setTimeout(r, 40));
  }
}
async function apply() {
  for (const f of frames) {
    const d = await ready(f);
    if (!d) continue;
    const open = !d.getElementById("settings-view").hidden;
    if (open !== (state.view === "settings")) d.getElementById(state.view === "settings" ? "open-settings" : "back-to-mail").click();
    if (state.view === "settings") {
      const target = state.section ? d.getElementById(state.section) || d.querySelector("." + state.section) : null;
      const view = d.getElementById("settings-view");
      if (target) view.scrollTop = (target.closest("section") || target).offsetTop - 8; else view.scrollTop = 0;
    }
    f.blur(); d.activeElement?.blur?.();
  }
}
frames.forEach(f => f.addEventListener("load", apply));
document.querySelectorAll("#view button").forEach(b => b.addEventListener("click", () => { state.view = b.dataset.view; select("view", "view", state.view); apply(); }));
document.querySelectorAll("#theme button").forEach(b => b.addEventListener("click", () => {
  state.theme = b.dataset.theme; select("theme", "theme", state.theme);
  frames.forEach(f => f.contentWindow.fixture?.update({ popupTheme: state.theme }));
}));
document.getElementById("state").addEventListener("change", e => { state.sample = e.target.value; load(); });
document.getElementById("width").addEventListener("change", e => { state.width = Number(e.target.value); frames.forEach(f => f.style.width = state.width + "px"); });
document.getElementById("section").addEventListener("change", e => { state.section = e.target.value; state.view = "settings"; select("view", "view", "settings"); apply(); });
load();
