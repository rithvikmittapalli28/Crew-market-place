import { prisma } from "@/lib/prisma";
import { ContractStatus, NotificationType } from "@prisma/client";
import { logProjectActivity } from "@/lib/projects/activity";
import { dispatchNotification } from "@/lib/notifications/service";
import crypto from "crypto";

export interface CreateContractParams {
  projectId: string;
  businessId: string;
  authorUserId: string;
  title: string;
  termsText: string;
  totalAmount: number;
  scopeOfWork?: string;
  deliverablesText?: string;
  milestonesJson?: string;
  paymentTerms?: string;
  revisionTerms?: string;
  cancellationTerms?: string;
  effectiveDate?: Date | string | null;
  expiresAt?: Date | string | null;
  freelancerUserId?: string;
}

export interface UpdateContractDraftParams {
  contractId: string;
  userId: string;
  title?: string;
  termsText?: string;
  totalAmount?: number;
  scopeOfWork?: string;
  deliverablesText?: string;
  milestonesJson?: string;
  paymentTerms?: string;
  revisionTerms?: string;
  cancellationTerms?: string;
  effectiveDate?: Date | string | null;
  expiresAt?: Date | string | null;
}

export interface SignContractParams {
  contractId: string;
  userId: string;
  signatureDataUrl: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface DeclineContractParams {
  contractId: string;
  userId: string;
  reason: string;
}

/**
 * Validates contract status transitions.
 * Strict state machine:
 * DRAFT -> SENT -> EXECUTED (via all parties signing)
 * DRAFT -> TERMINATED
 * SENT -> DECLINED
 * SENT -> TERMINATED
 * EXECUTED -> TERMINATED
 */
export function isValidContractTransition(
  from: ContractStatus,
  to: ContractStatus
): boolean {
  if (from === to) return true;

  const validTransitions: Record<ContractStatus, ContractStatus[]> = {
    DRAFT: ["SENT", "TERMINATED"],
    SENT: ["EXECUTED", "DECLINED", "TERMINATED"],
    EXECUTED: ["TERMINATED"],
    DECLINED: ["TERMINATED"],
    TERMINATED: [],
  };

  return validTransitions[from]?.includes(to) ?? false;
}

/**
 * Computes an immutable SHA-256 cryptographic hash of the contract snapshot.
 */
export function generateContractSnapshotHash(payload: Record<string, unknown>): string {
  const content = JSON.stringify(payload);
  return crypto.createHash("sha256").update(content).digest("hex");
}

/**
 * Creates a contract draft from an authorized project.
 * Automatically resolves contract parties server-side:
 * - CLIENT_SIGNER (authenticated business owner/manager)
 * - FREELANCER_SIGNER (freelancer assigned to the project)
 */
export async function createContractDraft(params: CreateContractParams) {
  const {
    projectId,
    businessId,
    authorUserId,
    title,
    termsText,
    totalAmount,
    scopeOfWork,
    deliverablesText,
    milestonesJson,
    paymentTerms,
    revisionTerms,
    cancellationTerms,
    effectiveDate,
    expiresAt,
    freelancerUserId,
  } = params;

  if (!title || !title.trim()) {
    throw new Error("Contract title is required");
  }
  if (!termsText || !termsText.trim()) {
    throw new Error("Contract termsText is required");
  }
  if (totalAmount < 0 || isNaN(totalAmount)) {
    throw new Error("Valid non-negative totalAmount is required");
  }

  // Resolve freelancer party server-side
  let targetFreelancerId = freelancerUserId;
  if (!targetFreelancerId) {
    const member = await prisma.projectMember.findFirst({
      where: {
        projectId,
        role: { in: ["FREELANCER", "TEAM_MEMBER"] },
      },
    });
    targetFreelancerId = member?.userId;
  }

  const contract = await prisma.$transaction(async (tx) => {
    return tx.contract.create({
      data: {
        projectId,
        businessId,
        title: title.trim(),
        termsText: termsText.trim(),
        totalAmount,
        scopeOfWork: scopeOfWork?.trim() || null,
        deliverablesText: deliverablesText?.trim() || null,
        milestonesJson: milestonesJson || null,
        paymentTerms: paymentTerms?.trim() || null,
        revisionTerms: revisionTerms?.trim() || null,
        cancellationTerms: cancellationTerms?.trim() || null,
        effectiveDate: effectiveDate ? new Date(effectiveDate) : null,
        expiresAt: expiresAt ? new Date(expiresAt) : null,
        status: "DRAFT",
        parties: {
          create: [
            {
              userId: authorUserId,
              role: "CLIENT_SIGNER",
            },
            ...(targetFreelancerId && targetFreelancerId !== authorUserId
              ? [
                  {
                    userId: targetFreelancerId,
                    role: "FREELANCER_SIGNER",
                  },
                ]
              : []),
          ],
        },
      },
      include: {
        parties: {
          include: {
            user: { select: { id: true, name: true, email: true, avatarUrl: true } },
          },
        },
        project: { select: { id: true, title: true } },
        business: { select: { id: true, name: true } },
      },
    });
  });

  logProjectActivity({
    projectId,
    entityType: "CONTRACT",
    entityId: contract.id,
    action: "CONTRACT_CREATED",
    actorId: authorUserId,
    metadata: {
      title: contract.title,
      totalAmount,
      partiesCount: contract.parties.length,
    },
  }).catch(console.error);

  return contract;
}

/**
 * Updates a contract while strictly in DRAFT status.
 * Rejects modifications if the contract has already been sent, signed, or executed.
 */
export async function updateContractDraft(params: UpdateContractDraftParams) {
  const { contractId, userId, ...updateData } = params;

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: { parties: true, project: true },
  });

  if (!contract) {
    throw new Error("Contract not found");
  }

  if (contract.status !== "DRAFT") {
    throw new Error(`Cannot edit contract in status ${contract.status}. Only DRAFT contracts can be edited.`);
  }

  // Authorization check: must be a CLIENT_SIGNER or project owner/manager
  const party = contract.parties.find((p) => p.userId === userId);
  const isClientSigner = party?.role === "CLIENT_SIGNER";
  if (!isClientSigner) {
    const isOwnerOrManager = await prisma.projectMember.findFirst({
      where: {
        projectId: contract.projectId,
        userId,
        role: { in: ["OWNER", "MANAGER"] },
      },
    });
    if (!isOwnerOrManager) {
      throw new Error("Forbidden: Only project managers or client signers can edit contract drafts");
    }
  }

  const updated = await prisma.contract.update({
    where: { id: contractId },
    data: {
      ...(updateData.title !== undefined ? { title: updateData.title.trim() } : {}),
      ...(updateData.termsText !== undefined ? { termsText: updateData.termsText.trim() } : {}),
      ...(updateData.totalAmount !== undefined ? { totalAmount: updateData.totalAmount } : {}),
      ...(updateData.scopeOfWork !== undefined ? { scopeOfWork: updateData.scopeOfWork?.trim() || null } : {}),
      ...(updateData.deliverablesText !== undefined ? { deliverablesText: updateData.deliverablesText?.trim() || null } : {}),
      ...(updateData.milestonesJson !== undefined ? { milestonesJson: updateData.milestonesJson } : {}),
      ...(updateData.paymentTerms !== undefined ? { paymentTerms: updateData.paymentTerms?.trim() || null } : {}),
      ...(updateData.revisionTerms !== undefined ? { revisionTerms: updateData.revisionTerms?.trim() || null } : {}),
      ...(updateData.cancellationTerms !== undefined ? { cancellationTerms: updateData.cancellationTerms?.trim() || null } : {}),
      ...(updateData.effectiveDate !== undefined ? { effectiveDate: updateData.effectiveDate ? new Date(updateData.effectiveDate) : null } : {}),
      ...(updateData.expiresAt !== undefined ? { expiresAt: updateData.expiresAt ? new Date(updateData.expiresAt) : null } : {}),
    },
    include: {
      parties: {
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      },
    },
  });

  logProjectActivity({
    projectId: contract.projectId,
    entityType: "CONTRACT",
    entityId: contract.id,
    action: "CONTRACT_UPDATED",
    actorId: userId,
    metadata: { title: updated.title, totalAmount: Number(updated.totalAmount) },
  }).catch(console.error);

  return updated;
}

