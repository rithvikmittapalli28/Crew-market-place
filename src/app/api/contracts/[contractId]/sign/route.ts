import { NextRequest, NextResponse } from "next/server";
import { getSessionRecord } from "@/lib/auth/session";
import { signContract } from "@/lib/contracts/service";

type RouteParams = { params: Promise<{ contractId: string }> };

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const sessionCookie = req.cookies.get("crewn_session")?.value;
    const sessionRecord = await getSessionRecord(sessionCookie);
    if (!sessionRecord?.user || !sessionRecord.user.isActive) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = { id: sessionRecord.user.id };

    const { contractId } = await params;
    const body = await req.json().catch(() => ({}));
    const { signatureDataUrl } = body;

    if (!signatureDataUrl || typeof signatureDataUrl !== "string" || !signatureDataUrl.startsWith("data:image/")) {
      return NextResponse.json(
        { error: "A valid signature image (data:image/...) is required to sign this contract" },
        { status: 400 }
      );
    }

    const clientIp =
      req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      req.headers.get("x-real-ip") ||
      "127.0.0.1";

    const userAgent = req.headers.get("user-agent") || "Web Browser";

    const contract = await signContract({
      contractId,
      userId: user.id,
      signatureDataUrl,
      ipAddress: clientIp,
      userAgent,
    });

    return NextResponse.json({
      success: true,
      message: "Contract signed successfully",
      contract,
    });
  } catch (error: unknown) {
    console.error("Sign contract error:", error);
    const message = error instanceof Error ? error.message : "Failed to sign contract";
    const status = message.includes("Forbidden")
      ? 403
      : message.includes("not found")
      ? 404
      : message.includes("already signed") || message.includes("already been fully executed")
      ? 409
      : 400;
    return NextResponse.json({ error: message }, { status });
  }
}
