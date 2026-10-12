# Crewn Railway Staging Deployment & Operations Guide (Phase 12f)

This document provides the authoritative, verified operational runbook for deploying and operating the **Crewn** application in a controlled **Staging Environment** on **Railway**.

> [!IMPORTANT]
> **Staging Boundary & Safety Policies:**
> - Staging runs exclusively in **Razorpay Sandbox / Test Mode** (`rzp_test_*`). Real payments, live bank transfers, and real payouts are strictly prohibited.
> - Database operations are strictly additive and non-destructive. Commands such as `prisma migrate reset`, `prisma db push`, and manual drops are forbidden.
> - Zero credentials, tokens, or private keys are stored in source code. All secrets are managed in Railway's encrypted environment variables vault.

---

## 1. Verified Architecture

Crewn is architected as a continuous containerized service with private backend infrastructure:

```
                                  ┌─────────────────────────────┐
                                  │   Client / QA Web Browser   │
                                  └──────────────┬──────────────┘
                                                 │ HTTPS
                                  ┌──────────────▼──────────────┐
                                  │    Railway Edge Router      │ (TLS Termination)
                                  └──────────────┬──────────────┘
                                                 │
                                  ┌──────────────▼──────────────┐
                                  │   Crewn Web Service (App)   │
                                  │ Next.js 16 (Node 20/22 LTS) │
                                  └───┬──────────┬──────────┬───┘
                                      │          │          │
                 ┌────────────────────┘          │          └────────────────────┐
                 │ Private Mesh                  │ Private Mesh                  │ HTTPS (TLS 1.3)
        ┌────────▼────────┐             ┌────────▼────────┐             ┌────────▼────────┐
        │ Managed Postgres │             │  Managed Redis  │             │ Cloudflare R2 / │
        │  PostgreSQL 16  │             │   Redis 7 TLS   │             │     AWS S3      │
        │(railway.internal│             │(railway.internal│             │ (Private Bucket)│
        └─────────────────┘             └─────────────────┘             └─────────────────┘
                 │                               │                               │
        ┌────────▼────────┐             ┌────────▼────────┐             ┌────────▼────────┐
        │ Razorpay Sandbox│             │ Resend (Staging)│             │ Authenticated   │
        │ (rzp_test_*)    │             │ (re_*)          │             │ Scheduled Cron  │
        └─────────────────┘             └─────────────────┘             └─────────────────┘
```

- **Application Container:** Next.js 16 App Router on Node.js 20 LTS, running a persistent server process (`npm run start`).
- **Real-Time Communication:** Server-Sent Events (SSE) streaming connections on `/api/conversations/[id]/events` and `/api/notifications/events` supported by unbuffered reverse-proxy chunked transfer.
- **Event Bus & Rate Limiting:** Managed Redis 7 addon providing multi-instance pub/sub distribution and sliding-window rate limiting.
- **Relational Data:** Managed PostgreSQL 16 addon connected via Railway private mesh networking.
- **Object Storage:** Private S3-compatible bucket (Cloudflare R2 or AWS S3) with signed URL downloads via `STORAGE_SIGNING_SECRET`.

---

## 2. Railway Project Setup

