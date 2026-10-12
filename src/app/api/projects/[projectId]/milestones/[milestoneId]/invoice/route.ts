import { NextRequest, NextResponse } from "next/server";
import { getSessionRecord } from "@/lib/auth/session";
import { generateInvoiceFromMilestone } from "@/lib/invoices/service";

type RouteParams = {
  params: Promise<{
    projectId: string;
    milestoneId: string;
  }>;
};

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    // Use req.cookies directly for reliable test-context compatibility
    const sessionCookie = req.cookies.get("crewn_session")?.value;
    const sessionRecord = await getSessionRecord(sessionCookie);
    if (!sessionRecord?.user || !sessionRecord.user.isActive) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = sessionRecord.user.id;

    const { projectId, milestoneId } = await params;

    const invoice = await generateInvoiceFromMilestone({
      projectId,
      milestoneId,
      authorUserId: userId,
    });

    return NextResponse.json({ success: true, invoice }, { status: 201 });
  } catch (error: unknown) {
    console.error("Generate milestone invoice error:", error);
    const message = error instanceof Error ? error.message : "Failed to generate invoice";
    const status = message.includes("Forbidden") ? 403 : message.includes("not found") ? 404 : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
