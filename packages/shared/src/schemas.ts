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
export const PuzzleTodayResponseSchema = z.object({
  puzzleId: z.string(),
  day: z.string(), // YYYY-MM-DD
  difficulty: z.number().int().min(1).max(5),
  servedAt: z.string().datetime(),
});

// ── Result ──
export const SubmitResultRequestSchema = z.object({
  puzzleId: z.string(),
  cleanDeductions: z.number().int().min(0).max(10),
});

export const SubmitResultResponseSchema = z.object({
  resultId: z.string(),
  score: z.number().int(),
  timeMs: z.number().int(),
  suspect: z.boolean(),
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
