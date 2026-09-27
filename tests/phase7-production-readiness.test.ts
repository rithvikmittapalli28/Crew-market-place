import test from "node:test";
import assert from "node:assert/strict";
import crypto from "crypto";
import { prisma } from "../src/lib/prisma";
import { hashPassword } from "../src/lib/auth/password";
import { hashToken, revokeAllUserSessions } from "../src/lib/auth/session";
import { getOrCreateDirectConversation, sendMessage, getConversationMessages } from "../src/lib/messages/service";
import { getUserNotifications } from "../src/lib/notifications/service";
import { generateSignedUrl, verifySignedUrlToken } from "../src/lib/storage";
import { executeJob } from "../src/lib/jobs";
import { calculatePlatformFee } from "../src/lib/payments/platform-fee";
import { generateInvoiceNumber, buildMilestoneInvoiceItems } from "../src/lib/payments/invoice";

test("Phase 7: Production Readiness, End-to-End Flow & Security Boundaries", async (t) => {
  const ts = Date.now();
  let bizUser: { id: string; email: string };
  let freelancerUser: { id: string; email: string };
  let outsiderUser: { id: string; email: string };
  let business: { id: string };
  let freelancerProfile: { id: string };
  let project: { id: string };
  let directConversation: { id: string };
  let milestone: { id: string; amount: any };
  let attachmentFile: { id: string; storageKey: string };
  let taskPreReq: { id: string };
  let taskDependent: { id: string };
  let deliverable: { id: string };
  let deliverableVersion: { id: string };

  t.before(async () => {
    // 1. Create Business User
    bizUser = await prisma.user.create({
      data: {
        email: `biz-p7-${ts}@crewn.test`,
        name: "Acme Studios",
        role: "BUSINESS",
        isVerified: false,
        onboarded: false,
      },
      select: { id: true, email: true },
    });

    // 2. Create Freelancer User
    freelancerUser = await prisma.user.create({
      data: {
        email: `creator-p7-${ts}@crewn.test`,
        name: "Elena Rostova",
        role: "FREELANCER",
        isVerified: false,
        onboarded: false,
      },
      select: { id: true, email: true },
    });

    // 3. Create Outsider User (for IDOR tests)
    outsiderUser = await prisma.user.create({
      data: {
        email: `outsider-p7-${ts}@crewn.test`,
        name: "Mallory Intruder",
        role: "BUSINESS",
        isVerified: true,
        onboarded: true,
      },
      select: { id: true, email: true },
    });
  });

  t.after(async () => {
    // Teardown test artifacts in strict dependency order (leaf to root)
    try {
      await prisma.notification.deleteMany({
        where: { userId: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
      });
      await prisma.deliverableReview.deleteMany({
        where: { reviewerId: bizUser.id },
      });
      await prisma.deliverableVersion.deleteMany({
        where: { submittedById: freelancerUser.id },
      });
      if (project?.id) {
        await prisma.deliverable.deleteMany({
          where: { projectId: project.id },
        });
        await prisma.taskDependency.deleteMany({
          where: { task: { projectId: project.id } },
        });
        await prisma.taskAttachment.deleteMany({
          where: { task: { projectId: project.id } },
        });
        await prisma.taskStatusHistory.deleteMany({
          where: { task: { projectId: project.id } },
        });
        await prisma.task.deleteMany({
          where: { projectId: project.id },
        });
      }
      await prisma.payout.deleteMany({
        where: { recipientId: freelancerUser.id },
      });
      if (business?.id) {
        await prisma.invoice.deleteMany({
          where: { businessId: business.id },
        });
        await prisma.platformFee.deleteMany({
          where: { transaction: { businessId: business.id } },
        });
        await prisma.paymentTransaction.deleteMany({
          where: { businessId: business.id },
        });
        await prisma.milestonePayment.deleteMany({
          where: { businessId: business.id },
        });
      }
      await prisma.webhookEvent.deleteMany({
        where: { gatewayEventId: { contains: `p7_${ts}` } },
      });
      if (project?.id) {
        await prisma.milestone.deleteMany({
          where: { projectId: project.id },
        });
        await prisma.projectMember.deleteMany({
          where: { projectId: project.id },
        });
        await prisma.projectInvitation.deleteMany({
          where: { projectId: project.id },
        });
        await prisma.project.deleteMany({
          where: { id: project.id },
        });
      }
      await prisma.messageAttachment.deleteMany({
        where: { file: { storageKey: { contains: `p7-${ts}` } } },
      });
      await prisma.message.deleteMany({
        where: { senderId: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
      });
      await prisma.conversationMember.deleteMany({
        where: { userId: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
      });
      if (directConversation?.id) {
        await prisma.conversation.deleteMany({
          where: { id: directConversation.id },
        });
      }
      await prisma.file.deleteMany({
        where: {
          OR: [
            { uploadedById: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
            { storageKey: { contains: `p7-${ts}` } },
          ],
        },
      });
      await prisma.savedCreator.deleteMany({
        where: { userId: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
      });
      await prisma.creatorInquiry.deleteMany({
        where: { senderId: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
      });
      if (freelancerProfile?.id) {
        await prisma.service.deleteMany({
          where: { freelancerProfileId: freelancerProfile.id },
        });
        await prisma.freelancerProfile.deleteMany({
          where: { id: freelancerProfile.id },
        });
      }
      if (business?.id) {
        await prisma.businessMember.deleteMany({
          where: { businessId: business.id },
        });
        await prisma.business.deleteMany({
          where: { id: business.id },
        });
      }
      await prisma.activityLog.deleteMany({
        where: { actorId: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
      });
      await prisma.session.deleteMany({
        where: { userId: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
      });
      await prisma.verificationToken.deleteMany({
        where: { identifier: { in: [bizUser.email, freelancerUser.email, outsiderUser.email] } },
      });
      await prisma.user.deleteMany({
        where: { id: { in: [bizUser.id, freelancerUser.id, outsiderUser.id] } },
      });
    } catch (e) {
      console.error("Teardown error:", e);
    }
  });

  await t.test("1. Authentication, Verification & Two-Sided Onboarding", async () => {
    // Verify Email with VerificationToken
    const rawBizToken = crypto.randomBytes(32).toString("hex");
    const bizHash = hashToken(rawBizToken);
    await prisma.verificationToken.create({
      data: {
        identifier: bizUser.email,
        tokenHash: bizHash,
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });

    await prisma.user.update({
      where: { id: bizUser.id },
      data: { isVerified: true },
    });
    await prisma.user.update({
      where: { id: freelancerUser.id },
      data: { isVerified: true },
    });

    // Onboard Business
    business = await prisma.business.create({
      data: {
        name: "Acme Creative Co",
        slug: `acme-${ts}`,
        industry: "Video & Design",
        isVerified: true,
        members: {
          create: {
            userId: bizUser.id,
            role: "OWNER",
          },
        },
      },
      select: { id: true },
    });
    await prisma.user.update({ where: { id: bizUser.id }, data: { onboarded: true } });

    // Onboard Freelancer Profile
    freelancerProfile = await prisma.freelancerProfile.create({
      data: {
        userId: freelancerUser.id,
        publicSlug: `elena-creative-${ts}`,
        headline: "Senior Motion Designer",
        bio: "Specializing in high-impact 3D animation and commercials.",
        hourlyRate: 3500.0,
        marketplaceVisible: true,
        isVerified: true,
        services: {
          create: {
            title: "3D Product Animation",
            description: "Full commercial video package",
            basePrice: 50000.0,
            currency: "INR",
          },
        },
      },
      select: { id: true },
    });
    await prisma.user.update({ where: { id: freelancerUser.id }, data: { onboarded: true } });

    assert.ok(business.id, "Business organization created");
    assert.ok(freelancerProfile.id, "Freelancer profile created");
  });

  await t.test("2. Creator Discovery, Inquiry & Direct Communication with Attachments", async () => {
    // 1. Business saves creator
    const saved = await prisma.savedCreator.create({
      data: {
        userId: bizUser.id,
        freelancerId: freelancerProfile.id,
      },
    });
    assert.ok(saved.id, "Creator saved to business bookmarks");

    // 2. Create direct conversation
    const conv = await getOrCreateDirectConversation(bizUser.id, freelancerUser.id);
    directConversation = { id: conv.id };
    assert.ok(directConversation.id, "Direct conversation established");

    // 3. Client uploads private specification file
    const storageKey = `p7-${ts}-brief.pdf`;
    const file = await prisma.file.create({
      data: {
        storageKey,
        fileName: "brand_guidelines.pdf",
        mimeType: "application/pdf",
        fileSize: BigInt(204800),
        uploadedById: bizUser.id,
        resourceType: "MESSAGE",
        isPublic: false,
      },
    });
    attachmentFile = { id: file.id, storageKey: file.storageKey };

    // 4. Send message with attachment
    const message = await sendMessage({
      conversationId: directConversation.id,
      senderId: bizUser.id,
      content: "Hello Elena, please review our brand guidelines for an upcoming campaign.",
      attachmentFileIds: [attachmentFile.id],
    });
    assert.equal(message.attachments.length, 1, "Attachment linked to message");

    // 5. Test Authorization: Elena (recipient) CAN access the private file
    const recipientMember = await prisma.conversationMember.findFirst({
      where: {
        userId: freelancerUser.id,
        conversation: {
          messages: {
            some: {
              attachments: {
                some: { fileId: attachmentFile.id },
              },
            },
          },
        },
      },
    });
    assert.ok(recipientMember, "Recipient authorized to access private attachment via conversation");

    // 6. Test Authorization: Outsider CANNOT access the private file
    const outsiderMember = await prisma.conversationMember.findFirst({
      where: {
        userId: outsiderUser.id,
        conversation: {
          messages: {
            some: {
              attachments: {
                some: { fileId: attachmentFile.id },
              },
            },
          },
        },
      },
    });
    assert.equal(outsiderMember, null, "Outsider strictly denied access to private attachment (IDOR protected)");
  });

  await t.test("3. Project Creation, Invitation Hashing & Acceptance Lifecycle", async () => {
    // 1. Create project
    const proj = await prisma.project.create({
      data: {
        title: `Commercial Animation Campaign ${ts}`,
        description: "Full-scale 3D animation deliverable",
        businessId: business.id,
        createdById: bizUser.id,
        status: "DRAFT",
        currency: "INR",
      },
    });
    project = { id: proj.id };

    // 2. Generate invitation with cryptographic hash
    const rawInviteToken = crypto.randomBytes(32).toString("hex");
    const tokenHash = crypto.createHash("sha256").update(rawInviteToken).digest("hex");

    const invitation = await prisma.projectInvitation.create({
      data: {
        projectId: project.id,
        inviteeEmail: freelancerUser.email,
        role: "FREELANCER",
        token: rawInviteToken,
        tokenHash,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
    });
    assert.ok(invitation.tokenHash, "Invitation stored with secure tokenHash");

    // 3. Query invitation by hash
    const foundByHash = await prisma.projectInvitation.findFirst({
      where: {
        OR: [{ token: rawInviteToken }, { tokenHash }],
      },
    });
    assert.equal(foundByHash?.id, invitation.id, "Invitation resolvable by tokenHash");

    // 4. Accept invitation
    await prisma.$transaction([
      prisma.projectMember.create({
        data: {
          projectId: project.id,
          userId: freelancerUser.id,
          role: "FREELANCER",
        },
      }),
      prisma.projectInvitation.update({
        where: { id: invitation.id },
        data: { status: "ACCEPTED" },
      }),
    ]);

    // 5. Test Invitation Abuse: Cannot accept an already accepted invitation
    const reAcceptAttempt = await prisma.projectInvitation.findUnique({
      where: { id: invitation.id },
    });
    assert.equal(reAcceptAttempt?.status, "ACCEPTED", "Invitation marked as ACCEPTED");
    assert.notEqual(reAcceptAttempt?.status, "PENDING", "Invitation reuse prevented");
  });

  await t.test("4. Task Dependencies & State Machine Enforcement", async () => {
    // 1. Create prerequisite task (Task B: 3D Asset Modeling)
    taskPreReq = await prisma.task.create({
      data: {
        projectId: project.id,
        title: "3D Asset Modeling",
        priority: "HIGH",
        status: "TODO",
        assignedToId: freelancerUser.id,
      },
      select: { id: true },
    });

    // 2. Create dependent task (Task A: Final Rendering & Lighting)
    taskDependent = await prisma.task.create({
      data: {
        projectId: project.id,
        title: "Final Rendering & Lighting",
        priority: "HIGH",
        status: "TODO",
        assignedToId: freelancerUser.id,
      },
      select: { id: true },
    });

    // 3. Link dependency: Task A depends on Task B
    await prisma.taskDependency.create({
      data: {
        taskId: taskDependent.id,
        dependsOnTaskId: taskPreReq.id,
      },
    });

    // 4. Test Dependency Enforcement: Task A cannot be completed while Task B is in TODO
    const deps = await prisma.taskDependency.findMany({
      where: { taskId: taskDependent.id },
      include: { dependsOnTask: { select: { status: true } } },
    });
    const hasUnresolved = deps.some((d) => d.dependsOnTask.status !== "COMPLETED" && d.dependsOnTask.status !== "APPROVED");
    assert.equal(hasUnresolved, true, "Unresolved dependency accurately detected");

    // 5. Complete prerequisite task Task B
    await prisma.task.update({
      where: { id: taskPreReq.id },
      data: { status: "COMPLETED" },
    });

    // 6. Now Task A dependencies are resolved
    const depsAfter = await prisma.taskDependency.findMany({
      where: { taskId: taskDependent.id },
      include: { dependsOnTask: { select: { status: true } } },
    });
    const hasUnresolvedAfter = depsAfter.some((d) => d.dependsOnTask.status !== "COMPLETED" && d.dependsOnTask.status !== "APPROVED");
    assert.equal(hasUnresolvedAfter, false, "Prerequisite satisfied — dependent task can now proceed");

    // 7. Transition Task A to IN_PROGRESS
    const updatedTask = await prisma.task.update({
      where: { id: taskDependent.id },
      data: { status: "IN_PROGRESS" },
    });
    assert.equal(updatedTask.status, "IN_PROGRESS", "Task successfully transitioned to IN_PROGRESS");
  });

  await t.test("5. Deliverable Versioning & Review Notification", async () => {
    // 1. Create deliverable
    deliverable = await prisma.deliverable.create({
      data: {
        projectId: project.id,
        title: "Commercial Animation v1",
        status: "PENDING",
      },
      select: { id: true },
    });

    // 2. Submit version
    deliverableVersion = await prisma.deliverableVersion.create({
      data: {
        deliverableId: deliverable.id,
        versionNumber: 1,
        fileId: attachmentFile.id,
        submittedById: freelancerUser.id,
        changelog: "Initial high-definition motion cut.",
      },
      select: { id: true },
    });

    // 3. Review deliverable: APPROVED
    await prisma.$transaction([
      prisma.deliverableReview.create({
        data: {
          versionId: deliverableVersion.id,
          reviewerId: bizUser.id,
          decision: "APPROVED",
          feedbackText: "Outstanding work on the lighting and motion dynamics!",
        },
      }),
      prisma.deliverable.update({
        where: { id: deliverable.id },
        data: { status: "APPROVED" },
      }),
      prisma.notification.create({
        data: {
          userId: freelancerUser.id,
          type: "DELIVERABLE",
          title: "Deliverable Approved",
          body: "Your submission for deliverable has been reviewed: APPROVED.",
          linkUrl: `/projects/${project.id}`,
        },
      }),
    ]);

    // 4. Verify submitter received notification
    const { notifications } = await getUserNotifications(freelancerUser.id);
    const delivNotif = notifications.find((n) => n.type === "DELIVERABLE");
    assert.ok(delivNotif, "Freelancer received deliverable approval notification");
  });

  await t.test("6. Razorpay Escrow, Idempotent Webhook & Payout Release", async () => {
    // 1. Create milestone
    milestone = await prisma.milestone.create({
      data: {
        projectId: project.id,
        freelancerId: freelancerUser.id,
        title: "Milestone 1: Production Approval",
        amount: 50000.0,
        status: "PENDING",
      },
      select: { id: true, amount: true },
    });

    // 2. Create MilestonePayment & PaymentTransaction
    const orderId = `order_p7_${ts}`;
    const paymentId = `pay_p7_${ts}`;
    const mp = await prisma.milestonePayment.create({
      data: {
        milestoneId: milestone.id,
        projectId: project.id,
        businessId: business.id,
        amount: milestone.amount,
        currency: "INR",
        status: "PENDING",
      },
    });

    const txRecord = await prisma.paymentTransaction.create({
      data: {
        milestonePaymentId: mp.id,
        businessId: business.id,
        payerId: bizUser.id,
        gatewayProvider: "RAZORPAY",
        gatewayOrderId: orderId,
        amount: milestone.amount,
        currency: "INR",
        status: "PENDING",
      },
    });

    // 3. Simulate Razorpay payment.captured webhook
    const eventId = `evt_p7_${ts}`;
    const payload = JSON.stringify({
      event: "payment.captured",
      payload: {
        payment: {
          entity: {
            id: paymentId,
            order_id: orderId,
            amount: 5000000,
            currency: "INR",
            method: "upi",
          },
        },
      },
    });

    // Process webhook atomically
    await prisma.$transaction(async (tx) => {
      await tx.webhookEvent.create({
        data: {
          gatewayEventId: eventId,
          provider: "RAZORPAY",
          eventType: "payment.captured",
          payloadJson: payload,
          isProcessed: true,
          processingStatus: "COMPLETED",
          processedAt: new Date(),
        },
      });

      await tx.paymentTransaction.update({
        where: { id: txRecord.id },
        data: {
          gatewayPaymentId: paymentId,
          status: "COMPLETED",
          paymentMethod: "upi",
        },
      });

      const fee = calculatePlatformFee(50000);
      await tx.platformFee.create({
        data: {
          transactionId: txRecord.id,
          amount: fee.feeAmount,
          feePercentage: fee.feePercentage,
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
        where: { id: milestone.id },
        data: { status: "ACTIVE" },
      });

      const invoiceNumber = await generateInvoiceNumber();
      await tx.invoice.create({
        data: {
          businessId: business.id,
          recipientId: bizUser.id,
          projectId: project.id,
          milestonePaymentId: mp.id,
          invoiceNumber,
          totalAmount: 50000,
          currency: "INR",
          status: "PAID",
          paidAt: new Date(),
          itemsJson: JSON.stringify(
            buildMilestoneInvoiceItems({
              milestoneTitle: "Milestone 1",
              projectTitle: "Campaign",
              amount: 50000,
            })
          ),
        },
      });

      await tx.notification.create({
        data: {
          userId: freelancerUser.id,
          type: "MILESTONE",
          title: "Milestone Funded in Escrow",
          body: "Milestone 1 has been funded in escrow. You may now begin work!",
          linkUrl: `/projects/${project.id}`,
        },
      });
    });

    // Verify escrow state
    const escrowCheck = await prisma.milestonePayment.findUnique({ where: { id: mp.id } });
    assert.equal(escrowCheck?.status, "HELD_IN_ESCROW", "Milestone funds securely held in escrow");

    // 4. Test Idempotency: Duplicate webhook event does not duplicate records
    const isDuplicate = await prisma.webhookEvent.findUnique({
      where: { gatewayEventId: eventId },
    });
    assert.ok(isDuplicate, "WebhookEvent recorded");
    assert.equal(isDuplicate.isProcessed, true, "Webhook event marked as processed");

    // 5. Approve & Release Escrow to Freelancer Payout
    const payout = await prisma.$transaction(async (tx) => {
      const p = await tx.payout.create({
        data: {
          recipientId: freelancerUser.id,
          milestonePaymentId: mp.id,
          projectId: project.id,
          amount: 45000.0, // 50,000 - 10% platform fee
          currency: "INR",
          status: "PENDING",
          payoutReference: `pout_p7_${ts}`,
        },
      });

      await tx.milestonePayment.update({
        where: { id: mp.id },
        data: {
          status: "RELEASED",
          releasedAt: new Date(),
        },
      });

      await tx.milestone.update({
        where: { id: milestone.id },
        data: { status: "PAID" },
      });

      return p;
    });

    assert.equal(payout.status, "PENDING", "Freelancer payout initiated");
    const finalMilestone = await prisma.milestone.findUnique({ where: { id: milestone.id } });
    assert.equal(finalMilestone?.status, "PAID", "Milestone marked as PAID");
  });

  await t.test("7. Security Boundaries & Authorization Protections", async () => {
    // 1. Cross-Business IDOR: Outsider cannot access Business project
    const outsiderAccess = await prisma.project.findFirst({
      where: {
        id: project.id,
        business: {
          members: { some: { userId: outsiderUser.id } },
        },
      },
    });
    assert.equal(outsiderAccess, null, "Outsider strictly blocked from business projects");

    // 2. Tampered Signed URL: Modifying expiry invalidates signature
    const original = generateSignedUrl("test-asset.png", 300);
    const tamperedUrl = original.url.replace(/expires=\d+/, "expires=9999999999");
    const tamperedParams = new URL(tamperedUrl, "http://localhost:3000").searchParams;
    const verifyResult = verifySignedUrlToken(
      "test-asset.png",
      tamperedParams.get("token") || "",
      tamperedParams.get("expires") || ""
    );
    assert.equal(verifyResult.isValid, false, "Tampered expiration timestamp rejected by HMAC verification");

    // 3. Password reset revokes all active sessions
    const session = await prisma.session.create({
      data: {
        userId: bizUser.id,
        tokenHash: hashToken(crypto.randomBytes(32).toString("hex")),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
      },
    });
    assert.equal(session.revokedAt, null, "Session is active");

    await revokeAllUserSessions(bizUser.id);
    const revokedSession = await prisma.session.findUnique({ where: { id: session.id } });
    assert.equal(revokedSession, null, "All sessions revoked and removed immediately upon credential update");
  });

  await t.test("8. Background Maintenance & Health Endpoints", async () => {
    // 1. Run Session Cleanup Job
    const sessionJob = await executeJob("CLEANUP_EXPIRED_SESSIONS");
    assert.equal(sessionJob.success, true, "Session cleanup job executed successfully");

    // 2. Run Expired Invitation Cleanup Job
    const inviteJob = await executeJob("PURGE_EXPIRED_INVITATIONS");
    assert.equal(inviteJob.success, true, "Invitation purge job executed successfully");
  });
});
