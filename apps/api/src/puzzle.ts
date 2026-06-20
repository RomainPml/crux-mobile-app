import type { FastifyInstance } from "fastify";
import { todayDate } from "@crux/shared";
import type { PuzzleGrid } from "@crux/shared";
import { prisma } from "./db.js";
import { authenticate } from "./auth.js";
import { generatePuzzle } from "./puzzle-generator.js";

export async function puzzleRoutes(app: FastifyInstance) {
  app.get("/puzzles/today", { preHandler: [authenticate] }, async (request) => {
    const day = todayDate();

    // Check if puzzle already exists for today
    let puzzle = await prisma.puzzle.findUnique({ where: { day: new Date(day) } });

    if (!puzzle) {
      const { grid, solution } = generatePuzzle(day);
      puzzle = await prisma.puzzle.create({
        data: {
          day: new Date(day),
          difficulty: 3,
          gridData: grid as any,
          solution: solution as any,
        },
      });
    } else if (!puzzle.gridData) {
      // Backfill grid for legacy puzzles created before the generator
      const { grid, solution } = generatePuzzle(day);
      puzzle = await prisma.puzzle.update({
        where: { id: puzzle.id },
        data: { gridData: grid as any, solution: solution as any },
      });
    }

    const servedAt = new Date();

    // Store servedAt only on first serve (no-op on re-fetch to prevent timer gaming)
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
      grid: puzzle.gridData as PuzzleGrid,
    };
  });
}
