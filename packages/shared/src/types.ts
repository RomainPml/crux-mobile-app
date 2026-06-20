import { z } from "zod";
import * as S from "./schemas";

export type AnonAuthRequest = z.infer<typeof S.AnonAuthRequestSchema>;
export type AnonAuthResponse = z.infer<typeof S.AnonAuthResponseSchema>;

export type PuzzleCategory = z.infer<typeof S.PuzzleCategorySchema>;
export type PuzzleClue = z.infer<typeof S.PuzzleClueSchema>;
export type PuzzleGrid = z.infer<typeof S.PuzzleGridSchema>;
export type ClueType = z.infer<typeof S.ClueTypeSchema>;
export type PuzzleTodayResponse = z.infer<typeof S.PuzzleTodayResponseSchema>;

export type SubmitResultRequest = z.infer<typeof S.SubmitResultRequestSchema>;
export type SubmitResultResponse = z.infer<typeof S.SubmitResultResponseSchema>;

export type UpdateProfileRequest = z.infer<typeof S.UpdateProfileRequestSchema>;
export type UpdateProfileResponse = z.infer<typeof S.UpdateProfileResponseSchema>;

export type CreateLeagueRequest = z.infer<typeof S.CreateLeagueRequestSchema>;
export type CreateLeagueResponse = z.infer<typeof S.CreateLeagueResponseSchema>;
export type JoinLeagueRequest = z.infer<typeof S.JoinLeagueRequestSchema>;
export type JoinLeagueResponse = z.infer<typeof S.JoinLeagueResponseSchema>;

export type StandingEntry = z.infer<typeof S.StandingEntrySchema>;
export type StandingsResponse = z.infer<typeof S.StandingsResponseSchema>;

export type Badge = z.infer<typeof S.BadgeSchema>;
export type MonthlyHistoryEntry = z.infer<typeof S.MonthlyHistoryEntrySchema>;
export type ProfileResponse = z.infer<typeof S.ProfileResponseSchema>;

export type MyLeagueEntry = z.infer<typeof S.MyLeagueEntrySchema>;
export type MyLeaguesResponse = z.infer<typeof S.MyLeaguesResponseSchema>;

export type LeagueType = z.infer<typeof S.LeagueTypeSchema>;
