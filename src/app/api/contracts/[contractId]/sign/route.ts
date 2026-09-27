import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";

type RouteParams = { params: Promise<{ contractId: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { contractId } = await params;

    const contract = await prisma.contract.findUnique({
      where: { id: contractId },
      include: { parties: true },
    });

    if (!contract) {
      return NextResponse.json({ error: "Contract not found" }, { status: 404 });
    }

    const party = contract.parties.find((p) => p.userId === user.id);
    if (!party) {
      return NextResponse.json(
        { error: "Forbidden: You are not a designated signing party for this contract" },
        { status: 403 }
      );
    }

    if (party.signedAt) {
      return NextResponse.json(
        { message: "You have already signed this contract", contract },
        { status: 200 }
      );
    }

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const updatedContract = await prisma.$transaction(async (tx) => {
      // 1. Mark party as signed
      await tx.contractParty.update({
        where: { id: party.id },
        data: {
          signedAt: new Date(),
          ipAddress: clientIp,
        },
      });

      // 2. Check if all parties have now signed
      const allParties = await tx.contractParty.findMany({
        where: { contractId },
      });

      const allSigned = allParties.every((p) => (p.id === party.id ? true : !!p.signedAt));

      let nextStatus = contract.status;
      if (allSigned && contract.status !== "EXECUTED") {
        nextStatus = "EXECUTED";
        await tx.contract.update({
          where: { id: contractId },
          data: { status: "EXECUTED" },
        });
      } else if (contract.status === "DRAFT") {
        nextStatus = "SENT";
        await tx.contract.update({
          where: { id: contractId },
          data: { status: "SENT" },
        });
      }

      return {
        ...contract,
        status: nextStatus,
      };
    });

    logProjectActivity({
      projectId: contract.projectId,
      entityType: "CONTRACT",
      entityId: contract.id,
      action: "CONTRACT_SIGNED",
      actorId: user.id,
      metadata: { role: party.role, ipAddress: clientIp },
    }).catch(console.error);

    return NextResponse.json({
      success: true,
      message: "Contract signed successfully",
      contract: updatedContract,
    });
  } catch (error) {
    console.error("Sign contract error:", error);
    return NextResponse.json({ error: "Failed to sign contract" }, { status: 500 });
  }
}
