"use client";

import { useEffect, useState } from "react";
import { httpAccountApi } from "@/features/accounts/account-api";
import { useAccount } from "@/features/accounts/use-account";
import { shownAgentName } from "@/features/avatar/agent-name";
import { BearFigure } from "@/features/avatar/bear-figure";
import { personBadgeColour } from "@/features/avatar/person-config";
import { useAvatar } from "@/features/avatar/use-avatar";
import { PersonFigure } from "@/features/avatar/person-figure";
import { useAgentName, usePerson } from "@/features/avatar/use-person";
import { DesktopDialog } from "@/features/desktop/desktop";
import { useDesktop } from "@/features/desktop/use-desktop";
import { httpNavigatorApi } from "@/features/navigator/navigator-api";
import { Navigator } from "@/features/navigator/navigator";
import { useNavigator } from "@/features/navigator/use-navigator";
import { NotificationBell } from "@/features/notifications/notification-bell";
import { Toasts } from "@/features/notifications/toasts";
import { notificationStore } from "@/features/notifications/use-notifications";
import { OfficeView } from "@/features/office/office-view";
import { useOnboarding } from "@/features/onboarding/use-onboarding";
import { comingNextText } from "@/features/phone/coming-next-text";
import { type PhoneApp, Phone } from "@/features/phone/phone";
import { SettingsApp } from "@/features/phone/settings-app";
import { openReport } from "@/features/report/open-report";
import type { HudAccount } from "@/features/shell/account-badge";
import { firstRunCard, landingView } from "@/features/shell/first-run";
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
import type { Building } from "@/features/world/buildings";
import { WorldCanvas } from "@/features/world/world-canvas";
import { YouSheet } from "@/features/you/you-sheet";
import { worldSearch } from "@/features/world/world-search";
import { emittedToday } from "@/infrastructure/app-events";
import { useNow } from "@/infrastructure/bern-time";
import { useReducedMotion } from "@/infrastructure/use-reduced-motion";
import { useSettings } from "@/infrastructure/use-settings";
import type { SearchResponse, Story } from "@/infrastructure/contract-types.generated";
import { AppIcon } from "@/infrastructure/ui/app-icons";
import { ComingNext } from "@/infrastructure/ui/coming-next";
import { notifyLoop, useOfficeApps } from "./office-apps";
import { applyWorldAction, searchHereDraft, worldActionFor } from "./world-search-bridge";

// Composes the features. One Navigator controller lives here, above the phone, so a search
// survives closing the phone and the agent can drive the same instance.
type WorldAppProps = {
  fixtureMode: boolean;
  /** Under DEMO_FIXTURES the map starts lit with the world fixture until the first question. */
  demoSearch: SearchResponse | undefined;
  story: Story;
  /** `?story=demo`: the jury's run, started straight away with the criteria checklist. */
  storyDemo: boolean;
};

export function WorldApp({ fixtureMode, demoSearch, story, storyDemo }: WorldAppProps) {
  // null until the player picks a tab: then the landing view follows onboarding (Home is the office).
  const [view, setView] = useState<WorldView | null>(null);
  const [phoneOpen, setPhoneOpen] = useState(false);
  const [phoneApp, setPhoneApp] = useState<string | null>(null);
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [youOpen, setYouOpen] = useState(false);
  const [storyMenuOpen, setStoryMenuOpen] = useState(false);
  const storyController = useStory({ story, demo: storyDemo, emitted: emittedToday });
  const account = useAccount(httpAccountApi);
  const [person] = usePerson();
  const [bear] = useAvatar();
  const [agentName] = useAgentName();
  const [settings] = useSettings();
  const reducedMotion = useReducedMotion();
  const [onboarding] = useOnboarding();
  const [greetingDismissed, setGreetingDismissed] = useState(false);
  const [joinDismissed, setJoinDismissed] = useState(false);
  const navigator = useNavigator(httpNavigatorApi);
  const desktop = useDesktop();
  const now = useNow();
  const health = useHealth();
  const officeApps = useOfficeApps({
    navigator,
    navigatorApi: httpNavigatorApi,
    desktop,
    fixtureMode,
    agentName,
    snapshot: health.status === "ok" ? health.health.snapshot : null,
    notify: notifyLoop,
  });

  useEffect(
    () => applyWorldAction(worldActionFor(navigator.state), worldSearch),
    [navigator.state],
  );

  function openApp(appId: string) {
    setPhoneApp(appId);
    setPhoneOpen(true);
  }

  function showOnMap(response: SearchResponse) {
    worldSearch.showResults(response);
    setPhoneOpen(false);
    setView("map");
  }

  function searchHere(building: Building) {
    navigator.setDraft(searchHereDraft(building));
    openApp("ask");
  }

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
          onShowOnMap={showOnMap}
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
  const badgeColour = personBadgeColour(person);
  const hudAccount: HudAccount =
    account.state.status === "signed-in"
      ? { status: "signed-in", handle: account.state.user.handle, colour: badgeColour }
      : { status: account.state.status };
  const current = storyController.progress.current;
  const goal = choice !== "story" ? "Explore" : current ? current.quest.title : "Open quests done";

  function showMe(target: ShowMeTarget) {
    if (target === "map") {
      setView("map");
      return;
    }
    openApp("ask");
  }

  const shownView = view ?? landingView(onboarding.done);

  return (
    <GameShell
      view={shownView}
      phoneOpen={phoneOpen}
      onSelectTab={(tab) => (tab === "phone" ? setPhoneOpen(true) : setView(tab))}
      hud={
        <Hud
          now={now}
          health={health}
          goal={goal}
          account={hudAccount}
          bell={<NotificationBell store={notificationStore()} />}
          onOpenYou={() => setYouOpen(true)}
        />
      }
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
      canvas={
        <>
          <WorldCanvas
            demoSearch={demoSearch}
            agent={{
              name: shownAgentName(agentName),
              figure: (lite) => <BearFigure config={bear} lite={lite} motion="still" />,
            }}
            onAgentOpen={() => openApp("ask")}
            onSearchHere={searchHere}
          />
          {shownView === "home" && (
            <OfficeView
              lite={settings.lite}
              reducedMotion={reducedMotion}
              player={<PersonFigure config={person} shadows={!settings.lite} />}
              agent={bear}
              onUseDesk={() => setDesktopOpen(true)}
              onGoOutside={() => setView("map")}
            />
          )}
        </>
      }
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
          <DesktopDialog
            open={desktopOpen}
            onClose={() => setDesktopOpen(false)}
            apps={officeApps}
            controller={desktop}
            now={now}
          />
          {youOpen && (
            <YouSheet
              profile={onboarding.profile}
              person={person}
              agent={{ name: agentName, bear }}
              story={storyController.progress}
              onClose={() => setYouOpen(false)}
            />
          )}
          <Toasts store={notificationStore()} reducedMotion={reducedMotion} />
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
