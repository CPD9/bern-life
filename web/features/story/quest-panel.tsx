"use client";

import { useState } from "react";
import { criterionTags } from "./criteria";
import { ProgressDots } from "./progress-dots";
import { type ShowMeTarget, showMeTarget } from "./show-me";
import type { StoryController } from "./use-story";

type QuestPanelProps = {
  controller: StoryController;
  onShowMe: (target: ShowMeTarget) => void;
  onOpenMenu: () => void;
};

export function QuestPanel({ controller, onShowMe, onOpenMenu }: QuestPanelProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [hintFor, setHintFor] = useState<string | null>(null);
  const current = controller.progress.current;
  const step = current?.nextStep ?? null;
  const target = step ? showMeTarget(step) : null;

  if (collapsed) {
    return (
      <button
        type="button"
        aria-expanded={false}
        onClick={() => setCollapsed(false)}
        className="bg-panel shadow-panel border-panel-border rounded-pill border px-4 py-2 text-sm font-bold"
      >
        Quest: {current ? current.quest.title : "story complete"}
      </button>
    );
  }

  return (
    <section
      aria-label="Story quest"
      className="bg-panel shadow-panel border-panel-border flex w-[min(20rem,calc(100vw-2rem))] flex-col gap-2 rounded-3xl border p-4"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-muted text-xs font-bold tracking-wide uppercase">
          {current ? current.quest.title : controller.story.title}
        </p>
        <button
          type="button"
          aria-expanded={true}
          aria-label="Hide quest"
          onClick={() => setCollapsed(true)}
          className="text-muted -mt-1 rounded-full px-2 font-bold"
        >
          –
        </button>
      </div>
      {current && step ? (
        <>
          <span className="bg-chip rounded-pill self-start px-2.5 py-0.5 text-xs font-bold">
            {criterionTags[current.quest.criterion]}
          </span>
          <p aria-live="polite" className="font-bold">
            {step.text}
          </p>
          <ProgressDots total={current.quest.steps.length} done={current.stepsDone} />
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {(target || step.hint) && (
              <button
                type="button"
                onClick={() => {
                  setHintFor(step.id);
                  if (target) onShowMe(target);
                }}
                className="bg-primary text-primary-ink rounded-pill px-4 py-1.5 text-sm font-bold"
              >
                Show me
              </button>
            )}
            <button
              type="button"
              onClick={onOpenMenu}
              className="text-primary rounded-pill px-2 py-1.5 text-sm font-bold"
            >
              All quests
            </button>
          </div>
          {hintFor === step.id && step.hint && <p className="text-muted text-sm">{step.hint}</p>}
        </>
      ) : (
        <>
          <p className="font-bold">Every quest you can play today is done.</p>
          <button
            type="button"
            onClick={onOpenMenu}
            className="text-primary rounded-pill self-start px-2 py-1.5 text-sm font-bold"
          >
            All quests
          </button>
        </>
      )}
    </section>
  );
}
