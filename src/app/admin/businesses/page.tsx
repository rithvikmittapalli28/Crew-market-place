import React from "react";
import { prisma } from "@/lib/prisma";
import { Building2, CheckCircle2, FolderKanban, Users } from "lucide-react";

export default async function AdminBusinessesPage() {
  const businesses = await prisma.business.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      members: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
      projects: {
        select: { id: true, title: true, status: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Building2 className="w-5 h-5 text-blue-500" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Business Oversight</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Review registered corporate accounts, verified business entities, legal tax credentials, and active campaign portfolios.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                <th className="py-3.5 px-4">Business / Entity</th>
                <th className="py-3.5 px-4">Owner / Contact</th>
                <th className="py-3.5 px-4">Tax / Legal Info</th>
                <th className="py-3.5 px-4">Projects</th>
                <th className="py-3.5 px-4">Members</th>
                <th className="py-3.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {businesses.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    No business entities registered yet.
                  </td>
                </tr>
              ) : (
                businesses.map((biz) => {
                  const owner = biz.members.find((m) => m.role === "OWNER")?.user;
                  return (
                    <tr key={biz.id} className="hover:bg-muted/20 transition-colors" id={`business-row-${biz.id}`}>
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                            {biz.name.charAt(0)}
                          </div>
                          <div className="min-w-0">
                            <p className="font-semibold text-foreground truncate">{biz.name}</p>
                            <p className="text-[11px] text-muted-foreground truncate">slug: {biz.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground">
                        <p className="text-foreground font-medium">{owner?.name || "No Owner"}</p>
                        <p className="text-[10px] text-muted-foreground">{owner?.email}</p>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground font-mono text-[11px]">
                        {biz.legalName ? <p className="text-foreground font-sans font-medium">{biz.legalName}</p> : null}
                        <p className="text-[10px]">Tax ID: {biz.taxId || "Not Provided"}</p>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
                        <span className="inline-flex items-center gap-1 font-semibold text-foreground">
                          <FolderKanban className="w-3 h-3 text-muted-foreground" />
                          {biz.projects.length} Campaigns
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
                        <span className="inline-flex items-center gap-1">
                          <Users className="w-3 h-3 text-muted-foreground" />
                          {biz.members.length} Members
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        {biz.isVerified ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                            Standard
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
