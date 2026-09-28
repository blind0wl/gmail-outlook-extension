# Gmail plus Outlook extension v1 implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a local only MV3 extension that polls Gmail plus Outlook.com, shows one clean popup, and notifies with badge plus toast plus chime.

**Architecture:** Service worker owns auth refresh, polling, cache, and notify. Popup reads cache only. Gmail and Outlook adapters sit behind one normalized mail interface. No backend.

**Tech Stack:** Chrome MV3, plain JavaScript plus HTML plus CSS, no framework, no bundler, Node built in test runner with fixtures.

**Spec:** `docs/superpowers/specs/2026-09-28-gmail-outlook-extension-design.md`

## Global constraints

- Manifest V3 only.
- No custom backend or proxy in v1.
- Allowed hosts only: gmail.googleapis.com, accounts.google.com, graph.microsoft.com, login.microsoftonline.com.
- Gmail scope is https://www.googleapis.com/auth/gmail.readonly, Outlook scopes are User.Read plus Mail.Read plus offline_access, no send or write scopes.
- Tokens live in chrome.storage.session, mail cache lives in chrome.storage.local with 200 item cap and 7 day expiry.
- Logs and errors carry ids and timestamps only, never subject or body.
- Outlook covers Outlook.com, Hotmail, and Live personal only, authority https://login.microsoftonline.com/consumers, no M365 work accounts.
- Mark read is local only display flag in v1, providers stay source of truth.
- Private GitHub repo, branches per change, PR with load in Chrome checklist.

## Review focus

- Same message id appears from Gmail and Outlook adapters at once, popup must show two separate cards keyed by provider plus id.
- Poll returns zero items for an account with stale cache present, badge must not drop to zero until a successful fetch confirms it.
- Token expires mid poll with 401 on the third account only, other accounts must still update and only the failed account shows needs sign in.
- Two Gmail accounts share sender and subject at the same minute, All must still label work@gmail.com and personal@gmail.com distinctly.
- OS do not disturb is on when new mail lands, toast may suppress but badge plus cache must still update and sound must stay silent.

---

## File structure

- `manifest.json` owns MV3 identity, alarms, notifications, storage, popup, service worker, offscreen.
- `src/background/service-worker.js` owns alarms, poll orchestration, badge, notify dispatch.
- `src/auth/google.js` owns chrome.identity.getAuthToken plus cache clear, exposes `getGmailToken(interactive)`, `clearGmailToken(token)`.
- `src/auth/microsoft.js` owns launchWebAuthFlow PKCE plus refresh, exposes `getGraphToken(interactive)`, `clearGraphToken()`.
- `src/providers/gmail.js` owns Gmail list plus get plus normalize, exposes `fetchGmailMessages(token, since)`.
- `src/providers/outlook.js` owns Graph list plus normalize, exposes `fetchOutlookMessages(token, since)`.
- `src/store/cache.js` owns normalized mail type plus merge plus expiry plus local read flags, exposes `mergeMessages(items)`, `setLocalRead(key)`, `getInbox()`, `pruneCache()`.
- `src/notify/notify.js` owns new id diff plus toast plus badge count, exposes `diffNewIds(oldKeys, newKeys)`, `unreadCount(items)`.
- `src/notify/sound.js` plus `src/notify/offscreen.html` plus `src/notify/offscreen.js` own chime playback plus mute plus volume.
- `src/popup/popup.html` plus `src/popup/popup.css` plus `src/popup/popup.js` own A v5 inbox view.
- `tests/fixtures/gmail-list.json` plus `tests/fixtures/graph-list.json` own provider samples.
- `tests/cache.test.js`, `tests/normalize-gmail.test.js`, `tests/normalize-outlook.test.js`, `tests/notify.test.js` own automated checks.

Normalized mail shape every task uses: `{ key, provider, account, from, subject, snippet, date, unread, localRead }` where `key` is `provider + ':' + id`.

---

### Task 1: Repo plus MV3 shell that loads unpacked

**Files:**
- Create: `manifest.json`
- Create: `src/popup/popup.html`
- Create: `src/popup/popup.css`
- Create: `src/popup/popup.js`
- Create: `src/background/service-worker.js`
- Test: manual load check, no automated test

