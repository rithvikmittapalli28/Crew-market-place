import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/server";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Building2, Briefcase, CheckCircle, XCircle, Clock, AlertTriangle } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { InvitationActionButtons } from "./invitation-client";

type Props = { params: Promise<{ token: string }> };

export const metadata: Metadata = {
  title: "Project Invitation — Crewn",
  description: "Accept or decline your project collaboration invitation.",
};

export default async function InvitationPage({ params }: Props) {
  const { token } = await params;
  const user = await getCurrentUser();

  // Fetch invitation details
  const invitation = await prisma.projectInvitation.findUnique({
    where: { token },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          status: true,
          description: true,
          business: { select: { id: true, name: true, logoUrl: true } },
          _count: { select: { members: true, milestones: true } },
        },
      },
    },
  });

  // Not found
  if (!invitation) {
    return (
      <InvitationLayout
        icon={<AlertTriangle className="h-8 w-8 text-destructive" />}
        title="Invitation Not Found"
        description="This invitation link is invalid or has already been removed."
        action={
          <Link href="/">
            <Button variant="default" size="sm">Go to Homepage</Button>
          </Link>
        }
      />
    );
  }

  // Already used or expired by status
  if (invitation.status !== "PENDING") {
    const messages: Record<string, string> = {
      ACCEPTED: "This invitation has already been accepted.",
      DECLINED: "This invitation was declined.",
      EXPIRED: "This invitation has expired.",
    };
    return (
      <InvitationLayout
        icon={
          invitation.status === "ACCEPTED" ? (
            <CheckCircle className="h-8 w-8 text-green-500" />
          ) : (
            <XCircle className="h-8 w-8 text-destructive" />
          )
        }
        title={`Invitation ${invitation.status.charAt(0) + invitation.status.slice(1).toLowerCase()}`}
        description={messages[invitation.status] ?? "This invitation is no longer valid."}
        action={
          invitation.status === "ACCEPTED" ? (
            <Link href={`/projects/${invitation.projectId}`}>
              <Button variant="default" size="sm">Go to Project</Button>
            </Link>
          ) : (
            <Link href="/marketplace">
              <Button variant="default" size="sm">Browse Projects</Button>
            </Link>
          )
        }
      />
    );
  }

  // Expired by time
  if (new Date(invitation.expiresAt) <= new Date()) {
    return (
      <InvitationLayout
        icon={<Clock className="h-8 w-8 text-muted-foreground" />}
        title="Invitation Expired"
        description="This invitation link has expired. Please ask the project owner to send a new invitation."
        action={
          <Link href="/">
            <Button variant="default" size="sm">Go to Homepage</Button>
          </Link>
        }
      />
    );
  }

  // Email mismatch warning (not logged in, or wrong user)
  const emailMismatch = user && user.email.toLowerCase() !== invitation.inviteeEmail.toLowerCase();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary border border-border">
              <Briefcase className="h-7 w-7 text-foreground" />
            </div>
          </div>
          <h1 className="text-xl font-bold text-foreground">Project Invitation</h1>
          <p className="text-sm text-muted-foreground">
            You have been invited to collaborate on a project
          </p>
        </div>

        {/* Project card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-secondary border border-border shrink-0">
                {invitation.project.business.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={invitation.project.business.logoUrl}
                    alt={invitation.project.business.name}
                    className="h-8 w-8 rounded-lg object-cover"
                  />
                ) : (
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[11px] text-muted-foreground">from</p>
                <p className="text-sm font-bold text-foreground">{invitation.project.business.name}</p>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <CardTitle className="text-base">{invitation.project.title}</CardTitle>
              {invitation.project.description && (
                <p className="text-xs text-muted-foreground line-clamp-3">
                  {invitation.project.description}
                </p>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              <Badge variant="pastel-blue" size="sm">
                Role: {invitation.role}
              </Badge>
              <Badge variant="secondary" size="sm">
                {invitation.project._count.members} members
              </Badge>
              <Badge variant="secondary" size="sm">
                {invitation.project._count.milestones} milestones
              </Badge>
            </div>

            <div className="rounded-lg border border-border bg-secondary/50 px-3 py-2 text-[11px] text-muted-foreground">
              Sent to: <span className="font-medium text-foreground">{invitation.inviteeEmail}</span>
              {" · "}
              Expires{" "}
              {new Date(invitation.expiresAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
                year: "numeric",
              })}
            </div>

            {/* Email mismatch warning */}
            {emailMismatch && (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2.5 text-xs text-yellow-700 dark:text-yellow-400">
                <span className="font-semibold">Note:</span> You are signed in as{" "}
                <span className="font-mono">{user?.email}</span>, but this invitation was sent to{" "}
                <span className="font-mono">{invitation.inviteeEmail}</span>. You must sign in with the
                invited email to accept.
              </div>
            )}

            {/* Not logged in */}
            {!user && (
              <div className="rounded-lg border border-border bg-secondary/50 px-3 py-2.5 text-xs text-muted-foreground">
                Please{" "}
                <Link
                  href={`/login?redirect=/invitations/${token}`}
                  className="font-semibold text-foreground underline"
                >
                  sign in
                </Link>{" "}
                with <span className="font-mono">{invitation.inviteeEmail}</span> to accept this
                invitation.
              </div>
            )}
          </CardContent>
        </Card>

        {/* Action buttons — client component */}
        {user && !emailMismatch && (
          <InvitationActionButtons
            token={token}
            projectId={invitation.projectId}
            projectTitle={invitation.project.title}
          />
        )}

        {!user && (
          <Link href={`/login?redirect=/invitations/${token}`}>
            <Button variant="default" className="w-full" id="invitation-sign-in">
              Sign In to Accept
            </Button>
          </Link>
        )}
      </div>
    </div>
  );
}

function InvitationLayout({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm text-center space-y-6">
        <div className="flex justify-center">{icon}</div>
        <div className="space-y-2">
          <h1 className="text-lg font-bold text-foreground">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <div className="flex justify-center">{action}</div>
      </div>
    </div>
  );
}
