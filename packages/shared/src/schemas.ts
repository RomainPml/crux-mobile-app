import { z } from "zod";

// ── Auth ──
export const AnonAuthRequestSchema = z.object({
  deviceKey: z.string().min(16).max(512),
});

export const AnonAuthResponseSchema = z.object({
  token: z.string(),
  userId: z.string(),
});

// ── Puzzle ──
export const PuzzleConfigSchema = z.object({
  category: z.string(),
  wordLength: z.number().int(),
  maxAttempts: z.number().int(),
});

export const PuzzleTodayResponseSchema = z.object({
  puzzleId: z.string(),
  day: z.string(),
  difficulty: z.number().int().min(1).max(5),
  servedAt: z.string().datetime(),
  config: PuzzleConfigSchema,
  isCatchUp: z.boolean().optional(),
});

// ── Month status ──
export const DayStatusSchema = z.enum(["completed", "missed", "today", "future"]);

export const MonthStatusResponseSchema = z.object({
  month: z.string(),
  days: z.record(z.string(), DayStatusSchema),
});

// ── Guess ──
export const LetterResultSchema = z.enum(["correct", "present", "absent"]);

export const GuessRequestSchema = z.object({
  guess: z.string(),
});

export const GuessResponseSchema = z.object({
  result: z.array(LetterResultSchema),
  attemptsUsed: z.number().int(),
  maxAttempts: z.number().int(),
  solved: z.boolean(),
  score: z.number().int().optional(),
  timeMs: z.number().int().optional(),
});

// ── Result ──
export const SubmitResultRequestSchema = z.object({
  puzzleId: z.string(),
  cleanDeductions: z.number().int().min(0).max(20),
  solution: z.array(z.record(z.string())).optional(),
});

export const SubmitResultResponseSchema = z.object({
  resultId: z.string(),
  score: z.number().int(),
  timeMs: z.number().int(),
  suspect: z.boolean(),
  correct: z.boolean(),
});

// ── League ──
export const LeagueTypeSchema = z.enum(["global", "private"]);

export const CreateLeagueRequestSchema = z.object({
  name: z.string().min(1).max(50),
});

export const CreateLeagueResponseSchema = z.object({
  leagueId: z.string(),
  name: z.string(),
  code: z.string(),
});

export const JoinLeagueRequestSchema = z.object({
  code: z.string().length(6),
});

export const JoinLeagueResponseSchema = z.object({
  leagueId: z.string(),
  name: z.string(),
});

// ── Standings ──
export const StandingEntrySchema = z.object({
  rank: z.number().int(),
  userId: z.string(),
  pseudo: z.string().nullable(),
  totalScore: z.number().int(),
  puzzlesPlayed: z.number().int(),
  cumulativeTimeMs: z.number().int(),
});

export const StandingsResponseSchema = z.object({
  leagueId: z.string(),
  period: z.enum(["current", "all_time"]),
  month: z.string().optional(),
  standings: z.array(StandingEntrySchema),
  userEntry: StandingEntrySchema.extend({
    percentile: z.number().optional(),
  }).optional(),
});

// ── Profile ──
export const UpdateProfileRequestSchema = z.object({
  pseudo: z
    .string()
    .min(2)
    .max(20)
    .regex(/^[a-zA-Z0-9_-]+$/, "Lettres, chiffres, _ et - uniquement"),
});

export const UpdateProfileResponseSchema = z.object({
  userId: z.string(),
  pseudo: z.string(),
});

export const BadgeSchema = z.object({
  code: z.string(),
  name: z.string(),
  description: z.string(),
  awardedAt: z.string().datetime(),
  context: z.record(z.unknown()).nullable(),
});

export const MonthlyHistoryEntrySchema = z.object({
  month: z.string(),
  leagueId: z.string(),
  leagueName: z.string(),
  finalRank: z.number().int(),
  finalScore: z.number().int(),
  membersCount: z.number().int(),
});

export const ProfileResponseSchema = z.object({
  userId: z.string(),
  pseudo: z.string().nullable(),
  badges: z.array(BadgeSchema),
  monthlyHistory: z.array(MonthlyHistoryEntrySchema),
});

// ── My Leagues ──
export const MyLeagueEntrySchema = z.object({
  leagueId: z.string(),
  name: z.string(),
  code: z.string(),
  type: LeagueTypeSchema,
  currentRank: z.number().int().nullable(),
  memberCount: z.number().int(),
});

export const MyLeaguesResponseSchema = z.object({
  leagues: z.array(MyLeagueEntrySchema),
});

// ── Health ──
export const HealthResponseSchema = z.object({
  status: z.literal("ok"),
});
