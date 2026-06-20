import type { FastifyInstance } from "fastify";
import { todayDate, GuessRequestSchema, currentMonth, missedDaysThisMonth } from "@crux/shared";
import type { PuzzleConfig } from "@crux/shared";
import { prisma } from "./db.js";
import { authenticate } from "./auth.js";
import { generatePuzzle, evaluateGuess, isValidGuess, computeWordleScore } from "./puzzle-generator.js";
import { trackEvent } from "./events.js";

const CATCHUP_PENALTY = 0.5;

async function ensurePuzzle(day: string) {
  let puzzle = await prisma.puzzle.findUnique({ where: { day: new Date(day) } });
  if (!puzzle || !puzzle.solution) {
    const { config, solution } = generatePuzzle(day);
    if (puzzle) {
      puzzle = await prisma.puzzle.update({
        where: { id: puzzle.id },
        data: { gridData: config as any, solution: solution as any },
      });
    } else {
      puzzle = await prisma.puzzle.create({
        data: { day: new Date(day), difficulty: 3, gridData: config as any, solution: solution as any },
      });
    }
  }
  return puzzle;
}

export async function puzzleRoutes(app: FastifyInstance) {
  // ── Today's puzzle ──
  app.get("/puzzles/today", { preHandler: [authenticate] }, async (request) => {
    const day = todayDate();
    const puzzle = await ensurePuzzle(day);

    const servedAt = new Date();
    await prisma.puzzleServe.upsert({
      where: { userId_puzzleId: { userId: request.user.sub, puzzleId: puzzle.id } },
      create: { userId: request.user.sub, puzzleId: puzzle.id, servedAt },
      update: {},
    });

    return {
      puzzleId: puzzle.id,
      day,
      difficulty: puzzle.difficulty,
      servedAt: servedAt.toISOString(),
      config: puzzle.gridData as PuzzleConfig,
      isCatchUp: false,
    };
  });

  // ── Past puzzle (catch-up) ──
  app.get<{ Params: { date: string } }>(
    "/puzzles/day/:date",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { date } = request.params;
      const today = todayDate();
      const month = currentMonth();

      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        return reply.code(400).send({ error: "Format de date invalide" });
      }
      if (!date.startsWith(month)) {
        return reply.code(400).send({ error: "Uniquement le mois en cours" });
      }
      if (date > today) {
        return reply.code(400).send({ error: "Puzzle pas encore disponible" });
      }
      if (date === today) {
        return reply.code(400).send({ error: "Utilisez /puzzles/today" });
      }

      // Check if already completed
      const existing = await prisma.dailyResult.findFirst({
        where: { userId: request.user.sub, puzzle: { day: new Date(date) } },
      });
      if (existing) {
        return reply.code(400).send({ error: "Puzzle deja complete" });
      }

      const puzzle = await ensurePuzzle(date);
      const servedAt = new Date();

      await prisma.puzzleServe.upsert({
        where: { userId_puzzleId: { userId: request.user.sub, puzzleId: puzzle.id } },
        create: { userId: request.user.sub, puzzleId: puzzle.id, servedAt },
        update: { servedAt },
      });

      return {
        puzzleId: puzzle.id,
        day: date,
        difficulty: puzzle.difficulty,
        servedAt: servedAt.toISOString(),
        config: puzzle.gridData as PuzzleConfig,
        isCatchUp: true,
      };
    },
  );

  // ── Month status ──
  app.get("/puzzles/month-status", { preHandler: [authenticate] }, async (request) => {
    const userId = request.user.sub;
    const today = todayDate();
    const month = currentMonth();
    const pastDays = missedDaysThisMonth();

    const completedResults = await prisma.dailyResult.findMany({
      where: {
        userId,
        puzzle: { day: { gte: new Date(`${month}-01`), lte: new Date(today) } },
      },
      include: { puzzle: { select: { day: true } } },
    });

    const completedDays = new Set(
      completedResults.map((r) => r.puzzle.day.toISOString().slice(0, 10)),
    );

    const days: Record<string, string> = {};
    for (const d of pastDays) {
      days[d] = completedDays.has(d) ? "completed" : "missed";
    }
    days[today] = completedDays.has(today) ? "completed" : "today";

    return { month, days };
  });

  // ── Guess ──
  app.post<{ Params: { id: string } }>(
    "/puzzles/:id/guess",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user.sub;
      const body = GuessRequestSchema.parse(request.body);
      const guess = body.guess.toUpperCase();

      const puzzle = await prisma.puzzle.findUnique({ where: { id } });
      if (!puzzle) return reply.code(404).send({ error: "Puzzle not found" });

      if (!isValidGuess(guess)) return reply.code(400).send({ error: "Mot invalide" });

      const existingResult = await prisma.dailyResult.findUnique({
        where: { userId_puzzleId: { userId, puzzleId: id } },
      });
      if (existingResult) return reply.code(400).send({ error: "Puzzle deja soumis" });

      const serveRecord = await prisma.puzzleServe.findUnique({
        where: { userId_puzzleId: { userId, puzzleId: id } },
      });
      if (!serveRecord) return reply.code(400).send({ error: "Puzzle not served" });

      const prevGuesses: string[] = ((serveRecord as any).guesses as string[]) ?? [];
      const maxAttempts = 6;
      if (prevGuesses.length >= maxAttempts) return reply.code(400).send({ error: "Plus de tentatives" });

      const answer = (puzzle.solution as any).word as string;
      const result = evaluateGuess(guess, answer);
      const solved = result.every((r) => r === "correct");
      const newGuesses = [...prevGuesses, guess];

      await prisma.$executeRaw`
        UPDATE puzzle_serve SET guesses = ${JSON.stringify(newGuesses)}::jsonb
        WHERE user_id = ${userId} AND puzzle_id = ${id}
      `;

      const attemptsUsed = newGuesses.length;
      const gameOver = solved || attemptsUsed >= maxAttempts;

      if (gameOver) {
        const submittedAt = new Date();
        const timeMs = submittedAt.getTime() - serveRecord.servedAt.getTime();
        const suspect = timeMs < 3000;

        // Catch-up penalty
        const puzzleDay = puzzle.day.toISOString().slice(0, 10);
        const isCatchUp = puzzleDay !== todayDate();
        const rawScore = suspect ? 0 : computeWordleScore(attemptsUsed, timeMs, solved);
        const score = isCatchUp ? Math.round(rawScore * CATCHUP_PENALTY) : rawScore;
        const month = currentMonth(submittedAt);

        await prisma.$transaction(async (tx) => {
          await tx.dailyResult.create({
            data: {
              userId, puzzleId: id, score, timeMs,
              cleanDeductions: attemptsUsed,
              servedAt: serveRecord.servedAt, submittedAt,
              suspect, correct: solved, isCatchUp,
            },
          });

          if (!suspect && solved) {
            await tx.monthlyScore.upsert({
              where: { userId_month: { userId, month } },
              create: { userId, month, totalScore: score, puzzlesPlayed: 1, cumulativeTimeMs: timeMs },
              update: {
                totalScore: { increment: score },
                puzzlesPlayed: { increment: 1 },
                cumulativeTimeMs: { increment: timeMs },
              },
            });
          }
        });

        trackEvent("result_submitted", userId, {
          puzzleId: id, score, timeMs, solved, attempts: attemptsUsed, isCatchUp,
        }).catch(() => {});

        return { result, attemptsUsed, maxAttempts, solved, score, timeMs };
      }

      return { result, attemptsUsed, maxAttempts, solved: false };
    },
  );
}
