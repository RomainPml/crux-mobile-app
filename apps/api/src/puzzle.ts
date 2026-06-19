import type { FastifyInstance } from "fastify";
import { todayDate } from "@crux/shared";
import { prisma } from "./db.js";
import { authenticate } from "./auth.js";

// ── PuzzleProvider interface (swap in real generator later) ──

export interface PuzzleProvider {
  getDailyPuzzle(day: string): { difficulty: number };
}

export const stubProvider: PuzzleProvider = {
  getDailyPuzzle(_day: string) {
    return { difficulty: 3 };
  },
};

let provider: PuzzleProvider = stubProvider;

export function setPuzzleProvider(p: PuzzleProvider) {
  provider = p;
}

// ── Routes ──

export async function puzzleRoutes(app: FastifyInstance) {
  app.get("/puzzles/today", { preHandler: [authenticate] }, async (request) => {
    const day = todayDate();
    const info = provider.getDailyPuzzle(day);

    // Upsert puzzle for today
    const puzzle = await prisma.puzzle.upsert({
      where: { day: new Date(day) },
      update: {},
      create: { day: new Date(day), difficulty: info.difficulty },
    });

    const servedAt = new Date();

    // Store servedAt so POST /results can compute server-side time
    await prisma.puzzleServe.upsert({
      where: { userId_puzzleId: { userId: request.user.sub, puzzleId: puzzle.id } },
      create: { userId: request.user.sub, puzzleId: puzzle.id, servedAt },
      update: { servedAt },
    });

    return {
      puzzleId: puzzle.id,
      day,
      difficulty: puzzle.difficulty,
      servedAt: servedAt.toISOString(),
    };
  });
}
