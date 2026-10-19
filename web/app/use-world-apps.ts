"use client";

import type { DesktopController } from "@/features/desktop/use-desktop";
import { httpNavigatorApi } from "@/features/navigator/navigator-api";
import type { NavigatorController } from "@/features/navigator/use-navigator";
import type { HealthState } from "@/features/shell/use-health";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { notifyLoop, useOfficeApps } from "./office-apps";
import { phoneApps } from "./phone-apps";

type WorldAppsInput = {
  navigator: NavigatorController;
  desktop: DesktopController;
  fixtureMode: boolean;
  agentName: string;
  health: HealthState;
  unreadMessages: number | null;
  onShowOnMap: (response: SearchResponse) => void;
  onOpenApp: (appId: string) => void;
};

/** The desk's apps and the phone's, sharing one Navigator, one agent and one unread count. */
export function useWorldApps({
  navigator,
  desktop,
  fixtureMode,
  agentName,
  health,
  unreadMessages,
  onShowOnMap,
  onOpenApp,
}: WorldAppsInput) {
  const shared = {
    navigatorApi: httpNavigatorApi,
    agentName,
    snapshot: health.status === "ok" ? health.health.snapshot : null,
    notify: notifyLoop,
    navigator,
    fixtureMode,
    unreadMessages,
    health,
  };
  return {
    office: useOfficeApps({ ...shared, desktop }),
    phone: phoneApps({ ...shared, onShowOnMap, onOpenApp }),
  };
}
