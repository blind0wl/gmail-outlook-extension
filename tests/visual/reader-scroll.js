// Production popup with synthetic account/message boundaries only.
await import('./popup-fixture.js');
document.title = 'Reader scrolling smoke test — synthetic mail';
const originalSend = chrome.runtime.sendMessage;
const content = '<h1>Reader scrolling check</h1><p>Synthetic email. No real account or mailbox writes.</p>'
  + Array.from({ length: 32 }, (_, index) => '<h2>Section ' + (index + 1)
    + '</h2><p>Keep scrolling while the cached inbox and account status update. '
    + 'The formatted reader should stay in place and remain responsive.</p>').join('')
  + '<p><strong>End of message — all 32 sections reached.</strong></p>';
chrome.runtime.sendMessage = async (message, ...args) => message.type === 'message-body'
  ? { ok: true, contentType: 'html', content }
  : originalSend(message, ...args);
let updates = 0;
globalThis.readerSmoke = {
  refresh() {
    updates++;
    popupFixture.change({
      mailCache: { newValue: structuredClone(popupFixture.data.mailCache) },
      accountState: { newValue: { 'gmail:work@example.com': { checkedAt: Date.now() } } },
      mailActions: { newValue: {} },
    });
  },
  get updates() { return updates; },
  get readWrites() { return popupFixture.messages.filter(message => message.type === 'mail-action' && message.action === 'read').length; },
};
