import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGmailConversationState } from '../src/providers/gmail-conversation-state.js';

// Synthetic identifiers and label-only records, shaped like the observed
// exact-conversation response. No real mailbox content or identities.
const TARGET = 'abc123';
const MEMBERS = ['aa01', 'aa02'];
function summary(ids = MEMBERS, total = ids.length, target = TARGET) {
  const row = Array(9).fill(null);
  row[0] = 'cs'; row[1] = target; row[3] = total; row[8] = ids;
  return row;
}
function member(id, labels) {
  const row = Array(10).fill(null);
  row[0] = 'ms'; row[1] = id; row[9] = labels;
  return row;
}
const reply = records => JSON.stringify([records, 'synthetic-trailer']);
const state = (records, id = TARGET) => parseGmailConversationState(reply(records), id);
const expected = (allTrash, allInbox, allRead, messages = 2) =>
  ({ recognized: true, messages, allTrash, allInbox, allRead });
const frame = value => `${new TextEncoder().encode(value).length}&${value}`;

test('an older trashed message cannot confirm Trash while another member remains in Inbox', () => {
  assert.deepEqual(state([summary(), member('aa01', ['^k']), member('aa02', ['^i', '^u'])]),
    expected(false, false, false));
});

test('Trash plus Archive cannot confirm a conversation-wide Trash move', () => {
  assert.deepEqual(state([summary(), member('aa01', ['^k']), member('aa02', [])]),
    expected(false, false, true));
});

test('every member must be in Trash and outside Inbox to confirm Trash', () => {
  assert.deepEqual(state([summary(), member('aa02', ['^k']), member('aa01', ['^k', '^u'])]),
    expected(true, false, false));
  assert.deepEqual(state([summary(), member('aa01', ['^k', '^i']), member('aa02', ['^k'])]),
    expected(false, false, true));
});

test('Undo state requires every member in Inbox and outside Trash', () => {
  assert.deepEqual(state([summary(), member('aa01', ['^i']), member('aa02', ['^i'])]),
    expected(false, true, true));
  assert.deepEqual(state([summary(), member('aa01', ['^i', '^k']), member('aa02', ['^i'])]),
    expected(false, false, true));
});

test('read confirmation checks unread labels on every member', () => {
  assert.deepEqual(state([summary(), member('aa01', ['^i']), member('aa02', ['^i', '^u'])]),
    expected(false, true, false));
  assert.deepEqual(state([summary(), member('aa01', ['^i']), member('aa02', ['^i'])]),
    expected(false, true, true));
});

test('exact state recognizes one-member and complete length-framed responses', () => {
  const text = reply([summary(['aa01']), member('aa01', ['^k'])]);
  for (const input of [text, ")]}'\n" + text, frame(text), ")]}'\n" + frame(text)]) {
    assert.deepEqual(parseGmailConversationState(input, TARGET), expected(true, false, true, 1));
  }
});

test('missing, extra, duplicate or mismatched member records remain unknown', () => {
  const cases = [
    [summary(), member('aa01', ['^k'])],
    [summary(), member('aa01', ['^k']), member('aa01', ['^k'])],
    [summary(), member('aa01', ['^k']), member('aa03', ['^k'])],
    [summary(['aa01', 'aa01']), member('aa01', ['^k']), member('aa01', ['^k'])],
    [summary(), member('aa01', ['^k']), member('aa02', ['^k']), member('aa03', ['^k'])],
    [summary(MEMBERS, 3), member('aa01', ['^k']), member('aa02', ['^k'])],
    [summary(['aa01'], 2), member('aa01', ['^k']), member('aa02', ['^k'])],
    [summary(), summary(), member('aa01', ['^k']), member('aa02', ['^k'])],
    [summary(), summary(['aa03'], 1, 'fff123'), member('aa01', ['^k']), member('aa02', ['^k'])],
    [member('aa01', ['^k']), member('aa02', ['^k'])],
  ];
  for (const records of cases) assert.deepEqual(state(records), { recognized: false });
});

test('unvalidated target, count, identifiers and labels never establish state', () => {
  for (const total of [0, -1, 1.5, '2', null, 1001]) {
    assert.deepEqual(state([summary(MEMBERS, total), member('aa01', ['^k']), member('aa02', ['^k'])]),
      { recognized: false });
  }
  for (const id of ['', 'bad/id', null, 123]) {
    assert.deepEqual(state([summary(), member('aa01', ['^k']), member('aa02', ['^k'])], id),
      { recognized: false });
    assert.deepEqual(state([summary(['aa01', id]), member('aa01', ['^k']), member(id, ['^k'])]),
      { recognized: false });
  }
  for (const labels of [undefined, null, '^k', [null], ['^k', 1], {}]) {
    assert.deepEqual(state([summary(), member('aa01', ['^k']), member('aa02', labels)]),
      { recognized: false });
  }
  assert.deepEqual(state([summary([], 0)]), { recognized: false });
  assert.deepEqual(state([summary(MEMBERS, 2, 'fff123'), member('aa01', ['^k']), member('aa02', ['^k'])]),
    { recognized: false });
  for (const ids of [null, 'aa01', {}, ['aa01', null]]) {
    const cs = summary(); cs[8] = ids;
    assert.deepEqual(state([cs, member('aa01', ['^k']), member('aa02', ['^k'])]),
      { recognized: false });
  }
  assert.deepEqual(state([summary(), member('aa01', ['^k']), member('bad/id', ['^k'])]),
    { recognized: false });
});

test('mail fields cannot impersonate root conversation or member records', () => {
  const row = member('aa01', ['^k']);
  row[4] = [summary(['aa01']), member('aa01', ['^k']), ['ar', 1, TARGET]];
  assert.deepEqual(state([row]), { recognized: false });
  row[4] = JSON.stringify([summary(['aa01']), member('aa01', ['^k'])]);
  assert.deepEqual(state([row]), { recognized: false });
  assert.deepEqual(state([summary(['aa01']), row]), expected(true, false, true, 1));
});

test('unsupported, malformed, ambiguous and oversized replies fail closed', () => {
  const valid = reply([summary(['aa01']), member('aa01', ['^k'])]);
  const cases = [undefined, null, '', '<html>synthetic</html>', '{}', '[]',
    valid.slice(0, -1), valid + 'junk', frame(valid).slice(0, -1),
    frame(valid) + frame(valid), JSON.stringify([[summary(['aa01']), member('aa01', ['^k'])]]),
    ' '.repeat(2 * 1024 * 1024 + 1) + valid];
  for (const input of cases) assert.deepEqual(parseGmailConversationState(input, TARGET), { recognized: false });
});


test('a member target resolves its complete conversation without accepting unrelated targets', () => {
  const records = [summary(), member('aa01', ['^k', '^u']), member('aa02', ['^k'])];
  assert.deepEqual(state(records, 'AA02'), expected(true, false, false));
  assert.deepEqual(state(records, 'aa03'), { recognized: false });
  assert.deepEqual(state([summary(), member('aa01', ['^k'])], 'aa01'), { recognized: false });
});
