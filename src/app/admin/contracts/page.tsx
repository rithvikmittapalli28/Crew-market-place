import React from "react";
import { prisma } from "@/lib/prisma";
import { FileSignature, ShieldCheck } from "lucide-react";

export default async function AdminContractsPage() {
  const contracts = await prisma.contract.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      project: { select: { id: true, title: true } },
      business: { select: { id: true, name: true } },
      parties: {
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      },
    },
  });

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <FileSignature className="w-5 h-5 text-primary" />
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Contract Oversight & Legal Ledger</h1>
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          Inspect formal production contracts, verify cryptographic signatures, and audit tamper-proof executed snapshots.
        </p>
      </div>

      <div className="bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-border bg-muted/30 text-muted-foreground font-semibold">
                <th className="py-3.5 px-4">Contract Title</th>
                <th className="py-3.5 px-4">Project / Business</th>
                <th className="py-3.5 px-4">Amount (INR)</th>
                <th className="py-3.5 px-4">Signatures Status</th>
                <th className="py-3.5 px-4">Snapshot & Hash</th>
                <th className="py-3.5 px-4 text-right">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {contracts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-muted-foreground">
                    No contracts recorded yet.
                  </td>
                </tr>
              ) : (
                contracts.map((c) => {
                  const signedParties = c.parties.filter((p) => p.signedAt);
                  return (
                    <tr key={c.id} className="hover:bg-muted/20 transition-colors" id={`contract-row-${c.id}`}>
                      <td className="py-3.5 px-4">
                        <p className="font-semibold text-foreground">{c.title}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">ID: {c.id.slice(0, 10)}</p>
                      </td>
                      <td className="py-3.5 px-4">
                        <p className="text-foreground font-medium">{c.business.name}</p>
                        <p className="text-[11px] text-muted-foreground">{c.project.title}</p>
                      </td>
                      <td className="py-3.5 px-4 font-mono font-bold text-foreground">
                        ₹{Number(c.totalAmount).toLocaleString("en-IN")}
                      </td>
                      <td className="py-3.5 px-4 text-muted-foreground text-[11px]">
                        <span className="font-medium text-foreground">
                          {signedParties.length} / {c.parties.length} Signed
                        </span>
                        <div className="flex flex-col gap-0.5 mt-0.5 text-[10px]">
                          {c.parties.map((p) => (
                            <span key={p.id} className={p.signedAt ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-muted-foreground"}>
                              • {p.user.name || p.user.email} ({p.role}): {p.signedAt ? "✓ Signed" : "Pending"}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="py-3.5 px-4">
                        {c.signedSnapshotJson ? (
                          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold font-mono">
                            <ShieldCheck className="w-3.5 h-3.5" />
                            SHA-256 Stamped
                          </span>
                        ) : (
                          <span className="text-[11px] text-muted-foreground">Pending Execution</span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                          c.status === "EXECUTED"
                            ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                            : c.status === "SENT"
                            ? "bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20"
                            : "bg-muted text-muted-foreground"
                        }`}>
                          {c.status}
                        </span>
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
