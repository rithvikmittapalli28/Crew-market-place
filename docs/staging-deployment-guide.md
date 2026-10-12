# Crewn Staging Deployment Guide (Phase 12d)

This document specifies the exact configuration, environment variables, database migration sequence, and operational verification procedures for deploying **Crewn** to a controlled Staging environment.

> [!IMPORTANT]
> **Staging Environment Guardrails:**
> - Razorpay is configured strictly in **Sandbox / Test Mode** (`rzp_test_*`). Live payment processing, real funds transfers, and real payouts are strictly prohibited.
> - No destructive database commands (`prisma migrate reset`, `prisma db push`) may be run against any staging or production database.
> - All credentials and secrets must be injected via platform environment secret managers. Never commit secrets to source control.

---

## 1. Hosting Target Comparison: Railway vs. Render

Crewn requires a containerized or persistent Node.js 20+ runtime capable of supporting long-lived Server-Sent Events (SSE) streaming connections, managed PostgreSQL 16 with SSL, managed Redis 7 with TLS for distributed event delivery and rate limiting, and private S3-compatible storage.

| Evaluation Criteria | Railway | Render | Crewn Recommendation |
| :--- | :--- | :--- | :--- |
| **Node.js Runtime & Next.js 16** | Native persistent containers via Nixpacks / Dockerfile. No serverless execution timeouts. | Web Service container running `npm run start`. No serverless execution timeouts. | **Tie**: Both provide persistent Node.js processes needed for Next.js App Router. |
| **Server-Sent Events (SSE)** | Fully supported. HTTP reverse proxy preserves chunked streaming (`text/event-stream`) and keep-alive headers without proxy response buffering. | Supported. Response streaming is enabled by default on Web Services; 100-minute HTTP connection limits. | **Railway Advantage**: Zero configuration needed for SSE chunking and streaming heartbeats. |
| **Managed PostgreSQL** | 1-click Postgres addon in the same project. Private networking (zero egress cost/latency) + public SSL endpoint. | Managed PostgreSQL database addon. Dedicated connection string with SSL enforcement (`sslmode=require`). | **Railway Advantage**: Internal private DNS (`postgres.railway.internal`) improves query latency and connection pool performance. |
| **Managed Redis** | 1-click Redis addon in the same project. Provides `REDIS_URL` with TLS and pub/sub support. | Managed Redis addon available (Starter tier $7/mo) or external (Upstash Redis). | **Railway Advantage**: Built-in native Redis addon in same project with zero egress fees and full Redis Pub/Sub support. |
| **Pre-Deploy Migration** | Configurable "Pre-deploy Command" (`npx prisma migrate deploy`) in service settings. | Dedicated "Pre-Deploy Command" setting in dashboard or `render.yaml`. | **Tie**: Both support pre-deploy release commands that gate zero-downtime traffic switching. |
| **Cron Scheduling** | Scheduled cron service in project to trigger `/api/cron` with `x-cron-secret`. | Native Cron Job service executing `curl` with auth header. | **Tie**: Both provide automated cron execution. |
| **Pricing & Cost Structure** | Usage-based: $5/month base plan + compute resource consumption (~$10–$15/mo for App + Postgres + Redis). | Fixed tiers: Web Service ($7/mo) + Postgres ($7/mo) + Redis ($7/mo) = ~$21/mo. Free tier spins down after 15m and Postgres expires after 30 days (unsuitable for persistent staging). | **Railway Advantage**: Highly cost-effective for staging workloads with continuous uptime without cold starts. |

### Recommendation
**Railway** is the recommended staging host for Crewn because:
1. It offers native zero-configuration support for persistent Server-Sent Events (SSE) connections used by Crewn's real-time messaging and notification system.
2. It allows provisioning Next.js, PostgreSQL 16, and Redis 7 within a single unified project using private internal networking.
3. It natively supports the release phase (`npx prisma migrate deploy`) prior to switching traffic.

---

## 2. Service Architecture & Component Topology

