"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Loader2, RefreshCw } from "lucide-react";

const NEXT_STATUS: Record<string, string | null> = {
  TODO: "IN_PROGRESS",
  IN_PROGRESS: "SUBMITTED",
  SUBMITTED: "IN_REVIEW",
  IN_REVIEW: "APPROVED",
  REVISION_REQUESTED: "SUBMITTED",
  APPROVED: "COMPLETED",
  COMPLETED: null,
  CANCELLED: null,
};

const STATUS_LABEL: Record<string, string> = {
  IN_PROGRESS: "Start Task",
  SUBMITTED: "Submit for Review",
  IN_REVIEW: "Mark In Review",
  APPROVED: "Approve",
  COMPLETED: "Mark Complete",
};

interface Props {
  projectId: string;
  taskId: string;
  currentStatus: string;
  isManager: boolean;
  isAssignee: boolean;
  assignedToId: string | null;
  currentUserId: string;
  commentOnly?: boolean;
}

export function TaskDetailClient({
  projectId,
  taskId,
  currentStatus,
  isManager,
  isAssignee,
  commentOnly = false,
}: Props) {
  const router = useRouter();
  const nextStatus = NEXT_STATUS[currentStatus];

  const [statusLoading, setStatusLoading] = useState(false);
  const [statusError, setStatusError] = useState<string | null>(null);

  const [comment, setComment] = useState("");
  const [commentLoading, setCommentLoading] = useState(false);
  const [commentError, setCommentError] = useState<string | null>(null);

  const handleStatusTransition = async () => {
    if (!nextStatus) return;
    setStatusLoading(true);
    setStatusError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/status`, {
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

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setCommentLoading(true);
    setCommentError(null);
    try {
      const res = await fetch(`/api/projects/${projectId}/tasks/${taskId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: comment }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCommentError(data.error || "Failed to add comment");
        return;
      }
      setComment("");
      router.refresh();
    } catch {
      setCommentError("Network error");
    } finally {
      setCommentLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Status transition — only if not commentOnly */}
      {!commentOnly && nextStatus && (isManager || isAssignee) && (
        <div className="pt-2">
          <Button
            variant="default"
            size="sm"
            className="gap-1.5 text-xs"
            onClick={handleStatusTransition}
            disabled={statusLoading}
            id="task-status-advance"
          >
            {statusLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {STATUS_LABEL[nextStatus] ?? nextStatus}
          </Button>
          {statusError && <p className="text-xs text-destructive mt-1">{statusError}</p>}
        </div>
      )}

      {/* Add comment */}
      {commentOnly && (
        <form onSubmit={handleAddComment} className="space-y-2 pt-2 border-t border-border" id="add-comment-form">
          <textarea
            id="comment-input"
            className="w-full min-h-[80px] resize-y rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="Add a comment..."
            value={comment}
            onChange={(e) => { setComment(e.target.value); setCommentError(null); }}
            maxLength={5000}
          />
          {commentError && <p className="text-xs text-destructive">{commentError}</p>}
          <div className="flex justify-end">
            <Button
              type="submit"
              variant="default"
              size="sm"
              className="gap-1 text-xs"
              disabled={commentLoading || !comment.trim()}
            >
              {commentLoading && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Post Comment
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
