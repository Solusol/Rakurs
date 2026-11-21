# Quota ledger: isolated development module

Nothing in this change is deployed or imported by the running application or the file-reader Worker. No upload endpoint is enabled. No existing data is migrated, deleted or changed.

## Contract
createQuotaLedger(storage, {globalBytes, userBytes, fileBytes}) requires explicit positive safe-integer byte limits, with fileBytes <= userBytes <= globalBytes. There are no production defaults and no assumption that a free service has unlimited capacity.

The storage adapter must implement durable serializable transaction(callback), with transaction-local get(key) and put(key, value). All users and module instances subject to one global quota must use ONE shared transaction coordinator. Separate per-user coordinators cannot enforce a global quota. The included memory adapter is only a unit-test fake, never production storage. No Cloudflare resources or bindings are created here.

reserve(record) atomically charges both counters and saves immutable metadata. Same-ID retries with identical metadata do not charge twice; changes to owner, project, byte count, SHA-256 or content type are rejected.

confirm(record, verified) marks a reservation ready only when the supplied verified size and SHA-256 match the reservation. This module DOES NOT compute a file hash, inspect bytes or verify an R2 upload. Only trusted server-side code that independently reads and verifies the stored object may call confirm. Browser-supplied verification is not trusted.

Allowed MIME labels are a preliminary allowlist, not content sniffing or malware detection. SVG and HTML are not accepted. Actual media validation remains required.

## Conservative failure behavior
Counters include both reserved and ready bytes. Failed, interrupted or mismatched uploads remain charged. There is no release, expiry or deletion API yet. Do not reclaim reservations until the upload is fenced against retries and the object is proven absent; otherwise a late upload could bypass the quota. Reconciliation and bounded cleanup are prerequisites for production use.

This internal module provides no authentication or project permission checks. Those must be completed by the server before reserve/confirm. Reservation IDs must be generated or controlled by that server. Quotas do not limit request counts, download bandwidth, coordinator storage costs or other Cloudflare usage, and do not guarantee zero billing.

## Tests and next steps
Run: node --test workers/private-files/quota-ledger.test.mjs
Eleven tests use a serialized in-memory transaction fake, including parallel attempts and idempotent retries. Real persistence, runtime concurrency guarantees, failures across restarts and integration with R2/Supabase have NOT been tested.

Next: implement and test a durable shared coordinator; enforce upload size while reading; independently verify R2 object size/hash; integrate metadata and project references; add abuse controls, cleanup/recovery and beta-reader access; then review deployment costs and approvals. Keep production uploads disabled until these requirements and end-to-end tests pass.
