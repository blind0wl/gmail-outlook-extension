// Reproduce a host sizing itself from content before it grants a viewport.
const frame = document.querySelector("iframe");
if (frame.contentWindow.location.href === "about:blank" || frame.contentDocument.readyState !== "complete") {
  await new Promise(resolve => frame.addEventListener("load", resolve, { once: true }));
}
const doc = frame.contentDocument;
// Wait for the production theme/cache reads to finish, not a fixed animation delay.
const deadline = Date.now() + 5000;
while (!doc.querySelector("#mail-view") || doc.body.hasAttribute("data-theme-loading")) {
  if (Date.now() > deadline) throw new Error("Synthetic popup did not finish loading");
  await new Promise(resolve => setTimeout(resolve, 10));
}
const requested = doc.body.getBoundingClientRect().height;
frame.style.height = requested + "px";
await new Promise(requestAnimationFrame);
const mailHeight = doc.querySelector("#mail-view").clientHeight;
const settings = doc.querySelector("#open-settings");
settings.click();
const settingsHeight = doc.querySelector("#settings-view").clientHeight;
const pass = requested >= 500 && mailHeight >= 400 && settingsHeight >= 400;
document.querySelector("#result").textContent = `${pass ? "PASS" : "FAIL"}: requested ${requested}px; Mail ${mailHeight}px; Settings ${settingsHeight}px.`;
globalThis.autosizeResult = { pass, requested, mailHeight, settingsHeight };
