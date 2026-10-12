import { NextRequest, NextResponse } from "next/server";
import { requireProjectMember, requireBusinessProjectAccess } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { createContractDraft } from "@/lib/contracts/service";

type RouteParams = { params: Promise<{ projectId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const sessionCookie = req.cookies.get("crewn_session")?.value;
    const access = await requireProjectMember(projectId, undefined, sessionCookie);
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const contracts = await prisma.contract.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: {
        parties: {
          include: {
            user: {
              select: { id: true, name: true, email: true, avatarUrl: true },
            },
          },
        },
        business: {
          select: { id: true, name: true, logoUrl: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      contracts: contracts.map((c) => ({
        id: c.id,
        projectId: c.projectId,
        businessId: c.businessId,
        business: c.business,
        title: c.title,
        termsText: c.termsText,
        scopeOfWork: c.scopeOfWork,
        deliverablesText: c.deliverablesText,
        milestonesJson: c.milestonesJson,
        paymentTerms: c.paymentTerms,
        revisionTerms: c.revisionTerms,
        cancellationTerms: c.cancellationTerms,
        effectiveDate: c.effectiveDate,
        expiresAt: c.expiresAt,
        totalAmount: Number(c.totalAmount),
        status: c.status,
        declineReason: c.declineReason,
        executedAt: c.executedAt,
        hasSignedSnapshot: !!c.signedSnapshotJson,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        parties: c.parties.map((p) => ({
          id: p.id,
          userId: p.userId,
          role: p.role,
          signedAt: p.signedAt,
          ipAddress: p.ipAddress,
          userAgent: p.userAgent,
          hasSignature: !!p.signatureDataUrl,
          user: p.user,
        })),
      })),
    });
  } catch (error) {
    console.error("List contracts error:", error);
    return NextResponse.json({ error: "Failed to list contracts" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const sessionCookie = req.cookies.get("crewn_session")?.value;
    const access = await requireBusinessProjectAccess(projectId, ["OWNER", "MANAGER"], sessionCookie);
    if (!access) {
      return NextResponse.json({ error: "Forbidden: Only project owners or managers can create contracts" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const {
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
      freelancerId,
    } = body;

    const amountNum = parseFloat(String(totalAmount ?? 0));

    const contract = await createContractDraft({
      projectId,
      businessId: access.businessId,
      authorUserId: access.user.id,
      title,
      termsText,
      totalAmount: isNaN(amountNum) ? 0 : amountNum,
      scopeOfWork,
      deliverablesText,
      milestonesJson: typeof milestonesJson === "object" ? JSON.stringify(milestonesJson) : milestonesJson,
      paymentTerms,
      revisionTerms,
      cancellationTerms,
      effectiveDate,
      expiresAt,
      freelancerUserId: freelancerId,
    });

    return NextResponse.json({ success: true, contract }, { status: 201 });
  } catch (error: unknown) {
    console.error("Create contract error:", error);
    const message = error instanceof Error ? error.message : "Failed to create contract";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
