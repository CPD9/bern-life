"use client";

import { httpNavigatorApi } from "@/features/navigator/navigator-api";
import { Navigator } from "@/features/navigator/navigator";
import { useNavigator } from "@/features/navigator/use-navigator";
import { openReport } from "@/features/report/open-report";

export function NavigatorApp({ fixtureMode }: { fixtureMode: boolean }) {
  const controller = useNavigator(httpNavigatorApi);
  return (
    <Navigator
      controller={controller}
      fixtureMode={fixtureMode}
      onMakeReport={(response) => openReport(response, fixtureMode)}
    />
  );
}