```
                                  ┌─────────────────────────────┐
                                  │       Client Browser        │
                                  └──────────────┬──────────────┘
                                                 │ HTTPS
                                  ┌──────────────▼──────────────┐
                                  │   Platform Reverse Proxy    │ (SSL Termination)
                                  └──────────────┬──────────────┘
                                                 │
                                  ┌──────────────▼──────────────┐
                                  │    Next.js 16 Web Service   │
                                  │   (Port: $PORT, Node 20/22) │
                                  └───┬──────────┬──────────┬───┘
                                      │          │          │
                 ┌────────────────────┘          │          └────────────────────┐
                 │                               │                               │
        ┌────────▼────────┐             ┌────────▼────────┐             ┌────────▼────────┐
        │ Managed Postgres │             │  Managed Redis  │             │ Cloudflare R2 / │
        │  PostgreSQL 16  │             │   Redis 7 TLS   │             │     AWS S3      │
        │  (?sslmode=req) │             │ (Pub/Sub & Limit│             │ (Private Bucket)│
        └─────────────────┘             └─────────────────┘             └─────────────────┘
                 │                               │                               │
        ┌────────▼────────┐             ┌────────▼────────┐             ┌────────▼────────┐
        │ Razorpay Sandbox│             │ Resend (Staging)│             │ External Cron   │
        │ (rzp_test_*)    │             │ (re_*)          │             │ (x-cron-secret) │
        └─────────────────┘             └─────────────────┘             └─────────────────┘
```

---

## 3. Staging Deployment Commands

| Stage | Command | Purpose |
| :--- | :--- | :--- |
| **Build Command** | `npm run build` | Generates Prisma client via `postinstall` and compiles Next.js 16 App Router routes (80 routes). |
| **Pre-Deploy / Release Command** | `npx prisma migrate deploy` | Executes pending Prisma migrations forward against the staging database before the new container serves traffic. |
| **Start Command** | `npm run start` (or `next start -p $PORT`) | Starts the production Next.js HTTP server listening on the platform-assigned port. |
| **Health Check Path** | `/api/health` | Fast process liveness and uptime check (HTTP 200). |
| **Readiness Check Path** | `/api/ready` | Deep infrastructure check verifying Database connectivity, Storage provider, and Redis connection (HTTP 200/503). |

---

## 4. Staging Environment Variables Specification

All variables must be configured in the staging host's environment settings. **Never commit actual values to source control.**