To provision the staging project:
1. Navigate to the [Railway Dashboard](https://railway.com/dashboard).
2. Click **New Project** → **Empty Project**.
3. Name the project `crewn-staging`.
4. Ensure the deployment region is selected (e.g. `us-west1` or `asia-southeast1` depending on latency targets).

---

## 3. Application Service Setup

1. In the `crewn-staging` project, click **New** → **GitHub Repo** (or connect your local repo via Railway CLI once approved).
2. Select the Crewn repository and set branch to `master` (or `staging`).
3. Under service settings, Railway will automatically detect [railway.json](file:///c:/Users/Rithvik_mittapalli/Desktop/one%20to%20one/railway.json):
   - **Builder:** `NIXPACKS`
   - **Build Command:** `npm run build`
   - **Pre-Deploy Command:** `npx prisma migrate deploy`
   - **Start Command:** `npm run start`
   - **Healthcheck Path:** `/api/health`
   - **Healthcheck Timeout:** `100` seconds
   - **Draining Seconds:** `30` seconds

---

## 4. PostgreSQL and Redis Setup

1. **Add PostgreSQL:**
   - In the project canvas, click **New** → **Database** → **Add PostgreSQL**.
   - Railway will provision a dedicated PostgreSQL 16 instance.
2. **Add Redis:**
   - Click **New** → **Database** → **Add Redis**.
   - Railway will provision a dedicated Redis 7 instance.

---

## 5. Private Networking

Railway automatically provisions an isolated internal WireGuard mesh network for all services within the project:
- PostgreSQL internal hostname: `postgres.railway.internal:5432`
- Redis internal hostname: `redis.railway.internal:6379`
- Database and cache ports are NOT exposed to the public internet by default, preventing unauthorized external port scanning.
- In the Crewn App Service, reference variables from linked databases:
  - `DATABASE_URL`: `${{Postgres.DATABASE_URL}}`
  - `REDIS_URL`: `${{Redis.REDIS_URL}}`

---

## 6. Complete Environment-Variable Matrix

The following matrix documents every environment variable referenced in the Crewn codebase:

| Variable Name | Required | Server/Client | Secret? | Source / Injected By | Startup Validation | Purpose |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `NODE_ENV` | Yes | Server | No | Manual (`"production"`) | Validated (`"production"`) | Activates production mode, security headers, strict error masking. |
| `APP_ENV` | Yes | Server | No | Manual (`"staging"`) | Validated (`"staging"`) | Designates staging tier in health checks and telemetry. |
| `PORT` | Auto | Server | No | Railway injected | Checked by Next.js | Dynamic port assigned by Railway container runtime. |
| `APP_URL` | Yes | Server | No | Manual (e.g. `https://crewn-staging.up.railway.app`) | Validated HTTPS URL | Canonical base URL for auth redirects, emails, and webhooks. |
| `NEXT_PUBLIC_APP_URL` | Yes | Client | No | Manual (matches `APP_URL`) | Validated HTTPS URL | Public base URL used by client-side browser navigation. |
| `DATABASE_URL` | Yes | Server | Yes | Linked: `${{Postgres.DATABASE_URL}}` | Validated (must have SSL) | Primary PostgreSQL connection string. |
| `DATABASE_SSL` | Optional | Server | No | Manual (`"true"`) | Validated | Forces SSL validation in Prisma connection pool. |
| `DATABASE_SSL_REJECT_UNAUTHORIZED`| Optional | Server | No | Manual (`"false"` if self-signed) | Validated | Allows internal mesh self-signed certs if SSL is terminated internally. |
| `REDIS_URL` | Yes | Server | Yes | Linked: `${{Redis.REDIS_URL}}` | Validated in production | Redis connection for SSE Pub/Sub and rate limiting. |
| `AUTH_SECRET` | Yes | Server | Yes | Manual (`openssl rand -base64 32`) | Validated (min 32 chars) | HMAC signing key for user authentication sessions. |
| `STORAGE_SIGNING_SECRET` | Yes | Server | Yes | Manual (`openssl rand -hex 32`) | Validated (min 32 chars) | HMAC secret for signed private object storage URLs. |
| `CRON_SECRET` | Yes | Server | Yes | Manual (`openssl rand -hex 16`) | Validated (min 16 chars) | Bearer secret required in `x-cron-secret` for `/api/cron`. |
| `STORAGE_PROVIDER` | Yes | Server | No | Manual (`"s3"` or `"r2"`) | Validated (`!= "local"`) | Cloud object storage adapter. |
| `STORAGE_BUCKET` | Yes | Server | No | Manual (e.g. `crewn-staging-storage`) | Validated if s3/r2 | Target private bucket name. |
| `STORAGE_REGION` | Yes | Server | No | Manual (e.g. `ap-south-1` or `auto`) | Validated if s3/r2 | Cloud storage region. |
| `STORAGE_ENDPOINT` | If R2 | Server | No | Manual (Cloudflare R2 endpoint) | Used if custom endpoint | Custom endpoint URL for Cloudflare R2 / MinIO. |
| `STORAGE_ACCESS_KEY_ID` | Yes | Server | Yes | Manual (IAM / API Token) | Validated in production | Cloud storage access key ID. |
| `STORAGE_SECRET_ACCESS_KEY` | Yes | Server | Yes | Manual (IAM / API Token) | Validated in production | Cloud storage secret key. |
| `STORAGE_CDN_URL` | No | Server | No | Manual (optional CDN origin) | Optional | Optional CDN distribution domain. |
| `RAZORPAY_KEY_ID` | Yes | Server | Yes | Manual (`rzp_test_...`) | Validated (non-placeholder) | Sandbox merchant key ID for backend order creation. |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Yes | Client | No | Manual (`rzp_test_...`) | Validated | Sandbox key ID for client-side checkout modal. |
| `RAZORPAY_KEY_SECRET` | Yes | Server | Yes | Manual (Sandbox API Secret) | Validated (non-placeholder) | Sandbox merchant API secret. |
| `RAZORPAY_WEBHOOK_SECRET` | Yes | Server | Yes | Manual (Webhook Secret) | Validated (non-placeholder) | Shared HMAC secret for verifying Razorpay webhooks. |
| `RESEND_API_KEY` | Yes | Server | Yes | Manual (`re_...`) | Validated (starts with `re_`) | Resend API key for transactional emails. |
| `EMAIL_FROM` | Yes | Server | No | Manual (`Crewn Staging <noreply@...>`) | Optional | Verified sender address in RFC 5322 format. |
| `LOG_LEVEL` | No | Server | No | Manual (`"info"`) | Default: `"info"` | Log level: `debug`, `info`, `warn`, `error`. |

---

## 7. Storage and Email Setup

### Cloudflare R2 / AWS S3 Setup
1. Create a private bucket named `crewn-staging-storage`.
2. Ensure **Block all public access** is ENABLED. All asset access is gated via HMAC-signed URLs generated by `/api/files/[key]`.
3. Create an API token with `Object Read & Write` permissions scoped to that bucket.
4. Input `STORAGE_ACCESS_KEY_ID`, `STORAGE_SECRET_ACCESS_KEY`, `STORAGE_BUCKET`, and `STORAGE_REGION` in Railway variables.

### Resend Transactional Email Setup
1. Log into [Resend](https://resend.com).
2. Generate an API Key (e.g. `re_stage_...`).
3. Set `RESEND_API_KEY` and `EMAIL_FROM` in Railway.

---

## 8. Razorpay Test-Mode Configuration

1. Log into [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Toggle the switch in the top header to **Test Mode**.
3. Navigate to **Settings** → **API Keys** → Generate Test Key.
4. Note `Key ID` (`rzp_test_...`) and `Key Secret`.
5. Navigate to **Settings** → **Webhooks** → **Add New Webhook**:
   - **Webhook URL:** `https://<railway-domain>/api/webhooks/razorpay`
   - **Secret:** Generate a high-entropy string (e.g. `openssl rand -hex 24`).
   - **Active Events:**
     - `order.paid`
     - `payment.authorized`
     - `payment.captured`
     - `payment.failed`
     - `refund.processed`
     - `refund.failed`
6. Enter `RAZORPAY_KEY_ID`, `NEXT_PUBLIC_RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, and `RAZORPAY_WEBHOOK_SECRET` in Railway variables.

---

## 9. Deployment and Migration Procedure

Railway executes the release workflow deterministically:

1. **Build Phase:**
   Railway executes `npm run build`:
   - Runs `postinstall` script (`prisma generate`) ensuring Prisma Client types match `prisma/schema.prisma`.
   - Runs `next build` compiling and optimizing all 80 routes.
2. **Pre-Deploy Phase (Release Command):**
   Railway spawns an ephemeral container running:
   ```bash
   npx prisma migrate deploy
   ```
   - Connects to the Railway PostgreSQL database.
   - Applies the 4 sequential migrations:
     1. `20260923000000_init_and_auth_sessions`
     2. `20260923010000_creator_marketplace`
     3. `20260923020000_file_ownership_metadata`
     4. `20261012000000_phase12c_schema_alignment`
   - If migrations fail, the deployment immediately halts; traffic is NOT switched.
3. **Deploy Phase (Start Command):**
   Railway starts the application container with `npm run start` listening on `$PORT`.
4. **Health Check Probing:**
   Railway polls `/api/health` until HTTP 200 is returned. Once healthy, Railway seamlessly shifts traffic from the old deployment to the new container.

---

## 10. Health and Readiness Verification

Safe commands to verify deployment endpoints:

### Liveness Check (Public)
```bash
curl -i https://<railway-domain>/api/health
```
**Expected Response:**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{"status":"ok","timestamp":"2026-10-12T...","uptime":14}
```

### Readiness Check (Infrastructure Verification)
```bash
curl -i https://<railway-domain>/api/ready
```
**Expected Response:**
```json
HTTP/1.1 200 OK
Content-Type: application/json

{"status":"ready","timestamp":"2026-10-12T...","checks":{"database":"ok","storage":"ok","redis":"ok"}}
```
*(If database or storage is disconnected, returns HTTP 503 with `"status":"unready"` without leaking credentials).*

---

## 11. Webhook Testing

Test webhook delivery safely in staging:
1. In Razorpay Test Dashboard, use the **Send Test Event** feature on the configured webhook.
2. Verify that `/api/webhooks/razorpay` receives the payload, verifies the HMAC-SHA256 signature, records the event in `WebhookEvent`, and returns HTTP 200.
3. Verify deduplication by resending the exact same test payload; Crewn responds with HTTP 200 indicating idempotency (`already processed`).

---

## 12. Scheduled Maintenance (Cron) Configuration

Crewn's maintenance tasks (escrow auto-release, dispute resolution timeouts, expired session cleanup) run via `/api/cron`.

1. **Option A: Railway Scheduled Service:**
   Create a lightweight cron service in Railway executing:
   ```bash
   curl -s -X POST -H "x-cron-secret: $CRON_SECRET" https://crewn-staging.up.railway.app/api/cron
   ```
   Schedule: `*/15 * * * *` (every 15 minutes).
2. **Option B: GitHub Actions / External Cron (cron-job.org):**
   Configure an external HTTP trigger hitting `https://<railway-domain>/api/cron` with header `x-cron-secret: <CRON_SECRET>` every 15 minutes.

---

## 13. Staging Smoke Tests

Once staging is live, run the following verification checklist:
1. **Homepage & SSR:** Browse `https://<railway-domain>/` and verify dynamic server rendering.
2. **User Authentication:** Register a new user, log in, verify session cookie is set with `HttpOnly; Secure; SameSite=Lax`.
3. **Realtime SSE:** Open two browser tabs logged in as the same user; trigger a notification and verify real-time delivery via `/api/notifications/events`.
4. **File Upload & Private Download:** Upload a portfolio item; verify file is uploaded to private S3/R2 storage and download URL is generated with valid HMAC signature.
5. **Sandbox Payment Order:** Initiate milestone funding using Razorpay Sandbox test credentials (`rzp_test_...`); verify payment modal opens and order is verified without live charges.

---

## 14. Rollback Procedure

### Application Rollback
- In Railway Dashboard, go to **Deployments**.
- Locate the previous healthy deployment.
- Click **Redeploy** on that deployment.
- Railway immediately switches traffic back to the prior container image (typical duration: < 10 seconds).

### Database Rollback Strategy
- The corrective migration `20261012000000_phase12c_schema_alignment` is strictly **additive**:
  - Adds new nullable columns or columns with safe defaults.
  - Adds new standalone tables (`BankAccount`, `ModerationReport`, `InvoiceSequence`).
  - Adds new enum variants.
- Because no existing columns or tables were dropped or renamed, the previous application version runs compatibly against the updated schema.
- In case of catastrophic database error, restore from Railway's automated daily PostgreSQL backup.

---

## 15. Troubleshooting Guide

| Issue | Root Cause | Remediation |
| :--- | :--- | :--- |
| **Deployment fails during build** | `npm run build` compilation error | Check Railway build logs; verify TypeScript errors (`npm run type-check`) and Prisma generation (`npx prisma generate`). |
| **Pre-deploy migration timeout** | Database not ready or network unreachable | Ensure PostgreSQL addon is linked and healthy in Railway canvas; verify `DATABASE_URL` references `${{Postgres.DATABASE_URL}}`. |
| **`/api/ready` returns 503** | One of `database`, `storage`, or `redis` is failing | Check `/api/ready` response `checks` object. If `redis: "failed"`, verify `REDIS_URL`. If `storage: "failed"`, check S3 credentials. |
| **Cron returns 401 Unauthorized** | Missing or incorrect `x-cron-secret` | Ensure cron trigger passes `x-cron-secret` header exactly matching the `CRON_SECRET` environment variable. |
| **SSE connections drop after 30s** | Reverse proxy timeout | Crewn sends heartbeat ping (`: ping\n\n`) every 15 seconds. Ensure browser client remains connected and tab is active. |

---

## 16. Estimated Recurring Costs

> [!NOTE]
> All figures below are **estimates**, not guarantees. Prices must be verified against current provider pricing schedules prior to provisioning.

| Service | Tier / Resources | Estimated Monthly Cost | Notes |
| :--- | :--- | :--- | :--- |
| **Railway Base Plan** | Hobby / Pro | $5.00 / month | Platform base subscription |
| **Crewn Web App Service** | ~512 MB RAM, 0.5 vCPU | ~$3.00 – $5.00 / month | Usage-based compute ($0.000231/GB-hr, $0.000463/vCPU-hr) |
| **Railway PostgreSQL 16** | ~512 MB RAM, 1 GB storage | ~$3.00 – $5.00 / month | Usage-based |
| **Railway Redis 7** | ~256 MB RAM | ~$2.00 – $3.00 / month | Usage-based |
| **Cloudflare R2 / AWS S3** | < 10 GB storage | $0.00 / month | Free tier covers staging volume |
| **Razorpay Sandbox** | Test Mode | $0.00 / month | Free |
| **Resend Email** | < 3,000 emails/month | $0.00 / month | Free tier |
| **Estimated Total** | — | **~$13.00 – $18.00 / month** | Billed directly by Railway |
