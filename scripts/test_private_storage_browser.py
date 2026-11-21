import functools
import http.server
import json
from pathlib import Path
import threading
import uuid
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[1]
OWNER = '11111111-1111-4111-8111-111111111111'
OTHER = '33333333-3333-4333-8333-333333333333'
FILE = '22222222-2222-4222-8222-222222222222'
LEGACY = {'pages': [{'text': 'keep', 'image': 'data:image/png;base64,AAAA'}], 'notes': {'x': 'note'}, 'updated': 123, 'future': {'keep': True}}

class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass

def main():
    server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Handler, directory=str(ROOT)))
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = 'http://127.0.0.1:' + str(server.server_port)
    results = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True)
            try:
                context = browser.new_context(service_workers='block')
                context.route('**/*', lambda route: route.continue_() if route.request.url.startswith(origin + '/') else route.abort())
                a, b = context.new_page(), context.new_page()
                for page in (a, b):
                    page.goto(origin + '/tests/browser/private-storage.html')
                    page.wait_for_function('!!window.privateStorageTest')
                def seed():
                    project = 'test-' + uuid.uuid4().hex
                    row = a.evaluate('([owner, project, value]) => privateStorageTest.saveProject(owner, project, value, null)', [OWNER, project, LEGACY])
                    return project, row
                def read(project, page=a, owner=OWNER):
                    return page.evaluate('([owner, project]) => privateStorageTest.readProject(owner, project)', [owner, project])
                def attach(project, row, ids=None):
                    return a.evaluate("""async ([owner, project, revision, file, ids]) => {
                      const editor = privateStorageTest.createAttachmentEditor({getReadyMetadata: async (userId, projectId, id) => ({id, userId, projectId, state:'ready', bytes:4, sha256:'a'.repeat(64)})});
                      return editor.replace({account:owner, project, expectedRevision:revision, fileIds:ids === null ? [file] : ids});
                    }""", [OWNER, project, row['revision'], FILE, ids])
                def case(name, fn):
                    try:
                        fn()
                        results.append({'name': name, 'status': 'passed'})
                    except Exception as error:
                        results.append({'name': name, 'status': 'failed', 'error': str(error)})
                def persistence():
                    project, row = seed()
                    b.reload(); b.wait_for_function('!!window.privateStorageTest')
                    assert read(project, b) == row
                case('real IndexedDB survives another page reload', persistence)
                def isolation():
                    project, _ = seed()
                    assert read(project, b, OTHER) is None
                case('accounts are isolated', isolation)
                def stale():
                    project, row = seed()
                    value = a.evaluate("""async ([owner, project]) => {
                      try { await privateStorageTest.saveProject(owner, project, {bad:true}, 'stale'); return 'unexpected'; }
                      catch (error) { return error.name; }
                    }""", [OWNER, project])
                    assert value == 'RevisionConflictError'
                    assert read(project) == row
                case('stale save aborts without data loss', stale)
                def tabs():
                    project, row = seed()
                    channel = uuid.uuid4().hex
                    for page in (a, b):
                        page.evaluate("""([owner, project, revision, channel]) => {
                          window.testChannel = new BroadcastChannel(channel);
                          window.testRace = new Promise(resolve => { testChannel.onmessage = () => {
                            privateStorageTest.saveProject(owner, project, {winner:crypto.randomUUID()}, revision).then(() => resolve('saved'), error => resolve(error.name));
                          }; });
                        }""", [OWNER, project, row['revision'], channel])
                    a.evaluate('(name) => { const trigger = new BroadcastChannel(name); trigger.postMessage("go"); trigger.close(); }', channel)
                    outcomes = [page.evaluate('window.testRace') for page in (a, b)]
                    assert sorted(outcomes) == ['RevisionConflictError', 'saved'], outcomes
                    assert 'winner' in read(project)['value']
                    for page in (a, b):
                        page.evaluate('testChannel.close()')
                case('two pages compete for one real transaction revision', tabs)
                def preserve():
                    project, row = seed()
                    saved = attach(project, row)
                    loaded = read(project, b)['value']
                    manifest = loaded.pop('_rkAttachments')
                    assert loaded == LEGACY
                    assert manifest['files'] == [{'id': FILE, 'bytes': 4, 'sha256': 'a' * 64}]
                    assert saved['revision'] != row['revision']
                    cloned = a.evaluate('value => JSON.parse(JSON.stringify(value))', saved['value'])
                    assert cloned == saved['value']
                case('manifest and legacy fields survive raw JSON round-trip', preserve)
                def during_lookup():
                    project, row = seed()
                    a.evaluate("""([owner, project, revision, file]) => {
                      window.lookupStarted = false;
                      const editor = privateStorageTest.createAttachmentEditor({getReadyMetadata: () => new Promise(resolve => {
                        window.lookupStarted = true;
                        window.resumeLookup = () => resolve({id:file, userId:owner, projectId:project, state:'ready', bytes:4, sha256:'a'.repeat(64)});
                      })});
                      window.pendingAttachment = editor.replace({account:owner, project, expectedRevision:revision, fileIds:[file]}).then(() => 'unexpected', error => error.name);
                    }""", [OWNER, project, row['revision'], FILE])
                    a.wait_for_function('window.lookupStarted')
                    b.evaluate('([owner, project, revision]) => privateStorageTest.saveProject(owner, project, {newEdit:true}, revision)', [OWNER, project, row['revision']])
                    a.evaluate('resumeLookup()')
                    assert a.evaluate('window.pendingAttachment') == 'RevisionConflictError'
                    assert read(project)['value'] == {'newEdit': True}
                case('another tab edit during metadata lookup wins safely', during_lookup)
                def not_ready():
                    project, row = seed()
                    code = a.evaluate("""async ([owner, project, revision, file]) => {
                      const editor = privateStorageTest.createAttachmentEditor({getReadyMetadata: async () => null});
                      try { await editor.replace({account:owner, project, expectedRevision:revision, fileIds:[file]}); return 'unexpected'; }
                      catch (error) { return error.code; }
                    }""", [OWNER, project, row['revision'], FILE])
                    assert code == 'FILE_NOT_READY'
                    assert read(project) == row
                case('unconfirmed attachment leaves real stored revision untouched', not_ready)
                def detach():
                    project, row = seed()
                    saved = attach(project, row)
                    detached = attach(project, saved, [])
                    assert detached['value']['_rkAttachments']['files'] == []
                    assert detached['value']['pages'] == LEGACY['pages']
                case('detach removes references without removing legacy content', detach)
                context.close()
                report = {'browser': browser.version, 'passed': sum(item['status'] == 'passed' for item in results), 'failed': sum(item['status'] == 'failed' for item in results), 'tests': results}
                print(json.dumps(report, ensure_ascii=False, indent=2))
                if report['failed']:
                    raise SystemExit(1)
            finally:
                browser.close()
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)

if __name__ == '__main__':
    main()
