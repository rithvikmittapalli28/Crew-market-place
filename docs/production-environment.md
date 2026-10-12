# Crewn Production Environment Specification

This document provides the authoritative inventory, security classification, dependency mapping, and validation requirements for all environment variables used across the Crewn platform.

> [!IMPORTANT]
> **Strict Secret Policy:** This document contains zero actual secrets, passwords, tokens, private keys, or credentials. All example values use explicit `<PLACEHOLDER>` tags.

---

## 1. Environment Variable Security Tiers

Every environment variable belongs to one of four strict categories:

1. **PUBLIC / Client-Exposed (`NEXT_PUBLIC_*`):** Included in the client-side JavaScript bundle. Must never contain passwords, private keys, or internal tokens.
2. **SERVER_ONLY Configuration:** Process-level architectural flags, endpoints, regions, and non-sensitive options accessible only to server-side code.
3. **SECRET Credentials:** Cryptographic secrets, authentication signing keys, and vendor API keys accessible only to server-side code. Must be injected via AWS Secrets Manager.
4. **OPTIONAL Development-Only Configuration:** Local emulator overrides, developer directory paths, and debug flags.

---

## 2. Complete Environment Variable Inventory

### Category 1: Public / Client-Exposed Configuration

#### `NEXT_PUBLIC_APP_URL`
- **Category:** Public / Client-Exposed
- **Purpose:** Canonical public URL for the Crewn web application. Used for absolute link generation, CORS validation, and CSP frame origins.
- **Required in Production:** **YES**
- **Dependent Features:** Client navigation, email link templates, SEO sitemaps, payment return callbacks.
- **Startup Fails if Missing in Prod:** **YES** (validated by `src/lib/env.ts`; must be HTTPS and reject `localhost`).
- **Separate Values per Env:**
  - *Development:* `http://localhost:3000`
  - *Staging:* `https://staging.crewn.com`
  - *Production:* `https://crewn.com`
- **Where Configured:** Cloud container task definition / Vercel Environment Variables.
- **Example (Placeholder):** `https://crewn.com`

#### `NEXT_PUBLIC_RAZORPAY_KEY_ID`
- **Category:** Public / Client-Exposed
- **Purpose:** Public Merchant Key ID for the client-side Razorpay modal (`checkout.js`).
- **Required in Production:** **YES**
- **Dependent Features:** Razorpay payment modal, escrow milestone funding flow.
- **Startup Fails if Missing in Prod:** **YES** (must match `RAZORPAY_KEY_ID`).
- **Separate Values per Env:**
  - *Development / Staging:* `<RZP_TEST_KEY_ID_PLACEHOLDER>` (`rzp_test_...`)
  - *Production:* `<RZP_LIVE_KEY_ID_PLACEHOLDER>` (`rzp_live_...`)
- **Where Configured:** Container task definition / Vercel Environment Variables.
- **Example (Placeholder):** `rzp_live_PLACEHOLDER_KEY_ID`

---

### Category 2: Server-Only Configuration

#### `NODE_ENV`
- **Category:** Server-Only Configuration
- **Purpose:** Controls runtime optimization, strict security header policies, and fail-fast environment validation.
- **Required in Production:** **YES** (must be `"production"`).
- **Dependent Features:** Whole platform, CSP nonce generation, cookie `Secure` flag, error masking.
- **Startup Fails if Missing in Prod:** Defaults to `"development"`; production must set explicitly.
- **Separate Values per Env:**
  - *Development:* `development`
  - *Test:* `test`
  - *Production:* `production`
- **Where Configured:** Container launch specification / Dockerfile.

#### `APP_URL`
- **Category:** Server-Only Configuration
- **Purpose:** Server-side canonical base URL. Must match `NEXT_PUBLIC_APP_URL`.
- **Required in Production:** **YES**
- **Dependent Features:** Server-rendered links, email verification links, webhook callback verification.
- **Startup Fails if Missing in Prod:** **YES**
- **Separate Values per Env:** Separate per environment (matches `NEXT_PUBLIC_APP_URL`).
- **Where Configured:** Container task definition / Secrets Manager.

#### `STORAGE_PROVIDER`
- **Category:** Server-Only Configuration
- **Purpose:** Selects storage adapter implementation (`local`, `s3`, `r2`).
- **Required in Production:** **YES** (must be `"s3"` or `"r2"`).
- **Dependent Features:** Portfolio items, avatars, task attachments, deliverable uploads, invoice PDFs.
- **Startup Fails if Missing in Prod:** **YES** (`"local"` is rejected with error in production).
- **Separate Values per Env:**
  - *Development:* `local`
  - *Staging:* `s3`
  - *Production:* `s3`
