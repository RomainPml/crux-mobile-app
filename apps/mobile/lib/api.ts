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

// Physical device uses LAN IP, emulator uses 10.0.2.2
const API_URL = "http://192.168.1.59:3000";

const DEVICE_KEY_STORE = "crux_device_key";
const TOKEN_STORE = "crux_token";

function randomDeviceKey(): string {
  return require("expo-crypto").getRandomBytes(48)
    .reduce((s: string, b: number) => s + b.toString(16).padStart(2, "0"), "");
}

async function getOrCreateDeviceKey(): Promise<string> {
  try {
    const key = await SecureStore.getItemAsync(DEVICE_KEY_STORE);
    if (key) return key;
  } catch {}
  const key = randomDeviceKey();
  try {
    await SecureStore.setItemAsync(DEVICE_KEY_STORE, key);
  } catch {}
  return key;
}

let cachedToken: string | null = null;

async function getToken(): Promise<string> {
  if (cachedToken) return cachedToken;

  try {
    const token = await SecureStore.getItemAsync(TOKEN_STORE);
    if (token) {
      cachedToken = token;
      return token;
    }
  } catch {}

  // No token yet — authenticate
  const deviceKey = await getOrCreateDeviceKey();
  const res = await fetch(`${API_URL}/auth/anon`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deviceKey }),
  });
  if (!res.ok) throw new Error(`Auth failed: ${res.status}`);

  const data: AnonAuthResponse = await res.json();
  try {
    await SecureStore.setItemAsync(TOKEN_STORE, data.token);
  } catch {}
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
    throw new ApiError(res.status, body);
  }
  return res.json();
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(`API ${status}: ${message}`);
  }
}

// ── Puzzle cache ──

import AsyncStorage from "@react-native-async-storage/async-storage";
import { todayDate } from "@crux/shared";

const PUZZLE_CACHE_KEY = "crux_puzzle_cache";

async function getPuzzleTodayCached(): Promise<PuzzleTodayResponse> {
  try {
    const response = await apiFetch<PuzzleTodayResponse>("/puzzles/today");
    // Cache for offline use (fire-and-forget)
    AsyncStorage.setItem(PUZZLE_CACHE_KEY, JSON.stringify(response)).catch(() => {});
    return response;
  } catch (error) {
    console.log("[Puzzle] Fetch failed, trying cache:", error);
    // Fallback to cache if offline
    const cached = await AsyncStorage.getItem(PUZZLE_CACHE_KEY).catch(() => null);
    if (cached) {
      const parsed = JSON.parse(cached) as PuzzleTodayResponse;
      if (parsed.day === todayDate()) return parsed;
    }
    throw error;
  }
}

// ── API methods ──

export const api = {
  getPuzzleToday: () => getPuzzleTodayCached(),

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
