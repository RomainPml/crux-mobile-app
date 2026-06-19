import type { FastifyInstance } from "fastify";
import { prisma } from "./db.js";
import { authenticate } from "./auth.js";
import { authenticateAdmin } from "./admin.js";

export type EventType =
  | "result_submitted"
  | "share_emitted"
  | "invite_clicked"
  | "invite_converted";

export async function trackEvent(
  type: EventType,
  userId: string | null,
  payload?: Record<string, unknown>,
) {
  await prisma.event.create({
    data: { type, userId, payload: payload as any ?? undefined },
  });
}

export async function eventRoutes(app: FastifyInstance) {
  app.post("/events", { preHandler: [authenticate] }, async (request) => {
    const body = request.body as { type?: string; payload?: Record<string, unknown> };
    const allowedTypes: EventType[] = [
      "share_emitted",
      "invite_clicked",
      "invite_converted",
    ];

    if (!body.type || !allowedTypes.includes(body.type as EventType)) {
      return { error: "Invalid event type" };
    }

    await trackEvent(body.type as EventType, request.user.sub, body.payload);
    return { ok: true };
  });

  app.get("/admin/metrics", { preHandler: [authenticateAdmin] }, async () => {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const [shares, clicks, conversions, submissions] = await Promise.all([
      prisma.event.count({ where: { type: "share_emitted", createdAt: { gte: dayAgo } } }),
      prisma.event.count({ where: { type: "invite_clicked", createdAt: { gte: dayAgo } } }),
      prisma.event.count({ where: { type: "invite_converted", createdAt: { gte: dayAgo } } }),
      prisma.event.count({ where: { type: "result_submitted", createdAt: { gte: dayAgo } } }),
    ]);

    const totalUsers = await prisma.user.count();
    const activeToday = await prisma.dailyResult.groupBy({
      by: ["userId"],
      where: { submittedAt: { gte: dayAgo } },
    });

    return {
      period: "last_24h",
      shares,
      inviteClicks: clicks,
      inviteConversions: conversions,
      conversionRate: clicks > 0 ? Math.round((conversions / clicks) * 100) : 0,
      resultSubmissions: submissions,
      totalUsers,
      activeUsersToday: activeToday.length,
      retentionD1: totalUsers > 0 ? Math.round((activeToday.length / totalUsers) * 100) : 0,
    };
  });
}
