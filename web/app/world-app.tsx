"use client";

import { useState } from "react";
import { httpAccountApi } from "@/features/accounts/account-api";
import { useAccount } from "@/features/accounts/use-account";
import { type BearConfig, furOptions } from "@/features/avatar/bear-config";
import { useAvatar } from "@/features/avatar/use-avatar";
import { httpNavigatorApi } from "@/features/navigator/navigator-api";
import { Navigator } from "@/features/navigator/navigator";
import { useNavigator } from "@/features/navigator/use-navigator";
import { useOnboarding } from "@/features/onboarding/use-onboarding";
import { comingNextText } from "@/features/phone/coming-next-text";
import { type PhoneApp, Phone } from "@/features/phone/phone";
import { SettingsApp } from "@/features/phone/settings-app";
import { openReport } from "@/features/report/open-report";
import type { HudAccount } from "@/features/shell/account-badge";
import { firstRunCard } from "@/features/shell/first-run";
import { GameShell, type WorldView } from "@/features/shell/game-shell";
import { GuideGreeting } from "@/features/shell/guide-greeting";
import { Hud } from "@/features/shell/hud";
import { JoinPrompt, OnboardingPrompt } from "@/features/shell/journey-prompts";
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
import { AppIcon } from "@/infrastructure/ui/app-icons";
import { ComingNext } from "@/infrastructure/ui/coming-next";

// The badge reads the colour from the stored bear on each render, so there is no second copy.
function furColourOf(bear: BearConfig): string {
  const shades = furOptions(bear.kind);
  const shade = shades.find((candidate) => candidate.id === bear.fur) ?? shades[0];
  if (!shade) throw new Error(`bear kind ${bear.kind} has no fur shades`);
  return shade.colour;
}

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
  const account = useAccount(httpAccountApi);
  const [avatar] = useAvatar();
  const [onboarding] = useOnboarding();
  const [greetingDismissed, setGreetingDismissed] = useState(false);
  const [joinDismissed, setJoinDismissed] = useState(false);
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
  const card = firstRunCard({
    account: account.state.status,
    onboarded: onboarding.done,
    storyChoice: choice,
    actedAlready: storyController.state.done.length > 0,
    greetingDismissed,
    joinDismissed,
  });
  const furColour = furColourOf(avatar);
  const hudAccount: HudAccount =
    account.state.status === "signed-in"
      ? { status: "signed-in", handle: account.state.user.handle, colour: furColour }
      : { status: account.state.status };
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
      hud={<Hud now={now} health={health} goal={goal} account={hudAccount} />}
      side={
        <>
          {card === "greeting" && <GuideGreeting onDismiss={() => setGreetingDismissed(true)} />}
          {card === "join" && <JoinPrompt onNotNow={() => setJoinDismissed(true)} />}
          {card === "onboarding" && <OnboardingPrompt />}
          {card === "story-start" && <StoryStart controller={storyController} />}
          {card === "quest" && (
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
