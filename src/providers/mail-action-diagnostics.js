// Local, bounded protocol outcomes only. Never persist mail or provider replies.
export const MAIL_ACTION_DIAGNOSTICS_KEY = 'mailActionDiagnostics';
const LIMIT = 20;
let tail = Promise.resolve();

function safeEvent(event) {
  if (!event || event.event !== 'gmail-mail-action'
    || event.entryPoint !== 'popup-mail-action'
    || !/^[a-f0-9-]{36}$/i.test(event.requestId ?? '')
    || !['read', 'trash', 'undo'].includes(event.action)
    || !Number.isInteger(event.slot) || event.slot < 0 || event.slot > 9
    || !['acknowledged', 'uncertain', 'rejected'].includes(event.outcome)
    || !['acknowledged', 'sign-in-challenge', 'unrecognized', 'unreadable', 'request-failed'].includes(event.response)) return null;
  return {
    event: 'gmail-mail-action', entryPoint: 'popup-mail-action',
    requestId: event.requestId, action: event.action, slot: event.slot,
    outcome: event.outcome, response: event.response,
    ...(Number.isInteger(event.status) && event.status >= 100 && event.status <= 599 ? { status: event.status } : {}),
    unreadInboxAbsent: event.unreadInboxAbsent === true,
    at: Number.isFinite(event.at) ? event.at : Date.now(),
  };
}

export async function recordMailActionDiagnostic(event) {
  const safe = safeEvent(event);
  const store = globalThis.chrome?.storage?.local;
  if (!safe || !store?.get || !store?.set) return;
  // Serialize read/append/write so simultaneous outcomes cannot lose records.
  const run = tail.then(async () => {
    const data = await store.get(MAIL_ACTION_DIAGNOSTICS_KEY);
    const history = Array.isArray(data?.[MAIL_ACTION_DIAGNOSTICS_KEY])
      ? data[MAIL_ACTION_DIAGNOSTICS_KEY].slice(-LIMIT).map(safeEvent).filter(Boolean) : [];
    await store.set({ [MAIL_ACTION_DIAGNOSTICS_KEY]: [...history, safe].slice(-LIMIT) });
  });
  // Storage errors must never change an action's result or replay its POST.
  tail = run.catch(() => {});
  await tail;
}
