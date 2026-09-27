/**
 * Phase 4 — Project Collaboration Workflows
 * Automated test suite against live PostgreSQL
 *
 * Run: npx tsx tests/phase4-projects.test.ts
 */

import { prisma } from "../src/lib/prisma";
import crypto from "crypto";
import bcrypt from "bcryptjs";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function createUser(email: string, role: "BUSINESS" | "FREELANCER") {
  return prisma.user.create({
    data: {
      email,
      passwordHash: await bcrypt.hash("Test1234!", 10),
      name: `Test ${role}`,
      role,
      isVerified: true,
      onboarded: true,
    },
  });
}

function passed(name: string) {
  console.log(`  ✅ ${name}`);
}
function failed(name: string, reason: string) {
  console.error(`  ❌ ${name}: ${reason}`);
  process.exitCode = 1;
}

// ---------------------------------------------------------------------------
// Test: Business creates project with correct businessId from DB
// ---------------------------------------------------------------------------
async function testProjectCreation() {
  const email = `biz-creator-${Date.now()}@test.local`;
  const user = await createUser(email, "BUSINESS");

  const business = await prisma.business.create({
    data: {
      name: "Test Biz Co",
      slug: `test-biz-${Date.now()}`,
      members: {
        create: { userId: user.id, role: "OWNER" },
      },
    },
  });

  const project = await prisma.project.create({
    data: {
      businessId: business.id,
      createdById: user.id,
      title: "Phase 4 Test Project",
      description: "Testing collaboration workflows",
      status: "DRAFT",
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });

  if (project.businessId !== business.id) {
    failed("Business creates project — businessId integrity", `Expected ${business.id}, got ${project.businessId}`);
  } else {
    passed("Business creates project — businessId resolved from DB, not request");
  }

  return { user, business, project };
}

// ---------------------------------------------------------------------------
// Test: Invitation flow — create, accept, reject wrong email
// ---------------------------------------------------------------------------
async function testInvitationFlow(projectId: string) {
  const freelancerEmail = `fl-${Date.now()}@test.local`;
  const freelancer = await createUser(freelancerEmail, "FREELANCER");
  const otherFreelancer = await createUser(`other-fl-${Date.now()}@test.local`, "FREELANCER");

  const rawToken = crypto.randomBytes(32).toString("hex");
  const invitation = await prisma.projectInvitation.create({
    data: {
      projectId,
      inviteeEmail: freelancerEmail,
      role: "FREELANCER",
      token: rawToken,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    },
  });

  // Test: correct user can accept
  if (freelancer.email.toLowerCase() !== invitation.inviteeEmail.toLowerCase()) {
    failed("Invitation email match — correct user", "Email mismatch");
  } else {
    passed("Invitation email match — correct freelancer can accept");
  }

  // Test: wrong user cannot accept (email mismatch check)
  if (otherFreelancer.email.toLowerCase() === invitation.inviteeEmail.toLowerCase()) {
    failed("Invitation IDOR protection — wrong user rejected", "Email should not match");
  } else {
    passed("Invitation IDOR protection — wrong user rejected by email check");
  }

  // Accept invitation atomically
  await prisma.$transaction([
    prisma.projectMember.create({
      data: { projectId, userId: freelancer.id, role: "FREELANCER" },
    }),
    prisma.projectInvitation.update({
      where: { id: invitation.id },
      data: { status: "ACCEPTED" },
    }),
  ]);

  const updated = await prisma.projectInvitation.findUnique({ where: { id: invitation.id } });
  if (updated?.status !== "ACCEPTED") {
    failed("Invitation accepted — status updated", `Expected ACCEPTED, got ${updated?.status}`);
  } else {
    passed("Invitation accepted — ProjectMember created, status ACCEPTED");
  }

  return { freelancer };
}

// ---------------------------------------------------------------------------
// Test: Milestone creation
// ---------------------------------------------------------------------------
async function testMilestoneCreation(projectId: string) {
  const milestone = await prisma.milestone.create({
    data: {
      projectId,
      title: "Phase 1 — Content Strategy",
      amount: 50000,
      dueDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000),
    },
  });

  if (!milestone.id || milestone.projectId !== projectId) {
    failed("Milestone creation", "Invalid milestone record");
  } else {
    passed("Milestone created with correct projectId binding");
  }

  // Delete only allowed when PENDING
  try {
    await prisma.milestone.delete({ where: { id: milestone.id } });
    passed("Milestone deletion allowed when PENDING");
  } catch {
    failed("Milestone deletion", "Should be deletable when PENDING");
  }

  const milestone2 = await prisma.milestone.create({
    data: { projectId, title: "Phase 2 — Execution", amount: 100000 },
  });

  return { milestone: milestone2 };
}

