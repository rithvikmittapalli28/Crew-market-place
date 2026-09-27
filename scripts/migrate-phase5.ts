import { prisma } from "../src/lib/prisma";

async function main() {
  console.log("Applying Phase 5 schema migrations to PostgreSQL...");

  // 1. Milestone
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Milestone" ADD COLUMN IF NOT EXISTS "freelancerId" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Milestone_freelancerId_idx" ON "Milestone"("freelancerId");
  `);
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_freelancerId_fkey" 
      FOREIGN KEY ("freelancerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);
  } catch (e: any) {
    if (!e.message?.includes("already exists")) console.log("Note Milestone fkey:", e.message);
  }

  // 2. MilestonePayment
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "MilestonePayment" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "MilestonePayment" ADD COLUMN IF NOT EXISTS "businessId" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "MilestonePayment_projectId_idx" ON "MilestonePayment"("projectId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "MilestonePayment_businessId_idx" ON "MilestonePayment"("businessId");
  `);

  // 3. PaymentTransaction
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "businessId" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "payerId" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "paymentMethod" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "PaymentTransaction" ADD COLUMN IF NOT EXISTS "rawResponseJson" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PaymentTransaction_milestonePaymentId_idx" ON "PaymentTransaction"("milestonePaymentId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PaymentTransaction_businessId_idx" ON "PaymentTransaction"("businessId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "PaymentTransaction_payerId_idx" ON "PaymentTransaction"("payerId");
  `);
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "PaymentTransaction" ADD CONSTRAINT "PaymentTransaction_payerId_fkey" 
      FOREIGN KEY ("payerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    `);
  } catch (e: any) {
    if (!e.message?.includes("already exists")) console.log("Note PaymentTransaction fkey:", e.message);
  }

  // 4. PlatformFee unique constraint
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "PlatformFee" ADD CONSTRAINT "PlatformFee_transactionId_key" UNIQUE ("transactionId");
    `);
  } catch (e: any) {
    if (!e.message?.includes("already exists")) console.log("Note PlatformFee unique:", e.message);
  }

  // 5. Payout
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "milestonePaymentId" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Payout" ADD COLUMN IF NOT EXISTS "payoutMethod" TEXT NOT NULL DEFAULT 'BANK_TRANSFER';
  `);
  try {
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "Payout_milestonePaymentId_key" ON "Payout"("milestonePaymentId");
    `);
  } catch (e: any) {
    if (!e.message?.includes("already exists")) console.log("Note Payout unique idx:", e.message);
  }
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Payout_projectId_idx" ON "Payout"("projectId");
  `);
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "Payout" ADD CONSTRAINT "Payout_milestonePaymentId_fkey" 
      FOREIGN KEY ("milestonePaymentId") REFERENCES "MilestonePayment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    `);
  } catch (e: any) {
    if (!e.message?.includes("already exists")) console.log("Note Payout fkey:", e.message);
  }

  // 6. Invoice
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "projectId" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "milestonePaymentId" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "itemsJson" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Invoice_recipientId_idx" ON "Invoice"("recipientId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Invoice_projectId_idx" ON "Invoice"("projectId");
  `);
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "Invoice_milestonePaymentId_idx" ON "Invoice"("milestonePaymentId");
  `);

  // 7. WebhookEvent
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "processingStatus" TEXT NOT NULL DEFAULT 'PENDING';
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "processingError" TEXT;
  `);
  await prisma.$executeRawUnsafe(`
    ALTER TABLE "WebhookEvent" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;
  `);

  // 8. BankAccount model
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "BankAccount" (
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
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "BankAccount_pkey" PRIMARY KEY ("id")
    );
  `);
  try {
    await prisma.$executeRawUnsafe(`
      CREATE UNIQUE INDEX IF NOT EXISTS "BankAccount_userId_key" ON "BankAccount"("userId");
    `);
  } catch (e: any) {
    if (!e.message?.includes("already exists")) console.log("Note BankAccount unique:", e.message);
  }
  await prisma.$executeRawUnsafe(`
    CREATE INDEX IF NOT EXISTS "BankAccount_userId_idx" ON "BankAccount"("userId");
  `);
  try {
    await prisma.$executeRawUnsafe(`
      ALTER TABLE "BankAccount" ADD CONSTRAINT "BankAccount_userId_fkey" 
      FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    `);
  } catch (e: any) {
    if (!e.message?.includes("already exists")) console.log("Note BankAccount fkey:", e.message);
  }

  console.log("✅ Phase 5 schema additions successfully applied to PostgreSQL!");
}

main()
  .catch((e) => {
    console.error("Migration error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
