import * as SecureStore from "expo-secure-store";
import type {
  AnonAuthResponse,
  PuzzleTodayResponse,
  SubmitResultRequest,
  SubmitResultResponse,
  CreateLeagueRequest,
  CreateLeagueResponse,
  JoinLeagueRequest,
  JoinLeagueResponse,
  StandingsResponse,
  ProfileResponse,
  MyLeaguesResponse,
  UpdateProfileRequest,
  UpdateProfileResponse,
} from "@crux/shared";

import { Platform } from "react-native";

// Android emulator uses 10.0.2.2 to reach the host machine
const DEFAULT_API_URL = Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000";

const API_URL: string = DEFAULT_API_URL;

const DEVICE_KEY_STORE = "crux_device_key";
const TOKEN_STORE = "crux_token";

function randomDeviceKey(): string {
  const bytes = new Uint8Array(48);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function getOrCreateDeviceKey(): Promise<string> {
  let key = await SecureStore.getItemAsync(DEVICE_KEY_STORE);
  if (!key) {
    key = randomDeviceKey();
    await SecureStore.setItemAsync(DEVICE_KEY_STORE, key);
  }
  return key;
}

let cachedToken: string | null = null;

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  let token = await SecureStore.getItemAsync(TOKEN_STORE);
  if (token) {
    cachedToken = token;
    return token;
  }

  // No token yet — authenticate
  const deviceKey = await getOrCreateDeviceKey();
  const res = await fetch(`${API_URL}/auth/anon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceKey }),
  });
  if (!res.ok) throw new Error("Auth failed");

  const data: AnonAuthResponse = await res.json();
  await SecureStore.setItemAsync(TOKEN_STORE, data.token);
  cachedToken = data.token;
  return data.token;
}

async function clearToken(): Promise<void> {
  cachedToken = null;
  await SecureStore.deleteItemAsync(TOKEN_STORE);
}

async function apiFetch<T>(path: string, options?: RequestInit, isRetry = false): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });

  // On 401, clear stale token and retry auth once
  if (res.status === 401 && !isRetry) {
    await clearToken();
    return apiFetch<T>(path, options, true);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json();
}

// ── API methods ──

export const api = {
  getPuzzleToday: () => apiFetch<PuzzleTodayResponse>("/puzzles/today"),

  submitResult: (data: SubmitResultRequest) =>
    apiFetch<SubmitResultResponse>("/results", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  createLeague: (data: CreateLeagueRequest) =>
    apiFetch<CreateLeagueResponse>("/leagues", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  joinLeague: (data: JoinLeagueRequest) =>
    apiFetch<JoinLeagueResponse>("/leagues/join", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getStandings: (leagueId: string, period: string = "current") =>
    apiFetch<StandingsResponse>(`/leagues/${leagueId}/standings?period=${period}`),

  getGlobalStandings: () =>
    apiFetch<StandingsResponse>("/leagues/global/standings"),

  getProfile: () => apiFetch<ProfileResponse>("/me/profile"),

  updateProfile: (data: UpdateProfileRequest) =>
    apiFetch<UpdateProfileResponse>("/me/profile", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getMyLeagues: () => apiFetch<MyLeaguesResponse>("/me/leagues"),

  trackEvent: (type: string, payload?: Record<string, unknown>) =>
    apiFetch<{ ok: boolean }>("/events", {
      method: "POST",
      body: JSON.stringify({ type, payload }),
    }),
};
