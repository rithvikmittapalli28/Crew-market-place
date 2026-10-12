import React from "react";
import { prisma } from "@/lib/prisma";
import { Palette, CheckCircle2 } from "lucide-react";

export default async function AdminCreatorsPage() {
  const profiles = await prisma.freelancerProfile.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: {
        select: { id: true, name: true, email: true, isActive: true },
      },
      skills: {
        include: { skill: true },
      },
      categories: {
        include: { category: true },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Palette className="w-5 h-5 text-purple-500" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Creator & Talent Oversight</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Audit creator profiles, portfolio classifications, verification badges, and market pricing.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                <th className="py-3.5 px-4">Creator</th>
                <th className="py-3.5 px-4">Headline / Bio</th>
                <th className="py-3.5 px-4">Categories & Skills</th>
                <th className="py-3.5 px-4">Hourly Rate</th>
                <th className="py-3.5 px-4">Verification</th>
                <th className="py-3.5 px-4">Account Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {profiles.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    No creator profiles registered yet.
                  </td>
                </tr>
              ) : (
                profiles.map((p) => (
                  <tr key={p.id} className="hover:bg-muted/20 transition-colors" id={`creator-row-${p.id}`}>
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs">
                          {p.user.name?.charAt(0) || p.user.email.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-foreground truncate">{p.user.name || "Creator"}</p>
                          <p className="text-[11px] text-muted-foreground truncate">{p.user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 max-w-xs">
                      <p className="text-foreground font-medium truncate">{p.headline || "No headline provided"}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{p.bio || "No biography"}</p>
                    </td>
                    <td className="py-3.5 px-4">
                      <div className="flex flex-wrap gap-1 max-w-xs">
                        {p.skills.slice(0, 3).map((s) => (
                          <span key={s.skillId} className="px-1.5 py-0.5 rounded bg-muted text-[10px] text-muted-foreground">
                            {s.skill.name}
                          </span>
                        ))}
                        {p.skills.length > 3 && (
                          <span className="text-[10px] text-muted-foreground">+{p.skills.length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono font-semibold text-foreground">
                      {p.hourlyRate ? `₹${Number(p.hourlyRate).toLocaleString("en-IN")}/hr` : "Custom"}
                    </td>
                    <td className="py-3.5 px-4">
                      {p.isVerified ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Verified Talent
                        </span>
                      ) : (
                        <span className="text-[11px] text-muted-foreground">Unverified</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4">
                      {p.user.isActive ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-destructive font-semibold">
                          Suspended
                        </span>
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
