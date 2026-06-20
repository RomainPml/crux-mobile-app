import type { FastifyInstance } from "fastify";
import { todayDate, GuessRequestSchema, currentMonth } from "@crux/shared";
import type { PuzzleConfig } from "@crux/shared";
import { prisma } from "./db.js";
import { authenticate } from "./auth.js";
import { generatePuzzle, evaluateGuess, isValidGuess, computeWordleScore } from "./puzzle-generator.js";
import { trackEvent } from "./events.js";

export async function puzzleRoutes(app: FastifyInstance) {
  app.get("/puzzles/today", { preHandler: [authenticate] }, async (request) => {
    const day = todayDate();

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
          data: {
            day: new Date(day),
            difficulty: 3,
            gridData: config as any,
            solution: solution as any,
          },
        });
      }
    }

    const servedAt = new Date();
    await prisma.puzzleServe.upsert({
      where: { userId_puzzleId: { userId: request.user.sub, puzzleId: puzzle.id } },
      create: { userId: request.user.sub, puzzleId: puzzle.id, servedAt },
      update: {},
    });

    const config = puzzle.gridData as PuzzleConfig;

    return {
      puzzleId: puzzle.id,
      day,
      difficulty: puzzle.difficulty,
      servedAt: servedAt.toISOString(),
      config,
    };
  });

  app.post<{ Params: { id: string } }>(
    "/puzzles/:id/guess",
    { preHandler: [authenticate] },
    async (request, reply) => {
      const { id } = request.params;
      const userId = request.user.sub;
      const body = GuessRequestSchema.parse(request.body);
      const guess = body.guess.toUpperCase();

      // Get puzzle
      const puzzle = await prisma.puzzle.findUnique({ where: { id } });
      if (!puzzle) {
        return reply.code(404).send({ error: "Puzzle not found" });
      }

      // Validate guess is a real word
      if (!isValidGuess(guess)) {
        return reply.code(400).send({ error: "Mot invalide" });
      }

      // Check if already solved
      const existingResult = await prisma.dailyResult.findUnique({
        where: { userId_puzzleId: { userId, puzzleId: id } },
      });
      if (existingResult) {
        return reply.code(400).send({ error: "Puzzle deja soumis" });
      }

      // Get or create guess history for this user+puzzle
      const serveRecord = await prisma.puzzleServe.findUnique({
        where: { userId_puzzleId: { userId, puzzleId: id } },
      });
      if (!serveRecord) {
        return reply.code(400).send({ error: "Puzzle not served" });
      }

      // Load previous guesses from a lightweight store
      // We store guesses in the puzzleServe record's context
      const prevGuesses: string[] = ((serveRecord as any).guesses as string[]) ?? [];
      const maxAttempts = 6;

      if (prevGuesses.length >= maxAttempts) {
        return reply.code(400).send({ error: "Plus de tentatives" });
      }

      const answer = (puzzle.solution as any).word as string;
      const result = evaluateGuess(guess, answer);
      const solved = result.every((r) => r === "correct");
      const newGuesses = [...prevGuesses, guess];

      // Store guess history
      await prisma.$executeRaw`
        UPDATE puzzle_serve SET guesses = ${JSON.stringify(newGuesses)}::jsonb
        WHERE user_id = ${userId} AND puzzle_id = ${id}
      `;

      const attemptsUsed = newGuesses.length;
      const gameOver = solved || attemptsUsed >= maxAttempts;

      // If game is over, create the daily result
      if (gameOver) {
        const submittedAt = new Date();
        const timeMs = submittedAt.getTime() - serveRecord.servedAt.getTime();
        const suspect = timeMs < 3000;
        const score = suspect ? 0 : computeWordleScore(attemptsUsed, timeMs, solved);
        const month = currentMonth(submittedAt);

        await prisma.$transaction(async (tx) => {
          await tx.dailyResult.create({
            data: {
              userId,
              puzzleId: id,
              score,
              timeMs,
              cleanDeductions: attemptsUsed,
              servedAt: serveRecord.servedAt,
              submittedAt,
              suspect,
              correct: solved,
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
          puzzleId: id, score, timeMs, solved, attempts: attemptsUsed,
        }).catch(() => {});

        return {
          result,
          attemptsUsed,
          maxAttempts,
          solved,
          score,
          timeMs,
        };
      }

      return {
        result,
        attemptsUsed,
        maxAttempts,
        solved: false,
      };
    },
  );
}
