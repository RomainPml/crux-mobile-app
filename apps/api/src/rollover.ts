import type { FastifyInstance } from "fastify";
import { prisma } from "./db.js";
import { computeStandings } from "./standings.js";
import { authenticateAdmin } from "./admin.js";

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

    // Award league-based badges
    await awardLeagueBadges(league.id, standings, membersCount, month);

    // Award pionnier badge if applicable
    if (league.ownerId && membersCount >= 10) {
      await awardBadge(league.ownerId, "pionnier", { leagueId: league.id });
    }
  }

  // Award player-based badges (streaks, sans_faute)
  await awardPlayerBadges(month);
}

async function awardLeagueBadges(
  leagueId: string,
  standings: { rank: number; userId: string; totalScore: number }[],
  membersCount: number,
  month: string,
) {
  const context = { leagueId, month };

  for (const entry of standings) {
    if (entry.rank <= 3) {
      await awardBadge(entry.userId, "podium_mensuel", context);
    }
    if (entry.rank === 1 && membersCount >= 10) {
      await awardBadge(entry.userId, "champion_mensuel", context);
    }
  }
}

async function awardPlayerBadges(month: string) {
  // Parse month to get date range
  const [year, mon] = month.split("-").map(Number);
  const monthStart = new Date(year, mon - 1, 1);
  const monthEnd = new Date(year, mon, 0); // last day of month

  // Get all users who played during this month
  const usersWithResults = await prisma.dailyResult.findMany({
    where: {
      submittedAt: { gte: monthStart, lte: new Date(monthEnd.getTime() + 86_400_000) },
      suspect: false,
    },
    select: { userId: true, puzzleId: true, cleanDeductions: true, submittedAt: true },
    orderBy: { submittedAt: "asc" },
  });

  // Group by user
  const userResults = new Map<string, { dates: Set<string>; hasPerfect: boolean }>();
  for (const r of usersWithResults) {
    const day = r.submittedAt.toISOString().slice(0, 10);
    let entry = userResults.get(r.userId);
    if (!entry) {
      entry = { dates: new Set(), hasPerfect: false };
      userResults.set(r.userId, entry);
    }
    entry.dates.add(day);
    if (r.cleanDeductions > 0) {
      entry.hasPerfect = true;
    }
  }

  for (const [userId, data] of userResults) {
    // sans_faute: at least one puzzle with clean deductions > 0
    if (data.hasPerfect) {
      await awardBadge(userId, "sans_faute", { month });
    }

    // Streak badges: find longest consecutive run in this month
    const sortedDays = [...data.dates].sort();
    let maxStreak = 1;
    let currentStreak = 1;
    for (let i = 1; i < sortedDays.length; i++) {
      const prev = new Date(sortedDays[i - 1]);
      const curr = new Date(sortedDays[i]);
      const diff = (curr.getTime() - prev.getTime()) / 86_400_000;
      if (diff === 1) {
        currentStreak++;
        maxStreak = Math.max(maxStreak, currentStreak);
      } else {
        currentStreak = 1;
      }
    }

    if (maxStreak >= 7) {
      await awardBadge(userId, "serie_7", { month });
    }
    if (maxStreak >= 30) {
      await awardBadge(userId, "serie_30", { month });
    }
  }
}

// Cached badge map
let badgeMapCache: Record<string, string> | null = null;

async function getBadgeMap(): Promise<Record<string, string>> {
  if (badgeMapCache) return badgeMapCache;
  const badges = await prisma.badge.findMany();
  badgeMapCache = {};
  for (const b of badges) {
    badgeMapCache[b.code] = b.id;
  }
  return badgeMapCache;
}

async function awardBadge(
  userId: string,
  badgeCode: string,
  context: Record<string, unknown>,
) {
  const map = await getBadgeMap();
  const badgeId = map[badgeCode];
  if (!badgeId) return;

  await prisma.userBadge
    .create({ data: { userId, badgeId, context } })
    .catch((e: any) => {
      if (e.code !== "P2002") throw e;
    });
}

export async function rolloverRoutes(app: FastifyInstance) {
  app.post("/admin/month-rollover", { preHandler: [authenticateAdmin] }, async (request, reply) => {
    const body = request.body as { month?: string };
    if (!body.month || !/^\d{4}-\d{2}$/.test(body.month)) {
      return reply.code(400).send({ error: "month is required (YYYY-MM)" });
    }

    badgeMapCache = null; // clear cache between runs
    await rolloverMonth(body.month);

    return { ok: true, month: body.month };
  });
}
