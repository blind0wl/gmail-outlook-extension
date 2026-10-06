import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { parseGmailMessageBody, readGmailMessageBody } from '../src/providers/gmail-conversation-state.js';
import { fetchOutlookMessageBody } from '../src/providers/outlook.js';
import { messageBodyText } from '../src/popup/message-body.js';
import { handleMessageBody, handleMessage, ready } from '../src/background/service-worker.js';
import { mergeMessages } from '../src/store/cache.js';

function reply() {
  const summary = ['cs', 'abc', 'aa02', 2, null, null, null, null, ['aa01', 'aa02']];
  const member = (id, content) => {
    const row = Array(14).fill(null);
    row[0] = 'ms'; row[1] = id; row[8] = 'Short preview'; row[9] = ['^i', '^u'];
    row[13] = [null, null, null, null, null, null, content];
    return row;
  };
  return [[summary, member('aa01', '<p>Earlier message</p>'), member('aa02', '<p>Complete message ending</p>')], 'trailer'];
}

test('Gmail bodies select the exact member or latest conversation member, and reject incomplete previews', () => {
  const data = reply();
  assert.equal(parseGmailMessageBody(JSON.stringify(data), 'aa01').content, '<p>Earlier message</p>');
  assert.equal(parseGmailMessageBody(JSON.stringify(data), 'abc').content, '<p>Complete message ending</p>');
  assert.equal(parseGmailMessageBody(JSON.stringify(data), 'ffff').recognized, false);
  data[0][2][13] = null;
  assert.equal(parseGmailMessageBody(JSON.stringify(data), 'aa02').recognized, false);
  data[0].pop();
  assert.equal(parseGmailMessageBody(JSON.stringify(data), 'aa01').recognized, false);
});

test('Gmail body GET checks account ownership again before returning content', async () => {
  const original = globalThis.fetch;
  const seen = [];
  let account = 'owner@example.test';
  globalThis.fetch = async (url, options) => {
    seen.push(url);
    assert.equal(options.credentials, 'include');
    assert.equal(options.redirect, 'error');
    assert.equal(options.method, undefined, 'only GET requests');
    return { ok: true, text: async () => url.includes('feed/atom')
      ? `<feed><title>Gmail - Inbox for ${account}</title><fullcount>0</fullcount></feed>` : JSON.stringify(reply()) };
  };
  try {
    const session = { base: 'https://mail.google.com/mail/u/2/', key: 'synthetic-key' };
    assert.equal((await readGmailMessageBody(account, session, 'aa02')).content, '<p>Complete message ending</p>');
    assert.equal(new URL(seen[0]).searchParams.get('mb'), '0');
    account = 'different@example.test';
    assert.equal(await readGmailMessageBody('owner@example.test', session, 'aa02'), null);
  } finally { globalThis.fetch = original; }
});

test('Outlook loads the complete body and refuses redirects outside Graph', async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, options) => {
    calls++;
    assert.equal(new URL(url).origin, 'https://graph.microsoft.com');
    assert.equal(new URL(url).searchParams.get('$select'), 'body');
    assert.equal(options.headers.Authorization, 'Bearer synthetic-token');
    return { ok: true, status: 200, json: async () => ({ body: { contentType: 'Text', content: 'Start\nEnd beyond preview' } }) };
  };
  try {
    assert.deepEqual(await fetchOutlookMessageBody('synthetic-token', 'a/b'), { contentType: 'text', content: 'Start\nEnd beyond preview' });
    globalThis.fetch = async () => { calls++; return { status: 302, headers: { get: () => 'https://example.test/steal' } }; };
    await assert.rejects(fetchOutlookMessageBody('synthetic-token', 'one'));
    assert.equal(calls, 2, 'cross-origin redirect is never requested');
    globalThis.fetch = async () => ({ ok: true, json: async () => ({ bodyPreview: 'Not full' }) });
    await assert.rejects(fetchOutlookMessageBody('synthetic-token', 'one'));
  } finally { globalThis.fetch = original; }
});

test('HTML bodies become inert readable text with paragraphs, line breaks and tables', () => {
  const { document } = parseHTML('<html><body></body></html>');
  assert.equal(messageBodyText('<style>hide</style><p>Hello &amp; welcome</p><div>Next<br>Last</div><table><tr><td>A</td><td>B</td></tr></table><script>evil()</script><iframe src="https://example.test"></iframe>', 'html', document), 'Hello & welcome\n\nNext\nLast\n\nA\tB');
  assert.equal(messageBodyText('Plain\n\ntext <literal>', 'text', document), 'Plain\n\ntext <literal>');
  assert.equal(document.body.childNodes.length, 0);
});

function workerFixture() {
  const acct = { provider: 'gmail', account: 'body@example.test' };
  const item = { ...acct, key: 'gmail:body%40example.test:aa01', date: Date.now(), unread: true, snippet: 'Preview' };
  const data = { accounts: [acct] };
  globalThis.chrome = { storage: { local: { get: async key => ({ [key]: data[key] }), set: async patch => Object.assign(data, patch) } } };
  mergeMessages([item]);
  return { acct, item, data };
}

test('worker accepts only cached targets from enabled configured accounts and sanitizes failures', async () => {
  await ready;
  const { acct, item, data } = workerFixture();
  let calls = 0;
  const deps = { readBody: async (account, id) => { calls++; assert.equal(account.account, acct.account); assert.equal(account.provider, acct.provider); assert.equal(id, 'aa01'); return { content: 'Whole message', contentType: 'text' }; } };
  assert.deepEqual(await handleMessage({ type: 'message-body', key: item.key }, deps), { ok: true, content: 'Whole message', contentType: 'text' });
  assert.equal((await handleMessageBody({ key: 'gmail:foreign%40example.test:aa01' }, deps)).ok, false);
  data.accounts = [{ ...acct, enabled: false }];
  assert.equal((await handleMessageBody({ key: item.key }, deps)).ok, false);
  assert.equal(calls, 1);
  data.accounts = [acct];
  assert.deepEqual(await handleMessageBody({ key: item.key }, { readBody: async () => { throw Error('private mail and credentials'); } }), { ok: false, code: 'unavailable' });
});

test('worker discards an in-flight body when the account is signed out', async () => {
  const { acct, item } = workerFixture();
  let finish;
  const pending = handleMessageBody({ key: item.key }, { readBody: () => new Promise(resolve => { finish = resolve; }) });
  await new Promise(resolve => setTimeout(resolve, 0));
  await handleMessage({ type: 'sign-out', ...acct });
  finish({ content: 'Must not return', contentType: 'text' });
  assert.deepEqual(await pending, { ok: false, code: 'sign-in' });
});
