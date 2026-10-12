import { NextRequest, NextResponse } from "next/server";
import { getSessionRecord } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { generateInvoicePdfBuffer } from "@/lib/invoices/pdf";

type RouteParams = { params: Promise<{ invoiceId: string }> };

export async function GET(req: NextRequest, { params }: RouteParams) {
  try {
    // Use req.cookies directly (same pattern as SSE routes) for reliable test compat
    const sessionCookie = req.cookies.get("crewn_session")?.value;
    const sessionRecord = await getSessionRecord(sessionCookie);
    if (!sessionRecord?.user || !sessionRecord.user.isActive) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = sessionRecord.user.id;

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
          select: { id: true, name: true, email: true },
        },
        milestone: {
          select: { id: true, title: true },
        },
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    // Authorization: business member or invoice recipient
    const userBusinessMemberships = await prisma.businessMember.findMany({
      where: { userId },
      select: { businessId: true },
    });
    const userBusinessIds = userBusinessMemberships.map((m) => m.businessId);
    const isBusinessMember = userBusinessIds.includes(invoice.businessId);
    const isRecipient = invoice.recipientId === userId;

    if (!isBusinessMember && !isRecipient) {
      return NextResponse.json(
        { error: "Forbidden: You are not authorized to download this invoice" },
        { status: 403 }
      );
    }

    const items: Array<{ description: string; quantity: number; unitPrice: number; total: number }> =
      invoice.itemsJson ? JSON.parse(invoice.itemsJson) : [];

    const pdfBuffer = await generateInvoicePdfBuffer({
      invoiceNumber: invoice.invoiceNumber,
      createdAt: invoice.createdAt,
      dueDate: invoice.dueDate ?? null,
      paidAt: invoice.paidAt ?? null,
      status: invoice.status,
      currency: invoice.currency,
      subtotalAmount: Number(invoice.subtotalAmount ?? invoice.totalAmount),
      platformFeeAmount: Number(invoice.platformFeeAmount ?? 0),
      taxAmount: Number(invoice.taxAmount),
      totalAmount: Number(invoice.totalAmount),
      paymentReference: invoice.paymentReference ?? null,
      notes: invoice.notes ?? null,
      business: {
        name: invoice.business.name,
        legalName: invoice.business.legalName ?? null,
        taxId: invoice.business.taxId ?? null,
        website: invoice.business.website ?? null,
      },
      recipient: {
        name: invoice.recipient.name,
        email: invoice.recipient.email,
      },
      items,
    });

    const filename = `${invoice.invoiceNumber}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(pdfBuffer.length),
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Invoice PDF generation error:", error);
    return NextResponse.json(
      { error: "Failed to generate invoice PDF" },
      { status: 500 }
    );
  }
}
