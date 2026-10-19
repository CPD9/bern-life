"use client";

import { useEffect, useMemo, useSyncExternalStore } from "react";
import {
  type AppEventName,
  type AppEvents,
  type OffEvents,
  appEvents,
} from "@/infrastructure/app-events";
import type { Story } from "@/infrastructure/contract-types.generated";
import {
  type StoryProgress,
  type StoryState,
  applyEvent,
  emptyStoryState,
  storyProgress,
} from "./engine";
import { type StoryStore, createStoryStore } from "./story-store";

export type StoryController = {
  readonly story: Story;
  readonly state: StoryState;
  readonly progress: StoryProgress;
  start(): void;
  explore(): void;
  focus(questId: string): void;
  restart(): void;
};

type UseStoryOptions = {
  story: Story;
  demo: boolean;
  emitted: readonly AppEventName[];
  /** Emitted events that are off in this mode, with why; their steps wait. */
  off?: OffEvents;
  events?: Pick<AppEvents, "subscribe">;
  store?: StoryStore;
};

const stores = new Map<string, StoryStore>();

function browserStore(demo: boolean): StoryStore {
  // The jury's demo run keeps its own progress, apart from a player's own story.
  const key = demo ? "bernlife.story.demo" : "bernlife.story";
  let store = stores.get(key);
  if (!store) {
    store = createStoryStore(() => window.localStorage, key);
    stores.set(key, store);
  }
  return store;
}

export function useStory({
  story,
  demo,
  emitted,
  off = {},
  events = appEvents,
  store,
}: UseStoryOptions): StoryController {
  const resolved = useMemo(
    () => store ?? (typeof window === "undefined" ? null : browserStore(demo)),
    [store, demo],
  );
  const state = useSyncExternalStore(
    (listener) => resolved?.subscribe(listener) ?? (() => undefined),
    () => resolved?.get() ?? emptyStoryState,
    () => emptyStoryState,
  );

  useEffect(() => {
    if (!resolved) return;
    if (demo && resolved.get().choice === null)
      resolved.set({ ...resolved.get(), choice: "story" });
    return events.subscribe((event) => resolved.set(applyEvent(story, resolved.get(), event)));
  }, [resolved, events, story, demo]);

  const set = (next: StoryState) => resolved?.set(next);
  return {
    story,
    state,
    progress: storyProgress(story, state, emitted, off),
    start: () => set({ ...state, choice: "story" }),
    explore: () => set({ ...state, choice: "free" }),
    focus: (questId) => set({ ...state, choice: "story", focus: questId }),
    restart: () => set({ ...emptyStoryState, choice: "story" }),
  };
}
