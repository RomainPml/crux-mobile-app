import type { FastifyInstance } from "fastify";
import { currentMonth } from "@crux/shared";
import type { StandingEntry } from "@crux/shared";
import { prisma } from "./db.js";
import { authenticate } from "./auth.js";

interface RankedRow {
  userId: string;
  pseudo: string | null;
  totalScore: number;
  puzzlesPlayed: number;
  cumulativeTimeMs: number;
  joinedAt: Date;
}

/** Deterministic tiebreak: score DESC, puzzles DESC, time ASC, joinedAt ASC */
function compareEntries(a: RankedRow, b: RankedRow): number {
  if (b.totalScore !== a.totalScore) return b.totalScore - a.totalScore;
  if (b.puzzlesPlayed !== a.puzzlesPlayed) return b.puzzlesPlayed - a.puzzlesPlayed;
  if (a.cumulativeTimeMs !== b.cumulativeTimeMs) return a.cumulativeTimeMs - b.cumulativeTimeMs;
  return a.joinedAt.getTime() - b.joinedAt.getTime();
}

export async function computeStandings(
  leagueId: string,
  month: string,
): Promise<StandingEntry[]> {
  const members = await prisma.membership.findMany({
    where: { leagueId },
    include: {
      user: {
        include: {
          monthlyScores: { where: { month } },
        },
      },
    },
  });

  const rows: RankedRow[] = members.map((m) => {
    const ms = m.user.monthlyScores[0];
    return {
      userId: m.userId,
      pseudo: m.user.pseudo,
      totalScore: ms?.totalScore ?? 0,
      puzzlesPlayed: ms?.puzzlesPlayed ?? 0,
      cumulativeTimeMs: ms?.cumulativeTimeMs ?? 0,
      joinedAt: m.joinedAt,
    };
  });

  rows.sort(compareEntries);

  return rows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    pseudo: r.pseudo,
    totalScore: r.totalScore,
    puzzlesPlayed: r.puzzlesPlayed,
    cumulativeTimeMs: r.cumulativeTimeMs,
  }));
}

export async function computeAllTimeStandings(
  leagueId: string,
): Promise<StandingEntry[]> {
  const month = currentMonth();

  // Get current month standings for this league
  const currentStandings = await computeStandings(leagueId, month);
  const currentMap = new Map(currentStandings.map((s) => [s.userId, s]));

  // Get all historical standings for this league
  const history = await prisma.leagueStandingHistory.findMany({
    where: { leagueId },
  });

  // Aggregate per user: sum of historical finalScore + current month
  const members = await prisma.membership.findMany({
    where: { leagueId },
    include: { user: { select: { pseudo: true } } },
  });

  const rows: RankedRow[] = members.map((m) => {
    const userHistory = history.filter((h) => h.userId === m.userId);
    const current = currentMap.get(m.userId);

    const historicalScore = userHistory.reduce((sum, h) => sum + h.finalScore, 0);

    return {
      userId: m.userId,
      pseudo: m.user.pseudo,
      totalScore: historicalScore + (current?.totalScore ?? 0),
      puzzlesPlayed: current?.puzzlesPlayed ?? 0,
      cumulativeTimeMs: current?.cumulativeTimeMs ?? 0,
      joinedAt: m.joinedAt,
    };
  });

  rows.sort(compareEntries);

  return rows.map((r, i) => ({
    rank: i + 1,
    userId: r.userId,
    pseudo: r.pseudo,
    totalScore: r.totalScore,
    puzzlesPlayed: r.puzzlesPlayed,
    cumulativeTimeMs: r.cumulativeTimeMs,
  }));
}

export async function standingsRoutes(app: FastifyInstance) {
  app.get<{ Params: { id: string }; Querystring: { period?: string; limit?: string; offset?: string } }>(
    "/leagues/:id/standings",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const period = (request.query.period as string) || "current";

      // Verify user is a member of this league
      const membership = await prisma.membership.findUnique({
        where: { leagueId_userId: { leagueId: id, userId: request.user.sub } },
      });
      if (!membership) {
        return reply.code(403).send({ error: "Not a member of this league" });
      }

      const month = currentMonth();

      const allStandings = period === "all_time"
        ? await computeAllTimeStandings(id)
        : await computeStandings(id, month);

      const userEntry = allStandings.find((s) => s.userId === request.user.sub);

      // Pagination
      const limit = Math.min(parseInt(request.query.limit as string) || 50, 200);
      const offset = parseInt(request.query.offset as string) || 0;
      const standings = allStandings.slice(offset, offset + limit);

      return {
        leagueId: id,
        period,
        month: period === "current" ? month : undefined,
        total: allStandings.length,
        standings,
        userEntry: userEntry ?? undefined,
      };
    },
  );

  app.get(
    "/leagues/global/standings",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const globalLeague = await prisma.league.findUnique({
        where: { code: "GLOBAL" },
      });
      if (!globalLeague) {
        return reply.code(404).send({ error: "Global league not found" });
      }

      const month = currentMonth();
      const allStandings = await computeStandings(globalLeague.id, month);
      const userEntry = allStandings.find((s) => s.userId === request.user.sub);
      const percentile = userEntry
        ? Math.round(((allStandings.length - userEntry.rank) / allStandings.length) * 100)
        : undefined;

      // Pagination
      const query = request.query as Record<string, string>;
      const limit = Math.min(parseInt(query.limit) || 50, 200);
      const offset = parseInt(query.offset) || 0;
      const standings = allStandings.slice(offset, offset + limit);

      return {
        leagueId: globalLeague.id,
        period: "current",
        month,
        total: allStandings.length,
        standings,
        userEntry: userEntry
          ? { ...userEntry, percentile }
          : undefined,
      };
    },
  );
}
