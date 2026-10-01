import test from 'node:test';
import assert from 'node:assert/strict';
import { mutateGmailConversation } from '../src/providers/mail-actions.js';

function exactReply(labels, { missing = false, target = 'abcdef' } = {}) {
  const cs = Array(9).fill(null);
  cs[0] = 'cs'; cs[1] = target; cs[3] = labels.length;
  cs[8] = labels.map((_, i) => 'aa0' + i);
  const members = labels.map((labels, i) => {
    const row = Array(10).fill(null);
    row[0] = 'ms'; row[1] = 'aa0' + i; row[9] = labels;
    row[4] = 'Private mail';
    return row;
  });
  if (missing) members.pop();
  return JSON.stringify([[cs, ...members], 'private-trailer']);
}

test('an unrecognized Gmail Trash reply uses complete exact state without repeating the write', async () => {
  const originalFetch = globalThis.fetch, originalChrome = globalThis.chrome;
  globalThis.chrome = { cookies: { get: async () => ({ value: 'private-token' }) } };
  try {
    for (const scenario of ['complete', 'mixed-inbox', 'mixed-archive', 'missing-member', 'wrong-target', 'account-changed', 'offline']) {
      let posts = 0, stateQueries = 0;
      globalThis.fetch = async (url, options) => {
        if (options.method === 'POST') { posts++; return { ok: true, status: 200, text: async () => '[null,[],1]' }; }
        if (new URL(url).searchParams.get('view') === 'cv') {
          stateQueries++;
          if (scenario === 'offline') throw Error('private failure');
          const labels = [['^k'], scenario === 'mixed-inbox' ? ['^i', '^u'] : scenario === 'mixed-archive' ? [] : ['^k']];
          return { ok: true, text: async () => exactReply(labels, {
            missing: scenario === 'missing-member', target: scenario === 'wrong-target' ? 'fff123' : 'abcdef',
          }) };
        }
        const account = stateQueries && scenario === 'account-changed' ? 'other@example.test' : 'owner@example.test';
        return { ok: true, text: async () => url.endsWith('/feed/atom')
          ? `<feed><title>Gmail - Inbox for ${account}</title><fullcount>0</fullcount></feed>` : 'GM_ID_KEY="private-key"' };
      };
      if (scenario === 'complete') assert.deepEqual(await mutateGmailConversation('owner@example.test', 'abcdef', 'trash'), { id: 'abcdef' });
      else await assert.rejects(mutateGmailConversation('owner@example.test', 'abcdef', 'trash'), error => error.uncertain === true);
      assert.equal(posts, 1, 'verification never replays the mutation');
      assert.equal(stateQueries, 1, 'only one exact-state attempt is made');
    }
  } finally { globalThis.fetch = originalFetch; globalThis.chrome = originalChrome; }
});

test('read and Undo confirmation require every message to have the intended state', async () => {
  const originalFetch = globalThis.fetch, originalChrome = globalThis.chrome;
  globalThis.chrome = { cookies: { get: async () => ({ value: 'private-token' }) } };
  try {
    for (const action of ['read', 'undo']) for (const complete of [true, false]) {
      let posts = 0;
      globalThis.fetch = async (url, options) => {
        if (options.method === 'POST') { posts++; return { ok: true, status: 200, text: async () => '[null,[],1]' }; }
        if (new URL(url).searchParams.get('view') === 'cv') return { ok: true, text: async () => exactReply([
          ['^i'], complete ? ['^i'] : action === 'read' ? ['^i', '^u'] : ['^k'],
        ]) };
        return { ok: true, text: async () => url.endsWith('/feed/atom')
          ? '<feed><title>Gmail - Inbox for owner@example.test</title><fullcount>0</fullcount></feed>' : 'GM_ID_KEY="private-key"' };
      };
      if (complete) assert.deepEqual(await mutateGmailConversation('owner@example.test', 'abcdef', action), { id: 'abcdef' });
      else await assert.rejects(mutateGmailConversation('owner@example.test', 'abcdef', action), error => error.uncertain === true);
      assert.equal(posts, 1);
    }
  } finally { globalThis.fetch = originalFetch; globalThis.chrome = originalChrome; }
});

test('worker authorization is rechecked after exact-state verification', async () => {
  const originalFetch = globalThis.fetch, originalChrome = globalThis.chrome;
  globalThis.chrome = { cookies: { get: async () => ({ value: 'private-token' }) } };
  let signedOut = false;
  globalThis.fetch = async (url, options) => {
    if (options.method === 'POST') return { ok: true, status: 200, text: async () => '[null,[],1]' };
    if (new URL(url).searchParams.get('view') === 'cv') {
      signedOut = true;
      return { ok: true, text: async () => exactReply([['^k']]) };
    }
    return { ok: true, text: async () => url.endsWith('/feed/atom')
      ? '<feed><title>Gmail - Inbox for owner@example.test</title></feed>' : 'GM_ID_KEY="private-key"' };
  };
  try {
    await assert.rejects(mutateGmailConversation('owner@example.test', 'abcdef', 'trash', () => {
      if (signedOut) throw Error('superseded');
    }));
    assert.equal(signedOut, true);
  } finally { globalThis.fetch = originalFetch; globalThis.chrome = originalChrome; }
});

