import type { BearConfig } from "@/features/avatar/bear-config";
import type { PersonConfig } from "@/features/avatar/person-config";
import type { Profile } from "@/features/onboarding/profile";

type Send = (path: string, init: RequestInit) => Promise<Response>;

/** The player is the person; the bear belongs to their first agent and is saved beside its name. */
export type AccountAvatar = {
  readonly person: PersonConfig;
  readonly agent: { readonly name: string; readonly bear: BearConfig };
};

/**
 * Saves the onboarding answers and both looks to the signed-in account (S1's profile route), which
 * keeps `avatar` as free JSON, so the agent fits without a migration. Expertise has its own step
 * later (W3), so it is sent empty. A failure leaves everything in the browser, where onboarding
 * already keeps it, so the player is never stopped.
 */
export async function saveToAccount(
  send: Send,
  profile: Profile,
  avatar: AccountAvatar,
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
        avatar,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
