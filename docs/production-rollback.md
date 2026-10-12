# Crewn Production Rollback Runbook

This runbook defines the decision matrix, immediate operational steps, data integrity safeguards, and incident communication protocol for executing a controlled rollback of the Crewn production platform.

> [!CAUTION]
> **Financial & Data Safety Invariant:** Never automatically reverse or drop database tables or columns during an incident. Destructive down-migrations can permanently destroy financial records, payment transaction histories, active contracts, and audit trails. Crewn enforces an expand-and-contract forward-compatible schema strategy.

---

## 1. Rollback Decision Matrix

| Severity | Symptom / Trigger | Action | Target Resolution Time |
| :--- | :--- | :--- | :--- |
| **P0 — Critical** | App crashing on boot, HTTP 500 error rate > 5%, Database connectivity failure | Immediate Application Rollback | < 5 minutes |
| **P0 — Financial** | Payment webhook failures > 5%, Escrow balance discrepancy, DLQ spiking | Pause Checkout + Application Rollback | < 10 minutes |
| **P1 — High** | Core flow broken (contract signing, file uploads), p95 latency > 2000ms | Blue/Green Container Traffic Shift | < 15 minutes |
| **P2 — Medium** | Non-critical UI glitch, background job delay | Hotfix or Scheduled Rollback | < 1 hour |

---

## 2. Failed Deployment Detection

Automated alarms trigger an immediate rollback evaluation when:
1. **ALB / Container Health Checks Fail:** `/api/health` returns non-200 for 3 consecutive intervals (45 seconds).
2. **APM Error Spike:** Sentry or Datadog reports HTTP 5xx error rate > 1% in a 5-minute sliding window.
3. **Readiness Probe Failure:** `/api/ready` reports database or storage connection failure.
4. **Dead-Letter Queue Spiking:** Webhook failures reaching `attempts >= 5` exceed 10 events within 10 minutes.

---

## 3. Application Rollback Procedures

### Strategy: Zero-Downtime Container Traffic Shift

Because migrations are strictly forward-compatible, an application rollback requires **reverting container tasks to the previous stable release image** without touching the database.

#### A. AWS ECS Fargate Rollback
```bash
# 1. [OPERATOR COMMAND] Identify the previous stable task definition revision
aws ecs describe-services \
  --cluster crewn-production-cluster \
  --services crewn-web-service \
  --query "services[0].taskDefinition" --output text

# Example output: arn:aws:ecs:ap-south-1:123456789012:task-definition/crewn-web:42
# Rollback target is revision 41

# 2. [OPERATOR COMMAND] Update ECS service to use previous revision
aws ecs update-service \
  --cluster crewn-production-cluster \
  --service crewn-web-service \
  --task-definition crewn-web:41 \
  --force-new-deployment

# 3. Monitor rollout until stable
aws ecs wait services-stable \
  --cluster crewn-production-cluster \
  --service crewn-web-service

# 4. Verify healthy status
curl -f https://crewn.com/api/health
```

#### B. Vercel Enterprise Rollback
```bash
# 1. [OPERATOR COMMAND] List recent production deployments
vercel list --prod

# 2. [OPERATOR COMMAND] Rollback to previous deployment ID
vercel rollback <PREVIOUS_DEPLOYMENT_ID>
```

---

## 4. Database Compatibility During Rollback

### The Expand-and-Contract Migration Philosophy
Crewn adheres strictly to forward-compatible migrations:
1. **Expand Phase:** Add new nullable columns, new tables, or new enum variants. The old application code ignores these additions.
2. **Migrate Phase:** Backfill data while writing to both old and new structures.
3. **Contract Phase:** Drop deprecated columns in a future release only after all traffic has safely run on the new code for at least 14 days.

### Rules for Rollback:
- **Never execute down-migrations** (`DROP TABLE`, `DROP COLUMN`) during an emergency rollback.
- Newly added columns are nullable or have safe defaults; the previous container version continues executing normally without crashing.
- If a migration script failed mid-execution:
  - If DDL was aborted, check `_prisma_migrations` status.
  - If locks were held, cancel the blocking backend:
    ```sql
    SELECT pg_cancel_backend(pid) FROM pg_stat_activity 
    WHERE state != 'idle' AND query ILIKE '%ALTER TABLE%';
    ```

---

## 5. Webhook, Queue & Financial Recovery

If a deployment introduced a regression affecting payments or webhooks:
1. **Safety Guarantee:** Incoming Razorpay webhooks that failed processing are captured in the `WebhookEvent` table (`processingStatus = "DEAD_LETTER"`). **No financial events or payments are lost.**
2. **Replay Procedure:** After rolling back the application to the stable release:
   - Call `/api/cron?job=RETRY_FAILED_WEBHOOKS` with `x-cron-secret`.
   - Idempotency checks (`gatewayEventId` unique constraint) guarantee that events already processed are skipped and unprocessed events execute safely.
3. **Ledger Audit:**
   - Execute the financial reconciliation endpoint (`GET /api/admin/finance/reconciliation`) to verify zero discrepancies between milestone payments and captured transactions.

---

## 6. Session, Cache & Storage Integrity

- **User Sessions:** User sessions in the `Session` table remain valid across application rollbacks because session token hashes and cookies adhere to the stable SHA-256 schema.
- **Redis Cache:** If transient cache corruption is suspected, flush cache safely:
  - Flush non-persistent rate limit keys (`ratelimit:*`) if needed.
  - Distributed job locks auto-expire within their TTL (30–60 seconds).
- **Uploaded Files:** Files uploaded to S3 during the problematic window remain intact in the S3 bucket and are tracked in the `File` table. Unattached files will be evaluated by the daily `CLEANUP_ORPHANED_UPLOADS` job.

---

## 7. Incident Communication & Escalation

1. **Immediate Notification (< 5 min):** Post to `#incidents` Slack channel:
   ```
   🚨 INCIDENT DECLARED: P0/P1 Production Degradation
   Service: Crewn Web Platform
   Impact: [Brief summary: e.g., elevated 500 error rate]
   Action: Application rollback to previous revision initiated
   Commander: [On-call operator]
   ```
2. **Rollback Completion (< 15 min):** Confirm healthy probes and update channel:
   ```
   ✅ ROLLBACK COMPLETED: Service restored to revision [X]
   Health: /api/health returning 200 OK
   Status: Investigation ongoing; post-mortem scheduled
   ```
3. **Post-Mortem Requirements:** Conduct a blameless post-mortem within 48 hours documenting root cause, detection time, time to restore, and preventive action items.
