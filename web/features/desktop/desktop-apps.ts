// The office computer's apps, in dock order. Every app has a sentence saying what it does, shown
// as its "coming next" sheet until the app is wired, so an unready app is never a blank window.
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

export const desktopComingNext: Record<DesktopAppId, string> = {
  navigator:
    "Ask in your words or bring a project brief, and get Bern experts with the sentence that proves each match.",
  agents: "Lumi and the agents, with the tools they use for you.",
  reports: "Your match reports, kept with their sources.",
  messages: "Write to people who joined Bern Life and to your lab.",
  library:
    "Keep profiles, projects, pages and your own documents here, each with its trace: where it came from and when.",
  opportunities:
    "Funding calls, services and spaces in Bern, each with the page it comes from. Save the ones that fit your business.",
  garage:
    "Meet the Apertus models behind the Navigator, with the numbers we measured, not the ones we hoped for.",
  settings: "Night mode, lite graphics and data saver.",
};

export type DesktopApp = {
  readonly id: DesktopAppId;
  readonly label: string;
  readonly icon: AppIconName;
  readonly tile: string;
  /** null: the app is not wired yet and shows its coming-next sheet. */
  readonly content: ReactNode | null;
};

export function desktopApps(contents: Partial<Record<DesktopAppId, ReactNode>>): DesktopApp[] {
  return desktopAppIds.map((id) => ({ id, ...desktopAppLooks[id], content: contents[id] ?? null }));
}
