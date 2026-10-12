import { NextRequest, NextResponse } from "next/server";
import { requireAdminApi } from "@/lib/auth/admin";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireAdminApi(req);
  if (!auth.success) return auth.errorResponse;

  const url = new URL(req.url);
  const entityType = url.searchParams.get("entityType") || undefined;
  const action = url.searchParams.get("action") || undefined;
  const actorId = url.searchParams.get("actorId") || undefined;
  const page = Math.max(1, parseInt(url.searchParams.get("page") || "1", 10));
  const limit = Math.min(Math.max(1, parseInt(url.searchParams.get("limit") || "25", 10)), 50);
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {};

  if (entityType && entityType !== "ALL") {
    where.entityType = entityType;
  }
  if (action) {
    where.action = { contains: action, mode: "insensitive" };
  }
  if (actorId) {
    where.actorId = actorId;
  }

  try {
    const [logs, total] = await Promise.all([
      prisma.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          actor: {
            select: { id: true, name: true, email: true, role: true },
          },
        },
      }),
      prisma.activityLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error: unknown) {
    console.error("Admin audit logs error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to load audit logs" },
      { status: 500 }
    );
  }
}
