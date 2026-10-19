"use client";

import { type Ref, useState } from "react";
import type { AccountState } from "@/features/accounts/use-account";
import { type PersonConfig, personBadgeColour } from "@/features/avatar/person-config";
import { NotificationBell } from "@/features/notifications/notification-bell";
import { notificationStore } from "@/features/notifications/use-notifications";
import type { HudAccount } from "@/features/shell/account-badge";
import { firstRunCard } from "@/features/shell/first-run";
import { GuideGreeting } from "@/features/shell/guide-greeting";
import { Hud } from "@/features/shell/hud";
import { JoinPrompt, OnboardingPrompt, SettlePrompt } from "@/features/shell/journey-prompts";
import type { HealthState } from "@/features/shell/use-health";
import { CriteriaChecklist } from "@/features/story/criteria-checklist";
import { QuestPanel } from "@/features/story/quest-panel";
import type { ShowMeTarget } from "@/features/story/show-me";
import { StoryStart } from "@/features/story/story-start";
import type { StoryController } from "@/features/story/use-story";
import { focusableIn } from "@/infrastructure/ui/focus-trap";

// The HUD across the top and the cards at the side of the world, composed from the shell and the
// story. Which card shows follows the first-run order in features/shell/first-run.ts.

type WorldHudProps = {
  now: Date | null;
  health: HealthState;
  account: AccountState;
  person: PersonConfig;
  story: StoryController;
  onOpenYou: () => void;
};

export function WorldHud({ now, health, account, person, story, onOpenYou }: WorldHudProps) {
  const hudAccount: HudAccount =
    account.status === "signed-in"
      ? { status: "signed-in", handle: account.user.handle, colour: personBadgeColour(person) }
      : { status: account.status };
  const current = story.progress.current;
  const goal =
    story.state.choice !== "story" ? "Explore" : current ? current.quest.title : "Open quests done";
  return (
    <Hud
      now={now}
      health={health}
      goal={goal}
      account={hudAccount}
      bell={<NotificationBell store={notificationStore()} />}
      onOpenYou={onOpenYou}
    />
  );
}

/**
 * Where focus goes when the side card that held it is gone, as settling removes the settle card:
 * the first control of the card now beside the world, or, with none, the tab of the view on screen.
 */
export function focusBeside(side: HTMLElement | null): HTMLElement | null {
  const card = side === null ? undefined : focusableIn(side)[0];
  return (
    card ?? document.querySelector<HTMLElement>('nav[aria-label="Main"] [aria-current="true"]')
  );
}

type WorldSideProps = {
  /** The cards' column, for `focusBeside`. */
  ref?: Ref<HTMLDivElement>;
  account: AccountState["status"];
  onboarded: boolean;
  story: StoryController;
  /** `?story=demo`: the criteria checklist shows too. */
  storyDemo: boolean;
  settle: { readonly settled: boolean; readonly dismissed: boolean; open(): void; dismiss(): void };
  onShowMe: (target: ShowMeTarget) => void;
  /** Whether "Show me" can take the player there; the map cannot without WebGL. */
  canShowMe?: (target: ShowMeTarget) => boolean;
  onOpenStoryMenu: () => void;
};

export function WorldSide({
  ref,
  account,
  onboarded,
  story,
  storyDemo,
  settle,
  onShowMe,
  canShowMe,
  onOpenStoryMenu,
}: WorldSideProps) {
  const [greetingDismissed, setGreetingDismissed] = useState(false);
  const [joinDismissed, setJoinDismissed] = useState(false);
  const card = firstRunCard({
    account,
    onboarded,
    storyChoice: story.state.choice,
    actedAlready: story.state.done.length > 0,
    greetingDismissed,
    joinDismissed,
    settled: settle.settled,
    settleDismissed: settle.dismissed,
  });
  return (
    <div ref={ref} className="flex flex-col items-start gap-3">
      {card === "greeting" && <GuideGreeting onDismiss={() => setGreetingDismissed(true)} />}
      {card === "join" && <JoinPrompt onNotNow={() => setJoinDismissed(true)} />}
      {card === "onboarding" && <OnboardingPrompt />}
      {card === "settle" && <SettlePrompt onChoose={settle.open} onNotNow={settle.dismiss} />}
      {card === "story-start" && <StoryStart controller={story} />}
      {card === "quest" && (
        <QuestPanel
          controller={story}
          onShowMe={onShowMe}
          canShow={canShowMe}
          onOpenMenu={onOpenStoryMenu}
        />
      )}
      {storyDemo && <CriteriaChecklist controller={story} />}
    </div>
  );
}
