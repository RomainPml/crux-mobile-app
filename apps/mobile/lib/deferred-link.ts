import * as Linking from "expo-linking";
import { router } from "expo-router";
import { api } from "./api";

const DEFERRED_CODE_KEY = "crux_deferred_invite_code";

/** Check for a deferred deep link code passed through the web landing page.
 *  Called once at app startup. If a code is found, navigate to the join screen. */
export async function checkDeferredDeepLink() {
  // Check initial URL (app opened via link)
  const url = await Linking.getInitialURL();
  if (url) {
    const code = extractCode(url);
    if (code) {
      api.trackEvent("invite_clicked", { code }).catch(() => {});
      router.replace({ pathname: "/join/[code]", params: { code } });
      return;
    }
  }

  // Check clipboard or stored code from web (deferred deep link)
  // In a production app, we'd use a deferred deep link service.
  // For now, the web landing stores the code in localStorage,
  // but since RN doesn't share localStorage with the browser,
  // the practical flow relies on the URL scheme / universal link.
}

/** Listen for incoming deep links while the app is open */
export function setupDeepLinkListener() {
  const subscription = Linking.addEventListener("url", (event) => {
    const code = extractCode(event.url);
    if (code) {
      api.trackEvent("invite_clicked", { code }).catch(() => {});
      router.push({ pathname: "/join/[code]", params: { code } });
    }
  });
  return subscription;
}

function extractCode(url: string): string | null {
  try {
    // Handle crux://join/ABC123 or https://app.crux.com/l/ABC123
    const parsed = Linking.parse(url);
    const path = parsed.path || "";
    const segments = path.split("/").filter(Boolean);

    // crux://join/CODE
    if (segments[0] === "join" && segments[1]?.length === 6) {
      return segments[1].toUpperCase();
    }

    // https://domain/l/CODE
    if (segments[0] === "l" && segments[1]?.length === 6) {
      return segments[1].toUpperCase();
    }

    return null;
  } catch {
    return null;
  }
}
