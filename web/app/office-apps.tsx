"use client";

import { useState } from "react";
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
import { SettingsApp } from "@/features/phone/settings-app";
import { browserReportDeps, openReport } from "@/features/report/open-report";
import { ReportsApp } from "@/features/report/reports-app";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import { loopSearch } from "./loop-search";

/** A loop's news goes to the same store as the bell and the toasts. */
export function notifyLoop(notice: AgentNotice): void {
  notificationStore().notify({ kind: "loop", ...notice });
}

type OfficeAppsInput = {
  /** The same controller as the phone's Ask, so a search follows you to the desk. */
  navigator: NavigatorController;
  /** The engine call behind that Navigator; the agent's loops search through it too. */
  navigatorApi: NavigatorApi;
  desktop: DesktopController;
  fixtureMode: boolean;
  agentName: string;
  /** The snapshot the engine serves, from health; null while unknown. */
  snapshot: string | null;
  notify: (notice: AgentNotice) => void;
};

// Composes the office computer from the features; Library, Opportunities and Garage are not wired
// yet and show their coming-next sheets, which is also where Try on "Find opportunities" lands.
export function useOfficeApps({
  navigator,
  navigatorApi,
  desktop,
  fixtureMode,
  agentName,
  snapshot,
  notify,
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
    if (skill.id === "navigator") openNavigator("search");
    else if (skill.id === "brief") openNavigator("brief");
    else desktop.open(skill.id === "report" ? "reports" : "opportunities");
  }

  return desktopApps({
    navigator: (
      <Navigator controller={navigator} fixtureMode={fixtureMode} onMakeReport={makeReport} />
    ),
    agents: (
      <AgentsApp
        agent={{ name: agentName }}
        search={loopSearch(navigatorApi)}
        onTrySkill={trySkill}
        notify={notify}
        snapshot={snapshot}
      />
    ),
    reports: (
      <ReportsApp
        selectedId={reportId}
        onSelect={setReportId}
        onAsk={() => openNavigator("search")}
      />
    ),
    messages: <StandaloneMessagesPage />,
    settings: <SettingsApp />,
  });
}
