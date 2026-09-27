import assert from "node:assert/strict";
import crypto from "crypto";
import { prisma } from "../src/lib/prisma";

const BASE_URL = "http://localhost:3000";

function hashToken(raw: string) {
  return crypto.createHash("sha256").update(raw).digest("hex");
}

function extractCookie(res: Response, cookieName: string): string | null {
  const setCookie = res.headers.get("set-cookie");
  if (!setCookie) return null;
  const match = setCookie.match(new RegExp(`${cookieName}=([^;]+)`));
  return match ? match[1] : null;
}

async function registerAndVerify(name: string, email: string, role: "BUSINESS" | "FREELANCER", headline?: string) {
  // If user already exists in DB, clean up first or fetch
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.session.deleteMany({ where: { userId: existing.id } });
    await prisma.projectMember.deleteMany({ where: { userId: existing.id } });
    await prisma.teamMember.deleteMany({ where: { freelancerId: existing.id } });
    await prisma.task.deleteMany({ where: { assignedToId: existing.id } });
    await prisma.freelancerProfile.deleteMany({ where: { userId: existing.id } });
    await prisma.businessMember.deleteMany({ where: { userId: existing.id } });
    await prisma.user.delete({ where: { id: existing.id } });
  }

  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      email,
      password: "Password123!",
      role,
    }),
  });
  assert.equal(regRes.status, 201, `Registration failed for ${email}`);
  const cookie = extractCookie(regRes, "crewn_session");

  // Verify email directly in DB
  const user = await prisma.user.update({
    where: { email },
    data: { isVerified: true, onboarded: true },
  });

  if (role === "FREELANCER" && headline) {
    await prisma.freelancerProfile.create({
      data: {
        userId: user.id,
        headline,
        bio: `Specialist in ${headline}`,
        hourlyRate: 3500,
        yearsExperience: 6,
        isVerified: true,
        marketplaceVisible: true,
      },
    });
  }

  return { user, cookie: `crewn_session=${cookie}` };
}

