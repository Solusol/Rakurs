const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROJECT = /^[A-Za-z0-9_-]{1,128}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'audio/mpeg', 'audio/ogg', 'audio/wav', 'video/mp4', 'video/webm', 'application/pdf', 'text/plain']);
const FIELDS = ['id', 'userId', 'projectId', 'bytes', 'sha256', 'contentType'];
function fail(code) { const error = new Error(code); error.name = 'QuotaError'; error.code = code; throw error; }
function positive(value) { return Number.isSafeInteger(value) && value > 0; }
function counter(value) { if (value === undefined) return 0; if (!Number.isSafeInteger(value) || value < 0) fail('INVALID_COUNTER'); return value; }
function canonical(input) {
  if (!input || !UUID.test(input.id) || !UUID.test(input.userId) || !PROJECT.test(input.projectId) || !positive(input.bytes) || !SHA256.test(input.sha256) || !TYPES.has(input.contentType)) fail('INVALID_RESERVATION');
  return {id: input.id.toLowerCase(), userId: input.userId.toLowerCase(), projectId: input.projectId, bytes: input.bytes, sha256: input.sha256, contentType: input.contentType};
}

// Internal module. Storage must provide durable, serializable transactions.
// All accounts sharing a global quota MUST use the same coordinator/storage.
export function createQuotaLedger(storage, limits) {
  if (!storage || typeof storage.transaction !== 'function' || !limits) fail('INVALID_CONFIGURATION');
  const {globalBytes, userBytes, fileBytes} = limits;
  if (![globalBytes, userBytes, fileBytes].every(positive) || fileBytes > userBytes || userBytes > globalBytes) fail('INVALID_CONFIGURATION');
  return Object.freeze({
    async reserve(input) {
      const record = canonical(input);
      if (record.bytes > fileBytes) fail('FILE_LIMIT');
      return storage.transaction(async tx => {
        const previous = await tx.get('file:' + record.id);
        if (previous !== undefined) {
          if (!FIELDS.every(field => previous[field] === record[field])) fail('RESERVATION_CONFLICT');
          return structuredClone(previous);
        }
        const global = counter(await tx.get('total'));
        const user = counter(await tx.get('user:' + record.userId));
        if (record.bytes > globalBytes - global) fail('GLOBAL_LIMIT');
        if (record.bytes > userBytes - user) fail('USER_LIMIT');
        const next = {...record, state: 'reserved'};
        await tx.put('total', global + record.bytes);
        await tx.put('user:' + record.userId, user + record.bytes);
        await tx.put('file:' + record.id, next);
        return structuredClone(next);
      });
    },
    async confirm(input, verified) {
      const record = canonical(input);
      if (!verified || verified.bytes !== record.bytes || verified.sha256 !== record.sha256) fail('INTEGRITY_MISMATCH');
      return storage.transaction(async tx => {
        const previous = await tx.get('file:' + record.id);
        if (previous === undefined) fail('RESERVATION_MISSING');
        if (!FIELDS.every(field => previous[field] === record[field])) fail('RESERVATION_CONFLICT');
        if (previous.state !== 'reserved' && previous.state !== 'ready') fail('INVALID_STATE');
        if (previous.state === 'ready') return structuredClone(previous);
        const next = {...previous, state: 'ready'};
        await tx.put('file:' + record.id, next);
        return structuredClone(next);
      });
    }
  });
}
