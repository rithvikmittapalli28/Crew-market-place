# Crewn Production Deployment Runbook

**Platform:** Crewn — Creative Freelance Marketplace & Collaboration Platform  
**Target Architecture:**
- **Staging Platform (Selected):** Railway / Render (Containerized Node.js 20+ runtime, managed PostgreSQL 16 addon with SSL, managed Redis 7 addon with TLS, S3-compatible storage, Razorpay Sandbox, Resend test domain)
- **Production Platform:** Next.js 16 (App Router, Node.js standalone), AWS ECS Fargate, PostgreSQL 16 (RDS Multi-AZ), Redis 7 (ElastiCache / Upstash), AWS S3 (Private Object Storage), Razorpay (Live Payments & Webhooks), Resend (Transactional Email)  
**Operational Objective:** Controlled, deterministic, zero-downtime deployment for Staging and Production with verifiable pre-flight gates and rollback capabilities.

> [!IMPORTANT]
> **Production Safety Invariant:** Crewn must never be deployed blindly to live traffic. All external dependencies (Postgres, Redis, S3, Resend, Razorpay) must be provisioned and verified in a staging environment prior to production execution. Placeholders and development credentials are strictly forbidden.

---

## 1. System Architecture & External Service Dependencies

Crewn depends on mandatory external cloud subsystems across Staging and Production:

```
                                  ┌──────────────────────────┐
                                  │   Cloudflare / Route53   │ (DNSSEC, Apex, CNAME)
                                  └────────────┬─────────────┘
                                               │
                                  ┌────────────▼─────────────┐
                                  │   CDN / Edge Proxy       │ (TLS 1.3, DDoS, OWASP Top 10)
                                  └────────────┬─────────────┘
                                               │
                                  ┌────────────▼─────────────┐
                                  │   Application Runtime    │ (Railway / Render for Staging;
                                  │     Next.js 16 Node.js   │  AWS ECS Fargate for Production)
                                  └──┬─────────┬──────────┬──┘
                                     │         │          │
         ┌───────────────────────────┘         │          └──────────────────────────┐
         │                                     │                                     │
┌────────▼──────────┐                ┌─────────▼─────────┐                 ┌─────────▼─────────┐
│ Managed PostgreSQL│                │   Managed Redis   │                 │   Object Storage  │
│ PG 16 (SSL Enforced│                │ Redis 7 (TLS)     │                 │ S3 / S3-Compat    │
│ Connection Pooling│                │ Rate Limit / PubSub│                │ Block Public Access│
└───────────────────┘                └───────────────────┘                 └───────────────────┘
         │                                     │                                     │
         │                                     │                                     │
┌────────▼──────────┐                ┌─────────▼─────────┐                 ┌─────────▼─────────┐
│ Razorpay Gateway  │                │ Resend Delivery   │                 │ Secrets Mgmt      │
│ Sandbox (Staging) │                │ Transactional     │                 │ Env Config /      │
│ HMAC Webhook DLQ  │                │ SPF/DKIM/DMARC    │                 │ Secrets Manager   │
└───────────────────┘                └───────────────────┘                 └───────────────────┘
```

---

## 2. Deployment Prerequisites

Before executing a production deployment, ensure the following tools and authentications are available in your operator terminal:

1. **CLI Tools:**
   - Node.js `v20.x` or `v22.x` (`node --version`)
   - npm `v10.x` (`npm --version`)
   - AWS CLI `v2.x` (`aws --version`) authenticated with production deployment IAM role
   - PostgreSQL client `psql` (`psql --version`)
   - curl & jq for endpoint testing
2. **Repository Integrity:**
   ```bash
   git status
   # Working tree must be clean, on tagged production release commit (e.g. v1.0.0)
   ```
3. **Automated Verification Suite:**
   Run the local gatekeeper check before touching any cloud infrastructure:
   ```bash
   npm test
   # Expected: 157 passed, 0 failed
   npm run type-check
   # Expected: 0 errors
   npm run lint
   # Expected: 0 errors
   npm run build
   # Expected: 80/80 routes generated successfully
   ```

---

## 3. Environment Variable Provisioning

Production variables are retrieved dynamically from **AWS Secrets Manager** (`secret/crewn/production`) and injected into runtime container tasks. No `.env` files are stored in Docker images.

