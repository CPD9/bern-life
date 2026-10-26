"use client";

import { type ReactNode, useState } from "react";
import type { AccountState } from "@/features/accounts/use-account";
import { AdminApp } from "@/features/admin/admin-app";
import { AgentsApp } from "@/features/agents/agents-app";
import type { AgentNotice } from "@/features/agents/loops";
import type { Skill } from "@/features/agents/skills";
import { type DesktopApp, desktopApps } from "@/features/desktop/desktop-apps";
import type { DesktopController } from "@/features/desktop/use-desktop";
import type { StartWith } from "@/features/messages/messages-app";
import { StandaloneMessagesPage } from "@/features/messages/standalone-messages-page";
import { notificationStore } from "@/features/notifications/use-notifications";
import { Navigator } from "@/features/navigator/navigator";
import type { NavigatorApi } from "@/features/navigator/navigator-api";
import type { NavigatorController } from "@/features/navigator/use-navigator";
import type { PhoneHealth } from "@/features/phone/phone";
import type { LibraryStore } from "@/features/library/library-store";
import { SettingsApp } from "@/features/phone/settings-app";
import { browserReportDeps, openReport } from "@/features/report/open-report";
import { ReportsApp } from "@/features/report/reports-app";
import { SourcesApp } from "@/features/sources/sources-app";
import { type AppEventSink, appEvents } from "@/infrastructure/app-events";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import type { NumbersApi } from "@/infrastructure/numbers-api";
import { loopSearch } from "./loop-search";
import { garageApp, libraryApp, opportunitiesApp, saveSlot } from "./shared-apps";

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
  /** Where the skills' measured rows come from; the engine's /api/numbers when absent. */
  numbersApi?: NumbersApi;
};

/** The one Agents app, on the phone and at the desk: the same loops, search, notifications and
 *  skill evidence. Only where "Try" goes differs, since each place opens its own Navigator. */
export function agentsApp(
  { navigatorApi, agentName, snapshot, notify, numbersApi }: AgentsInput,
  fixtureMode: boolean,
  onTrySkill: (skill: Skill) => void,
): ReactNode {
  return (
    <AgentsApp
      agent={{ name: agentName }}
      search={loopSearch(navigatorApi)}
      onTrySkill={onTrySkill}
      notify={notify}
      snapshot={snapshot}
      fixtureMode={fixtureMode}
      {...(numbersApi ? { numbers: numbersApi } : {})}
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
  library?: LibraryStore;
  /** The Connections app, composed for the desk; left out, it is not on the dock. */
  connections?: ReactNode;
  /** A thread to open in Messages, as "Message" on a member asks, and when it was opened. */
  messageWith?: StartWith | undefined;
  onMessageStarted?: () => void;
  /** The Admin app, from adminApp(); left out, it is not on the dock. */
  admin?: ReactNode;
};

/** The Admin app for an account with the admin role; anyone else gets no dock button for it. */
export function adminApp(account: AccountState, fixtureMode: boolean): ReactNode | undefined {
  if (account.status !== "signed-in" || account.user.role !== "admin") return undefined;
  return <AdminApp fixtureMode={fixtureMode} />;
}

export type OfficeApps = {
  apps: DesktopApp[];
  /** Saves an answer as a match report and shows it in the Reports window. */
  makeReport: (response: SearchResponse) => boolean;
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
  library,
  connections,
  messageWith,
  onMessageStarted,
  admin,
  ...agents
}: OfficeAppsInput): OfficeApps {
  const save = { fixtureMode, events, library };
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

  // Search and Checks the premise both start from a search in the Navigator.
  function trySkill(skill: Skill) {
    if (skill.id === "brief") openNavigator("brief");
    else if (skill.id === "report") desktop.open("reports");
    else if (skill.id === "opportunities") desktop.open("opportunities");
    else openNavigator("search");
  }

  const apps = desktopApps(
    {
      navigator: (
        <Navigator
          controller={navigator}
          fixtureMode={fixtureMode}
          onMakeReport={makeReport}
          {...saveSlot(save)}
        />
      ),
      agents: agentsApp(agents, fixtureMode, trySkill),
      reports: (
        <ReportsApp
          selectedId={reportId}
          onSelect={setReportId}
          onAsk={() => openNavigator("search")}
        />
      ),
      messages: <StandaloneMessagesPage startWith={messageWith} onStarted={onMessageStarted} />,
      connections,
      library: libraryApp(library),
      opportunities: opportunitiesApp(save),
      garage: garageApp(fixtureMode, events, agents.numbersApi),
      sources: <SourcesApp fixtureMode={fixtureMode} />,
      admin,
      settings: <SettingsApp health={health} />,
    },
    { messages: unreadMessages },
  );
  return { apps, makeReport };
}
