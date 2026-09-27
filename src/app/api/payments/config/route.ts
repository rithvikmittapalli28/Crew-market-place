import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { env } from "@/lib/env";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const keyId =
    env.RAZORPAY_KEY_ID ||
    process.env.RAZORPAY_KEY_ID ||
    process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID ||
    "rzp_test_placeholder_key";

  return NextResponse.json({
    keyId,
    currency: "INR",
  });
}
