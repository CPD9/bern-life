"use client";

import { useState } from "react";
import { httpNavigatorApi } from "@/features/navigator/navigator-api";
import { Navigator } from "@/features/navigator/navigator";
import { useNavigator } from "@/features/navigator/use-navigator";
import { AppIcon } from "@/features/phone/app-icons";
import { ComingNext, comingNextText } from "@/features/phone/coming-next";
import { type PhoneApp, Phone } from "@/features/phone/phone";
import { SettingsApp } from "@/features/phone/settings-app";
import { GameShell, type WorldView } from "@/features/shell/game-shell";
import { Hud } from "@/features/shell/hud";
import { useHealth } from "@/features/shell/use-health";
import { WorldCanvas } from "@/features/world/world-canvas";
import { useNow } from "@/infrastructure/bern-time";

// Composes the features. One Navigator controller lives here, above the phone, so a search
// survives closing the phone and the agent can drive the same instance.
export function WorldApp({ fixtureMode }: { fixtureMode: boolean }) {
  const [view, setView] = useState<WorldView>("home");
  const [phoneOpen, setPhoneOpen] = useState(false);
  const navigator = useNavigator(httpNavigatorApi);
  const now = useNow();
  const health = useHealth();

  const apps: PhoneApp[] = [
    {
      id: "ask",
      label: "Ask",
      icon: <AppIcon app="ask" />,
      tile: "#13804a",
      content: <Navigator controller={navigator} fixtureMode={fixtureMode} />,
    },
    {
      id: "messages",
      label: "Messages",
      icon: <AppIcon app="messages" />,
      tile: "#1d6fd6",
      content: <ComingNext text={comingNextText.messages} />,
    },
    {
      id: "agents",
      label: "Agents",
      icon: <AppIcon app="agents" />,
      tile: "#6d4bd8",
      content: <ComingNext text={comingNextText.agents} />,
    },
    {
      id: "projects",
      label: "Projects & calls",
      icon: <AppIcon app="projects" />,
      tile: "#b45309",
      content: <ComingNext text={comingNextText.projects} />,
    },
    {
      id: "settings",
      label: "Settings",
      icon: <AppIcon app="settings" />,
      tile: "#475569",
      content: <SettingsApp />,
    },
  ];

  return (
    <GameShell
      view={view}
      phoneOpen={phoneOpen}
      onSelectTab={(tab) => (tab === "phone" ? setPhoneOpen(true) : setView(tab))}
      hud={<Hud now={now} health={health} goal="Explore" />}
      canvas={<WorldCanvas />}
      overlay={<Phone open={phoneOpen} onClose={() => setPhoneOpen(false)} apps={apps} now={now} />}
    />
  );
}
