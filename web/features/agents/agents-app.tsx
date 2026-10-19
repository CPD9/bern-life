"use client";

import { useId } from "react";
import { type NumbersApi, httpNumbersApi } from "@/infrastructure/numbers-api";
import { useNumbers } from "@/infrastructure/use-numbers";
import { LoopCard } from "./loop-card";
import { LoopForm } from "./loop-form";
import { type LoopStore, browserLoops } from "./loop-store";
import type { AgentNotice } from "./loops";
import { NumbersStatus } from "./numbers-status";
import { SkillList } from "./skill-list";
import type { Skill } from "./skills";
import { type LoopSearch, useLoops } from "./use-loops";

export type AgentsAppProps = {
  agent: { name: string };
  search: LoopSearch;
  onTrySkill: (skill: Skill) => void;
  notify: (notice: AgentNotice) => void;
  /** The snapshot the engine serves now, from health; null while unknown. */
  snapshot: string | null;
  /** The engine serves invented fixtures (DEMO_FIXTURES): measured rows are marked FIXTURE. */
  fixtureMode: boolean;
  store?: LoopStore;
  /** Where the skills' measured rows come from; pass a stable object. */
  numbers?: NumbersApi;
};

/** The Agents app: an agent's skills with their evidence, and the loops the player keeps. The host
 *  injects search, notifications and where "Try" goes, so this runs in a desktop window or a page
 *  alike. The numbers are read once when it opens and again on Try again; loops run only when the
 *  player asks; nothing here polls or runs in the background. */
export function AgentsApp({
  agent,
  search,
  onTrySkill,
  notify,
  snapshot,
  fixtureMode,
  store = browserLoops(),
  numbers = httpNumbersApi,
}: AgentsAppProps) {
  const controller = useLoops(store, search, notify);
  const { state, retry } = useNumbers(numbers);
  const id = useId();
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby={`${id}-skills`} className="flex flex-col gap-3">
        <h3 id={`${id}-skills`} className="text-lg font-extrabold">
          {agent.name}&rsquo;s skills
        </h3>
        <NumbersStatus state={state} onRetry={retry} />
        <SkillList numbers={state} fixtureMode={fixtureMode} onTry={onTrySkill} />
      </section>
      <section aria-labelledby={`${id}-loops`} className="flex flex-col gap-3">
        <h3 id={`${id}-loops`} className="text-lg font-extrabold">
          Loops
        </h3>
        <p className="text-muted text-sm">
          A loop is a search {agent.name} keeps for you. Run it again when a new snapshot arrives;
          new and dropped results are listed here and sent to your notifications.
        </p>
        <LoopForm onSave={controller.save} />
        {controller.loops.length === 0 ? (
          <p className="text-muted">No loops yet.</p>
        ) : (
          <ul aria-label="Saved loops" className="flex flex-col gap-3">
            {controller.loops.map((loop) => (
              <LoopCard
                key={loop.id}
                loop={loop}
                status={controller.status[loop.id]}
                snapshot={snapshot}
                onRun={() => void controller.run(loop.id)}
                onRemove={() => controller.remove(loop.id)}
              />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
