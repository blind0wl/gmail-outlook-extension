// Shared persisted preference and strict submission contract; no Chrome APIs.
export const DEFAULT_POLL_MS = 60_000;
export const MIN_POLL_MS = 30_000;
export const MAX_POLL_MS = 5 * 3600 * 1000;
export const POLL_INTERVAL_KEY = 'pollIntervalMs';
const unitSeconds = {seconds:1,minutes:60,hours:3600};

export function normalizePollInterval(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_POLL_MS && value <= MAX_POLL_MS ? value : DEFAULT_POLL_MS;
}
export function validPollInterval(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= MIN_POLL_MS && value <= MAX_POLL_MS && value % 1000 === 0;
}

// Parse decimal input exactly so floating-point rounding cannot accept a
// subsecond draft as whole seconds. Native number fields can use exponents.
export function durationToMs(text, unit) {
  const multiplier = Object.hasOwn(unitSeconds,unit) ? unitSeconds[unit] : null;
  if (!multiplier || typeof text !== 'string' || text.length > 80) return null;
  const decimal = text.trim().replace(/^(\+?)\./, '$10.');
  const match = decimal.match(/^\+?(\d+)(?:\.(\d*))?(?:e([+-]?\d+))?$/i);
  if (!match) return null;
  const exponent = Number(match[3] || 0) - (match[2] || '').length;
  if (Math.abs(exponent) > 80) return null;
  let numerator = BigInt(match[1] + (match[2] || '')) * BigInt(multiplier);
  const denominator = exponent < 0 ? 10n ** BigInt(-exponent) : 1n;
  if (exponent > 0) numerator *= 10n ** BigInt(exponent);
  if (numerator % denominator) return null;
  const ms = Number(numerator / denominator) * 1000;
  return validPollInterval(ms) ? ms : null;
}

export function intervalDraft(ms) {
  // Seconds retain fractional legacy preferences instead of silently rewriting.
  if (ms % 3600000 === 0) return {value:String(ms/3600000),unit:'hours'};
  if (ms % 60000 === 0) return {value:String(ms/60000),unit:'minutes'};
  return {value:String(ms/1000),unit:'seconds'};
}
