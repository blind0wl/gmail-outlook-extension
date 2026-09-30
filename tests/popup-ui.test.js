import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { parseHTML } from "linkedom";
const tick = () => new Promise((r) => setTimeout(r, 0));
test("popup lifecycle controls send worker messages and preview preserves focus without writing cache", async () => {
  const { window, document } = parseHTML(
    readFileSync(new URL("../src/popup/popup.html", import.meta.url), "utf8"),
  );
  globalThis.document = document;
  globalThis.window = window;
  let focus = null;
  window.HTMLElement.prototype.focus = function () {
    focus = this;
  };
  Object.defineProperty(document, "activeElement", { get: () => focus });
  const cached = {
    key: "gmail:a%40gmail.com:1",
    provider: "gmail",
    account: "a@gmail.com",
    subject: "Full subject <script>literal</script>",
    snippet: "Full cached snippet",
    unread: true,
    date: Date.now(),
  };
  const data = {
    mailCache: [cached],
    accounts: [{ provider: "gmail", account: "a@gmail.com" }],
  };
  const messages = [];
  let storageListener;
  let writes = 0;
  globalThis.chrome = {
    runtime: {
      sendMessage: async (msg) => {
        messages.push(msg);
        return { ok: true };
      },
    },
    storage: {
      local: {
        get: async (key) => ({ [key]: data[key] }),
        set: async () => writes++,
      },
      onChanged: { addListener(listener) { storageListener = listener; } },
    },
  };
  await import(`../src/popup/popup.js?ui=${Date.now()}`);
  await tick();
  await tick();
  const card = document.querySelector(".card");
  const summary = card.querySelector("button.card-summary");
  assert.ok(summary, "preview uses a native button distinct from Open");
  assert.equal(card.hasAttribute("role"), false, "list item contains independent controls");
  assert.equal(summary.querySelector("button"), null);
  summary.focus();
  summary.click();
  await tick();
  assert.equal(document.activeElement, summary);
  assert.equal(summary.getAttribute("aria-expanded"), "true");
  assert.equal(summary.getAttribute("aria-controls"), card.querySelector(".card-preview").id);
  assert.equal(
    card.querySelector(".card-preview").textContent,
    cached.subject + cached.snippet,
  );
  assert.equal(writes, 0);
  assert.equal(messages[0].type, "mark-read");
  storageListener({ mailCache: { newValue: [cached] } }, "local");
  assert.equal(document.activeElement, document.querySelector(".card-summary"));
  assert.equal(document.activeElement.getAttribute("aria-expanded"), "true");
  const chime = document.querySelector("#sound-accounts input");
  chime.focus();
  storageListener({ soundSettings: { newValue: {
    masterMuted: false, volume: 0.7, mutedAccounts: { "gmail:a@gmail.com": true },
  } } }, "local");
  assert.equal(document.activeElement, document.querySelector("#sound-accounts input"));
  assert.equal(document.activeElement.checked, false);
  const volume = document.getElementById("sound-volume");
  volume.value = "25";
  volume.dispatchEvent(new window.Event("input"));
  assert.equal(document.getElementById("sound-volume-value").textContent, "25%");
  assert.equal(volume.getAttribute("aria-valuetext"), "25%");
  for (const id of ["add-gmail", "add-outlook", "refresh-mail"])
    assert.ok(document.getElementById(id), id);
  async function submitAddForm(email) {
    document.getElementById("add-account-email").value = email;
    document.getElementById("add-account-form").dispatchEvent(
      new window.Event("submit", { bubbles: true, cancelable: true }),
    );
    await tick();
    await tick();
  }
  document.getElementById("add-gmail").click();
  await tick();
  assert.equal(document.getElementById("add-account-form").hidden, false);
  assert.equal(document.getElementById("add-account-help-gmail").hidden, false);
  assert.equal(document.getElementById("add-account-help-outlook").hidden, true);
  await submitAddForm("second@gmail.com");
  assert.deepEqual(messages.at(-1), {
    type: "add-account",
    provider: "gmail",
    account: "second@gmail.com",
  });
  assert.equal(document.getElementById("add-account-form").hidden, true);
  assert.equal(document.activeElement, document.getElementById("add-gmail"));
  document.getElementById("add-outlook").click();
  await tick();
  assert.equal(document.getElementById("add-account-help-gmail").hidden, true);
  assert.equal(document.getElementById("add-account-help-outlook").hidden, false);
  await submitAddForm("second@outlook.com");
  assert.deepEqual(messages.at(-1), {
    type: "add-account",
    provider: "outlook",
    account: "second@outlook.com",
  });
  document.getElementById("refresh-mail").click();
  await tick();
  assert.equal(messages.at(-1).type, "refresh");
  const signout = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === "Sign out",
  );
  assert.ok(signout);
  signout.click();
  await tick();
  assert.equal(messages.at(-1).type, "sign-out");
  const remove = [...document.querySelectorAll("button")].find(
    (b) => b.textContent === "Remove",
  );
  remove.click();
  await tick();
  assert.equal(messages.at(-1).type, "remove-account");
  let finishAction;
  let pendingRequests = 0;
  chrome.runtime.sendMessage = () => {
    pendingRequests++;
    return new Promise(resolve => { finishAction = resolve; });
  };
  const pending = document.querySelector('#account-controls [data-action="sign-out"]');
  pending.focus();
  pending.click();
  storageListener({ mailCache: { newValue: [cached] } }, "local");
  assert.equal(document.activeElement.dataset.action, "sign-out");
  assert.equal(document.activeElement.getAttribute("aria-disabled"), "true", "pending action stays focusable");
  document.activeElement.click();
  assert.equal(pendingRequests, 1, "pending action cannot be triggered twice");
  finishAction({ ok: true });
  await tick();
  assert.equal(document.activeElement.dataset.action, "sign-out");
  assert.equal(document.activeElement.getAttribute("aria-disabled"), "false");
  const recoveryState = { "gmail:a@gmail.com": { needsSignIn: true } };
  storageListener({ accountState: { newValue: recoveryState } }, "local");
  document.querySelector(".status-signin").focus();
  storageListener({ mailCache: { newValue: [cached] } }, "local");
  assert.ok(document.activeElement === document.querySelector(".status-signin"), "recovery focus survives refresh");
  document.activeElement.click();
  storageListener({ accountState: { newValue: recoveryState } }, "local");
  assert.ok(document.activeElement === document.querySelector(".status-signin"), "recovery focus survives refresh");
  assert.equal(document.activeElement.getAttribute("aria-disabled"), "true");
  assert.equal(document.activeElement.textContent, "Signing in…");
  document.activeElement.click();
  document.querySelector('#account-controls [data-action="sign-in"]').click();
  assert.equal(pendingRequests, 2, "recovery and account controls share one pending sign-in");
  data.accountState = recoveryState;
  finishAction({ ok: true });
  await tick();
  await tick();
  assert.ok(document.activeElement === document.querySelector(".status-signin"), "recovery focus survives refresh");
  assert.equal(document.activeElement.getAttribute("aria-disabled"), "false");
  storageListener({ accountState: { newValue: {} } }, "local");
  assert.equal(document.activeElement, document.getElementById("add-gmail"), "removed recovery has a surviving focus destination");
});
test("notification is silent so mute governs all extension sound", async () => {
  const { sendNotification } =
    await import("../src/background/service-worker.js");
  let options;
  globalThis.chrome = {
    notifications: {
      create: async (_id, value) => {
        options = value;
      },
    },
  };
  await sendNotification(
    { provider: "gmail", account: "a@gmail.com" },
    { title: "title", message: "text" },
  );
  assert.equal(options.silent, true);
});