**Interfaces:**
- Consumes: none
- Produces: popup entry `src/popup/popup.html`, worker entry `src/background/service-worker.js`

- [ ] **Step 1: Create private GitHub repo and local git**

Run: `gh repo create gmail-outlook-extension --private --source=. --push` or create empty private repo in UI then `git init`, `git add docs`, `git commit -m "docs: add v1 design spec"`, set remote, push main.
Expected: `git status` clean on main with spec present.

- [ ] **Step 2: Write minimal manifest plus hello popup plus empty worker**

Implement `manifest.json` with `manifest_version: 3`, `name`, `version: 0.1.0`, `permissions: ["identity", "alarms", "notifications", "storage", "offscreen"]`, `host_permissions` limited to the four allowed hosts, `action.default_popup` to `src/popup/popup.html`, `background.service_worker` to `src/background/service-worker.js`.
Expected: file exists with exact four hosts and no other hosts.

- [ ] **Step 3: Verify unpacked load**

Run: open `chrome://extensions`, enable developer mode, load unpacked repo root, click toolbar icon.
Expected: hello popup opens with no console errors.

- [ ] **Step 4: Commit**

```bash
git checkout -b feat/mv3-shell
git add manifest.json src/popup src/background
git commit -m "feat: add MV3 shell with hello popup"
```

### Task 2: Store plus account model plus expiry

**Files:**
- Create: `src/store/cache.js`
- Test: `tests/cache.test.js`

