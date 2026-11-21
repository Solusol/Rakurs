import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuotaLedger} from './quota-ledger.mjs';

class TransactionMemory {
  values = new Map();
  tail = Promise.resolve();
  transaction(fn) {
    const work = this.tail.then(async () => {
      const draft = structuredClone(this.values);
      const result = await fn({get: async key => structuredClone(draft.get(key)), put: async (key, value) => { draft.set(key, structuredClone(value)); }});
      this.values = draft;
      return result;
    });
    this.tail = work.catch(() => {});
    return work;
  }
}
const userA = '11111111-1111-4111-8111-111111111111';
const userB = '22222222-2222-4222-8222-222222222222';
const input = (n, extra = {}) => ({id: 'aaaaaaaa-aaaa-4aaa-8aaa-' + String(n).padStart(12, '0'), userId: userA, projectId: 'p1', bytes: 4, sha256: 'a'.repeat(64), contentType: 'image/png', ...extra});
const setup = (limits = {globalBytes: 12, userBytes: 8, fileBytes: 8}) => {
  const storage = new TransactionMemory();
  return {storage, ledger: createQuotaLedger(storage, limits)};
};
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);

test('configuration must use explicit positive safe integer limits', () => {
  assert.throws(() => createQuotaLedger(new TransactionMemory(), {globalBytes: Infinity, userBytes: 8, fileBytes: 4}));
  assert.throws(() => createQuotaLedger(new TransactionMemory(), {globalBytes: 4, userBytes: 8, fileBytes: 4}));
});
test('reserve charges global and user counters', async () => {
  const {storage, ledger} = setup();
  assert.equal((await ledger.reserve(input(1))).state, 'reserved');
  assert.equal(storage.values.get('total'), 4);
  assert.equal(storage.values.get('user:' + userA), 4);
});
test('retry of one reservation is idempotent', async () => {
  const {storage, ledger} = setup();
  await Promise.all([ledger.reserve(input(1)), ledger.reserve(input(1))]);
  assert.equal(storage.values.get('total'), 4);
});
test('reservation IDs cannot change owner or file metadata', async () => {
  const {storage, ledger} = setup();
  await ledger.reserve(input(1));
  await rejects(ledger.reserve(input(1, {userId: userB})), 'RESERVATION_CONFLICT');
  await rejects(ledger.reserve(input(1, {sha256: 'b'.repeat(64)})), 'RESERVATION_CONFLICT');
  assert.equal(storage.values.get('total'), 4);
});
test('parallel requests cannot exceed a user limit', async () => {
  const {storage, ledger} = setup();
  const results = await Promise.allSettled([1, 2, 3].map(n => ledger.reserve(input(n))));
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 2);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'USER_LIMIT');
  assert.equal(storage.values.get('total'), 8);
});
test('all users share the global limit', async () => {
  const {storage, ledger} = setup({globalBytes: 10, userBytes: 8, fileBytes: 8});
  const results = await Promise.allSettled([ledger.reserve(input(1, {bytes: 6})), ledger.reserve(input(2, {bytes: 6, userId: userB}))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(results.find(r => r.status === 'rejected').reason.code, 'GLOBAL_LIMIT');
  assert.equal(storage.values.get('total'), 6);
});
test('file size and disallowed media are rejected before charging', async () => {
  const {storage, ledger} = setup();
  await rejects(ledger.reserve(input(1, {bytes: 9})), 'FILE_LIMIT');
  await rejects(ledger.reserve(input(2, {contentType: 'image/svg+xml'})), 'INVALID_RESERVATION');
  await rejects(ledger.reserve(input(3, {bytes: -1})), 'INVALID_RESERVATION');
  assert.equal(storage.values.size, 0);
});
test('mismatched verification leaves reservation charged and not ready', async () => {
  const {storage, ledger} = setup();
  await ledger.reserve(input(1));
  await rejects(ledger.confirm(input(1), {bytes: 4, sha256: 'b'.repeat(64)}), 'INTEGRITY_MISMATCH');
  assert.equal(storage.values.get('file:' + input(1).id).state, 'reserved');
  assert.equal(storage.values.get('total'), 4);
});
test('confirm requires a matching reservation and is idempotent', async () => {
  const {storage, ledger} = setup();
  const verified = {bytes: 4, sha256: 'a'.repeat(64)};
  await rejects(ledger.confirm(input(1), verified), 'RESERVATION_MISSING');
  await ledger.reserve(input(1));
  assert.equal((await ledger.confirm(input(1), verified)).state, 'ready');
  assert.equal((await ledger.confirm(input(1), verified)).state, 'ready');
  assert.equal(storage.values.get('total'), 4);
});
test('corrupt counters fail closed without changing data', async () => {
  const {storage, ledger} = setup();
  storage.values.set('total', -1);
  await rejects(ledger.reserve(input(1)), 'INVALID_COUNTER');
  assert.equal(storage.values.get('total'), -1);
  assert.equal(storage.values.size, 1);
});
test('independent module instances must share the transaction coordinator', async () => {
  const {storage, ledger} = setup({globalBytes: 6, userBytes: 6, fileBytes: 6});
  const second = createQuotaLedger(storage, {globalBytes: 6, userBytes: 6, fileBytes: 6});
  const results = await Promise.allSettled([ledger.reserve(input(1)), second.reserve(input(2, {userId: userB}))]);
  assert.equal(results.filter(r => r.status === 'fulfilled').length, 1);
  assert.equal(storage.values.get('total'), 4);
});
