import PDFDocument from "pdfkit";

export interface InvoicePdfData {
  invoiceNumber: string;
  createdAt: Date | string;
  dueDate?: Date | string | null;
  paidAt?: Date | string | null;
  status: string;
  currency: string;
  subtotalAmount: number;
  platformFeeAmount?: number;
  taxAmount: number;
  totalAmount: number;
  paymentReference?: string | null;
  notes?: string | null;
  business: {
    name: string;
    legalName?: string | null;
    taxId?: string | null;
    website?: string | null;
  };
  recipient: {
    name?: string | null;
    email?: string | null;
  };
  project?: {
    title: string;
  } | null;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

/**
 * Generates a clean, professional vector PDF invoice using PDFKit.
 * Pure Node.js, uses standard PostScript fonts for 100% reliability.
 */
export async function generateInvoicePdfBuffer(data: InvoicePdfData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 48, size: "A4" });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err: Error) => reject(err));

      // Color Palette
      const primaryColor = "#0f172a"; // Deep Slate
      const secondaryColor = "#475569"; // Slate 600
      const accentGreen = "#059669"; // Emerald 600
      const accentAmber = "#d97706"; // Amber 600
      const borderColor = "#e2e8f0"; // Slate 200

      // 1. Header Banner
      doc
        .font("Helvetica-Bold")
        .fontSize(22)
        .fillColor(primaryColor)
        .text("CREWN", 48, 48, { characterSpacing: 1 });

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(secondaryColor)
        .text("Creative Collaboration & Escrow Platform", 48, 74);

      doc
        .font("Helvetica-Bold")
        .fontSize(20)
        .fillColor(primaryColor)
        .text("INVOICE", 400, 48, { align: "right" });

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(secondaryColor)
        .text(`#${data.invoiceNumber}`, 400, 72, { align: "right" });

      // Status Pill on top right
      const isPaid = data.status === "PAID";
      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(isPaid ? accentGreen : accentAmber)
        .text(isPaid ? "● STATUS: PAID" : "● STATUS: ISSUED", 400, 88, { align: "right" });

      doc
        .strokeColor(borderColor)
        .lineWidth(1)
        .moveTo(48, 110)
        .lineTo(547, 110)
        .stroke();

      // 2. Metadata Columns (Bill To / Bill From & Key Dates)
      const issueDate = new Date(data.createdAt).toLocaleDateString("en-IN", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });

      const dueDateStr = data.dueDate
        ? new Date(data.dueDate).toLocaleDateString("en-IN", {
            year: "numeric",
            month: "short",
            day: "numeric",
          })
        : "Upon Presentation";

      // Left Column: Bill To (Business / Client)
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(primaryColor)
        .text("BILLED TO", 48, 125);

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(primaryColor)
        .text(data.business.name || "Client Business", 48, 140);

      let currentLeftY = 154;
      if (data.business.legalName && data.business.legalName !== data.business.name) {
        doc.font("Helvetica").fontSize(9).fillColor(secondaryColor).text(data.business.legalName, 48, currentLeftY);
        currentLeftY += 14;
      }
      if (data.business.taxId) {
        doc.font("Helvetica").fontSize(9).fillColor(secondaryColor).text(`GSTIN / Tax ID: ${data.business.taxId}`, 48, currentLeftY);
        currentLeftY += 14;
      }
      if (data.recipient.email) {
        doc.font("Helvetica").fontSize(9).fillColor(secondaryColor).text(`Contact: ${data.recipient.name || data.recipient.email}`, 48, currentLeftY);
        currentLeftY += 14;
      }

      // Right Column: Invoice Details & Reference
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(primaryColor)
        .text("INVOICE DETAILS", 350, 125);

      doc.font("Helvetica").fontSize(9).fillColor(secondaryColor);
      doc.text("Issue Date:", 350, 140).font("Helvetica-Bold").text(issueDate, 440, 140, { align: "right" });
      doc.font("Helvetica").text("Due Date:", 350, 154).font("Helvetica-Bold").text(dueDateStr, 440, 154, { align: "right" });

      if (data.project?.title) {
        doc.font("Helvetica").text("Project:", 350, 168).font("Helvetica-Bold").text(data.project.title, 440, 168, { align: "right", width: 107 });
      }

      if (data.paymentReference) {
        doc.font("Helvetica").text("Payment Ref:", 350, 192).font("Helvetica-Bold").text(data.paymentReference, 440, 192, { align: "right" });
      }

      // 3. Line Items Table
      const tableTopY = Math.max(currentLeftY + 20, 225);

      // Table Header Background
      doc
        .rect(48, tableTopY, 499, 22)
        .fill("#f8fafc");

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor(primaryColor)
        .text("DESCRIPTION", 56, tableTopY + 6)
        .text("QTY", 360, tableTopY + 6, { width: 40, align: "center" })
        .text("UNIT PRICE", 410, tableTopY + 6, { width: 60, align: "right" })
        .text("AMOUNT", 480, tableTopY + 6, { width: 60, align: "right" });

      doc
        .strokeColor(borderColor)
        .lineWidth(1)
        .moveTo(48, tableTopY + 22)
        .lineTo(547, tableTopY + 22)
        .stroke();

      let rowY = tableTopY + 30;

      data.items.forEach((item) => {
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(primaryColor)
          .text(item.description, 56, rowY, { width: 290 })
          .text(String(item.quantity), 360, rowY, { width: 40, align: "center" })
          .text(`₹${Number(item.unitPrice).toLocaleString("en-IN")}`, 410, rowY, { width: 60, align: "right" })
          .text(`₹${Number(item.total).toLocaleString("en-IN")}`, 480, rowY, { width: 60, align: "right" });

        rowY += 24;

        doc
          .strokeColor("#f1f5f9")
          .lineWidth(0.5)
          .moveTo(48, rowY - 6)
          .lineTo(547, rowY - 6)
          .stroke();
      });

      // 4. Financial Summary Block
      const summaryStartY = Math.max(rowY + 10, 360);

      doc
        .font("Helvetica")
        .fontSize(9)
        .fillColor(secondaryColor)
        .text("Subtotal:", 350, summaryStartY)
        .font("Helvetica-Bold")
        .fillColor(primaryColor)
        .text(`₹${data.subtotalAmount.toLocaleString("en-IN")}`, 460, summaryStartY, { align: "right" });

      let currentSummaryY = summaryStartY + 16;

      if (data.platformFeeAmount && data.platformFeeAmount > 0) {
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(secondaryColor)
          .text("Platform Processing Fee:", 350, currentSummaryY)
          .font("Helvetica-Bold")
          .fillColor(primaryColor)
          .text(`₹${data.platformFeeAmount.toLocaleString("en-IN")}`, 460, currentSummaryY, { align: "right" });
        currentSummaryY += 16;
      }

      if (data.taxAmount > 0) {
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor(secondaryColor)
          .text("Applicable Taxes (GST):", 350, currentSummaryY)
          .font("Helvetica-Bold")
          .fillColor(primaryColor)
          .text(`₹${data.taxAmount.toLocaleString("en-IN")}`, 460, currentSummaryY, { align: "right" });
        currentSummaryY += 16;
      }

      // Total Box
      doc
        .rect(340, currentSummaryY + 4, 207, 30)
        .fill("#f1f5f9");

      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(primaryColor)
        .text("TOTAL DUE:", 352, currentSummaryY + 13)
        .fontSize(12)
        .text(`₹${data.totalAmount.toLocaleString("en-IN")} ${data.currency}`, 430, currentSummaryY + 12, { align: "right" });

      // 5. Footer & Authenticity Stamp
      const footerY = 730;

      doc
        .strokeColor(borderColor)
        .lineWidth(1)
        .moveTo(48, footerY)
        .lineTo(547, footerY)
        .stroke();

      doc
        .font("Helvetica-Bold")
        .fontSize(8)
        .fillColor(secondaryColor)
        .text("CREWN ESCROW SERVICES & DIGITAL SETTLEMENTS", 48, footerY + 8)
        .font("Helvetica")
        .fontSize(7.5)
        .fillColor("#94a3b8")
        .text(
          "This document is an authoritative financial record generated by Crewn. All milestone payments are protected by platform escrow protocols.",
          48,
          footerY + 20,
          { width: 499 }
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
