import { NextResponse } from "next/server";
import { destroySession, getSessionRecord } from "@/lib/auth/session";
import { logAuthEvent } from "@/lib/auth/audit";

export async function POST() {
  try {
    const session = await getSessionRecord();
    const userId = session?.userId;

    await destroySession();

    if (userId) {
      await logAuthEvent({
        action: "LOGOUT",
        userId,
        actorId: userId,
      });
    }

    return NextResponse.json({
      success: true,
      message: "Logged out successfully.",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Failed to sign out cleanly." },
      { status: 500 }
    );
  }
}
