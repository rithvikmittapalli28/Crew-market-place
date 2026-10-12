# Crewn Production Backup & Disaster Recovery Runbook

This document defines the disaster recovery objectives, backup topologies, encryption standards, retention schedules, and step-by-step restoration procedures for the Crewn production environment.

> [!WARNING]
> **Operational Prerequisite Notice:** Automated backup mechanisms are provided by cloud infrastructure (AWS RDS, AWS S3, AWS ElastiCache). **Backups cannot be declared functional until a real backup-and-restore drill has been executed and validated in an isolated staging environment by the system operator.**

---

## 1. Disaster Recovery Objectives (Operator Confirmation Required)

The following metrics represent platform operational targets that must be confirmed by the system operator based on SLA tier:

| Metric | Target | Realization Strategy | Operator Status |
| :--- | :--- | :--- | :--- |
| **Recovery Point Objective (RPO)** | **< 5 Minutes** | Continuous PostgreSQL Write-Ahead Log (WAL) archiving to S3. | *Target proposed — Requires operator confirmation upon RDS provisioning* |
| **Recovery Time Objective (RTO)** | **< 30 Minutes** | Automated AWS RDS snapshot restoration / Point-in-Time Recovery. | *Target proposed — Requires operator confirmation upon drill execution* |
| **Storage Object RPO** | **0 Minutes** | AWS S3 Object Versioning enabled permanently. | *Target proposed — Requires S3 bucket provisioning* |

---

## 2. Backup Topology, Encryption & Retention

### A. Database (PostgreSQL)
- **Continuous Transaction Logs (WAL):** Continuous WAL stream to AWS S3. Retained for **35 days**. Enables point-in-time restoration to any second within the retention window.
- **Daily Automated Snapshots:** Captured daily at 02:00 UTC (off-peak). Retained for **30 days**.
- **Weekly Full Snapshots:** Replicated to secondary AWS region (`ap-southeast-1` Singapore) with AWS Backup Vault Lock. Retained for **90 days**.
- **Encryption:** Encrypted at rest using AWS KMS (`alias/aws/rds`). Encrypted in transit using TLS 1.3.
- **Access Control:** Backup snapshots are restricted to IAM administrator roles; deletion requires multi-factor authentication (MFA).

### B. Object Storage (AWS S3)
- **Bucket:** `crewn-production-storage`.
- **Versioning:** Permanent versioning enabled. Deletes create a versioned Delete Marker without destroying underlying data.
- **Cross-Region Replication (CRR):** S3 bucket replication to secondary disaster recovery bucket `crewn-production-storage-dr`.
- **Lifecycle Policy:** Non-current object versions transitioned to S3 Glacier after 30 days; expired after 90 days.
- **Encryption:** Server-Side Encryption with KMS (SSE-KMS) enforced.

### C. In-Memory Cache (Redis)
- **Recovery Expectations:** Redis stores transient sessions, sliding-window rate limit counters, distributed locks, and pub/sub message channels.
- **Recovery Policy:** In catastrophic cache failure, Redis can be re-provisioned empty. Active user sessions are stored in PostgreSQL (`Session` table) and will re-hydrate. Distributed locks auto-expire. Rate limits reset safely.

---

## 3. Database Restoration Procedures

### Scenario A: Point-in-Time Recovery (PITR) into Isolated Environment
*Use when accidental data corruption, bad deployment, or malicious query occurred at a known timestamp.*

```bash
# 1. [OPERATOR COMMAND] Define target restore timestamp in UTC
RESTORE_TIME="2026-10-11T12:00:00Z"

# 2. [OPERATOR COMMAND] Restore RDS instance into an isolated test subnet
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier crewn-production-db \
  --target-db-instance-identifier crewn-prod-db-restored-isolated \
  --restore-time $RESTORE_TIME \
  --db-subnet-group-name crewn-isolated-recovery-subnet-group \
  --vpc-security-group-ids sg-crewn-isolated-db \
  --no-publicly-accessible

# 3. Wait for instance to become available
aws rds wait db-instance-available \
  --db-instance-identifier crewn-prod-db-restored-isolated

# 4. [OPERATOR COMMAND] Connect via isolated bastion and run data integrity check
psql "postgresql://crewn_admin@<RESTORED_ENDPOINT>:5432/crewn_production?sslmode=require" \
  -c "SELECT count(*) FROM \"User\"; SELECT count(*) FROM \"PaymentTransaction\"; SELECT count(*) FROM \"Contract\";"
```

### Scenario B: Full RDS Snapshot Restoration
*Use when the primary database cluster is unrecoverable.*

```bash
# 1. [OPERATOR COMMAND] Identify the latest available snapshot
LATEST_SNAP=$(aws rds describe-db-snapshots \
  --db-instance-identifier crewn-production-db \
  --query "DBSnapshots | sort_by(@, &SnapshotCreateTime)[-1].DBSnapshotIdentifier" \
  --output text)

# 2. Restore DB instance from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier crewn-prod-db-restored \
  --db-snapshot-identifier $LATEST_SNAP \
  --db-subnet-group-name crewn-prod-db-subnet-group \
  --vpc-security-group-ids sg-crewn-rds-app \
  --no-publicly-accessible

# 3. Wait for instance to reach available status
aws rds wait db-instance-available \
  --db-instance-identifier crewn-prod-db-restored
```

---

## 4. Object Storage (S3) Recovery Procedures

### Restoring Inadvertently Deleted Files (S3 Versioning)
```bash
# 1. [OPERATOR COMMAND] List latest Delete Markers for target storage key
aws s3api list-object-versions \
  --bucket crewn-production-storage \
  --prefix "deliverables/del_sample/" \
  --query "DeleteMarkers[?IsLatest==\`true\`].[Key,VersionId]"

# 2. [OPERATOR COMMAND] Delete the Delete Marker to restore the object
aws s3api delete-object \
  --bucket crewn-production-storage \
  --key "deliverables/del_sample/final.mp4" \
  --version-id "<DELETE_MARKER_VERSION_ID>"

# 3. Verify object is accessible
aws s3api head-object \
  --bucket crewn-production-storage \
  --key "deliverables/del_sample/final.mp4"
```

---

## 5. Post-Restore Application Verification & Integrity Checks

Before routing production user traffic to a restored database:

1. **Verify Prisma Schema Alignment:**
   ```bash
   npx prisma migrate status
   # Must return: "Database schema is up to date!"
   ```
2. **Execute Financial Reconciliation Check:**
   ```bash
   # Run automated financial audit against restored database:
   npx tsx -e "
     import { runFinancialReconciliation } from './src/lib/payments/reconciliation';
     runFinancialReconciliation().then(r => {
       console.log('Reconciliation Summary:', r.summary);
       process.exit(r.discrepancies.length === 0 ? 0 : 1);
     });
   "
   ```
3. **Verify Health and Readiness Probes:**
   ```bash
   curl -f http://localhost:3000/api/health
   curl -f http://localhost:3000/api/ready
   ```
4. **Session Invalidation:**
   Users whose sessions were generated after the restore point will naturally receive HTTP 401 and must log in again, maintaining security and data integrity.

---

## 6. Disaster Recovery Drill Schedule

To maintain continuous recovery readiness:
- **Bi-annual PITR Restoration Drill:** Restore production snapshot into an isolated VPC, execute integration test suite, record elapsed RTO.
- **Quarterly S3 Versioning Audit:** Verify versioning and cross-region replication status.
- **Annual Credential Rotation Drill:** Test end-to-end secret rotation across all cloud subsystems.
