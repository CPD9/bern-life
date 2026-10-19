"use client";

import { type ReactNode, useState } from "react";
import { AgentsApp } from "@/features/agents/agents-app";
import type { AgentNotice } from "@/features/agents/loops";
import type { Skill } from "@/features/agents/skills";
import { type DesktopApp, desktopApps } from "@/features/desktop/desktop-apps";
import type { DesktopController } from "@/features/desktop/use-desktop";
import { StandaloneMessagesPage } from "@/features/messages/standalone-messages-page";
import { notificationStore } from "@/features/notifications/use-notifications";
import { Navigator } from "@/features/navigator/navigator";
import type { NavigatorApi } from "@/features/navigator/navigator-api";
import type { NavigatorController } from "@/features/navigator/use-navigator";
import type { PhoneHealth } from "@/features/phone/phone";
import { SettingsApp } from "@/features/phone/settings-app";
import { browserReportDeps, openReport } from "@/features/report/open-report";
import { ReportsApp } from "@/features/report/reports-app";
import { SourcesApp } from "@/features/sources/sources-app";
import { type AppEventSink, appEvents } from "@/infrastructure/app-events";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { garageApp, libraryApp, opportunitiesApp, saveControl } from "./shared-apps";

/** A loop's news goes to the same store as the bell and the toasts. */
export function notifyLoop(notice: AgentNotice): void {
  notificationStore().notify({ kind: "loop", ...notice });
}

export type AgentsInput = {
  /** The engine call behind the Navigator; the agent's loops search through it too. */
  navigatorApi: NavigatorApi;
  agentName: string;
  /** The snapshot the engine serves, from health; null while unknown. */
  snapshot: string | null;
  notify: (notice: AgentNotice) => void;
};

/** The one Agents app, on the phone and at the desk: the same loops, search and notifications.
 *  Only where "Try" goes differs, since each place opens its own Navigator. */
export function agentsApp(
  { navigatorApi, agentName, snapshot, notify }: AgentsInput,
  onTrySkill: (skill: Skill) => void,
): ReactNode {
  async function search(query: string): Promise<SearchResponse | null> {
    const outcome = await navigatorApi.search({ query });
    return outcome.ok ? outcome.response : null;
  }
  return (
    <AgentsApp
      agent={{ name: agentName }}
      search={search}
      onTrySkill={onTrySkill}
      notify={notify}
      snapshot={snapshot}
    />
  );
}

type OfficeAppsInput = AgentsInput & {
  /** The same controller as the phone's Ask, so a search follows you to the desk. */
  navigator: NavigatorController;
  desktop: DesktopController;
  fixtureMode: boolean;
  /** Unread messages for the dock; null when signed out or unknown. */
  unreadMessages?: number | null;
  /** The engine's state for Settings' "About & data sources"; none while unknown. */
  health?: PhoneHealth | undefined;
  /** Where saves and garage visits report to the story. */
  events?: AppEventSink;
};

// Composes the office computer from the features. Only real apps are passed in, so the dock lists
// nothing empty.
export function useOfficeApps({
  navigator,
  desktop,
  fixtureMode,
  unreadMessages = null,
  health,
  events = appEvents,
  ...agents
}: OfficeAppsInput): DesktopApp[] {
  const [reportId, setReportId] = useState<string | null>(null);

  function openNavigator(mode: "search" | "brief") {
    navigator.setInputMode(mode);
    desktop.open("navigator");
  }

  function makeReport(response: SearchResponse): boolean {
    return openReport(response, fixtureMode, {
      ...browserReportDeps,
      open: (id) => {
        setReportId(id);
        desktop.open("reports");
      },
    });
  }

  function trySkill(skill: Skill) {
    if (skill.id === "brief") openNavigator("brief");
    else if (skill.id === "report") desktop.open("reports");
    else if (skill.id === "opportunities") desktop.open("opportunities");
    else openNavigator("search");
  }

  return desktopApps(
    {
      navigator: (
        <Navigator
          controller={navigator}
          fixtureMode={fixtureMode}
          onMakeReport={makeReport}
          renderSave={saveControl(events, fixtureMode)}
        />
      ),
      agents: agentsApp(agents, trySkill),
      reports: (
        <ReportsApp
          selectedId={reportId}
          onSelect={setReportId}
          onAsk={() => openNavigator("search")}
        />
      ),
      messages: <StandaloneMessagesPage />,
      library: libraryApp(),
      opportunities: opportunitiesApp(fixtureMode, events),
      garage: garageApp(fixtureMode, events),
      sources: <SourcesApp fixtureMode={fixtureMode} />,
      settings: <SettingsApp health={health} />,
    },
    { messages: unreadMessages },
  );
}
