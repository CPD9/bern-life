"use client";

import { useState, useSyncExternalStore } from "react";
import type { SearchResponse } from "@/infrastructure/contract-types.generated";
import type { LoopStore } from "./loop-store";
import type { Kind } from "./kinds";
import {
  type AgentNotice,
  type Loop,
  isFailedRun,
  makeLoop,
  noticeFor,
  recordRun,
  removeLoop,
  replaceLoop,
  saveLoop,
} from "./loops";

/** The response, "rate_limited" when the server refused the search as over its limit, or null for
 *  any other failure. */
export type LoopSearch = (query: string) => Promise<SearchResponse | "rate_limited" | null>;

export type RunStatus = "running" | "failed" | "rate_limited";

export type SaveOutcome = "saved" | "exists" | "invalid";

export type LoopsController = {
  readonly loops: readonly Loop[];
  readonly status: Readonly<Record<string, RunStatus>>;
  save(query: string, kinds: readonly Kind[]): SaveOutcome;
  remove(id: string): void;
  run(id: string): Promise<void>;
};

const noLoops: readonly Loop[] = [];

/** Runs read the store again when the answer arrives, so two loops run at once both keep their
 *  results, and a loop removed while it ran stays removed. */
export function useLoops(
  store: LoopStore,
  search: LoopSearch,
  notify: (notice: AgentNotice) => void,
): LoopsController {
  const loops = useSyncExternalStore(store.subscribe, store.get, () => noLoops);
  const [status, setStatus] = useState<Readonly<Record<string, RunStatus>>>({});

  function mark(id: string, next: RunStatus | null) {
    setStatus((current) => {
      const rest = Object.fromEntries(Object.entries(current).filter(([key]) => key !== id));
      return next === null ? rest : { ...rest, [id]: next };
    });
  }

  async function run(id: string) {
    const loop = store.get().find((saved) => saved.id === id);
    if (loop === undefined) return;
    mark(id, "running");
    let response: Awaited<ReturnType<LoopSearch>>;
    try {
      response = await search(loop.query);
    } catch {
      response = null;
    }
    const current = store.get().find((saved) => saved.id === id);
    if (current === undefined) {
      mark(id, null);
      return;
    }
    if (response === "rate_limited" || isFailedRun(response)) {
      mark(id, response === "rate_limited" ? response : "failed");
      return;
    }
    const next = recordRun(current, response);
    store.set(replaceLoop(store.get(), next));
    mark(id, null);
    for (const change of next.changes ?? []) notify(noticeFor(next, change));
  }

  return {
    loops,
    status,
    save: (query, kinds) => {
      const loop = makeLoop(query, kinds);
      if (loop === null) return "invalid";
      const current = store.get();
      const next = saveLoop(current, loop);
      if (next === current) return "exists";
      store.set(next);
      return "saved";
    },
    remove: (id) => {
      store.set(removeLoop(store.get(), id));
      mark(id, null);
    },
    run,
  };
}
