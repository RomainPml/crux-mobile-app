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
} from "@crux/shared";

import { Platform } from "react-native";

// Android emulator uses 10.0.2.2 to reach the host machine
const DEFAULT_API_URL = Platform.OS === "android" ? "http://10.0.2.2:3000" : "http://localhost:3000";

// @ts-ignore — Expo injects EXPO_PUBLIC_ vars at build time
const API_URL: string = (globalThis as any).process?.env?.EXPO_PUBLIC_API_URL || DEFAULT_API_URL;

const DEVICE_KEY_STORE = "crux_device_key";
const TOKEN_STORE = "crux_token";

function randomDeviceKey(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let key = "";
  for (let i = 0; i < 64; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
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
  console.log("[API] Auth request to", `${API_URL}/auth/anon`);
  try {
    var res = await fetch(`${API_URL}/auth/anon`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deviceKey }),
    });
  } catch (e) {
    console.error("[API] Auth fetch failed:", e);
    throw e;
  }
  console.log("[API] Auth response:", res.status);
  if (!res.ok) throw new Error("Auth failed");

  const data: AnonAuthResponse = await res.json();
  await SecureStore.setItemAsync(TOKEN_STORE, data.token);
  cachedToken = data.token;
  return data.token;
}

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getToken();
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...options?.headers,
    },
  });
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

  getMyLeagues: () => apiFetch<MyLeaguesResponse>("/me/leagues"),

  trackEvent: (type: string, payload?: Record<string, unknown>) =>
    apiFetch<{ ok: boolean }>("/events", {
      method: "POST",
      body: JSON.stringify({ type, payload }),
    }),
};
