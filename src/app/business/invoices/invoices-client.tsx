"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  FileText,
  Printer,
  ShieldCheck,
} from "lucide-react";
import { formatINR } from "@/lib/payments/currency";

export interface InvoiceItem {
  id: string;
  invoiceNumber: string;
  totalAmount: number;
  taxAmount: number;
  currency: string;
  status: string;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
  businessName: string;
  recipientName: string;
  recipientEmail: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
    total: number;
  }>;
}

interface InvoicesClientProps {
  invoices: InvoiceItem[];
}

export function BusinessInvoicesClient({ invoices }: InvoicesClientProps) {
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceItem | null>(null);

  const totalBilled = invoices.reduce((sum, inv) => sum + inv.totalAmount, 0);

  return (
    <div className="space-y-6">
      {/* Overview Stat */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Total Invoiced Volume</CardDescription>
            <CardTitle className="text-2xl font-bold text-foreground">
              {formatINR(totalBilled)}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">{invoices.length} total receipts & invoices</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Settled Invoices</CardDescription>
            <CardTitle className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {invoices.filter((i) => i.status === "PAID").length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">Escrow funding receipts cleared</p>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card">
          <CardHeader className="pb-2">
            <CardDescription className="text-xs">Payment Gateway</CardDescription>
            <CardTitle className="text-xl font-bold text-primary flex items-center gap-1.5">
              <ShieldCheck className="h-5 w-5" />
              Razorpay Escrow
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-[11px] text-muted-foreground">100% compliant Indian GST invoices</p>
          </CardContent>
        </Card>
      </div>

      {/* Invoice Table / List */}
      <Card className="border border-border bg-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Billing Receipts & Tax Invoices
          </CardTitle>
          <CardDescription className="text-xs">
            Download or print official receipts for milestone funding and platform fees.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <p className="py-8 text-center text-xs text-muted-foreground">
              No invoices generated yet. Invoices are automatically issued when milestones are funded.
            </p>
          ) : (
            <div className="divide-y divide-border/60">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 py-3 hover:bg-secondary/20 rounded px-2 -mx-2 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground">
                        {inv.invoiceNumber}
                      </span>
                      <Badge
                        variant="outline"
                        size="sm"
                        className={`text-[9px] ${
                          inv.status === "PAID"
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : "bg-secondary text-foreground"
                        }`}
                      >
                        {inv.status}
                      </Badge>
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {inv.items[0]?.description || "Milestone Escrow Funding"}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Paid on {new Date(inv.paidAt || inv.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p className="text-xs font-bold text-foreground">
                        {formatINR(inv.totalAmount)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">Incl. GST/Fees</p>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedInvoice(inv)}
                      className="text-xs h-7 gap-1"
                    >
                      <FileText className="h-3 w-3" />
                      View Invoice
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Invoice Modal */}
      {selectedInvoice && (
        <Dialog open={!!selectedInvoice} onOpenChange={() => setSelectedInvoice(null)}>
          <DialogContent className="sm:max-w-lg print:border-none print:shadow-none">
            <DialogHeader className="border-b border-border pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <DialogTitle className="text-base font-bold text-foreground">
                    Tax Invoice / Receipt
                  </DialogTitle>
                  <DialogDescription className="text-xs font-mono text-muted-foreground">
                    {selectedInvoice.invoiceNumber}
                  </DialogDescription>
                </div>
                <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                  {selectedInvoice.status}
                </Badge>
              </div>
            </DialogHeader>

            <div className="space-y-4 pt-2 text-xs">
              {/* Header Details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-foreground">Platform Provider:</p>
                  <p className="text-muted-foreground">Crewn Technologies Pvt Ltd</p>
                  <p className="text-muted-foreground">Bangalore, Karnataka, India</p>
                  <p className="text-muted-foreground">support@crewn.com</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-foreground">Billed To:</p>
                  <p className="text-muted-foreground">{selectedInvoice.businessName}</p>
                  <p className="text-muted-foreground">{selectedInvoice.recipientName}</p>
                  <p className="text-muted-foreground">{selectedInvoice.recipientEmail}</p>
                </div>
              </div>

              {/* Line Items Table */}
              <div className="rounded border border-border overflow-hidden">
                <table className="w-full text-left">
                  <thead className="bg-secondary/40 text-[11px] text-muted-foreground font-semibold">
                    <tr>
                      <th className="p-2">Description</th>
                      <th className="p-2 text-right">Qty</th>
                      <th className="p-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/60">
                    {selectedInvoice.items.map((item, idx) => (
                      <tr key={idx} className="text-xs">
                        <td className="p-2 text-foreground">{item.description}</td>
                        <td className="p-2 text-right font-mono text-muted-foreground">{item.quantity}</td>
                        <td className="p-2 text-right font-mono font-medium text-foreground">
                          {formatINR(item.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Totals */}
              <div className="border-t border-border pt-2 space-y-1 text-right">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal:</span>
                  <span className="font-mono">{formatINR(selectedInvoice.totalAmount - selectedInvoice.taxAmount)}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>Taxes (GST 0% on Escrow Deposit):</span>
                  <span className="font-mono">{formatINR(selectedInvoice.taxAmount)}</span>
                </div>
                <div className="flex justify-between font-bold text-sm text-foreground pt-1 border-t border-border/60">
                  <span>Total Paid:</span>
                  <span className="font-mono text-primary">{formatINR(selectedInvoice.totalAmount)}</span>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => window.print()}
                  className="text-xs gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  Print / Save PDF
                </Button>
                <Button
                  size="sm"
                  onClick={() => setSelectedInvoice(null)}
                  className="text-xs"
                >
                  Close
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
