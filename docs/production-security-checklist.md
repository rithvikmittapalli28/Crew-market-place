# Crewn Production Security Checklist

This document provides the mandatory 21-point security verification checklist for launching Crewn. Every item defines an explicit verification procedure, expected result, actual evidence, and pass/fail status.

> [!IMPORTANT]
> **Evidence-Based Policy:** Items verified through automated local regression tests and code audits are marked `[PASS - VERIFIED LOCALLY]`. Items requiring live external cloud infrastructure are marked `[PENDING - REQUIRES EXTERNAL INFRASTRUCTURE]` or `[PENDING - OPERATOR ACTION]`.

---

## Security Verification Matrix

### 1. Session Security & Revocation
- **Control:** Secure cookie flags (`HttpOnly`, `SameSite=lax`, `Secure`), SHA-256 token hashing in database, idle timeout, and automated session revocation cleanup.
- **Verification Procedure:** Run automated session lifecycle suite in `tests/auth-and-onboarding.test.ts` and `tests/phase12b-security-hardening.test.ts`.
- **Expected Outcome:** Raw session tokens never stored; expired/revoked sessions successfully purged.
- **Evidence:** `tests/phase12b-security-hardening.test.ts` subtest 5 passed.
- **Status:** **PASS - VERIFIED LOCALLY**

### 2. Authentication & Authorization
- **Control:** Bcrypt password hashing, verification tokens, password reset expirations, and protected API routes.
- **Verification Procedure:** Run `tests/auth-and-onboarding.test.ts`.
- **Expected Outcome:** Unauthenticated requests receive 401; password reset hashes validated with expiration checks.
- **Evidence:** 14/14 tests in auth suite passed.
- **Status:** **PASS - VERIFIED LOCALLY**

### 3. Role & Tenant Isolation
- **Control:** Multi-tenant project data isolation; client and freelancer data strictly partitioned by membership and ownership.
- **Verification Procedure:** Run `tests/phase4-projects.test.ts` and `tests/phase4-team-collaboration.test.ts`.
- **Expected Outcome:** Non-members cannot view, edit, or interact with foreign projects or tasks.
- **Evidence:** 12/12 project tests and 14/14 team collaboration tests passed.
- **Status:** **PASS - VERIFIED LOCALLY**

### 4. Admin Permission Boundaries
- **Control:** Granular admin roles (`FINANCE`, `MODERATION`, `SUPPORT`, `SYSTEM`) checked via `hasAdminPermission`.
- **Verification Procedure:** Run `tests/phase12b-security-hardening.test.ts` subtest 8.
- **Expected Outcome:** Regular users denied admin actions; domain admins restricted to designated scopes; superadmins retain global access.
- **Evidence:** `tests/phase12b-security-hardening.test.ts` subtest 8 passed.
- **Status:** **PASS - VERIFIED LOCALLY**

### 5. CSRF & CORS Configuration
- **Control:** Strict CORS origin checking rejecting arbitrary origins with 403 Forbidden; Razorpay webhooks safely exempted.
- **Verification Procedure:** Run `tests/phase12b-security-hardening.test.ts` subtest 2.
- **Expected Outcome:** Cross-origin mutating requests from unauthorized origins return 403; whitelisted origins return 204/200.
- **Evidence:** `tests/phase12b-security-hardening.test.ts` subtest 2 passed.
- **Status:** **PASS - VERIFIED LOCALLY**

### 6. CSP Nonce Behavior
- **Control:** Per-request cryptographic base64 nonce injected into `Content-Security-Policy` header in `src/proxy.ts`; `'unsafe-eval'` removed in production.
- **Verification Procedure:** Run `tests/phase12b-security-hardening.test.ts` subtest 1.
- **Expected Outcome:** Every request receives a unique cryptographic nonce in `script-src` and `x-nonce`.
- **Evidence:** `tests/phase12b-security-hardening.test.ts` subtest 1 passed.
- **Status:** **PASS - VERIFIED LOCALLY**

