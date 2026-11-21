import test from 'node:test';
import assert from 'node:assert/strict';
import {createAttachmentEditor} from './project-attachments.mjs';
const owner = '11111111-1111-4111-8111-111111111111';
const file = '22222222-2222-4222-8222-222222222222';
const record = {id: file, userId: owner, projectId: 'main', state: 'ready', bytes: 4, sha256: 'a'.repeat(64)};
const input = {account: owner, project: 'main', expectedRevision: 'r1', fileIds: [file]};
const original = {pages: [{text: 'Keep me', image: 'data:image/png;base64,AAAA'}], notes: {x: 'note'}, updated: 123, unknownFutureField: {keep: true}};
function setup(value = original) {
  const state = {row: {revision: 'r1', value: structuredClone(value)}, writes: 0, lookups: 0};
  state.lookup = async (account, project, id) => { state.lookups++; assert.equal(account, owner); assert.equal(project, 'main'); assert.equal(id, file); return record; };
  const editor = createAttachmentEditor({
    getReadyMetadata: (...args) => state.lookup(...args),
    readProject: async (account, project) => { assert.equal(account, owner); assert.equal(project, 'main'); return structuredClone(state.row); },
    saveProject: async (account, project, next, expected) => {
      assert.equal(account, owner); assert.equal(project, 'main');
      if (state.row.revision !== expected) { const error = new Error('conflict'); error.code = 'REVISION_CONFLICT'; throw error; }
      state.writes++; state.row = {revision: 'r2', value: structuredClone(next)}; return structuredClone(state.row);
    }
  });
  return {state, editor};
}
const rejects = (promise, code) => assert.rejects(promise, error => error.code === code);
test('ready references are stored while legacy and unknown fields survive', async () => {
  const {state, editor} = setup(); const result = await editor.replace(input);
  const { _rkAttachments: manifest, ...rest } = result.value;
  assert.deepEqual(rest, original);
  assert.deepEqual(manifest, {version: 1, ownerId: owner, projectId: 'main', files: [{id: file, bytes: 4, sha256: record.sha256}]});
  assert.equal(state.writes, 1); assert.equal(result.revision, 'r2');
});
test('stale revision fails before any metadata lookups', async () => {
  const {state, editor} = setup(); await rejects(editor.replace({...input, expectedRevision: 'old'}), 'REVISION_CONFLICT');
  assert.equal(state.lookups, 0); assert.equal(state.writes, 0);
});
test('a project edited during metadata lookup is not overwritten', async () => {
  const {state, editor} = setup();
  state.lookup = async () => { state.row = {revision: 'other-tab', value: {pages: ['new edit']}}; return record; };
  await rejects(editor.replace(input), 'REVISION_CONFLICT');
  assert.deepEqual(state.row.value, {pages: ['new edit']}); assert.equal(state.writes, 0);
});
test('missing and reserved files do not change project', async () => {
  for (const result of [null, {...record, state: 'reserved'}]) {
    const {state, editor} = setup(); state.lookup = async () => result;
    await rejects(editor.replace(input), 'FILE_NOT_READY'); assert.equal(state.writes, 0);
  }
});
test('other owner project file or invalid integrity metadata is rejected', async () => {
  for (const changed of [{userId: file}, {projectId: 'p2'}, {id: owner}, {bytes: 0}, {sha256: 'invalid'}]) {
    const {state, editor} = setup(); state.lookup = async () => ({...record, ...changed});
    await rejects(editor.replace(input), 'FILE_NOT_READY'); assert.equal(state.writes, 0);
  }
});
test('metadata outage does not modify the snapshot', async () => {
  const {state, editor} = setup(); state.lookup = async () => { throw new Error('offline'); };
  await assert.rejects(editor.replace(input)); assert.equal(state.writes, 0); assert.deepEqual(state.row.value, original);
});
test('duplicate IDs are rejected before reads', async () => {
  const {state, editor} = setup(); await rejects(editor.replace({...input, fileIds: [file, file]}), 'DUPLICATE_FILE_ID');
  assert.equal(state.lookups, 0); assert.equal(state.writes, 0);
});
test('invalid scopes and excessive manifests are rejected', async () => {
  const {editor} = setup();
  for (const changed of [{account: 'other'}, {project: '../x'}, {expectedRevision: null}, {fileIds: Array(101).fill(file)}]) await rejects(editor.replace({...input, ...changed}), 'INVALID_REQUEST');
  await rejects(editor.replace({...input, fileIds: ['bad']}), 'INVALID_FILE_ID');
});
test('unknown manifest version or ownership is preserved by refusing overwrite', async () => {
  for (const manifest of [{version: 2, ownerId: owner, projectId: 'main', files: []}, {version: 1, ownerId: file, projectId: 'main', files: []}, {version: 1, ownerId: owner, projectId: 'main', files: [], future: true}]) {
    const {state, editor} = setup({...original, _rkAttachments: manifest});
    await rejects(editor.replace(input), 'MANIFEST_CONFLICT'); assert.equal(state.writes, 0);
  }
});
test('empty replacement only detaches local references and performs no file lookup', async () => {
  const {state, editor} = setup({...original, _rkAttachments: {version: 1, ownerId: owner, projectId: 'main', files: [{id: file}]}});
  await editor.replace({...input, fileIds: []});
  assert.deepEqual(state.row.value._rkAttachments.files, []); assert.equal(state.lookups, 0);
});
test('missing project is not silently created', async () => {
  const {state, editor} = setup(); state.row = null;
  await rejects(editor.replace(input), 'PROJECT_MISSING'); assert.equal(state.writes, 0);
});
test('two edits of one revision cannot both commit', async () => {
  const {state, editor} = setup();
  const results = await Promise.allSettled([editor.replace(input), editor.replace(input)]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1); assert.equal(state.writes, 1);
});
