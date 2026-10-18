"use client";

import { useState } from "react";
import { AgentsApp, type SkillId } from "@/features/agents/agents-app";
import { type DesktopApp, desktopApps } from "@/features/desktop/desktop-apps";
import type { DesktopController } from "@/features/desktop/use-desktop";
import { StandaloneMessagesPage } from "@/features/messages/standalone-messages-page";
import { Navigator } from "@/features/navigator/navigator";
import type { NavigatorController } from "@/features/navigator/use-navigator";
import { SettingsApp } from "@/features/phone/settings-app";
import { browserReportDeps, openReport } from "@/features/report/open-report";
import { ReportsApp } from "@/features/report/reports-app";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";

type OfficeAppsInput = {
  /** The same controller as the phone's Ask, so a search follows you to the desk. */
  navigator: NavigatorController;
  desktop: DesktopController;
  fixtureMode: boolean;
};

// Composes the office computer from the features; Library, Opportunities and Garage are not wired
// yet and show their coming-next sheets.
export function useOfficeApps({ navigator, desktop, fixtureMode }: OfficeAppsInput): DesktopApp[] {
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

  function trySkill(skill: SkillId) {
    if (skill === "report") desktop.open("reports");
    else openNavigator(skill);
  }

  return desktopApps({
    navigator: (
      <Navigator controller={navigator} fixtureMode={fixtureMode} onMakeReport={makeReport} />
    ),
    agents: <AgentsApp onTry={trySkill} />,
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
