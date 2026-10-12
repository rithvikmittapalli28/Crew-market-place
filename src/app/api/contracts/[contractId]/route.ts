import { NextRequest, NextResponse } from "next/server";
import { getSessionRecord } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import {
  updateContractDraft,
  sendContractForSignature,
  declineContract,
} from "@/lib/contracts/service";

type RouteParams = { params: Promise<{ contractId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const sessionCookie = req.cookies.get("crewn_session")?.value;
    const sessionRecord = await getSessionRecord(sessionCookie);
    if (!sessionRecord?.user || !sessionRecord.user.isActive) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = { id: sessionRecord.user.id };

    const { contractId } = await params;

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: {
        parties: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        business: {
          select: { id: true, name: true, legalName: true, logoUrl: true },
        },
        project: {
          select: { id: true, title: true, status: true },
        },
      },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    // Authorization: User must be a party to this contract OR a member of the project
    const isParty = contract.parties.some((p) => p.userId === user.id);
    const isProjectMember = await prisma.projectMember.findFirst({
      where: {
        projectId: contract.projectId,
        userId: user.id,
      },
    });

    if (!isParty && !isProjectMember) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to view this contract" },
        { status: 403 }
      );
    }

    let parsedSnapshot = null;
    if (contract.signedSnapshotJson) {
      try {
        parsedSnapshot = JSON.parse(contract.signedSnapshotJson);
      } catch {
        parsedSnapshot = null;
      }
    }

    return NextResponse.json({
      success: true,
      contract: {
        id: contract.id,
        projectId: contract.projectId,
        project: contract.project,
        businessId: contract.businessId,
        business: contract.business,
        title: contract.title,
        termsText: contract.termsText,
        scopeOfWork: contract.scopeOfWork,
        deliverablesText: contract.deliverablesText,
        milestonesJson: contract.milestonesJson,
        paymentTerms: contract.paymentTerms,
        revisionTerms: contract.revisionTerms,
        cancellationTerms: contract.cancellationTerms,
        effectiveDate: contract.effectiveDate,
        expiresAt: contract.expiresAt,
        totalAmount: Number(contract.totalAmount),
        status: contract.status,
        declineReason: contract.declineReason,
        executedAt: contract.executedAt,
        signedSnapshot: parsedSnapshot,
        createdAt: contract.createdAt,
        updatedAt: contract.updatedAt,
        parties: contract.parties.map((p) => ({
          id: p.id,
          userId: p.userId,
          role: p.role,
          signedAt: p.signedAt,
          ipAddress: p.ipAddress,
          userAgent: p.userAgent,
          signatureDataUrl: p.signatureDataUrl,
          user: p.user,
        })),
      },
    });
  } catch (error) {
    console.error("Get contract error:", error);
    return NextResponse.json({ error: "Failed to retrieve contract" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const sessionCookie = req.cookies.get("crewn_session")?.value;
    const sessionRecord = await getSessionRecord(sessionCookie);
    if (!sessionRecord?.user || !sessionRecord.user.isActive) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = { id: sessionRecord.user.id };

    const { contractId } = await params;
    const body = await req.json().catch(() => ({}));

    // Action 1: Send for signature
    if (body.action === "send") {
      const contract = await sendContractForSignature(contractId, user.id);
      return NextResponse.json({ success: true, contract });
    }

    // Action 2: Decline contract
    if (body.action === "decline") {
      const reason = body.reason || "Declined by party";
      const contract = await declineContract({
        contractId,
        userId: user.id,
        reason,
      });
      return NextResponse.json({ success: true, contract });
    }

    // Action 3: Edit draft terms
    const amountNum = body.totalAmount !== undefined ? parseFloat(String(body.totalAmount)) : undefined;

    const contract = await updateContractDraft({
      contractId,
      userId: user.id,
      title: body.title,
      termsText: body.termsText,
      totalAmount: amountNum !== undefined && !isNaN(amountNum) ? amountNum : undefined,
      scopeOfWork: body.scopeOfWork,
      deliverablesText: body.deliverablesText,
      milestonesJson: typeof body.milestonesJson === "object" ? JSON.stringify(body.milestonesJson) : body.milestonesJson,
      paymentTerms: body.paymentTerms,
      revisionTerms: body.revisionTerms,
      cancellationTerms: body.cancellationTerms,
      effectiveDate: body.effectiveDate,
      expiresAt: body.expiresAt,
    });

    return NextResponse.json({ success: true, contract });
  } catch (error: unknown) {
    console.error("Patch contract error:", error);
    const message = error instanceof Error ? error.message : "Failed to update contract";
    const status = message.includes("Forbidden") ? 403 : message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
