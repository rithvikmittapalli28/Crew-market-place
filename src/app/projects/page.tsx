import { AppHeader } from "@/components/layout/app-header";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Briefcase, Plus, CheckSquare } from "lucide-react";
import Link from "next/link";

export default function ProjectsPage() {
  return (
    <div className="min-h-screen bg-background">
      <AppHeader
        title="Project & Task Management"
        subtitle="Track multi-creator campaigns, task dependency chains, versioned deliverables, and escrow milestones"
      />

      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Campaigns & Task Tracking</h2>
            <p className="text-xs text-muted-foreground">
              Production projects organized by milestone lifecycle, member roles, and task prerequisites
            </p>
          </div>
          <Link href="/business">
            <Button variant="default" size="sm" className="gap-1.5">
              <Plus className="h-3.5 w-3.5" />
              <span>Create Project Brief</span>
            </Button>
          </Link>
        </div>

        <Tabs defaultValue="active" className="w-full">
          <TabsList className="grid w-full max-w-lg grid-cols-4">
            <TabsTrigger value="active">Active (0)</TabsTrigger>
            <TabsTrigger value="tasks">Tasks (0)</TabsTrigger>
            <TabsTrigger value="in-review">In Review (0)</TabsTrigger>
            <TabsTrigger value="completed">Completed (0)</TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="pt-4">
            <EmptyState
              icon={<Briefcase className="h-7 w-7 text-muted-foreground" />}
              title="No active projects"
              description="Active campaign workspaces with running milestones, assigned freelancer teams, and escrow deposits will appear here."
              action={
                <Link href="/business">
                  <Button variant="default" size="sm">
                    Create Campaign Brief
                  </Button>
                </Link>
              }
            />
          </TabsContent>

          <TabsContent value="tasks" className="pt-4">
            <EmptyState
              icon={<CheckSquare className="h-7 w-7 text-muted-foreground" />}
              title="No tasks assigned yet"
              description="Tasks with priority tags, assignee seats (Owner, Manager, Freelancer, Team Member), and dependency rules will be tracked here."
            />
          </TabsContent>

          <TabsContent value="in-review" className="pt-4">
            <EmptyState
              icon={<Briefcase className="h-7 w-7 text-muted-foreground" />}
              title="No deliverables in review"
              description="Submitted asset versions (v1, v2, v3, final) awaiting client review or revision will appear here."
            />
          </TabsContent>

          <TabsContent value="completed" className="pt-4">
            <EmptyState
              icon={<Briefcase className="h-7 w-7 text-muted-foreground" />}
              title="No completed campaigns"
              description="Archived projects, mutual reviews, and settled escrow histories will be cataloged here."
            />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
