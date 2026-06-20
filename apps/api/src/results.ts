import type { FastifyInstance } from "fastify";
import { SubmitResultRequestSchema, currentMonth, todayDate } from "@crux/shared";
import { prisma } from "./db.js";
import { authenticate } from "./auth.js";
import { trackEvent } from "./events.js";

const SUSPECT_THRESHOLD_MS = 5_000; // under 5s is suspicious

function computeScore(timeMs: number, cleanDeductions: number): number {
  // Base score from speed (max 1000, decays over 5 minutes)
  const maxTime = 5 * 60 * 1000;
  const speedScore = Math.max(0, Math.round(1000 * (1 - timeMs / maxTime)));
  // Bonus for clean deductions (100 points each, max 500)
  const cleanBonus = Math.min(cleanDeductions * 100, 500);
  return speedScore + cleanBonus;
}

export async function resultRoutes(app: FastifyInstance) {
  app.post("/results", { preHandler: [authenticate] }, async (request, reply) => {
    const body = SubmitResultRequestSchema.parse(request.body);
    const userId = request.user.sub;

    // Verify puzzle exists and is today's puzzle
    const puzzle = await prisma.puzzle.findUnique({
      where: { id: body.puzzleId },
    });
    if (!puzzle) {
      return reply.code(404).send({ error: "Puzzle not found" });
    }

    // Verify this is today's puzzle
    const puzzleDay = puzzle.day.toISOString().slice(0, 10);
    if (puzzleDay !== todayDate()) {
      return reply.code(400).send({ error: "Can only submit results for today's puzzle" });
    }

    // Check idempotency: already submitted?
    const existing = await prisma.dailyResult.findUnique({
      where: { userId_puzzleId: { userId, puzzleId: body.puzzleId } },
    });
    if (existing) {
      return {
        resultId: existing.id,
        score: existing.score,
        timeMs: existing.timeMs,
        suspect: existing.suspect,
      };
    }

    // Get server-side servedAt
    const serveRecord = await prisma.puzzleServe.findUnique({
      where: { userId_puzzleId: { userId, puzzleId: body.puzzleId } },
    });

    if (!serveRecord) {
      return reply.code(400).send({ error: "Puzzle was not served to this user" });
    }

    const submittedAt = new Date();
    const servedAt = serveRecord.servedAt;
    const timeMs = submittedAt.getTime() - servedAt.getTime();
    const suspect = timeMs < SUSPECT_THRESHOLD_MS;
    const score = suspect ? 0 : computeScore(timeMs, body.cleanDeductions);
    const month = currentMonth(submittedAt);

    // Create result + update monthly score in a transaction (race-safe)
    let result;
    try {
      result = await prisma.$transaction(async (tx) => {
        const r = await tx.dailyResult.create({
          data: {
            userId,
            puzzleId: body.puzzleId,
            score,
            timeMs,
            cleanDeductions: body.cleanDeductions,
            servedAt,
            submittedAt,
            suspect,
          },
        });

      if (!suspect) {
        await tx.monthlyScore.upsert({
          where: { userId_month: { userId, month } },
          create: {
            userId,
            month,
            totalScore: score,
            puzzlesPlayed: 1,
            cumulativeTimeMs: timeMs,
          },
          update: {
            totalScore: { increment: score },
            puzzlesPlayed: { increment: 1 },
            cumulativeTimeMs: { increment: timeMs },
          },
        });
      }

      return r;
      });
    } catch (e: any) {
      // P2002 = concurrent duplicate submission — return existing
      if (e.code === "P2002") {
        const dup = await prisma.dailyResult.findUniqueOrThrow({
          where: { userId_puzzleId: { userId, puzzleId: body.puzzleId } },
        });
        return { resultId: dup.id, score: dup.score, timeMs: dup.timeMs, suspect: dup.suspect };
      }
      throw e;
    }

    trackEvent("result_submitted", userId, { puzzleId: body.puzzleId, score, timeMs, suspect }).catch(() => {});

    return {
      resultId: result.id,
      score: result.score,
      timeMs: result.timeMs,
      suspect: result.suspect,
    };
  });
}
