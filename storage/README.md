# Private storage migration: development foundation

Status: isolated modules only. Nothing is loaded by index.html or deployed. No existing project is migrated, modified or deleted.

## Implemented
- workers/private-files/worker.mjs: GET /v1/projects/:project/files/:uuid, disabled unless STORAGE_ENABLED=true.
- Every read verifies the bearer token through Supabase Auth, checks the existing rk_projects owner policy with that token, and derives the R2 key from the verified user ID.
- Expected R2 key: v1/<owner UUID>/<project ID>/<file UUID>. Bucket must stay private with all public endpoints disabled. CORS is not a substitute for authorization.
- Only owners are supported. Beta readers and shared projects are deliberately not supported yet.
- POST, PUT and DELETE are unavailable. No upload or deletion endpoint exists.
- storage/local-projects.mjs: account-scoped IndexedDB records with transaction-completion acknowledgement and revision compare-and-swap. It does not replace current localStorage yet and does not fix cross-device cloud conflicts by itself.

## Configuration for later deployment
Worker bindings: FILES (private R2 bucket), APP_ORIGIN (exact origin, no path), SUPABASE_URL, SUPABASE_ANON_KEY (publishable anon key, never service_role), STORAGE_ENABLED (default absent/disabled). No credentials are stored here. No Wrangler configuration or deploy workflow is included.

## Checks
Run: node --test workers/private-files/worker.test.mjs
Eight mocked server tests cover default-off behavior, origin rejection, write-method rejection, missing and invalid tokens, owner authorization, successful owner reads and authentication outages.
IndexedDB currently has syntax checks only, not browser integration tests. No real Cloudflare, Supabase, migration or end-to-end test has run.

## Required before production integration
1. Account-level and per-user quotas with atomic reservations, upload limits, abuse controls and cleanup of abandoned uploads.
2. File metadata and project attachment references, safe media delivery, preview support and beta-reader permissions.
3. Authenticated upload/finalize flow and recovery for partial failures.
4. Browser tests for quota errors, stale tabs, account switching and durable local writes.
5. Migration copies data first, verifies persistence and checksums, preserves backups and supports rollback. Never delete legacy data automatically.
6. Replace cloud conflict handling with revision-aware synchronization; handle every local save failure before claiming a cloud save succeeded.
7. Review Cloudflare costs, explicit deployment approval and private-bucket settings before enabling anything. Free-tier capacity is not a guarantee of zero charges.

Do not enable production uploads or remove existing data based on this initial foundation.
