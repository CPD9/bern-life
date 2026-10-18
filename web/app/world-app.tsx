"use client";

import { useState } from "react";
import { httpNavigatorApi } from "@/features/navigator/navigator-api";
import { Navigator } from "@/features/navigator/navigator";
import { useNavigator } from "@/features/navigator/use-navigator";
import { AppIcon } from "@/features/phone/app-icons";
import { ComingNext, comingNextText } from "@/features/phone/coming-next";
import { type PhoneApp, Phone } from "@/features/phone/phone";
import { SettingsApp } from "@/features/phone/settings-app";
import { openReport } from "@/features/report/open-report";
import { GameShell, type WorldView } from "@/features/shell/game-shell";
import { Hud } from "@/features/shell/hud";
import { useHealth } from "@/features/shell/use-health";
import { CriteriaChecklist } from "@/features/story/criteria-checklist";
import { QuestPanel } from "@/features/story/quest-panel";
import type { ShowMeTarget } from "@/features/story/show-me";
import { StoryMenu } from "@/features/story/story-menu";
import { StoryStart } from "@/features/story/story-start";
import { useStory } from "@/features/story/use-story";
import { WorldCanvas } from "@/features/world/world-canvas";
import { emittedToday } from "@/infrastructure/app-events";
import { useNow } from "@/infrastructure/bern-time";
import type { SearchResponse, Story } from "@/infrastructure/contract-types.generated";

// Composes the features. One Navigator controller lives here, above the phone, so a search
// survives closing the phone and the agent can drive the same instance.
type WorldAppProps = {
  fixtureMode: boolean;
  /** Under DEMO_FIXTURES the map starts lit with the world fixture; W4 replaces this with live search. */
  demoSearch: SearchResponse | undefined;
  story: Story;
  /** `?story=demo`: the jury's run, started straight away with the criteria checklist. */
  storyDemo: boolean;
};

export function WorldApp({ fixtureMode, demoSearch, story, storyDemo }: WorldAppProps) {
  const [view, setView] = useState<WorldView>("home");
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneApp, setPhoneApp] = useState<string | null>(null);
  const [storyMenuOpen, setStoryMenuOpen] = useState(false);
  const storyController = useStory({ story, demo: storyDemo, emitted: emittedToday });
  const navigator = useNavigator(httpNavigatorApi);
  const now = useNow();
  const health = useHealth();

  const apps: PhoneApp[] = [
    {
      id: "ask",
      label: "Ask",
      icon: <AppIcon app="ask" />,
      tile: "#13804a",
      content: (
        <Navigator
          controller={navigator}
          fixtureMode={fixtureMode}
          onMakeReport={(response) => openReport(response, fixtureMode)}
        />
      ),
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

  const { choice } = storyController.state;
  const current = storyController.progress.current;
  const goal = choice !== "story" ? "Explore" : current ? current.quest.title : "Open quests done";

  function showMe(target: ShowMeTarget) {
    if (target === "map") {
      setView("map");
      return;
    }
    setPhoneApp("ask");
    setPhoneOpen(true);
  }

  return (
    <GameShell
      view={view}
      phoneOpen={phoneOpen}
      onSelectTab={(tab) => (tab === "phone" ? setPhoneOpen(true) : setView(tab))}
      hud={<Hud now={now} health={health} goal={goal} />}
      side={
        <>
          {choice === null && <StoryStart controller={storyController} />}
          {choice === "story" && (
            <QuestPanel
              controller={storyController}
              onShowMe={showMe}
              onOpenMenu={() => setStoryMenuOpen(true)}
            />
          )}
          {storyDemo && <CriteriaChecklist controller={storyController} />}
        </>
      }
      canvas={<WorldCanvas demoSearch={demoSearch} />}
      overlay={
        <>
          <Phone
            open={phoneOpen}
            onClose={() => setPhoneOpen(false)}
            apps={apps}
            appId={phoneApp}
            onAppChange={setPhoneApp}
            now={now}
          />
          <StoryMenu
            controller={storyController}
            open={storyMenuOpen}
            onClose={() => setStoryMenuOpen(false)}
          />
        </>
      }
    />
  );
}
