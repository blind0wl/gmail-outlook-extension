const frame = document.getElementById('popup-preview');
const status = document.getElementById('preview-status');
const state = { version: 'proposed', width: 480, view: 'mail', theme: 'midnight' };
let popup, observer, generation = 0;

function selectButtons(attribute, value) {
  document.querySelectorAll(`[${attribute}]`).forEach(button => {
    button.setAttribute('aria-pressed', String(button.getAttribute(attribute) === String(value)));
  });
}

function polishRenderedRows() {
  if (!popup) return;
  // Also neutralize middle-click and context-menu navigation. The synthetic
  // runtime still records account/message opens through its existing handlers.
  popup.querySelectorAll('a').forEach(link => {
    link.setAttribute('href', '#');
    link.removeAttribute('target');
  });
  const proposed = state.version === 'proposed';
  popup.querySelectorAll('.card').forEach(card => {
    const icons = card.querySelector('.card-icons');
    const topline = card.querySelector('.card-topline');
    const footer = card.querySelector('.card-footer');
    const time = card.querySelector('.card-time');
    if (proposed && footer && icons.parentElement !== footer) footer.append(time, icons);
    if (!proposed && icons.parentElement !== topline) topline.append(icons, time);
  });
}

function applyVersion() {
  const style = popup?.getElementById('original-style');
  if (!style) return;
  style.disabled = state.version === 'proposed';
  popup.getElementById('production-style').disabled = state.version === 'current';
  polishRenderedRows();
  selectButtons('data-version', state.version);
  status.textContent = `${state.version === 'proposed' ? 'Proposed polish' : 'Current design'} · ${state.width}px · Interactive sample mail`;
}

function setView(view) {
  state.view = view;
  selectButtons('data-view', view);
  const settingsOpen = popup && !popup.getElementById('settings-view').hidden;
  if (popup && settingsOpen !== (view === 'settings')) popup.getElementById(view === 'settings' ? 'open-settings' : 'back-to-mail').click();
}

async function initialize() {
  const version = ++generation;
  observer?.disconnect();
  popup = null;
  const deadline = Date.now() + 6000;
  while (Date.now() < deadline) {
    if (version !== generation) return;
    const doc = frame.contentDocument;
    if (doc?.getElementById('inbox-list') && frame.contentWindow.fixture && !doc.body.hasAttribute('data-theme-loading')) {
      popup = doc;
      break;
    }
    await new Promise(resolve => setTimeout(resolve, 40));
  }
  if (!popup) { status.textContent = 'The sample popup could not load. Refresh this page to try again.'; return; }
  const win = frame.contentWindow;
  const fixture = win.fixture;
  // All effects stay within the synthetic boundary. Complete the fixture's
  // interval reply, local Open state and account lifecycle for this prototype.
  const originalSend = win.chrome.runtime.sendMessage;
  win.chrome.runtime.sendMessage = async message => {
    if (message.type === 'set-poll-interval') {
      fixture.requests.push(message);
      fixture.update({ pollIntervalMs: message.pollIntervalMs });
      return { ok: true, pollIntervalMs: message.pollIntervalMs };
    }
    if (message.type === 'mark-read') fixture.update({ mailCache: fixture.data.mailCache.map(item => item.key === message.key ? { ...item, localRead: true } : item) });
    if (['sign-in', 'sign-out'].includes(message.type)) fixture.update({ accounts: fixture.data.accounts.map(account => account.account === message.account ? { ...account, enabled: message.type === 'sign-in' } : account) });
    return originalSend(message);
  };
  const samples = [
    ['A few good things to read this week', 'New essays, a conversation with the editor, and a short reading list for a slower weekend.'],
    ['Thursday review — a few notes before we meet', 'I’ve added the latest sketches and the decisions from our last conversation. Let me know if anything needs another look.'],
    ['The studio is opening its doors', 'Join us next Friday for an afternoon of new work, coffee and conversation. Here are the details.'],
    ['Saturday by the water?', 'The forecast looks good. Shall we meet at the usual place around eleven?'],
  ];
  const checkedAt = Date.now() - 120000;
  const accountState = { ...fixture.data.accountState };
  fixture.data.accounts.forEach(account => {
    const key = `${account.provider}:${account.account}`;
    if (!accountState[key] && account.enabled !== false) accountState[key] = { checkedAt };
  });
  fixture.update({ accountState, mailCache: fixture.data.mailCache.map((item, index) => ({ ...item, subject: samples[index % samples.length][0], snippet: samples[index % samples.length][1] })) });
  const style = popup.createElement('link');
  style.id = 'original-style';
  style.rel = 'stylesheet';
  style.href = new URL('current.css', location.href).href;
  style.disabled = state.version === 'proposed';
  popup.querySelector('link[rel="stylesheet"]').id = 'production-style';
  popup.head.append(style);
  observer = new MutationObserver(() => {
    polishRenderedRows();
    state.view = popup.getElementById('settings-view').hidden ? 'mail' : 'settings';
    selectButtons('data-view', state.view);
    state.theme = popup.documentElement.dataset.theme;
    const radio = document.querySelector(`input[name="theme"][value="${state.theme}"]`);
    if (radio) radio.checked = true;
  });
  observer.observe(popup.body, { childList: true, subtree: true });
  observer.observe(popup.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  popup.getElementById('open-settings').addEventListener('click', () => { state.view = 'settings'; selectButtons('data-view', 'settings'); });
  popup.getElementById('back-to-mail').addEventListener('click', () => { state.view = 'mail'; selectButtons('data-view', 'mail'); });
  // Prevent ordinary web links in the fixture from opening provider pages.
  popup.addEventListener('click', event => {
    const link = event.target.closest('a');
    if (link) { event.preventDefault(); if (!link.classList.contains('account-inbox')) status.textContent = 'Provider links are simulated in this prototype.'; }
  });
  setView(state.view);
  applyVersion();
}

document.querySelectorAll('[data-version]').forEach(button => button.addEventListener('click', () => { state.version = button.dataset.version; applyVersion(); }));
document.querySelectorAll('[data-width]').forEach(button => button.addEventListener('click', () => {
  state.width = Number(button.dataset.width);
  frame.style.width = `${state.width}px`;
  selectButtons('data-width', state.width);
  applyVersion();
}));
document.querySelectorAll('[data-view]').forEach(button => button.addEventListener('click', () => setView(button.dataset.view)));
document.querySelectorAll('input[name="theme"]').forEach(radio => radio.addEventListener('change', () => {
  state.theme = radio.value;
  frame.contentWindow.fixture?.update({ popupTheme: state.theme });
}));
document.getElementById('sample-state').addEventListener('change', event => {
  const params = new URLSearchParams({ theme: state.theme });
  if (event.target.value !== 'normal') params.set(event.target.value, '');
  status.textContent = 'Loading sample mail…';
  frame.src = `../../ui-workspace/?${params}`;
});
frame.addEventListener('load', initialize);
// Handles cached iframe loading before the module finishes evaluating.
if (frame.contentDocument?.readyState === 'complete') void initialize();