/**
 * Sends a contract for signature (transitions DRAFT -> SENT).
 * Enforces party completeness and generates notifications.
 */
export async function sendContractForSignature(contractId: string, userId: string) {
  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      parties: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      project: { select: { id: true, title: true } },
      business: { select: { id: true, name: true } },
    },
  });

  if (!contract) {
    throw new Error("Contract not found");
  }

  if (contract.status !== "DRAFT") {
    throw new Error(`Cannot send contract with status ${contract.status}. It must be in DRAFT.`);
  }

  if (!contract.parties || contract.parties.length < 2) {
    // Attempt to auto-add missing freelancer party if available
    const freelancerMember = await prisma.projectMember.findFirst({
      where: {
        projectId: contract.projectId,
        role: { in: ["FREELANCER", "TEAM_MEMBER"] },
      },
    });

    if (freelancerMember && !contract.parties.some((p) => p.userId === freelancerMember.userId)) {
      await prisma.contractParty.create({
        data: {
          contractId,
          userId: freelancerMember.userId,
          role: "FREELANCER_SIGNER",
        },
      });
    } else {
      throw new Error("Contract must have both a client and freelancer signer before sending");
    }
  }

  const updated = await prisma.contract.update({
    where: { id: contractId },
    data: { status: "SENT" },
    include: {
      parties: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      project: true,
    },
  });

  logProjectActivity({
    projectId: contract.projectId,
    entityType: "CONTRACT",
    entityId: contract.id,
    action: "CONTRACT_SENT",
    actorId: userId,
    metadata: {
      title: contract.title,
      sentAt: new Date().toISOString(),
    },
  }).catch(console.error);

  // Dispatch real-time notification to all non-sending parties
  for (const party of updated.parties) {
    if (party.userId !== userId) {
      dispatchNotification({
        userId: party.userId,
        type: "CONTRACT" as NotificationType,
        title: "Contract Sent for Signature",
        body: `You have received a formal contract "${contract.title}" for project "${contract.project.title}". Please review and sign.`,
        linkUrl: `/projects/${contract.projectId}?tab=contracts&contractId=${contract.id}`,
      }).catch(console.error);
    }
  }

  return updated;
}

