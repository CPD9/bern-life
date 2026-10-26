"use client";

import type { ReactNode } from "react";
import type { DesktopController } from "@/features/desktop/use-desktop";
import type { StartWith } from "@/features/messages/messages-app";
import { httpNavigatorApi } from "@/features/navigator/navigator-api";
import type { NavigatorController } from "@/features/navigator/use-navigator";
import type { HealthState } from "@/features/shell/use-health";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { notifyLoop, useOfficeApps } from "./office-apps";
import { phoneApps } from "./phone-apps";
import { type ConnectionsWiring, connectionsApp } from "./world-connections";

type WorldAppsInput = {
  navigator: NavigatorController;
  desktop: DesktopController;
  fixtureMode: boolean;
  agentName: string;
  health: HealthState;
  unreadMessages: number | null;
  /** Shows an answer on the map; absent when the map cannot be drawn. */
  onShowOnMap: ((response: SearchResponse) => void) | undefined;
  onOpenApp: (appId: string) => void;
  connections: ConnectionsWiring;
  messageWith: StartWith | undefined;
  onMessageStarted: () => void;
  /** "Message" on a member, from the phone or the desk: opens Messages there with that handle. */
  onMessageFrom: (place: "phone" | "desk") => (handle: string) => void;
  /** The Admin app for the desk, from adminApp(); undefined for anyone but an admin. */
  admin: ReactNode | undefined;
};

/** The desk's apps and the phone's, sharing one Navigator, one agent, one unread count and one
 *  Connections controller. */
export function useWorldApps({
  navigator,
  desktop,
  fixtureMode,
  agentName,
  health,
  unreadMessages,
  onShowOnMap,
  onOpenApp,
  connections,
  messageWith,
  onMessageStarted,
  onMessageFrom,
  admin,
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
    messageWith,
    onMessageStarted,
  };
  const office = useOfficeApps({
    ...shared,
    desktop,
    connections: connectionsApp(connections, onMessageFrom("desk")),
    admin,
  });
  return {
    office: office.apps,
    /** Saves an answer as a match report and selects it in the desk's Reports window. */
    makeDeskReport: office.makeReport,
    phone: phoneApps({
      ...shared,
      onShowOnMap,
      onOpenApp,
      connections: connectionsApp(connections, onMessageFrom("phone")),
    }),
  };
}
