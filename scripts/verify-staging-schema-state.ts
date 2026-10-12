import { Client } from "pg";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log("=== VERIFYING EXISTING STAGING DATABASE SCHEMA STATE ===");
  
  // 1. Tables check
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    ORDER BY table_name ASC
  `);
  const tables = tablesRes.rows.map(r => r.table_name);
  console.log("\n1. Added Tables in Staging DB:");
  console.log("  - BankAccount:", tables.includes("BankAccount"));
  console.log("  - ModerationReport:", tables.includes("ModerationReport"));
  console.log("  - InvoiceSequence:", tables.includes("InvoiceSequence"));

  // 2. Enum check
  const enumsRes = await client.query(`
    SELECT t.typname, e.enumlabel 
    FROM pg_type t 
    JOIN pg_enum e ON t.oid = e.enumtypid 
    ORDER BY t.typname, e.enumsortorder
  `);
  const enums = enumsRes.rows;
  console.log("\n2. Added Enums & Variants in Staging DB:");
  console.log("  - ModerationStatus enum present:", enums.some(e => e.typname === "ModerationStatus"));
  console.log("  - ContractStatus.DECLINED:", enums.some(e => e.typname === "ContractStatus" && e.enumlabel === "DECLINED"));
  const disputeVariants = ["UNDER_REVIEW", "EVIDENCE_REQUESTED", "ESCALATED", "RESOLVED_BUYER", "RESOLVED_CREATOR", "PARTIAL_RESOLUTION", "CLOSED"];
  const allDisputePresent = disputeVariants.every(v => enums.some(e => e.typname === "DisputeStatus" && e.enumlabel === v));
  console.log("  - All 7 DisputeStatus variants present:", allDisputePresent);
  const notificationVariants = ["CONTRACT", "INVOICE", "DISPUTE", "MODERATION", "ADMIN"];
  const allNotificationPresent = notificationVariants.every(v => enums.some(e => e.typname === "NotificationType" && e.enumlabel === v));
  console.log("  - All 5 NotificationType variants present:", allNotificationPresent);

  // 3. Columns check
  const colsRes = await client.query(`
    SELECT table_name, column_name, data_type, is_nullable, column_default 
    FROM information_schema.columns 
    WHERE table_schema = 'public'
  `);
  const cols = colsRes.rows;
  const hasCol = (t: string, c: string) => cols.some(x => x.table_name === t && x.column_name === c);

  console.log("\n3. Added Columns in Staging DB:");
  console.log("  - ActivityLog.projectId:", hasCol("ActivityLog", "projectId"));
  console.log("  - Contract.cancellationTerms:", hasCol("Contract", "cancellationTerms"));
  console.log("  - Contract.declineReason:", hasCol("Contract", "declineReason"));
  console.log("  - Contract.deliverablesText:", hasCol("Contract", "deliverablesText"));
  console.log("  - Contract.effectiveDate:", hasCol("Contract", "effectiveDate"));
  console.log("  - Contract.executedAt:", hasCol("Contract", "executedAt"));
  console.log("  - Contract.expiresAt:", hasCol("Contract", "expiresAt"));
  console.log("  - Contract.milestonesJson:", hasCol("Contract", "milestonesJson"));
  console.log("  - Contract.paymentTerms:", hasCol("Contract", "paymentTerms"));
  console.log("  - Contract.revisionTerms:", hasCol("Contract", "revisionTerms"));
  console.log("  - Contract.scopeOfWork:", hasCol("Contract", "scopeOfWork"));
  console.log("  - Contract.signedSnapshotJson:", hasCol("Contract", "signedSnapshotJson"));
  console.log("  - ContractParty.signatureDataUrl:", hasCol("ContractParty", "signatureDataUrl"));
  console.log("  - ContractParty.userAgent:", hasCol("ContractParty", "userAgent"));
  console.log("  - Dispute.adminNotes:", hasCol("Dispute", "adminNotes"));
  console.log("  - Dispute.category:", hasCol("Dispute", "category"));
  console.log("  - Dispute.contractId:", hasCol("Dispute", "contractId"));
  console.log("  - Dispute.refundAmount:", hasCol("Dispute", "refundAmount"));
  console.log("  - Dispute.releaseAmount:", hasCol("Dispute", "releaseAmount"));
  console.log("  - Dispute.resolutionAction:", hasCol("Dispute", "resolutionAction"));
  console.log("  - Dispute.resolvedAt:", hasCol("Dispute", "resolvedAt"));
  console.log("  - Dispute.resolvedById:", hasCol("Dispute", "resolvedById"));
  console.log("  - Invoice.itemsJson:", hasCol("Invoice", "itemsJson"));
  console.log("  - Invoice.milestoneId:", hasCol("Invoice", "milestoneId"));
  console.log("  - Invoice.milestonePaymentId:", hasCol("Invoice", "milestonePaymentId"));
  console.log("  - Invoice.notes:", hasCol("Invoice", "notes"));
  console.log("  - Invoice.paymentReference:", hasCol("Invoice", "paymentReference"));
  console.log("  - Invoice.platformFeeAmount:", hasCol("Invoice", "platformFeeAmount"));
  console.log("  - Invoice.projectId:", hasCol("Invoice", "projectId"));
  console.log("  - Invoice.subtotalAmount:", hasCol("Invoice", "subtotalAmount"));
  console.log("  - Milestone.freelancerId:", hasCol("Milestone", "freelancerId"));
  console.log("  - MilestonePayment.businessId:", hasCol("MilestonePayment", "businessId"));
  console.log("  - MilestonePayment.projectId:", hasCol("MilestonePayment", "projectId"));
  console.log("  - PaymentTransaction.businessId:", hasCol("PaymentTransaction", "businessId"));
  console.log("  - PaymentTransaction.payerId:", hasCol("PaymentTransaction", "payerId"));
  console.log("  - PaymentTransaction.paymentMethod:", hasCol("PaymentTransaction", "paymentMethod"));
  console.log("  - PaymentTransaction.rawResponseJson:", hasCol("PaymentTransaction", "rawResponseJson"));
  console.log("  - Payout.milestonePaymentId:", hasCol("Payout", "milestonePaymentId"));
  console.log("  - Payout.payoutMethod:", hasCol("Payout", "payoutMethod"));
  console.log("  - Payout.projectId:", hasCol("Payout", "projectId"));
  console.log("  - ProjectInvitation.tokenHash:", hasCol("ProjectInvitation", "tokenHash"));
  console.log("  - TeamInvitation.tokenHash:", hasCol("TeamInvitation", "tokenHash"));
  console.log("  - WebhookEvent.attempts:", hasCol("WebhookEvent", "attempts"));
  console.log("  - WebhookEvent.processingError:", hasCol("WebhookEvent", "processingError"));
  console.log("  - WebhookEvent.processingStatus:", hasCol("WebhookEvent", "processingStatus"));

  // 4. Foreign Keys
  const fkRes = await client.query(`
    SELECT conname, conrelid::regclass::text as table_name 
    FROM pg_constraint 
    WHERE contype = 'f' AND connamespace = 'public'::regnamespace
  `);
  const fks = fkRes.rows.map(r => r.conname);
  console.log("\n4. Added Foreign Keys in Staging DB:");
  console.log("  - Milestone_freelancerId_fkey:", fks.includes("Milestone_freelancerId_fkey"));
  console.log("  - PaymentTransaction_payerId_fkey:", fks.includes("PaymentTransaction_payerId_fkey"));
  console.log("  - Payout_milestonePaymentId_fkey:", fks.includes("Payout_milestonePaymentId_fkey"));
  console.log("  - Invoice_milestoneId_fkey:", fks.includes("Invoice_milestoneId_fkey"));
  console.log("  - BankAccount_userId_fkey:", fks.includes("BankAccount_userId_fkey"));
  console.log("  - Dispute_contractId_fkey:", fks.includes("Dispute_contractId_fkey"));
  console.log("  - Dispute_resolvedById_fkey:", fks.includes("Dispute_resolvedById_fkey"));
  console.log("  - ModerationReport_reporterId_fkey:", fks.includes("ModerationReport_reporterId_fkey"));
  console.log("  - ModerationReport_reviewedById_fkey:", fks.includes("ModerationReport_reviewedById_fkey"));

  // 5. Applied Migrations
  const migRes = await client.query(`SELECT migration_name, finished_at FROM _prisma_migrations ORDER BY finished_at ASC`);
  console.log("\n5. Currently Recorded Migrations in Staging DB _prisma_migrations:");
  console.log(migRes.rows);

  await client.end();
  console.log("\n=== ALL STAGING CHECKS COMPLETE ===");
}

main().catch(console.error);
