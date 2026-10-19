"use client";

import type { ReactNode } from "react";
import type { Skill } from "@/features/agents/skills";
import { CaseStepApp } from "@/features/case/case-step-app";
import { caseStepAppId, caseSteps } from "@/features/case/case-steps";
import type { StartWith } from "@/features/messages/messages-app";
import { StandaloneMessagesPage } from "@/features/messages/standalone-messages-page";
import { Navigator } from "@/features/navigator/navigator";
import type { NavigatorController } from "@/features/navigator/use-navigator";
import type { LibraryStore } from "@/features/library/library-store";
import type { PhoneApp, PhoneHealth } from "@/features/phone/phone";
import { SettingsApp } from "@/features/phone/settings-app";
import { openReport } from "@/features/report/open-report";
import { SourcesApp } from "@/features/sources/sources-app";
import { type AppEventSink, appEvents } from "@/infrastructure/app-events";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { AppIcon } from "@/infrastructure/ui/app-icons";
import { type AgentsInput, agentsApp } from "./office-apps";
import { libraryApp, opportunitiesApp, saveSlot } from "./shared-apps";

type PhoneAppsInput = AgentsInput & {
  /** The same controller as the desk's Navigator, so a search survives closing the phone. */
  navigator: NavigatorController;
  fixtureMode: boolean;
  /** Shows an answer on the map; absent when the map cannot be drawn. */
  onShowOnMap?: ((response: SearchResponse) => void) | undefined;
  /** Opens another app inside the phone, as "Try" on a skill does. */
  onOpenApp: (appId: string) => void;
  /** A badge on Messages; none when signed out or unknown. */
  unreadMessages?: number | null;
  /** The engine's state for Settings' "About & data sources"; none while unknown. */
  health?: PhoneHealth | undefined;
  /** Where saves report to the story. */
  events?: AppEventSink;
  library?: LibraryStore;
  /** The Connections app, composed for the phone; left out, it is not on the phone. */
  connections?: ReactNode;
  /** A thread to open in Messages, as "Message" on a member asks, and when it was opened. */
  messageWith?: StartWith | undefined;
  onMessageStarted?: () => void;
};

/** The heading over the seven case steps on the home screen. */
export const caseGroup = "The case, step by step";

// The phone's apps: the same apps as the desk, fewer of them, each real; nothing is a placeholder.
// After them, the case's seven steps, one app each, grouped on the home screen.
export function phoneApps({
  navigator,
  fixtureMode,
  onShowOnMap,
  onOpenApp,
  unreadMessages = null,
  health,
  events = appEvents,
  library,
  connections,
  messageWith,
  onMessageStarted,
  ...agents
}: PhoneAppsInput): PhoneApp[] {
  const save = { fixtureMode, events, library };
  // Opportunities has its own app; every other skill starts from Ask, where a report is made too,
  // and all but the brief in search mode.
  // A step's question goes to the same Ask as a typed one, so Ask opens with it running.
  function askFromStep(query: string) {
    navigator.setInputMode("search");
    navigator.search({ query });
    onOpenApp("ask");
  }

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
          {...saveSlot(save)}
        />
      ),
    },
    {
      id: "messages",
      label: "Messages",
      icon: <AppIcon app="messages" />,
      tile: "#1d6fd6",
      content: <StandaloneMessagesPage startWith={messageWith} onStarted={onMessageStarted} />,
      ...(unreadMessages ? { badge: unreadMessages } : {}),
    },
    ...(connections
      ? [
          {
            id: "connections",
            label: "Connections",
            icon: <AppIcon app="connections" />,
            tile: "#be185d",
            content: connections,
          },
        ]
      : []),
    {
      id: "agents",
      label: "Agents",
      icon: <AppIcon app="agents" />,
      tile: "#6d4bd8",
      content: agentsApp(agents, fixtureMode, trySkill),
    },
    {
      id: "opportunities",
      label: "Opportunities",
      icon: <AppIcon app="opportunities" />,
      tile: "#b45309",
      content: opportunitiesApp(save),
    },
    {
      id: "library",
      label: "Library",
      icon: <AppIcon app="library" />,
      tile: "#9a3412",
      content: libraryApp(library),
    },
    {
      id: "sources",
      label: "Sources",
      icon: <AppIcon app="sources" />,
      tile: "#0f766e",
      content: <SourcesApp fixtureMode={fixtureMode} />,
    },
    {
      id: "settings",
      label: "Settings",
      icon: <AppIcon app="settings" />,
      tile: "#475569",
      content: <SettingsApp health={health} />,
    },
    ...caseSteps.map((step) => ({
      id: caseStepAppId(step),
      label: step.label,
      icon: <span className="text-2xl font-extrabold">{step.number}</span>,
      tile: "#0e7490",
      group: caseGroup,
      content: (
        <CaseStepApp
          step={step}
          fixtureMode={fixtureMode}
          onAsk={askFromStep}
          onOpenApp={onOpenApp}
          {...(agents.numbersApi ? { api: agents.numbersApi } : {})}
        />
      ),
    })),
  ];
}
