"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Loader2,
  UserPlus,
  RefreshCw,
  Link as LinkIcon,
  Copy,
  Check,
  PlusCircle,
  Users,
  Briefcase,
  ShieldCheck,
} from "lucide-react";
import { useRouter } from "next/navigation";

const NEXT_STATUS: Record<string, string | null> = {
  DRAFT: "OPEN",
  OPEN: "IN_PROGRESS",
  IN_PROGRESS: "IN_REVIEW",
  IN_REVIEW: "COMPLETED",
  COMPLETED: null,
  CANCELLED: null,
};

const STATUS_LABEL: Record<string, string> = {
  OPEN: "Publish (Open)",
  IN_PROGRESS: "Start Project",
  IN_REVIEW: "Submit for Review",
  COMPLETED: "Mark Complete",
};

export interface ProjectMemberOption {
  id: string;
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  role: string;
  headline?: string | null;
  teamName?: string | null;
}

export interface MilestoneOption {
  id: string;
  title: string;
}

interface Props {
  projectId: string;
  currentStatus: string;
  isBusinessMember: boolean;
  members?: ProjectMemberOption[];
  milestones?: MilestoneOption[];
}

export function ProjectWorkspaceClient({
  projectId,
  currentStatus,
  isBusinessMember,
  members = [],
  milestones = [],
}: Props) {
  const router = useRouter();
  const nextStatus = NEXT_STATUS[currentStatus];

  // Status state
  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  // Invite state
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteTab, setInviteTab] = useState<"INDIVIDUAL" | "TEAM">("INDIVIDUAL");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("FREELANCER");
  const [teamIdentifier, setTeamIdentifier] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccessMsg, setInviteSuccessMsg] = useState<string | null>(null);
  const [inviteLink, setInviteLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Task creation state
  const [taskOpen, setTaskOpen] = useState(false);
  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriority, setTaskPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [taskMilestoneId, setTaskMilestoneId] = useState<string>("");
  const [taskAssigneeId, setTaskAssigneeId] = useState<string>("");
  const [taskDueDate, setTaskDueDate] = useState<string>("");
  const [taskLoading, setTaskLoading] = useState(false);
  const [taskError, setTaskError] = useState<string | null>(null);

  const handleStatusTransition = async () => {
    if (!nextStatus) return;
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await res.json();
      if (!res.ok) {
        setStatusError(data.error || "Failed to update status");
        return;
      }
      router.refresh();
    } catch {
      setStatusError("Network error");
    } finally {
      setStatusLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError(null);
    setInviteLink(null);
    setInviteSuccessMsg(null);

    setInviteLoading(true);
    try {
      let bodyData: Record<string, unknown> = {};

      if (inviteTab === "INDIVIDUAL") {
        if (!inviteEmail.trim() || !inviteEmail.includes("@")) {
          setInviteError("Valid email is required");
          setInviteLoading(false);
          return;
        }
        bodyData = { email: inviteEmail.trim(), role: inviteRole };
      } else {
        if (!teamIdentifier.trim()) {
          setInviteError("Team ID or Slug is required");
          setInviteLoading(false);
          return;
        }
        bodyData = { teamId: teamIdentifier.trim() };
      }

      const res = await fetch(`/api/projects/${projectId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(bodyData),
      });
      const data = await res.json();
      if (!res.ok) {
        setInviteError(data.error || "Failed to add member/team");
        return;
      }

      if (inviteTab === "INDIVIDUAL") {
        const fullLink = `${window.location.origin}${data.invitationUrl}`;
        setInviteLink(fullLink);
        setInviteEmail("");
      } else {
        setInviteSuccessMsg(data.message || "Team successfully assigned to project!");
        setTimeout(() => {
          setInviteOpen(false);
          setInviteSuccessMsg(null);
          setTeamIdentifier("");
          router.refresh();
        }, 1200);
      }
    } catch {
      setInviteError("Network error");
    } finally {
      setInviteLoading(false);
    }
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!taskTitle.trim()) {
      setTaskError("Task title is required");
      return;
    }

    setTaskLoading(true);
    setTaskError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: taskTitle.trim(),
          description: taskDescription.trim() || null,
          priority: taskPriority,
          milestoneId: taskMilestoneId || null,
          assignedToId: taskAssigneeId || null,
          dueDate: taskDueDate || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setTaskError(data.error || "Failed to create task");
        return;
      }

      setTaskOpen(false);
      setTaskTitle("");
      setTaskDescription("");
      setTaskPriority("MEDIUM");
      setTaskMilestoneId("");
      setTaskAssigneeId("");
      setTaskDueDate("");
      router.refresh();
    } catch {
      setTaskError("Network error");
    } finally {
      setTaskLoading(false);
    }
  };

  const copyLink = () => {
    if (!inviteLink) return;
    navigator.clipboard.writeText(inviteLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Status transition */}
      {nextStatus && isBusinessMember && (
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 text-xs font-semibold"
          onClick={handleStatusTransition}
          disabled={statusLoading}
          id="project-status-advance"
        >
          {statusLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5 text-primary" />
          )}
          {STATUS_LABEL[nextStatus] ?? nextStatus}
        </Button>
      )}
      {statusError && (
        <span className="text-xs text-destructive">{statusError}</span>
      )}

      {/* Create Task button */}
      <Button
        variant="outline"
        size="sm"
        className="gap-1.5 text-xs font-semibold"
        onClick={() => setTaskOpen(true)}
        id="project-create-task-button"
      >
        <PlusCircle className="h-3.5 w-3.5 text-primary" />
        New Task
      </Button>

      {/* Invite Member / Team button */}
      {isBusinessMember && (
        <Button
          variant="default"
          size="sm"
          className="gap-1.5 text-xs font-semibold shadow-sm"
          onClick={() => {
            setInviteLink(null);
            setInviteSuccessMsg(null);
            setInviteError(null);
            setInviteOpen(true);
          }}
          id="project-invite-member"
        >
          <UserPlus className="h-3.5 w-3.5" />
          Add / Invite Team
        </Button>
      )}

      {/* New Task Dialog */}
      <Dialog open={taskOpen} onOpenChange={setTaskOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <PlusCircle className="h-4 w-4 text-primary" />
              Create Project Task
            </DialogTitle>
          </DialogHeader>

          <form onSubmit={handleCreateTask} className="space-y-4" id="create-task-form">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                Task Title <span className="text-destructive">*</span>
              </label>
              <Input
                id="task-title"
                placeholder="e.g. Raw Footage Shoot & Log, Color Grade, Key Art"
                value={taskTitle}
                onChange={(e) => setTaskTitle(e.target.value)}
                required
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Description</label>
              <textarea
                id="task-description"
                placeholder="Specific instructions, specs, deliverable expectations..."
                value={taskDescription}
                onChange={(e) => setTaskDescription(e.target.value)}
                rows={2}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            {/* Assign to Specialist */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center justify-between">
                <span>Assign to Specialist</span>
                <span className="text-[10px] text-muted-foreground font-normal">Optional</span>
              </label>
              <select
                id="task-assignee"
                value={taskAssigneeId}
                onChange={(e) => setTaskAssigneeId(e.target.value)}
                className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="">Unassigned (Open task)</option>
                {members.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name || m.email} {m.headline ? `— ${m.headline}` : `(${m.role})`} {m.teamName ? `[${m.teamName}]` : ""}
                  </option>
                ))}
              </select>
            </div>

            {/* Priority & Milestone row */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Priority</label>
                <select
                  id="task-priority"
                  value={taskPriority}
                  onChange={(e: React.ChangeEvent<HTMLSelectElement>) =>
                    setTaskPriority(e.target.value as "LOW" | "MEDIUM" | "HIGH" | "URGENT")
                  }
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">Milestone</label>
                <select
                  id="task-milestone"
                  value={taskMilestoneId}
                  onChange={(e) => setTaskMilestoneId(e.target.value)}
                  className="w-full rounded-lg border border-input bg-background px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">None</option>
                  {milestones.map((ms) => (
                    <option key={ms.id} value={ms.id}>
                      {ms.title}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">Due Date</label>
              <Input
                id="task-due-date"
                type="date"
                value={taskDueDate}
                onChange={(e) => setTaskDueDate(e.target.value)}
                className="text-xs"
              />
            </div>

            {taskError && <p className="text-xs text-destructive">{taskError}</p>}

            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="flex-1 text-xs"
                onClick={() => setTaskOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="default"
                size="sm"
                className="flex-1 text-xs gap-1 font-semibold"
                disabled={taskLoading}
                id="submit-create-task"
              >
                {taskLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                Create Task
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Invite Member / Team Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm font-bold flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Add Participants to Project
            </DialogTitle>
          </DialogHeader>

          {/* Tab selector */}
          <div className="flex rounded-lg border border-border bg-secondary/50 p-1 gap-1">
            <button
              type="button"
              id="invite-tab-individual"
              onClick={() => {
                setInviteTab("INDIVIDUAL");
                setInviteError(null);
                setInviteLink(null);
              }}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                inviteTab === "INDIVIDUAL"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <UserPlus className="h-3.5 w-3.5" />
              Individual Specialist
            </button>
            <button
              type="button"
              id="invite-tab-team"
              onClick={() => {
                setInviteTab("TEAM");
                setInviteError(null);
                setInviteLink(null);
              }}
              className={`flex-1 rounded-md py-1.5 text-xs font-semibold transition-all flex items-center justify-center gap-1.5 ${
                inviteTab === "TEAM"
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Briefcase className="h-3.5 w-3.5" />
              Freelancer Team
            </button>
          </div>

          {inviteSuccessMsg ? (
            <div className="py-6 text-center space-y-2">
              <ShieldCheck className="h-8 w-8 text-green-500 mx-auto" />
              <p className="text-sm font-semibold text-foreground">{inviteSuccessMsg}</p>
            </div>
          ) : inviteLink ? (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Invitation created! Share this link with the specialist:
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-border bg-secondary p-3">
                <LinkIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <p className="text-xs text-foreground truncate flex-1">{inviteLink}</p>
                <Button variant="ghost" size="sm" onClick={copyLink} className="h-7 gap-1 text-xs shrink-0">
                  {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                  {copied ? "Copied!" : "Copy"}
                </Button>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => { setInviteLink(null); }}
                >
                  Invite Another
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => { setInviteOpen(false); setInviteLink(null); router.refresh(); }}
                >
                  Done
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleInvite} className="space-y-4" id="invite-form">
              {inviteTab === "INDIVIDUAL" ? (
                <>
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Specialist Email <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="invite-email"
                      type="email"
                      placeholder="specialist@crewn.com"
                      value={inviteEmail}
                      onChange={(e) => { setInviteEmail(e.target.value); setInviteError(null); }}
                      required
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">Project Role</label>
                    <div className="flex gap-2">
                      {[
                        { key: "FREELANCER", label: "Specialist" },
                        { key: "TEAM_MEMBER", label: "Team Member" },
                        { key: "MANAGER", label: "Lead Manager" },
                      ].map((r) => (
                        <button
                          key={r.key}
                          type="button"
                          id={`invite-role-${r.key.toLowerCase()}`}
                          onClick={() => setInviteRole(r.key)}
                          className={`flex-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-all ${
                            inviteRole === r.key
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border text-muted-foreground hover:bg-secondary/40"
                          }`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-foreground">
                      Team ID or Slug <span className="text-destructive">*</span>
                    </label>
                    <Input
                      id="invite-team-id"
                      placeholder="e.g. cinematic-collective or cuid"
                      value={teamIdentifier}
                      onChange={(e) => { setTeamIdentifier(e.target.value); setInviteError(null); }}
                      required
                      autoFocus
                    />
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Assigning a team adds all of its verified members (directors, editors, designers) to this project workspace simultaneously.
                  </p>
                </div>
              )}

              {inviteError && (
                <p className="text-xs text-destructive">{inviteError}</p>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setInviteOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="default"
                  size="sm"
                  className="flex-1 text-xs gap-1 font-semibold"
                  disabled={inviteLoading}
                  id="submit-invite-button"
                >
                  {inviteLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                  {inviteTab === "INDIVIDUAL" ? "Send Invitation" : "Assign Entire Team"}
                </Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
