import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { checkDeferredDeepLink, setupDeepLinkListener } from "../lib/deferred-link";
import { COLORS } from "../lib/theme";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    },
    mutations: { retry: 1, retryDelay: 1000 },
  },
});

export default function RootLayout() {
  useEffect(() => {
    checkDeferredDeepLink();
    const sub = setupDeepLinkListener();
    return () => sub.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: COLORS.bgCard },
          headerTintColor: COLORS.textPrimary,
          headerShadowVisible: false,
          contentStyle: { backgroundColor: COLORS.bg },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="standings/[id]" options={{ title: "Classement", animation: "slide_from_right" }} />
        <Stack.Screen name="join/[code]" options={{ title: "Rejoindre", presentation: "modal" }} />
      </Stack>
    </QueryClientProvider>
  );
}
