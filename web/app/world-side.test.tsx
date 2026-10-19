import { describe, expect, test } from "bun:test";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef } from "react";
import { createSettleStore } from "@/features/settle/settle-store";
import { TabBar } from "@/features/shell/tab-bar";
import { type StoryState, emptyStoryState } from "@/features/story/engine";
import { createStoryStore } from "@/features/story/story-store";
import { useStory } from "@/features/story/use-story";
import { createAppEvents, emittedToday } from "@/infrastructure/app-events";
import { storyFixture } from "@/test/story";
import { WorldSide, focusBeside } from "./world-hud";
import { useWorldSettle } from "./world-settle";

function memory() {
  const items = new Map<string, string>();
  return () => ({
    getItem: (key: string) => items.get(key) ?? null,
    setItem: (key: string, value: string) => void items.set(key, value),
  });
}

function stores(choice: StoryState["choice"]) {
  const story = createStoryStore(memory(), "bernlife.story.test");
  story.set({ ...emptyStoryState, choice });
  return { story, settle: createSettleStore(memory()), events: createAppEvents() };
}

type SideProps = ReturnType<typeof stores>;

/** The cards beside the world, the settle dialog and the tab bar, wired as the world app does. */
function Side({ story: storyStore, settle: settleStore, events }: SideProps) {
  const side = useRef<HTMLDivElement>(null);
  const story = useStory({
    story: storyFixture,
    demo: false,
    emitted: emittedToday,
    events,
    store: storyStore,
  });
  const settle = useWorldSettle(
    events,
    () => settleStore,
    () => focusBeside(side.current),
  );
  return (
    <>
      <WorldSide
        ref={side}
        account="signed-in"
        onboarded
        story={story}
        storyDemo={false}
        settle={{ ...settle, settled: settle.plot !== null }}
        onShowMe={() => undefined}
        onOpenStoryMenu={() => undefined}
      />
      {settle.dialog}
      <TabBar selected="home" onSelect={() => undefined} />
    </>
  );
}

function openFromTheCard() {
  const choose = screen.getByRole("button", { name: "Choose a plot" });
  act(() => choose.focus());
  act(() => fireEvent.click(choose));
  return choose;
}

async function close() {
  await act(async () => {
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
  });
}

describe("settling from the side card", () => {
  test("focus goes to the card that takes its place", async () => {
    render(<Side {...stores(null)} />);
    openFromTheCard();
    act(() => fireEvent.click(screen.getByRole("button", { name: "Settle in Altstadt" })));
    await close();
    expect(screen.queryByRole("button", { name: "Choose a plot" })).toBeNull();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Start the story" }));
  });

  test("exploring freely there is no card after it, so focus goes to the tab on screen", async () => {
    render(<Side {...stores("free")} />);
    openFromTheCard();
    act(() => fireEvent.click(screen.getByRole("button", { name: "Settle in Altstadt" })));
    await close();
    expect(document.activeElement).toBe(screen.getByRole("button", { name: "Home" }));
  });

  test("closing without settling gives focus back to Choose a plot", async () => {
    render(<Side {...stores(null)} />);
    const choose = openFromTheCard();
    await close();
    expect(document.activeElement).toBe(choose);
  });
});
