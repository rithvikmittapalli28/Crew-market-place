import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getOrCreateProjectConversation } from "@/lib/messages/service";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { projectId } = await params;
    const { conversation, project } = await getOrCreateProjectConversation(projectId, user.id);

    return NextResponse.json({
      conversationId: conversation.id,
      conversation,
      projectTitle: project.title,
    });
  } catch (error) {
    console.error("Project channel error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to open project channel" },
      { status: 400 }
    );
  }
}
