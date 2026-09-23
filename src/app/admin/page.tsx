import { AppHeader } from "@/components/layout/app-header";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { ShieldCheck } from "lucide-react";

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Crewn Administration"
        subtitle="Platform governance, creator vetting queues, dispute arbitration, and infrastructure metrics"
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
        {/* Admin Metric Cards */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Pending Creator Vetting</CardDescription>
              <CardTitle className="text-2xl font-mono">0</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="outline" size="sm">
                Queue Clear
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Active Escrow Contracts</CardDescription>
              <CardTitle className="text-2xl font-mono">0</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="pastel-green" size="sm">
                100% Settled
              </Badge>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="text-xs">Disputed Milestones</CardDescription>
              <CardTitle className="text-2xl font-mono">0</CardTitle>
            </CardHeader>
            <CardContent>
              <Badge variant="secondary" size="sm">
                No active disputes
              </Badge>
            </CardContent>
          </Card>
        </div>

        <EmptyState
          icon={<ShieldCheck className="h-7 w-7 text-muted-foreground" />}
          title="Admin Governance Center"
          description="Administrative tools for auditing creator verification applications, reviewing escrow release disputes, and managing platform compliance will activate with staff role credentials."
        />
      </main>
    </div>
  );
}