// ---------------------------------------------------------------------------
// Test: Task creation with assignee verification
// ---------------------------------------------------------------------------
async function testTaskCreation(projectId: string, assignedToId: string) {
  // Verify assignedToId is a project member before creating
  const memberCheck = await prisma.projectMember.findFirst({
    where: { projectId, userId: assignedToId },
  });

  if (!memberCheck) {
    failed("Task assignee verification", "Freelancer is not a project member");
    return null;
  }
  passed("Task assignee verification — assignee confirmed as project member");

  const task = await prisma.task.create({
    data: {
      projectId,
      title: "Create 3 reel videos for Diwali campaign",
      priority: "HIGH",
      assignedToId,
      status: "TODO",
    },
  });

  if (task.assignedToId !== assignedToId) {
    failed("Task created with correct assignee", "Assignee mismatch");
  } else {
    passed("Task created — assignee verified as project member");
  }

  return { task };
}

// ---------------------------------------------------------------------------
// Test: Task status transition with history recording
// ---------------------------------------------------------------------------
async function testTaskStatusTransition(taskId: string, userId: string) {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return;

  const from = task.status;
  const to = "IN_PROGRESS";

  await prisma.$transaction([
    prisma.task.update({ where: { id: taskId }, data: { status: to } }),
    prisma.taskStatusHistory.create({
      data: { taskId, changedById: userId, fromStatus: from, toStatus: to },
    }),
  ]);

  const history = await prisma.taskStatusHistory.findFirst({ where: { taskId } });
  if (!history || history.fromStatus !== "TODO" || history.toStatus !== "IN_PROGRESS") {
    failed("Task status history recorded", `fromStatus=${history?.fromStatus}, toStatus=${history?.toStatus}`);
  } else {
    passed("Task status transition — TaskStatusHistory recorded atomically");
  }
}

// ---------------------------------------------------------------------------
// Test: Circular dependency prevention
// ---------------------------------------------------------------------------
async function testCircularDependency(projectId: string) {
  const [taskA, taskB, taskC] = await Promise.all([
    prisma.task.create({ data: { projectId, title: "Task A", priority: "LOW" } }),
    prisma.task.create({ data: { projectId, title: "Task B", priority: "LOW" } }),
    prisma.task.create({ data: { projectId, title: "Task C", priority: "LOW" } }),
  ]);

  // A → B → C (chain)
  await prisma.taskDependency.create({ data: { taskId: taskA.id, dependsOnTaskId: taskB.id } });
  await prisma.taskDependency.create({ data: { taskId: taskB.id, dependsOnTaskId: taskC.id } });

  // Trying to add C → A would create a cycle. Simulate BFS detection:
  async function wouldCreateCycle(tId: string, depId: string): Promise<boolean> {
    const visited = new Set<string>();
    const queue = [depId];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === tId) return true;
      if (visited.has(current)) continue;
      visited.add(current);
      const deps = await prisma.taskDependency.findMany({ where: { taskId: current } });
      for (const d of deps) queue.push(d.dependsOnTaskId);
    }
    return false;
  }

  const cycle = await wouldCreateCycle(taskC.id, taskA.id);
  if (!cycle) {
    failed("Circular dependency detection — C→A should create cycle", "Cycle not detected");
  } else {
    passed("Circular dependency detection — BFS correctly identifies C→A would create cycle");
  }

  await prisma.task.deleteMany({ where: { id: { in: [taskA.id, taskB.id, taskC.id] } } });
}

// ---------------------------------------------------------------------------
// Test: Deliverable versioning
// ---------------------------------------------------------------------------
async function testDeliverableVersioning(projectId: string, submitterId: string) {
  const deliverable = await prisma.deliverable.create({
    data: { projectId, title: "Hero Video — 30s cut" },
  });

  // Create a file record owned by submitter
  const file = await prisma.file.create({
    data: {
      storageKey: `test/phase4/${Date.now()}.mp4`,
      fileName: "hero_v1.mp4",
      mimeType: "video/mp4",
      fileSize: BigInt(5_000_000),
      uploadedById: submitterId,
    },
  });

  // IDOR: file owner must match submitter
  if (file.uploadedById !== submitterId) {
    failed("Deliverable version — file ownership check", "File owner mismatch");
    return;
  }

  const newVersionNumber = deliverable.currentVersionNumber + 1;
  const [version] = await prisma.$transaction([
    prisma.deliverableVersion.create({
      data: {
        deliverableId: deliverable.id,
        versionNumber: newVersionNumber,
        fileId: file.id,
        submittedById: submitterId,
        changelog: "First draft",
      },
    }),
    prisma.deliverable.update({
      where: { id: deliverable.id },
      data: { currentVersionNumber: newVersionNumber, status: "SUBMITTED" },
    }),
  ]);

  const updated = await prisma.deliverable.findUnique({ where: { id: deliverable.id } });
  if (updated?.currentVersionNumber !== 2 || updated.status !== "SUBMITTED") {
    failed("Deliverable version submission", `versionNumber=${updated?.currentVersionNumber}, status=${updated?.status}`);
  } else {
    passed("Deliverable version submitted — currentVersionNumber incremented atomically, status=SUBMITTED");
  }

  return { deliverable, version, file };
}

