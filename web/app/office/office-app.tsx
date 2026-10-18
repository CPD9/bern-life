"use client";

import { DesktopSurface } from "@/features/desktop/desktop";
import { useDesktop } from "@/features/desktop/use-desktop";
import { httpNavigatorApi } from "@/features/navigator/navigator-api";
import { useNavigator } from "@/features/navigator/use-navigator";
import { useNow } from "@/infrastructure/bern-time";
import { useOfficeApps } from "../office-apps";

export function OfficeApp({ fixtureMode }: { fixtureMode: boolean }) {
  const navigator = useNavigator(httpNavigatorApi);
  const desktop = useDesktop();
  const apps = useOfficeApps({ navigator, desktop, fixtureMode });
  const now = useNow();
  return <DesktopSurface apps={apps} controller={desktop} now={now} />;
}