| Variable | Visibility | Minimum Requirement | Notes |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | SERVER | `"production"` | Activates strict security invariants |
| `DATABASE_URL` | SECRET | Postgres connection string | Must enforce SSL (`?sslmode=require`) |
| `AUTH_SECRET` | SECRET | 32+ characters | High-entropy session signing secret |
| `STORAGE_SIGNING_SECRET` | SECRET | 32+ characters | HMAC-SHA256 secret for signed private file URLs |
| `CRON_SECRET` | SECRET | 16+ characters | Secret for authenticating `/api/cron` maintenance |
| `STORAGE_PROVIDER` | SERVER | `"s3"` or `"r2"` | Local storage is strictly rejected in production |
| `STORAGE_BUCKET` / `AWS_S3_BUCKET`| SERVER | Bucket name | AWS S3 standard bucket in primary region |
| `STORAGE_REGION` / `AWS_REGION` | SERVER | Region string | e.g. `ap-south-1` |
| `REDIS_URL` | SECRET | `rediss://...` | TLS-enforced connection string |
| `RAZORPAY_KEY_ID` | SECRET | `rzp_live_...` | Live Merchant ID (no test or placeholder keys) |
| `RAZORPAY_KEY_SECRET` | SECRET | Live API Secret | Merchant Secret from Razorpay Dashboard |
| `RAZORPAY_WEBHOOK_SECRET` | SECRET | Shared Secret | Configured in Razorpay Webhooks dashboard |
| `NEXT_PUBLIC_APP_URL` | PUBLIC | `https://crewn.com` | Canonical HTTPS public origin |
| `RESEND_API_KEY` | SECRET | `re_...` | Live transactional sending key |
| `EMAIL_FROM` | SERVER | RFC 5322 address | e.g. `Crewn Platform <no-reply@crewn.com>` |

---

## 4. Database Provisioning & Secure Connection Configuration

1. **RDS PostgreSQL Sizing & Engine:**
   - Engine: PostgreSQL 16.x
   - Minimum Instance: `db.t4g.medium` (2 vCPU, 4GB RAM) for launch
   - Multi-AZ Deployment: **Enabled**
   - Storage: 50GB gp3 with storage autoscaling up to 500GB
   - Encryption: Encrypted at rest via AWS KMS (`alias/aws/rds`)
   - Parameter Group: Enforce `rds.force_ssl = 1`
2. **Network Isolation:**
   - Isolated in private database subnets across 2 AZs.
   - Security Group: Allow TCP port 5432 **only** from Application Security Group (`sg-crewn-ecs-app`).
   - Public accessibility: **Disabled**.
3. **PgBouncer Connection Pooling:**
   - Dedicated AWS RDS Proxy or PgBouncer container.
   - Max client connections: 200; Max backend connections: 40.
4. **Least-Privilege Database Users:**
   - `crewn_app_user`: DML privileges (`SELECT`, `INSERT`, `UPDATE`, `DELETE`) on `public.*`.
   - `crewn_migrator`: DDL privileges (`CREATE`, `ALTER`, `DROP`, `INDEX`) reserved for CI/CD migration tasks.

---

## 5. Database Migration Preflight & Deployment Procedure

### Migration Audit Finding & Resolution
The Crewn migration directory contains three baseline migrations:
1. `20260923000000_init_and_auth_sessions`
2. `20260923010000_creator_marketplace`
3. `20260923020000_file_ownership_metadata`

Subsequent phases (Phase 5 payments, Phase 10 contracts/invoices, Phase 11 admin moderation/disputes) were added to `prisma/schema.prisma` and applied via additive migrations.

### Verification Procedure on Clean Database
Before running migrations on production, verify migration status on staging or preflight runner:
```bash
# Example Operator Preflight Verification:
npx prisma migrate status
```

### Applying Migrations to Production
Migrations must run in an isolated ephemeral pre-deployment container task:
```bash
# Executed by deployment pipeline or operator task runner:
npx prisma migrate deploy
```

> [!CAUTION]
> Never run `prisma db push` or `prisma migrate reset` against staging or production. All schema changes must be forward-only and non-destructive.

---

## 6. Managed Redis Provisioning (TLS Enforced)

1. **Provider:** AWS ElastiCache for Redis (Redis 7.x) or Upstash Enterprise.
2. **Configuration:**
   - In-Transit Encryption (TLS): **Enabled** (`rediss://` protocol).
   - Redis `AUTH` token: **Enabled**.
   - At-Rest Encryption: **Enabled** (KMS).
   - Eviction Policy: `volatile-lru`.
3. **Testing Redis Connectivity:**
   ```bash
   # Test connectivity via application Redis module (requires operator VPN/bastion):
   npx tsx -e "import { getRedisClient } from './src/lib/redis/client'; const c = getRedisClient(); c ? c.ping().then(r => { console.log('Redis Ping:', r); process.exit(0); }) : console.log('Redis unconfigured');"
   ```

