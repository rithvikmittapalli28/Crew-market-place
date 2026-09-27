import { NextRequest, NextResponse } from "next/server";
import { requireProjectMember, requireBusinessProjectAccess } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";

type RouteParams = { params: Promise<{ projectId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const access = await requireProjectMember(projectId);
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
      },
    });

    return NextResponse.json({
      success: true,
      contracts: contracts.map((c) => ({
        id: c.id,
        title: c.title,
        termsText: c.termsText,
        totalAmount: Number(c.totalAmount),
        status: c.status,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
        parties: c.parties.map((p) => ({
          id: p.id,
          userId: p.userId,
          role: p.role,
          signedAt: p.signedAt,
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
    const access = await requireBusinessProjectAccess(projectId, ["OWNER", "MANAGER"]);
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { title, termsText, totalAmount, freelancerId } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Contract title is required" }, { status: 400 });
    }

    if (!termsText || typeof termsText !== "string" || !termsText.trim()) {
      return NextResponse.json({ error: "Contract termsText is required" }, { status: 400 });
    }

    const amountNum = parseFloat(String(totalAmount ?? 0));
    if (isNaN(amountNum) || amountNum < 0) {
      return NextResponse.json({ error: "Valid non-negative totalAmount is required" }, { status: 400 });
    }

    // Resolve freelancer party
    let targetFreelancerId = freelancerId;
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
      const c = await tx.contract.create({
        data: {
          projectId,
          businessId: access.businessId,
          title: title.trim(),
          termsText: termsText.trim(),
          totalAmount: amountNum,
          status: "DRAFT",
          parties: {
            create: [
              {
                userId: access.user.id,
                role: "CLIENT_SIGNER",
              },
              ...(targetFreelancerId
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
          parties: true,
        },
      });
      return c;
    });

    logProjectActivity({
      projectId,
      entityType: "CONTRACT",
      entityId: contract.id,
      action: "CONTRACT_CREATED",
      actorId: access.user.id,
      metadata: { title: contract.title, totalAmount: amountNum },
    }).catch(console.error);

    return NextResponse.json({ success: true, contract }, { status: 201 });
  } catch (error) {
    console.error("Create contract error:", error);
    return NextResponse.json({ error: "Failed to create contract" }, { status: 500 });
  }
}