/**
 * Signs a contract on behalf of an authorized party.
 * Records signature canvas data URL, IP address, user agent, and timestamp.
 * If all parties have signed, transitions status to EXECUTED and generates an immutable snapshot.
 */
export async function signContract(params: SignContractParams) {
  const { contractId, userId, signatureDataUrl, ipAddress, userAgent } = params;

  if (!signatureDataUrl || !signatureDataUrl.startsWith("data:image/")) {
    throw new Error("A valid signature image is required to execute this contract");
  }

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      parties: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      project: { select: { id: true, title: true } },
      business: { select: { id: true, name: true } },
    },
  });

  if (!contract) {
    throw new Error("Contract not found");
  }

  if (contract.status === "EXECUTED") {
    throw new Error("This contract has already been fully executed and cannot be modified");
  }

  if (contract.status !== "SENT") {
    throw new Error(`Contract cannot be signed while in status ${contract.status}. It must be SENT.`);
  }

  // Find matching party
  const party = contract.parties.find((p) => p.userId === userId);
  if (!party) {
    throw new Error("Forbidden: You are not a designated signing party for this contract");
  }

  if (party.signedAt) {
    throw new Error("You have already signed this contract");
  }

  const now = new Date();
  const clientIp = ipAddress || "127.0.0.1";
  const clientAgent = userAgent || "Unknown Browser";

  // Perform signing and state transition atomically
  const result = await prisma.$transaction(async (tx) => {
    // 1. Update signing party
    await tx.contractParty.update({
      where: { id: party.id },
      data: {
        signedAt: now,
        signatureDataUrl,
        ipAddress: clientIp,
        userAgent: clientAgent,
      },
    });

    // 2. Fetch all parties to evaluate completion
    const allParties = await tx.contractParty.findMany({
      where: { contractId },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    const allSigned = allParties.every((p) => (p.id === party.id ? true : !!p.signedAt));

    if (allSigned) {
      // Build immutable snapshot payload
      const snapshotPayload = {
        contractId: contract.id,
        projectId: contract.projectId,
        projectTitle: contract.project.title,
        businessId: contract.businessId,
        businessName: contract.business.name,
        title: contract.title,
        termsText: contract.termsText,
        scopeOfWork: contract.scopeOfWork,
        deliverablesText: contract.deliverablesText,
        milestonesJson: contract.milestonesJson,
        paymentTerms: contract.paymentTerms,
        revisionTerms: contract.revisionTerms,
        cancellationTerms: contract.cancellationTerms,
        totalAmount: Number(contract.totalAmount),
        currency: "INR",
        effectiveDate: contract.effectiveDate?.toISOString() || now.toISOString(),
        executedAt: now.toISOString(),
        parties: allParties.map((p) => ({
          partyId: p.id,
          userId: p.userId,
          name: p.user.name,
          email: p.user.email,
          role: p.role,
          signedAt: p.id === party.id ? now.toISOString() : p.signedAt?.toISOString(),
          ipAddress: p.id === party.id ? clientIp : p.ipAddress,
          userAgent: p.id === party.id ? clientAgent : p.userAgent,
          hasSignatureData: !!(p.id === party.id ? signatureDataUrl : p.signatureDataUrl),
        })),
      };

      const integrityHash = generateContractSnapshotHash(snapshotPayload);
      const completeSnapshot = {
        ...snapshotPayload,
        integrityHash,
        version: "1.0",
      };

      const executedContract = await tx.contract.update({
        where: { id: contractId },
        data: {
          status: "EXECUTED",
          executedAt: now,
          signedSnapshotJson: JSON.stringify(completeSnapshot),
        },
        include: {
          parties: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });

      return {
        contract: executedContract,
        isFullyExecuted: true,
        allParties,
      };
    } else {
      const updatedContract = await tx.contract.findUnique({
        where: { id: contractId },
        include: {
          parties: {
            include: { user: { select: { id: true, name: true, email: true } } },
          },
        },
      });

      return {
        contract: updatedContract!,
        isFullyExecuted: false,
        allParties,
      };
    }
  });

  // Activity logging
  logProjectActivity({
    projectId: contract.projectId,
    entityType: "CONTRACT",
    entityId: contract.id,
    action: result.isFullyExecuted ? "CONTRACT_EXECUTED" : "CONTRACT_SIGNED",
    actorId: userId,
    metadata: {
      role: party.role,
      ipAddress: clientIp,
      isFullyExecuted: result.isFullyExecuted,
    },
  }).catch(console.error);

  // Dispatch real-time notifications
  if (result.isFullyExecuted) {
    for (const p of result.allParties) {
      dispatchNotification({
        userId: p.userId,
        type: "CONTRACT" as NotificationType,
        title: "Contract Fully Executed",
        body: `The contract "${contract.title}" for project "${contract.project.title}" has been signed by all parties and is now fully executed!`,
        linkUrl: `/projects/${contract.projectId}?tab=contracts&contractId=${contract.id}`,
      }).catch(console.error);
    }
  } else {
    // Notify the other party that this signer has completed their part
    for (const p of result.allParties) {
      if (p.userId !== userId) {
        dispatchNotification({
          userId: p.userId,
          type: "CONTRACT" as NotificationType,
          title: "Contract Signed by Counterparty",
          body: `${party.user.name} (${party.role.replace("_", " ")}) has signed the contract "${contract.title}". Please sign to complete execution.`,
          linkUrl: `/projects/${contract.projectId}?tab=contracts&contractId=${contract.id}`,
        }).catch(console.error);
      }
    }
  }

  return result.contract;
}

/**
 * Declines a contract in SENT status with a documented reason.
 */
export async function declineContract(params: DeclineContractParams) {
  const { contractId, userId, reason } = params;

  if (!reason || !reason.trim()) {
    throw new Error("A reason is required to decline a contract");
  }

  const contract = await prisma.contract.findUnique({
    where: { id: contractId },
    include: {
      parties: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
      project: { select: { id: true, title: true } },
    },
  });

  if (!contract) {
    throw new Error("Contract not found");
  }

  if (contract.status !== "SENT") {
    throw new Error(`Only contracts in SENT status can be declined. Current status is ${contract.status}.`);
  }

  const party = contract.parties.find((p) => p.userId === userId);
  if (!party) {
    throw new Error("Forbidden: You are not a party to this contract");
  }

  const updated = await prisma.contract.update({
    where: { id: contractId },
    data: {
      status: "DECLINED",
      declineReason: reason.trim(),
    },
    include: {
      parties: {
        include: { user: { select: { id: true, name: true, email: true } } },
      },
    },
  });

  logProjectActivity({
    projectId: contract.projectId,
    entityType: "CONTRACT",
    entityId: contract.id,
    action: "CONTRACT_DECLINED",
    actorId: userId,
    metadata: { reason: reason.trim(), declinedBy: party.user.name },
  }).catch(console.error);

  // Notify other parties
  for (const p of contract.parties) {
    if (p.userId !== userId) {
      dispatchNotification({
        userId: p.userId,
        type: "CONTRACT" as NotificationType,
        title: "Contract Declined",
        body: `${party.user.name} has declined contract "${contract.title}". Reason: ${reason.trim()}`,
        linkUrl: `/projects/${contract.projectId}?tab=contracts&contractId=${contract.id}`,
      }).catch(console.error);
    }
  }

  return updated;
}
