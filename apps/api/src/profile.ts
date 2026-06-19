import type { FastifyInstance } from "fastify";
import { prisma } from "./db.js";
import { authenticate } from "./auth.js";

export async function profileRoutes(app: FastifyInstance) {
  app.get("/me/profile", { preHandler: [authenticate] }, async (request) => {
    const userId = request.user.sub;

    const user = await prisma.user.findUniqueOrThrow({
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
}
