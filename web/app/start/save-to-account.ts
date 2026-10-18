import type { BearConfig } from "@/features/avatar/bear-config";
import type { Profile } from "@/features/onboarding/profile";

type Send = (path: string, init: RequestInit) => Promise<Response>;

/**
 * Saves the onboarding answers and the bear to the signed-in account (S1's profile route).
 * Expertise has its own step later (W3), so it is sent empty. A failure leaves the answers in the
 * browser, where onboarding already keeps them, so the player is never stopped.
 */
export async function saveToAccount(
  send: Send,
  profile: Profile,
  bear: BearConfig,
): Promise<boolean> {
  try {
    const response = await send("/api/auth/me/profile", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        role: profile.role,
        goal: profile.goal,
        expertise: [],
        visibility: profile.visibility,
        avatar: bear,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
