const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROJECT = /^[A-Za-z0-9_-]{1,128}$/;
export const COORDINATOR_NAME = 'rakurs-global-v1';
function scope(owner, project, file) {
  if (typeof owner !== 'string' || typeof project !== 'string' || typeof file !== 'string' || !UUID.test(owner) || !PROJECT.test(project) || !UUID.test(file)) return null;
  return {owner: owner.toLowerCase(), project, file: file.toLowerCase()};
}
function matches(record, expected) {
  return record && record.state === 'ready' && record.userId === expected.owner && record.projectId === expected.project && record.id === expected.file && Number.isSafeInteger(record.bytes) && record.bytes > 0 && typeof record.sha256 === 'string' && /^[0-9a-f]{64}$/.test(record.sha256);
}
export function createMetadataReader(storage) {
  if (!storage || typeof storage.transaction !== 'function') throw new Error('Metadata storage unavailable');
  return async (owner, project, file) => {
    const expected = scope(owner, project, file);
    if (!expected) return null;
    return storage.transaction(async tx => {
      const record = await tx.get('file:' + expected.file);
      if (!matches(record, expected)) return null;
      return {id: record.id, userId: record.userId, projectId: record.projectId, state: 'ready', bytes: record.bytes, sha256: record.sha256};
    });
  };
}
// Call only after authenticating the requester and authorizing the project.
export async function readReadyObject(env, owner, project, file) {
  const expected = scope(owner, project, file);
  if (!expected) return null;
  const namespace = env.FILE_COORDINATOR;
  if (!namespace || !env.FILES) throw new Error('File coordinator unavailable');
  const coordinator = namespace.get(namespace.idFromName(COORDINATOR_NAME));
  const record = await coordinator.getReadyMetadata(expected.owner, expected.project, expected.file);
  if (!matches(record, expected)) return null;
  const object = await env.FILES.get('v1/' + expected.owner + '/' + expected.project + '/' + expected.file);
  if (!object || !object.body) return null;
  const meta = object.customMetadata;
  if (object.size !== record.bytes || !meta || meta.owner !== expected.owner || meta.project !== expected.project || meta.sha256 !== record.sha256) {
    try { await object.body.cancel?.(); } catch {}
    return null;
  }
  return object;
}
