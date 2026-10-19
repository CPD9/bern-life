"use client";

import type { Skill } from "@/features/agents/skills";
import { StandaloneMessagesPage } from "@/features/messages/standalone-messages-page";
import { Navigator } from "@/features/navigator/navigator";
import type { NavigatorController } from "@/features/navigator/use-navigator";
import type { PhoneApp, PhoneHealth } from "@/features/phone/phone";
import { SettingsApp } from "@/features/phone/settings-app";
import { openReport } from "@/features/report/open-report";
import { type AppEventSink, appEvents } from "@/infrastructure/app-events";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { AppIcon } from "@/infrastructure/ui/app-icons";
import { type AgentsInput, agentsApp } from "./office-apps";
import { libraryApp, opportunitiesApp, saveControl } from "./shared-apps";

type PhoneAppsInput = AgentsInput & {
  /** The same controller as the desk's Navigator, so a search survives closing the phone. */
  navigator: NavigatorController;
  fixtureMode: boolean;
  onShowOnMap: (response: SearchResponse) => void;
  /** Opens another app inside the phone, as "Try" on a skill does. */
  onOpenApp: (appId: string) => void;
  /** A badge on Messages; none when signed out or unknown. */
  unreadMessages?: number | null;
  /** The engine's state for Settings' "About & data sources"; none while unknown. */
  health?: PhoneHealth | undefined;
  /** Where saves report to the story. */
  events?: AppEventSink;
};

// The phone's apps: the same apps as the desk, fewer of them, each real; nothing is a placeholder.
export function phoneApps({
  navigator,
  fixtureMode,
  onShowOnMap,
  onOpenApp,
  unreadMessages = null,
  health,
  events = appEvents,
  ...agents
}: PhoneAppsInput): PhoneApp[] {
  // Opportunities has its own app; every other skill starts from Ask, where a report is made too.
  function trySkill(skill: Skill) {
    if (skill.id === "opportunities") {
      onOpenApp("opportunities");
      return;
    }
    navigator.setInputMode(skill.id === "brief" ? "brief" : "search");
    onOpenApp("ask");
  }

  return [
    {
      id: "ask",
      label: "Ask",
      icon: <AppIcon app="ask" />,
      tile: "#13804a",
      content: (
        <Navigator
          controller={navigator}
          fixtureMode={fixtureMode}
          onShowOnMap={onShowOnMap}
          onMakeReport={(response) => openReport(response, fixtureMode)}
          renderSave={saveControl(events)}
        />
      ),
    },
    {
      id: "messages",
      label: "Messages",
      icon: <AppIcon app="messages" />,
      tile: "#1d6fd6",
      content: <StandaloneMessagesPage />,
      ...(unreadMessages ? { badge: unreadMessages } : {}),
    },
    {
      id: "agents",
      label: "Agents",
      icon: <AppIcon app="agents" />,
      tile: "#6d4bd8",
      content: agentsApp(agents, trySkill),
    },
    {
      id: "opportunities",
      label: "Opportunities",
      icon: <AppIcon app="opportunities" />,
      tile: "#b45309",
      content: opportunitiesApp(fixtureMode, events),
    },
    {
      id: "library",
      label: "Library",
      icon: <AppIcon app="library" />,
      tile: "#9a3412",
      content: libraryApp(),
    },
    {
      id: "settings",
      label: "Settings",
      icon: <AppIcon app="settings" />,
      tile: "#475569",
      content: <SettingsApp health={health} />,
    },
  ];
}
