// Exact private-session conversation reads for mailbox confirmation and bodies.
// State verification exposes only complete member IDs and labels.
import { decodeGmailReply } from './gmail-reply.js';
import { parseFeed } from './gmail.js';

const validId = id => typeof id === 'string' && /^[a-f0-9]+$/i.test(id);
const unknown = () => ({ recognized: false });

function parseExactConversation(text, id) {
  if (!validId(id)) return unknown();
  const decoded = decodeGmailReply(text);
  if (decoded.issue || decoded.payloads.length !== 1) return unknown();
  const payload = decoded.payloads[0];
  if (!Array.isArray(payload) || payload.length !== 2 || typeof payload[1] !== 'string'
    || !Array.isArray(payload[0]) || payload[0].some(row => !Array.isArray(row))) return unknown();
  const summaries = payload[0].filter(row => row[0] === 'cs');
  const members = payload[0].filter(row => row[0] === 'ms');
  if (summaries.length !== 1) return unknown();
  const summary = summaries[0];
  const count = summary[3], ids = summary[8];
  if (!validId(summary[1])
    || !Number.isInteger(count) || count < 1 || count > 1000
    || !Array.isArray(ids) || ids.length !== count || !ids.every(validId)
    || members.length !== count) return unknown();
  const expected = new Set(ids.map(id => id.toLowerCase()));
  if (expected.size !== count) return unknown();
  // Atom targets can be member IDs in multi-message conversations. Require
  // the requested target to name this conversation or one of its members.
  if (summary[1].toLowerCase() !== id.toLowerCase() && !expected.has(id.toLowerCase())) return unknown();
  const seen = new Set();
  for (const member of members) {
    if (!validId(member[1]) || !Array.isArray(member[9])
      || member[9].some(label => typeof label !== 'string')) return unknown();
    const memberId = member[1].toLowerCase();
    if (!expected.has(memberId) || seen.has(memberId)) return unknown();
    seen.add(memberId);
  }
  return {
    recognized: true, conversationId: summary[1].toLowerCase(), memberIds: [...seen], messages: count,
    allTrash: members.every(row => row[9].includes('^k') && !row[9].includes('^i')),
    allInbox: members.every(row => row[9].includes('^i') && !row[9].includes('^k')),
    allRead: members.every(row => !row[9].includes('^u')),
    allUnread: members.every(row => row[9].includes('^u')),
  };
}

export function parseGmailConversationState(text, id) {
  const { memberIds, conversationId, ...state } = parseExactConversation(text, id);
  return state;
}

async function read(url) {
  const response = await fetch(url, {
    credentials: 'include', cache: 'no-store', redirect: 'error',
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw Error('State unavailable');
  return response.text();
}

async function readConversation(account, session, id, parse) {
  if (!validId(id)) return null;
  try {
    // GmailJS documents the old exact-conversation format and cs/ms fields:
    // https://github.com/KartikTalwar/gmail.js/blob/2dd9644a7f0101714ac847320c162a721032ded4/src/gmail.js
    // The mb=0 query was checked against unchanged unread Atom membership in
    // the real test account. Unknown/truncated replies cannot confirm anything.
    const url = session.base + '?' + new URLSearchParams({
      ui: '2', ik: session.key, view: 'cv', th: id,
      msgs: '', mb: '0', rt: '1', search: 'all',
    });
    const state = parse(await read(url), id);
    if (!state.recognized) return null;
    const slot = Number(/\/u\/(\d+)\//.exec(session.base)[1]);
    const ownership = parseFeed(await read(session.base + 'feed/atom'), slot);
    if (ownership.account !== account.toLowerCase()) return null;
    return state;
  } catch {
    return null;
  }
}

export async function verifyGmailConversationState(account, session, id, action) {
  if (!['read', 'trash', 'undo', 'unread'].includes(action)) return false;
  const state = await readGmailConversationMembers(account, session, id);
  return !!state && (action === 'trash' ? state.allTrash : action === 'undo' ? state.allInbox : action === 'unread' ? state.allUnread : state.allRead);
}

export async function readGmailConversationMembers(account, session, id) {
  return readConversation(account, session, id, parseExactConversation);
}

export function parseGmailMessageBody(text, id) {
  if (!parseExactConversation(text, id).recognized) return unknown();
  const rows = decodeGmailReply(text).payloads[0][0];
  const members = rows.filter(row => row[0] === 'ms');
  // Atom entries usually identify a member; a conversation target uses the
  // summary's latest member. Never concatenate unrelated conversation mail.
  const latest = rows.find(row => row[0] === 'cs')[2];
  const member = members.find(row => row[1].toLowerCase() === id.toLowerCase())
    ?? members.find(row => row[1].toLowerCase() === String(latest).toLowerCase());
  const content = member?.[13]?.[6];
  // The short fallback at ms[8] can be only a preview, so do not claim it is full.
  if (typeof content !== 'string') return unknown();
  return { recognized: true, content, contentType: 'html' };
}

export async function readGmailMessageBody(account, session, id) {
  return readConversation(account, session, id, parseGmailMessageBody);
}
