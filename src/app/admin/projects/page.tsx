import React from "react";
import { prisma } from "@/lib/prisma";
import { Briefcase } from "lucide-react";

export default async function AdminProjectsPage() {
  const projects = await prisma.project.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      business: { select: { id: true, name: true } },
      createdBy: { select: { id: true, name: true, email: true } },
      members: {
        include: {
          user: { select: { id: true, name: true, role: true } },
        },
      },
      milestones: { select: { id: true, title: true, status: true, amount: true } },
      contracts: { select: { id: true, status: true, totalAmount: true } },
      disputes: { select: { id: true, status: true } },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Briefcase className="w-5 h-5 text-emerald-500" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Project & Campaign Oversight</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Inspect project workspaces, milestone progress, contract execution states, and participant access.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                <th className="py-3.5 px-4">Project Title</th>
                <th className="py-3.5 px-4">Business Owner</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4">Milestones & Contracts</th>
                <th className="py-3.5 px-4">Participants</th>
                <th className="py-3.5 px-4 text-right">Disputes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {projects.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    No projects found in database.
                  </td>
                </tr>
              ) : (
                projects.map((proj) => (
                  <tr key={proj.id} className="hover:bg-muted/20 transition-colors" id={`project-row-${proj.id}`}>
                    <td className="py-3.5 px-4">
                      <p className="font-semibold text-foreground">{proj.title}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">ID: {proj.id.slice(0, 10)}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <p className="text-foreground font-medium">{proj.business.name}</p>
                      <p className="text-[10px] text-muted-foreground">{proj.createdBy.name || proj.createdBy.email}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        proj.status === "COMPLETED"
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : proj.status === "IN_PROGRESS"
                          ? "bg-blue-500/15 text-blue-600 dark:text-blue-400"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        {proj.status}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
                      {proj.milestones.length} Milestones • {proj.contracts.length} Contracts
                    </td>
                    <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
                      {proj.members.length} Members
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {proj.disputes.length > 0 ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                          {proj.disputes.length} Dispute(s)
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Clean</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
