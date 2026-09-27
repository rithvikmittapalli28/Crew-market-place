import { prisma } from "@/lib/prisma";

export async function validateTaskDependencies(taskId: string): Promise<{
  canTransition: boolean;
  blockingTasks: string[];
}> {
  const dependencies = await prisma.taskDependency.findMany({
    where: { taskId },
    include: {
      dependsOnTask: { select: { id: true, title: true, status: true } },
    },
  });

  const unresolved = dependencies.filter(
    (dep) =>
      dep.dependsOnTask.status !== "COMPLETED" &&
      dep.dependsOnTask.status !== "APPROVED"
  );

  return {
    canTransition: unresolved.length === 0,
    blockingTasks: unresolved.map((u) => u.dependsOnTask.title),
  };
}
