"use client";

import { useEffect, useRef, useState } from "react";
import { httpAccountApi } from "@/features/accounts/account-api";
import { useAccount } from "@/features/accounts/use-account";
import { useAvatar } from "@/features/avatar/use-avatar";
import { useAgentName, usePerson } from "@/features/avatar/use-person";
import { useDesktop } from "@/features/desktop/use-desktop";
import { httpNavigatorApi } from "@/features/navigator/navigator-api";
import { useNavigator } from "@/features/navigator/use-navigator";
import { useInboxSync } from "@/features/notifications/use-notifications";
import { useOnboarding } from "@/features/onboarding/use-onboarding";
import { landingView } from "@/features/shell/first-run";
import { GameShell, type WorldView } from "@/features/shell/game-shell";
import { useHealth } from "@/features/shell/use-health";
import { useOfficeReady } from "@/features/shell/use-office-ready";
import type { ShowMeTarget } from "@/features/story/show-me";
import { useStory } from "@/features/story/use-story";
import type { Building } from "@/features/world/buildings";
import { worldSearch } from "@/features/world/world-search";
import { appEvents, emittedToday, offInFixtures } from "@/infrastructure/app-events";
import { useNow } from "@/infrastructure/bern-time";
import { useReducedMotion } from "@/infrastructure/use-reduced-motion";
import { useSettings } from "@/infrastructure/use-settings";
import type { SearchResponse, Story } from "@/infrastructure/contract-types.generated";
import { useWorldPhone } from "./world-phone";
import { unreadRefresh, useUnreadMessages } from "./use-unread-messages";
import { showMeRoute } from "./show-me-route";
import { useWorldApps } from "./use-world-apps";
import { WorldHud, WorldSide, focusBeside } from "./world-hud";
import { useWorldLumi } from "./world-lumi";
import { visitedOffice } from "./visited-office";
import { useMessageWith, useWorldConnections } from "./world-connections";
import { WorldOverlay } from "./world-overlay";
import { WorldScene } from "./world-scene";
import { useWorldSettle } from "./world-settle";
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
  const phone = useWorldPhone();
  const [desktopOpen, setDesktopOpen] = useState(false);
  const [youOpen, setYouOpen] = useState(false);
  const [storyMenuOpen, setStoryMenuOpen] = useState(false);
  const [placeOpen, setPlaceOpen] = useState(false);
  const message = useMessageWith();
  const storyController = useStory({
    story,
    demo: storyDemo,
    emitted: emittedToday,
    off: fixtureMode ? offInFixtures : {},
  });
  const account = useAccount(httpAccountApi);
  const [person] = usePerson();
  const [bear] = useAvatar();
  const [agentName] = useAgentName();
  const [settings] = useSettings();
  const reducedMotion = useReducedMotion();
  const [onboarding] = useOnboarding();
  const navigator = useNavigator(httpNavigatorApi);
  const desktop = useDesktop();
  const now = useNow();
  const health = useHealth();
  // Read again when the phone or the desk's Messages closes: reading sends no live notice.
  const unreadMessages = useUnreadMessages(
    account.state.status === "signed-in",
    unreadRefresh(phone.open, desktopOpen, desktop.windows),
  );
  const signedIn = account.state.status === "signed-in";
  // Messages and connection requests reach the bell from the server; a new message moves the
  // unread count, which reads the server's notifications again.
  useInboxSync(signedIn, unreadMessages);
  const connections = useWorldConnections({
    signedIn,
    renderRoom: visitedOffice(settings.lite, reducedMotion),
  });
  const shownView = view ?? landingView(onboarding.done);
  // Called after useStory, so the story already listens when the office reports it is ready.
  const sitAtDesk = useOfficeReady(shownView === "home", onboarding.done);

  useEffect(
    () => applyWorldAction(worldActionFor(navigator.state), worldSearch),
    [navigator.state],
  );

  function showOnMap(response: SearchResponse) {
    worldSearch.showResults(response);
    phone.setOpen(false);
    setView("map");
  }

  function searchHere(building: Building) {
    navigator.setDraft(searchHereDraft(building));
    phone.openApp("ask");
  }

  function messageFrom(place: "phone" | "desk") {
    return (handle: string) => {
      message.ask(handle);
      if (place === "phone") phone.openApp("messages");
      else desktop.open("messages");
    };
  }

  const apps = useWorldApps({
    navigator,
    desktop,
    fixtureMode,
    agentName,
    health,
    unreadMessages,
    onShowOnMap: showOnMap,
    onOpenApp: phone.openApp,
    connections: connections.wiring,
    messageWith: message.messageWith,
    onMessageStarted: message.started,
    onMessageFrom: messageFrom,
  });
  const lumi = useWorldLumi({
    agentName,
    bear,
    lite: settings.lite,
    engineMode: health.status === "ok" ? health.health.mode : null,
    fixtureMode,
    navigator,
    onShowOnMap: showOnMap,
    onOpenAsk: () => phone.openApp("ask"),
    onMakeReport: apps.makeDeskReport,
    onOpenReports: () => setDesktopOpen(true),
  });
  const side = useRef<HTMLDivElement>(null);
  const settle = useWorldSettle(appEvents, { landing: () => focusBeside(side.current) });

  function showMe(target: ShowMeTarget) {
    const route = showMeRoute(target);
    if (route.kind === "view") setView(route.view);
    else if (route.kind === "settle") settle.open();
    else phone.openApp(route.appId);
  }

  function sitDown() {
    sitAtDesk();
    setDesktopOpen(true);
  }

  return (
    <GameShell
      view={shownView}
      phoneOpen={phone.open}
      onSelectTab={(tab) => (tab === "phone" ? phone.setOpen(true) : setView(tab))}
      tabBadges={{ phone: unreadMessages }}
      hud={
        <WorldHud
          now={now}
          health={health}
          account={account.state}
          person={person}
          story={storyController}
          onOpenYou={() => setYouOpen(true)}
        />
      }
      side={
        <WorldSide
          ref={side}
          account={account.state.status}
          onboarded={onboarding.done}
          story={storyController}
          storyDemo={storyDemo}
          settle={{ ...settle, settled: settle.plot !== null }}
          onShowMe={showMe}
          onOpenStoryMenu={() => setStoryMenuOpen(true)}
        />
      }
      canvas={
        <WorldScene
          view={shownView}
          demoSearch={demoSearch}
          person={person}
          bear={bear}
          agentName={agentName}
          lite={settings.lite}
          reducedMotion={reducedMotion}
          onAgentOpen={lumi.open}
          onSearchHere={searchHere}
          onPlacePanel={setPlaceOpen}
          onUseDesk={sitDown}
          onGoOutside={() => setView("map")}
        />
      }
      floatie={lumi.floatie}
      // A place's panel fills the bottom of a phone's screen, and a tall one reaches the floatie's
      // corner on a wide screen; the bear on the map still opens Lumi meanwhile.
      floatieHidden={shownView === "map" && placeOpen}
      overlay={
        <WorldOverlay
          phone={{
            open: phone.open,
            onClose: () => phone.setOpen(false),
            apps: apps.phone,
            appId: phone.appId,
            onAppChange: phone.setAppId,
            now,
            health,
            unreadMessages: unreadMessages ?? undefined,
            ...phone.notices,
          }}
          desktop={{
            open: desktopOpen,
            onClose: () => setDesktopOpen(false),
            apps: apps.office,
            controller: desktop,
            now,
          }}
          you={
            youOpen
              ? {
                  profile: onboarding.profile,
                  person,
                  agent: { name: agentName, bear },
                  story: storyController.progress,
                  people: connections.people,
                  onClose: () => setYouOpen(false),
                }
              : null
          }
          storyMenu={{
            controller: storyController,
            open: storyMenuOpen,
            onClose: () => setStoryMenuOpen(false),
          }}
          lumiChat={lumi.chat}
          settleDialog={settle.dialog}
          reducedMotion={reducedMotion}
        />
      }
    />
  );
}
