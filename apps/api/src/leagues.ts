import { randomInt } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { CreateLeagueRequestSchema, JoinLeagueRequestSchema, currentMonth } from "@crux/shared";
import { prisma } from "./db.js";
import { authenticate } from "./auth.js";
import { trackEvent } from "./events.js";

// No ambiguous chars: 0/O, 1/I removed
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[randomInt(CODE_CHARS.length)];
  }
  return code;
}

async function uniqueCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode();
    const exists = await prisma.league.findUnique({ where: { code } });
    if (!exists) return code;
  }
  throw new Error("Failed to generate unique league code");
}

export async function leagueRoutes(app: FastifyInstance) {
  app.post("/leagues", { preHandler: [authenticate] }, async (request, reply) => {
    const body = CreateLeagueRequestSchema.parse(request.body);
    const userId = request.user.sub;

    // Limit league creation per user
    const ownedCount = await prisma.league.count({ where: { ownerId: userId } });
    if (ownedCount >= 20) {
      return reply.code(400).send({ error: "Maximum 20 leagues per user" });
    }

    const code = await uniqueCode();

    const league = await prisma.league.create({
      data: {
        name: body.name,
        code,
        type: "PRIVATE",
        ownerId: userId,
      },
    });

    // Creator auto-joins as admin
    await prisma.membership.create({
      data: { leagueId: league.id, userId, role: "ADMIN" },
    });

    return { leagueId: league.id, name: league.name, code: league.code };
  });

  app.post("/leagues/join", { preHandler: [authenticate] }, async (request, reply) => {
    const body = JoinLeagueRequestSchema.parse(request.body);
    const userId = request.user.sub;

    const league = await prisma.league.findUnique({
      where: { code: body.code.toUpperCase() },
    });
    if (!league) {
      return reply.code(404).send({ error: "League not found" });
    }

    // Idempotent join via upsert (race-safe)
    await prisma.membership.upsert({
      where: { leagueId_userId: { leagueId: league.id, userId } },
      create: { leagueId: league.id, userId },
      update: {},
    });

    trackEvent("invite_converted", userId, { leagueId: league.id, code: body.code });

    return { leagueId: league.id, name: league.name };
  });

  app.get("/me/leagues", { preHandler: [authenticate] }, async (request) => {
    const userId = request.user.sub;

    const memberships = await prisma.membership.findMany({
      where: { userId },
      include: {
        league: {
          include: {
            _count: { select: { memberships: true } },
          },
        },
      },
    });

    const month = currentMonth();

    // Get user's rank in each league via a single query per league
    // (targeted rank computation instead of loading full standings)
    const leagues = await Promise.all(
      memberships.map(async (m) => {
        const userScore = await prisma.monthlyScore.findUnique({
          where: { userId_month: { userId, month } },
        });

        let currentRank: number | null = null;
        if (userScore) {
          // Count members with better scores (simpler than full standings)
          const betterCount = await prisma.$queryRaw<[{ count: bigint }]>`
            SELECT COUNT(*) as count FROM monthly_score ms
            JOIN membership mb ON mb.user_id = ms.user_id AND mb.league_id = ${m.leagueId}
            WHERE ms.month = ${month} AND (
              ms.total_score > ${userScore.totalScore}
              OR (ms.total_score = ${userScore.totalScore} AND ms.puzzles_played > ${userScore.puzzlesPlayed})
              OR (ms.total_score = ${userScore.totalScore} AND ms.puzzles_played = ${userScore.puzzlesPlayed} AND ms.cumulative_time_ms < ${userScore.cumulativeTimeMs})
            )
          `;
          currentRank = Number(betterCount[0].count) + 1;
        }

        return {
          leagueId: m.league.id,
          name: m.league.name,
          code: m.league.code,
          type: m.league.type === "GLOBAL" ? "global" as const : "private" as const,
          currentRank,
          memberCount: m.league._count.memberships,
        };
      }),
    );

    return { leagues };
  });
}
