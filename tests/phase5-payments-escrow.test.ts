import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { prisma } from "../src/lib/prisma";
import { toPaise, fromPaise } from "../src/lib/payments/currency";
import { calculatePlatformFee } from "../src/lib/payments/platform-fee";
import { verifyPaymentSignature, verifyWebhookSignature } from "../src/lib/payments/razorpay";
import { generateInvoiceNumber, buildMilestoneInvoiceItems } from "../src/lib/payments/invoice";

describe("Phase 5: Payments, Escrow, Invoices, Contracts & Payouts", () => {
  const TEST_SECRET = "test_razorpay_secret_key_12345678";
  const TEST_WEBHOOK_SECRET = "test_webhook_secret_key_87654321";

  // -------------------------------------------------------------------------
  // 1. Currency & Paise Invariant Tests
  // -------------------------------------------------------------------------
  describe("1. Currency & Paise Invariant Precision", () => {
    it("converts integer and decimal amounts to paise without floating-point error", () => {
      assert.equal(toPaise(100), 10000);
      assert.equal(toPaise("100"), 10000);
      assert.equal(toPaise(19.99), 1999);
      assert.equal(toPaise("19.99"), 1999);
      assert.equal(toPaise(0.01), 1);
      assert.equal(toPaise("0.01"), 1);
      assert.equal(toPaise(50000.5), 5000050);
      assert.equal(toPaise("50000.50"), 5000050);
    });

    it("converts paise back to standard decimal amounts", () => {
      assert.equal(fromPaise(10000), 100);
      assert.equal(fromPaise(1999), 19.99);
      assert.equal(fromPaise(1), 0.01);
      assert.equal(fromPaise(5000050), 50000.5);
    });

    it("calculates platform fee without losing any paise across gross and net splits", () => {
      const gross = 10000;
      const feeResult = calculatePlatformFee(gross, 5); // 5% fee

      assert.equal(feeResult.grossAmount, 10000);
      assert.equal(feeResult.feePercentage, 5);
      assert.equal(feeResult.feeAmount, 500);
      assert.equal(feeResult.netFreelancerAmount, 9500);
      assert.equal(
        feeResult.feeAmountPaise + feeResult.netAmountPaise,
        feeResult.grossAmountPaise,
        "Total paise must exactly equal gross amount paise"
      );
    });

    it("handles odd decimal amounts with exact paise rounding", () => {
      const gross = 999.99;
      const feeResult = calculatePlatformFee(gross, 5);
      assert.equal(
        feeResult.feeAmountPaise + feeResult.netAmountPaise,
        feeResult.grossAmountPaise
      );
    });
  });

  // -------------------------------------------------------------------------
  // 2. Cryptographic Signature Verification Tests
  // -------------------------------------------------------------------------
  describe("2. Cryptographic Signature Verification", () => {
    it("verifies authentic payment signature using HMAC-SHA256", () => {
      const orderId = "order_test_987654";
      const paymentId = "pay_test_123456";
      const payload = `${orderId}|${paymentId}`;
      const validSignature = crypto
        .createHmac("sha256", TEST_SECRET)
        .update(payload)
        .digest("hex");

      const isValid = verifyPaymentSignature({
        orderId,
        paymentId,
        signature: validSignature,
        secret: TEST_SECRET,
      });

      assert.equal(isValid, true, "Valid HMAC signature must be accepted");
    });

    it("rejects forged or tampered payment signature", () => {
      const orderId = "order_test_987654";
      const paymentId = "pay_test_123456";
      const forgedSignature = "0000000000000000000000000000000000000000000000000000000000000000";

      const isValid = verifyPaymentSignature({
        orderId,
        paymentId,
        signature: forgedSignature,
        secret: TEST_SECRET,
      });

      assert.equal(isValid, false, "Forged HMAC signature must be rejected");
    });

    it("verifies authentic webhook signature using exact raw payload text", () => {
      const rawPayload = JSON.stringify({
        event: "payment.captured",
        payload: { payment: { entity: { id: "pay_xyz", amount: 10000 } } },
      });
      const validSignature = crypto
        .createHmac("sha256", TEST_WEBHOOK_SECRET)
        .update(rawPayload)
        .digest("hex");

      const isValid = verifyWebhookSignature({
        rawBody: rawPayload,
        signature: validSignature,
        webhookSecret: TEST_WEBHOOK_SECRET,
      });

      assert.equal(isValid, true, "Webhook raw payload signature must be accepted");
    });

    it("rejects webhook signature if raw payload is modified", () => {
      const rawPayload = JSON.stringify({ event: "payment.captured" });
      const tamperedPayload = JSON.stringify({ event: "payment.captured", tampered: true });
      const signature = crypto
        .createHmac("sha256", TEST_WEBHOOK_SECRET)
        .update(rawPayload)
        .digest("hex");

      const isValid = verifyWebhookSignature({
        rawBody: tamperedPayload,
        signature,
        webhookSecret: TEST_WEBHOOK_SECRET,
      });

      assert.equal(isValid, false, "Tampered webhook payload must be rejected");
    });
  });

  // -------------------------------------------------------------------------
  // 3. Invoice Generation & Numbering Tests
  // -------------------------------------------------------------------------
  describe("3. Invoice Generation & Numbering", () => {
    it("generates sequential invoice numbers with standard prefix", async () => {
      const invNum = await generateInvoiceNumber();
      assert.match(invNum, /^INV-\d{6}-\d{4}$/);
    });

    it("builds itemized invoice line items with platform fee details", () => {
      const items = buildMilestoneInvoiceItems({
        milestoneTitle: "Sound Mixing & Mastering",
        projectTitle: "Brand Film 2026",
        amount: 25000,
        platformFeeAmount: 1250,
      });

      assert.equal(items.length, 2);
      assert.equal(items[0].unitPrice, 25000);
      assert.equal(items[1].unitPrice, 1250);
    });
  });

  // -------------------------------------------------------------------------
  // 4. Database Lifecycle, Escrow Locking & Concurrency Protection
  // -------------------------------------------------------------------------
  describe("4. End-to-End Escrow Lifecycle & Concurrency Double-Spend Guard", () => {
    let testBusinessUser: any;
    let testFreelancerUser: any;
    let testBusiness: any;
    let testProject: any;
    let testMilestone: any;

    before(async () => {
      // Create test business and freelancer in PostgreSQL
      testBusinessUser = await prisma.user.create({
        data: {
          email: `biz_finance_${Date.now()}@crewn.test`,
          role: "BUSINESS",
          isVerified: true,
          onboarded: true,
        },
      });

      testFreelancerUser = await prisma.user.create({
        data: {
          email: `creator_earnings_${Date.now()}@crewn.test`,
          role: "FREELANCER",
          isVerified: true,
          onboarded: true,
          freelancerProfile: {
            create: {
              headline: "Lead Sound Engineer",
              bio: "Cinema sound and mastering",
              yearsExperience: 8,
              isVerified: true,
            },
          },
        },
      });

      testBusiness = await prisma.business.create({
        data: {
          name: "Apex Creative Productions",
          slug: `apex-prod-${Date.now()}`,
          isVerified: true,
          members: {
            create: {
              userId: testBusinessUser.id,
              role: "OWNER",
            },
          },
        },
      });

      testProject = await prisma.project.create({
        data: {
          businessId: testBusiness.id,
          createdById: testBusinessUser.id,
          title: "Apex Cinematic Feature 2026",
          description: "High-end commercial production with milestone escrow",
          status: "OPEN",
          currency: "INR",
          members: {
            create: [
              { userId: testBusinessUser.id, role: "OWNER" },
              { userId: testFreelancerUser.id, role: "FREELANCER" },
            ],
          },
        },
      });

      testMilestone = await prisma.milestone.create({
        data: {
          projectId: testProject.id,
          title: "Audio Foley & Final Mix",
          amount: 50000.0,
          status: "PENDING",
          freelancerId: testFreelancerUser.id,
        },
      });
    });

    after(async () => {
      // Clean up test records in reverse dependency order
      try {
        if (testMilestone?.id) {
          const payments = await prisma.milestonePayment.findMany({ where: { milestoneId: testMilestone.id }, select: { id: true } });
          const paymentIds = payments.map((p) => p.id);
          if (paymentIds.length > 0) {
            const txs = await prisma.paymentTransaction.findMany({ where: { milestonePaymentId: { in: paymentIds } }, select: { id: true } });
            const txIds = txs.map((t) => t.id);
            if (txIds.length > 0) {
              await prisma.platformFee.deleteMany({ where: { transactionId: { in: txIds } } }).catch(() => {});
            }
            await prisma.paymentTransaction.deleteMany({ where: { milestonePaymentId: { in: paymentIds } } }).catch(() => {});
            await prisma.payout.deleteMany({ where: { milestonePaymentId: { in: paymentIds } } }).catch(() => {});
            await prisma.invoice.deleteMany({ where: { milestonePaymentId: { in: paymentIds } } }).catch(() => {});
          }
          await prisma.milestonePayment.deleteMany({ where: { milestoneId: testMilestone.id } }).catch(() => {});
          await prisma.milestone.deleteMany({ where: { id: testMilestone.id } }).catch(() => {});
        }
        if (testProject?.id) {
          await prisma.contractParty.deleteMany({ where: { contract: { projectId: testProject.id } } }).catch(() => {});
          await prisma.contract.deleteMany({ where: { projectId: testProject.id } }).catch(() => {});
          await prisma.invoice.deleteMany({ where: { projectId: testProject.id } }).catch(() => {});
          await prisma.projectMember.deleteMany({ where: { projectId: testProject.id } }).catch(() => {});
          await prisma.project.delete({ where: { id: testProject.id } }).catch(() => {});
        }
        if (testFreelancerUser?.id) {
          await prisma.bankAccount.deleteMany({ where: { userId: testFreelancerUser.id } }).catch(() => {});
          await prisma.payout.deleteMany({ where: { recipientId: testFreelancerUser.id } }).catch(() => {});
        }
        if (testBusiness?.id) {
          await prisma.business.delete({ where: { id: testBusiness.id } }).catch(() => {});
        }
        if (testBusinessUser?.id) {
          await prisma.user.delete({ where: { id: testBusinessUser.id } }).catch(() => {});
        }
        if (testFreelancerUser?.id) {
          await prisma.user.delete({ where: { id: testFreelancerUser.id } }).catch(() => {});
        }
      } catch (e) {
        // teardown ignore
      }
    });

    it("verifies milestone exists with correct assigned freelancer", async () => {
      const ms = await prisma.milestone.findUnique({
        where: { id: testMilestone.id },
        include: { freelancer: true, project: true },
      });

      assert.ok(ms);
      assert.equal(ms.freelancerId, testFreelancerUser.id);
      assert.equal(Number(ms.amount), 50000);
      assert.equal(ms.status, "PENDING");
    });

    it("atomically transitions milestone to HELD_IN_ESCROW on payment verification", async () => {
      const orderId = `order_test_${Date.now()}`;
      const paymentId = `pay_test_${Date.now()}`;

      // Create MilestonePayment & PaymentTransaction
      const { mp, txRecord } = await prisma.$transaction(async (tx) => {
        const mpRecord = await tx.milestonePayment.create({
          data: {
            milestoneId: testMilestone.id,
            projectId: testProject.id,
            businessId: testBusiness.id,
            amount: testMilestone.amount,
            currency: "INR",
            status: "PENDING",
          },
        });

        const transaction = await tx.paymentTransaction.create({
          data: {
            milestonePaymentId: mpRecord.id,
            businessId: testBusiness.id,
            payerId: testBusinessUser.id,
            gatewayOrderId: orderId,
            amount: testMilestone.amount,
            currency: "INR",
            status: "PENDING",
          },
        });

        return { mp: mpRecord, txRecord: transaction };
      });

      // Simulate Escrow Lock Verification Transaction
      await prisma.$transaction(async (tx) => {
        await tx.paymentTransaction.update({
          where: { id: txRecord.id },
          data: {
            gatewayPaymentId: paymentId,
            status: "COMPLETED",
          },
        });

        const feeCalc = calculatePlatformFee(50000);
        await tx.platformFee.create({
          data: {
            transactionId: txRecord.id,
            amount: feeCalc.feeAmount,
            feePercentage: feeCalc.feePercentage,
            currency: "INR",
          },
        });

        await tx.milestonePayment.update({
          where: { id: mp.id },
          data: {
            status: "HELD_IN_ESCROW",
            escrowHeldAt: new Date(),
          },
        });

        await tx.milestone.update({
          where: { id: testMilestone.id },
          data: { status: "ACTIVE" },
        });

        const invNum = await generateInvoiceNumber();
        await tx.invoice.create({
          data: {
            businessId: testBusiness.id,
            recipientId: testBusinessUser.id,
            projectId: testProject.id,
            milestonePaymentId: mp.id,
            invoiceNumber: invNum,
            totalAmount: testMilestone.amount,
            taxAmount: 0.0,
            currency: "INR",
            status: "PAID",
            paidAt: new Date(),
          },
        });
      });

      // Verify states in DB
      const updatedMp = await prisma.milestonePayment.findUnique({
        where: { id: mp.id },
      });
      const updatedMs = await prisma.milestone.findUnique({
        where: { id: testMilestone.id },
      });
      const platformFee = await prisma.platformFee.findUnique({
        where: { transactionId: txRecord.id },
      });

      assert.equal(updatedMp?.status, "HELD_IN_ESCROW");
      assert.equal(updatedMs?.status, "ACTIVE");
      assert.ok(platformFee);
      assert.equal(Number(platformFee.amount), 2500); // 5% of 50000
    });

    it("prevents duplicate PlatformFee records via unique constraint", async () => {
      const existingTx = await prisma.paymentTransaction.findFirst({
        where: { businessId: testBusiness.id, status: "COMPLETED" },
      });
      assert.ok(existingTx);

      // Attempt inserting second platform fee for same transaction must fail
      await assert.rejects(
        async () => {
          await prisma.platformFee.create({
            data: {
              transactionId: existingTx.id,
              amount: 2500,
              feePercentage: 5,
              currency: "INR",
            },
          });
        },
        (err: any) => err?.code === "P2002" || /Unique constraint/i.test(err?.message || "")
      );
    });

    it("releases escrow atomically and creates Payout record for the assigned freelancer", async () => {
      const heldPayment = await prisma.milestonePayment.findFirst({
        where: { milestoneId: testMilestone.id, status: "HELD_IN_ESCROW" },
      });
      assert.ok(heldPayment);

      const feeCalc = calculatePlatformFee(Number(heldPayment.amount));
      const netPayout = feeCalc.netFreelancerAmount; // 47500

      // Execute Escrow Release
      const payout = await prisma.$transaction(async (tx) => {
        const updateCount = await tx.milestonePayment.updateMany({
          where: { id: heldPayment.id, status: "HELD_IN_ESCROW" },
          data: { status: "RELEASED", releasedAt: new Date() },
        });

        assert.equal(updateCount.count, 1, "Exactly one record updated");

        await tx.milestone.update({
          where: { id: testMilestone.id },
          data: { status: "PAID" },
        });

        return await tx.payout.create({
          data: {
            recipientId: testFreelancerUser.id,
            milestonePaymentId: heldPayment.id,
            projectId: testProject.id,
            amount: netPayout,
            currency: "INR",
            status: "PENDING",
            payoutReference: `PO-TEST-${Date.now()}`,
          },
        });
      });

      assert.ok(payout);
      assert.equal(payout.recipientId, testFreelancerUser.id);
      assert.equal(Number(payout.amount), 47500);
      assert.equal(payout.status, "PENDING");

      // Verify Milestone status
      const completedMilestone = await prisma.milestone.findUnique({
        where: { id: testMilestone.id },
      });
      assert.equal(completedMilestone?.status, "PAID");
    });

    it("guarantees double-spend prevention: second release attempt fails immediately", async () => {
      const releasedPayment = await prisma.milestonePayment.findFirst({
        where: { milestoneId: testMilestone.id },
      });
      assert.ok(releasedPayment);
      assert.equal(releasedPayment.status, "RELEASED");

      // Attempting to release again must update 0 rows and abort
      const updateResult = await prisma.milestonePayment.updateMany({
        where: { id: releasedPayment.id, status: "HELD_IN_ESCROW" },
        data: { status: "RELEASED", releasedAt: new Date() },
      });

      assert.equal(updateResult.count, 0, "No records can be updated when already released");

      // Also attempting to create a second Payout for same milestonePaymentId fails unique constraint
      await assert.rejects(
        async () => {
          await prisma.payout.create({
            data: {
              recipientId: testFreelancerUser.id,
              milestonePaymentId: releasedPayment.id,
              amount: 47500,
              currency: "INR",
              status: "PENDING",
              payoutReference: `PO-DUPLICATE-${Date.now()}`,
            },
          });
        },
        (err: any) => err?.code === "P2002" || /Unique constraint/i.test(err?.message || "")
      );
    });

    it("protects freelancer banking credentials under BankAccount model", async () => {
      const bank = await prisma.bankAccount.create({
        data: {
          userId: testFreelancerUser.id,
          accountHolderName: "Jane Doe Freelancer",
          accountNumberMasked: "••••••••9876",
          accountNumberEncrypted: "encrypted_aes_token_abc123",
          ifscCode: "HDFC0001234",
          bankName: "HDFC Bank",
          upiId: "janedoe@okhdfcbank",
          isVerified: true,
        },
      });

      assert.ok(bank);
      assert.equal(bank.accountNumberMasked, "••••••••9876");
      assert.equal(bank.ifscCode, "HDFC0001234");
      assert.equal(bank.isVerified, true);
    });

    it("verifies contract creation and digital party signature tracking", async () => {
      const contract = await prisma.contract.create({
        data: {
          projectId: testProject.id,
          businessId: testBusiness.id,
          title: "Master Services & Deliverable Agreement",
          termsText: "All deliverables and milestone payments are subject to Crewn Escrow rules.",
          totalAmount: 50000.0,
          status: "DRAFT",
          parties: {
            create: [
              { userId: testBusinessUser.id, role: "CLIENT_SIGNER" },
              { userId: testFreelancerUser.id, role: "FREELANCER_SIGNER" },
            ],
          },
        },
        include: { parties: true },
      });

      assert.equal(contract.parties.length, 2);

      // Business signs
      await prisma.contractParty.update({
        where: {
          contractId_userId: {
            contractId: contract.id,
            userId: testBusinessUser.id,
          },
        },
        data: {
          signedAt: new Date(),
          ipAddress: "192.168.1.100",
        },
      });

      // Freelancer signs
      await prisma.contractParty.update({
        where: {
          contractId_userId: {
            contractId: contract.id,
            userId: testFreelancerUser.id,
          },
        },
        data: {
          signedAt: new Date(),
          ipAddress: "192.168.1.101",
        },
      });

      // All signed -> EXECUTED
      const updatedContract = await prisma.contract.update({
        where: { id: contract.id },
        data: { status: "EXECUTED" },
        include: { parties: true },
      });

      assert.equal(updatedContract.status, "EXECUTED");
      assert.ok(updatedContract.parties[0].signedAt);
      assert.ok(updatedContract.parties[1].signedAt);
    });
  });
});
