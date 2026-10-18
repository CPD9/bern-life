"use client";

import { httpNavigatorApi } from "./navigator-api";
import { Navigator } from "./navigator";
import { useNavigator } from "./use-navigator";

export function StandaloneNavigator({ fixtureMode }: { fixtureMode: boolean }) {
  const controller = useNavigator(httpNavigatorApi);
  return <Navigator controller={controller} fixtureMode={fixtureMode} />;
}
