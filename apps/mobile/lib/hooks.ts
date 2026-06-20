import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "./api";
import type { CreateLeagueRequest, JoinLeagueRequest, UpdateProfileRequest } from "@crux/shared";

export function usePuzzleToday() {
  return useQuery({
    queryKey: ["puzzle", "today"],
    queryFn: api.getPuzzleToday,
    staleTime: 5 * 60 * 1000,
  });
}

export function useSubmitGuess() {
  return useMutation({
    mutationFn: ({ puzzleId, guess }: { puzzleId: string; guess: string }) =>
      api.submitGuess(puzzleId, guess),
  });
}

export function useMyLeagues() {
  return useQuery({
    queryKey: ["leagues"],
    queryFn: api.getMyLeagues,
  });
}

export function useStandings(leagueId: string | undefined) {
  return useQuery({
    queryKey: ["standings", leagueId],
    queryFn: () => api.getStandings(leagueId!),
    enabled: !!leagueId,
  });
}

export function useGlobalStandings() {
  return useQuery({
    queryKey: ["standings", "global"],
    queryFn: api.getGlobalStandings,
  });
}

export function useProfile() {
  return useQuery({
    queryKey: ["profile"],
    queryFn: api.getProfile,
  });
}

export function useCreateLeague() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateLeagueRequest) => api.createLeague(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leagues"] }),
  });
}

export function useJoinLeague() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: JoinLeagueRequest) => api.joinLeague(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["leagues"] }),
  });
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateProfileRequest) => api.updateProfile(data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["profile"] });
      qc.invalidateQueries({ queryKey: ["standings"] });
    },
  });
}
