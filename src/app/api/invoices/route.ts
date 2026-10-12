import { NextRequest, NextResponse } from "next/server";
import { getSessionRecord } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    // Use req.cookies directly for reliable test-context compatibility
    const sessionCookie = req.cookies.get("crewn_session")?.value;
    const sessionRecord = await getSessionRecord(sessionCookie);
    if (!sessionRecord?.user || !sessionRecord.user.isActive) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { user } = sessionRecord;

    let invoices;

    if (user.role === "BUSINESS") {
      const memberships = await prisma.businessMember.findMany({
        where: { userId: user.id },
        select: { businessId: true },
      });
      const businessIds = memberships.map((m) => m.businessId);
      invoices = await prisma.invoice.findMany({
        where: { businessId: { in: businessIds } },
        orderBy: { createdAt: "desc" },
        include: {
          business: { select: { id: true, name: true, logoUrl: true } },
          recipient: { select: { id: true, name: true, email: true } },
        },
      });
    } else if (user.role === "FREELANCER") {
      invoices = await prisma.invoice.findMany({
        where: { recipientId: user.id },
        orderBy: { createdAt: "desc" },
        include: {
          business: { select: { id: true, name: true, logoUrl: true } },
          recipient: { select: { id: true, name: true, email: true } },
        },
      });
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      invoices: invoices.map((inv) => ({
        id: inv.id,
        invoiceNumber: inv.invoiceNumber,
        totalAmount: Number(inv.totalAmount),
        taxAmount: Number(inv.taxAmount),
        currency: inv.currency,
        status: inv.status,
        dueDate: inv.dueDate,
        paidAt: inv.paidAt,
        createdAt: inv.createdAt,
        business: inv.business,
        recipient: inv.recipient,
        items: inv.itemsJson ? JSON.parse(inv.itemsJson) : [],
      })),
    });
  } catch (error) {
    console.error("List invoices error:", error);
    return NextResponse.json(
      { error: "Failed to list invoices" },
      { status: 500 }
    );
  }
}
