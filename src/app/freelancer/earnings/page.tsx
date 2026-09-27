import { requireFreelancer } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/layout/app-header";
import { FreelancerEarningsClient } from "./earnings-client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Earnings & Payouts — Crewn",
  description: "Track your escrow balance, cleared earnings, and milestone payouts.",
};

export default async function FreelancerEarningsPage() {
  const user = await requireFreelancer();

  // 1. Fetch payouts for current user
  const payouts = await prisma.payout.findMany({
    where: { recipientId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      milestonePayment: {
        include: {
          milestone: {
            select: {
              id: true,
              title: true,
              project: { select: { id: true, title: true } },
            },
          },
        },
      },
    },
  });

  // 2. Fetch active escrow milestones
  const escrowMilestones = await prisma.milestonePayment.findMany({
    where: {
      status: "HELD_IN_ESCROW",
      milestone: {
        OR: [
          { freelancerId: user.id },
          {
            project: {
              members: {
                some: {
                  userId: user.id,
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

  // 3. Fetch bank account details
  const bankAccount = await prisma.bankAccount.findUnique({
    where: { userId: user.id },
    select: {
      accountHolderName: true,
      accountNumberMasked: true,
      ifscCode: true,
      bankName: true,
      upiId: true,
      isVerified: true,
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

  const summary = {
    escrowHeld: escrowHeldTotal,
    pendingPayouts: pendingPayoutsTotal,
    clearedEarnings: clearedEarningsTotal,
    lifetimeEarnings: clearedEarningsTotal + pendingPayoutsTotal,
    currency: "INR",
  };

  const formattedPayouts = payouts.map((p) => ({
    id: p.id,
    payoutReference: p.payoutReference,
    amount: Number(p.amount),
    currency: p.currency,
    status: p.status,
    payoutMethod: p.payoutMethod,
    processedAt: p.processedAt ? p.processedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    milestoneTitle: p.milestonePayment?.milestone?.title || null,
    projectTitle: p.milestonePayment?.milestone?.project?.title || null,
    projectId: p.milestonePayment?.milestone?.project?.id || null,
  }));

  const formattedEscrow = escrowMilestones.map((mp) => ({
    id: mp.id,
    amount: Number(mp.amount),
    currency: mp.currency,
    status: mp.status,
    escrowHeldAt: mp.escrowHeldAt ? mp.escrowHeldAt.toISOString() : null,
    milestoneTitle: mp.milestone.title,
    projectTitle: mp.milestone.project.title,
    projectId: mp.milestone.project.id,
  }));

  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Earnings & Payouts"
        subtitle="Manage your escrow balance, cleared payouts, and bank details."
      />
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <FreelancerEarningsClient
          summary={summary}
          payouts={formattedPayouts}
          escrowMilestones={formattedEscrow}
          bankAccount={bankAccount}
        />
      </main>
    </div>
  );
}