- **Where Configured:** Secrets Manager / Task Definition.

#### `STORAGE_BUCKET` / `AWS_S3_BUCKET`
- **Category:** Server-Only Configuration
- **Purpose:** Target AWS S3 bucket name.
- **Required in Production:** **YES**
- **Dependent Features:** S3 storage provider file reads, uploads, and presigned URL generation.
- **Startup Fails if Missing in Prod:** **YES** (when `STORAGE_PROVIDER` is `"s3"`).
- **Separate Values per Env:**
  - *Staging:* `crewn-staging-storage`
  - *Production:* `crewn-production-storage`
- **Where Configured:** Secrets Manager / Task Definition.

#### `STORAGE_REGION` / `AWS_REGION`
- **Category:** Server-Only Configuration
- **Purpose:** AWS region for the provisioned S3 bucket.
- **Required in Production:** **YES** (e.g., `ap-south-1`).
- **Dependent Features:** S3 storage provider client initialization.
- **Startup Fails if Missing in Prod:** **YES**
- **Separate Values per Env:** Matches deployment region (e.g. `ap-south-1`).
- **Where Configured:** Secrets Manager / Task Definition.

#### `EMAIL_FROM`
- **Category:** Server-Only Configuration
- **Purpose:** Verified sender address used in RFC 5322 headers for transactional emails.
- **Required in Production:** **YES**
- **Dependent Features:** Email verification, password reset, deliverable review notifications.
- **Startup Fails if Missing in Prod:** **YES**
- **Separate Values per Env:**
  - *Development:* `Crewn Local <dev@crewn.local>`
  - *Staging:* `Crewn Staging <notifications@staging.crewn.com>`
  - *Production:* `Crewn Platform <no-reply@crewn.com>`
- **Where Configured:** Secrets Manager / Task Definition.

#### `LOG_LEVEL`
- **Category:** Server-Only Configuration
- **Purpose:** Minimum logging verbosity (`debug`, `info`, `warn`, `error`).
- **Required in Production:** Optional (defaults to `"info"`).
- **Dependent Features:** Structured JSON logger (`src/lib/logger.ts`).
- **Startup Fails if Missing in Prod:** NO (defaults to `"info"`).
- **Separate Values per Env:** Development: `"debug"`; Production: `"info"`.
- **Where Configured:** Task Definition.

#### `CORS_ALLOWED_ORIGINS`
- **Category:** Server-Only Configuration
- **Purpose:** Comma-separated list of allowed browser origins for cross-origin requests.
- **Required in Production:** Optional (defaults to `NEXT_PUBLIC_APP_URL`).
- **Dependent Features:** Next.js proxy / CORS guard (`src/proxy.ts`).
- **Startup Fails if Missing in Prod:** NO.
- **Where Configured:** Task Definition.

---

### Category 3: Secret Credentials

#### `DATABASE_URL`
- **Category:** Secret Credentials
- **Purpose:** PostgreSQL connection string for Prisma ORM and PgBouncer connection pool.
- **Required in Production:** **YES**
- **Dependent Features:** Entire database layer, authentication sessions, projects, payments, contracts.
- **Startup Fails if Missing in Prod:** **YES** (fails if missing, pointing to localhost, or lacking SSL).
- **Separate Values per Env:** Distinct isolated database instance per environment.
- **Where Configured:** AWS Secrets Manager (`secret/crewn/production`).
- **Example (Placeholder):** `postgresql://<DB_USER>:<DB_PASSWORD>@<RDS_ENDPOINT>:5432/crewn_prod?sslmode=require&schema=public`

#### `AUTH_SECRET`
- **Category:** Secret Credentials
- **Purpose:** High-entropy secret for HMAC signing of session tokens and deterministic hashes.
- **Required in Production:** **YES** (minimum 32 characters; placeholders rejected).
- **Dependent Features:** Session verification, cookie integrity, password reset tokens, bank account encryption.
- **Startup Fails if Missing in Prod:** **YES**
- **Separate Values per Env:** Unique cryptographic value per environment (`openssl rand -base64 32`).
- **Where Configured:** AWS Secrets Manager.
- **Example (Placeholder):** `<RANDOM_64_CHAR_BASE64_STRING>`

