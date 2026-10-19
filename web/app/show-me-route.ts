import type { ShowMeTarget } from "@/features/story/show-me";

/** What "Show me" does in the world: a view, the settle dialog, or an app on the phone. */
export type ShowMeRoute =
  | { readonly kind: "view"; readonly view: "map" }
  | { readonly kind: "settle" }
  | { readonly kind: "phone-app"; readonly appId: "ask" | "opportunities" };

export function showMeRoute(target: ShowMeTarget): ShowMeRoute {
  switch (target) {
    case "map":
      return { kind: "view", view: "map" };
    case "settle":
      return { kind: "settle" };
    case "ask":
    case "opportunities":
      return { kind: "phone-app", appId: target };
  }
}
