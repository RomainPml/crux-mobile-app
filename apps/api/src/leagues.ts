import type { FastifyInstance } from "fastify";
import { CreateLeagueRequestSchema, JoinLeagueRequestSchema } from "@crux/shared";
import { prisma } from "./db.js";
import { authenticate } from "./auth.js";
import { trackEvent } from "./events.js";

// No ambiguous chars: 0/O, 1/I removed
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function generateCode(): string {
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
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
  app.post("/leagues", { preHandler: [authenticate] }, async (request) => {
    const body = CreateLeagueRequestSchema.parse(request.body);
    const userId = request.user.sub;
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

    const { currentMonth } = await import("@crux/shared");
    const month = currentMonth();

    const leagues = await Promise.all(
      memberships.map(async (m) => {
        // Get user's rank in this league
        const { computeStandings } = await import("./standings.js");
        const standings = await computeStandings(m.leagueId, month);
        const userStanding = standings.find((s) => s.userId === userId);

        return {
          leagueId: m.league.id,
          name: m.league.name,
          code: m.league.code,
          type: m.league.type === "GLOBAL" ? "global" as const : "private" as const,
          currentRank: userStanding?.rank ?? null,
          memberCount: m.league._count.memberships,
        };
      }),
    );

    return { leagues };
  });
}