**Interfaces:**
- Consumes: none
- Produces: `mergeMessages(items) -> { items }`, `setLocalRead(key) -> void`, `getInbox() -> items`, `pruneCache(now) -> items`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert";
import { mergeMessages, setLocalRead, pruneCache } from "../src/store/cache.js";
test("local read survives merge and expiry prunes old", () => {
  const now = Date.now();
  mergeMessages([{ key: "gmail:1", provider: "gmail", account: "work@gmail.com", from: "a", subject: "s", snippet: "p", date: now, unread: true }]);
  setLocalRead("gmail:1");
  mergeMessages([{ key: "gmail:1", provider: "gmail", account: "work@gmail.com", from: "a", subject: "s", snippet: "p", date: now, unread: true }]);
  const kept = pruneCache(now + 8 * 24 * 3600 * 1000);
  assert.equal(kept.find(i => i.key === "gmail:1"), undefined);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/cache.test.js`
Expected: FAIL with module or function not defined.

- [ ] **Step 3: Implement `mergeMessages`, `setLocalRead`, `getInbox`, `pruneCache` in `src/store/cache.js`**

Merge by `key`, never clear `localRead` on merge, enforce 200 item cap newest first, expire older than 7 days. Add test for zero item poll keeping stale cache.
Expected: cache helpers match normalized shape exactly.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/cache.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/store/cache.js tests/cache.test.js
git commit -m "feat: add cache with local read and expiry"
```

### Task 3: Gmail adapter normalization

**Files:**
- Create: `src/providers/gmail.js`
- Create: `tests/fixtures/gmail-list.json`
- Test: `tests/normalize-gmail.test.js`

**Interfaces:**
- Consumes: `getGmailToken` from Task 6, cache shape from Task 2
- Produces: `fetchGmailMessages(token, since) -> normalized[]`, `normalizeGmailMessage(raw, account) -> normalized`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert";
import { normalizeGmailMessage } from "../src/providers/gmail.js";
import raw from "../tests/fixtures/gmail-list.json" with { type: "json" };
test("gmail normalize keeps account and key", () => {
  const out = normalizeGmailMessage(raw.messages[0], "work@gmail.com");
  assert.equal(out.key, "gmail:" + raw.messages[0].id);
  assert.equal(out.account, "work@gmail.com");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/normalize-gmail.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `normalizeGmailMessage(raw, account)` plus `fetchGmailMessages(token, since)` in `src/providers/gmail.js`**

Call `GET https://gmail.googleapis.com/gmail/v1/users/me/messages` then per id `GET .../messages/{id}?format=metadata`, map to normalized shape, never request write scopes.
Expected: two Gmail accounts with same subject keep distinct account values.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/normalize-gmail.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/providers/gmail.js tests/normalize-gmail.test.js tests/fixtures/gmail-list.json
git commit -m "feat: add gmail read only adapter"
```

### Task 4: Outlook adapter normalization

**Files:**
- Create: `src/providers/outlook.js`
- Create: `tests/fixtures/graph-list.json`
- Test: `tests/normalize-outlook.test.js`

**Interfaces:**
- Consumes: `getGraphToken` from Task 6, cache shape from Task 2
- Produces: `fetchOutlookMessages(token, since) -> normalized[]`, `normalizeGraphMessage(raw, account) -> normalized`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert";
import { normalizeGraphMessage } from "../src/providers/outlook.js";
import raw from "../tests/fixtures/graph-list.json" with { type: "json" };
test("graph normalize keeps provider key", () => {
  const out = normalizeGraphMessage(raw.value[0], "you@outlook.com");
  assert.equal(out.provider, "outlook");
  assert.equal(out.key, "outlook:" + raw.value[0].id);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/normalize-outlook.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement `normalizeGraphMessage` plus `fetchOutlookMessages` in `src/providers/outlook.js`**

Call `GET https://graph.microsoft.com/v1.0/me/messages?$top=25&$select=subject,from,receivedDateTime,bodyPreview,isRead`, map `isRead` to `unread`, never use Mail.Read.Shared.
Expected: Graph and Gmail ids never collide because keys carry provider prefix.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/normalize-outlook.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/providers/outlook.js tests/normalize-outlook.test.js tests/fixtures/graph-list.json
git commit -m "feat: add outlook read only adapter"
```

### Task 5: Polling plus badge plus toast

**Files:**
- Modify: `src/background/service-worker.js`
- Create: `src/notify/notify.js`
- Test: `tests/notify.test.js`

**Interfaces:**
- Consumes: `fetchGmailMessages`, `fetchOutlookMessages`, `mergeMessages`, `getInbox`
- Produces: `diffNewIds(oldKeys, newKeys) -> newKeys[]`, `unreadCount(items) -> number`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert";
import { diffNewIds, unreadCount } from "../src/notify/notify.js";
test("diff finds new and count ignores local read", () => {
  assert.deepEqual(diffNewIds(["a"], ["a", "b"]), ["b"]);
  assert.equal(unreadCount([{ unread: true, localRead: true }, { unread: true }]), 1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/notify.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement alarms plus per account poll plus badge plus toast in worker and `src/notify/notify.js`**

Alarm default 1 minute, per account toggle, manual message refresh, 401 refresh once then needs sign in flag, 429 backoff, zero item poll keeps stale cache, toast grouped per account, no toast on manual refresh.
Expected: failed third account does not block first two.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/notify.test.js`
Expected: PASS. Manual load shows badge and toast with fixtures.

- [ ] **Step 5: Commit**

```bash
git add src/background/service-worker.js src/notify/notify.js tests/notify.test.js
git commit -m "feat: add polling with badge and toast"
```

### Task 6: Auth wiring without secrets in bundle

**Files:**
- Create: `src/auth/google.js`
- Create: `src/auth/microsoft.js`
- Modify: `manifest.json`

**Interfaces:**
- Consumes: none
- Produces: `getGmailToken(interactive) -> token`, `clearGmailToken(token)`, `getGraphToken(interactive) -> token`, `clearGraphToken()`

- [ ] **Step 1: Document manual auth test**

Add `docs/manual-auth.md` with Gmail button flow plus Outlook consumers flow plus expected consent screens, no tokens recorded.
Expected: reviewer can follow steps with their own accounts.

- [ ] **Step 2: Implement Google plus Microsoft auth with no automated token test**

Google uses `chrome.identity.getAuthToken`, clear with `removeCachedAuthToken`. Microsoft uses `launchWebAuthFlow` with PKCE to consumers authority, redirect from `chrome.identity.getRedirectURL`, public client, no secret. Automated tests assert scopes and authority strings only.
Expected: `manifest.json` keeps `oauth2.scopes` to gmail.readonly only.

- [ ] **Step 3: Manual verify in Chrome**

Run: load unpacked, sign in Gmail, sign in Outlook.com, sign out each, confirm session clears.
Expected: PASS manually, recorded as PR checklist ticks.

- [ ] **Step 4: Commit**

```bash
git add src/auth manifest.json docs/manual-auth.md
git commit -m "feat: wire gmail and outlook auth flows"
```

### Task 7: Popup inbox A v5

**Files:**
- Modify: `src/popup/popup.html`, `src/popup/popup.css`, `src/popup/popup.js`

**Interfaces:**
- Consumes: `getInbox()` from Task 2
- Produces: popup render with pills, cards, open provider links

- [ ] **Step 1: Write render checklist test**

Add `tests/popup-checklist.md` with account top left, pills contrast, dark subjects, badge plus address, unread dot, open provider button.
Expected: file lists exact strings to eyeball in Chrome.

- [ ] **Step 2: Implement A v5 layout from spec**

Header Inbox plus count with search icon, pills All Gmail Outlook, cards with badge plus address top left and time top right, avatar plus subject plus snippet, click sets local read, action opens provider thread.
Expected: work@gmail.com and personal@gmail.com read as separate lines in All.

- [ ] **Step 3: Manual verify with mixed accounts**

Run: load unpacked with two Gmail plus one Outlook account.
Expected: checklist ticks pass with no console errors.

- [ ] **Step 4: Commit**

```bash
git add src/popup tests/popup-checklist.md
git commit -m "feat: add A v5 inbox popup"
```

### Task 8: Sound on new mail with mute controls

**Files:**
- Create: `src/notify/offscreen.html`
- Create: `src/notify/offscreen.js`
- Create: `src/notify/sound.js`
- Modify: `src/background/service-worker.js`, `src/popup/popup.js`

**Interfaces:**
- Consumes: `diffNewIds` from Task 5
- Produces: `playChime()`, `setMuted(all, perAccount)`, `setVolume(level)`, `shouldPlay({ manual, muted, dnd }) -> boolean`

- [ ] **Step 1: Write the failing test**

```js
import test from "node:test";
import assert from "node:assert";
import { shouldPlay } from "../src/notify/sound.js";
test("sound silent on manual refresh, muted account, and DND", () => {
  assert.equal(shouldPlay({ manual: true, muted: false, dnd: false }), false);
  assert.equal(shouldPlay({ manual: false, muted: true, dnd: false }), false);
  assert.equal(shouldPlay({ manual: false, muted: false, dnd: true }), false);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test tests/sound.test.js`
Expected: FAIL.

- [ ] **Step 3: Implement offscreen chime plus settings**

Offscreen document plays short chime, master mute plus per account toggle plus volume persisted in storage, silent on manual refresh and OS do not disturb where reported.
Expected: new poll with sound on plays once, muted stays silent.

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test tests/sound.test.js`
Expected: PASS plus manual sound check in Chrome.

- [ ] **Step 5: Commit**

```bash
git add src/notify/offscreen.html src/notify/offscreen.js src/notify/sound.js tests/sound.test.js
git commit -m "feat: add new mail chime with mute"
```

### Task 9: Error states plus PR gate

**Files:**
- Modify: `src/popup/popup.js`, `src/background/service-worker.js`
- Create: `docs/pr-checklist.md`

**Interfaces:**
- Consumes: all prior tasks
- Produces: stale plus offline plus needs sign in states, PR checklist

- [ ] **Step 1: Add per account error fixtures**

Extend notify and cache tests with 401 on one account, 429 backoff, offline empty fetch.
Expected: failing tests define stale label plus retry time plus needs sign in button.

- [ ] **Step 2: Implement error UI**

Popup shows per account stale, offline note, needs sign in button, never shows subject in errors.
Expected: one failed account leaves others updating.

- [ ] **Step 3: Run full suite plus manual load**

Run: `node --test tests/`
Expected: PASS. Manual load ticks badge, toast, sound, mute, stale, sign in recovery.

- [ ] **Step 4: Commit**

```bash
git add src/popup src/background tests docs/pr-checklist.md
git commit -m "feat: add error states and PR gate"
```
