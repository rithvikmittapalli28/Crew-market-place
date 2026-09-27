import { NextResponse } from "next/server";
import { requireFreelancerEarningsAccess } from "@/lib/auth/financial";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const access = await requireFreelancerEarningsAccess();
    if (!access) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const userId = access.user.id;

    // 1. Fetch all payouts for this freelancer
    const payouts = await prisma.payout.findMany({
      where: { recipientId: userId },
      orderBy: { createdAt: "desc" },
      include: {
        milestonePayment: {
          include: {
            milestone: {
              select: {
                id: true,
                title: true,
                project: {
                  select: { id: true, title: true },
                },
              },
            },
          },
        },
      },
    });

    // 2. Fetch active milestones in escrow where this freelancer is the assigned beneficiary
    const escrowMilestones = await prisma.milestonePayment.findMany({
      where: {
        status: "HELD_IN_ESCROW",
        milestone: {
          OR: [
            { freelancerId: userId },
            {
              project: {
                members: {
                  some: {
                    userId,
                    role: { in: ["FREELANCER", "TEAM_MEMBER"] },
                  },
                },
              },
            },
          ],
        },
      },
      include: {
        milestone: {
          select: {
            id: true,
            title: true,
            project: { select: { id: true, title: true } },
          },
        },
      },
    });

    let pendingPayoutsTotal = 0;
    let clearedEarningsTotal = 0;

    for (const p of payouts) {
      const amt = Number(p.amount);
      if (p.status === "PENDING" || p.status === "PROCESSING") {
        pendingPayoutsTotal += amt;
      } else if (p.status === "COMPLETED") {
        clearedEarningsTotal += amt;
      }
    }

    const escrowHeldTotal = escrowMilestones.reduce(
      (sum, mp) => sum + Number(mp.amount),
      0
    );

    return NextResponse.json({
      success: true,
      summary: {
        escrowHeld: escrowHeldTotal,
        pendingPayouts: pendingPayoutsTotal,
        clearedEarnings: clearedEarningsTotal,
        lifetimeEarnings: clearedEarningsTotal + pendingPayoutsTotal,
        currency: "INR",
      },
      payouts: payouts.map((p) => ({
        id: p.id,
        payoutReference: p.payoutReference,
        amount: Number(p.amount),
        currency: p.currency,
        status: p.status,
        payoutMethod: p.payoutMethod,
        processedAt: p.processedAt,
        createdAt: p.createdAt,
        milestoneTitle: p.milestonePayment?.milestone?.title || null,
        projectTitle: p.milestonePayment?.milestone?.project?.title || null,
        projectId: p.milestonePayment?.milestone?.project?.id || null,
      })),
      escrowMilestones: escrowMilestones.map((mp) => ({
        id: mp.id,
        amount: Number(mp.amount),
        currency: mp.currency,
        status: mp.status,
        escrowHeldAt: mp.escrowHeldAt,
        milestoneTitle: mp.milestone.title,
        projectTitle: mp.milestone.project.title,
        projectId: mp.milestone.project.id,
      })),
    });
  } catch (error) {
    console.error("Freelancer earnings error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve earnings summary" },
      { status: 500 }
    );
  }
}
