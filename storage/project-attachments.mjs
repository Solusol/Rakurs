import {readProject as localRead, saveProject as localSave} from './local-projects.mjs';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PROJECT = /^[A-Za-z0-9_-]{1,128}$/;
const FIELD = '_rkAttachments';
function fail(code) { const error = new Error(code); error.code = code; throw error; }
export function createAttachmentEditor({getReadyMetadata, readProject = localRead, saveProject = localSave} = {}) {
  if (typeof getReadyMetadata !== 'function' || typeof readProject !== 'function' || typeof saveProject !== 'function') fail('INVALID_CONFIGURATION');
  return Object.freeze({
    async replace({account, project, expectedRevision, fileIds} = {}) {
      if (typeof account !== 'string' || !UUID.test(account) || typeof project !== 'string' || !PROJECT.test(project) || typeof expectedRevision !== 'string' || !expectedRevision || !Array.isArray(fileIds) || fileIds.length > 100) fail('INVALID_REQUEST');
      const owner = account.toLowerCase();
      const ids = fileIds.map(id => { if (typeof id !== 'string' || !UUID.test(id)) fail('INVALID_FILE_ID'); return id.toLowerCase(); });
      if (new Set(ids).size !== ids.length) fail('DUPLICATE_FILE_ID');
      const previous = await readProject(owner, project);
      if (!previous) fail('PROJECT_MISSING');
      if (previous.revision !== expectedRevision) fail('REVISION_CONFLICT');
      const value = structuredClone(previous.value);
      if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype) fail('INVALID_PROJECT');
      if (Object.hasOwn(value, FIELD)) {
        const manifest = value[FIELD];
        if (!manifest || manifest.version !== 1 || manifest.ownerId !== owner || manifest.projectId !== project || !Array.isArray(manifest.files)) fail('MANIFEST_CONFLICT');
        if (Object.keys(manifest).some(key => !['version', 'ownerId', 'projectId', 'files'].includes(key))) fail('MANIFEST_CONFLICT');
      }
      const files = [];
      for (const id of ids) {
        const record = await getReadyMetadata(owner, project, id);
        if (!record || record.state !== 'ready' || record.id !== id || record.userId !== owner || record.projectId !== project || !Number.isSafeInteger(record.bytes) || record.bytes <= 0 || typeof record.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(record.sha256)) fail('FILE_NOT_READY');
        files.push({id, bytes: record.bytes, sha256: record.sha256});
      }
      value[FIELD] = {version: 1, ownerId: owner, projectId: project, files};
      // Local CAS is checked again after asynchronous metadata lookups.
      // No file deletion, quota release or cloud synchronization occurs here.
      return saveProject(owner, project, value, expectedRevision);
    }
  });
}