### 7. Rate Limiting
- **Control:** Distributed Redis sliding window rate limiting for login (5/min), register (3/min), and APIs (100/min).
- **Verification Procedure:** Run `tests/phase12-production-security.test.ts` subtest F and G.
- **Expected Outcome:** Sliding window accurately tracks and blocks requests beyond quota; fails fast if Redis is unconfigured in production.
- **Evidence:** `tests/phase12-production-security.test.ts` subtests F and G passed.
- **Status:** **PASS - VERIFIED LOCALLY**

### 8. Redis Connectivity & TLS
- **Control:** TLS-enforced connection string (`rediss://`), AUTH token authentication, and offline queue disabled.
- **Verification Procedure:** Run `npx tsx -e "import { getRedisClient } from './src/lib/redis/client'; getRedisClient()?.ping()"` against provisioned Redis endpoint.
- **Expected Outcome:** Secure TLS handshake, PONG received, pub/sub latency < 5ms.
- **Evidence:** Requires live AWS ElastiCache / Upstash Redis cluster.
- **Status:** **PENDING - REQUIRES EXTERNAL INFRASTRUCTURE**

### 9. Database TLS & Access Restrictions
- **Control:** RDS parameter group enforces `rds.force_ssl = 1`; `DATABASE_URL` requires `?sslmode=require`; private VPC subnet placement.
- **Verification Procedure:** Check RDS parameter group via AWS CLI and verify `DATABASE_URL` fails fast without SSL.
- **Expected Outcome:** Plaintext connections rejected by RDS; connection string verified by `src/lib/env.ts`.
- **Evidence:** Local SSL enforcement verified in `tests/environment-validation.test.ts` subtest 4. Real RDS requires operator provisioning.
- **Status:** **PENDING - REQUIRES EXTERNAL INFRASTRUCTURE**

### 10. Private Storage & Signed URLs
- **Control:** S3 Block Public Access; private assets served exclusively via 15-minute HMAC-SHA256 signed URLs.
- **Verification Procedure:** Run `tests/phase12-production-security.test.ts` subtest S.
- **Expected Outcome:** Tampered tokens, expired timestamps, or altered file keys return 403 Forbidden.
- **Evidence:** `tests/phase12-production-security.test.ts` subtest S passed.
- **Status:** **PASS - VERIFIED LOCALLY**

### 11. Upload Validation & SVG Sanitization
- **Control:** Magic-number inspection, 10MB file limit, and full-buffer SVG scanner stripping `<script>`, `<foreignObject>`, and event handlers.
- **Verification Procedure:** Run `tests/phase12b-security-hardening.test.ts` subtest 3.
- **Expected Outcome:** Malicious SVG files with stored XSS constructs rejected across full content length.
- **Evidence:** 6/6 SVG attack vectors rejected in subtest 3.
- **Status:** **PASS - VERIFIED LOCALLY**

### 12. Razorpay Webhook Signatures & Idempotency
- **Control:** Webhook requests verify `x-razorpay-signature` via HMAC-SHA256; duplicate deliveries deduplicated via `gatewayEventId`.
- **Verification Procedure:** Run `tests/phase12-production-security.test.ts` subtest K and L.
- **Expected Outcome:** Forged signatures rejected with 400; duplicate webhooks handled idempotently with 200.
- **Evidence:** `tests/phase12-production-security.test.ts` subtests K and L passed.
- **Status:** **PASS - VERIFIED LOCALLY**

### 13. Webhook Dead-Letter Queue (DLQ) Handling
- **Control:** Events failing 5 consecutive attempts transition to `DEAD_LETTER`; accessible only to authorized admins for audit and replay.
- **Verification Procedure:** Run `tests/phase12b-security-hardening.test.ts` subtest 4.
- **Expected Outcome:** Event at attempt 4 transitions to `DEAD_LETTER` upon 5th failure; admin can reset to `PENDING`.
- **Evidence:** `tests/phase12b-security-hardening.test.ts` subtest 4 passed.
- **Status:** **PASS - VERIFIED LOCALLY**

