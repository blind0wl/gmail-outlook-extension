import test from 'node:test';
import assert from 'node:assert/strict';
import { mutateGmailConversation } from '../src/providers/mail-actions.js';

function exact(labels, missing = false) {
  const cs = Array(9).fill(null); cs[0] = 'cs'; cs[1] = 'abcdef'; cs[3] = 2; cs[8] = ['aa01', 'aa02'];
  const ms = labels.map((labels, i) => { const row = Array(10).fill(null); row[0] = 'ms'; row[1] = cs[8][i]; row[9] = labels; return row; });
  if (missing) ms.pop();
  return JSON.stringify([[cs, ...ms], 'synthetic-trailer']);
}

for (const scenario of ['success', 'member-target', 'missing-member', 'mixed-before', 'bad-token', 'changed-owner', 'revoked', 'lost-response', 'mixed-after', 'already-restored', 'delayed-state', 'last-attempt-state']) {
  test(`modern Gmail Undo: ${scenario}`, async () => {
    const originalFetch = globalThis.fetch, originalChrome = globalThis.chrome;
    globalThis.chrome = { cookies: { get: async () => ({ value: 'synthetic-cookie' }) } };
    let mailboxPosts = 0, tokenPosts = 0, stateReads = 0, revoked = false;
    const globals = Array(10).fill(null); globals[2] = 123456; globals[3] = 'gmail.main.20261001'; globals[9] = 'synthetic-key';
    globalThis.fetch = async (url, options = {}) => {
      if (url.includes('/sync/') && url.includes('/token?')) {
        tokenPosts++;
        return { ok: true, status: 200, text: async () => scenario === 'bad-token' ? '<html>private</html>' : 'synthetic-framework-token-12345678' };
      }
      if (options.method === 'POST') {
        mailboxPosts++;
        assert.match(url, /\/sync\/u\/0\/i\/s\?/);
        assert.equal(options.headers['X-Framework-Xsrf-Token'], 'synthetic-framework-token-12345678');
        const payload = JSON.parse(options.body);
        assert.equal(payload[1][0][0][1][0], 'thread-f:11259375');
        assert.deepEqual(payload[1][0][0][1][1][6][2], ['msg-f:43521', 'msg-f:43522']);
        if (scenario === 'lost-response') throw Error('private transport error');
        return { ok: true, status: 200, text: async () => 'unrecognized' };
      }
      if (new URL(url).searchParams.get('view') === 'cv') {
        stateReads++; revoked = scenario === 'revoked';
        return { ok: true, text: async () => exact((mailboxPosts && !(['delayed-state', 'last-attempt-state'].includes(scenario) && stateReads <= (scenario === 'last-attempt-state' ? 3 : 2))) || scenario === 'already-restored'
          ? [['^i', '^u'], scenario === 'mixed-after' ? ['^k'] : ['^i']]
          : [['^k', '^u'], scenario === 'mixed-before' ? [] : ['^k']], scenario === 'missing-member') };
      }
      return { ok: true, text: async () => url.endsWith('/feed/atom')
        ? `<feed><title>Gmail - Inbox for ${stateReads && scenario === 'changed-owner' ? 'other@example.test' : 'owner@example.test'}</title><fullcount>0</fullcount></feed>`
        : `GM_ID_KEY="synthetic-key";var GLOBALS=${JSON.stringify(globals)};` };
    };
    try {
      const promise = mutateGmailConversation('owner@example.test', scenario === 'member-target' ? 'aa02' : 'abcdef', 'undo', () => { if (revoked) throw Error('superseded'); });
      if (['success', 'member-target', 'lost-response', 'already-restored', 'delayed-state', 'last-attempt-state'].includes(scenario)) assert.deepEqual(await promise, { id: scenario === 'member-target' ? 'aa02' : 'abcdef' });
      else await assert.rejects(promise);
      const wrote = ['success', 'member-target', 'lost-response', 'mixed-after', 'delayed-state', 'last-attempt-state'].includes(scenario);
      assert.equal(mailboxPosts, wrote ? 1 : 0, 'only one scoped mailbox write; invalid prerequisites stop before writing');
      if (scenario === 'mixed-after') assert.equal(stateReads,4,'preflight plus three bounded confirmation reads');
      assert.equal(tokenPosts, wrote || scenario === 'bad-token' ? 1 : 0);
    } finally { globalThis.fetch = originalFetch; globalThis.chrome = originalChrome; }
  });
}
