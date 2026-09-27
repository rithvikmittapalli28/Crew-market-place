import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";
import { InquiryStatus } from "@prisma/client";
import { dispatchNotification } from "@/lib/notifications/service";
import { getOrCreateDirectConversation, sendMessage } from "@/lib/messages/service";
import { rateLimit, getClientIp } from "@/lib/auth/rate-limit";

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const roleView = searchParams.get("view"); // 'sent' or 'received'

    if (roleView === "sent" || user.role === "BUSINESS") {
      const inquiries = await prisma.creatorInquiry.findMany({
        where: { senderId: user.id },
        orderBy: { createdAt: "desc" },
        include: {
          freelancer: {
            include: {
              user: {
                select: {
                  name: true,
                  avatarUrl: true,
                },
              },
            },
          },
          service: {
            select: {
              id: true,
              title: true,
              basePrice: true,
              currency: true,
            },
          },
        },
      });

      return NextResponse.json({ inquiries });
    } else {
      // Freelancer inbox: received inquiries
      const profile = await prisma.freelancerProfile.findUnique({
        where: { userId: user.id },
      });

      if (!profile) {
        return NextResponse.json({ inquiries: [] });
      }

      const inquiries = await prisma.creatorInquiry.findMany({
        where: { freelancerId: profile.id },
        orderBy: { createdAt: "desc" },
        include: {
          sender: {
            select: {
              id: true,
              name: true,
              avatarUrl: true,
            },
          },
          service: {
            select: {
              id: true,
              title: true,
              basePrice: true,
              currency: true,
            },
          },
        },
      });

      return NextResponse.json({ inquiries });
    }
  } catch (error) {
    console.error("List inquiries error:", error);
    return NextResponse.json({ error: "Failed to list inquiries" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Rate limiting: 20 inquiries per 10 minutes
    const ip = getClientIp(req);
    const limitResult = await rateLimit(`inquiries:${user.id}:${ip}`, 20, 10 * 60 * 1000);
    if (!limitResult.success) {
      return NextResponse.json(
        { error: "Too many inquiries sent. Please try again later." },
        { status: 429 }
      );
    }

    const body = await req.json();
    const { freelancerId, serviceId, message } = body;

    if (!freelancerId || typeof freelancerId !== "string") {
      return NextResponse.json({ error: "freelancerId is required" }, { status: 400 });
    }

    if (!message || typeof message !== "string" || message.trim().length < 10) {
      return NextResponse.json(
        { error: "Inquiry message must be at least 10 characters long" },
        { status: 400 }
      );
    }

    const freelancer = await prisma.freelancerProfile.findUnique({
      where: { id: freelancerId },
    });

    if (!freelancer) {
      return NextResponse.json({ error: "Creator not found" }, { status: 404 });
    }

    // Prevent inquiring to oneself
    if (freelancer.userId === user.id) {
      return NextResponse.json(
        { error: "You cannot send an inquiry to your own profile" },
        { status: 400 }
      );
    }

    // Verify service belongs to freelancer if provided
    if (serviceId) {
      const service = await prisma.service.findUnique({
        where: { id: serviceId },
      });
      if (!service || service.freelancerProfileId !== freelancer.id) {
        return NextResponse.json(
          { error: "Specified service does not belong to this creator" },
          { status: 400 }
        );
      }
    }

    const inquiry = await prisma.creatorInquiry.create({
      data: {
        senderId: user.id,
        freelancerId,
        serviceId: serviceId || null,
        message: message.trim().slice(0, 2000),
        status: InquiryStatus.PENDING,
      },
      include: {
        freelancer: {
          select: {
            headline: true,
            publicSlug: true,
            user: {
              select: { name: true, avatarUrl: true },
            },
          },
        },
        service: {
          select: { title: true, basePrice: true },
        },
      },
    });

    // Link inquiry with direct conversation thread
    let conversationId: string | null = null;
    try {
      const conv = await getOrCreateDirectConversation(user.id, freelancer.userId);
      if (conv) {
        conversationId = conv.id;
        await sendMessage({
          conversationId: conv.id,
          senderId: user.id,
          content: `[Inquiry: ${serviceId ? "Service Request" : "General Inquiry"}] ${message.trim().slice(0, 2000)}`,
        });
      }
    } catch (msgErr) {
      console.warn("Could not create direct conversation for inquiry:", msgErr);
    }

    // Notify creator
    await dispatchNotification({
      userId: freelancer.userId,
      type: "MESSAGE",
      title: `New client inquiry from ${user.name || user.email}`,
      body: message.trim().slice(0, 100),
      linkUrl: conversationId ? `/messages?conversationId=${conversationId}` : `/freelancer#inquiries`,
    });

    return NextResponse.json({ success: true, inquiry, conversationId }, { status: 201 });
  } catch (error) {
    console.error("Create inquiry error:", error);
    return NextResponse.json({ error: "Failed to send inquiry" }, { status: 500 });
  }
}
