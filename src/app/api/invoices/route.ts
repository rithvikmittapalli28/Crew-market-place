import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let invoices;

    if (user.role === "BUSINESS") {
      const businessIds = (user.businessMemberships ?? []).map((m) => m.businessId);
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
