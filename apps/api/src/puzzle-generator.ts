import type { PuzzleConfig, LetterResult } from "@crux/shared";
import { ANSWER_POOL, VALID_GUESSES } from "./words.js";

// Seeded PRNG (mulberry32)
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface PuzzleSolution {
  word: string;
}

export function generatePuzzle(day: string): {
  config: PuzzleConfig;
  solution: PuzzleSolution;
} {
  const seed = parseInt(day.replace(/-/g, ""), 10);
  const rng = mulberry32(seed);
  const index = Math.floor(rng() * ANSWER_POOL.length);
  const word = ANSWER_POOL[index];

  return {
    config: {
      category: "words",
      wordLength: 5,
      maxAttempts: 6,
    },
    solution: { word },
  };
}

export function evaluateGuess(guess: string, answer: string): LetterResult[] {
  const result: LetterResult[] = new Array(answer.length).fill("absent");
  const answerChars = answer.split("");
  const guessChars = guess.toUpperCase().split("");
  const used = new Array(answer.length).fill(false);

  // First pass: correct positions
  for (let i = 0; i < guessChars.length; i++) {
    if (guessChars[i] === answerChars[i]) {
      result[i] = "correct";
      used[i] = true;
      guessChars[i] = ""; // mark as handled
    }
  }

  // Second pass: present but wrong position
  for (let i = 0; i < guessChars.length; i++) {
    if (guessChars[i] === "") continue;
    const idx = answerChars.findIndex((c, j) => c === guessChars[i] && !used[j]);
    if (idx !== -1) {
      result[i] = "present";
      used[idx] = true;
    }
  }

  return result;
}

export function isValidGuess(guess: string): boolean {
  return guess.length === 5 && VALID_GUESSES.has(guess.toUpperCase());
}

// Score based on number of attempts
export function computeWordleScore(attempts: number, timeMs: number, solved: boolean): number {
  if (!solved) return 0;
  const attemptScores = [1000, 800, 600, 400, 200, 100];
  const baseScore = attemptScores[attempts - 1] ?? 50;
  // Time bonus: up to 500 extra for solving under 30s, decaying over 5 min
  const maxTime = 5 * 60 * 1000;
  const timeBonus = Math.max(0, Math.round(500 * (1 - timeMs / maxTime)));
  return baseScore + timeBonus;
}
