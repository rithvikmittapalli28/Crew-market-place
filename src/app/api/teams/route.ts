import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { prisma } from "@/lib/prisma";
import { logProjectActivity } from "@/lib/projects/activity";

// ---------------------------------------------------------------------------
// GET /api/teams — list user's teams or public teams
// ---------------------------------------------------------------------------
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const url = new URL(req.url);
    const search = url.searchParams.get("search");

    if (search) {
      const teams = await prisma.team.findMany({
        where: {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { slug: { contains: search, mode: "insensitive" } },
          ],
        },
        include: {
          leadFreelancer: {
            select: { id: true, name: true, avatarUrl: true, freelancerProfile: { select: { headline: true } } },
          },
          members: {
            include: {
              freelancer: {
                select: { id: true, name: true, avatarUrl: true, freelancerProfile: { select: { headline: true } } },
              },
            },
          },
          _count: { select: { members: true, assignedProjects: true } },
        },
        take: 20,
      });
      return NextResponse.json({ teams });
    }

    // Default: return teams where user is leader or member
    const teams = await prisma.team.findMany({
      where: {
        OR: [
          { leadFreelancerId: user.id },
          { members: { some: { freelancerId: user.id } } },
        ],
      },
      include: {
        leadFreelancer: {
          select: { id: true, name: true, avatarUrl: true, freelancerProfile: { select: { headline: true } } },
        },
        members: {
          include: {
            freelancer: {
              select: { id: true, name: true, avatarUrl: true, freelancerProfile: { select: { headline: true } } },
            },
          },
        },
        _count: { select: { members: true, assignedProjects: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ teams });
  } catch (error) {
    console.error("List teams error:", error);
    return NextResponse.json({ error: "Failed to list teams" }, { status: 500 });
  }
}

// ---------------------------------------------------------------------------
// POST /api/teams — create a freelancer team
// Only authenticated FREELANCER (or ADMIN) can create teams
// ---------------------------------------------------------------------------
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    if (user.role !== "FREELANCER" && user.role !== "ADMIN") {
      return NextResponse.json(
        { error: "Only freelancers can create teams" },
        { status: 403 }
      );
    }

    const body = await req.json();
    const { name, tagline, bio, logoUrl } = body;

    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Team name is required" }, { status: 400 });
    }

    // Generate unique slug
    const baseSlug = name
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    let slug = baseSlug || `team-${Date.now()}`;

    // Ensure unique slug
    const existing = await prisma.team.findUnique({ where: { slug } });
    if (existing) {
      slug = `${slug}-${Math.random().toString(36).substring(2, 6)}`;
    }

    const team = await prisma.team.create({
      data: {
        name: name.trim().slice(0, 100),
        slug,
        tagline: tagline ? String(tagline).trim().slice(0, 200) : null,
        bio: bio ? String(bio).trim() : null,
        logoUrl: logoUrl ? String(logoUrl).trim() : null,
        leadFreelancerId: user.id,
        members: {
          create: {
            freelancerId: user.id,
            role: "LEADER",
          },
        },
      },
      include: {
        leadFreelancer: {
          select: { id: true, name: true, avatarUrl: true, freelancerProfile: { select: { headline: true } } },
        },
        members: {
          include: {
            freelancer: {
              select: { id: true, name: true, avatarUrl: true, freelancerProfile: { select: { headline: true } } },
            },
          },
        },
      },
    });

    logProjectActivity({
      projectId: "GLOBAL",
      entityType: "TEAM",
      entityId: team.id,
      action: "TEAM_CREATED",
      actorId: user.id,
      metadata: { teamName: team.name, slug: team.slug },
    }).catch(console.error);

    return NextResponse.json({ success: true, team }, { status: 201 });
  } catch (error) {
    console.error("Create team error:", error);
    return NextResponse.json({ error: "Failed to create team" }, { status: 500 });
  }
}