test('legacy ar text cannot bypass incomplete or contradictory exact state', async () => {
  const originalFetch = globalThis.fetch, originalChrome = globalThis.chrome;
  globalThis.chrome = { cookies: { get: async () => ({ value: 'synthetic-token' }) } };
  try {
    for (const mutationReply of [
      '<html><script>["ar",1,"synthetic"]</script></html>',
      JSON.stringify([['mail', ['ar', 1, 'synthetic']]]),
      '["ar",1,"synthetic"]',
    ]) for (const stateReply of [exactReply([['^k'], ['^i']]), exactReply([['^k'], ['^k']], { missing: true })]) {
      let posts = 0;
      globalThis.fetch = async (url, options = {}) => {
        if (options.method === 'POST') { posts++; return { ok: true, status: 200, text: async () => mutationReply }; }
        if (new URL(url).searchParams.get('view') === 'cv') return { ok: true, text: async () => stateReply };
        return { ok: true, text: async () => url.endsWith('/feed/atom')
          ? '<feed><title>Gmail - Inbox for owner@example.test</title><fullcount>0</fullcount></feed>'
          : 'GM_ID_KEY="synthetic-key"' };
      };
      await assert.rejects(mutateGmailConversation('owner@example.test', 'abcdef', 'trash'),
        error => error.uncertain === true, 'ar text cannot establish a completed conversation move');
      assert.equal(posts, 1, 'uncertain acknowledgement never replays the mutation');
    }
  } finally { globalThis.fetch = originalFetch; globalThis.chrome = originalChrome; }
});

test('legacy ar text cannot bypass changed ownership after exact Trash state', async () => {
  const originalFetch = globalThis.fetch, originalChrome = globalThis.chrome;
  globalThis.chrome = { cookies: { get: async () => ({ value: 'synthetic-token' }) } };
  let posts = 0, queried = false;
  globalThis.fetch = async (url, options = {}) => {
    if (options.method === 'POST') { posts++; return { ok: true, status: 200, text: async () => '["ar",1,"synthetic"]' }; }
    if (new URL(url).searchParams.get('view') === 'cv') {
      queried = true;
      return { ok: true, text: async () => exactReply([['^k']]) };
    }
    return { ok: true, text: async () => url.endsWith('/feed/atom')
      ? `<feed><title>Gmail - Inbox for ${queried ? 'other@example.test' : 'owner@example.test'}</title><fullcount>0</fullcount></feed>`
      : 'GM_ID_KEY="synthetic-key"' };
  };
  try {
    await assert.rejects(mutateGmailConversation('owner@example.test', 'abcdef', 'trash'),
      error => error.uncertain === true, 'state from a changed browser account cannot confirm the action');
    assert.equal(posts, 1);
    assert.equal(queried, true);
  } finally { globalThis.fetch = originalFetch; globalThis.chrome = originalChrome; }
});

for (const failure of ['transport', 'http-500', 'unreadable']) {
  test(`Gmail ${failure} mutation reply reconciles exact state without replay`, async () => {
    const originalFetch = globalThis.fetch, originalChrome = globalThis.chrome;
    globalThis.chrome = { cookies: { get: async () => ({ value: 'synthetic-token' }) } };
    try {
      for (const outcome of ['confirmed', 'contradictory', 'unavailable']) {
        let posts = 0, stateQueries = 0;
        globalThis.fetch = async (url, options = {}) => {
          if (options.method === 'POST') {
            posts++;
            if (failure === 'transport') throw Error('synthetic transport failure');
            if (failure === 'http-500') return { ok: false, status: 500 };
            return { ok: true, status: 200, text: async () => { throw Error('synthetic body failure'); } };
          }
          if (new URL(url).searchParams.get('view') === 'cv') {
            stateQueries++;
            if (outcome === 'unavailable') throw Error('synthetic state unavailable');
            return { ok: true, text: async () => exactReply([['^k'], outcome === 'confirmed' ? ['^k'] : ['^i']]) };
          }
          return { ok: true, text: async () => url.endsWith('/feed/atom')
            ? '<feed><title>Gmail - Inbox for owner@example.test</title><fullcount>0</fullcount></feed>'
            : 'GM_ID_KEY="synthetic-key"' };
        };
        if (outcome === 'confirmed') {
          assert.deepEqual(await mutateGmailConversation('owner@example.test', 'abcdef', 'trash'), { id: 'abcdef' });
        } else {
          await assert.rejects(mutateGmailConversation('owner@example.test', 'abcdef', 'trash'),
            error => error.uncertain === true && !error.message.includes('synthetic'));
        }
        assert.equal(posts, 1, 'lost or failed response never causes a mutation replay');
        assert.equal(stateQueries, 1, 'each uncertainty gets one exact-state check');
      }
    } finally { globalThis.fetch = originalFetch; globalThis.chrome = originalChrome; }
  });
}
