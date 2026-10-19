"use client";

import { DesktopSurface } from "@/features/desktop/desktop";
import { useDesktop } from "@/features/desktop/use-desktop";
import { httpNavigatorApi } from "@/features/navigator/navigator-api";
import { useNavigator } from "@/features/navigator/use-navigator";
import { useAgentName } from "@/features/avatar/use-person";
import { useHealth } from "@/features/shell/use-health";
import { useNow } from "@/infrastructure/bern-time";
import { notifyLoop, useOfficeApps } from "../office-apps";

export function OfficeApp({ fixtureMode }: { fixtureMode: boolean }) {
  const navigator = useNavigator(httpNavigatorApi);
  const desktop = useDesktop();
  const [agentName] = useAgentName();
  const health = useHealth();
  const apps = useOfficeApps({
    navigator,
    navigatorApi: httpNavigatorApi,
    desktop,
    fixtureMode,
    agentName,
    snapshot: health?.snapshot ?? null,
    notify: notifyLoop,
  });
  const now = useNow();
  return <DesktopSurface apps={apps} controller={desktop} now={now} />;
}
