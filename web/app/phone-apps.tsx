"use client";

import type { Skill } from "@/features/agents/skills";
import { StandaloneMessagesPage } from "@/features/messages/standalone-messages-page";
import { Navigator } from "@/features/navigator/navigator";
import type { NavigatorController } from "@/features/navigator/use-navigator";
import type { PhoneApp } from "@/features/phone/phone";
import { SettingsApp } from "@/features/phone/settings-app";
import { openReport } from "@/features/report/open-report";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { AppIcon } from "@/infrastructure/ui/app-icons";
import { type AgentsInput, agentsApp } from "./office-apps";

type PhoneAppsInput = AgentsInput & {
  /** The same controller as the desk's Navigator, so a search survives closing the phone. */
  navigator: NavigatorController;
  fixtureMode: boolean;
  onShowOnMap: (response: SearchResponse) => void;
  /** Opens another app inside the phone, as "Try" on a skill does. */
  onOpenApp: (appId: string) => void;
};

// The phone's apps: the same Messages and Agents as the desk, each real; nothing is a placeholder.
export function phoneApps({
  navigator,
  fixtureMode,
  onShowOnMap,
  onOpenApp,
  ...agents
}: PhoneAppsInput): PhoneApp[] {
  // Every skill starts from Ask on the phone: a report is made from an answer there.
  function trySkill(skill: Skill) {
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
        />
      ),
    },
    {
      id: "messages",
      label: "Messages",
      icon: <AppIcon app="messages" />,
      tile: "#1d6fd6",
      content: <StandaloneMessagesPage />,
    },
    {
      id: "agents",
      label: "Agents",
      icon: <AppIcon app="agents" />,
      tile: "#6d4bd8",
      content: agentsApp(agents, trySkill),
    },
    {
      id: "settings",
      label: "Settings",
      icon: <AppIcon app="settings" />,
      tile: "#475569",
      content: <SettingsApp />,
    },
  ];
}
