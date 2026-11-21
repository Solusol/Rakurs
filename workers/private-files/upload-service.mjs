import {createQuotaLedger} from './quota-ledger.mjs';
const MAX_BUFFER = 8 * 1024 * 1024;
function fail(code) { const error = new Error(code); error.code = code; throw error; }
async function readBounded(stream, maximum) {
  if (!stream || typeof stream.getReader !== 'function') fail('BODY_REQUIRED');
  const reader = stream.getReader(), chunks = [], deadline = Date.now() + 10000;
  let size = 0;
  try {
    for (;;) {
      const remaining = deadline - Date.now();
      if (remaining <= 0) fail('BODY_TIMEOUT');
      let timer;
      const part = await Promise.race([
        reader.read(),
        new Promise((_, reject) => { timer = setTimeout(() => { const error = new Error('BODY_TIMEOUT'); error.code = 'BODY_TIMEOUT'; reject(error); }, remaining); })
      ]).finally(() => clearTimeout(timer));
      if (part.done) break;
      if (!(part.value instanceof Uint8Array)) fail('BYTE_STREAM_REQUIRED');
      if (part.value.byteLength > maximum - size) fail('BODY_TOO_LARGE');
      chunks.push(part.value.slice());
      size += part.value.byteLength;
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
    return bytes;
  } catch (error) {
    try { Promise.resolve(reader.cancel(error)).catch(() => {}); } catch {}
    throw error;
  } finally { reader.releaseLock(); }
}
async function sha256(bytes) {
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('');
}
export function createUploadService(storage, bucket, limits) {
  const ledger = createQuotaLedger(storage, limits);
  if (limits.fileBytes > MAX_BUFFER || !bucket || typeof bucket.put !== 'function' || typeof bucket.get !== 'function') fail('INVALID_UPLOAD_CONFIGURATION');
  return Object.freeze({
    async upload(input, body) {
      const record = await ledger.reserve(input);
      const bytes = await readBounded(body, record.bytes);
      if (bytes.byteLength !== record.bytes || await sha256(bytes) !== record.sha256) fail('INTEGRITY_MISMATCH');
      const key = 'v1/' + record.userId + '/' + record.projectId + '/' + record.id;
      await bucket.put(key, bytes, {
        onlyIf: new Headers({'If-None-Match': '*'}),
        sha256: record.sha256,
        httpMetadata: {contentType: 'application/octet-stream', cacheControl: 'private, no-store'},
        customMetadata: {owner: record.userId, project: record.projectId, sha256: record.sha256}
      });
      // Conditional failure may mean an earlier attempt already wrote this key.
      // In all cases verify actual stored bytes before confirming the reservation.
      const object = await bucket.get(key);
      if (!object || !object.body || object.size !== record.bytes) fail('STORED_OBJECT_MISMATCH');
      const stored = await readBounded(object.body, record.bytes);
      const digest = await sha256(stored);
      if (stored.byteLength !== record.bytes || digest !== record.sha256) fail('STORED_OBJECT_MISMATCH');
      return ledger.confirm(record, {bytes: stored.byteLength, sha256: digest});
    }
  });
}
