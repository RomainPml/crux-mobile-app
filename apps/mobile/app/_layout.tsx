import { useEffect } from "react";
import { Stack } from "expo-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { checkDeferredDeepLink, setupDeepLinkListener } from "../lib/deferred-link";

const queryClient = new QueryClient();

export default function RootLayout() {
  useEffect(() => {
    checkDeferredDeepLink();
    const sub = setupDeepLinkListener();
    return () => sub.remove();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Stack>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="standings/[id]" options={{ title: "Classement" }} />
        <Stack.Screen name="join/[code]" options={{ title: "Rejoindre", presentation: "modal" }} />
      </Stack>
    </QueryClientProvider>
  );
}
