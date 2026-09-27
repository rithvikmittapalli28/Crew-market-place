import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import crypto from "crypto";

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "FREELANCER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const account = await prisma.bankAccount.findUnique({
      where: { userId: user.id },
      select: {
        id: true,
        accountHolderName: true,
        accountNumberMasked: true,
        ifscCode: true,
        bankName: true,
        upiId: true,
        isVerified: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      bankAccount: account,
    });
  } catch (error) {
    console.error("Get bank account error:", error);
    return NextResponse.json(
      { error: "Failed to retrieve bank account details" },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== "FREELANCER") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await req.json().catch(() => ({}));
    const { accountHolderName, accountNumber, ifscCode, bankName, upiId } = body;

    if (!accountHolderName || typeof accountHolderName !== "string" || !accountHolderName.trim()) {
      return NextResponse.json(
        { error: "Account holder name is required" },
        { status: 400 }
      );
    }

    if (!accountNumber || typeof accountNumber !== "string" || accountNumber.trim().length < 6) {
      return NextResponse.json(
        { error: "Valid bank account number is required (min 6 digits)" },
        { status: 400 }
      );
    }

    if (!ifscCode || typeof ifscCode !== "string" || ifscCode.trim().length !== 11) {
      return NextResponse.json(
        { error: "Valid 11-character Indian IFSC code is required" },
        { status: 400 }
      );
    }

    const cleanAccount = accountNumber.trim().replace(/\s+/g, "");
    const cleanIfsc = ifscCode.trim().toUpperCase();
    const lastFour = cleanAccount.slice(-4);
    const masked = `••••••••${lastFour}`;

    // Simple deterministic encryption / hash for safe persistence
    const secret = process.env.AUTH_SECRET || "fallback_salt_crewn_secret";
    const encrypted = crypto
      .createHmac("sha256", secret)
      .update(cleanAccount)
      .digest("hex");

    const saved = await prisma.bankAccount.upsert({
      where: { userId: user.id },
      update: {
        accountHolderName: accountHolderName.trim(),
        accountNumberMasked: masked,
        accountNumberEncrypted: encrypted,
        ifscCode: cleanIfsc,
        bankName: bankName ? String(bankName).trim() : null,
        upiId: upiId ? String(upiId).trim() : null,
        isVerified: true,
      },
      create: {
        userId: user.id,
        accountHolderName: accountHolderName.trim(),
        accountNumberMasked: masked,
        accountNumberEncrypted: encrypted,
        ifscCode: cleanIfsc,
        bankName: bankName ? String(bankName).trim() : null,
        upiId: upiId ? String(upiId).trim() : null,
        isVerified: true,
      },
    });

    return NextResponse.json({
      success: true,
      message: "Payout bank account saved successfully.",
      bankAccount: {
        id: saved.id,
        accountHolderName: saved.accountHolderName,
        accountNumberMasked: saved.accountNumberMasked,
        ifscCode: saved.ifscCode,
        bankName: saved.bankName,
        upiId: saved.upiId,
        isVerified: saved.isVerified,
      },
    });
  } catch (error) {
    console.error("Save bank account error:", error);
    return NextResponse.json(
      { error: "Failed to save bank account details" },
      { status: 500 }
    );
  }
}
