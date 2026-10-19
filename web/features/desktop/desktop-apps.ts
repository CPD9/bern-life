// The office computer's apps, in dock order. An app is either real or gone: only the apps the host
// gives content appear in the dock, so a package adds its app by passing its content, one line.
import type { ReactNode } from "react";
import type { AppIconName } from "@/infrastructure/ui/app-icons";

export const desktopAppIds = [
  "navigator",
  "agents",
  "reports",
  "messages",
  "library",
  "opportunities",
  "garage",
  "settings",
] as const;

export type DesktopAppId = (typeof desktopAppIds)[number];

type AppLook = { readonly label: string; readonly icon: AppIconName; readonly tile: string };

export const desktopAppLooks: Record<DesktopAppId, AppLook> = {
  navigator: { label: "Navigator", icon: "ask", tile: "#13804a" },
  agents: { label: "Agents", icon: "agents", tile: "#6d4bd8" },
  reports: { label: "Reports", icon: "reports", tile: "#0e7490" },
  messages: { label: "Messages", icon: "messages", tile: "#1d6fd6" },
  library: { label: "Library", icon: "library", tile: "#9a3412" },
  opportunities: { label: "Opportunities", icon: "opportunities", tile: "#b45309" },
  garage: { label: "Garage", icon: "garage", tile: "#334155" },
  settings: { label: "Settings", icon: "settings", tile: "#475569" },
};

export type DesktopApp = {
  readonly id: DesktopAppId;
  readonly label: string;
  readonly icon: AppIconName;
  readonly tile: string;
  readonly content: ReactNode;
  /** A count shown on the dock button, such as unread messages; absent when there is none. */
  readonly badge?: number;
};

type DesktopContents = Partial<Record<DesktopAppId, ReactNode>>;
type DesktopBadges = Partial<Record<DesktopAppId, number | null>>;

/** The wired apps in dock order; an app with no content is left out, never shown empty. */
export function desktopApps(contents: DesktopContents, badges: DesktopBadges = {}): DesktopApp[] {
  return desktopAppIds.flatMap((id) => {
    const content = contents[id];
    if (content === undefined || content === null) return [];
    const badge = badges[id];
    return [{ id, ...desktopAppLooks[id], content, ...(badge ? { badge } : {}) }];
  });
}

export function hasDesktopApp(apps: readonly DesktopApp[], id: string): boolean {
  return apps.some((app) => app.id === id);
}
