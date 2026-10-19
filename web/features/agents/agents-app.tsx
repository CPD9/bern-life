"use client";

import { useId } from "react";
import { LoopCard } from "./loop-card";
import { LoopForm } from "./loop-form";
import { type LoopStore, browserLoops } from "./loop-store";
import type { AgentNotice } from "./loops";
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
  store?: LoopStore;
};

/** The Agents app: an agent's skills and the loops the player keeps. The host injects search,
 *  notifications and where "Try" goes, so this runs in a desktop window or a page alike. Loops run
 *  only when the player asks; nothing here polls or runs in the background. */
export function AgentsApp({
  agent,
  search,
  onTrySkill,
  notify,
  snapshot,
  store = browserLoops(),
}: AgentsAppProps) {
  const controller = useLoops(store, search, notify);
  const id = useId();
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby={`${id}-skills`} className="flex flex-col gap-3">
        <h3 id={`${id}-skills`} className="text-lg font-extrabold">
          {agent.name}&rsquo;s skills
        </h3>
        <SkillList onTry={onTrySkill} />
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
