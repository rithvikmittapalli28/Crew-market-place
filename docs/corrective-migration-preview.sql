-- CreateEnum
CREATE TYPE "ModerationStatus" AS ENUM ('PENDING', 'INVESTIGATING', 'ACTION_TAKEN_WARNING', 'ACTION_TAKEN_SUSPENDED', 'ACTION_TAKEN_CONTENT_REMOVED', 'RESOLVED_NO_ACTION', 'DISMISSED');

-- AlterEnum
ALTER TYPE "ContractStatus" ADD VALUE 'DECLINED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "DisputeStatus" ADD VALUE 'UNDER_REVIEW';
ALTER TYPE "DisputeStatus" ADD VALUE 'EVIDENCE_REQUESTED';
ALTER TYPE "DisputeStatus" ADD VALUE 'ESCALATED';
ALTER TYPE "DisputeStatus" ADD VALUE 'RESOLVED_BUYER';
ALTER TYPE "DisputeStatus" ADD VALUE 'RESOLVED_CREATOR';
ALTER TYPE "DisputeStatus" ADD VALUE 'PARTIAL_RESOLUTION';
ALTER TYPE "DisputeStatus" ADD VALUE 'CLOSED';

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'CONTRACT';
ALTER TYPE "NotificationType" ADD VALUE 'INVOICE';
ALTER TYPE "NotificationType" ADD VALUE 'DISPUTE';
ALTER TYPE "NotificationType" ADD VALUE 'MODERATION';
ALTER TYPE "NotificationType" ADD VALUE 'ADMIN';

-- AlterTable
ALTER TABLE "ActivityLog" ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "cancellationTerms" TEXT,
ADD COLUMN     "declineReason" TEXT,
ADD COLUMN     "deliverablesText" TEXT,
ADD COLUMN     "effectiveDate" TIMESTAMP(3),
ADD COLUMN     "executedAt" TIMESTAMP(3),
ADD COLUMN     "expiresAt" TIMESTAMP(3),
ADD COLUMN     "milestonesJson" TEXT,
ADD COLUMN     "paymentTerms" TEXT,
ADD COLUMN     "revisionTerms" TEXT,
ADD COLUMN     "scopeOfWork" TEXT,
ADD COLUMN     "signedSnapshotJson" TEXT;

-- AlterTable
ALTER TABLE "ContractParty" ADD COLUMN     "signatureDataUrl" TEXT,
ADD COLUMN     "userAgent" TEXT;

-- AlterTable
ALTER TABLE "Dispute" ADD COLUMN     "adminNotes" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "contractId" TEXT,
ADD COLUMN     "refundAmount" DECIMAL(10,2),
ADD COLUMN     "releaseAmount" DECIMAL(10,2),
ADD COLUMN     "resolutionAction" TEXT,
ADD COLUMN     "resolvedAt" TIMESTAMP(3),
ADD COLUMN     "resolvedById" TEXT;

-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "itemsJson" TEXT,
ADD COLUMN     "milestoneId" TEXT,
ADD COLUMN     "milestonePaymentId" TEXT,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "paymentReference" TEXT,
ADD COLUMN     "platformFeeAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.0,
ADD COLUMN     "projectId" TEXT,
ADD COLUMN     "subtotalAmount" DECIMAL(10,2) NOT NULL DEFAULT 0.0;

-- AlterTable
ALTER TABLE "Milestone" ADD COLUMN     "freelancerId" TEXT;

-- AlterTable
ALTER TABLE "MilestonePayment" ADD COLUMN     "businessId" TEXT,
ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "PaymentTransaction" ADD COLUMN     "businessId" TEXT,
ADD COLUMN     "payerId" TEXT,
ADD COLUMN     "paymentMethod" TEXT,
ADD COLUMN     "rawResponseJson" TEXT;

-- AlterTable
ALTER TABLE "Payout" ADD COLUMN     "milestonePaymentId" TEXT,
ADD COLUMN     "payoutMethod" TEXT NOT NULL DEFAULT 'BANK_TRANSFER',
ADD COLUMN     "projectId" TEXT;

-- AlterTable
ALTER TABLE "ProjectInvitation" ADD COLUMN     "tokenHash" TEXT;

-- AlterTable
ALTER TABLE "TeamInvitation" ADD COLUMN     "tokenHash" TEXT;

-- AlterTable
ALTER TABLE "WebhookEvent" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "processingError" TEXT,
ADD COLUMN     "processingStatus" TEXT NOT NULL DEFAULT 'PENDING';

