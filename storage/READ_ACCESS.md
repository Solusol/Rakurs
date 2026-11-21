# Ready-only file reads: development integration

This stage supersedes the raw owner-only bucket read in the initial development Worker. Nothing is deployed, imported into index.html or enabled on the running site. No migration, deletion, quota release or paid resource creation is included.

The Worker still verifies the bearer token using Supabase Auth and checks the non-deleted rk_projects row under the user's token and owner filter. Only then does readReadyObject request ledger metadata from FILE_COORDINATOR, using the fixed name rakurs-global-v1. Future upload routing MUST use the same named coordinator for global quotas and metadata.

Metadata must be ready and match the authenticated owner, project and file UUID. Missing/reserved/mismatched metadata yields 404 without a bucket read. Missing or failing coordinator yields 503; no raw R2 fallback exists. The stored object's byte count and customMetadata owner/project/SHA-256 must match before returning its body. The download path does not recompute SHA-256: it relies on upload verification and immutable keys. External bucket mutation is unsupported until reconciliation exists.

PrivateUploadCoordinator now provides a trusted-binding-only getReadyMetadata method, independently of whether new uploads are enabled. The class is still not exported from worker.mjs, has no deployment configuration, and its public fetch method returns 404. Buckets must remain private. The browser never receives coordinator credentials.

This is an owner/project binding in the reservation ledger, NOT a connection to the project JSON attachment manifest. Beta-reader access, previews, frontend references, attachment lifecycle and race-safe revocation/deletion are not implemented. Ready metadata is not a promise of instantaneous revocation if files are later deleted; that protocol must be designed before cleanup is enabled.

Run: node --test workers/private-files/worker.test.mjs
Thirteen tests cover the original authorization paths and the new readiness and stored-metadata gates. They use mock Auth/REST responses, R2 and coordinator, not Cloudflare/Supabase. The Durable Object adapter has syntax checks only; actual RPC, persistence and deployment remain unverified. Uploads remain disabled and no data is moved.
