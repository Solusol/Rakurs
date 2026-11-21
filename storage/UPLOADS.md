# Internal verified upload stage

Development source only. No deployment, public upload route, Cloudflare resource creation, migration, deletion or frontend integration is included. Existing worker.mjs continues to reject upload methods.

## Flow
Trusted server authenticates the user and project, controls the reservation ID, and calls upload(record, byteStream). The service reserves quota, reads at most the reserved bytes with a 10-second read deadline, computes SHA-256, rejects size/hash mismatches before R2, conditionally writes only an absent key, reads the stored object independently, verifies actual bytes again and confirms the ledger. A checksum supplied by the browser alone never confirms an upload.

R2 key: v1/<verified owner UUID>/<project ID>/<reservation UUID>. Objects are stored as application/octet-stream with private/no-store metadata. Buckets must have all public access disabled. MIME allowlisting in the ledger is not file-type detection or malware scanning. Existing reader must be gated by ready attachment metadata before production integration.

## Durable adapter
PrivateUploadCoordinator extends Cloudflare DurableObject and passes ctx.storage transactions to the ledger. UPLOADS_ENABLED must explicitly equal true; GLOBAL_BYTES, USER_BYTES and FILE_BYTES must be explicitly configured. FILES is a private R2 binding. All callers must use one fixed named coordinator ID for the global quota, not one ID per user. The class is deliberately not re-exported by worker.mjs and there is no Wrangler deployment/migration config. Its fetch method always returns 404. RPC bindings are trusted-server-only; callers must check Supabase authentication and ownership before invoking upload.

This buffered first version permits configured file limits up to 8 MiB. Larger files need a separately reviewed bounded-memory or multipart design. Aggregate concurrent memory limits, rate limiting and external-I/O timeouts remain required before public traffic. The 8 MiB value is a technical development ceiling, not an approved production user quota.

## Recovery
Same-ID retries verify existing bytes instead of overwriting objects, and do not charge another reservation. Failed attempts remain charged. No automatic expiration, deletion or quota release exists. Safe fencing, reconciliation and cleanup are still required. External changes to the bucket or reuse of a quota coordinator for an already-populated bucket are unsupported without reconciliation.

## Verification
Run: node --test workers/private-files/upload-service.test.mjs
Eleven unit tests cover valid upload, excess/short body, wrong checksum, write/read failure, incorrect stored content, retry recovery, concurrent duplicates, reuse of existing ledger state and the buffer cap. They use in-memory transaction and bucket fakes, not Cloudflare. The ledger fixture used locally was checked against Git blob 5486881a0095f505ec8866e4cadf8a500a0dc4f9.

The adapter has syntax checks only. Actual Durable Objects persistence across eviction/restarts, RPC stream transfer, R2 conditional-write/checksum behavior and end-to-end user authorization have NOT been tested in the Cloudflare runtime. Do not describe this as deployed or production-ready persistent storage. No billing or zero-cost guarantee is made. Keep production uploads disabled pending those tests, cleanup, metadata/access integration, cost review and deployment approval.
