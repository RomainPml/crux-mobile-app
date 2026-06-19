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
  const members = await prisma.membership.findMany({
    where: { leagueId },
    include: {
      user: {
        include: {
          // All monthly scores ever
          monthlyScores: true,
          // Past frozen standings for this league
          leagueStandingHistory: { where: { leagueId } },
        },
      },
    },
  });

  const month = currentMonth();

  const rows: RankedRow[] = members.map((m) => {
    // Sum all historical final scores + current month score
    let totalScore = 0;
    let puzzlesPlayed = 0;
    let cumulativeTimeMs = 0;

    // Frozen months from history
    for (const h of m.user.leagueStandingHistory) {
      totalScore += h.finalScore;
    }

    // Current month from monthly_score (not yet frozen)
    const currentMs = m.user.monthlyScores.find((ms) => ms.month === month);
    if (currentMs) {
      totalScore += currentMs.totalScore;
      puzzlesPlayed += currentMs.puzzlesPlayed;
      cumulativeTimeMs += currentMs.cumulativeTimeMs;
    }

    // Sum puzzles/time from all monthly_scores for tiebreak
    for (const ms of m.user.monthlyScores) {
      if (ms.month !== month) {
        puzzlesPlayed += ms.puzzlesPlayed;
        cumulativeTimeMs += ms.cumulativeTimeMs;
      }
    }

    return {
      userId: m.userId,
      pseudo: m.user.pseudo,
      totalScore,
      puzzlesPlayed,
      cumulativeTimeMs,
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
  app.get<{ Params: { id: string }; Querystring: { period?: string } }>(
    "/leagues/:id/standings",
    { preHandler: [authenticate] },
    async (request) => {
      const { id } = request.params;
      const period = (request.query.period as string) || "current";
      const month = currentMonth();

      const standings = period === "all_time"
        ? await computeAllTimeStandings(id)
        : await computeStandings(id, month);

      const userEntry = standings.find((s) => s.userId === request.user.sub);

      return {
        leagueId: id,
        period,
        month: period === "current" ? month : undefined,
        standings,
        userEntry: userEntry ?? undefined,
      };
    },
  );

  app.get(
    "/leagues/global/standings",
    { preHandler: [authenticate] },
    async (request) => {
      const globalLeague = await prisma.league.findUnique({
        where: { code: "GLOBAL" },
      });
      if (!globalLeague) {
        return { error: "Global league not found" };
      }

      const month = currentMonth();
      const standings = await computeStandings(globalLeague.id, month);
      const userEntry = standings.find((s) => s.userId === request.user.sub);
      const percentile = userEntry
        ? Math.round(((standings.length - userEntry.rank) / standings.length) * 100)
        : undefined;

      return {
        leagueId: globalLeague.id,
        period: "current",
        month,
        standings,
        userEntry: userEntry
          ? { ...userEntry, percentile }
          : undefined,
      };
    },
  );
}
