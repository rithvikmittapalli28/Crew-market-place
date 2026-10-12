import { NextRequest, NextResponse } from "next/server";
import { requireAdminUser } from "@/lib/auth/admin";
import {
  runFinancialReconciliation,
  resolveFinancialDiscrepancy,
} from "@/lib/payments/reconciliation";

export async function GET() {
  try {
    await requireAdminUser();
    const report = await runFinancialReconciliation();
    return NextResponse.json(report, { status: 200 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    return NextResponse.json({ error: msg }, { status: msg.includes("Unauthorized") ? 401 : 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const admin = await requireAdminUser();
    const body = await req.json();

    const { discrepancyId, resolutionAction, notes, entityType, entityId } = body;
    if (!discrepancyId || !resolutionAction || !entityType || !entityId) {
      return NextResponse.json(
        { error: "Missing required fields: discrepancyId, resolutionAction, entityType, entityId" },
        { status: 400 }
      );
    }

    const result = await resolveFinancialDiscrepancy({
      adminUserId: admin.id,
      discrepancyId,
      resolutionAction,
      notes: notes || "Audited manual resolution via Admin Reconciliation Console",
      entityType,
      entityId,
    });

    return NextResponse.json(result, { status: 200 });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Internal error";
    return NextResponse.json({ error: msg }, { status: msg.includes("Unauthorized") ? 401 : 500 });
  }
}