#### `STORAGE_SIGNING_SECRET`
- **Category:** Secret Credentials
- **Purpose:** Dedicated high-entropy secret for HMAC-SHA256 signatures on short-lived private file download URLs.
- **Required in Production:** **YES** (minimum 32 characters; no fallback allowed).
- **Dependent Features:** Private deliverables, contract attachments, PDF downloads.
- **Startup Fails if Missing in Prod:** **YES**
- **Separate Values per Env:** Unique cryptographic value per environment (`openssl rand -hex 32`).
- **Where Configured:** AWS Secrets Manager.
- **Example (Placeholder):** `<RANDOM_64_CHAR_HEX_STRING>`

#### `CRON_SECRET`
- **Category:** Secret Credentials
- **Purpose:** Bearer secret for authenticating automated scheduler requests to `/api/cron`.
- **Required in Production:** **YES** (minimum 16 characters).
- **Dependent Features:** Session cleanup, orphaned upload cleanup, webhook DLQ retry, financial reconciliation.
- **Startup Fails if Missing in Prod:** **YES**
- **Separate Values per Env:** Unique cryptographic value per environment.
- **Where Configured:** AWS Secrets Manager.
- **Example (Placeholder):** `<RANDOM_32_CHAR_HEX_STRING>`

#### `REDIS_URL` / `UPSTASH_REDIS_REST_URL`
- **Category:** Secret Credentials
- **Purpose:** TLS-enforced connection URL for Redis distributed rate limiting, job locking, and realtime SSE.
- **Required in Production:** **YES** (must use `rediss://` or Upstash HTTPS; localhost rejected).
- **Dependent Features:** Distributed rate limiting, singleton job locks, multi-instance realtime message bus.
- **Startup Fails if Missing in Prod:** **YES**
- **Separate Values per Env:** Separate Redis cluster/database per environment.
- **Where Configured:** AWS Secrets Manager.
- **Example (Placeholder):** `rediss://default:<REDIS_TOKEN>@<CACHE_ENDPOINT>:6379`

#### `RAZORPAY_KEY_ID` & `RAZORPAY_KEY_SECRET`
- **Category:** Secret Credentials
- **Purpose:** Razorpay merchant credentials for order creation, escrow milestone transfers, and refunds.
- **Required in Production:** **YES** (must be live credentials in production; placeholders rejected).
- **Dependent Features:** Milestone funding, checkout order creation, payout transfers.
- **Startup Fails if Missing in Prod:** **YES**
- **Separate Values per Env:**
  - *Staging:* Razorpay Sandbox keys (`rzp_test_...`)
  - *Production:* Razorpay Live keys (`rzp_live_...`)
- **Where Configured:** AWS Secrets Manager.

#### `RAZORPAY_WEBHOOK_SECRET`
- **Category:** Secret Credentials
- **Purpose:** Shared secret for HMAC-SHA256 verification of Razorpay webhook events in `/api/webhooks/razorpay`.
- **Required in Production:** **YES**
- **Dependent Features:** Payment capture processing, refund synchronization, DLQ routing.
- **Startup Fails if Missing in Prod:** **YES**
- **Where Configured:** AWS Secrets Manager.

#### `RESEND_API_KEY`
- **Category:** Secret Credentials
- **Purpose:** Production API key for Resend transactional email API.
- **Required in Production:** **YES** (must begin with `re_`; placeholders rejected).
- **Dependent Features:** User email verification, password reset, critical security alerts.
- **Startup Fails if Missing in Prod:** **YES** (console fallback forbidden in production).
- **Where Configured:** AWS Secrets Manager.

#### `AWS_ACCESS_KEY_ID` & `AWS_SECRET_ACCESS_KEY`
- **Category:** Secret Credentials
- **Purpose:** AWS IAM credentials for S3 bucket operations (PutObject, GetObject, DeleteObject).
- **Required in Production:** **YES** (unless using AWS ECS Task Execution IAM roles).
- **Dependent Features:** Cloud object storage.
- **Startup Fails if Missing in Prod:** **YES** (if IAM Task Role is not used).
- **Where Configured:** AWS Secrets Manager / IAM Task Role.

---

### Category 4: Optional Development-Only Configuration

#### `STORAGE_LOCAL_DIR`
- **Category:** Optional Development-Only Configuration
- **Purpose:** Custom local filesystem directory for storing uploads when `STORAGE_PROVIDER="local"`.
- **Required in Production:** **NO** (forbidden in production).
- **Where Configured:** Local `.env` file only.

#### `OPENAI_API_KEY`
- **Category:** Optional Configuration
- **Purpose:** Optional LLM assistance for creator profile generation.
- **Required in Production:** Optional.
- **Where Configured:** AWS Secrets Manager (if enabled).
