import test from 'node:test';
import assert from 'node:assert/strict';
import {webcrypto} from 'node:crypto';
import {createUploadService} from './upload-service.mjs';
if (!globalThis.crypto) globalThis.crypto = webcrypto;
class Transactions {
  constructor(values = new Map()) { this.values = values; this.tail = Promise.resolve(); }
  transaction(fn) {
    const work = this.tail.then(async () => {
      const draft = structuredClone(this.values);
      const result = await fn({get: async key => draft.get(key), put: async (key, value) => { draft.set(key, structuredClone(value)); }});
      this.values = draft;
      return result;
    });
    this.tail = work.catch(() => {});
    return work;
  }
}
const data = new TextEncoder().encode('test');
const digest = '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08';
const record = {id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', userId: '11111111-1111-4111-8111-111111111111', projectId: 'p1', bytes: 4, sha256: digest, contentType: 'text/plain'};
const limits = {globalBytes: 20, userBytes: 12, fileBytes: 8};
const stream = bytes => new Response(bytes).body;
class Bucket {
  values = new Map(); puts = 0;
  async put(key, bytes, options) {
    this.puts++;
    assert.equal(options.onlyIf.get('If-None-Match'), '*');
    assert.equal(options.sha256, digest);
    if (this.values.has(key)) return null;
    this.values.set(key, bytes.slice());
    return {size: bytes.length};
  }
  async get(key) { const bytes = this.values.get(key); return bytes ? {size: bytes.length, body: stream(bytes)} : null; }
}
const setup = () => { const storage = new Transactions(), bucket = new Bucket(); return {storage, bucket, service: createUploadService(storage, bucket, limits)}; };
const rejection = (promise, code) => assert.rejects(promise, error => error.code === code);
test('upload confirms independently re-read bytes', async () => {
  const {service, storage, bucket} = setup();
  assert.equal((await service.upload(record, stream(data))).state, 'ready');
  assert.equal(storage.values.get('total'), 4);
  assert.equal(bucket.values.size, 1);
});
test('oversized input is cancelled before any R2 write', async () => {
  const {service, bucket} = setup(); let cancelled = false;
  const body = new ReadableStream({start(c) { c.enqueue(new Uint8Array(5)); }, cancel() { cancelled = true; }});
  await rejection(service.upload(record, body), 'BODY_TOO_LARGE');
  assert.equal(bucket.puts, 0); assert.equal(cancelled, true);
});
test('short input stays reserved and is not uploaded', async () => {
  const {service, bucket, storage} = setup();
  await rejection(service.upload(record, stream(new Uint8Array(3))), 'INTEGRITY_MISMATCH');
  assert.equal(bucket.puts, 0); assert.equal(storage.values.get('total'), 4);
});
test('wrong checksum is rejected before R2 write', async () => {
  const {service, bucket} = setup();
  await rejection(service.upload(record, stream(new Uint8Array(4))), 'INTEGRITY_MISMATCH');
  assert.equal(bucket.puts, 0);
});
test('R2 write failure never confirms the reservation', async () => {
  const {service, bucket, storage} = setup(); bucket.put = async () => { throw new Error('R2 unavailable'); };
  await assert.rejects(service.upload(record, stream(data)));
  assert.equal(storage.values.get('file:' + record.id).state, 'reserved');
});
test('stored bytes are checked rather than trusting metadata', async () => {
  const {service, bucket, storage} = setup(); bucket.get = async () => ({size: 4, body: stream(new Uint8Array(4))});
  await rejection(service.upload(record, stream(data)), 'STORED_OBJECT_MISMATCH');
  assert.equal(storage.values.get('file:' + record.id).state, 'reserved');
});
test('same request can recover after object write but lost confirmation', async () => {
  const {service, bucket, storage} = setup(); const original = bucket.get.bind(bucket); let fail = true;
  bucket.get = async key => { if (fail) throw new Error('read outage'); return original(key); };
  await assert.rejects(service.upload(record, stream(data))); fail = false;
  assert.equal((await service.upload(record, stream(data))).state, 'ready');
  assert.equal(storage.values.get('total'), 4); assert.equal(bucket.values.size, 1);
});
test('concurrent identical requests use one reservation and immutable key', async () => {
  const {service, storage, bucket} = setup();
  const results = await Promise.all([service.upload(record, stream(data)), service.upload(record, stream(data))]);
  assert.ok(results.every(result => result.state === 'ready'));
  assert.equal(storage.values.get('total'), 4); assert.equal(bucket.values.size, 1);
});
test('new service instance uses existing reservation state', async () => {
  const {service, storage, bucket} = setup(); await service.upload(record, stream(data));
  const restarted = createUploadService(storage, bucket, limits);
  await restarted.upload(record, stream(data)); assert.equal(storage.values.get('total'), 4);
});
test('missing stored object cannot be confirmed', async () => {
  const {service, bucket} = setup(); bucket.get = async () => null;
  await rejection(service.upload(record, stream(data)), 'STORED_OBJECT_MISMATCH');
});
test('buffer cap requires a smaller file policy', () => {
  assert.throws(() => createUploadService(new Transactions(), new Bucket(), {globalBytes: 20000000, userBytes: 20000000, fileBytes: 10000000}));
});