| Variable Name | Required | Example Format | Purpose & Where Configured |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | `production` | Enables production optimizations and security headers. Set in App Service. |
| `APP_ENV` | Yes | `staging` | Designates staging tier in logs and health checks. Set in App Service. |
| `APP_URL` | Yes | `https://crewn-staging.up.railway.app` | Canonical base URL for invitations and links. Set in App Service. |
| `NEXT_PUBLIC_APP_URL` | Yes | `https://crewn-staging.up.railway.app` | Client-accessible application URL. Set in App Service. |
| `DATABASE_URL` | Yes | `postgresql://user:pass@host:5432/crewn?sslmode=require` | Managed PostgreSQL connection string with SSL. Provided by DB Addon. |
| `AUTH_SECRET` | Yes | `base64-random-32-chars-minimum` | HMAC session signing key (`openssl rand -base64 32`). Set in App Service. |
| `STORAGE_SIGNING_SECRET`| Yes | `hex-random-32-chars-minimum` | HMAC key for signed private file URLs (`openssl rand -hex 32`). Set in App Service. |
| `CRON_SECRET` | Yes | `random-16-chars-minimum` | Secret required in `x-cron-secret` header for `/api/cron`. Set in App Service & Cron. |
| `REDIS_URL` | Yes | `rediss://default:pass@host:6379` | Managed Redis TLS connection string for SSE event bus and rate limiting. Provided by Redis Addon. |
| `STORAGE_PROVIDER` | Yes | `s3` (or `r2`) | Object storage provider (`local` is prohibited in production/staging). Set in App Service. |
| `STORAGE_BUCKET` | Yes | `crewn-staging-storage` | S3 bucket name. Set in App Service. |
| `STORAGE_REGION` | Yes | `auto` (or `ap-south-1` / `us-east-1`) | Cloud storage region. Set in App Service. |
| `STORAGE_ENDPOINT` | If R2 | `https://<account-id>.r2.cloudflarestorage.com` | Endpoint URL if using Cloudflare R2 or MinIO. Set in App Service. |
| `STORAGE_ACCESS_KEY_ID` | Yes | `staging-storage-access-key` | Cloud storage access key ID. Set in App Service. |
| `STORAGE_SECRET_ACCESS_KEY`| Yes | `staging-storage-secret-key` | Cloud storage secret access key. Set in App Service. |
| `RAZORPAY_KEY_ID` | Yes | `rzp_test_xxxxxxxxxxxxxx` | Razorpay Sandbox Key ID (must begin with `rzp_test_`). Set in App Service. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID`| Yes | `rzp_test_xxxxxxxxxxxxxx` | Client-side Razorpay test key ID. Set in App Service. |
| `RAZORPAY_KEY_SECRET` | Yes | `sandbox-razorpay-secret` | Razorpay Sandbox Key Secret. Set in App Service. |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | `sandbox-webhook-secret` | Shared secret configured in Razorpay Webhooks dashboard. Set in App Service. |
| `RESEND_API_KEY` | Yes | `re_staging_xxxxxxxxxxxx` | Transactional email API key. Set in App Service. |
| `EMAIL_FROM` | Yes | `Crewn Staging <notifications@staging-domain.com>` | Verified sender address. Set in App Service. |
| `LOG_LEVEL` | No | `info` | Structured logging verbosity level (`debug`, `info`, `warn`, `error`). Set in App Service. |

---

## 5. Database Migration Safety & Playbooks

The Crewn migration history consists of 4 forward-only migrations:
1. `20260923000000_init_and_auth_sessions`
2. `20260923010000_creator_marketplace`
3. `20260923020000_file_ownership_metadata`
4. `20261012000000_phase12c_schema_alignment`

### Scenario A: Newly Provisioned Empty Staging Database
When deploying to a brand-new managed PostgreSQL instance:
1. Set `DATABASE_URL` in the environment.
2. The pre-deploy release command executes:
   ```bash
   npx prisma migrate deploy
   ```
3. Prisma will sequentially apply all 4 migrations:
   - Initializes `_prisma_migrations` audit table.
   - Creates all 57 application tables, 24 enums, indexes, and foreign keys.
4. Schema reaches 100% parity with `prisma/schema.prisma` with zero schema drift.

### Scenario B: Existing Staging Database (Containing Partial Schema)
If deploying to the existing database where tables were previously created:
1. **Safety Rule:** Never execute `npx prisma migrate deploy` blindly if the schema already contains tables from the corrective migration (it will error on duplicate table definitions).
2. **Safety Rule:** Never execute `prisma migrate reset` or drop the database.
3. **Reconciliation Procedure:**
   First audit the schema without modifying it:
   ```bash
   npx tsx scripts/verify-staging-schema-state.ts
   ```
   If all additive tables, columns, and enums exist, reconcile Prisma's migration log without re-executing the DDL:
   ```bash
   npx prisma migrate resolve --applied 20261012000000_phase12c_schema_alignment
   ```
4. Verify migration status:
   ```bash
   npx prisma migrate status
   # Expected: Database schema is up to date!
   ```

---

## 6. Rollback Procedures

### Application Rollback
If a deployment fails health checks or exhibits application errors:
1. **Instant Rollback:** Revert to the previous deployment in the platform dashboard (Railway / Render supports instant 1-click redeploy of the previous healthy image).
2. **Container Switch:** Traffic automatically routes back to the previously functioning container with zero downtime.

### Database Rollback Strategy
- The corrective migration `20261012000000_phase12c_schema_alignment` is strictly **additive and non-destructive**:
  - Adds nullable columns or columns with safe defaults.
  - Adds new standalone tables (`BankAccount`, `ModerationReport`, `InvoiceSequence`).
  - Adds enum variants.
- Because no existing columns or tables were deleted or renamed, the previous application version can safely run against the database even after the migration has been applied.
- If a catastrophic database issue occurs, restore from the automated platform snapshot created immediately prior to deployment.