async function run() {
  console.log("🚀 Running Multi-Freelancer Live End-to-End API Flow...\n");

  const timestamp = Date.now();
  const bizEmail = `director.${timestamp}@acme-studios.com`;
  const videoEmail = `alice.${timestamp}@cinematic.com`;
  const editorEmail = `bob.${timestamp}@cinematic.com`;
  const designerEmail = `charlie.${timestamp}@cinematic.com`;

  // 1. Create Business
  console.log("1. Setting up Business Owner...");
  const biz = await registerAndVerify("Director Marcus", bizEmail, "BUSINESS");
  const business = await prisma.business.create({
    data: {
      name: "Acme Global Studios",
      slug: `acme-studios-${timestamp}`,
      members: { create: { userId: biz.user.id, role: "OWNER" } },
    },
  });

  // 2. Create Specialists
  console.log("2. Setting up Specialists...");
  const videographer = await registerAndVerify("Alice Lens", videoEmail, "FREELANCER", "Senior Commercial Videographer");
  const videoEditor = await registerAndVerify("Bob Cut", editorEmail, "FREELANCER", "Senior Video Editor & Colorist");
  const designer = await registerAndVerify("Charlie Art", designerEmail, "FREELANCER", "Lead Brand & Graphic Designer");

  // 3. Videographer creates team
  console.log("3. Videographer creating Team 'Cinematic Collective'...");
  const teamRes = await fetch(`${BASE_URL}/api/teams`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: videographer.cookie },
    body: JSON.stringify({
      name: "Cinematic Collective",
      tagline: "Commercial Video Production & Brand Design Studio",
      bio: "High-impact storytelling for visionary brands",
    }),
  });
  assert.equal(teamRes.status, 201, "Team creation must succeed");
  const { team } = await teamRes.json();
  console.log(`   ✔ Team created: ${team.name} (id: ${team.id})`);

  // 4. Videographer adds Editor and Designer to team
  console.log("4. Adding Editor & Designer to team...");
  const addEditorRes = await fetch(`${BASE_URL}/api/teams/${team.id}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: videographer.cookie },
    body: JSON.stringify({ freelancerId: videoEditor.user.id, role: "CORE_MEMBER" }),
  });
  assert.equal(addEditorRes.status, 201, "Adding editor to team must succeed");

  const addDesignerRes = await fetch(`${BASE_URL}/api/teams/${team.id}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: videographer.cookie },
    body: JSON.stringify({ freelancerId: designer.user.id, role: "CORE_MEMBER" }),
  });
  assert.equal(addDesignerRes.status, 201, "Adding designer to team must succeed");
  console.log("   ✔ All team members added.");

  // 5. Business creates project
  console.log("5. Business creating Project 'Global Brand Commercial 2026'...");
  const projRes = await fetch(`${BASE_URL}/api/projects`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: biz.cookie },
    body: JSON.stringify({
      title: "Global Brand Commercial 2026",
      description: "Omnichannel brand campaign video, featuring 4K live-action shoot, cinematic grade, and graphic assets.",
      budgetMin: 250000,
      budgetMax: 500000,
      currency: "INR",
      status: "IN_PROGRESS",
    }),
  });
  assert.equal(projRes.status, 201, "Project creation must succeed");
  const { project } = await projRes.json();
  console.log(`   ✔ Project created: ${project.title} (id: ${project.id})`);

  // 6. Business assigns Team to Project
  console.log("6. Assigning entire Team to Project via POST /api/projects/[id]/members...");
  const assignTeamRes = await fetch(`${BASE_URL}/api/projects/${project.id}/members`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: biz.cookie },
    body: JSON.stringify({ teamId: team.id }),
  });
  assert.equal(assignTeamRes.status, 201, "Assigning team to project must succeed");
  const assignTeamData = await assignTeamRes.json();
  console.log(`   ✔ Team assigned: ${assignTeamData.message}`);

  // 7. Business creates 3 distinct tasks assigned to specialists
  console.log("7. Creating and assigning distinct tasks to each specialist...");
  const task1Res = await fetch(`${BASE_URL}/api/projects/${project.id}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: biz.cookie },
    body: JSON.stringify({
      title: "Hero Footage Production & 4K Aerials",
      description: "Execute 2-day on-location shoot with RED V-Raptor and drone crew.",
      priority: "HIGH",
      assignedToId: videographer.user.id,
    }),
  });
  assert.equal(task1Res.status, 201, "Task 1 creation must succeed");
  const { task: task1 } = await task1Res.json();

  const task2Res = await fetch(`${BASE_URL}/api/projects/${project.id}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: biz.cookie },
    body: JSON.stringify({
      title: "Rough Cut Assembly & HDR Color Grading",
      description: "Build 60s & 30s cuts with sound design and custom LUT color transformation.",
      priority: "HIGH",
      assignedToId: videoEditor.user.id,
    }),
  });
  assert.equal(task2Res.status, 201, "Task 2 creation must succeed");

  const task3Res = await fetch(`${BASE_URL}/api/projects/${project.id}/tasks`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: biz.cookie },
    body: JSON.stringify({
      title: "Campaign Key Art & YouTube Thumbnail Package",
      description: "Develop 5 key art variations and high-CTR thumbnail assets.",
      priority: "MEDIUM",
      assignedToId: designer.user.id,
    }),
  });
  assert.equal(task3Res.status, 201, "Task 3 creation must succeed");
  console.log("   ✔ All 3 tasks assigned to their respective specialists.");

  // 8. Videographer transitions Task 1 to IN_PROGRESS
  console.log("8. Videographer updating Task 1 status to IN_PROGRESS...");
  const updateStatusRes = await fetch(`${BASE_URL}/api/projects/${project.id}/tasks/${task1.id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Cookie: videographer.cookie },
    body: JSON.stringify({ status: "IN_PROGRESS" }),
  });
  assert.equal(updateStatusRes.status, 200, "Task status transition must succeed");

  // 9. Verify members API response
  console.log("9. Verifying GET /api/projects/[id]/members...");
  const membersRes = await fetch(`${BASE_URL}/api/projects/${project.id}/members`, {
    headers: { Cookie: biz.cookie },
  });
  assert.equal(membersRes.status, 200);
  const membersData = await membersRes.json();
  assert.equal(membersData.members.length, 4, "Must have exactly 4 project members");
  console.log(`   ✔ 4 Project Members confirmed:`);
  for (const m of membersData.members) {
    console.log(`     • ${m.user.name} (${m.role}) — ${m.user.freelancerProfile?.headline || "Business Lead"} [Team: ${m.team?.name || "None"}]`);
  }

  console.log("\n✨ Live Flow Verification Successfully Completed!");
  console.log(`Project URL for browser inspection: ${BASE_URL}/projects/${project.id}`);
  console.log(`Cookie for Business Director: ${biz.cookie}`);
}

run().catch((err) => {
  console.error("Live test failed:", err);
  process.exit(1);
});