---

## 7. Private Object Storage Configuration (AWS S3)

1. **Bucket Creation:**
   ```bash
   # [OPERATOR SPECIFIC COMMAND]
   aws s3api create-bucket \
     --bucket crewn-production-storage \
     --region ap-south-1 \
     --create-bucket-configuration LocationConstraint=ap-south-1
   ```
2. **Enable Block Public Access (All 4 settings ON):**
   ```bash
   aws s3api put-public-access-block \
     --bucket crewn-production-storage \
     --public-access-block-configuration "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
   ```
3. **Enable Bucket Versioning:**
   ```bash
   aws s3api put-bucket-versioning \
     --bucket crewn-production-storage \
     --versioning-configuration Status=Enabled
   ```
4. **Lifecycle Rules:**
   - Expire incomplete multipart uploads after 7 days.
   - Expire `tmp/` scratch files after 1 day.

---

## 8. Transactional Email & DNS Verification (Resend)

1. **Domain Registration:** Add `crewn.com` to Resend Dashboard.
2. **DNS Records in Route 53 / Cloudflare:**
   - **SPF:** `TXT` `@` -> `v=spf1 include:resend.com ~all`
   - **DKIM:** `CNAME` `resend._domainkey` -> `resend._domainkey.resend.com`
   - **DMARC:** `TXT` `_dmarc` -> `v=DMARC1; p=reject; rua=mailto:dmarc-reports@crewn.com`
3. **Verification Command:**
   ```bash
   # [OPERATOR COMMAND]
   curl -X GET "https://api.resend.com/domains" \
     -H "Authorization: Bearer <RESEND_API_KEY>"
   # Verify status is "verified" for crewn.com
   ```

---

## 9. Razorpay Production Payment Gateway Configuration

1. **Live Key Generation:**
   - Log into Razorpay Dashboard in **Live Mode**.
   - Navigate to Settings -> API Keys -> Generate Key.
   - Set `RAZORPAY_KEY_ID="rzp_live_..."` and `RAZORPAY_KEY_SECRET`.
2. **Webhook Endpoint Configuration:**
   - Webhook URL: `https://crewn.com/api/webhooks/razorpay`
   - Secret: Store in `RAZORPAY_WEBHOOK_SECRET`
   - Active Events:
     - `payment.authorized`
     - `payment.captured`
     - `payment.failed`
     - `refund.processed`
     - `transfer.processed`
3. **Security Invariant:**
   All webhooks verify HMAC-SHA256 signatures via `src/app/api/webhooks/razorpay/route.ts`. Failed events route automatically to the Dead-Letter Queue (DLQ).

---

## 10. Background Cron Jobs & Maintenance Scheduling

Crewn includes periodic maintenance jobs in `src/app/api/cron/route.ts`:
- `CLEANUP_EXPIRED_SESSIONS`: Purges sessions past expiry and revoked sessions older than 7 days.
- `CLEANUP_ORPHANED_UPLOADS`: Purges unattached file uploads older than 24 hours.
- `RETRY_FAILED_WEBHOOKS`: Retries failed webhook events with exponential backoff (max 5 attempts).
- `RECONCILE_FINANCES`: Runs double-entry ledger audits comparing milestone payments, transaction records, and Razorpay logs.

### Triggering Scheduled Jobs
Configure AWS EventBridge Scheduler or Vercel Cron to invoke `/api/cron` every 15 minutes:
```bash
# Example Cron Trigger (replace <CRON_SECRET> with operator secret):
curl -X POST "https://crewn.com/api/cron?job=CLEANUP_EXPIRED_SESSIONS" \
  -H "x-cron-secret: <CRON_SECRET>"
```

---

## 11. Health & Readiness Verification

Crewn exposes two health and readiness endpoints:

### Liveness Probe: `/api/health`
- **Purpose:** Fast container health check for ALB target groups.
- **Verification:**
  ```bash
  curl -s -o /dev/null -w "%{http_code}\n" https://crewn.com/api/health
  # Expected: 200
  ```
- **Response Format:** `{ status: "ok", uptime: <number>, timestamp: "<ISO>" }` (Zero credentials leaked).

### Readiness Probe: `/api/ready`
- **Purpose:** Validates live PostgreSQL connection, S3 storage reachability, and Redis responsiveness.
- **Verification:**
  ```bash
  curl -s https://crewn.com/api/ready | jq .
  # Expected status: 200 { status: "ready", checks: { database: { status: "connected" }, storage: { status: "ready" } } }
  ```

---

## 12. Staging Deployment Guide (Railway / Render)

