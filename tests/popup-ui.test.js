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
      onChanged: { addListener() {} },
    },
  };
  await import(`../src/popup/popup.js?ui=${Date.now()}`);
  await tick();
  await tick();
  const card = document.querySelector(".card");
  card.focus();
  card.click();
  await tick();
  assert.equal(document.activeElement, card);
  assert.equal(card.getAttribute("aria-expanded"), "true");
  assert.equal(
    card.querySelector(".card-preview").textContent,
    cached.subject + cached.snippet,
  );
  assert.equal(writes, 0);
  assert.equal(messages[0].type, "mark-read");
  for (const id of ["add-gmail", "add-outlook", "refresh-mail"])
    assert.ok(document.getElementById(id), id);
  const answers = [
    "second@gmail.com",
    "google-web-client",
    "second@outlook.com",
    "entra-client",
  ];
  globalThis.prompt = () => answers.shift();
  document.getElementById("add-gmail").click();
  await tick();
  assert.deepEqual(messages.at(-1), {
    type: "add-account",
    provider: "gmail",
    account: "second@gmail.com",
    clientId: "google-web-client",
  });
  document.getElementById("add-outlook").click();
  await tick();
  assert.deepEqual(messages.at(-1), {
    type: "add-account",
    provider: "outlook",
    account: "second@outlook.com",
    clientId: "entra-client",
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
