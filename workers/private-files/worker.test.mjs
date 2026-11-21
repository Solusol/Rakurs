import test from 'node:test';
import assert from 'node:assert/strict';
import worker from './worker.mjs';
import {createMetadataReader, COORDINATOR_NAME} from './ready-files.mjs';

const user = '11111111-1111-4111-8111-111111111111';
const file = '22222222-2222-4222-8222-222222222222';
const origin = 'https://solusol.github.io';
const url = 'https://files.example/v1/projects/p1/files/' + file;
const record = {id: file, userId: user, projectId: 'p1', state: 'ready', bytes: 7, sha256: 'a'.repeat(64)};
const fileObject = (extra = {}) => ({body: 'private', size: 7, customMetadata: {owner: user, project: 'p1', sha256: record.sha256}, ...extra});
function environment(extra = {}) {
  return {APP_ORIGIN: origin, STORAGE_ENABLED: 'true', SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'test-public-key', FILES: {get: async () => fileObject()}, FILE_COORDINATOR: {idFromName: name => { assert.equal(name, COORDINATOR_NAME); return name; }, get: () => ({getReadyMetadata: async () => record})}, ...extra};
}
function request(options = {}) {
  return new Request(url, {headers: {Origin: origin, Authorization: 'Bearer test-token'}, ...options});
}
async function mocked(responses, fn) {
  const previous = globalThis.fetch, calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({url: String(url), options});
    if (!responses.length) throw new Error('Unexpected request');
    return responses.shift();
  };
  try { await fn(calls); } finally { globalThis.fetch = previous; }
}
async function authorized(env) {
  let result;
  await mocked([Response.json({id: user}), Response.json([{id: 'p1'}])], async () => { result = await worker.fetch(request(), env); });
  return result;
}
test('storage is disabled unless explicitly enabled', async () => {
  assert.equal((await worker.fetch(request(), environment({STORAGE_ENABLED: undefined}))).status, 503);
});
test('foreign origins are rejected', async () => {
  assert.equal((await worker.fetch(request({headers: {Origin: 'https://attacker.example'}}), environment())).status, 403);
});
test('uploads and deletes remain unavailable', async () => {
  for (const method of ['POST', 'PUT', 'DELETE']) assert.equal((await worker.fetch(request({method}), environment())).status, 405);
});
test('missing bearer token is rejected', async () => {
  assert.equal((await worker.fetch(request({headers: {Origin: origin}}), environment())).status, 401);
});
test('invalid tokens cannot access R2', async () => {
  let touched = false;
  await mocked([new Response('', {status: 401})], async () => {
    const response = await worker.fetch(request(), environment({FILES: {get: async () => { touched = true; }}}));
    assert.equal(response.status, 401);
    assert.equal(touched, false);
  });
});
test('projects outside the owner scope cannot access R2', async () => {
  let touched = false;
  await mocked([Response.json({id: user}), Response.json([])], async () => {
    assert.equal((await worker.fetch(request(), environment({FILES: {get: async () => { touched = true; }}}))).status, 404);
    assert.equal(touched, false);
  });
});
test('successful reads verify token and owner before selecting object', async () => {
  let key;
  await mocked([Response.json({id: user}), Response.json([{id: 'p1'}])], async calls => {
    const response = await worker.fetch(request(), environment({FILES: {get: async value => { key = value; return fileObject(); }}}));
    assert.equal(response.status, 200);
    assert.equal(await response.text(), 'private');
    assert.equal(key, 'v1/' + user + '/p1/' + file);
    assert.equal(new URL(calls[1].url).searchParams.get('user_id'), 'eq.' + user);
    assert.equal(calls[0].options.headers.Authorization, 'Bearer test-token');
    assert.equal(response.headers.get('Cache-Control'), 'private, no-store');
  });
});
test('authentication outages fail closed', async () => {
  await mocked([new Response('', {status: 503})], async () => {
    assert.equal((await worker.fetch(request(), environment())).status, 503);
  });
});
test('missing or reserved metadata blocks R2 access', async () => {
  for (const value of [null, {...record, state: 'reserved'}]) {
    let touched = false;
    const env = environment({FILE_COORDINATOR: {idFromName: name => name, get: () => ({getReadyMetadata: async () => value})}, FILES: {get: async () => { touched = true; }}});
    assert.equal((await authorized(env)).status, 404);
    assert.equal(touched, false);
  }
});
test('wrong metadata owner project and file are rejected', async () => {
  for (const changed of [{userId: file}, {projectId: 'p2'}, {id: user}]) {
    const env = environment({FILE_COORDINATOR: {idFromName: name => name, get: () => ({getReadyMetadata: async () => ({...record, ...changed})})}});
    assert.equal((await authorized(env)).status, 404);
  }
});
test('missing or unavailable coordinator never falls back to raw bucket', async () => {
  let touched = false;
  for (const coordinator of [undefined, {idFromName: () => { throw new Error('outage'); }}]) {
    const env = environment({FILE_COORDINATOR: coordinator, FILES: {get: async () => { touched = true; }}});
    assert.equal((await authorized(env)).status, 503);
  }
  assert.equal(touched, false);
});
test('wrong stored size or metadata prevents delivery', async () => {
  for (const changed of [{size: 8}, {customMetadata: undefined}, {customMetadata: {owner: user, project: 'p2', sha256: record.sha256}}, {customMetadata: {owner: user, project: 'p1', sha256: 'b'.repeat(64)}}]) {
    assert.equal((await authorized(environment({FILES: {get: async () => fileObject(changed)}}))).status, 404);
  }
});
test('durable metadata reader scopes records and returns only ready metadata', async () => {
  let value = record, reads = 0;
  const reader = createMetadataReader({transaction: async fn => fn({get: async key => { reads++; assert.equal(key, 'file:' + file); return value; }})});
  assert.deepEqual(await reader(user, 'p1', file), record);
  assert.equal(await reader(user, 'p2', file), null);
  value = {...record, state: 'reserved'};
  assert.equal(await reader(user, 'p1', file), null);
  const before = reads;
  assert.equal(await reader(user, '../p1', file), null);
  assert.equal(reads, before);
});
