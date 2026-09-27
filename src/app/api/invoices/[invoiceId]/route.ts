import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ invoiceId: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { invoiceId } = await params;

    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: {
        business: {
          select: {
            id: true,
            name: true,
            legalName: true,
            taxId: true,
            website: true,
            logoUrl: true,
          },
        },
        recipient: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Authorization check: User must be a member of the paying business OR the recipient
    const userBusinessIds = (user.businessMemberships ?? []).map((m) => m.businessId);
    const isBusinessMember = userBusinessIds.includes(invoice.businessId);
    const isRecipient = invoice.recipientId === user.id;

    if (!isBusinessMember && !isRecipient) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to view this invoice" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      success: true,
      invoice: {
        id: invoice.id,
        invoiceNumber: invoice.invoiceNumber,
        totalAmount: Number(invoice.totalAmount),
        taxAmount: Number(invoice.taxAmount),
        currency: invoice.currency,
        status: invoice.status,
        dueDate: invoice.dueDate,
        paidAt: invoice.paidAt,
        createdAt: invoice.createdAt,
        business: invoice.business,
        recipient: invoice.recipient,
        items: invoice.itemsJson ? JSON.parse(invoice.itemsJson) : [],
      },
    });
  } catch (error) {
    console.error("Get invoice error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve invoice" },
      { status: 500 }
    );
  }
}