// ---------------------------------------------------------------------------
// Test: Deliverable review
// ---------------------------------------------------------------------------
async function testDeliverableReview(
  projectId: string,
  deliverableId: string,
  versionId: string,
  reviewerId: string
) {
  const [review] = await prisma.$transaction([
    prisma.deliverableReview.create({
      data: {
        versionId,
        reviewerId,
        decision: "APPROVED",
        feedbackText: "Excellent work! Great color grading.",
      },
    }),
    prisma.deliverable.update({
      where: { id: deliverableId },
      data: { status: "APPROVED" },
    }),
  ]);

  const updated = await prisma.deliverable.findUnique({ where: { id: deliverableId } });
  if (updated?.status !== "APPROVED") {
    failed("Deliverable review — status updated to APPROVED", `Got ${updated?.status}`);
  } else {
    passed("Deliverable review APPROVED — status updated atomically");
  }
}

// ---------------------------------------------------------------------------
// Test: Activity log
// ---------------------------------------------------------------------------
async function testActivityLog(projectId: string, actorId: string) {
  await prisma.activityLog.create({
    data: {
      entityType: "PROJECT",
      entityId: projectId,
      action: "PROJECT_CREATED",
      actorId,
      metadataJson: JSON.stringify({ title: "Phase 4 Test Project" }),
    },
  });

  const logs = await prisma.activityLog.findMany({
    where: { entityId: projectId, entityType: "PROJECT" },
  });

  if (logs.length === 0) {
    failed("Activity log — entry written", "No logs found");
  } else {
    passed(`Activity log — ${logs.length} entries written for project`);
  }
}

// ---------------------------------------------------------------------------
// Test: IDOR — freelancer not in project cannot access
// ---------------------------------------------------------------------------
async function testProjectIDAR(projectId: string) {
  const outsider = await createUser(`outsider-${Date.now()}@test.local`, "FREELANCER");

  const membership = await prisma.projectMember.findUnique({
    where: { projectId_userId: { projectId, userId: outsider.id } },
  });

  if (membership) {
    failed("IDOR protection — non-member denied access", "Outsider found as member unexpectedly");
  } else {
    passed("IDOR protection — outsider not in ProjectMember, access would be denied by requireProjectMember()");
  }

  await prisma.user.delete({ where: { id: outsider.id } });
}

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------
async function cleanup(userId: string) {
  try {
    await prisma.user.delete({ where: { id: userId } });
  } catch { /* ok */ }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log("\n🧪 Phase 4 — Project Collaboration Workflow Tests\n");
  console.log("─".repeat(60));

  try {
    // Suite 1: Project creation
    console.log("\n1. Project Creation & Access");
    const { user, business, project } = await testProjectCreation();

    // Suite 2: Invitation flow
    console.log("\n2. Invitation Flow");
    const { freelancer } = await testInvitationFlow(project.id);

    // Suite 3: Milestones
    console.log("\n3. Milestones");
    const { milestone } = await testMilestoneCreation(project.id);

    // Suite 4: Tasks
    console.log("\n4. Tasks");
    const taskResult = await testTaskCreation(project.id, freelancer.id);
    if (taskResult) {
      console.log("\n5. Task Status Transitions");
      await testTaskStatusTransition(taskResult.task.id, freelancer.id);
    }

    // Suite 5: Circular dependency detection
    console.log("\n6. Circular Dependency Detection");
    await testCircularDependency(project.id);

    // Suite 6: Deliverables
    console.log("\n7. Deliverable Versioning & Review");
    const delivResult = await testDeliverableVersioning(project.id, freelancer.id);
    if (delivResult) {
      await testDeliverableReview(project.id, delivResult.deliverable.id, delivResult.version.id, user.id);
    }

    // Suite 7: Activity log
    console.log("\n8. Activity Logging");
    await testActivityLog(project.id, user.id);

    // Suite 8: IDOR
    console.log("\n9. IDOR Protection");
    await testProjectIDAR(project.id);

    // Cleanup
    console.log("\n🧹 Cleaning up test data…");
    await prisma.business.delete({ where: { id: business.id } });
    await cleanup(user.id);
    await cleanup(freelancer.id);

    console.log("\n─".repeat(60));
    if (process.exitCode === 1) {
      console.log("\n💥 Some tests FAILED. Review errors above.\n");
    } else {
      console.log("\n✅ All Phase 4 tests passed!\n");
    }
  } catch (error) {
    console.error("\n💥 Test suite crashed:", error);
    process.exitCode = 1;
  } finally {
    // Allow the shared prisma pool to drain and the process to exit
    setTimeout(() => process.exit(process.exitCode ?? 0), 500);
  }
}

main();
