import type { ProjectStatus, TaskStatus } from "@/types";

// ---------------------------------------------------------------------------
// Project status transitions
// ---------------------------------------------------------------------------

const PROJECT_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  DRAFT: ["OPEN", "CANCELLED"],
  OPEN: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["IN_REVIEW", "CANCELLED"],
  IN_REVIEW: ["IN_PROGRESS", "COMPLETED", "CANCELLED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function isValidProjectTransition(
  from: ProjectStatus,
  to: ProjectStatus
): boolean {
  return PROJECT_TRANSITIONS[from]?.includes(to) ?? false;
}

// ---------------------------------------------------------------------------
// Task status transitions
// Business OWNER/MANAGER can do any transition.
// Assigned freelancer can: TODO→IN_PROGRESS, IN_PROGRESS→SUBMITTED, REVISION_REQUESTED→SUBMITTED.
// ---------------------------------------------------------------------------

const TASK_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  TODO: ["IN_PROGRESS", "CANCELLED"],
  IN_PROGRESS: ["SUBMITTED", "TODO", "CANCELLED"],
  SUBMITTED: ["IN_REVIEW", "IN_PROGRESS"],
  IN_REVIEW: ["APPROVED", "REVISION_REQUESTED"],
  REVISION_REQUESTED: ["SUBMITTED", "CANCELLED"],
  APPROVED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function isValidTaskTransition(
  from: TaskStatus,
  to: TaskStatus
): boolean {
  return TASK_TRANSITIONS[from]?.includes(to) ?? false;
}

export const ALLOWED_PROJECT_STATUSES = Object.keys(PROJECT_TRANSITIONS) as ProjectStatus[];
export const ALLOWED_TASK_STATUSES = Object.keys(TASK_TRANSITIONS) as TaskStatus[];