### 14. Financial Ledger Reconciliation
- **Control:** Automated double-entry audit engine comparing milestone payments, transactions, and invoice ledgers.
- **Verification Procedure:** Run `tests/phase12-production-security.test.ts` subtest N.
- **Expected Outcome:** Generates verifiable discrepancy report; records audited resolutions by admin.
- **Evidence:** `tests/phase12-production-security.test.ts` subtest N passed.
- **Status:** **PASS - VERIFIED LOCALLY**

### 15. Invoice & Contract Immutability
- **Control:** Executed contracts and paid invoices are locked against mutation or deletion; sequential invoice numbers generated atomically.
- **Verification Procedure:** Run `tests/phase10-contracts-invoices.test.ts` and `tests/phase12-production-security.test.ts` subtest I.
- **Expected Outcome:** Concurrent invoice creation produces unique sequential numbers without duplicates; signed snapshots immutable.
- **Evidence:** 10 concurrent requests produced 10 unique invoice numbers in subtest I.
- **Status:** **PASS - VERIFIED LOCALLY**

### 16. Cron Authentication
- **Control:** Maintenance routes (`/api/cron`) reject requests lacking the valid `x-cron-secret` header with 401.
- **Verification Procedure:** Run `tests/phase12-production-security.test.ts` subtests D and E.
- **Expected Outcome:** Unauthenticated requests rejected with 401; valid secret triggers job execution.
- **Evidence:** `tests/phase12-production-security.test.ts` subtests D and E passed.
- **Status:** **PASS - VERIFIED LOCALLY**

### 17. Log Redaction & Request-ID Propagation
- **Control:** Sensitive keys (`password`, `token`, `secret`, `authorization`) redacted from logs; `x-request-id` correlated across headers.
- **Verification Procedure:** Run `tests/phase12-production-security.test.ts` subtest V and `tests/auth-and-onboarding.test.ts` subtest 14.
- **Expected Outcome:** `x-request-id` header returned on all responses; sensitive tokens stripped from activity logs.
- **Evidence:** Subtest V passed; ActivityLog zero token leaks verified.
- **Status:** **PASS - VERIFIED LOCALLY**

### 18. Email Delivery & Retry Behavior
- **Control:** 5-minute idempotency deduplication cache; 3x exponential backoff for transient provider rate limits.
- **Verification Procedure:** Run `tests/phase12b-security-hardening.test.ts` subtest 7.
- **Expected Outcome:** Duplicate email dispatches within 5 minutes recognized and suppressed.
- **Evidence:** `tests/phase12b-security-hardening.test.ts` subtest 7 passed.
- **Status:** **PASS - VERIFIED LOCALLY**

### 19. Dependency & Vulnerability Checks
- **Control:** Node.js dependencies audited for known CVEs.
- **Verification Procedure:** Execute `npm audit` in terminal.
- **Expected Outcome:** Zero critical or high vulnerabilities.
- **Evidence:** Operator verification required on final release candidate.
- **Status:** **PENDING - OPERATOR ACTION**

### 20. Backup Restoration Drill
- **Control:** Automated RDS snapshots and WAL point-in-time recovery tested into an isolated staging VPC.
- **Verification Procedure:** Execute restoration procedure described in `docs/production-backup-restore.md`.
- **Expected Outcome:** Database restored successfully in < 30 minutes with zero data corruption.
- **Evidence:** Requires live AWS RDS instance to execute drill.
- **Status:** **PENDING - REQUIRES EXTERNAL INFRASTRUCTURE**

### 21. Incident Response & Credential Rotation
- **Control:** Operational procedure for rotating `DATABASE_URL`, `AUTH_SECRET`, `STORAGE_SIGNING_SECRET`, and Razorpay secrets without service interruption.
- **Verification Procedure:** Review and simulate rotation runbook in `docs/production-environment.md` Section 5.
- **Expected Outcome:** Secret rotation executes with zero downtime and graceful connection re-establishment.
- **Evidence:** Procedure documented; live simulation pending staging environment.
- **Status:** **PENDING - OPERATOR ACTION**
