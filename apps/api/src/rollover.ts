import type { FastifyInstance } from "fastify";
import { prisma } from "./db.js";
import { computeStandings } from "./standings.js";

export async function rolloverMonth(month: string) {
  const leagues = await prisma.league.findMany({
    include: { _count: { select: { memberships: true } } },
  });

  for (const league of leagues) {
    // Check if already rolled over (idempotency key: league + month)
    const existing = await prisma.leagueStandingHistory.findFirst({
      where: { leagueId: league.id, month },
    });
    if (existing) continue;

    const standings = await computeStandings(league.id, month);
    if (standings.length === 0) continue;

    const membersCount = league._count.memberships;

    // Freeze standings
    await prisma.leagueStandingHistory.createMany({
      data: standings.map((s) => ({
        leagueId: league.id,
        userId: s.userId,
        month,
        finalRank: s.rank,
        finalScore: s.totalScore,
        membersCount,
      })),
    });

    // Award badges
    await awardBadges(league.id, standings, membersCount, month);
  }
}

async function awardBadges(
  leagueId: string,
  standings: { rank: number; userId: string; totalScore: number }[],
  membersCount: number,
  month: string,
) {
  const badgeMap = await getBadgeMap();
  const context = { leagueId, month };

  for (const entry of standings) {
    const badgesToAward: string[] = [];

    // podium_mensuel: top 3
    if (entry.rank <= 3 && badgeMap.podium_mensuel) {
      badgesToAward.push(badgeMap.podium_mensuel);
    }

    // champion_mensuel: rank 1 in league with >= 10 members
    if (entry.rank === 1 && membersCount >= 10 && badgeMap.champion_mensuel) {
      badgesToAward.push(badgeMap.champion_mensuel);
    }

    for (const badgeId of badgesToAward) {
      // Unique (userId, badgeId, context) prevents duplicates
      await prisma.userBadge
        .create({
          data: {
            userId: entry.userId,
            badgeId,
            context,
          },
        })
        .catch((e: any) => {
          // Ignore unique constraint violation (idempotency)
          if (e.code !== "P2002") throw e;
        });
    }
  }
}

async function getBadgeMap(): Promise<Record<string, string>> {
  const badges = await prisma.badge.findMany();
  const map: Record<string, string> = {};
  for (const b of badges) {
    map[b.code] = b.id;
  }
  return map;
}

export async function rolloverRoutes(app: FastifyInstance) {
  app.post("/admin/month-rollover", async (request, reply) => {
    // In production, protect with admin auth
    const body = request.body as { month?: string };
    if (!body.month || !/^\d{4}-\d{2}$/.test(body.month)) {
      return reply.code(400).send({ error: "month is required (YYYY-MM)" });
    }

    await rolloverMonth(body.month);

    return { ok: true, month: body.month };
  });
}
