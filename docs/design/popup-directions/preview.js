const icons = {
  settings: '<path d="m9 3 .6-1h4.8l.6 1 .5 2 1.5.9 2-.5 1.6 2.8-1.5 1.5v1.8l1.5 1.5-1.6 2.8-2-.5-1.5.9-.5 2-.6 1H9l-.6-1-.5-2-1.5-.9-2 .5-1.6-2.8 1.5-1.5v-1.8L2.7 9l1.6-2.8 2 .5 1.5-.9L9 3Z"/><circle cx="12" cy="11.8" r="3"/>',
  refresh: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.2 7a7 7 0 0 1 11.5-1L20 9M4 15l2.3 3A7 7 0 0 0 17.8 17"/>',
  open: '<path d="M14 3h7v7M21 3 10 14"/><path d="M10 3H4a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1v-6"/>',
  read: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 6 9 7 9-7"/>',
  unread: '<path d="m3 9 9-6 9 6v10H3Z"/><path d="m3 9 9 6 9-6"/>',
  trash: '<path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7"/>',
  back: '<path d="m14 5-7 7 7 7"/>',
};
const icon = (name) => `<svg viewBox="0 0 24 24" aria-hidden="true">${icons[name]}</svg>`;
const themes = [
  { id: "midnight", name: "Midnight desk", description: "Dark blue-grey surfaces, gentle teal accents and clear account panels." },
  { id: "slate", name: "Slate workspace", description: "A soft blue-grey workspace with lighter sections and calm blue accents." },
  { id: "signal", name: "Signal panel", description: "Silver-grey surfaces, amber unread counters and tactile controls." },
];
const sampleAccounts = [
  { address: "work@example.com", provider: "Gmail", mail: [
    { id: "a", from: "Alex Morgan", subject: "Project review", snippet: "The updated draft is ready. Could you share your feedback before Friday?", time: "9:42", unread: true },
    { id: "b", from: "Design team", subject: "A few ideas for next week", snippet: "Here are the notes from our planning session, including the next steps.", time: "8:16", unread: true },
  ] },
  { address: "personal@example.com", provider: "Gmail", mail: [
    { id: "c", from: "Jamie", subject: "Saturday lunch?", snippet: "The place near the park looks good. Does 12:30 work for you?", time: "Yesterday", unread: false },
  ] },
  { address: "outlook@example.com", provider: "Outlook", mail: [
    { id: "d", from: "Travel desk", subject: "Your booking is confirmed", snippet: "Your reservation is ready. Keep this message for the details of your visit.", time: "Yesterday", unread: true },
  ] },
];
for (const theme of themes) {
  const article = document.createElement("article");
  article.className = "direction";
  article.innerHTML = `<h2>${theme.name}</h2><p>${theme.description}</p><section class="popup ${theme.id}" aria-label="${theme.name} interactive popup preview"></section>`;
  document.getElementById("directions").append(article);
  const popup = article.querySelector(".popup");
  const accounts = structuredClone(sampleAccounts);
  let currentTheme = theme.id;
  const preferenceKey = `popup-design-preview:${theme.id}`;
  try {
    const saved = localStorage.getItem(preferenceKey);
    if (themes.some(t => t.id === saved)) currentTheme = saved;
  } catch { /* Preview still works when browser storage is unavailable. */ }
  function applyTheme() {
    const selected = themes.find(t => t.id === currentTheme);
    popup.className = `popup ${selected.id}`;
    article.querySelector("h2").textContent = selected.name;
    article.querySelector("p").textContent = selected.description;
  }
  applyTheme();
  let settings = false;
  let notice = "";
  let removed = null;
  const expanded = new Set();
  let volume = 50;
  const prefs = { muted: false, desktop: true, badge: true, skip: false, chimes: [true, true, true] };

  function render(focusAction) {
    const total = accounts.reduce((n, a) => n + a.mail.filter(m => m.unread).length, 0);
    popup.innerHTML = `<header class="toolbar"><div><h2 class="title">${settings ? "Settings" : "Inbox"}</h2><p class="subtitle">${settings ? "Accounts, notifications and sound" : `${accounts.length} accounts · ${total} unread`}</p></div><div class="tools">${settings ? `<button class="icon-button" data-action="back" aria-label="Back to mail" title="Back to mail">${icon("back")}</button>` : `<button class="icon-button" data-action="refresh" aria-label="Refresh mail" title="Refresh mail">${icon("refresh")}</button><button class="icon-button" data-action="settings" aria-label="Settings" title="Settings">${icon("settings")}</button>`}</div></header><div class="scroll-area">${settings ? settingsMarkup() : mailMarkup()}</div><div class="toast" role="status" ${notice ? "" : "hidden"}><span>${notice}</span>${removed ? '<button data-action="undo">Undo</button>' : '<button data-action="dismiss" aria-label="Dismiss status">Dismiss</button>'}</div>`;
    if (focusAction) popup.querySelector(`[data-action="${focusAction}"]`)?.focus();
  }
  function mailMarkup() {
    return accounts.map((account, index) => {
      const count = account.mail.filter(m => m.unread).length;
      return `<section class="account-section" aria-labelledby="${theme.id}-account-${index}"><header class="account-heading"><div class="account-heading-top"><span class="account-badge">${account.provider}</span><span class="count">${count} unread</span></div><h3 id="${theme.id}-account-${index}">${account.address}</h3></header>${account.mail.length ? account.mail.map(m => `<article class="mail ${m.unread ? "" : "read"} ${expanded.has(m.id) ? "expanded" : ""}" data-mail="${m.id}"><button class="mail-body" data-action="preview-${m.id}" aria-expanded="${expanded.has(m.id)}" aria-label="Preview ${m.subject}"><span class="mail-top"><span class="sender">${m.unread ? '<span class="unread-dot" aria-label="Unread"></span>' : ""}${m.from}</span><time>${m.time}</time></span><span class="subject">${m.subject}</span><span class="snippet">${m.snippet}</span></button><div class="mail-actions"><button class="open-button" data-action="open-${m.id}" title="Open in ${account.provider}">${icon("open")}<span>Open</span></button><div class="quick-actions"><button class="icon-button" data-action="read-${m.id}" aria-label="Mark ${m.unread ? "read" : "unread"}: ${m.subject}" title="Mark ${m.unread ? "read" : "unread"}">${icon(m.unread ? "read" : "unread")}</button><button class="icon-button trash-button" data-action="trash-${m.id}" aria-label="Move to ${account.provider === "Gmail" ? "Trash" : "Deleted Items"}: ${m.subject}" title="Move to ${account.provider === "Gmail" ? "Trash" : "Deleted Items"}">${icon("trash")}</button></div></div></article>`).join("") : '<p class="empty">No messages to show.</p>'}</section>`;
    }).join("");
  }
  function settingsMarkup() {
    return `<section class="settings-section"><h3>Themes</h3><div role="radiogroup" aria-label="Theme">${themes.map(t => `<label class="theme-choice"><input type="radio" name="theme-${theme.id}" value="${t.id}" data-pref="theme" ${currentTheme === t.id ? "checked" : ""}><span class="theme-swatch" style="background:${t.id === "midnight" ? "#293e50" : t.id === "slate" ? "#b8cbe2" : "#b4b8bc"}"></span><span>${t.name}</span>${t.id === "midnight" ? "<small>Default</small>" : ""}</label>`).join("")}</div></section><section class="settings-section"><h3>Accounts</h3>${accounts.map(a => `<div class="setting-account"><strong>${a.address}</strong><small>${a.provider} · Connected</small><div class="setting-actions"><button data-action="account-signin">Sign in</button><button data-action="account-signout">Sign out</button><button data-action="account-remove">Remove</button></div></div>`).join("")}<div class="add-buttons"><button data-action="add-gmail">Add Gmail</button><button data-action="add-outlook">Add Outlook</button></div></section><section class="settings-section"><h3>Notifications</h3>${checkbox("desktop", "Desktop notifications")}${checkbox("badge", "Unread badge")}${checkbox("skip", "Pause alerts when a mailbox tab is focused")}</section><section class="settings-section"><h3>Sound</h3>${checkbox("muted", "Mute all sounds")}<label class="volume"><span>Volume</span><input type="range" min="0" max="100" value="${volume}" aria-label="Sound volume"><output>${volume}%</output></label>${accounts.map((a, i) => `<label class="setting-row"><input type="checkbox" data-pref="chime-${i}" ${prefs.chimes[i] ? "checked" : ""}><span>Chime for ${a.address}</span></label>`).join("")}</section>`;
  }
  function checkbox(key, label) { return `<label class="setting-row"><input type="checkbox" data-pref="${key}" ${prefs[key] ? "checked" : ""}><span>${label}</span></label>`; }
  popup.addEventListener("input", e => {
    if (e.target.type === "range") { volume = Number(e.target.value); e.target.nextElementSibling.value = `${volume}%`; }
  });
  popup.addEventListener("change", e => {
    const key = e.target.dataset.pref;
    if (key === "theme") {
      currentTheme = e.target.value;
      applyTheme();
      try { localStorage.setItem(preferenceKey, currentTheme); } catch { /* Optional preview persistence. */ }
    }
    else if (key?.startsWith("chime-")) prefs.chimes[Number(key.slice(6))] = e.target.checked;
    else if (key) prefs[key] = e.target.checked;
  });
  popup.addEventListener("click", e => {
    const button = e.target.closest("button[data-action]");
    if (!button) return;
    const action = button.dataset.action;
    const scrollTop = popup.querySelector(".scroll-area").scrollTop;
    if (action === "settings" || action === "back") {
      settings = action === "settings"; notice = ""; removed = null;
      render(settings ? "back" : "settings"); return;
    }
    if (action === "refresh") { notice = "Mail is up to date."; render("refresh"); return; }
    if (action === "dismiss") { notice = ""; render(settings ? "back" : "refresh"); return; }
    if (action === "undo" && removed) { accounts[removed.account].mail.splice(removed.index, 0, removed.mail); removed = null; notice = "Message restored."; render(); return; }
    if (action.startsWith("account-") || action.startsWith("add-")) { notice = "Account connection is simulated in this preview."; removed = null; render("back"); return; }
    const id = action.slice(action.indexOf("-") + 1);
    const accountIndex = accounts.findIndex(a => a.mail.some(m => m.id === id));
    if (accountIndex < 0) return;
    const account = accounts[accountIndex];
    const index = account.mail.findIndex(m => m.id === id);
    const mail = account.mail[index];
    if (action.startsWith("preview-")) expanded.has(id) ? expanded.delete(id) : expanded.add(id);
    if (action.startsWith("read-")) mail.unread = !mail.unread;
    if (action.startsWith("open-")) { removed = null; notice = `Would open this message in ${account.provider}.`; }
    if (action.startsWith("trash-")) { removed = { account: accountIndex, index, mail }; account.mail.splice(index, 1); notice = `Moved to ${account.provider === "Gmail" ? "Trash" : "Deleted Items"}.`; }
    render(action.startsWith("trash-") ? "undo" : action);
    popup.querySelector(".scroll-area").scrollTop = scrollTop;
  });
  render();
}
