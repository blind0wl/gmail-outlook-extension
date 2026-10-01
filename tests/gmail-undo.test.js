import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGmailUndoAppInfo, buildGmailUndoRequest } from '../src/providers/gmail-undo.js';

function bootstrap(overrides = {}) {
  const globals = Array(10).fill(null);
  globals[2] = 123456; globals[3] = 'gmail.main.20261001'; globals[9] = 'synthetic-key';
  Object.entries(overrides).forEach(([i, value]) => globals[i] = value);
  return 'var GLOBALS=' + JSON.stringify(globals) + ';';
}

test('Undo metadata comes from bounded JSON bootstrap and matches the owning session key', () => {
  const info = JSON.parse(parseGmailUndoAppInfo(bootstrap(), 'synthetic-key'));
  assert.equal(info[4], 'synthetic-key');
  assert.equal(info[7], 'gmail.main.20261001');
  assert.equal(info[15], 123456);
  assert.equal(info[6], 25);
  assert.equal(info[8], 1); assert.equal(info[9], 4);
  assert.equal(info[2][9], 1);
  assert.ok(!info[17], 'no device identifier');
  assert.ok(!info[11] && !info[12], 'no captured trace fields');
  assert.equal(parseGmailUndoAppInfo(bootstrap(), 'different-key'), null);
  for (const html of ['var GLOBALS=doSomething();', bootstrap({ 2: -1 }), bootstrap({ 3: {} }), bootstrap({ 9: [] }), bootstrap() + bootstrap(), ' '.repeat(2 * 1024 * 1024 + 1)]) {
    assert.equal(parseGmailUndoAppInfo(html, 'synthetic-key'), null);
  }
  assert.equal(parseGmailUndoAppInfo(bootstrap({ 3: 'gmail.main.quote"[value]' }), 'synthetic-key'), null);
});

test('Undo targets every exact member with precision-safe IDs and only Inbox restore labels', () => {
  const request = buildGmailUndoRequest('https://mail.google.com/mail/u/2/', 'ffffffffffffffff', ['fffffffffffffffe', 'aa01'], 'synthetic-token', 'synthetic-app-info');
  assert.match(request.url, /\/sync\/u\/2\/i\/s\?/);
  assert.equal(request.options.credentials, 'include');
  assert.equal(request.options.headers['X-Framework-Xsrf-Token'], 'synthetic-token');
  assert.equal(request.options.headers['X-Gmail-BTAI'], 'synthetic-app-info');
  const body = JSON.parse(request.options.body);
  assert.equal(body[1][0][0][1][0], 'thread-f:18446744073709551615');
  const labels = body[1][0][0][1][1][6];
  assert.deepEqual(labels[0], ['^i']);
  assert.deepEqual(labels[1], ['^a', '^t_z', '^us', '^k', '^s']);
  assert.deepEqual(labels[2], ['msg-f:18446744073709551614', 'msg-f:43521']);
  assert.ok(!labels[1].includes('^u'), 'restore preserves unread status');
  assert.ok(!request.url.includes('/h/'), 'retired HTML endpoint is not used');
});
