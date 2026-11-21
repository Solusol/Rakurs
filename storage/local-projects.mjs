const DATABASE = 'rk-local-projects-v1';
const STORE = 'projects';
const accountId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function key(account, project) {
  if (!accountId.test(account) || typeof project !== 'string' || !project || project.length > 128) throw new TypeError('Account and project required');
  return [account, project];
}
function openDatabase() {
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onerror = () => reject(request.error);
    request.onblocked = () => { blocked = true; reject(new Error('Close older Rakurs tabs before upgrading storage')); };
    request.onsuccess = () => { if (blocked) request.result.close(); else resolve(request.result); };
  });
}
export async function readProject(account, project) {
  const id = key(account, project), db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readonly');
      const request = transaction.objectStore(STORE).get(id);
      transaction.oncomplete = () => resolve(request.result ?? null);
      transaction.onabort = () => reject(transaction.error || new Error('Read aborted'));
      transaction.onerror = () => reject(transaction.error);
    });
  } finally { db.close(); }
}
export async function saveProject(account, project, value, expectedRevision) {
  const id = key(account, project);
  if (expectedRevision !== null && (typeof expectedRevision !== 'string' || !expectedRevision)) throw new TypeError('Expected revision required; use null only for a new project');
  const snapshot = structuredClone(value), db = await openDatabase();
  try {
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE, 'readwrite');
      const store = transaction.objectStore(STORE), request = store.get(id);
      let result, failure;
      request.onsuccess = () => {
        const previous = request.result;
        if ((previous?.revision ?? null) !== expectedRevision) {
          failure = new Error('Project changed in another tab; reload before saving');
          failure.name = 'RevisionConflictError';
          transaction.abort();
          return;
        }
        result = {revision: crypto.randomUUID(), savedAt: Date.now(), value: snapshot};
        store.put(result, id);
      };
      transaction.oncomplete = () => resolve(result);
      transaction.onabort = () => reject(failure || transaction.error || new Error('Write aborted'));
      transaction.onerror = () => reject(failure || transaction.error);
    });
  } finally { db.close(); }
}