-- CreateTable
CREATE TABLE "BankAccount" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "accountNumberMasked" TEXT NOT NULL,
    "accountNumberEncrypted" TEXT NOT NULL,
    "ifscCode" TEXT NOT NULL,
    "bankName" TEXT,
    "upiId" TEXT,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ModerationReport" (
    "id" TEXT NOT NULL,
    "reporterId" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "evidenceJson" TEXT,
    "status" "ModerationStatus" NOT NULL DEFAULT 'PENDING',
    "adminNotes" TEXT,
    "actionTaken" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ModerationReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceSequence" (
    "id" TEXT NOT NULL,
    "lastSeq" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InvoiceSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BankAccount_userId_key" ON "BankAccount"("userId");

-- CreateIndex
CREATE INDEX "BankAccount_userId_idx" ON "BankAccount"("userId");

-- CreateIndex
CREATE INDEX "ModerationReport_reporterId_idx" ON "ModerationReport"("reporterId");

-- CreateIndex
CREATE INDEX "ModerationReport_targetType_targetId_idx" ON "ModerationReport"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "ModerationReport_status_idx" ON "ModerationReport"("status");

-- CreateIndex
CREATE INDEX "ActivityLog_projectId_idx" ON "ActivityLog"("projectId");

-- CreateIndex
CREATE INDEX "ActivityLog_projectId_createdAt_idx" ON "ActivityLog"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "CreatorInquiry_serviceId_idx" ON "CreatorInquiry"("serviceId");

-- CreateIndex
CREATE INDEX "DeliverableVersion_submittedById_idx" ON "DeliverableVersion"("submittedById");

-- CreateIndex
CREATE INDEX "Dispute_contractId_idx" ON "Dispute"("contractId");

-- CreateIndex
CREATE INDEX "Dispute_initiatorId_idx" ON "Dispute"("initiatorId");

-- CreateIndex
CREATE INDEX "Dispute_respondentId_idx" ON "Dispute"("respondentId");

-- CreateIndex
CREATE INDEX "DisputeMessage_senderId_idx" ON "DisputeMessage"("senderId");

-- CreateIndex
CREATE INDEX "DisputeMessage_attachmentFileId_idx" ON "DisputeMessage"("attachmentFileId");

-- CreateIndex
CREATE INDEX "File_taskId_idx" ON "File"("taskId");

-- CreateIndex
CREATE INDEX "Invoice_recipientId_idx" ON "Invoice"("recipientId");

-- CreateIndex
CREATE INDEX "Invoice_projectId_idx" ON "Invoice"("projectId");

-- CreateIndex
CREATE INDEX "Invoice_milestonePaymentId_idx" ON "Invoice"("milestonePaymentId");

-- CreateIndex
CREATE INDEX "Invoice_milestoneId_idx" ON "Invoice"("milestoneId");

-- CreateIndex
CREATE INDEX "Milestone_freelancerId_idx" ON "Milestone"("freelancerId");

-- CreateIndex
CREATE INDEX "MilestonePayment_projectId_idx" ON "MilestonePayment"("projectId");

-- CreateIndex
CREATE INDEX "MilestonePayment_businessId_idx" ON "MilestonePayment"("businessId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_milestonePaymentId_idx" ON "PaymentTransaction"("milestonePaymentId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_businessId_idx" ON "PaymentTransaction"("businessId");

-- CreateIndex
CREATE INDEX "PaymentTransaction_payerId_idx" ON "PaymentTransaction"("payerId");

-- CreateIndex
CREATE UNIQUE INDEX "Payout_milestonePaymentId_key" ON "Payout"("milestonePaymentId");

-- CreateIndex
CREATE INDEX "Payout_projectId_idx" ON "Payout"("projectId");

-- CreateIndex
CREATE UNIQUE INDEX "PlatformFee_transactionId_key" ON "PlatformFee"("transactionId");

-- CreateIndex
CREATE INDEX "PortfolioItem_coverFileId_idx" ON "PortfolioItem"("coverFileId");

-- CreateIndex
CREATE INDEX "ProjectInvitation_tokenHash_idx" ON "ProjectInvitation"("tokenHash");

-- CreateIndex
CREATE INDEX "TaskStatusHistory_changedById_idx" ON "TaskStatusHistory"("changedById");

-- CreateIndex
CREATE INDEX "TeamInvitation_tokenHash_idx" ON "TeamInvitation"("tokenHash");

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_freelancerId_fkey" FOREIGN KEY ("freelancerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_payerId_fkey" FOREIGN KEY ("payerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payout" ADD CONSTRAINT "Payout_milestonePaymentId_fkey" FOREIGN KEY ("milestonePaymentId") REFERENCES "MilestonePayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Dispute" ADD CONSTRAINT "Dispute_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationReport" ADD CONSTRAINT "ModerationReport_reporterId_fkey" FOREIGN KEY ("reporterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ModerationReport" ADD CONSTRAINT "ModerationReport_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

