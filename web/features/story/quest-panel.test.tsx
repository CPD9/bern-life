import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { type AppEvents, createAppEvents, emittedToday } from "@/infrastructure/app-events";
import { storyFixture } from "@/test/story";
import { CriteriaChecklist } from "./criteria-checklist";
import { emptyStoryState } from "./engine";
import { QuestPanel } from "./quest-panel";
import type { ShowMeTarget } from "./show-me";
import { type StoryStore, createStoryStore } from "./story-store";
import { useStory } from "./use-story";

function memoryStore() {
  const saved = new Map<string, string>([
    ["k", JSON.stringify({ ...emptyStoryState, choice: "story" })],
  ]);
  return createStoryStore(
    () => ({
      getItem: (key: string) => saved.get(key) ?? null,
      setItem: (key: string, value: string) => void saved.set(key, value),
    }),
    "k",
  );
}

type HarnessProps = {
  events: AppEvents;
  store: StoryStore;
  onShowMe: (target: ShowMeTarget) => void;
  canShow?: (target: ShowMeTarget) => boolean;
};

function Harness({ events, store, onShowMe, canShow }: HarnessProps) {
  const controller = useStory({
    story: storyFixture,
    demo: false,
    emitted: emittedToday,
    events,
    store,
  });
  return (
    <>
      <QuestPanel
        controller={controller}
        onShowMe={onShowMe}
        canShow={canShow}
        onOpenMenu={() => undefined}
      />
      <CriteriaChecklist controller={controller} />
    </>
  );
}

describe("QuestPanel", () => {
  test("shows the current step with its criterion, and advances only on the app event", () => {
    const events = createAppEvents();
    const targets: ShowMeTarget[] = [];
    render(
      <Harness events={events} store={memoryStore()} onShowMe={(target) => targets.push(target)} />,
    );
    expect(screen.getByText("Ask the Navigator in your own words and get a result.")).toBeTruthy();
    expect(screen.getByText("Case: the right people")).toBeTruthy();
    expect(screen.getAllByRole("img", { name: "0 of 2 steps done" })).toHaveLength(1);

    fireEvent.click(screen.getByRole("button", { name: "Show me" }));
    expect(targets).toEqual(["ask"]);
    expect(screen.getByText("Try 'glucose sensors' or 'blood sugar monitoring'.")).toBeTruthy();

    act(() => events.emit("search_answered"));
    expect(screen.getByText("Open the sentence that proves a result.")).toBeTruthy();
    expect(screen.getAllByRole("img", { name: "1 of 2 steps done" })).toHaveLength(1);
  });

  test("a place the host cannot take the player to leaves Show me with the hint alone", () => {
    const targets: ShowMeTarget[] = [];
    render(
      <Harness
        events={createAppEvents()}
        store={memoryStore()}
        onShowMe={(target) => targets.push(target)}
        canShow={(target) => target !== "ask"}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Show me" }));
    expect(targets).toEqual([]);
    expect(screen.getByText("Try 'glucose sensors' or 'blood sugar monitoring'.")).toBeTruthy();
  });

  test("the checklist lights a criterion only when its quest is done", () => {
    const events = createAppEvents();
    render(<Harness events={events} store={memoryStore()} onShowMe={() => undefined} />);
    const metRows = () =>
      Array.from(document.querySelectorAll("li"))
        .filter((item) => item.textContent?.includes(": met"))
        .map((item) => item.textContent);
    expect(metRows()).toEqual([]);
    act(() => events.emit("abstained_seen"));
    expect(metRows()).toEqual(["✓Says when no page supports it: met"]);
  });

  test("the panel collapses to a pill that names the quest", () => {
    render(<Harness events={createAppEvents()} store={memoryStore()} onShowMe={() => undefined} />);
    fireEvent.click(screen.getByRole("button", { name: "Hide quest" }));
    expect(screen.getByRole("button", { name: "Quest: Find the right people" })).toBeTruthy();
  });
});
