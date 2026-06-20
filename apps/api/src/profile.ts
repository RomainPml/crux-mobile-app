import type { FastifyInstance } from "fastify";
import { UpdateProfileRequestSchema } from "@crux/shared";
import { prisma } from "./db.js";
import { authenticate } from "./auth.js";

export async function profileRoutes(app: FastifyInstance) {
  app.get("/me/profile", { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.sub;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userBadges: {
          include: { badge: true },
          orderBy: { awardedAt: "desc" },
        },
        leagueStandingHistory: {
          include: { league: true },
          orderBy: { month: "desc" },
        },
      },
    });

    if (!user) {
      return reply.code(404).send({ error: "User not found" });
    }

    return {
      userId: user.id,
      pseudo: user.pseudo,
      badges: user.userBadges.map((ub) => ({
        code: ub.badge.code,
        name: ub.badge.name,
        description: ub.badge.description,
        awardedAt: ub.awardedAt.toISOString(),
        context: ub.context,
      })),
      monthlyHistory: user.leagueStandingHistory.map((h) => ({
        month: h.month,
        leagueId: h.leagueId,
        leagueName: h.league.name,
        finalRank: h.finalRank,
        finalScore: h.finalScore,
        membersCount: h.membersCount,
      })),
    };
  });

  app.patch("/me/profile", { preHandler: [authenticate] }, async (request, reply) => {
    const userId = request.user.sub;
    const body = UpdateProfileRequestSchema.parse(request.body);

    // Check case-insensitive uniqueness
    const existing = await prisma.user.findFirst({
      where: {
        pseudo: { equals: body.pseudo, mode: "insensitive" },
        id: { not: userId },
      },
    });
    if (existing) {
      return reply.code(409).send({ error: "Ce pseudo est deja pris" });
    }

    const user = await prisma.user.update({
      where: { id: userId },
      data: { pseudo: body.pseudo },
    });

    return { userId: user.id, pseudo: user.pseudo! };
  });
}
