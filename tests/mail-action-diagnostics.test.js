import test from 'node:test';
import assert from 'node:assert/strict';
import { recordMailActionDiagnostic, MAIL_ACTION_DIAGNOSTICS_KEY } from '../src/providers/mail-action-diagnostics.js';

const event = (i = 0) => ({
  event: 'gmail-mail-action', entryPoint: 'popup-mail-action',
  requestId: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
  action: 'trash', slot: 1, outcome: 'uncertain', status: 200,
  response: 'unrecognized', unreadInboxAbsent: true,
});

test('saved diagnostics retain the newest 20 concurrent outcomes and exclude extra fields', async () => {
  const previous = globalThis.chrome;
  let data = { [MAIL_ACTION_DIAGNOSTICS_KEY]: [{ ...event(), account: 'private@example.com', body: 'secret' }] };
  globalThis.chrome = { storage: { local: {
    get: async () => structuredClone(data),
    set: async value => { data = structuredClone(value); },
  } } };
  try {
    await Promise.all(Array.from({ length: 25 }, (_, i) => recordMailActionDiagnostic({ ...event(i), csrf: 'secret', subject: 'private mail' })));
    const saved = data[MAIL_ACTION_DIAGNOSTICS_KEY];
    assert.equal(saved.length, 20);
    assert.deepEqual(saved.map(e => e.requestId), Array.from({ length: 20 }, (_, i) => event(i + 5).requestId));
    assert.ok(saved.every(e => Number.isFinite(e.at)));
    assert.ok(!JSON.stringify(saved).includes('secret'));
    assert.ok(!JSON.stringify(saved).includes('private'));
    assert.equal(saved[19].response, 'unrecognized');
  } finally { globalThis.chrome = previous; }
});

test('diagnostics tolerate missing or failed storage without rejecting', async () => {
  const previous = globalThis.chrome;
  try {
    globalThis.chrome = undefined;
    await recordMailActionDiagnostic(event());
    globalThis.chrome = { storage: { local: { get: async () => { throw Error('private failure'); } } } };
    await recordMailActionDiagnostic(event());
    globalThis.chrome = { storage: { local: { get: async () => ({}), set: async () => { throw Error('quota'); } } } };
    await recordMailActionDiagnostic(event());
  } finally { globalThis.chrome = previous; }
});

test('saved diagnostics sanitize existing records and survive a fresh module instance', async () => {
  const previous = globalThis.chrome;
  let data = { [MAIL_ACTION_DIAGNOSTICS_KEY]: [{ ...event(), requestId: 'private-session-token', response: 'private raw response', url: 'private' }, { ...event(1), body: 'secret' }] };
  globalThis.chrome = { storage: { local: {
    get: async () => structuredClone(data), set: async value => { data = structuredClone(value); },
  } } };
  try {
    const fresh = await import('../src/providers/mail-action-diagnostics.js?restart');
    await fresh.recordMailActionDiagnostic(event(2));
    const saved = data[MAIL_ACTION_DIAGNOSTICS_KEY];
    assert.equal(saved.length, 2);
    assert.equal(saved[0].requestId, event(1).requestId);
    assert.ok(!JSON.stringify(saved).includes('secret'));
    assert.ok(!JSON.stringify(saved).includes('private'));
  } finally { globalThis.chrome = previous; }
});