### A. Railway / Render Provisioning Sequence
1. **Create Staging Project:**
   - In Railway or Render dashboard, create project `crewn-staging`.
2. **Add PostgreSQL Addon:**
   - Provision PostgreSQL 16 plugin/addon.
   - Configure connection string: `DATABASE_URL` (ensure `?sslmode=require` is appended).
3. **Add Redis Addon:**
   - Provision Redis 7 plugin/addon.
   - Configure connection string: `REDIS_URL` (ensure `rediss://` TLS protocol is used).
4. **Deploy Application Service:**
   - Connect repository branch (e.g. `master` or `staging`).
   - Build Command: `npm run build`
   - Start Command: `npm run start`
   - Set Health Check Path: `/api/health`
5. **Set Environment Variables in Dashboard:**
   - `NODE_ENV=production`
   - `APP_ENV=staging`
   - `NEXT_PUBLIC_APP_URL=https://<your-staging-subdomain>.up.railway.app` (or render.com domain)
   - `AUTH_SECRET=<high-entropy-32-chars-random-string>`
   - `STORAGE_SIGNING_SECRET=<high-entropy-32-chars-random-string>`
   - `CRON_SECRET=<high-entropy-16-chars-random-string>`
   - `STORAGE_PROVIDER=s3`
   - `STORAGE_BUCKET=<staging-s3-or-r2-bucket>`
   - `STORAGE_REGION=<bucket-region>`
   - `STORAGE_ACCESS_KEY_ID=<staging-access-key>`
   - `STORAGE_SECRET_ACCESS_KEY=<staging-secret-key>`
   - `RAZORPAY_KEY_ID=<rzp_test_sandbox_key>`
   - `RAZORPAY_KEY_SECRET=<rzp_test_sandbox_secret>`
   - `RAZORPAY_WEBHOOK_SECRET=<rzp_test_webhook_secret>`
   - `NEXT_PUBLIC_RAZORPAY_KEY_ID=<rzp_test_sandbox_key>`
   - `RESEND_API_KEY=<re_test_api_key>`
   - `EMAIL_FROM=Crewn Staging <notifications@staging.crewn.com>`
6. **Pre-Deploy Migration Command:**
   - Set Release / Pre-Deploy Command: `npx prisma migrate deploy`

### B. Staging Smoke Test Sequence

Prior to cutover to live production traffic, execute the live verification script against the staging deployment:
```bash
# Run staging automated live verification suite:
npx tsx scripts/verify-phase12b-live.ts
# Expected: ALL 21/21 PHASE 12B LIVE SYSTEM CHECKS PASSED SUCCESSFULLY!
```

---

## 13. Production Deployment Execution Sequence

Execute the production deployment using a rolling update strategy:

```
[Step 1: Pre-Flight]
  ├── Verify all 157 automated tests pass (npm test)
  ├── Verify TypeScript (npm run type-check) and Lint (npm run lint)
  └── Check AWS Secrets Manager has all required production variables

[Step 2: Database Migration]
  ├── Execute pre-deployment migration task (npx prisma migrate deploy)
  └── Verify migration status (npx prisma migrate status -> "Database schema is up to date!")

[Step 3: Container Deployment]
  ├── Deploy new task definition to AWS ECS Fargate (or trigger Vercel production deploy)
  ├── ECS launches new tasks alongside old tasks (Minimum healthy percent: 100%, Maximum: 200%)
  └── ALB routes health check pings to /api/health

[Step 4: Readiness & Traffic Shift]
  ├── New tasks report healthy on /api/health and /api/ready
  ├── ALB shifts user traffic to new tasks
  └── Old container tasks gracefully terminate after draining connections

[Step 5: Post-Deployment Verification]
  ├── Verify homepage: curl -I https://crewn.com/ (200 OK with strict CSP nonces)
  ├── Verify API health: curl https://crewn.com/api/health (200 OK)
  ├── Verify readiness: curl https://crewn.com/api/ready (200 OK)
  └── Run smoke login with admin verification session
```

---

## 14. Post-Deployment Verification & Incident Escalation

1. **Immediate Health Check:**
   Verify `/api/health` and `/api/ready` return 200 OK.
2. **Monitor APM & CloudWatch Metrics:**
   - HTTP 5xx error rate: Target < 0.05%
   - Latency p95: Target < 350ms
   - Database connection count: Target < 40
3. **Escalation Contacts:**
   - **DevOps Lead:** On-call engineer via PagerDuty
   - **Security Lead:** security@crewn.com
   - **Payment Operations:** finance-ops@crewn.com

For rollback procedures, consult `docs/production-rollback.md`.
