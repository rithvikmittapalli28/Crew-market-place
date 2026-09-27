import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";
import { ProjectStatus } from "@prisma/client";

// ---------------------------------------------------------------------------
// GET /api/projects — list projects accessible to the current user
// ---------------------------------------------------------------------------
export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    let projects;

    if (user.role === "BUSINESS") {
      // Business: all projects belonging to any of their businesses
      const businessIds = (user.businessMemberships ?? []).map((m) => m.businessId);
      projects = await prisma.project.findMany({
        where: { businessId: { in: businessIds } },
        include: {
          business: { select: { id: true, name: true, slug: true, logoUrl: true } },
          _count: { select: { members: true, milestones: true, tasks: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    } else if (user.role === "FREELANCER") {
      // Freelancer: only projects they are a ProjectMember of
      projects = await prisma.project.findMany({
        where: { members: { some: { userId: user.id } } },
        include: {
          business: { select: { id: true, name: true, slug: true, logoUrl: true } },
          _count: { select: { members: true, milestones: true, tasks: true } },
        },
        orderBy: { createdAt: "desc" },
      });
    } else {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json({ projects });
  } catch (error) {
    console.error("List projects error:", error);
    return NextResponse.json({ error: "Failed to list projects" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/projects — business owner/manager creates a project
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (user.role !== "BUSINESS") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    // Resolve businessId from session — never trust request body
    const ownerMembership = (user.businessMemberships ?? []).find(
      (m) => m.role === "OWNER" || m.role === "MANAGER"
    );
    if (!ownerMembership) {
      return NextResponse.json({ error: "No business ownership found" }, { status: 403 });
    }

    const body = await req.json();
    const {
      title,
      description,
      budgetMin,
      budgetMax,
      currency,
      startDate,
      deadline,
      status,
    } = body;

    if (!title || typeof title !== "string" || !title.trim()) {
      return NextResponse.json({ error: "Project title is required" }, { status: 400 });
    }

    const allowedStatuses: ProjectStatus[] = ["DRAFT", "OPEN"];
    const projectStatus: ProjectStatus = allowedStatuses.includes(status) ? status : "DRAFT";

    const project = await prisma.project.create({
      data: {
        businessId: ownerMembership.businessId,
        createdById: user.id,
        title: title.trim().slice(0, 200),
        description: description ? String(description).trim() : "",
        budgetMin: budgetMin != null ? parseFloat(String(budgetMin)) : null,
        budgetMax: budgetMax != null ? parseFloat(String(budgetMax)) : null,
        currency: currency || "INR",
        startDate: startDate ? new Date(startDate) : null,
        deadline: deadline ? new Date(deadline) : null,
        status: projectStatus,
        // Add the creator as OWNER project member
        members: {
          create: { userId: user.id, role: "OWNER" },
        },
      },
      include: {
        business: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
    });

    logProjectActivity({
      projectId: project.id,
      entityType: "PROJECT",
      entityId: project.id,
      action: "PROJECT_CREATED",
      actorId: user.id,
      metadata: { title: project.title, status: project.status },
    }).catch(console.error);

    return NextResponse.json({ success: true, project }, { status: 201 });
  } catch (error) {
    console.error("Create project error:", error);
    return NextResponse.json({ error: "Failed to create project" }, { status: 500 });
  }
}
